import { disponible, cantidadVencida, diasHasta, mediosPago } from './comunes.js';
import { lotesCon, estaVencido } from './lotes.js';

export const CATEGORIA = 'Merchandising';

export const tiposMerch = {
  paneton: { nombre: 'Panetón', detalle: 'Se trabaja por unidades', subcategorias: [] },
  hogar: { nombre: 'Hecho en el hogar', detalle: 'Lo elaboran los chicos del hogar', subcategorias: [['general', 'General'], ['alimentos', 'Alimentos']] },
  promocional: { nombre: 'Promocionales', detalle: 'Mandados a hacer con un proveedor', subcategorias: [['general', 'General'], ['prendas', 'Prendas']] },
};
export const ordenTipos = ['paneton', 'hogar', 'promocional'];

export const unidadesVenta = [['unidades', 'Unidad'], ['packs', 'Pack'], ['docenas', 'Docena']];

export const articulos = {
  'hogar:general': ['rosario', 'taza', 'llavero', 'tarjeta', 'manualidad', 'otro'],
  'promocional:general': ['taza', 'lapicero', 'tomatodo', 'llavero', 'otro'],
  'promocional:prendas': ['polo', 'casaca', 'gorra', 'chalina', 'otro'],
};
export const tallas = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'única'];
export const comprobantes = [['boleta', 'Boleta'], ['factura', 'Factura']];
export { mediosPago };

export const nombreMedio = valor => mediosPago.find(([v]) => v === valor)?.[1] ?? '';
export const nombreComprobante = valor => comprobantes.find(([v]) => v === valor)?.[1] ?? '';
export const mayuscula = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

export const esMerch = categoria => categoria === CATEGORIA;

export function articulosDe(tipo, subcategoria) {
  return articulos[`${tipo}:${subcategoria}`] ?? [];
}

export function nombreMerch(p) {
  const limpio = t => String(t ?? '').trim().replace(/\s+/g, ' ');
  const base = limpio(p.nombreBase);
  const partes = [base];
  // la presentacion ("caja 900 g") no va en el nombre: se muestra aparte. Solo se agrega si hay otro
  // con el mismo nombre y otra presentacion (nombreMerchDisponible), como en Alimentos y Salud
  if (p.tipoMerch === 'paneton') {
    if (!base.toLowerCase().includes(limpio(p.marca).toLowerCase())) partes.push(limpio(p.marca));
  } else if (p.tipoMerch === 'hogar' && p.variante) {
    partes.push(limpio(p.variante));
  } else if (p.tipoMerch === 'promocional' && p.subcategoria === 'prendas') {
    partes.push(`talla ${p.talla}`, limpio(p.color));
  }
  return partes.filter(Boolean).join(' ');
}

const redondear = n => Math.round(n * 100) / 100;

export function soles(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `S/ ${Number(n).toFixed(2)}`;
}

export function precioSugerido(item, cantidad) {
  if (item.descuentoDesde && item.precioDescuento != null && cantidad >= item.descuentoDesde) return Number(item.precioDescuento);
  return Number(item.precio ?? 0);
}

export function totalVenta(precio, cantidad) {
  return redondear(precio * cantidad);
}

export function pideVence(item) {
  return item.tipoMerch === 'paneton' || (item.tipoMerch === 'hogar' && item.subcategoria === 'alimentos' && Boolean(item.perecible));
}

export function puedeVence(item) {
  return pideVence(item) || (item.tipoMerch === 'hogar' && item.subcategoria === 'alimentos');
}

export function llevaLote(item) {
  return puedeVence(item);
}

export const llevaProveedor = item => item.tipoMerch === 'paneton' || item.tipoMerch === 'promocional';
export const pideProveedor = item => item.tipoMerch === 'promocional';
export const llevaCosto = item => item.tipoMerch === 'paneton' || item.tipoMerch === 'promocional';

const comparable = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean).join(' ');

// el nombre sin su presentacion al final ("Panetón Clásico D'Onofrio caja 500 g" -> "Panetón Clásico D'Onofrio")
export function baseMerch(item) {
  const nombre = String(item.nombre ?? '');
  const pres = String(item.presentacion ?? '').trim();
  return pres && nombre.toLowerCase().endsWith(` ${pres.toLowerCase()}`) ? nombre.slice(0, -pres.length - 1) : nombre;
}

// con que nombre queda un producto nuevo de merchandising (p: lo que se lleno, con p.nombre de nombreMerch)
// otros: [{ item, nuevo }] los que ya hay (y los nuevos de la lista)
// -> { nombre, renombrar: [{ item, nuevo, nombre }] } o { repetido } si ya existe con esa misma presentacion
export function nombreMerchDisponible(p, otros) {
  const hermanos = otros.filter(h => comparable(baseMerch(h.item)) === comparable(p.nombre));
  if (!hermanos.length) return { nombre: p.nombre, renombrar: [] };
  const repetido = hermanos.find(h => comparable(h.item.presentacion) === comparable(p.presentacion));
  if (repetido || !p.presentacion) return { repetido: repetido ?? hermanos[0] };
  // otro tamaño del mismo: los dos llevan su presentacion en el nombre
  const conPresentacion = h => `${baseMerch(h.item)} ${h.item.presentacion}`;
  return {
    nombre: `${p.nombre} ${p.presentacion}`,
    renombrar: hermanos
      .filter(h => h.item.presentacion && comparable(h.item.nombre) !== comparable(conPresentacion(h)))
      .map(h => ({ ...h, nombre: conPresentacion(h) })),
  };
}

