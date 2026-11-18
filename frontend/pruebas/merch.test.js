import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nombreMerch, precioSugerido, pideVence, puedeVence, llevaProveedor, pideProveedor, llevaCosto, textoMerch, textoTipo, textoPrecio,
  soles, filtrarMerch, merchVacio, chipsMerch, tipoDeMovimiento, textoTipoMovimiento,
} from '../src/logica/merch.js';
import { listaPersonas, personasVacio, montoDe, tiposDe, movimientosDePersona } from '../src/logica/personas.js';
import { textoDetalle, colorCategoria, nombreCategoria } from '../src/logica/comunes.js';
import { filtrarHistorial, filtrosHistorialVacios, chipsHistorial, subcategoriasDe } from '../src/logica/historial.js';
import { interpretarDictado, tipoDictado } from '../src/logica/dictado.js';
import { calcularAlertas } from '../src/logica/alertas.js';
import { reglas } from '../src/validacion.js';
import { enDias, lote } from './ayuda.js';

const paneton = { id: 'p1', nombre: "Panetón Clásico D'Onofrio caja 900 g", tipoMerch: 'paneton', subcategoria: null, marca: "D'Onofrio", presentacion: 'caja 900 g', unidad: 'unidades', precio: 25, descuentoDesde: 6, precioDescuento: 22, minimo: 6, cantidad: 10, lotes: [lote(1, 10, enDias(40))] };
const polo = { id: 'p2', nombre: 'Polo Hogar talla M Azul', tipoMerch: 'promocional', subcategoria: 'prendas', articulo: 'polo', talla: 'M', color: 'Azul', unidad: 'unidades', precio: 30, minimo: 5, cantidad: 2, lotes: [lote(2, 2)] };
const mermelada = { id: 'p3', nombre: 'Mermelada frasco 300 ml', tipoMerch: 'hogar', subcategoria: 'alimentos', presentacion: 'frasco 300 ml', perecible: true, unidad: 'unidades', precio: 12, minimo: 2, cantidad: 0, lotes: [] };
const rosario = { id: 'p4', nombre: 'Rosario marrón', tipoMerch: 'hogar', subcategoria: 'general', articulo: 'rosario', variante: 'marrón', unidad: 'docenas', precio: 80, minimo: 1, cantidad: 3, lotes: [lote(3, 3)] };

test('el nombre lleva lo que lo distingue', () => {
  assert.equal(nombreMerch({ tipoMerch: 'paneton', nombreBase: 'Panetón Clásico', marca: "D'Onofrio", presentacion: 'caja 900 g' }), "Panetón Clásico D'Onofrio caja 900 g");
  assert.equal(nombreMerch({ tipoMerch: 'paneton', nombreBase: "Panetón D'Onofrio", marca: "d'onofrio", presentacion: 'caja 900 g' }), "Panetón D'Onofrio caja 900 g");
  assert.equal(nombreMerch({ tipoMerch: 'promocional', subcategoria: 'prendas', nombreBase: 'Polo Hogar', talla: 'M', color: 'Azul' }), 'Polo Hogar talla M Azul');
  assert.equal(nombreMerch({ tipoMerch: 'hogar', subcategoria: 'alimentos', nombreBase: 'Mermelada', presentacion: 'frasco 300 ml' }), 'Mermelada frasco 300 ml');
  assert.equal(nombreMerch({ tipoMerch: 'hogar', subcategoria: 'general', nombreBase: 'Rosario', variante: '' }), 'Rosario');
  assert.equal(nombreMerch({ tipoMerch: 'promocional', subcategoria: 'general', nombreBase: 'Taza  del  Hogar' }), 'Taza del Hogar');
});

test('precio con descuento desde la cantidad minima', () => {
  assert.equal(precioSugerido(paneton, 5), 25);
  assert.equal(precioSugerido(paneton, 6), 22);
  assert.equal(precioSugerido(polo, 100), 30);
  assert.equal(soles(22), 'S/ 22.00');
  assert.equal(textoPrecio(paneton), 'S/ 25.00 c/u · desde 6: S/ 22.00');
  assert.equal(textoPrecio(rosario), 'S/ 80.00 la docena');
});

