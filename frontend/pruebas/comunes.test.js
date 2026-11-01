import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/logica/comunes.js';
import { enDias, lote, producto } from './ayuda.js';

test('iniciales', () => {
  assert.equal(c.iniciales('María López'), 'ML');
  assert.equal(c.iniciales('Administración'), 'AD');
  assert.equal(c.iniciales(''), '?');
});

test('formato de nombres de productos', () => {
  assert.equal(c.formatoNombre('leche evaporada gloria 1 l'), 'Leche Evaporada Gloria 1 L');
  assert.equal(c.formatoNombre('harina de trigo 500 GR'), 'Harina de Trigo 500 g');
  assert.equal(c.formatoNombre('LECHE UHT'), 'Leche UHT');
});

test('presentacion y total', () => {
  const item = { unidad: 'bolsas', cantidad: 40, contenido: 960, medida: 'g' };
  assert.equal(c.textoPresentacion(item), 'Bolsa x 960 g');
  assert.equal(c.textoTotal(item), '38.4 kg en total');
  assert.equal(c.textoPresentacion({ unidad: 'kg' }), '');
  assert.equal(c.pluralizar('Bidón'), 'bidones');
  assert.equal(c.pluralizar('Caja'), 'cajas');
});

test('busqueda parecida tolera errores de escritura', () => {
  assert.equal(c.coincideNombre('lecge', 'Leche Gloria'), true);
  // hasta 7 letras se tolera 1 error; desde 8, dos
  assert.equal(c.coincideNombre('lehce', 'Leche Gloria'), false);
  assert.equal(c.coincideNombre('evaporda', 'Leche Evaporada'), true);
  assert.equal(c.coincideNombre('arr', 'Arroz'), true);
  assert.equal(c.coincideNombre('fideos', 'Arroz'), false);
  assert.equal(c.distancia('casa', 'caza'), 1);
});

test('movimientos: cambio, saldo anterior y detalle', () => {
  const salida = { movimiento: 'Salida', cantidad: 5, saldo: 95, unidad: 'kg', para: ['Mateo', 'Lucía', 'Thiago'] };
  assert.equal(c.cambioDe(salida), -5);
  assert.equal(c.textoStock(salida), '100 → 95');
  assert.equal(c.textoCambio(salida), '−5 kg');
  assert.equal(c.textoDetalle(salida), 'Para Mateo, Lucía y Thiago');
  assert.equal(c.textoDetalle({ movimiento: 'Ingreso', donador: 'Parroquia', actividad: 'Navidad' }), 'Parroquia · Navidad');
  assert.equal(c.textoDetalle({ movimiento: 'Ingreso', inicial: true }), 'Registro inicial');
  assert.equal(c.textoDetalle({ movimiento: 'Ajuste', diferencia: 2, motivo: 'Otro', nota: 'x' }), 'Otro · x');
  assert.equal(c.textoStock({ movimiento: 'Ingreso', cantidad: 1 }), '—');
  // los movimientos viejos guardan un solo nombre como texto
  assert.deepEqual(c.ninosDe({ para: 'Mateo' }), ['Mateo']);
});

test('lo vencido no cuenta como disponible', () => {
  const item = producto('Arroz', { minimo: 12, lotes: [lote(1, 10), lote(2, 5, enDias(-1))] });
  assert.equal(c.cantidadVencida(item), 5);
  assert.equal(c.disponible(item), 10);
  assert.equal(c.bajoMinimo(item), true);
});

test('vencimiento y colores', () => {
  const pronto = producto('A', { lotes: [lote(1, 1, enDias(2)), lote(2, 1, enDias(40))] });
  assert.equal(c.vencimientoDe(pronto), enDias(2));
  assert.equal(c.colorVencimiento(pronto), 'rojo');
  assert.equal(c.porVencer(pronto), true);
  assert.equal(c.colorVencimiento(producto('B', { lotes: [lote(1, 1, enDias(10))] })), 'naranja');
  assert.equal(c.colorVencimiento(producto('C', { lotes: [lote(1, 1, enDias(30))] })), 'verde');
  assert.equal(c.colorVencimiento(producto('D', { lotes: [lote(1, 1)] })), 'azul');
  assert.equal(c.textoVencimiento(producto('E', { lotes: [lote(1, 1, null, new Date())] })), 'Sin fecha · ingresó hoy');
});

test('fechaDe: sin año, si queda en el futuro es del año pasado', () => {
  const hoy = new Date();
  const texto = c.textoFecha(hoy);
  assert.equal(c.fechaDe(texto).getFullYear(), hoy.getFullYear());
  const manana = new Date(hoy.getTime() + 2 * 864e5);
  assert.equal(c.fechaDe(c.textoFecha(manana)).getFullYear(), manana.getFullYear() - 1);
  assert.equal(c.momento({ creado: '2026-01-02T10:00:00Z', fecha: '01 ene 00:00' }).toISOString(), '2026-01-02T10:00:00.000Z');
});

test('filtro rapido y buscador', () => {
  const lista = [
    producto('Arroz', { minimo: 50, lotes: [lote(1, 10)] }),
    producto('Leche', { minimo: 1, lotes: [lote(2, 10, enDias(3))] }),
    producto('Fideos', { minimo: 1, lotes: [lote(3, 10)] }),
  ];
  const nombres = estado => c.filtrarInsumos(lista, { busqueda: '', filtro: 'Todos', ...estado }).map(i => i.nombre);
  assert.deepEqual(nombres({ filtro: 'Stock bajo' }), ['Arroz']);
  assert.deepEqual(nombres({ filtro: 'Por vencer' }), ['Leche']);
  assert.deepEqual(nombres({ busqueda: 'FID' }), ['Fideos']);
});

test('mismoId compara como texto', () => {
  assert.equal(c.mismoId(5, '5'), true);
  assert.equal(c.mismoId(null, null), false);
});
