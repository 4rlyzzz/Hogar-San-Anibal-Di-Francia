import PouchDB from 'pouchdb-browser';

export const db = new PouchDB('casa_hogar');
const remoteUrl = import.meta.env.VITE_COUCHDB_URL;

export const remoteDB = remoteUrl ? new PouchDB(remoteUrl) : null;
export const sync = remoteDB ? db.sync(remoteDB, {live: true,retry: true}) : null;
export async function comprobarConexion() {
  if (!remoteDB) return false;

  try {
    await remoteDB.info();
    return true;
  } catch (error) {
    console.error('Error conectando con CouchDB:', error);
    return false;
  }
}

// Guarda un documento nuevo o actualiza uno existente.
export async function guardarDocumento(documento) {
  try {
    const anterior = await db.get(documento._id);

    return await db.put({
      ...anterior,
      ...documento,
      _rev: anterior._rev
    });
  } catch (error) {
    if (error.status === 404) {
      return await db.put(documento);
    }

    throw error;
  }
}

// Recupera los documentos locales.
export async function obtenerDocumentos() {
  const resultado = await db.allDocs({
    include_docs: true
  });

  return resultado.rows
    .map(fila => fila.doc)
    .filter(doc => doc && !doc._deleted);
}