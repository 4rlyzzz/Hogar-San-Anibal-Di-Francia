// lo que hace la app: guardar, cambiar el estado, abrir ventanas
// los formularios mandan sus valores como objeto { campo: texto }; si algo no pasa la validacion se lanza Invalido
import { estado, refrescar } from './estado.js';
import { usuario, actividadesDonacion, ninos } from './data/datos.js';
import { reglas, cantidadDe, numero as reglaNumero, opcion, limpiarTexto, fechaFiltro, largos } from './validacion.js';
import {
  iniciales, nombreCategoria, motivoCorreccion, motivosAjuste, movimientosEntre, palabras, coincideNombre, palabrasEnComun,
  pluralizar, envaseSingular, mismoId, redondear, fechaActual,
} from './logica/comunes.js';
import { planDescuento, descontar, nuevoLote, disponible, cantidadVencida, lotesVencidos } from './logica/lotes.js';
import { inventarioVacio } from './logica/inventario.js';
import { filtrarHistorial, filtrosHistorialVacios } from './logica/historial.js';
import { listaDonadores, actividadesDe } from './logica/donadores.js';
import { descargarHistorial, nombreArchivoHistorial, descargarDonadores, nombreArchivoDonadores } from './logica/exportar.js';

// envases (en plural)
export const envasesAlimentos = ['bolsas', 'latas', 'sacos', 'cajas', 'paquetes', 'botellas', 'frascos', 'sobres'];
export const envasesSalud = ['cajas', 'blísters', 'frascos', 'sobres', 'ampollas', 'tubos', 'paquetes', 'botellas'];
// suelto o a granel
export const medidasSuelto = ['kg', 'g', 'L', 'unidades'];
// medidas del contenido
export const medidasAlimentos = ['kg', 'g', 'L', 'ml', 'unidades'];
export const medidasSalud = ['unidades', 'ml', 'L', 'g'];

// roles validos
export const roles = ['Usuario', 'Administrador'];

// ---------- errores de validacion ----------
// campo: el input que hay que marcar
export class Invalido extends Error {
  constructor(mensaje, campo = null) {
    super(mensaje);
    this.campo = campo;
  }
}

function falla(mensaje, campo) {
  throw new Invalido(mensaje, campo);
}

// valida un campo del formulario con su regla
function leer(v, campo, regla) {
  const resultado = regla(v[campo] ?? '');
  if (!resultado.ok) falla(resultado.error, campo);
  return resultado.valor;
}

// el valor tiene que estar en la lista
function permitido(valor, permitidos) {
  return permitidos.includes(valor);
}

// corre una accion y devuelve { error, campo } si no paso la validacion
export function intentar(accion) {
  try {
    accion();
    return null;
  } catch (e) {
    if (e instanceof Invalido) return { error: e.message, campo: e.campo };
    throw e;
  }
}

// ---------- ventanas y avisos ----------
let siguienteModal = 1;

export function abrirModal(modal) {
  estado.modal = { ...modal, id: siguienteModal++ };
  estado.menuUsuario = false;
  refrescar();
}

export function cerrarModal() {
  estado.modal = null;
  refrescar();
}

let reloj = null;
export function mostrarToast(texto) {
  estado.toast = { texto, id: Date.now() };
  refrescar();
  clearTimeout(reloj);
  reloj = setTimeout(() => {
    estado.toast = null;
    refrescar();
  }, 2600);
}

// ---------- sesion ----------
// la sesion dura hasta cerrar el navegador
function leerSesion() {
  try {
    return sessionStorage.getItem('sesion');
  } catch {
    return null;
  }
}

function guardarSesion(id) {
  try {
    if (id) sessionStorage.setItem('sesion', id);
    else sessionStorage.removeItem('sesion');
  } catch {
    // sin almacenamiento la sesion solo dura hasta recargar
  }
}

// si la cuenta se desactivo, vuelve al login
export function iniciar() {
  const cuenta = estado.cuentas.find(c => mismoId(c.id, leerSesion()) && c.activo);
  estado.menuFijo = leerMenuFijo();
  if (cuenta) entrar(cuenta);
}