test('que pide cada tipo', () => {
  assert.deepEqual([pideVence(paneton), pideVence(mermelada), pideVence({ ...mermelada, perecible: false }), pideVence(polo)], [true, true, false, false]);
  assert.deepEqual([puedeVence({ ...mermelada, perecible: false }), puedeVence(rosario)], [true, false]);
  assert.deepEqual([llevaProveedor(paneton), pideProveedor(paneton), pideProveedor(polo), llevaProveedor(rosario)], [true, false, true, false]);
  assert.deepEqual([llevaCosto(paneton), llevaCosto(polo), llevaCosto(rosario)], [true, true, false]);
});

test('textos de la tarjeta', () => {
  assert.equal(textoMerch(paneton), "D'Onofrio · caja 900 g");
  assert.equal(textoMerch(polo), 'Polo · talla M · Azul');
  assert.equal(textoMerch(rosario), 'Rosario · marrón · por docena');
  assert.equal(textoTipo(polo), 'Promocionales · Prendas');
  assert.equal(textoTipo(paneton), 'Panetón');
  assert.equal(nombreCategoria('Merchandising'), 'Merchandising');
  assert.equal(colorCategoria('Merchandising'), 'morado');
});

test('filtros por tipo, subcategoria, stock y orden por precio', () => {
  const lista = [paneton, polo, mermelada, rosario];
  const nombres = f => filtrarMerch(lista, { ...merchVacio(), ...f }).map(p => p.id);
  assert.deepEqual(nombres({ tipoMerch: 'hogar' }), ['p3', 'p4']);
  assert.deepEqual(nombres({ subcategoria: 'prendas' }), ['p2']);
  assert.deepEqual(nombres({ stock: 'bajo' }), ['p3', 'p2']);
  assert.deepEqual(nombres({ stock: 'agotado' }), ['p3']);
  assert.deepEqual(nombres({ orden: 'precio' }), ['p3', 'p1', 'p2', 'p4']);
  assert.deepEqual(nombres({ vencimiento: '30' }), []);
  assert.deepEqual(nombres({ vencimiento: '30' }).length, 0);
  assert.deepEqual(chipsMerch({ ...merchVacio(), tipoMerch: 'paneton', stock: 'bajo' }).map(c => c.texto), ['Panetón', 'Bajo el mínimo']);
});

test('las alertas incluyen merchandising', () => {
  const alertas = calcularAlertas({ alimentos: [], salud: [], merch: [polo, mermelada] });
  assert.deepEqual(alertas.map(a => [a.item.id, a.categoria]), [['p2', 'Merchandising'], ['p3', 'Merchandising']]);
});

const fecha = '10 nov 10:00';
const historial = [
  { movimiento: 'Salida', insumo: polo.nombre, producto_id: 'p2', categoria: 'Merchandising', fecha, cantidad: 2, unidad: 'unidades', comprador: 'Rosa Quispe', precioUnitario: 30, total: 60, medioPago: 'yape-plin', para: [] },
  { movimiento: 'Salida', insumo: paneton.nombre, producto_id: 'p1', categoria: 'Merchandising', fecha, cantidad: 6, unidad: 'unidades', comprador: 'Rosa Quispe', precioUnitario: 22, total: 132, medioPago: 'efectivo', para: [] },
  { movimiento: 'Ingreso', insumo: paneton.nombre, producto_id: 'p1', categoria: 'Merchandising', fecha, cantidad: 20, unidad: 'unidades', proveedor: 'Distribuidora Lima', costoUnitario: 18, costoTotal: 360 },
  { movimiento: 'Ingreso', insumo: rosario.nombre, producto_id: 'p4', categoria: 'Merchandising', fecha, cantidad: 3, unidad: 'docenas', taller: 'Taller de manualidades' },
  { movimiento: 'Ingreso', insumo: 'Arroz', categoria: 'Alimentos', fecha, cantidad: 1, unidad: 'kg', donador: 'Parroquia' },
];

