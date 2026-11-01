import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reglas, limpiarTexto, cantidadDe, fechaValida, codigoBarras, claveNueva, nombreUsuario } from '../src/validacion.js';
import { enDias } from './ayuda.js';

const ok = (r, valor) => assert.deepEqual(r, { ok: true, valor });
const falla = r => assert.equal(r.ok, false, JSON.stringify(r));

test('limpiarTexto junta espacios y quita invisibles', () => {
  assert.equal(limpiarTexto('  Leche\n\tevaporada​ '), 'Leche evaporada');
  assert.equal(limpiarTexto(null), '');
});

test('nombre de producto', () => {
  ok(reglas.nombreProducto('  Leche  Gloria 400 g '), 'Leche Gloria 400 g');
  falla(reglas.nombreProducto(''));
  falla(reglas.nombreProducto('A'));
  falla(reglas.nombreProducto('a'.repeat(61)));
  falla(reglas.nombreProducto('<script>'));
  falla(reglas.nombreProducto('1234'));
  falla(reglas.nombreProducto('Молоко'));
});

test('cantidades segun la unidad', () => {
  ok(cantidadDe('kg')('2,5'), 2.5);
  ok(cantidadDe('kg')('2.25'), 2.25);
  falla(cantidadDe('kg')('2.255'));
  falla(cantidadDe('latas')('2.5'));
  ok(cantidadDe('latas')('3'), 3);
  falla(cantidadDe('latas')('0'));
  ok(cantidadDe('latas', { puedeSerCero: true })('0'), 0);
  falla(cantidadDe('kg')('100001'));
  falla(cantidadDe('kg')('-1'));
  falla(cantidadDe('kg')('12 5'));
  falla(cantidadDe('kg')('1e3'));
});

test('fechas', () => {
  assert.equal(fechaValida('2028-02-29'), true);
  assert.equal(fechaValida('2027-02-29'), false);
  assert.equal(fechaValida('2026-13-01'), false);
  assert.equal(fechaValida('26-01-01'), false);
  ok(reglas.vencimiento(enDias(0)), enDias(0));
  falla(reglas.vencimiento(enDias(-1)));
  falla(reglas.vencimiento(enDias(365 * 11)));
  ok(reglas.fechaFiltro(''), '');
  falla(reglas.fechaFiltro('ayer'));
});

test('telefono', () => {
  ok(reglas.telefono('+51 987-654-321'), '+51 987-654-321');
  falla(reglas.telefono('12345'));
  falla(reglas.telefono('1234567890123456'));
  falla(reglas.telefono('98765abc'));
});

test('codigo de barras con digito de control', () => {
  ok(codigoBarras('4006381333931'), '4006381333931');
  falla(codigoBarras('4006381333932'));
  ok(codigoBarras('ABC-123'), 'ABC-123');
  falla(codigoBarras('ab'));
  ok(codigoBarras('', { opcional: true }), '');
  falla(codigoBarras(''));
});

test('usuario y contraseña (mismas reglas que el backend)', () => {
  ok(nombreUsuario(' Cocina.1 '), 'cocina.1');
  falla(nombreUsuario('ab'));
  falla(nombreUsuario('josé'));
  ok(claveNueva('clave1234'), 'clave1234');
  falla(claveNueva('corta1'));
  falla(claveNueva('sololetras'));
  falla(claveNueva('12345678'));
  falla(claveNueva('a1'.repeat(33)));
  falla(claveNueva('clave\n1234'));
  falla(reglas.claveLogin(''));
});

test('dictado limpia signos raros y limita el largo', () => {
  ok(reglas.dictado('dos kilos de arroz <b>'), 'dos kilos de arroz b');
  falla(reglas.dictado('   '));
  falla(reglas.dictado('a'.repeat(501)));
});
