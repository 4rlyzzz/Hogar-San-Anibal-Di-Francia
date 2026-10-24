// filtros de Alimentos y Salud e higiene (boton "Filtros"), ademas de Todos / Por vencer / Stock bajo
import { escapar, disponible, cantidadVencida, diasHasta } from './Comunes.js';
import { lotesCon, estaVencido, diasDesde } from './Lotes.js';
import { PanelFiltros, CampoSelect } from './Filtros.js';

export function inventarioVacio() {
  return { vencimiento: 'Todos', lleva: 'Todos', stock: 'Todos', unidad: 'Todos', orden: 'nombre' };
}

const opcionesVence = {
  Todos: 'Todos',
  vencido: 'Con algo vencido',
  7: 'Vence en 7 días o menos',
  15: 'Vence en 15 días o menos',
  30: 'Vence en 30 días o menos',
  sinFecha: 'Tiene algo sin fecha',
};
const opcionesLleva = { Todos: 'Todos', 7: 'Más de 7 días', 15: 'Más de 15 días', 30: 'Más de 30 días' };
const opcionesStock = { Todos: 'Todos', bajo: 'Bajo el mínimo', cerca: 'Cerca del mínimo', normal: 'Sobre el mínimo' };
const ordenes = { nombre: 'Nombre (A-Z)', vence: 'Vence primero', stock: 'Menos stock', lleva: 'Lleva más días sin fecha' };

// dias para el proximo vencimiento de lo que todavia sirve (Infinity si nada vence)
function proximoVence(item) {
  const dias = lotesCon(item).filter(l => l.vence && !estaVencido(l)).map(l => diasHasta(l.vence));
  return dias.length ? Math.min(...dias) : Infinity;
}

// dias que lleva el lote sin fecha mas antiguo (-1 si no tiene lotes sin fecha)
function diasSinFecha(item) {
  const dias = lotesCon(item).filter(l => !l.vence).map(l => diasDesde(l.ingreso));
  return dias.length ? Math.max(...dias) : -1;
}

function estadoStock(item) {
  const sirve = disponible(item);
  if (sirve < item.minimo) return 'bajo';
  if (sirve <= item.minimo * 1.2) return 'cerca';
  return 'normal';
}

function pasaFiltros(item, f) {
  if (f.vencimiento === 'vencido' && !cantidadVencida(item)) return false;
  if (f.vencimiento === 'sinFecha' && diasSinFecha(item) < 0) return false;
  if (['7', '15', '30'].includes(f.vencimiento) && proximoVence(item) > Number(f.vencimiento)) return false;
  if (f.lleva !== 'Todos' && diasSinFecha(item) <= Number(f.lleva)) return false;
  if (f.stock !== 'Todos' && estadoStock(item) !== f.stock) return false;
  if (f.unidad !== 'Todos' && item.unidad !== f.unidad) return false;
  return true;
}

// "menos stock" es relativo al minimo: 5 de 40 va antes que 10 de 12
const comparar = {
  nombre: (a, b) => a.nombre.localeCompare(b.nombre),
  vence: (a, b) => Math.min(proximoVence(a), 1e9) - Math.min(proximoVence(b), 1e9),
  stock: (a, b) => disponible(a) / (a.minimo || 1) - disponible(b) / (b.minimo || 1),
  lleva: (a, b) => diasSinFecha(b) - diasSinFecha(a),
};

export function filtrarInventario(lista, f) {
  return lista
    .filter(item => pasaFiltros(item, f))
    .sort((a, b) => comparar[f.orden](a, b) || a.nombre.localeCompare(b.nombre));
}

// el orden no es un filtro: no tiene pastilla
export function chipsInventario(f) {
  const chips = [];
  if (f.vencimiento !== 'Todos') chips.push({ campo: 'vencimiento', texto: opcionesVence[f.vencimiento] });
  if (f.lleva !== 'Todos') chips.push({ campo: 'lleva', texto: 'Sin fecha · ' + opcionesLleva[f.lleva].toLowerCase() });
  if (f.stock !== 'Todos') chips.push({ campo: 'stock', texto: opcionesStock[f.stock] });
  if (f.unidad !== 'Todos') chips.push({ campo: 'unidad', texto: 'En ' + f.unidad });
  return chips;
}

// unidades: las que hay en esta categoria (latas, kg, frascos...)
export function PanelInventario(f, unidades, resultados) {
  return PanelFiltros('inventarioFiltros', `
    ${CampoSelect('inventarioFiltros', 'vencimiento', 'Vencimiento', opcionesVence, f.vencimiento)}
    ${CampoSelect('inventarioFiltros', 'lleva', 'Lleva en el almacén (lo que no tiene fecha)', opcionesLleva, f.lleva)}
    ${CampoSelect('inventarioFiltros', 'stock', 'Stock', opcionesStock, f.stock)}
    ${CampoSelect('inventarioFiltros', 'unidad', 'Se cuenta en', { Todos: 'Todos', ...Object.fromEntries(unidades.map(u => [u, escapar(u)])) }, f.unidad)}
    ${CampoSelect('inventarioFiltros', 'orden', 'Ordenar por', ordenes, f.orden)}
  `, resultados);
}
