import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDescuento, descontar, nuevoLote, colorLote, textoVenceLote, fechaVence } from '../src/logica/lotes.js';
import { filtrarInventario, inventarioVacio, chipsInventario } from '../src/logica/inventario.js';
import { problemasDe, calcularAlertas, ordenarAlertas } from '../src/logica/alertas.js';
import { enDias, haceDias, lote, producto } from './ayuda.js';

// ---------- lotes (deben comportarse igual que movimientos.py) ----------

test('salida: primero lo que vence antes y nunca lo vencido', () => {
  const item = producto('Arroz', { lotes: [lote(1, 20, null, haceDias(5)), lote(2, 10, enDias(5)), lote(3, 5, enDias(-2))] });
  const plan = planDescuento(item, 12);
  assert.deepEqual(plan.map(p => [p.lote.id, p.cantidad]), [[2, 10], [1, 2]]);
  descontar(plan);
  assert.deepEqual(item.lotes.map(l => l.quedan), [18, 0, 5]);
});

test('ajuste: con vencidos tambien descuenta lo vencido', () => {
  const item = producto('Arroz', { lotes: [lote(1, 2), lote(2, 5, enDias(-1))] });
  assert.deepEqual(planDescuento(item, 6, true).map(p => [p.lote.id, p.cantidad]), [[2, 5], [1, 1]]);
});

test('sin fecha: por orden de llegada', () => {
  const item = producto('Arroz', { lotes: [lote(1, 3, null, haceDias(1)), lote(2, 3, null, haceDias(9))] });
  assert.deepEqual(planDescuento(item, 4).map(p => p.lote.id), [2, 1]);
});

test('decimales no dejan restos raros', () => {
  const item = producto('Azúcar', { lotes: [lote(1, 0.3), lote(2, 0.6, enDias(1))] });
  descontar(planDescuento(item, 0.7));
  assert.deepEqual(item.lotes.map(l => l.quedan), [0.2, 0]);
});

test('nuevo lote y textos', () => {
  const item = producto('Arroz');
  const l = nuevoLote(item, { cantidad: 4, vence: '2026-11-05' });
  assert.equal(item.lotes.length, 1);
  assert.equal(l.quedan, 4);
  assert.equal(fechaVence('2026-11-05'), '05/11/26');
  assert.equal(colorLote(lote(1, 1, enDias(1))), 'rojo');
  assert.equal(textoVenceLote(lote(1, 1, null, haceDias(3))), 'Sin fecha · lleva 3 días');
  assert.match(textoVenceLote(lote(1, 1, enDias(-1))), /^Venció /);
});

// ---------- filtros de inventario ----------

const lista = [
  producto('Arroz', { minimo: 50, lotes: [lote(1, 10, null, haceDias(20))] }),
  producto('Leche', { minimo: 1, unidad: 'latas', lotes: [lote(2, 10, enDias(5))] }),
  producto('Avena', { minimo: 9, lotes: [lote(3, 10, enDias(60)), lote(4, 2, enDias(-1))] }),
];
const filtrar = f => filtrarInventario(lista, { ...inventarioVacio(), ...f }).map(i => i.nombre);

test('filtros de inventario', () => {
  assert.deepEqual(filtrar({}), ['Arroz', 'Avena', 'Leche']);
  assert.deepEqual(filtrar({ vencimiento: 'vencido' }), ['Avena']);
  assert.deepEqual(filtrar({ vencimiento: '7' }), ['Leche']);
  assert.deepEqual(filtrar({ vencimiento: 'sinFecha' }), ['Arroz']);
  assert.deepEqual(filtrar({ lleva: '15' }), ['Arroz']);
  assert.deepEqual(filtrar({ stock: 'bajo' }), ['Arroz']);
  assert.deepEqual(filtrar({ stock: 'cerca' }), ['Avena']);
  assert.deepEqual(filtrar({ unidad: 'latas' }), ['Leche']);
  assert.deepEqual(filtrar({ orden: 'vence' }), ['Leche', 'Avena', 'Arroz']);
  assert.deepEqual(filtrar({ orden: 'stock' }), ['Arroz', 'Avena', 'Leche']);
});

test('pastillas de filtros', () => {
  assert.deepEqual(chipsInventario(inventarioVacio()), []);
  assert.deepEqual(chipsInventario({ ...inventarioVacio(), stock: 'bajo', unidad: 'kg' }).map(c => c.texto), ['Bajo el mínimo', 'En kg']);
});

// ---------- alertas ----------

test('problemas de un producto', () => {
  const vencido = producto('Avena', { minimo: 1, lotes: [lote(1, 3, enDias(-4))] });
  assert.deepEqual(problemasDe(vencido).map(p => [p.tipo, p.prioridad]), [['Vencido', 'Alta']]);
  assert.match(problemasDe(vencido)[0].detalle, /^Todo \(3 kg\) venció hace 4 días/);

  const porVencer = producto('Leche', { minimo: 1, lotes: [lote(1, 10, enDias(10))] });
  assert.deepEqual(problemasDe(porVencer).map(p => [p.tipo, p.prioridad]), [['Por vencer', 'Media']]);

  const bajo = producto('Arroz', { minimo: 20, lotes: [lote(1, 10)] });
  assert.deepEqual(problemasDe(bajo).map(p => p.tipo), ['Stock bajo']);

  const cerca = producto('Arroz', { minimo: 9, lotes: [lote(1, 10)] });
  assert.deepEqual(problemasDe(cerca).map(p => [p.tipo, p.prioridad]), [['Cerca del mínimo', 'Baja']]);

  assert.deepEqual(problemasDe(producto('Ok', { minimo: 1, lotes: [lote(1, 10)] })), []);
});

test('alertas ordenadas por prioridad', () => {
  const estado = {
    alimentos: [
      producto('Cerca', { minimo: 9, lotes: [lote(1, 10)] }),
      producto('Vencido', { minimo: 1, lotes: [lote(2, 3, enDias(-1))] }),
    ],
    salud: [producto('Alcohol', { minimo: 1, lotes: [lote(3, 5, enDias(1))] })],
  };
  const filas = calcularAlertas(estado);
  assert.deepEqual(filas.map(f => f.item.nombre), ['Vencido', 'Alcohol', 'Cerca']);
  assert.equal(filas[1].categoria, 'Salud');
  assert.deepEqual(ordenarAlertas(filas, { orden: 'producto', invertido: false }).map(f => f.item.nombre), ['Alcohol', 'Cerca', 'Vencido']);
});
