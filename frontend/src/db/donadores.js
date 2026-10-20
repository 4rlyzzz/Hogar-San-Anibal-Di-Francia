import { guardarDocumento, obtenerDocumentos } from '../db/database.js';

export async function guardarDonadorDB(donador) {
  return guardarDocumento({
    ...donador,
    tipo: 'donador'
  });
}

export async function listarDonadoresDB() {
  const documentos = await obtenerDocumentos();

  return documentos.filter(doc => doc.tipo === 'donador');
}