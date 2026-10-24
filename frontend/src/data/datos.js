// datos de prueba mientras no hay backend
import { textoFecha, fechaDe } from '../components/Comunes.js';

const horasAtras = h => new Date(Date.now() - h * 60 * 60 * 1000);

// cuentas de prueba: cuando haya backend las claves se validan alla, nunca en el frontend
// creado: fecha de alta; ultimoAcceso: ultima vez que inicio sesion (null si nunca entro)
// el nombre es el mismo que aparece como "responsable" en el historial
export const cuentas = [
  { id: 1, usuario: 'admin', clave: 'admin123', nombre: 'Administración', rol: 'Administrador', activo: true, creado: new Date(2026, 7, 1), creadoPor: '', ultimoAcceso: horasAtras(3) },
  { id: 2, usuario: 'almacen', clave: 'almacen123', nombre: 'Almacén', rol: 'Usuario', activo: true, creado: new Date(2026, 7, 4), creadoPor: 'Administración', ultimoAcceso: horasAtras(26) },
  { id: 3, usuario: 'cocina', clave: 'cocina123', nombre: 'Cocina', rol: 'Usuario', activo: true, creado: new Date(2026, 7, 12), creadoPor: 'Administración', ultimoAcceso: horasAtras(0.4) },
  { id: 4, usuario: 'enfermeria', clave: 'enfermeria123', nombre: 'Enfermería', rol: 'Usuario', activo: false, creado: new Date(2026, 8, 2), creadoPor: 'Administración', ultimoAcceso: horasAtras(24 * 9) },
];

// quien inicio sesion; se llena al entrar (ver main.js)
export const usuario = { id: null, nombre: '', iniciales: '', rol: '' };

// otra tabla aparte: los donadores se ingresan a mano (pestaña Donadores o al registrar un ingreso)
// creadoPor y creado son opcionales: los documentos viejos de la bd no los traen
export const donadores = [
  { id: 1, nombre: 'Parroquia San José', telefono: '987 654 321', creadoPor: 'Almacén', creadoPorId: 2, creado: horasAtras(48) },
  { id: 2, nombre: 'Supermercados Plaza Vea', telefono: '01 625 8000', creadoPor: 'Administración', creadoPorId: 1, creado: horasAtras(24 * 15) },
  { id: 3, nombre: 'Familia Quispe', telefono: '956 112 334' },
];

// actividades por las que se dona; aparecen como opciones al registrar una donacion
// para cambiarlas, editar esta lista (las que se escriban con "Otra actividad" se suman solas)
export const actividadesDonacion = [
  'Aniversario del hogar',
  'Navidad',
  'Maratón',
  'Día del niño',
  'Campaña de invierno',
  'Donación libre',
];

// niños del hogar: opciones de "para quién" en las salidas de Salud
// solo el nombre de pila (son datos de menores); los que se escriban con "Otro niño/a" se suman solos
export const ninos = ['Mateo', 'Lucía', 'Thiago', 'Valentina'];

// lo que no es ingreso ni salida (eso ya esta en el historial): donadores, usuarios, roles...
// en la bd seria un documento con tipo: 'actividad'; quienId apunta a la cuenta
// accion: donador | usuario | rol | estado
export const actividad = [
  { id: 1, fecha: horasAtras(48), quienId: 2, quien: 'Almacén', accion: 'donador', texto: 'Agregó donador', detalle: 'Parroquia San José' },
  { id: 2, fecha: horasAtras(24 * 8), quienId: 1, quien: 'Administración', accion: 'estado', texto: 'Desactivó a', detalle: 'Enfermería' },
  { id: 3, fecha: horasAtras(24 * 15), quienId: 1, quien: 'Administración', accion: 'donador', texto: 'Agregó donador', detalle: 'Supermercados Plaza Vea' },
  { id: 4, fecha: cuentas[3].creado, quienId: 1, quien: 'Administración', accion: 'usuario', texto: 'Agregó usuario', detalle: 'Enfermería' },
  { id: 5, fecha: cuentas[2].creado, quienId: 1, quien: 'Administración', accion: 'usuario', texto: 'Agregó usuario', detalle: 'Cocina' },
  { id: 6, fecha: cuentas[1].creado, quienId: 1, quien: 'Administración', accion: 'usuario', texto: 'Agregó usuario', detalle: 'Almacén' },
];

