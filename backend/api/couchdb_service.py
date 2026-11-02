import logging
import os
import random
import re
import time
import unicodedata
from urllib.parse import quote

import requests
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)

COUCHDB_URL = os.getenv('COUCHDB_URL', 'http://127.0.0.1:5984')
COUCHDB_USER = os.getenv('COUCHDB_USER', 'casa_app')
COUCHDB_PASSWORD = os.getenv('COUCHDB_PASSWORD')

# Sin contraseña la app no debe arrancar (antes fallaba "raro" más tarde)
if not COUCHDB_PASSWORD:
    raise ImproperlyConfigured('Falta la variable de entorno COUCHDB_PASSWORD')

# Cada tipo de documento vive en su propia base. Debe coincidir con setup.ps1.
# Esta tabla es también la lista blanca de tipos válidos.
DBS = {
    'usuario':    os.getenv('COUCHDB_DB_USUARIOS', 'casa_usuarios'),
    'producto':   os.getenv('COUCHDB_DB_INVENTARIO', 'casa_inventario'),
    'donador':    os.getenv('COUCHDB_DB_DONADORES', 'casa_donadores'),
    'movimiento': os.getenv('COUCHDB_DB_MOVIMIENTOS', 'casa_movimientos'),
}
TIPOS_VALIDOS = set(DBS)

TIMEOUT = 10
PAGINA = 200
MAX_PAGINAS = 100

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


def _db_url(tipo):
    """URL de la base donde viven los documentos de ese tipo."""
    return f"{COUCHDB_URL}/{DBS[tipo]}"


def _doc_url(tipo, doc_id):
    """Codifica el ID para que '/', '..' o '?' no cambien el destino de la URL."""
    return f"{_db_url(tipo)}/{quote(str(doc_id), safe='')}"


def _quitar_reservados(doc_data):
    """Elimina campos que empiezan con '_' (_id, _rev, _deleted, _attachments...).
    Evita que el cliente cree documentos _design/* o manipule metadatos."""
    return {k: v for k, v in dict(doc_data).items() if not str(k).startswith('_')}


def _leer_documento(doc_id, tipo_esperado):
    """Lee un documento (con secretos, uso interno) de la base de su tipo,
    verificando además que sea del tipo esperado."""
    if tipo_esperado not in TIPOS_VALIDOS:
        return {'error': 'Tipo inválido'}, 400
    if not _id_valido(doc_id):
        return {'error': 'ID no válido'}, 400

    data, status = _request('GET', _doc_url(tipo_esperado, doc_id))
    if status != 200:
        return data, status

    # Defensa extra: el documento tiene que ser del tipo pedido
    if data.get('tipo') != tipo_esperado:
        return {'error': 'No encontrado'}, 404
    return data, 200


def _find_todos(tipo, selector):
    """Ejecuta _find en la base de ese tipo, pidiendo páginas de PAGINA
    documentos con 'bookmark' hasta traer todos (o llegar a MAX_PAGINAS)."""
    docs, bookmark = [], None
    for _ in range(MAX_PAGINAS):
        query = {'selector': selector, 'limit': PAGINA}
        if bookmark:
            query['bookmark'] = bookmark

        data, status = _request('POST', f"{_db_url(tipo)}/_find", json=query)
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

    docs, status = _find_todos(doc_type, {'tipo': doc_type})
    if status != 200:
        return docs, status

    if not con_secretos:
        docs = [sin_secretos(d) for d in docs]
    return docs, 200


def create_document(doc_data, doc_id=None):
    """Crea un documento en la base de su tipo. Exige un 'tipo' válido y
    descarta campos reservados.
    doc_id: identificador fijo (por ejemplo 'donador:parroquia-san-jose'); si ya existe,
    CouchDB responde 409 y no se crea otro igual aunque dos personas lo creen a la vez."""
    tipo = doc_data.get('tipo')
    if tipo not in TIPOS_VALIDOS:
        return {'error': 'Tipo inválido'}, 400
    if doc_id is None:
        return _request('POST', _db_url(tipo), json=_quitar_reservados(doc_data))
    if not _id_valido(doc_id):
        return {'error': 'ID no válido'}, 400
    return _request('PUT', _doc_url(tipo, doc_id), json=_quitar_reservados(doc_data))


def slug(texto):
    """'Parroquia San José' -> 'parroquia-san-jose' (para identificadores fijos)."""
    sin_tildes = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', sin_tildes.lower()).strip('-')[:80]


def get_document_by_id(doc_id, tipo_esperado):
    """Obtiene un documento por ID, solo si es del tipo esperado y sin secretos."""
    data, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return data, status
    return sin_secretos(data), 200


def get_document_con_secretos(doc_id, tipo_esperado):
    """Como get_document_by_id pero con el hash de la contraseña:
    solo para revisar la contraseña actual al cambiarla."""
    return _leer_documento(doc_id, tipo_esperado)


def update_document(doc_id, doc_data, rev, tipo_esperado, fusionar=False):
    """Actualiza un documento verificando su tipo.

    fusionar=True conserva los campos actuales que el cliente no envió
    (por ejemplo, el hash 'clave' de un usuario).
    rev=None usa la revisión actual (para cambios que no dependen de lo que vio el cliente)."""
    actual, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return actual, status

    nuevo = _quitar_reservados(doc_data)
    if fusionar:
        base = {k: v for k, v in actual.items() if not k.startswith('_')}
        nuevo = {**base, **nuevo}

    nuevo['tipo'] = tipo_esperado   # el tipo no se puede cambiar desde fuera
    nuevo['_id'] = actual['_id']
    nuevo['_rev'] = rev or actual['_rev']
    return _request('PUT', _doc_url(tipo_esperado, actual['_id']), json=nuevo)


class SinCambios(Exception):
    """Lo lanza cambiar() en actualizar_con_reintento para no guardar nada."""


def actualizar_con_reintento(doc_id, tipo_esperado, cambiar, intentos=20):
    """Lee el documento, aplica cambiar(doc) -> {campos nuevos} y lo guarda con su _rev.
    Si otra persona lo guardo entre medio (409), vuelve a leer y a aplicar el cambio sobre lo nuevo.
    cambiar puede lanzar excepciones (validaciones con el dato real): no se guarda nada.
    Entre intentos espera un poco al azar (cada vez mas): si muchos guardan a la vez, no vuelven a chocar juntos.
    Devuelve (documento guardado sin secretos, status)."""
    for intento in range(intentos):
        if intento:
            time.sleep(random.uniform(0, 0.01 * 2 ** min(intento, 6)))
        actual, status = _leer_documento(doc_id, tipo_esperado)
        if status != 200:
            return actual, status
        campos = cambiar(dict(actual))
        nuevo = {**{k: v for k, v in actual.items() if not k.startswith('_')}, **_quitar_reservados(campos)}
        nuevo['tipo'] = tipo_esperado
        nuevo['_id'] = actual['_id']
        nuevo['_rev'] = actual['_rev']
        data, status = _request('PUT', _doc_url(tipo_esperado, actual['_id']), json=nuevo)
        if status == 409:
            continue
        if status not in (200, 201):
            return data, status
        nuevo['_rev'] = data.get('rev')
        return sin_secretos(nuevo), 200
    return {'error': 'conflicto'}, 409


def delete_document(doc_id, rev, tipo_esperado):
    """Elimina un documento verificando su tipo."""
    actual, status = _leer_documento(doc_id, tipo_esperado)
    if status != 200:
        return actual, status
    return _request('DELETE', _doc_url(tipo_esperado, actual['_id']),params={'rev': rev})