test('detalle del historial de merchandising', () => {
  assert.equal(textoDetalle(historial[0]), 'Venta a Rosa Quispe · S/ 60.00 · Yape / Plin');
  assert.equal(textoDetalle(historial[2]), 'Compra a Distribuidora Lima · S/ 360.00');
  assert.equal(textoDetalle(historial[3]), 'Hecho por Taller de manualidades');
  assert.equal(textoDetalle({ ...historial[0], comprador: '', medioPago: '', observaciones: 'kermés' }), 'Venta · S/ 60.00 · kermés');
  assert.equal(textoDetalle(historial[4]), 'Parroquia');
});

test('filtros del historial por proveedor, comprador y medio de pago', () => {
  const estado = f => ({ historial, historialFiltros: { ...filtrosHistorialVacios(), ...f }, alimentos: [], salud: [], merch: [paneton, polo], busqueda: '' });
  assert.equal(filtrarHistorial(estado({ comprador: 'Rosa Quispe' })).length, 2);
  assert.equal(filtrarHistorial(estado({ medioPago: 'efectivo' })).length, 1);
  assert.equal(filtrarHistorial(estado({ proveedor: 'Distribuidora Lima' })).length, 1);
  assert.equal(filtrarHistorial({ ...estado({}), busqueda: 'distribuidora' }).length, 1);
  assert.deepEqual(chipsHistorial({ ...filtrosHistorialVacios(), comprador: 'Rosa Quispe', medioPago: 'yape-plin' }).map(c => c.texto), ['Compró Rosa Quispe', 'Yape / Plin']);
  assert.equal(filtrarHistorial({ historial, historialFiltros: filtrosHistorialVacios(), alimentos: [], salud: [], busqueda: '' }).length, 5);
});

test('historial por tipo y subcategoria de merchandising', () => {
  const filas = [
    { ...historial[0], tipoMerch: 'promocional', subcategoria: 'prendas' },
    historial[1], historial[2], historial[3], historial[4],
  ];
  const estado = f => ({ historial: filas, historialFiltros: { ...filtrosHistorialVacios(), categoria: 'Merchandising', ...f }, alimentos: [], salud: [], merch: [paneton, polo, rosario], busqueda: '' });
  const insumos = f => filtrarHistorial(estado(f)).map(x => x.insumo);
  assert.deepEqual(insumos({ tipoMerch: 'paneton' }), [paneton.nombre, paneton.nombre]);
  assert.deepEqual(insumos({ tipoMerch: 'hogar', subcategoria: 'general' }), [rosario.nombre]);
  assert.deepEqual(insumos({ tipoMerch: 'promocional', subcategoria: 'prendas' }), [polo.nombre]);
  assert.deepEqual(insumos({ tipoMerch: 'promocional', subcategoria: 'general' }), []);
  assert.deepEqual(insumos({ subcategoria: 'general' }), [rosario.nombre]);
  assert.deepEqual(subcategoriasDe('promocional'), [['general', 'General'], ['prendas', 'Prendas']]);
  assert.deepEqual(subcategoriasDe('paneton'), []);
  assert.deepEqual(subcategoriasDe('Todos').map(([s]) => s), ['general', 'alimentos', 'prendas']);
  assert.deepEqual(chipsHistorial({ ...filtrosHistorialVacios(), categoria: 'Merchandising', tipoMerch: 'hogar', subcategoria: 'alimentos' }).map(c => c.texto),
    ['Merchandising', 'Hecho en el hogar', 'Alimentos']);
  assert.equal(textoTipoMovimiento(historial[3], [rosario]), 'Hecho en el hogar · General');
  assert.equal(textoTipoMovimiento(historial[4], [rosario]), '');
  assert.deepEqual(tipoDeMovimiento({ categoria: 'Merchandising', insumo: 'Ya no existe' }, []), { tipoMerch: null, subcategoria: null });
});

