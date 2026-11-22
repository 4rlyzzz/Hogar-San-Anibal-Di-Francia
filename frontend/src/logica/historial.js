import { fechaDe, ninosDe, textoPara, mediosPago } from './comunes.js';
import { tipoDeMovimiento, tiposMerch } from './merch.js';

export function filtrosHistorialVacios() {
  // orden: 'recientes' (lo mas nuevo arriba) o 'antiguos'
  return {
    movimiento: 'Todos', categoria: 'Todos', tipoMerch: 'Todos', subcategoria: 'Todos', responsable: 'Todos', producto: 'Todos', para: 'Todos',
    donador: 'Todos', actividad: 'Todos', proveedor: 'Todos', comprador: 'Todos', medioPago: 'Todos', desde: '', hasta: '', orden: 'recientes',
  };
}

// filtros del historial (tambien para el Excel)
export function filtrarHistorial(estado) {
  const f = estado.historialFiltros;
  // incluye los nombres de productos unidos
  const producto = [...estado.alimentos, ...estado.salud, ...(estado.merch ?? [])].find(p => p.nombre === f.producto);
  const nombresProducto = [f.producto, ...(producto?.unidos || [])];
  const texto = estado.busqueda.toLowerCase();
  const desde = f.desde ? new Date(f.desde + 'T00:00:00') : null;
  const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59') : null;

  // el historial ya esta de lo mas nuevo a lo mas antiguo
  const filas = estado.historial.filter(fila => {
    if (f.movimiento !== 'Todos' && fila.movimiento !== f.movimiento) return false;
    if (f.categoria !== 'Todos' && fila.categoria !== f.categoria) return false;
    if (f.tipoMerch !== 'Todos' || f.subcategoria !== 'Todos') {
      const t = tipoDeMovimiento(fila, estado.merch ?? []);
      if (f.tipoMerch !== 'Todos' && t.tipoMerch !== f.tipoMerch) return false;
      if (f.subcategoria !== 'Todos' && t.subcategoria !== f.subcategoria) return false;
    }
    if (f.responsable !== 'Todos' && fila.responsable !== f.responsable) return false;
    if (f.producto !== 'Todos' && !nombresProducto.includes(fila.insumo)) return false;
    if (f.para !== 'Todos' && !ninosDe(fila).includes(f.para)) return false;
    if (f.donador !== 'Todos' && fila.donador !== f.donador) return false;
    if (f.actividad !== 'Todos' && fila.actividad !== f.actividad) return false;
    if (f.proveedor !== 'Todos' && fila.proveedor !== f.proveedor) return false;
    if (f.comprador !== 'Todos' && fila.comprador !== f.comprador) return false;
    if (f.medioPago !== 'Todos' && fila.medioPago !== f.medioPago) return false;

    if (desde || hasta) {
      const fecha = fechaDe(fila.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
    }

    return [fila.insumo, fila.insumoOriginal, fila.responsable, fila.donador, fila.proveedor, fila.comprador, textoPara(fila), fila.observaciones]
      .join(' ').toLowerCase().includes(texto);
  });
  return f.orden === 'antiguos' ? filas.reverse() : filas;
}

// valores distintos que aparecen en el historial, ordenados (las listas se abren)
export function opcionesDe(filas, campo) {
  return [...new Set(filas.flatMap(f => f[campo] ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function subcategoriasDe(tipoMerch) {
  const lista = tipoMerch === 'Todos' ? Object.values(tiposMerch).flatMap(t => t.subcategorias) : tiposMerch[tipoMerch]?.subcategorias ?? [];
  return [...new Map(lista).entries()];
}

const nombreSubcategoria = sub => subcategoriasDe('Todos').find(([s]) => s === sub)?.[1] ?? sub;

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
  if (f.tipoMerch !== 'Todos') chips.push({ campo: 'tipoMerch', texto: tiposMerch[f.tipoMerch]?.nombre ?? f.tipoMerch });
  if (f.subcategoria !== 'Todos') chips.push({ campo: 'subcategoria', texto: nombreSubcategoria(f.subcategoria) });
  if (f.responsable !== 'Todos') chips.push({ campo: 'responsable', texto: f.responsable });
  if (f.producto !== 'Todos') chips.push({ campo: 'producto', texto: f.producto });
  if (f.para !== 'Todos') chips.push({ campo: 'para', texto: 'Para ' + f.para });
  if (f.donador !== 'Todos') chips.push({ campo: 'donador', texto: 'Donó ' + f.donador });
  if (f.actividad !== 'Todos') chips.push({ campo: 'actividad', texto: f.actividad });
  if (f.proveedor !== 'Todos') chips.push({ campo: 'proveedor', texto: 'Proveedor ' + f.proveedor });
  if (f.comprador !== 'Todos') chips.push({ campo: 'comprador', texto: 'Compró ' + f.comprador });
  if (f.medioPago !== 'Todos') chips.push({ campo: 'medioPago', texto: mediosPago.find(([v]) => v === f.medioPago)?.[1] ?? f.medioPago });
  if (f.desde) chips.push({ campo: 'desde', texto: 'Desde ' + fechaCorta(f.desde) });
  if (f.hasta) chips.push({ campo: 'hasta', texto: 'Hasta ' + fechaCorta(f.hasta) });
  return chips;
}