// 5 intentos fallidos: esperar 30 segundos
const intentos = { fallidos: 0, esperarHasta: 0 };

export function iniciarSesion(v) {
  const espera = Math.ceil((intentos.esperarHasta - Date.now()) / 1000);
  if (espera > 0) falla(`Demasiados intentos. Espera ${espera} segundos y vuelve a probar.`);

  const nombre = leer(v, 'login-usuario', reglas.nombreUsuario);
  const clave = leer(v, 'login-clave', reglas.claveLogin);

  const cuenta = estado.cuentas.find(c => c.usuario === nombre && c.clave === clave);
  if (!cuenta) {
    intentos.fallidos++;
    if (intentos.fallidos >= 5) {
      intentos.fallidos = 0;
      intentos.esperarHasta = Date.now() + 30000;
    }
    falla('Usuario o contraseña incorrectos.', 'login-clave');
  }
  intentos.fallidos = 0;
  if (!cuenta.activo) falla('Esta cuenta está desactivada. Comunicarse con el administrador.');

  cuenta.ultimoAcceso = new Date();
  entrar(cuenta);
  mostrarToast('Hola, ' + cuenta.nombre);
}

function entrar(cuenta) {
  Object.assign(usuario, { id: cuenta.id, nombre: cuenta.nombre, rol: cuenta.rol, iniciales: iniciales(cuenta.nombre) });
  guardarSesion(cuenta.id);

  // cada vez que alguien entra empieza en Inicio
  estado.seccion = 'Inicio';
  estado.filtro = 'Todos';
  estado.busqueda = '';
  estado.modal = null;
  refrescar();
  window.scrollTo(0, 0);
}

export function salir() {
  guardarSesion(null);
  Object.assign(usuario, { id: null, nombre: '', iniciales: '', rol: '' });
  estado.modal = null;
  estado.menuUsuario = false;
  refrescar();
}

export function esAdmin() {
  return usuario.rol === 'Administrador';
}

// menu lateral fijo o no (se guarda en el navegador)
function leerMenuFijo() {
  try {
    return localStorage.getItem('menu-fijo') === 'si';
  } catch {
    return false;
  }
}

export function fijarMenu() {
  estado.menuFijo = !estado.menuFijo;
  try {
    localStorage.setItem('menu-fijo', estado.menuFijo ? 'si' : 'no');
  } catch {
    // sin almacenamiento solo dura hasta recargar
  }
  refrescar();
}

// ---------- navegacion y filtros ----------
export function irA(seccion) {
  estado.seccion = seccion;
  estado.filtrosAbiertos = null;
  // limpia los filtros al cambiar de pestaña
  estado.inventarioFiltros = inventarioVacio();
  window.scrollTo(0, 0);
  refrescar();
}

export function cambiar(cambio) {
  cambio(estado);
  refrescar();
}

export function buscar(texto) {
  estado.busqueda = limpiarTexto(texto).slice(0, largos.busqueda);
  refrescar();
}

// grupos y ordenes que se pueden cambiar
const gruposFiltro = ['historialFiltros', 'donadoresFiltros', 'inventarioFiltros', 'usuarios'];
const ordenesPermitidos = {
  usuarios: ['nombre', 'acceso', 'movimientos', 'agregado'],
  alertasOrden: ['producto', 'categoria', 'alerta', 'prioridad'],
};

// otro clic en la misma columna invierte el orden
export function ordenar(grupo, columna) {
  if (!permitido(columna, ordenesPermitidos[grupo] ?? [])) return;
  const orden = estado[grupo];
  if (orden.orden === columna) {
    orden.invertido = !orden.invertido;
  } else {
    orden.orden = columna;
    orden.invertido = false;
  }
  refrescar();
}

