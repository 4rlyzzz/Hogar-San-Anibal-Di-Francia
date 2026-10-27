import os
import requests

COUCHDB_URL = os.getenv('COUCHDB_URL', 'http://127.0.0.1:5984')
COUCHDB_DB = os.getenv('COUCHDB_DB', 'casa_hogar')
COUCHDB_USER = os.getenv('COUCHDB_USER', 'casa_app')
COUCHDB_PASSWORD = os.getenv('COUCHDB_PASSWORD', '')

AUTH = (COUCHDB_USER, COUCHDB_PASSWORD)
BASE_DB_URL = f"{COUCHDB_URL}/{COUCHDB_DB}"


def get_all_documents():
    """Obtiene todos los documentos guardados en CouchDB descartando los del sistema."""
    url = f"{BASE_DB_URL}/_all_docs?include_docs=true"
    response = requests.get(url, auth=AUTH)
    
    if response.status_code == 200:
        rows = response.json().get('rows', [])
        # Filtrar documentos internos de CouchDB (los que empiezan con _)
        documents = [row['doc'] for row in rows if not row['id'].startswith('_')]
        return documents, 200
    return {"error": "Error al consultar CouchDB"}, response.status_code


def get_documents_by_type(doc_type):
    """Obtiene documentos filtrados por la propiedad 'tipo' (ej: 'producto', 'movimiento')."""
    url = f"{BASE_DB_URL}/_find"
    query = {"selector": {"tipo": doc_type}}
    response = requests.post(url, json=query, auth=AUTH)
    
    if response.status_code == 200:
        docs = response.json().get('docs', [])
        return docs, 200
    
    # Respaldo: si el endpoint _find no encuentra un índice, obtiene todos y filtra localmente
    docs, code = get_all_documents()
    if code == 200:
        filtered = [doc for doc in docs if doc.get('tipo') == doc_type]
        return filtered, 200
    return {"error": "Error al consultar CouchDB"}, response.status_code


def create_document(doc_data):
    """Crea un nuevo documento en CouchDB manejando posibles fallos de conexión."""
    try:
        response = requests.post(BASE_DB_URL, json=doc_data, auth=AUTH)
        try:
            return response.json(), response.status_code
        except ValueError:
            return {"error": "Respuesta no válida de CouchDB", "detalle": response.text}, response.status_code
    except requests.exceptions.RequestException as e:
        return {"error": f"No se pudo conectar con CouchDB: {str(e)}"}, 500


def get_document_by_id(doc_id):
    """Obtiene un documento específico por su ID."""
    url = f"{BASE_DB_URL}/{doc_id}"
    response = requests.get(url, auth=AUTH)
    return response.json(), response.status_code


def update_document(doc_id, doc_data, rev):
    """Actualiza un documento existente enviando su ID y la revisión (_rev)."""
    doc_data['_rev'] = rev
    url = f"{BASE_DB_URL}/{doc_id}"
    response = requests.put(url, json=doc_data, auth=AUTH)
    return response.json(), response.status_code

def delete_document(doc_id, rev):
    """Elimina un documento por ID enviando su revisión (_rev)."""
    url = f"{BASE_DB_URL}/{doc_id}?rev={rev}"
    response = requests.delete(url, auth=AUTH)
    return response.json(), response.status_code