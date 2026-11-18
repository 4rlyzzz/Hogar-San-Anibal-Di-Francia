import { fechaDe } from './comunes.js';
import { textoTipo } from './merch.js';

export const personas = {
  proveedor: {
    lista: 'proveedores', filtros: 'proveedoresFiltros', titulo: 'Proveedores', singular: 'proveedor', plural: 'proveedores',
    movimiento: 'Ingreso', campo: 'proveedor', operacion: 'compra', operaciones: 'compras', monto: 'costoTotal', verbo: 'Se le compró',
    color: 'azul', telefonoObligatorio: true,
  },
  comprador: {
    lista: 'compradores', filtros: 'compradoresFiltros', titulo: 'Compradores', singular: 'comprador', plural: 'compradores',
    movimiento: 'Salida', campo: 'comprador', operacion: 'compra', operaciones: 'compras', monto: 'total', verbo: 'Compró',
    color: 'morado', telefonoObligatorio: false,
  },
};

export function personasVacio() {
  return { tipoMerch: 'Todos', anio: 'Todos' };
}

export function movimientosDePersona(estado, tipo, nombre) {
  const p = personas[tipo];
  return estado.historial.filter(f => f.movimiento === p.movimiento && f[p.campo] === nombre);
}

function pasaFiltros(fila, f, productos) {
  if (f.anio !== 'Todos' && String(fechaDe(fila.fecha).getFullYear()) !== f.anio) return false;
  if (f.tipoMerch !== 'Todos') {
    const producto = productos.find(p => p.id === fila.producto_id || p.nombre === fila.insumo);
    if (producto?.tipoMerch !== f.tipoMerch) return false;
  }
  return true;
}

export function montoDe(movimientos, tipo) {
  const campo = personas[tipo].monto;
  return Math.round(movimientos.reduce((s, m) => s + (Number(m[campo]) || 0), 0) * 100) / 100;
}

export function listaPersonas(estado, tipo) {
  const p = personas[tipo];
  const f = estado[p.filtros];
  const hayFiltros = f.tipoMerch !== 'Todos' || f.anio !== 'Todos';
  const texto = estado.busqueda.toLowerCase();

  return estado[p.lista]
    .filter(x => x.nombre.toLowerCase().includes(texto))
    .map(x => ({ persona: x, movimientos: movimientosDePersona(estado, tipo, x.nombre).filter(m => pasaFiltros(m, f, estado.merch)) }))
    .filter(x => !hayFiltros || x.movimientos.length > 0)
    .sort((a, b) => montoDe(b.movimientos, tipo) - montoDe(a.movimientos, tipo) || b.movimientos.length - a.movimientos.length
      || a.persona.nombre.localeCompare(b.persona.nombre));
}

export function tiposDe(movimientos, productos) {
  const cuenta = {};
  for (const m of movimientos) {
    const producto = productos.find(p => p.id === m.producto_id || p.nombre === m.insumo);
    const nombre = producto ? textoTipo(producto).split(' · ')[0] : 'Otros';
    cuenta[nombre] = (cuenta[nombre] || 0) + 1;
  }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}

export function chipsPersonas(f, nombresTipo) {
  const chips = [];
  if (f.tipoMerch !== 'Todos') chips.push({ campo: 'tipoMerch', texto: nombresTipo[f.tipoMerch] ?? f.tipoMerch });
  if (f.anio !== 'Todos') chips.push({ campo: 'anio', texto: 'Año ' + f.anio });
  return chips;
}
