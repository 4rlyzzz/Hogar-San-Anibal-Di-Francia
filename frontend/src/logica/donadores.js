import { fechaDe, meses } from './comunes.js';

// 'Agregado por Cocina · 20 oct'
export function textoAgregado(d) {
  if (!d.creadoPor) return '';
  const fecha = d.creado ? ` · ${d.creado.getDate()} ${meses[d.creado.getMonth()]}` : '';
  return `Agregado por ${d.creadoPor}${fecha}`;
}

// donaciones de un donador
export function donacionesDe(estado, nombre) {
  return estado.historial.filter(f => f.movimiento === 'Ingreso' && f.donador === nombre);
}

// cuantas veces apoyo cada actividad
export function actividadesDe(donaciones) {
  const cuenta = {};
  for (const d of donaciones) {
    if (d.actividad) cuenta[d.actividad] = (cuenta[d.actividad] || 0) + 1;
  }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}

function pasaFiltros(donacion, f) {
  if (f.actividad !== 'Todos' && donacion.actividad !== f.actividad) return false;
  if (f.anio !== 'Todos' && String(fechaDe(donacion.fecha).getFullYear()) !== f.anio) return false;
  return true;
}

// donadores con sus donaciones (ya filtradas por actividad y año)
// con filtros, solo los que donaron en esa actividad o año
export function listaDonadores(estado) {
  const f = estado.donadoresFiltros;
  const hayFiltros = f.actividad !== 'Todos' || f.anio !== 'Todos';
  const texto = estado.busqueda.toLowerCase();

  return estado.donadores
    .filter(d => d.nombre.toLowerCase().includes(texto))
    .map(d => ({ donador: d, donaciones: donacionesDe(estado, d.nombre).filter(x => pasaFiltros(x, f)) }))
    .filter(x => !hayFiltros || x.donaciones.length > 0)
    .sort((a, b) => b.donaciones.length - a.donaciones.length || a.donador.nombre.localeCompare(b.donador.nombre));
}

export function chipsDonadores(f) {
  const chips = [];
  if (f.actividad !== 'Todos') chips.push({ campo: 'actividad', texto: f.actividad });
  if (f.anio !== 'Todos') chips.push({ campo: 'anio', texto: 'Año ' + f.anio });
  return chips;
}
