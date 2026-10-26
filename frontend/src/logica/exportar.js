import { fechaDe, cambioDe, nombreCategoria, textoPara } from './comunes.js';

const negrita = texto => ({ value: texto, fontWeight: 'bold' });

// Excel guarda el texto como texto, pero si alguien edita la celda o lo pasa a CSV,
// algo como =HIPERVINCULO(...) se volveria formula. Con ' delante queda como texto.
// + o - solo con numeros (un telefono) no se toca
function pareceFormula(valor) {
  return /^[=@\t\r]/.test(valor) || (/^[+-]/.test(valor) && !/^[+\-\d\s()]+$/.test(valor));
}
const texto = valor => ({ value: pareceFormula(valor) ? "'" + valor : valor });

// columnas del Excel del historial
const columnasHistorial = [
  { header: negrita('Fecha'), width: 12, cell: f => ({ value: fechaDe(f.fecha), type: Date, format: 'dd/mm/yyyy' }) },
  { header: negrita('Hora'), width: 8, cell: f => texto(f.fecha.split(' ')[2]) },
  { header: negrita('Producto'), width: 32, cell: f => texto(f.insumo) },
  { header: negrita('Categoría'), width: 16, cell: f => texto(nombreCategoria(f.categoria)) },
  { header: negrita('Movimiento'), width: 12, cell: f => texto(f.movimiento) },
  { header: negrita('Cantidad'), width: 10, cell: f => ({ value: cambioDe(f), type: Number }) },
  { header: negrita('Unidad'), width: 10, cell: f => texto(f.unidad) },
  // los movimientos viejos no tienen saldo: la celda queda vacia
  { header: negrita('Quedó'), width: 10, cell: f => (f.saldo != null ? { value: f.saldo, type: Number } : { value: null }) },
  { header: negrita('Vence'), width: 12, cell: f => (f.vence ? { value: new Date(f.vence + 'T00:00:00'), type: Date, format: 'dd/mm/yyyy' } : { value: null }) },
  { header: negrita('Responsable'), width: 16, cell: f => texto(f.responsable) },
  { header: negrita('Donador'), width: 24, cell: f => texto(f.donador || '') },
  { header: negrita('Actividad'), width: 22, cell: f => texto(f.actividad || '') },
  { header: negrita('Para'), width: 18, cell: f => texto(textoPara(f)) },
  { header: negrita('Motivo del ajuste'), width: 26, cell: f => texto(f.motivo || '') },
  { header: negrita('Detalle'), width: 30, cell: f => texto(f.nota || (f.corrige ? `Corrige el ajuste del ${f.corrige.fecha}` : '')) },
  { header: negrita('Observaciones'), width: 30, cell: f => texto(f.observaciones || '') },
];

// 'Leche Evaporada Gloria' -> 'leche-evaporada-gloria'
function paraArchivo(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// nombre del archivo segun los filtros
export function nombreArchivoHistorial(filtros) {
  const partes = ['historial'];
  if (filtros.movimiento !== 'Todos') partes.push({ Ingreso: 'ingresos', Salida: 'salidas', Ajuste: 'ajustes' }[filtros.movimiento]);
  if (filtros.categoria !== 'Todos') partes.push(filtros.categoria);
  if (filtros.responsable !== 'Todos') partes.push(filtros.responsable);
  if (filtros.producto !== 'Todos') partes.push(filtros.producto);
  if (filtros.para !== 'Todos') partes.push('para-' + filtros.para);
  if (filtros.donador !== 'Todos') partes.push(filtros.donador);
  if (filtros.actividad !== 'Todos') partes.push(filtros.actividad);
  if (filtros.desde) partes.push('desde-' + filtros.desde);
  if (filtros.hasta) partes.push('hasta-' + filtros.hasta);

  const hoy = new Date();
  const dos = n => String(n).padStart(2, '0');
  partes.push(`${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`);

  return partes.map(paraArchivo).join('_') + '.xlsx';
}

// la libreria se carga al descargar
export async function descargarHistorial(filas, nombreArchivo) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(filas, { columns: columnasHistorial, sheet: 'Historial', stickyRowsCount: 1 }).toFile(nombreArchivo);
}

// ---------- donadores: para agradecer o volver a contactar ----------
// filas: [{ donador, donaciones, actividades }]
const columnasDonadores = [
  { header: negrita('Donador'), width: 30, cell: x => texto(x.donador.nombre) },
  { header: negrita('Teléfono'), width: 16, cell: x => texto(x.donador.telefono) },
  { header: negrita('Donaciones'), width: 12, cell: x => ({ value: x.donaciones.length, type: Number }) },
  { header: negrita('Actividades que apoyó'), width: 44, cell: x => texto(x.actividades.map(([a, n]) => `${a} (${n})`).join(', ')) },
  { header: negrita('Última donación'), width: 16, cell: x => (x.donaciones[0] ? { value: fechaDe(x.donaciones[0].fecha), type: Date, format: 'dd/mm/yyyy' } : { value: null }) },
  { header: negrita('Agregado por'), width: 18, cell: x => texto(x.donador.creadoPor || '') },
];

export function nombreArchivoDonadores(filtros) {
  const partes = ['donadores'];
  if (filtros.actividad !== 'Todos') partes.push(filtros.actividad);
  if (filtros.anio !== 'Todos') partes.push(filtros.anio);
  return partes.map(paraArchivo).join('_') + '.xlsx';
}

export async function descargarDonadores(filas, nombreArchivo) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(filas, { columns: columnasDonadores, sheet: 'Donadores', stickyRowsCount: 1 }).toFile(nombreArchivo);
}