// lotes de prueba, con fechas contadas desde hoy para que siempre se vean igual
// llego: hace cuantos dias ingreso; vence: en cuantos dias vence (negativo: ya vencio; null: no tiene fecha)
let idLote = 1;
function lote(llego, vence, quedan) {
  const ingreso = new Date();
  ingreso.setDate(ingreso.getDate() - llego);
  ingreso.setHours(9, 0, 0, 0);

  let fecha = null;
  if (vence !== null) {
    const d = new Date();
    d.setDate(d.getDate() + vence);
    fecha = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return { id: idLote++, ingreso, vence: fecha, cantidad: quedan, quedan, origen: '' };
}

// cantidad: la suma de lo que queda en sus lotes (ver components/Lotes.js)
export const alimentos = [
  { id: 1, codigo: 'LE', nombre: 'Leche evaporada Gloria', contenido: 400, medida: 'g', cantidad: 96, minimo: 40, unidad: 'latas', lotes: [lote(40, 142, 60), lote(6, 210, 36)] },
  { id: 2, codigo: 'MA', nombre: 'Manzana', cantidad: 42, minimo: 30, unidad: 'kg', lotes: [lote(20, -11, 12), lote(3, 10, 30)] },
  { id: 3, codigo: 'AV', nombre: 'Avena 3 Ositos', cantidad: 150, minimo: 50, unidad: 'kg', consumoDiario: 3.75, lotes: [lote(17, 12, 150)] },
  { id: 4, codigo: 'AR', nombre: 'Arroz Costeño', cantidad: 210, minimo: 100, unidad: 'kg', lotes: [lote(60, 300, 90), lote(19, 330, 120)] },
  { id: 5, codigo: 'PO', nombre: 'Pollo entero', cantidad: 28, minimo: 40, unidad: 'kg', lotes: [lote(19, -14, 4), lote(5, null, 10), lote(1, null, 14)] },
  { id: 6, codigo: 'LT', nombre: 'Lentejas', contenido: 1, medida: 'kg', cantidad: 12, minimo: 20, unidad: 'bolsas', lotes: [lote(50, 198, 12)] },
];

// medicinas, higiene y aseo (la categoria se guarda como 'Salud')
export const salud = [
  { id: 1, codigo: 'PC', nombre: 'Paracetamol jarabe 120 mg/5 ml', contenido: 60, medida: 'ml', cantidad: 18, minimo: 10, unidad: 'frascos', lotes: [lote(30, 127, 18)] },
  { id: 2, codigo: 'AM', nombre: 'Amoxicilina 500 mg', contenido: 10, medida: 'unidades', cantidad: 6, minimo: 12, unidad: 'blísters', lotes: [lote(45, 37, 6)] },
  { id: 3, codigo: 'PÑ', nombre: 'Pañales Huggies talla M', contenido: 40, medida: 'unidades', cantidad: 4, minimo: 10, unidad: 'paquetes', lotes: [lote(30, null, 4)] },
  { id: 4, codigo: 'SR', nombre: 'Sales de rehidratación oral', contenido: 27.9, medida: 'g', cantidad: 34, minimo: 20, unidad: 'sobres', lotes: [lote(19, 249, 34)] },
  { id: 5, codigo: 'AG', nombre: 'Alcohol en gel', contenido: 1, medida: 'L', cantidad: 22, minimo: 8, unidad: 'frascos', lotes: [lote(70, 158, 22)] },
  { id: 6, codigo: 'VC', nombre: 'Vitamina C gotas', contenido: 30, medida: 'ml', cantidad: 9, minimo: 8, unidad: 'frascos', lotes: [lote(25, 12, 9)] },
];

// movimientos de prueba del ultimo año (contando desde hoy) para que el grafico de inicio tenga datos
// la actividad de una donacion segun la epoca del año
function actividadDeFecha(fecha) {
  const mes = fecha.getMonth();
  if (mes === 11) return 'Navidad';
  if (mes === 8) return 'Aniversario del hogar';
  if (mes === 5 || mes === 6) return 'Campaña de invierno';
  if (mes === 3) return 'Maratón';
  return 'Donación libre';
}

function movimientosDePrueba() {
  // numeros "al azar" pero siempre los mismos
  let semilla = 7;
  const azar = n => {
    semilla = (semilla * 9301 + 49297) % 233280;
    return Math.floor(semilla / 233280 * n);
  };

  const filas = [];
  // menos de un año: la fecha no guarda el año y "19 oct" de hace 365 dias se leeria como hoy
  for (let d = 1; d < 365; d++) {
    const veces = [0, 0, 1, 1, 2][azar(5)];

    for (let v = 0; v < veces; v++) {
      const esSalud = azar(3) === 0;
      const lista = esSalud ? salud : alimentos;
      const item = lista[azar(lista.length)];
      const esIngreso = azar(5) < 2;

      const fecha = new Date();
      fecha.setDate(fecha.getDate() - d);
      fecha.setHours(8 + azar(10), azar(60));

      // la mitad de los ingresos son donaciones de alguno de los donadores
      const donacion = esIngreso && azar(2) === 0;

      filas.push({
        fecha: textoFecha(fecha),
        insumo: item.nombre,
        categoria: esSalud ? 'Salud' : 'Alimentos',
        movimiento: esIngreso ? 'Ingreso' : 'Salida',
        cantidad: esIngreso ? 5 + azar(36) : 1 + azar(10),
        unidad: item.unidad,
        responsable: esIngreso ? 'Almacén' : esSalud ? 'Enfermería' : 'Cocina',
        donador: donacion ? donadores[azar(donadores.length)].nombre : '',
        actividad: donacion ? actividadDeFecha(fecha) : '',
        para: esSalud && !esIngreso && azar(3) === 0 ? ninos[azar(ninos.length)] : '',
      });
    }
  }
  return filas;
}

// movimientos: ingresos y salidas de cada producto, del mas nuevo al mas antiguo
export const historial = [
  { fecha: '07 oct 09:05', insumo: 'Avena 3 Ositos', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: 150, unidad: 'kg', responsable: 'Almacén', donador: '', para: '' },
  { fecha: '07 oct 08:40', insumo: 'Leche evaporada Gloria', categoria: 'Alimentos', movimiento: 'Salida', cantidad: 12, unidad: 'latas', responsable: 'Cocina', donador: '', para: '' },
  { fecha: '06 oct 18:22', insumo: 'Amoxicilina 500 mg', categoria: 'Salud', movimiento: 'Salida', cantidad: 2, unidad: 'blísters', responsable: 'Enfermería', donador: '', para: '' },
  { fecha: '06 oct 16:10', insumo: 'Pañales Huggies talla M', categoria: 'Salud', movimiento: 'Salida', cantidad: 3, unidad: 'paquetes', responsable: 'Cuidado', donador: '', para: '' },
  { fecha: '06 oct 11:35', insumo: 'Pollo entero', categoria: 'Alimentos', movimiento: 'Salida', cantidad: 8, unidad: 'kg', responsable: 'Cocina', donador: '', para: '' },
  { fecha: '05 oct 15:48', insumo: 'Sales de rehidratación oral', categoria: 'Salud', movimiento: 'Ingreso', cantidad: 40, unidad: 'sobres', responsable: 'Almacén', donador: '', para: '' },
  { fecha: '05 oct 09:12', insumo: 'Arroz Costeño', categoria: 'Alimentos', movimiento: 'Ingreso', cantidad: 120, unidad: 'kg', responsable: 'Almacén', donador: '', para: '' },
  ...movimientosDePrueba(),
].sort((a, b) => fechaDe(b.fecha) - fechaDe(a.fecha));
