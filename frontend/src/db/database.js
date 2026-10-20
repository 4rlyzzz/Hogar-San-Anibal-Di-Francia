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