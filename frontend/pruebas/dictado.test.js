import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarDictado, separarDictado, buscarFecha, corregirNombres, tipoDictado, productoDeNombre, cantidadDeLaIA } from '../src/logica/dictado.js';

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

test('reconoce si es ingreso o salida y lo quita del texto', () => {
  assert.deepEqual(tipoDictado('ingreso de dos kilos de arroz'), { tipo: 'Ingreso', ambos: false, resto: 'dos kilos de arroz' });
  assert.deepEqual(tipoDictado('Salida: tres latas de leche'), { tipo: 'Salida', ambos: false, resto: 'tres latas de leche' });
  // ese "un" no es una cantidad
  assert.deepEqual(tipoDictado('registrar un ingreso de 2 kilos de arroz'), { tipo: 'Ingreso', ambos: false, resto: '2 kilos de arroz' });
  assert.deepEqual(tipoDictado('Salieron 3 latas de leche'), { tipo: 'Salida', ambos: false, resto: '3 latas de leche' });
  assert.equal(tipoDictado('llegó un kilo de arroz').tipo, 'Ingreso');
});

test('sin decirlo no se adivina, y decir los dos se avisa', () => {
  assert.equal(tipoDictado('dos kilos de arroz').tipo, null);
  const dos = tipoDictado('ingreso de arroz y salida de leche');
  assert.equal(dos.tipo, null);
  assert.equal(dos.ambos, true);
});

test('palabras parecidas no cambian el tipo', () => {
  // saco es un envase; sal y salsa son productos
  assert.equal(tipoDictado('un saco de arroz').tipo, null);
  assert.equal(tipoDictado('dos kilos de sal y una salsa').tipo, null);
  assert.equal(tipoDictado('ingreso de un saco de arroz').resto, 'un saco de arroz');
});

test('quitado el tipo, el dictado entiende los productos igual', () => {
  const { resto } = tipoDictado('registrar una salida de dos kilos de arroz y tres latas de leche');
  assert.deepEqual(resumen(resto), [['Arroz', 2], ['Leche Evaporada Gloria', 3]]);
});

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

test('el nombre que entendio la IA se busca con su dosis', () => {
  const salud = [
    { item: { id: 1, nombre: 'Paracetamol 100mg', unidad: 'cajas' }, categoria: 'Salud' },
    { item: { id: 2, nombre: 'Paracetamol 50 mg', unidad: 'cajas' }, categoria: 'Salud' },
    { item: { id: 3, nombre: 'Paracetamol Jarabe 120 mg/5 ml', unidad: 'frascos' }, categoria: 'Salud' },
    ...productos,
  ];
  const nombre = dicho => productoDeNombre(dicho, salud).producto?.item.nombre ?? null;
  assert.equal(nombre('Paracetamol 100 mg'), 'Paracetamol 100mg');
  assert.equal(nombre('paracetamol 100 miligramos'), 'Paracetamol 100mg');
  assert.equal(nombre('Paracetamol 50mg'), 'Paracetamol 50 mg');
  assert.equal(nombre('Paracetamol jarabe 120 mg/5 ml'), 'Paracetamol Jarabe 120 mg/5 ml');
  // una dosis que no esta registrada no se cambia por otra
  assert.equal(nombre('Paracetamol 200 mg'), null);
  // sin dosis y con varios: se pregunta cual
  assert.deepEqual(productoDeNombre('Paracetamol', salud).dudas.map(d => d.item.id), [1, 2]);
  // el tamaño registrado aparte del nombre tambien cuenta
  assert.equal(nombre('Leche Gloria 400 g'), 'Leche Evaporada Gloria');
  assert.equal(nombre('Leche Gloria 1 kg'), null);
  assert.equal(nombre('Arroz'), 'Arroz');
  assert.equal(nombre('Fideos'), null);
});

test('el dictado local no repite la medida del nombre', () => {
  const salud = [{ item: { id: 1, nombre: 'Paracetamol 100mg', unidad: 'cajas' }, categoria: 'Salud' }];
  const [r] = interpretarDictado('dos cajas de paracetamol 100 mg', salud);
  assert.equal(r.producto?.item.nombre, 'Paracetamol 100mg');
  assert.equal(r.cantidad, 2);
  assert.equal(r.nombreDicho, 'Paracetamol 100mg');
});

test('la cantidad de la IA no es el tamaño del envase', () => {
  const arroz = { id: 9, nombre: 'Arroz', unidad: 'sacos', contenido: 50, medida: 'kg' };
  // "5 sacos de arroz de 50 kg": la IA devolvio 50 kg, el dictado local entendio 5 sacos
  assert.equal(cantidadDeLaIA(50, 'kg', arroz, 5), 5);
  assert.equal(cantidadDeLaIA(50, 'sacos', arroz, 5), 5);
  assert.equal(cantidadDeLaIA(5, 'sacos', arroz, 5), 5);
  assert.equal(cantidadDeLaIA(5, 'sacos de 50 kg', arroz, null), 5);
  // "50 kilos de arroz" es un saco; "100 kg" son dos
  assert.equal(cantidadDeLaIA(50, 'kilos', arroz, null), 1);
  assert.equal(cantidadDeLaIA(100, 'kg', arroz, null), 2);
  // sin otra pista, 50 sacos son 50 sacos
  assert.equal(cantidadDeLaIA(50, 'sacos', arroz, null), 50);
  assert.equal(cantidadDeLaIA(500, 'gramos', { nombre: 'Avena', unidad: 'kg' }, null), 0.5);
  assert.equal(cantidadDeLaIA('cinco', 'sacos', arroz, 5), 5);
  assert.deepEqual(interpretarDictado('5 sacos de arroz de 50 kg que vencen el 15 de octubre de 2027', [{ item: arroz, categoria: 'Alimentos' }])
    .map(r => [r.producto?.item.nombre, r.cantidad, r.vence]), [['Arroz', 5, '2027-10-15']]);
});
