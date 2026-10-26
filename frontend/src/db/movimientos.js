import { guardarDocumento, obtenerDocumentos } from '../db/database.js';

export async function guardarMovimientoDB(movimiento) {
  return guardarDocumento({
    ...movimiento,
    tipo: 'movimiento'
  });
}

export async function listarMovimientosDB() {
  const documentos = await obtenerDocumentos();

  return documentos.filter(doc => doc.tipo === 'movimiento');
}