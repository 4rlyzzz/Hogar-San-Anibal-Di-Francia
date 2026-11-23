import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarDictado, tipoDictado, partirPorInventario, categoriaDeIA, enInventario, productoDeNombre, desempatarConLocal } from '../src/logica/dictado.js';

// la misma mermelada en dos inventarios
const mermeladaA = { item: { id: 'a1', nombre: 'Mermelada de fresa', unidad: 'frascos' }, categoria: 'Alimentos' };
const mermeladaM = { item: { id: 'm1', nombre: 'Mermelada de fresa', tipoMerch: 'hogar', unidad: 'unidades' }, categoria: 'Merchandising' };
const productos = [
  mermeladaA,
  mermeladaM,
  { item: { id: 'a2', nombre: 'Arroz', unidad: 'kg' }, categoria: 'Alimentos' },
  { item: { id: 'm2', nombre: "Panetón D'Onofrio", tipoMerch: 'paneton', unidad: 'unidades' }, categoria: 'Merchandising' },
  { item: { id: 's1', nombre: 'Kit Salud Bucal', unidad: 'unidades' }, categoria: 'Salud' },
];

const entender = texto => interpretarDictado(tipoDictado(texto).resto, productos)
  .map(r => [r.producto ? `${r.producto.categoria}:${r.producto.item.nombre}` : null, r.dudas.length, r.cantidad]);

test('sin decir el inventario, la mermelada queda en duda', () => {
  assert.deepEqual(entender('ingreso de 3 mermeladas de fresa'), [[null, 2, 3]]);
});

test('"a alimentos" o "a merchandising" al inicio dice cual es', () => {
  assert.deepEqual(entender('ingreso a alimentos de 3 mermeladas de fresa'), [['Alimentos:Mermelada de fresa', 0, 3]]);
  assert.deepEqual(entender('ingreso a merchandising de 3 mermeladas de fresa'), [['Merchandising:Mermelada de fresa', 0, 3]]);
  assert.deepEqual(entender('salida de merch: 2 mermeladas de fresa'), [['Merchandising:Mermelada de fresa', 0, 2]]);
  // como lo escribe el reconocedor a veces
  assert.deepEqual(entender('ingreso a marchandising de 3 mermeladas de fresa'), [['Merchandising:Mermelada de fresa', 0, 3]]);
});

test('dicho al inicio vale para todos los que siguen', () => {
  assert.deepEqual(entender('ingreso a merchandising de 3 mermeladas de fresa y 2 panetones'), [
    ['Merchandising:Mermelada de fresa', 0, 3], ["Merchandising:Panetón D'Onofrio", 0, 2],
  ]);
});

test('dicho junto a un producto vale solo para ese', () => {
  assert.deepEqual(entender('ingreso de 3 mermeladas de fresa de merchandising y 2 kilos de arroz'), [
    ['Merchandising:Mermelada de fresa', 0, 3], ['Alimentos:Arroz', 0, 2],
  ]);
  assert.deepEqual(entender('ingreso de 2 kilos de arroz y 3 mermeladas de fresa de alimentos'), [
    ['Alimentos:Arroz', 0, 2], ['Alimentos:Mermelada de fresa', 0, 3],
  ]);
});

test('cambiar de inventario a mitad', () => {
  assert.deepEqual(entender('ingreso a alimentos de 3 mermeladas de fresa y a merchandising 2 mermeladas de fresa'), [
    ['Alimentos:Mermelada de fresa', 0, 3], ['Merchandising:Mermelada de fresa', 0, 2],
  ]);
});

test('una palabra del nombre de un producto no es el inventario', () => {
  assert.deepEqual(entender('salida de 2 kit salud bucal'), [['Salud:Kit Salud Bucal', 0, 2]]);
  assert.deepEqual(partirPorInventario('2 kit salud bucal', productos), [{ texto: '2 kit salud bucal', categoria: null, alFinal: null }]);
});

test('si no existe en ese inventario, queda para crearlo ahi', () => {
  const [r] = interpretarDictado(tipoDictado('ingreso a merchandising de 5 kilos de arroz').resto, productos);
  assert.equal(r.producto, null);
  assert.equal(r.categoriaDicha, 'Merchandising');
});

test('con la IA: su inventario, o el que entendio el local para todo', () => {
  assert.equal(categoriaDeIA({ categoria: 'merchandising' }), 'Merchandising');
  assert.equal(categoriaDeIA({ categoria: 'salud' }), 'Salud');
  const local = interpretarDictado(tipoDictado('ingreso a merchandising de 3 mermeladas de fresa').resto, productos);
  assert.equal(categoriaDeIA({ producto: 'Mermelada de fresa' }, local), 'Merchandising');
  assert.equal(categoriaDeIA({ producto: 'Mermelada de fresa' }, interpretarDictado('3 mermeladas de fresa', productos)), null);

  const { producto } = desempatarConLocal(productoDeNombre('Mermelada de fresa', enInventario(productos, 'Merchandising')), local);
  assert.equal(producto.item.id, 'm1');
});