test('lista de compradores con lo que compraron', () => {
  const estado = {
    historial, merch: [paneton, polo, rosario], busqueda: '',
    compradores: [{ id: 'c1', nombre: 'Rosa Quispe' }, { id: 'c2', nombre: 'Ana Torres' }],
    compradoresFiltros: personasVacio(),
  };
  const lista = listaPersonas(estado, 'comprador');
  assert.deepEqual(lista.map(x => [x.persona.nombre, x.movimientos.length, montoDe(x.movimientos, 'comprador')]), [['Rosa Quispe', 2, 192], ['Ana Torres', 0, 0]]);
  assert.deepEqual(tiposDe(lista[0].movimientos, estado.merch), [['Promocionales', 1], ['Panetón', 1]]);
  const conFiltro = listaPersonas({ ...estado, compradoresFiltros: { ...personasVacio(), tipoMerch: 'paneton' } }, 'comprador');
  assert.deepEqual(conFiltro.map(x => [x.persona.nombre, x.movimientos.length]), [['Rosa Quispe', 1]]);
  assert.equal(movimientosDePersona(estado, 'proveedor', 'Distribuidora Lima').length, 1);
});

const productos = [
  { item: paneton, categoria: 'Merchandising' },
  { item: polo, categoria: 'Merchandising' },
  { item: { nombre: 'Arroz', unidad: 'kg' }, categoria: 'Alimentos' },
];
const extra = { donadores: [], actividades: [], compradores: [{ id: 'c1', nombre: 'Rosa Quispe' }], proveedores: [{ id: 'v1', nombre: 'Textiles Sur' }] };
const dictar = texto => {
  const { tipo, resto } = tipoDictado(texto);
  return { tipo, items: interpretarDictado(resto, productos, extra) };
};

test('venta dicha: comprador, medio de pago y precio', () => {
  const { tipo, items: [r] } = dictar('venta de 2 panetones a Rosa Quispe pagó con yape');
  assert.equal(tipo, 'Salida');
  assert.deepEqual([r.producto.item.id, r.cantidad, r.comprador?.id, r.medioPago, r.precio], ['p1', 2, 'c1', 'yape-plin', null]);

  const { items: [n] } = dictar('vendí tres panetones a 20 soles cada uno al cliente Juan Pérez en efectivo');
  assert.deepEqual([n.cantidad, n.precio, n.comprador, n.compradorDicho, n.medioPago], [3, 20, null, 'Juan Pérez', 'efectivo']);
});

test('compra dicha: proveedor y costo', () => {
  const { tipo, items: [r] } = dictar('ingreso de 10 polos talla m azul de Textiles Sur a 15 soles');
  assert.equal(tipo, 'Ingreso');
  assert.deepEqual([r.producto.item.id, r.cantidad, r.proveedor?.id, r.precio], ['p2', 10, 'v1', 15]);
});

test('lo de antes se dicta igual', () => {
  const { items: [r] } = dictar('salida de 3 kilos de arroz para Mateo');
  assert.deepEqual([r.producto.item.nombre, r.cantidad, r.comprador, r.medioPago], ['Arroz', 3, null, '']);
});

test('reglas de merchandising', () => {
  assert.equal(reglas.precio('25.50').valor, 25.5);
  assert.equal(reglas.precio('0').ok, false);
  assert.equal(reglas.precioUnitario('0').ok, true);
  assert.equal(reglas.precio('2.555').ok, false);
  assert.equal(reglas.comprobanteNumero('B001-123').ok, true);
  assert.equal(reglas.comprobanteNumero('B001 <x>').ok, false);
  assert.equal(reglas.ruc('20123456789').ok, true);
  assert.equal(reglas.ruc('2012').ok, false);
  assert.equal(reglas.telefonoOpcional('').ok, true);
  assert.equal(reglas.telefonoOpcional('12').ok, false);
});
