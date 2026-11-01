import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarDictado, separarDictado, buscarFecha, corregirNombres } from '../src/logica/dictado.js';

const productos = [
  { item: { nombre: 'Arroz', unidad: 'kg' }, categoria: 'Alimentos' },
  { item: { nombre: 'Leche Evaporada Gloria', unidad: 'latas', contenido: 400, medida: 'g' }, categoria: 'Alimentos' },
  { item: { nombre: 'Lentejas', unidad: 'bolsas', contenido: 1, medida: 'kg' }, categoria: 'Alimentos' },
  { item: { nombre: 'Avena', unidad: 'kg' }, categoria: 'Alimentos' },
  { item: { nombre: 'Alcohol', unidad: 'frascos' }, categoria: 'Salud' },
];
const donadores = [{ nombre: 'Parroquia San José' }];

const resumen = texto => interpretarDictado(texto, productos, { donadores, actividades: ['Navidad'] })
  .map(r => [r.producto?.item.nombre ?? null, r.cantidad]);

test('varios productos con sus cantidades', () => {
  assert.deepEqual(resumen('dos kilos de arroz y tres latas de leche'), [['Arroz', 2], ['Leche Evaporada Gloria', 3]]);
  assert.deepEqual(resumen('10 kilos de arroz, 4 frascos de alcohol'), [['Arroz', 10], ['Alcohol', 4]]);
});

test('sin comas: una cantidad nueva empieza otro producto', () => {
  assert.deepEqual(resumen('5 kilos de arroz 2 frascos de alcohol'), [['Arroz', 5], ['Alcohol', 2]]);
});

test('numeros dichos con palabras y decimales', () => {
  assert.deepEqual(resumen('treinta y dos kilos de arroz'), [['Arroz', 32]]);
  assert.deepEqual(resumen('un kilo y medio de avena'), [['Avena', 1.5]]);
  assert.deepEqual(resumen('2,5 kilos de arroz'), [['Arroz', 2.5]]);
  assert.deepEqual(resumen('una docena de frascos de alcohol'), [['Alcohol', 12]]);
});

test('convierte a la unidad del producto', () => {
  assert.deepEqual(resumen('500 gramos de avena'), [['Avena', 0.5]]);
  // bolsas de 1 kg: 5 kilos son 5 bolsas
  assert.deepEqual(resumen('5 kilos de lentejas'), [['Lentejas', 5]]);
});

test('presentacion que no esta registrada se avisa', () => {
  const [r] = interpretarDictado('3 bolsas de leche de 1 litro', productos);
  assert.ok(r.presentacion, 'deberia avisar que no esta registrada asi');
});

test('donador, actividad y fecha de vencimiento', () => {
  const [r] = interpretarDictado('10 kilos de arroz donado por la parroquia san jose para navidad vence el 15 de octubre de 2030', productos, { donadores, actividades: ['Navidad'] });
  assert.equal(r.producto.item.nombre, 'Arroz');
  assert.equal(r.cantidad, 10);
  assert.equal(r.donador?.nombre, 'Parroquia San José');
  assert.equal(r.actividad, 'Navidad');
  assert.equal(r.vence, '2030-10-15');
});

test('"todo esto lo donó" vale para todos', () => {
  const r = interpretarDictado('2 kilos de arroz, 3 frascos de alcohol, todo esto lo donó la parroquia san josé', productos, { donadores });
  assert.equal(r.length, 2);
  assert.ok(r.every(x => x.donador?.nombre === 'Parroquia San José'));
});

test('producto desconocido se propone como nuevo', () => {
  const [r] = interpretarDictado('4 paquetes de galletas', productos);
  assert.equal(r.producto, null);
  assert.equal(r.cantidad, 4);
  assert.equal(r.nombreDicho, 'galletas');
});

test('separar y fechas', () => {
  assert.deepEqual(separarDictado('arroz, leche y avena'), ['arroz', 'leche', 'avena']);
  const hoy = new Date(2026, 10, 1);
  assert.equal(buscarFecha(['vence', 'en', 'marzo'], hoy).iso, '2027-03-31');
  assert.equal(buscarFecha(['vence', '15', '10', '2027'], hoy).iso, '2027-10-15');
  assert.equal(buscarFecha(['arroz'], hoy), null);
});

test('corrige nombres mal escuchados', () => {
  assert.equal(corregirNombres('tres latas de leche y borrada de gloria', productos), 'tres latas de Leche Evaporada Gloria');
});
