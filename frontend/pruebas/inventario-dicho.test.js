import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretarDictado, interpretarMezclado, partirPorTipo, tipoDictado, partirPorInventario, categoriaDeIA, enInventario, productoDeNombre, desempatarConLocal, compartirVentaIA } from '../src/logica/dictado.js';

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

// ---------- ingresos y salidas en el mismo dictado ----------
const mezclado = (texto, porDefecto = null) => interpretarMezclado(texto, productos, () => ({}), porDefecto)
  .map(r => [r.tipo, r.producto ? `${r.producto.categoria}:${r.producto.item.nombre}` : null, r.cantidad]);

test('un trozo por cada tipo dicho', () => {
  assert.deepEqual(partirPorTipo('ingreso de 3 kilos de arroz y salida de 2 panetones'), [
    { tipo: 'Ingreso', texto: '3 kilos de arroz' }, { tipo: 'Salida', texto: '2 panetones' },
  ]);
  assert.deepEqual(partirPorTipo('2 kilos de arroz'), [{ tipo: null, texto: '2 kilos de arroz' }]);
  // "entradas" despues de un numero es un producto, no el tipo
  assert.deepEqual(partirPorTipo('venta de 3 entradas'), [{ tipo: 'Salida', texto: '3 entradas' }]);
});

test('ingreso y salida juntos, de inventarios distintos', () => {
  assert.deepEqual(mezclado('ingreso de 3 kilos de arroz y salida de 2 panetones'), [
    ['Ingreso', 'Alimentos:Arroz', 3], ['Salida', "Merchandising:Panetón D'Onofrio", 2],
  ]);
  assert.deepEqual(mezclado('salida de 2 kit salud bucal, ingreso a merchandising de 4 mermeladas de fresa y 1 panetón'), [
    ['Salida', 'Salud:Kit Salud Bucal', 2], ['Ingreso', 'Merchandising:Mermelada de fresa', 4], ['Ingreso', "Merchandising:Panetón D'Onofrio", 1],
  ]);
});

test('sin decir el tipo vale el de la lista; con uno solo, todo es de ese', () => {
  assert.deepEqual(mezclado('2 kilos de arroz', 'Salida'), [['Salida', 'Alimentos:Arroz', 2]]);
  assert.deepEqual(mezclado('ingreso de 2 kilos de arroz y 1 panetón'), [['Ingreso', 'Alimentos:Arroz', 2], ['Ingreso', "Merchandising:Panetón D'Onofrio", 1]]);
});

// ---------- como lo escribe el reconocedor al hacer pausas ----------
const salud = [
  ...productos,
  { item: { id: 'a3', nombre: 'Chuño', unidad: 'kg' }, categoria: 'Alimentos' },
  { item: { id: 'a4', nombre: 'Fideos tallarín Don Vittorio', unidad: 'paquetes', contenido: 500, medida: 'g' }, categoria: 'Alimentos' },
  { item: { id: 's2', nombre: 'Carbamazepina 200 mg', unidad: 'blísters', contenido: 10, medida: 'unidades' }, categoria: 'Salud' },
];
const dictar = texto => interpretarMezclado(texto, salud, () => ({}), null);

test('"sin fecha de vencimiento" dicho despues del producto', () => {
  const [chuno] = dictar('ingreso de 11 kg de chuño suelto. Sin fecha de vencimiento.');
  assert.equal(chuno.producto.item.nombre, 'Chuño');
  assert.equal(chuno.cantidad, 11);
  assert.equal(chuno.sinVence, true);
  assert.equal(dictar('ingreso de 2 kilos de arroz que no vence')[0].sinVence, true);
  assert.equal(dictar('ingreso de 2 kilos de arroz')[0].sinVence, false);
});

test('la cantidad separada de su producto por una pausa', () => {
  const r = dictar('salida de 3 paquetes. Fideo tallarin dormitorio.');
  assert.equal(r.length, 1);
  assert.equal(r[0].producto.item.nombre, 'Fideos tallarín Don Vittorio');
  assert.equal(r[0].cantidad, 3);
});

test('"blister, 10 unidades" sin "de" es el tamaño, no la cantidad', () => {
  assert.equal(dictar('salida de 15 carbamazepina, 200 miligramos blister, 10 unidades')[0].cantidad, 15);
  assert.equal(dictar('salida de carbamazepina 200 miligramos en blister 10 unidades')[0].cantidad, null);
});

// ---------- dictado largo con palabras mal escuchadas ----------
const mas = [
  ...salud,
  { item: { id: 'a5', nombre: 'Lenteja', unidad: 'bolsas', contenido: 500, medida: 'g' }, categoria: 'Alimentos' },
  { item: { id: 's3', nombre: 'Fluoxetina 20 mg', unidad: 'blísters', contenido: 10, medida: 'unidades' }, categoria: 'Salud' },
  { item: { id: 's4', nombre: 'Gasa estéril 10 x 10 cm', unidad: 'cajas', contenido: 20, medida: 'unidades' }, categoria: 'Salud' },
  { item: { id: 'm3', nombre: 'Taza Hogar San Aníbal', unidad: 'unidades', tipoMerch: 'hogar' }, categoria: 'Merchandising' },
];
const extra = () => ({ donadores: [{ id: 'd1', nombre: 'Colegio San José' }], compradores: [{ id: 'c1', nombre: 'Rosa Quispe' }], actividades: ['Día del niño'] });