// opciones: los valores que se pueden elegir (las fechas se validan aparte)
export function cambiarFiltro(grupo, campo, valor, opciones = null) {
  if (!permitido(grupo, gruposFiltro) || !Object.hasOwn(estado[grupo], campo)) return;
  if (opciones ? !permitido(valor, opciones) : !fechaFiltro(valor).ok) return;
  estado[grupo][campo] = valor;
  if (grupo === 'usuarios' && campo === 'orden') estado.usuarios.invertido = false;
  // al cambiar de categoria se limpian producto y niño
  if (grupo === 'historialFiltros' && campo === 'categoria') {
    estado.historialFiltros.producto = 'Todos';
    estado.historialFiltros.para = 'Todos';
  }
  refrescar();
}

// valor sin filtro
function sinFiltro(campo) {
  return campo === 'desde' || campo === 'hasta' ? '' : 'Todos';
}

export function quitarFiltro(grupo, campo) {
  if (!permitido(grupo, gruposFiltro) || !Object.hasOwn(estado[grupo], campo)) return;
  estado[grupo][campo] = sinFiltro(campo);
  refrescar();
}

export function limpiarFiltros(grupo) {
  if (grupo === 'historialFiltros') {
    estado.historialFiltros = filtrosHistorialVacios();
  } else if (grupo === 'donadoresFiltros') {
    estado.donadoresFiltros = { actividad: 'Todos', anio: 'Todos' };
  } else if (grupo === 'inventarioFiltros') {
    // el orden se mantiene
    estado.inventarioFiltros = { ...inventarioVacio(), orden: estado.inventarioFiltros.orden };
  } else if (grupo === 'usuarios') {
    // el orden se mantiene
    estado.usuarios.rol = 'Todos';
    estado.usuarios.estado = 'Todos';
  }
  refrescar();
}

export function abrirFiltros(grupo) {
  estado.filtrosAbiertos = estado.filtrosAbiertos === grupo ? null : grupo;
  refrescar();
}

export function cerrarFiltros() {
  estado.filtrosAbiertos = null;
  refrescar();
}

// ---------- listas ----------
export function listaDe(categoria) {
  return categoria === 'Salud' ? estado.salud : estado.alimentos;
}

function productoPorId(categoria, id) {
  return listaDe(categoria).find(i => mismoId(i.id, id));
}

// actividades de la lista y las agregadas
export function opcionesActividad() {
  const agregadas = estado.historial.map(f => f.actividad).filter(a => a && !actividadesDonacion.includes(a));
  return [...actividadesDonacion, ...[...new Set(agregadas)].sort((a, b) => a.localeCompare(b))];
}

// niños de la lista y los agregados
export function opcionesNinos() {
  const agregados = estado.historial.map(f => f.para).filter(n => n && !ninos.includes(n));
  return [...ninos, ...[...new Set(agregados)].sort((a, b) => a.localeCompare(b))];
}

// ---------- productos parecidos ----------
export function productosParecidos(nombre) {
  const todos = [
    ...estado.alimentos.map(item => ({ item, categoria: 'Alimentos' })),
    ...estado.salud.map(item => ({ item, categoria: 'Salud' })),
  ];
  return todos.filter(({ item }) => coincideNombre(nombre, item.nombre)).slice(0, 3);
}

// mismo nombre sin contar tildes ni mayusculas
function productoIgual(nombre) {
  const buscado = palabras(nombre).join(' ');
  return productosParecidos(nombre).find(({ item }) => palabras(item.nombre).join(' ') === buscado);
}

// ---------- campos que se repiten ----------
// para quien es la salida ('' = uso general)
function leerPara(v) {
  const elegido = v.para ?? '';
  if (elegido === 'otro') return leer(v, 'para-otro', reglas.nino);
  if (!permitido(elegido, ['', ...opcionesNinos()])) falla('Elige para quién es de la lista.', 'para');
  return elegido;
}

// actividad de la donacion ('' sin donador)
function leerActividad(v) {
  if ((v.donador ?? '') === '') return '';
  const elegida = v.actividad ?? '';
  if (elegida === 'otra') return leer(v, 'actividad-otra', reglas.actividadOtra);
  if (!permitido(elegida, opcionesActividad())) falla('Elige la actividad o motivo de la donación.', 'actividad');
  return elegida;
}

