import { guardarDocumento, obtenerDocumentos } from '../db/database.js';

export async function guardarProductoDB(producto) {
  return guardarDocumento({
    ...producto,
    tipo: 'producto'
  });
}

export async function listarProductosDB() {
  const documentos = await obtenerDocumentos();

  return documentos.filter(doc => doc.tipo === 'producto');
}