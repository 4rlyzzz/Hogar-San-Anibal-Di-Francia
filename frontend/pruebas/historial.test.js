import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarHistorial, filtrosHistorialVacios, opcionesDe, chipsHistorial } from '../src/logica/historial.js';
import { nombreDonador, listaDonadores, actividadesDe, chipsDonadores } from '../src/logica/donadores.js';
import { actividadDe, movimientoDe, nombreDia } from '../src/logica/actividad.js';
import { textoFecha } from '../src/logica/comunes.js';
import { haceDias } from './ayuda.js';

const fecha = n => textoFecha(haceDias(n));

const historial = [
  { movimiento: 'Salida', insumo: 'Arroz', categoria: 'Alimentos', responsable: 'Cocina', usuario_id: 'usuario:cocina', fecha: fecha(1), cantidad: 2, unidad: 'kg', para: ['Mateo'] },
  { movimiento: 'Ingreso', insumo: 'Arroz Blanco', categoria: 'Alimentos', responsable: 'Dirección', usuario_id: 'usuario:admin', fecha: fecha(5), cantidad: 10, unidad: 'kg', donador: 'Parroquia San José', actividad: 'Navidad' },
  { movimiento: 'Ingreso', insumo: 'Alcohol', categoria: 'Salud', responsable: 'Cocina', fecha: fecha(40), cantidad: 1, unidad: 'frascos', donador: 'Familia Pérez', observaciones: 'urgente' },
];

const estado = (filtros = {}, extra = {}) => ({
  historial,
  historialFiltros: { ...filtrosHistorialVacios(), ...filtros },
  alimentos: [{ nombre: 'Arroz', unidos: ['Arroz Blanco'] }],
  salud: [],
  busqueda: '',
  ...extra,
});
const insumos = (f, extra) => filtrarHistorial(estado(f, extra)).map(x => x.insumo);

test('filtros del historial', () => {
  assert.deepEqual(insumos({}), ['Arroz', 'Arroz Blanco', 'Alcohol']);
  assert.deepEqual(insumos({ movimiento: 'Ingreso' }), ['Arroz Blanco', 'Alcohol']);
  assert.deepEqual(insumos({ categoria: 'Salud' }), ['Alcohol']);
  assert.deepEqual(insumos({ responsable: 'Cocina' }), ['Arroz', 'Alcohol']);
  assert.deepEqual(insumos({ para: 'Mateo' }), ['Arroz']);
  assert.deepEqual(insumos({ donador: 'Familia Pérez' }), ['Alcohol']);
  assert.deepEqual(insumos({ actividad: 'Navidad' }), ['Arroz Blanco']);
  assert.deepEqual(insumos({ orden: 'antiguos' }), ['Alcohol', 'Arroz Blanco', 'Arroz']);
});

test('filtrar por producto incluye los productos unidos', () => {
  assert.deepEqual(insumos({ producto: 'Arroz' }), ['Arroz', 'Arroz Blanco']);
});

test('filtro por fechas y buscador', () => {
  const iso = d => d.toISOString().slice(0, 10);
  assert.deepEqual(insumos({ desde: iso(haceDias(10)) }), ['Arroz', 'Arroz Blanco']);
  assert.deepEqual(insumos({ hasta: iso(haceDias(10)) }), ['Alcohol']);
  assert.deepEqual(insumos({}, { busqueda: 'URGENTE' }), ['Alcohol']);
  assert.deepEqual(insumos({}, { busqueda: 'mateo' }), ['Arroz']);
});

test('opciones y pastillas del historial', () => {
  assert.deepEqual(opcionesDe(historial, 'responsable'), ['Cocina', 'Dirección']);
  assert.deepEqual(opcionesDe(historial, 'para'), ['Mateo']);
  const chips = chipsHistorial({ ...filtrosHistorialVacios(), movimiento: 'Salida', donador: 'X', desde: '2026-10-01' });
  assert.deepEqual(chips.map(c => c.texto), ['Salidas', 'Donó X', 'Desde 01/10/2026']);
});

// ---------- donadores ----------

test('nombre de donador (igual que _nombre_donador del backend)', () => {
  assert.equal(nombreDonador('parroquia  san josé'), 'Parroquia San José');
  assert.equal(nombreDonador('ONG manos unidas'), 'ONG Manos Unidas');
  assert.equal(nombreDonador('FAMILIA PEREZ'), 'Familia Perez');
});

test('lista de donadores con sus donaciones', () => {
  const base = {
    historial,
    donadores: [{ nombre: 'Familia Pérez' }, { nombre: 'Parroquia San José' }, { nombre: 'Sin Donaciones' }],
    busqueda: '',
    donadoresFiltros: { actividad: 'Todos', anio: 'Todos' },
  };
  assert.deepEqual(listaDonadores(base).map(x => [x.donador.nombre, x.donaciones.length]),
    [['Familia Pérez', 1], ['Parroquia San José', 1], ['Sin Donaciones', 0]]);
  const conFiltro = { ...base, donadoresFiltros: { actividad: 'Navidad', anio: 'Todos' } };
  assert.deepEqual(listaDonadores(conFiltro).map(x => x.donador.nombre), ['Parroquia San José']);
  assert.deepEqual(listaDonadores({ ...base, busqueda: 'parro' }).map(x => x.donador.nombre), ['Parroquia San José']);
  assert.deepEqual(actividadesDe(historial), [['Navidad', 1]]);
  assert.deepEqual(chipsDonadores({ actividad: 'Navidad', anio: '2026' }).map(c => c.texto), ['Navidad', 'Año 2026']);
});

// ---------- actividad de una cuenta ----------

test('actividad de una cuenta, de lo mas nuevo a lo mas antiguo', () => {
  const cocina = { id: 'usuario:cocina', nombre: 'Cocina', usuario: 'cocina' };
  const actividad = actividadDe({
    historial,
    donadores: [{ nombre: 'Familia Pérez', creado: haceDias(2), creadoPorId: 'usuario:cocina' }],
    cuentas: [{ nombre: 'Lavandería', cambios: [{ accion: 'rol', valor: 'Administrador', quienId: 'usuario:cocina', fecha: haceDias(3).toISOString() }] }],
  }, cocina);
  assert.deepEqual(actividad.map(a => a.texto), [
    'Salida · Arroz',
    'Agregó donador · Familia Pérez',
    'Cambió el rol de Lavandería',
    'Ingreso · Alcohol',
  ]);
  // los movimientos viejos solo tienen el nombre
  assert.equal(movimientoDe({ responsable: 'Cocina' }, cocina), true);
  assert.equal(movimientoDe({ responsable: 'Dirección', usuario_id: 'usuario:admin' }, cocina), false);
});

test('nombre del dia', () => {
  assert.equal(nombreDia(new Date()), 'Hoy');
  assert.equal(nombreDia(haceDias(1)), 'Ayer');
});