// fecha o null si no tiene
function leerVencimiento(v) {
  if (v['sin-vencimiento']) return null;
  if (!v.vencimiento) falla('Pon la fecha de vencimiento o marca "No tiene fecha".', 'vencimiento');
  return leer(v, 'vencimiento', reglas.vencimiento);
}

// datos del donador nuevo (sin repetir)
function leerDonadorNuevo(v, campoNombre, campoTelefono) {
  const nombre = leer(v, campoNombre, reglas.nombreDonador);
  if (estado.donadores.some(d => d.nombre.toLowerCase() === nombre.toLowerCase())) {
    falla(`"${nombre}" ya está registrado: elígelo de la lista.`, campoNombre);
  }
  const telefono = leer(v, campoTelefono, reglas.telefono);
  return { nombre, telefono };
}

// donador elegido, sin crearlo todavia
function elegirDonador(v) {
  const elegido = v.donador ?? '';
  if (elegido === '') return { nombre: '', nuevo: null };

  if (elegido !== 'nuevo') {
    const donador = estado.donadores.find(d => mismoId(d.id, elegido));
    if (!donador) falla('Elige el donador de la lista.', 'donador');
    return { nombre: donador.nombre, nuevo: null };
  }

  const nuevo = leerDonadorNuevo(v, 'donador-nombre', 'donador-telefono');
  return { nombre: nuevo.nombre, nuevo };
}

// agrega el donador si era nuevo y devuelve su nombre
function guardarDonadorElegido(donador) {
  if (donador.nuevo) estado.donadores.push(nuevoDonador(donador.nuevo.nombre, donador.nuevo.telefono));
  return donador.nombre;
}

// ---------- actividad ----------
// acciones que no son movimientos
function registrarActividad(accion, texto, detalle) {
  estado.actividad.unshift({ id: Date.now(), fecha: new Date(), quienId: usuario.id, quien: usuario.nombre, accion, texto, detalle });
}

function nuevoDonador(nombre, telefono) {
  registrarActividad('donador', 'Agregó donador', nombre);
  return { id: Date.now(), nombre, telefono, creadoPor: usuario.nombre, creadoPorId: usuario.id, creado: new Date() };
}

// ---------- ingreso o salida ----------
export function abrirMovimiento(categoria, id, tipo) {
  const item = productoPorId(categoria, id);
  if (!item || !permitido(tipo, ['Ingreso', 'Salida'])) return;
  abrirModal({ tipo: 'movimiento', item, categoria, movimiento: tipo });
}

// paso 1: valida y devuelve lo que se va a guardar
export function revisarMovimiento(modal, v) {
  const { item, categoria, movimiento: tipo } = modal;
  const cantidad = leer(v, 'cantidad', cantidadDe(item.unidad));

  // lo vencido no cuenta para salidas
  if (tipo === 'Salida' && cantidad > disponible(item)) {
    falla(cantidadVencida(item)
      ? `Solo se pueden usar ${disponible(item)} ${item.unidad}; lo vencido se saca con "Dar de baja" en el detalle del producto.`
      : `No puedes sacar más de lo que hay (${item.cantidad} ${item.unidad}).`, 'cantidad');
  }

  // vencimiento del lote nuevo
  const vence = tipo === 'Ingreso' ? leerVencimiento(v) : null;
  const para = categoria === 'Salud' && tipo === 'Salida' ? leerPara(v) : '';

  let donador = { nombre: '', nuevo: null };
  let actividad = '';
  if (tipo === 'Ingreso') {
    actividad = leerActividad(v);
    donador = elegirDonador(v);
  }

  const plan = tipo === 'Salida' ? planDescuento(item, cantidad) : [];
  return { cantidad, vence, plan, donador, actividad, para, esSalud: categoria === 'Salud' };
}

