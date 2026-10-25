import { fechaDe, ninosDe, textoPara } from './comunes.js';

export function filtrosHistorialVacios() {
  return { movimiento: 'Todos', categoria: 'Todos', responsable: 'Todos', producto: 'Todos', para: 'Todos', donador: 'Todos', actividad: 'Todos', desde: '', hasta: '' };
}

// filtros del historial (tambien para el Excel)
export function filtrarHistorial(estado) {
  const f = estado.historialFiltros;
  // incluye los nombres de productos unidos
  const producto = [...estado.alimentos, ...estado.salud].find(p => p.nombre === f.producto);
  const nombresProducto = [f.producto, ...(producto?.unidos || [])];
  const texto = estado.busqueda.toLowerCase();
  const desde = f.desde ? new Date(f.desde + 'T00:00:00') : null;
  const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59') : null;

  return estado.historial.filter(fila => {
    if (f.movimiento !== 'Todos' && fila.movimiento !== f.movimiento) return false;
    if (f.categoria !== 'Todos' && fila.categoria !== f.categoria) return false;
    if (f.responsable !== 'Todos' && fila.responsable !== f.responsable) return false;
    if (f.producto !== 'Todos' && !nombresProducto.includes(fila.insumo)) return false;
    if (f.para !== 'Todos' && !ninosDe(fila).includes(f.para)) return false;
    if (f.donador !== 'Todos' && fila.donador !== f.donador) return false;
    if (f.actividad !== 'Todos' && fila.actividad !== f.actividad) return false;

    if (desde || hasta) {
      const fecha = fechaDe(fila.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
    }

    return [fila.insumo, fila.responsable, fila.donador, textoPara(fila), fila.observaciones].join(' ').toLowerCase().includes(texto);
  });
}

// valores distintos que aparecen en el historial, ordenados (las listas se abren)
export function opcionesDe(filas, campo) {
  return [...new Set(filas.flatMap(f => f[campo] ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const plurales = { Ingreso: 'Ingresos', Salida: 'Salidas', Ajuste: 'Ajustes' };

// '2026-10-01' -> '01/10/2026'
function fechaCorta(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

// pastillas de lo que esta filtrado
export function chipsHistorial(f) {
  const chips = [];
  if (f.movimiento !== 'Todos') chips.push({ campo: 'movimiento', texto: plurales[f.movimiento] });
  if (f.categoria !== 'Todos') chips.push({ campo: 'categoria', texto: f.categoria });
  if (f.responsable !== 'Todos') chips.push({ campo: 'responsable', texto: f.responsable });
  if (f.producto !== 'Todos') chips.push({ campo: 'producto', texto: f.producto });
  if (f.para !== 'Todos') chips.push({ campo: 'para', texto: 'Para ' + f.para });
  if (f.donador !== 'Todos') chips.push({ campo: 'donador', texto: 'Donó ' + f.donador });
  if (f.actividad !== 'Todos') chips.push({ campo: 'actividad', texto: f.actividad });
  if (f.desde) chips.push({ campo: 'desde', texto: 'Desde ' + fechaCorta(f.desde) });
  if (f.hasta) chips.push({ campo: 'hasta', texto: 'Hasta ' + fechaCorta(f.hasta) });
  return chips;
}