test('"el primero de enero" es el dia 1', () => {
  const [r] = interpretarMezclado('ingreso de 7 lentejas que vencen el primero de enero del 2027', mas, extra);
  assert.equal(r.vence, '2027-01-01');
});

test('un donador registrado dicho sin "donado por" no se toma como producto', () => {
  const r = interpretarMezclado('ingreso de 7 lentejas en bolsa de 500 g. Nadas por el colegio San José por el día del niño.', mas, extra);
  assert.equal(r.length, 1);
  assert.equal(r[0].donador.nombre, 'Colegio San José');
  assert.equal(r[0].actividad, 'Día del niño');
});

test('"blista" y la coma no parten el producto en varios', () => {
  const r = interpretarMezclado('ingreso de fluoxetina, 20 miligramos en blista de 10 unidades que vencen el primero de febrero del 2027', mas, extra);
  assert.equal(r.length, 1);
  assert.equal(r[0].producto.item.nombre, 'Fluoxetina 20 mg');
  assert.equal(r[0].cantidad, null);
  assert.equal(r[0].vence, '2027-02-01');
});

test('"10x10cm" de la IA es la gasa de 10 x 10 cm, no la taza', () => {
  assert.equal(productoDeNombre('Gaza esteril 10x10cm', mas).producto.item.nombre, 'Gasa estéril 10 x 10 cm');
  assert.equal(productoDeNombre('Gasa estéril 10 por 10 cm', mas).producto.item.nombre, 'Gasa estéril 10 x 10 cm');
});

test('"comprada por" es quien compra; el comprador de la IA solo entre ventas', () => {
  const [r] = interpretarMezclado('venta de 3 panetones a 8 soles cada uno comprada por Rosa Quispe', mas, extra);
  assert.equal(r.comprador.nombre, 'Rosa Quispe');
  const ia = compartirVentaIA([{ tipo: 'ingreso', producto: 'Lenteja' }, { tipo: 'salida', producto: 'Tarjeta', comprador: 'Rosa Quispe' }]);
  assert.equal(ia[0].comprador, undefined);
});

// ---------- palabras parecidas que tienen que seguir siendo distintas ----------
test('"llave" es un producto, no Yape; "yape" si es el medio de pago', () => {
  const conLlave = [...mas, { item: { id: 'm4', nombre: 'Llave decorativa', unidad: 'unidades', tipoMerch: 'hogar' }, categoria: 'Merchandising' }];
  const [sin] = interpretarMezclado('venta de 2 llaves decorativas a Rosa Quispe', conLlave, extra);
  assert.equal(sin.producto.item.nombre, 'Llave decorativa');
  assert.equal(sin.medioPago, '');
  const [con] = interpretarMezclado('venta de 2 llaves decorativas a Rosa Quispe con yape', conLlave, extra);
  assert.equal(con.producto.item.nombre, 'Llave decorativa');
  assert.equal(con.medioPago, 'yape-plin');
});

test('el nombre de un donador dentro del nombre de un producto sigue siendo el producto', () => {
  const donadores = () => ({ donadores: [{ id: 'd2', nombre: 'Hogar San Aníbal' }] });
  const [r] = interpretarMezclado('salida de 2 tazas hogar san aníbal', mas, donadores);
  assert.equal(r.producto.item.nombre, 'Taza Hogar San Aníbal');
  assert.equal(r.donador, null);
});

test('"primero" solo es el dia antes de un mes; "blista" no cambia otras palabras', () => {
  const [r] = interpretarMezclado('ingreso de 2 kilos de arroz primero', mas, extra);
  assert.equal(r.vence, null);
  assert.equal(r.producto.item.nombre, 'Arroz');
});

// ---------- dictado con pausas: lo que se dice despues de una pausa va con su producto ----------
test('precio, comprador y pago dichos en pausas no se pierden', () => {
  const conTodo = t => ({ tipo: t, compradores: [{ id: 'c2', nombre: 'Carmen Ruiz' }], proveedores: [{ id: 'p1', nombre: 'Distribuidora Andina' }] });
  const [tarjeta] = interpretarMezclado('venta de 3 tarjetas navideñas con sobre. En packs a 8 soles cada una compradas por Carmen Ruiz. Con yape.',
    [...mas, { item: { id: 'm5', nombre: 'Tarjeta navideña con sobre', unidad: 'packs', tipoMerch: 'hogar' }, categoria: 'Merchandising' }], conTodo);
  assert.equal(tarjeta.cantidad, 3);
  assert.equal(tarjeta.precio, 8);
  assert.equal(tarjeta.comprador.nombre, 'Carmen Ruiz');
  assert.equal(tarjeta.medioPago, 'yape-plin');

  // "a un precio de 14 soles": ese "un" no es 1 unidad de otro producto
  const r = interpretarMezclado('ingreso de taza hogar san aníbal. Por la distribuidora Andina. A un precio de 14 soles cada una.', mas, conTodo);
  assert.equal(r.length, 1);
  assert.equal(r[0].precio, 14);
  assert.equal(r[0].cantidad, null);
  assert.equal(r[0].proveedor.nombre, 'Distribuidora Andina');
});