// paso 2: guarda el movimiento
export function confirmarMovimiento(modal, datos) {
  // si ya se guardo (doble clic), no hace nada
  if (estado.modal !== modal) return;
  const { item, categoria, movimiento: tipo } = modal;
  const donador = guardarDonadorElegido(datos.donador);

  const cambio = tipo === 'Ingreso' ? datos.cantidad : -datos.cantidad;
  item.cantidad = redondear(item.cantidad + cambio);
  const lote = tipo === 'Ingreso' ? nuevoLote(item, { cantidad: datos.cantidad, vence: datos.vence }) : null;

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: tipo,
    cantidad: datos.cantidad,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador,
    actividad: datos.actividad,
    para: datos.para,
    saldo: item.cantidad,
    // lote creado o lotes usados
    ...(lote ? { loteId: lote.id, vence: lote.vence } : { lotes: descontar(datos.plan) }),
  });

  estado.modal = null;
  mostrarToast(`${tipo} guardado · ${item.nombre}`);
}

// ---------- producto nuevo ----------
export function abrirProducto(categoria) {
  if (!permitido(categoria, ['Alimentos', 'Salud'])) return;
  abrirModal({ tipo: 'producto', categoria });
}

// { unidad, envase, contenido, medida }
function leerPresentacion(v, categoria) {
  const envase = v.envase ?? '';
  const envasesPermitidos = [...(categoria === 'Salud' ? envasesSalud : envasesAlimentos), 'otro', ...medidasSuelto.map(m => 'suelto:' + m)];
  if (!permitido(envase, envasesPermitidos)) falla('Elige en qué viene el producto.', 'envase');
  // suelto: se cuenta en la medida
  if (envase.startsWith('suelto:')) return { unidad: envase.slice(7), envase: null, contenido: null, medida: null };

  const singular = envase === 'otro' ? leer(v, 'envase-otro', reglas.envaseOtro) : envaseSingular(envase);
  const unidad = envase === 'otro' ? pluralizar(singular) : envase;

  const medida = v.medida ?? '';
  if (!permitido(medida, categoria === 'Salud' ? medidasSalud : medidasAlimentos)) falla('Elige la medida de la lista.', 'medida');
  // 'unidades' va entero; las demas medidas, 2 decimales
  const reglaContenido = reglaNumero({
    min: 0, max: 10000, decimales: medida === 'unidades' ? 0 : 2, minimoExcluido: true,
    que: `cuánto trae cada ${singular.toLowerCase()}`,
  });
  const contenido = leer(v, 'contenido-envase', reglaContenido);
  return { unidad, envase: singular, contenido, medida };
}

export function guardarProducto(modal, v) {
  const { categoria } = modal;
  if (!permitido(categoria, ['Alimentos', 'Salud'])) return;

  const nombre = leer(v, 'nombre', reglas.nombreProducto);
  const igual = productoIgual(nombre);
  if (igual) falla(`Ya existe "${igual.item.nombre}" en ${nombreCategoria(igual.categoria)}. Para sumar stock, registra un ingreso de ese producto.`, 'nombre');

  const { unidad, envase, contenido, medida } = leerPresentacion(v, categoria);
  const cantidad = leer(v, 'cantidad', cantidadDe(unidad));
  const minimo = leer(v, 'minimo', cantidadDe(unidad, { que: 'el stock mínimo', puedeSerCero: true }));
  const vence = leerVencimiento(v);
  const actividad = leerActividad(v);
  const donador = guardarDonadorElegido(elegirDonador(v));

  const item = { id: Date.now(), codigo: nombre.slice(0, 2).toUpperCase(), nombre, envase, contenido, medida, cantidad, minimo, unidad };
  const lote = nuevoLote(item, { cantidad, vence });
  listaDe(categoria).push(item);

  // el producto nuevo cuenta como su primer ingreso
  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: nombre,
    categoria,
    movimiento: 'Ingreso',
    cantidad,
    unidad,
    responsable: usuario.nombre,
    donador,
    actividad,
    para: '',
    saldo: cantidad,
    inicial: true,
    loteId: lote.id,
    vence,
  });

  estado.modal = null;
  estado.filtro = 'Todos';
  mostrarToast('Producto agregado · ' + nombre);
}

