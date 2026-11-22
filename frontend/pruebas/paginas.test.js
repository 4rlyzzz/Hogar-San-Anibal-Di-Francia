import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginar, tamanosTabla, tamanosTarjetas } from '../src/logica/paginas.js';

const cuarentaYCuatro = Array.from({ length: 44 }, (_, i) => i + 1);

test('cada pagina trae su parte de la lista', () => {
  const primera = paginar(cuarentaYCuatro, 1, 25);
  assert.deepEqual([primera.visibles.length, primera.visibles[0], primera.paginas, primera.desde, primera.hasta], [25, 1, 2, 1, 25]);
  const segunda = paginar(cuarentaYCuatro, 2, 25);
  assert.deepEqual([segunda.visibles.length, segunda.visibles[0], segunda.desde, segunda.hasta], [19, 26, 26, 44]);
  // tarjetas de 15 en 15: 3 paginas
  assert.equal(paginar(cuarentaYCuatro, 3, 15).visibles.length, 14);
});

test('si se filtra y la pagina ya no existe, se ve la ultima', () => {
  const r = paginar(cuarentaYCuatro.slice(0, 10), 3, 25);
  assert.deepEqual([r.pagina, r.paginas, r.visibles.length], [1, 1, 10]);
  assert.equal(paginar(cuarentaYCuatro, 0, 25).pagina, 1);
});

test('lista vacia', () => {
  const r = paginar([], 1, 25);
  assert.deepEqual([r.visibles, r.total, r.paginas, r.desde, r.hasta], [[], 0, 1, 0, 0]);
});

test('tres opciones de cuantos ver', () => {
  assert.deepEqual(tamanosTabla, [25, 50, 100]);
  assert.deepEqual(tamanosTarjetas, [15, 30, 50]);
});
