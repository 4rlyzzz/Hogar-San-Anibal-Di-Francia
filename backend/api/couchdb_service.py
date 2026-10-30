import logging
import os
from urllib.parse import quote

import requests
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

COUCHDB_URL = os.getenv('COUCHDB_URL', 'http://127.0.0.1:5984')
COUCHDB_DB = os.getenv('COUCHDB_DB', 'casa_hogar')
COUCHDB_USER = os.getenv('COUCHDB_USER', 'casa_app')
COUCHDB_PASSWORD = os.getenv('COUCHDB_PASSWORD')

# Sin contraseña la app no debe arrancar (antes fallaba "raro" más tarde)
if not COUCHDB_PASSWORD:
    raise ImproperlyConfigured('Falta la variable de entorno COUCHDB_PASSWORD')

BASE_DB_URL = f"{COUCHDB_URL}/{COUCHDB_DB}"

TIMEOUT = 10             # segundos; evita workers colgados si CouchDB no responde
PAGINA = 200             # documentos por consulta a _find (por defecto devuelve solo 25)
MAX_PAGINAS = 100        # tope de seguridad: 100 x 200 = 20,000 documentos por consulta

# Lista blanca: solo estos tipos pueden consultarse o crearse
TIPOS_VALIDOS = {'producto', 'movimiento', 'donador', 'usuario'}

# Campos que nunca deben salir hacia el cliente
CAMPOS_SECRETOS = ('clave', 'password')

# Una sola sesión reutiliza conexiones TCP en vez de abrir una por llamada
session = requests.Session()
session.auth = (COUCHDB_USER, COUCHDB_PASSWORD)


def _request(method, url, **kwargs):
    """Hace la petición a CouchDB con timeout y errores controlados.
    Nunca devuelve al cliente detalles internos (se registran en el log)."""
    try:
        response = session.request(method, url, timeout=TIMEOUT, **kwargs)
    except requests.exceptions.RequestException:
        logger.exception('No se pudo conectar con CouchDB (%s)', method)
        return {'error': 'Servicio de base de datos no disponible'}, 503

    try:
        return response.json(), response.status_code
    except ValueError:
        logger.error('Respuesta no JSON de CouchDB (%s %s): %s',
                     method, response.status_code, response.text[:500])
        return {'error': 'Respuesta inválida de la base de datos'}, 502


def sin_secretos(doc):
    """Devuelve una copia del documento sin hashes de contraseña."""
    if not isinstance(doc, dict):
        return doc
    return {k: v for k, v in doc.items() if k not in CAMPOS_SECRETOS}


def _id_valido(doc_id):
    """Rechaza IDs vacíos o que empiecen con '_' (_design, _all_docs, _users...)."""
    doc_id = str(doc_id or '')
    return bool(doc_id) and not doc_id.startswith('_')


def _doc_url(doc_id):
    """Codifica el ID para que '/', '..' o '?' no cambien el destino de la URL."""
    return f"{BASE_DB_URL}/{quote(str(doc_id), safe='')}"


def _quitar_reservados(doc_data):
    """Elimina campos que empiezan con '_' (_id, _rev, _deleted, _attachments...).
    Evita que el cliente cree documentos _design/* o manipule metadatos."""
    return {k: v for k, v in dict(doc_data).items() if not str(k).startswith('_')}


def _leer_documento(doc_id, tipo_esperado):
    """Lee un documento (con secretos, uso interno) verificando que sea del tipo esperado."""
    if tipo_esperado not in TIPOS_VALIDOS:
        return {'error': 'Tipo inválido'}, 400
    if not _id_valido(doc_id):
        return {'error': 'ID no válido'}, 400

    data, status = _request('GET', _doc_url(doc_id))
    if status != 200:
        return data, status

    # Si el ID existe pero es de otro tipo, respondemos como si no existiera
    if data.get('tipo') != tipo_esperado:
        return {'error': 'No encontrado'}, 404
    return data, 200


def _get_all_documents():
    """Todos los documentos, SIN filtrar secretos (uso interno)."""
    data, status = _request('GET', f"{BASE_DB_URL}/_all_docs",
                            params={'include_docs': 'true'})
    if status != 200:
        return {'error': 'Error al consultar CouchDB'}, status

    rows = data.get('rows', [])
    # Filtrar documentos internos de CouchDB (los que empiezan con _)
    return [row['doc'] for row in rows
            if 'doc' in row and not row['id'].startswith('_')], 200


def get_all_documents():
    """Todos los documentos de la base, sin hashes de contraseña."""
    docs, status = _get_all_documents()
    if status != 200:
        return docs, status
    return [sin_secretos(d) for d in docs], 200


def _find_todos(selector):
    """Ejecuta _find pidiendo páginas de PAGINA documentos con 'bookmark'
    hasta traer todos los resultados (o llegar a MAX_PAGINAS)."""
    docs, bookmark = [], None
    for _ in range(MAX_PAGINAS):
        query = {'selector': selector, 'limit': PAGINA}
        if bookmark:
            query['bookmark'] = bookmark

        data, status = _request('POST', f"{BASE_DB_URL}/_find", json=query)
        if status != 200 or not isinstance(data.get('docs'), list):
            return data, status

        lote = data['docs']
        docs.extend(lote)
        bookmark = data.get('bookmark')

        # Si llegó una página incompleta, ya no quedan más resultados
        if len(lote) < PAGINA or not bookmark:
            break
    else:
        logger.warning('Consulta %s alcanzó el tope de %s documentos',
                       selector, PAGINA * MAX_PAGINAS)
    return docs, 200


def get_documents_by_type(doc_type, con_secretos=False):
    """Documentos filtrados por 'tipo'. Por defecto NO incluye hashes de contraseña;
    solo el login debe pedir con_secretos=True."""
    if doc_type not in TIPOS_VALIDOS:
        return {'error': 'Tipo inválido'}, 400

    docs, status = _find_todos({'tipo': doc_type})
    if status != 200:
        return docs, status

    if not con_secretos:
        docs = [sin_secretos(d) for d in docs]
    return docs, 200


def create_document(doc_data):
    """Crea un documento. Exige un 'tipo' válido y descarta campos reservados."""
    if doc_data.get('tipo') not in TIPOS_VALIDOS:
        return {'error': 'Tipo inválido'}, 400
    return _request('POST', BASE_DB_URL, json=_quitar_reservados(doc_data))


def get_document_by_id(doc_id, tipo_esperado):
    """Obtiene un documento por ID, solo si es del tipo esperado y sin secretos."""
    data, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return data, status
    return sin_secretos(data), 200


def update_document(doc_id, doc_data, rev, tipo_esperado, fusionar=False):
    """Actualiza un documento verificando su tipo.

    fusionar=True conserva los campos actuales que el cliente no envió
    (por ejemplo, el hash 'clave' de un usuario)."""
    actual, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return actual, status

    nuevo = _quitar_reservados(doc_data)
    if fusionar:
        base = {k: v for k, v in actual.items() if not k.startswith('_')}
        nuevo = {**base, **nuevo}

    nuevo['tipo'] = tipo_esperado   # el tipo no se puede cambiar desde fuera
    nuevo['_id'] = actual['_id']
    nuevo['_rev'] = rev
    return _request('PUT', _doc_url(actual['_id']), json=nuevo)


def delete_document(doc_id, rev, tipo_esperado):
    """Elimina un documento verificando su tipo."""
    actual, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return actual, status
    return _request('DELETE', _doc_url(actual['_id']), params={'rev': rev})