// ---------- detalle de un producto ----------
export function verProducto(categoria, id) {
  const item = productoPorId(categoria, id);
  if (item) abrirModal({ tipo: 'panel-producto', item, categoria });
}

// movimientos de un producto (incluye los productos unidos)
export function movimientosDe(item, categoria) {
  return estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.categoria === categoria && [item.nombre, ...(item.unidos || [])].includes(p.fila.insumo));
}

// "Ver todo en historial": el historial filtrado por ese producto
export function historialProducto(item, categoria) {
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria, producto: item.nombre };
  estado.modal = null;
  irA('Historial');
}

// ---------- unir un producto repetido (solo administrador) ----------
// otro producto con la misma unidad y presentacion
function sePuedenUnir(item, otro) {
  return !mismoId(item.id, otro.id) && otro.unidad === item.unidad && otro.contenido === item.contenido && otro.medida === item.medida;
}

export function abrirUnir(categoria, id) {
  if (!esAdmin()) return;
  const item = productoPorId(categoria, id);
  if (!item) return;
  const opciones = listaDe(categoria)
    .filter(o => sePuedenUnir(item, o))
    .map(o => ({ o, comunes: palabrasEnComun(item.nombre, o.nombre) }))
    .filter(x => x.comunes > 0)
    .sort((a, b) => b.comunes - a.comunes)
    .map(x => x.o);
  abrirModal({ tipo: 'unir', item, categoria, opciones });
}

// el stock del repetido entra como ajuste del que se queda
export function guardarUnion(modal, v) {
  if (!esAdmin()) return;
  const { item, categoria } = modal;
  const lista = listaDe(categoria);
  const destino = lista.find(o => mismoId(o.id, v['unir-con']));
  if (!destino || !sePuedenUnir(item, destino)) falla('Elige con qué producto se une.', 'unir-con');

  destino.cantidad = redondear(destino.cantidad + item.cantidad);
  destino.lotes = [...(destino.lotes || []), ...(item.lotes || []).filter(l => l.quedan > 0)];
  if (item.cantidad > 0) {
    estado.historial.unshift({
      fecha: fechaActual(),
      insumo: destino.nombre,
      categoria,
      movimiento: 'Ajuste',
      cantidad: item.cantidad,
      diferencia: item.cantidad,
      unidad: destino.unidad,
      responsable: usuario.nombre,
      donador: '',
      para: '',
      saldo: destino.cantidad,
      motivo: 'Unión de productos',
      nota: `Se unió "${item.nombre}"`,
    });
  }
  destino.unidos = [...(destino.unidos || []), item.nombre, ...(item.unidos || [])];
  lista.splice(lista.indexOf(item), 1);
  registrarActividad('producto', 'Unió productos', `${item.nombre} → ${destino.nombre}`);

  estado.modal = null;
  mostrarToast(`Productos unidos · ${destino.nombre}: ${destino.cantidad} ${destino.unidad}`);
}

// ---------- ajuste de stock ----------
// correccion: { fila, entre } si corrige otro ajuste
export function abrirAjuste(categoria, id, correccion = null) {
  const item = productoPorId(categoria, id);
  if (item) abrirModal({ tipo: 'ajuste', item, categoria, correccion });
}

// abre un ajuste nuevo enlazado al anterior
export function corregirAjuste(indice) {
  const fila = estado.historial[indice];
  if (!fila || fila.movimiento !== 'Ajuste') return;
  const item = listaDe(fila.categoria).find(i => i.nombre === fila.insumo);
  if (!item) {
    mostrarToast('Ese producto ya no está en el inventario');
    return;
  }
  abrirAjuste(fila.categoria, item.id, { fila, entre: movimientosEntre(estado.historial, fila) });
}