export function textoMerch(item) {
  const partes = [];
  if (item.tipoMerch === 'paneton') partes.push(item.marca, item.presentacion);
  else {
    if (item.articulo) partes.push(mayuscula(item.articulo));
    if (item.subcategoria === 'alimentos') partes.push(item.presentacion, item.perecible ? 'perecible' : 'no perecible');
    if (item.variante) partes.push(item.variante);
    if (item.subcategoria === 'prendas') partes.push(`talla ${item.talla}`, item.color);
  }
  const venta = unidadesVenta.find(([u]) => u === item.unidad);
  if (venta && item.unidad !== 'unidades') partes.push(`por ${venta[1].toLowerCase()}`);
  return partes.filter(Boolean).join(' · ');
}

export function textoTipo(item) {
  const tipo = tiposMerch[item.tipoMerch];
  if (!tipo) return CATEGORIA;
  const sub = tipo.subcategorias.find(([s]) => s === item.subcategoria)?.[1];
  return sub ? `${tipo.nombre} · ${sub}` : tipo.nombre;
}

export function textoPrecio(item) {
  const unidad = { packs: 'el pack', docenas: 'la docena' }[item.unidad] ?? 'c/u';
  const base = `${soles(item.precio)} ${unidad}`;
  return item.descuentoDesde && item.precioDescuento != null ? `${base} · desde ${item.descuentoDesde}: ${soles(item.precioDescuento)}` : base;
}

export function tipoDeMovimiento(fila, productos = []) {
  if (fila.categoria !== CATEGORIA) return { tipoMerch: null, subcategoria: null };
  if (fila.tipoMerch) return { tipoMerch: fila.tipoMerch, subcategoria: fila.subcategoria ?? null };
  const p = productos.find(x => x.id === fila.producto_id) ?? productos.find(x => x.nombre === fila.insumo || x.unidos?.includes(fila.insumo));
  return { tipoMerch: p?.tipoMerch ?? null, subcategoria: p?.subcategoria ?? null };
}

export function textoTipoMovimiento(fila, productos = []) {
  const t = tipoDeMovimiento(fila, productos);
  return t.tipoMerch ? textoTipo(t) : '';
}

export function merchVacio() {
  return { tipoMerch: 'Todos', subcategoria: 'Todos', stock: 'Todos', vencimiento: 'Todos', orden: 'nombre' };
}

export const opcionesTipo = [['Todos', 'Todos'], ...ordenTipos.map(t => [t, tiposMerch[t].nombre])];
export const opcionesSubcategoria = [['Todos', 'Todas'], ['general', 'General'], ['alimentos', 'Alimentos'], ['prendas', 'Prendas']];
export const opcionesStockMerch = [['Todos', 'Todos'], ['bajo', 'Bajo el mínimo'], ['cerca', 'Cerca del mínimo'], ['normal', 'Sobre el mínimo'], ['agotado', 'Agotado']];
export const opcionesVenceMerch = [['Todos', 'Todos'], ['vencido', 'Con algo vencido'], ['15', 'Vence en 15 días o menos'], ['30', 'Vence en 30 días o menos']];
export const ordenesMerch = [['nombre', 'Nombre (A-Z)'], ['stock', 'Menos stock'], ['precio', 'Precio (menor a mayor)'], ['vence', 'Vence primero']];

function proximoVence(item) {
  const dias = lotesCon(item).filter(l => l.vence && !estaVencido(l)).map(l => diasHasta(l.vence));
  return dias.length ? Math.min(...dias) : Infinity;
}

function estadoStock(item) {
  const sirve = disponible(item);
  if (sirve <= 0) return 'agotado';
  if (sirve < item.minimo) return 'bajo';
  if (sirve <= item.minimo * 1.2) return 'cerca';
  return 'normal';
}

function pasaFiltros(item, f) {
  if (f.tipoMerch !== 'Todos' && item.tipoMerch !== f.tipoMerch) return false;
  if (f.subcategoria !== 'Todos' && item.subcategoria !== f.subcategoria) return false;
  if (f.stock !== 'Todos' && !(estadoStock(item) === f.stock || (f.stock === 'bajo' && estadoStock(item) === 'agotado'))) return false;
  if (f.vencimiento === 'vencido' && !cantidadVencida(item)) return false;
  if (['15', '30'].includes(f.vencimiento) && proximoVence(item) > Number(f.vencimiento)) return false;
  return true;
}

const comparar = {
  nombre: (a, b) => a.nombre.localeCompare(b.nombre),
  stock: (a, b) => disponible(a) / (a.minimo || 1) - disponible(b) / (b.minimo || 1),
  precio: (a, b) => (a.precio ?? 0) - (b.precio ?? 0),
  vence: (a, b) => Math.min(proximoVence(a), 1e9) - Math.min(proximoVence(b), 1e9),
};

export function filtrarMerch(lista, f) {
  return lista
    .filter(item => pasaFiltros(item, f))
    .sort((a, b) => comparar[f.orden](a, b) || a.nombre.localeCompare(b.nombre));
}

const textoDe = (opciones, valor) => opciones.find(([v]) => v === valor)?.[1] ?? valor;

export function chipsMerch(f) {
  const chips = [];
  if (f.tipoMerch !== 'Todos') chips.push({ campo: 'tipoMerch', texto: textoDe(opcionesTipo, f.tipoMerch) });
  if (f.subcategoria !== 'Todos') chips.push({ campo: 'subcategoria', texto: textoDe(opcionesSubcategoria, f.subcategoria) });
  if (f.stock !== 'Todos') chips.push({ campo: 'stock', texto: textoDe(opcionesStockMerch, f.stock) });
  if (f.vencimiento !== 'Todos') chips.push({ campo: 'vencimiento', texto: textoDe(opcionesVenceMerch, f.vencimiento) });
  return chips;
}