// paso 1: valida y devuelve el ajuste
export function revisarAjuste(modal, v) {
  const { item, correccion } = modal;
  const contado = leer(v, 'contado', cantidadDe(item.unidad, { que: 'la cantidad contada', puedeSerCero: true }));

  const motivo = correccion ? motivoCorreccion : v.motivo ?? '';
  if (!correccion && !permitido(motivo, motivosAjuste)) falla('Elige el motivo de la lista.', 'motivo');
  // con "Otro" el detalle es obligatorio
  const nota = leer(v, 'nota', motivo === 'Otro' ? reglas.notaObligatoria : reglas.nota);

  const diferencia = redondear(contado - item.cantidad);
  if (diferencia === 0) falla('La cantidad contada coincide con el sistema: no hay nada que ajustar.', 'contado');
  return { contado, diferencia, motivo, nota };
}

// paso 2: guarda el ajuste
export function confirmarAjuste(modal, ajuste) {
  if (estado.modal !== modal) return;
  const { item, categoria, correccion } = modal;
  item.cantidad = ajuste.contado;

  // si falta, se descuenta de los lotes; si sobra, es un lote nuevo
  const lotes = ajuste.diferencia < 0
    ? { lotes: descontar(planDescuento(item, -ajuste.diferencia, true)) }
    : { loteId: nuevoLote(item, { cantidad: ajuste.diferencia, origen: 'Sobrante del conteo' }).id };

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: 'Ajuste',
    cantidad: Math.abs(ajuste.diferencia),
    diferencia: ajuste.diferencia,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador: '',
    para: '',
    saldo: ajuste.contado,
    motivo: ajuste.motivo,
    nota: ajuste.nota,
    // ajuste que corrige (en la bd, su _id)
    corrige: correccion?.fila ?? null,
    ...lotes,
  });

  estado.modal = null;
  mostrarToast(`Stock ajustado · ${item.nombre}: ${ajuste.contado} ${item.unidad}`);
}

// ---------- baja por vencimiento ----------
export function abrirBaja(categoria, id) {
  const item = productoPorId(categoria, id);
  if (!item || cantidadVencida(item) <= 0) {
    mostrarToast('Este producto no tiene nada vencido');
    return;
  }
  abrirModal({ tipo: 'baja', item, categoria });
}

// saca los lotes vencidos como una salida
export function confirmarBaja(modal, v) {
  if (estado.modal !== modal) return;
  const { item, categoria } = modal;
  const nota = leer(v, 'nota', reglas.nota);
  const vencida = cantidadVencida(item);
  if (vencida <= 0) return;
  const usados = descontar(lotesVencidos(item).map(lote => ({ lote, cantidad: lote.quedan })));
  item.cantidad = redondear(item.cantidad - vencida);

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: 'Salida',
    cantidad: vencida,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador: '',
    para: '',
    saldo: item.cantidad,
    motivo: 'Baja por vencimiento',
    nota,
    lotes: usados,
  });

  estado.modal = null;
  mostrarToast(`Dado de baja · ${vencida} ${item.unidad} de ${item.nombre}`);
}

// ---------- detalle de un movimiento ----------
export function verMovimiento(indice) {
  if (estado.historial[indice]) abrirModal({ tipo: 'panel-movimiento', indice });
}

// "Ver en historial": deja filtrado solo ese producto
export function filtrarProducto(fila) {
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria: fila.categoria, producto: fila.insumo };
  estado.modal = null;
  irA('Historial');
}

// ---------- donadores ----------
export function verDonador(id) {
  const donador = estado.donadores.find(x => mismoId(x.id, id));
  if (donador) abrirModal({ tipo: 'panel-donador', donador });
}

// historial filtrado por ese donador
export function historialDonador(donador) {
  estado.historialFiltros = { ...filtrosHistorialVacios(), donador: donador.nombre };
  estado.modal = null;
  irA('Historial');
}

export function guardarDonador(v) {
  const { nombre, telefono } = leerDonadorNuevo(v, 'nuevo-nombre', 'nuevo-telefono');
  estado.donadores.push(nuevoDonador(nombre, telefono));
  estado.modal = null;
  mostrarToast('Donador agregado · ' + nombre);
}

// ---------- descargas ----------
async function descargar(crear, aviso) {
  try {
    await crear();
    mostrarToast(aviso);
  } catch (error) {
    console.error('Error al crear el Excel:', error);
    mostrarToast('No se pudo crear el Excel');
  }
}

// descarga lo filtrado
export function descargarExcelHistorial() {
  const filas = filtrarHistorial(estado);
  if (filas.length === 0) return Promise.resolve();
  return descargar(() => descargarHistorial(filas, nombreArchivoHistorial(estado.historialFiltros)), `Excel descargado · ${filas.length} movimientos`);
}

// descarga la lista de donadores como se ve
export function descargarExcelDonadores() {
  const filas = listaDonadores(estado).map(x => ({ ...x, actividades: actividadesDe(x.donaciones) }));
  if (filas.length === 0) return Promise.resolve();
  return descargar(() => descargarDonadores(filas, nombreArchivoDonadores(estado.donadoresFiltros)), `Excel descargado · ${filas.length} donadores`);
}

// ---------- usuarios (solo administrador) ----------
function cuentaPorId(id) {
  return estado.cuentas.find(c => mismoId(c.id, id));
}

// el admin ve la de todos; los demas solo la suya
export function verActividad(id) {
  const cuenta = cuentaPorId(id);
  if (!cuenta) return;
  const esPropio = mismoId(cuenta.id, usuario.id);
  if (!esPropio && !esAdmin()) return;
  abrirModal({ tipo: 'panel-actividad', cuenta });
}

export function guardarUsuario(v) {
  if (!esAdmin()) return;
  const nombre = leer(v, 'cuenta-nombre', reglas.nombreCuenta);
  const nombreUsuario = leer(v, 'cuenta-usuario', reglas.nombreUsuario);
  if (estado.cuentas.some(c => c.usuario === nombreUsuario)) falla(`Ya existe el usuario "${nombreUsuario}".`, 'cuenta-usuario');
  const clave = leer(v, 'cuenta-clave', reglas.claveNueva);
  const rol = leer(v, 'cuenta-rol', opcion(roles, 'el rol'));

  estado.cuentas.push({ id: Date.now(), usuario: nombreUsuario, clave, nombre, rol, activo: true, creado: new Date(), creadoPor: usuario.nombre, ultimoAcceso: null });
  registrarActividad('usuario', 'Agregó usuario', nombre);

  estado.modal = null;
  mostrarToast('Usuario agregado · ' + nombre);
}

// el admin no puede desactivarse ni quitarse el rol a si mismo
export function cambiarActivo(id) {
  const cuenta = cuentaPorId(id);
  if (!esAdmin() || !cuenta || mismoId(cuenta.id, usuario.id)) return;
  cuenta.activo = !cuenta.activo;
  registrarActividad('estado', cuenta.activo ? 'Activó a' : 'Desactivó a', cuenta.nombre);
  mostrarToast(`${cuenta.nombre} · ${cuenta.activo ? 'activado' : 'desactivado'}`);
}

export function cambiarRol(id, rol) {
  const cuenta = cuentaPorId(id);
  if (!esAdmin() || !cuenta || mismoId(cuenta.id, usuario.id) || !permitido(rol, roles)) return;
  cuenta.rol = rol;
  registrarActividad('rol', 'Cambió el rol de', `${cuenta.nombre} a ${rol}`);
  mostrarToast(`${cuenta.nombre} ahora es ${rol}`);
}

// ---------- boton "+" segun la pestaña ----------
export function agregar() {
  if (estado.seccion === 'Alimentos' || estado.seccion === 'Salud') abrirProducto(estado.seccion);
  else if (estado.seccion === 'Donadores') abrirModal({ tipo: 'donador' });
  else if (estado.seccion === 'Usuarios') abrirUsuario();
  else abrirModal({ tipo: 'elegir' });
}

export function abrirUsuario() {
  if (esAdmin()) abrirModal({ tipo: 'usuario' });
}
