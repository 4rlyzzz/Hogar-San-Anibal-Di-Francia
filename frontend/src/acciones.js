// lo que hace la app: guardar, cambiar el estado, abrir ventanas
import { 
  login, 
  logout,
  getInventario, 
  guardarProductoAPI, 
  actualizarProductoAPI,
  getHistorialAPI,
  enviarMovimientoAPI,
  unirProductosAPI,
  getDonadoresAPI,
  guardarDonadorAPI,
  getUsuariosAPI,
  guardarUsuarioAPI,
  actualizarUsuarioAPI,
  getMiCuentaAPI,
  cambiarClaveAPI
} from './servicios/api.js';
// los formularios mandan sus valores como objeto { campo: texto }; si algo no pasa la validacion se lanza Invalido
import { estado, refrescar } from './estado.js';
import { usuario, actividadesDonacion, ninos } from './data/datos.js';
import { reglas, cantidadDe, cantidadMaxima, numero as reglaNumero, limpiarTexto, fechaFiltro, largos } from './validacion.js';
import {
  iniciales, nombreCategoria, motivoCorreccion, motivosAjuste, movimientosEntre, palabras, coincideNombre, palabrasEnComun,
  pluralizar, envaseSingular, mismoId, redondear, ninosDe, textoPresentacion, formatoNombre, momento,
} from './logica/comunes.js';
import { planDescuento, disponible, cantidadVencida } from './logica/lotes.js';
import { inventarioVacio } from './logica/inventario.js';
import { filtrarHistorial, filtrosHistorialVacios } from './logica/historial.js';
import { listaDonadores, actividadesDe, nombreDonador } from './logica/donadores.js';
import { descargarHistorial, nombreArchivoHistorial, descargarDonadores, nombreArchivoDonadores } from './logica/exportar.js';
import { interpretarDictado, tipoDictado } from './logica/dictado.js';
import { procesarTextoConOmniroute } from './servicios/Omniroute.js';

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

// variante asíncrona para acciones que consultan la API de Django
export async function intentarAsync(accion) {
  try {
    await accion();
    return null;
  } catch (e) {
    if (e instanceof Invalido) return { error: e.message, campo: e.campo };
    throw e;
  }
}

// ---------- ventanas y avisos ----------
let siguienteModal = 1;

// si se abre encima de otra ventana, el boton "volver" regresa a ella
// volver: null para que no tenga; una funcion para decidir a donde vuelve
export function abrirModal(modal) {
  const anterior = estado.modal;
  const volver = 'volver' in modal ? modal.volver : anterior ? () => abrirModal({ ...anterior, volver: anterior.volver ?? null }) : null;
  estado.modal = { ...modal, volver, id: siguienteModal++ };
  estado.menuUsuario = false;
  refrescar();
}

// alCerrar: la ventana decide a donde volver (por ejemplo, de editar a la lista)
export function cerrarModal() {
  const alCerrar = estado.modal?.alCerrar;
  if (alCerrar) return alCerrar();
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

// ---------- guardar en la base ----------
// los guardados van de uno en uno para que no choquen los _rev de CouchDB
let cola = Promise.resolve();
// guardados que todavia no terminan (las recargas automaticas esperan a que sea 0)
let pendientes = 0;
function guardarEnBD(trabajo) {
  pendientes++;
  cola = cola.then(trabajo).catch(error => {
    console.error('Error al guardar en la base de datos:', error);
    const motivo = error.response?.data?.error;
    mostrarToast(motivo ? `No se guardó: ${motivo}. Se recargaron los datos.` : 'No se pudo guardar en la base de datos. Se recargaron los datos guardados.');
    return cargarDatosDesdeDB();
  }).finally(() => pendientes--);
  return cola;
}

// datos del producto que se pueden editar (el stock no: solo cambia con un movimiento en el servidor)
function docProducto(item, categoria) {
  return {
    nombre: item.nombre,
    categoria: categoria.toLowerCase() === 'salud' ? 'salud' : 'alimentos',
    unidad: item.unidad,
    stock_minimo: item.minimo || 0,
    codigo: item.codigo || '',
    codigosBarras: item.codigosBarras || [],
    envase: item.envase ?? null,
    contenido: item.contenido ?? null,
    medida: item.medida ?? null,
    // nombres de los productos que se le unieron o que tuvo: sin esto, al recargar se pierde su historial
    unidos: item.unidos || [],
  };
}

// producto como lo usa la pantalla (desde la base)
function productoDesdeDoc(doc) {
  return {
    ...doc,
    id: doc._id || doc.id,
    _rev: doc._rev,
    nombre: doc.nombre || 'Sin nombre',
    unidad: doc.unidad || 'unidades',
    cantidad: Number(doc.cantidad) || 0,
    minimo: Number(doc.stock_minimo ?? doc.minimo ?? 0),
    codigo: doc.codigo || (doc.nombre ? doc.nombre.slice(0, 2).toUpperCase() : 'PR'),
    codigosBarras: doc.codigosBarras || [],
    lotes: (doc.lotes || (doc.fecha_vencimiento ? [{ id: 1, vence: doc.fecha_vencimiento, quedan: doc.cantidad }] : [])).map(lote => ({
      ...lote,
      ingreso: lote.ingreso ? new Date(lote.ingreso) : new Date(),
    })),
    almacen: doc.almacen || '',
    categoriaNombre: doc.categoria || '',
  };
}

// el producto queda como lo dejo el servidor (sin cambiar el objeto: las ventanas abiertas lo siguen mostrando)
function actualizarProducto(item, doc) {
  Object.assign(item, productoDesdeDoc(doc));
}

// movimiento como lo usa la pantalla (desde la base)
function movimientoDesdeDoc(doc) {
  const rawMov = doc.movimiento || doc.tipo_movimiento || 'Ingreso';
  const rawCat = doc.categoria || 'alimentos';
  return {
    ...doc,
    id: doc._id || doc.id,
    movimiento: rawMov.charAt(0).toUpperCase() + rawMov.slice(1).toLowerCase(),
    categoria: rawCat.toLowerCase() === 'salud' ? 'Salud' : 'Alimentos',
    insumo: doc.insumo || doc.nombre || 'Sin insumo',
    cantidad: Number(doc.cantidad) || 0,
    saldo: Number(doc.saldo) || 0,
    responsable: doc.responsable || doc.usuario_id || 'admin',
    donador: nombreDonador(doc.donador),
  };
}

function donadorDesdeDoc(doc) {
  return {
    ...doc,
    id: doc._id || doc.id,
    _rev: doc._rev,
    nombre: nombreDonador(doc.nombre),
    telefono: doc.telefono || doc.contacto || '',
    contacto: doc.contacto || doc.telefono || '',
    creadoPor: doc.creadoPor || '',
    // sin fecha (donadores viejos) queda null: no hay que inventar que se agrego hoy
    creado: doc.creado ? new Date(doc.creado) : null,
  };
}

// el error que manda el servidor, para mostrarlo en la ventana
function motivoDelServidor(err) {
  const motivo = err.response?.data?.error;
  return motivo ? motivo.replace(/[.:]?$/, '.') : null;
}

// crea un producto nuevo (nace sin stock: lo que entra va con su ingreso) y lo agrega a su lista
// si ya existe (otra persona lo acaba de crear), el servidor lo rechaza y no queda repetido
async function crearProductoBD(nuevo, categoria) {
  let res;
  try {
    res = await guardarProductoAPI(docProducto(nuevo, categoria));
  } catch (err) {
    if (motivoDelServidor(err)) throw new Invalido(motivoDelServidor(err));
    throw err;
  }
  const item = { ...nuevo, id: res.id || res._id, _rev: res.rev || res._rev, cantidad: 0, lotes: [] };
  listaDe(categoria).push(item);
  return item;
}

// manda un movimiento al servidor: el cambia el stock con el dato de ese momento y lo anota
// el producto queda como lo dejo el servidor; si lo rechaza (otra persona saco antes, por ejemplo),
// el producto se pone al dia y se lanza Invalido con el motivo, para mostrarlo en la ventana
async function enviarMovimiento(item, peticion) {
  try {
    const { producto, movimiento } = await enviarMovimientoAPI({ canal: 'manual', ...peticion, producto_id: item.id });
    actualizarProducto(item, producto);
    return movimientoDesdeDoc(movimiento);
  } catch (err) {
    const datos = err.response?.data;
    if (datos?.producto) {
      actualizarProducto(item, datos.producto);
      refrescar();
    }
    if (motivoDelServidor(err)) throw new Invalido(motivoDelServidor(err));
    throw err;
  }
}

// el movimiento nuevo va arriba del historial
function agregarAlHistorial(fila) {
  estado.historial.unshift(fila);
  refrescar();
}

// ---------- sesion ----------
// la sesion dura hasta cerrar el navegador
function leerSesion() {
  try {
    const sesion = localStorage.getItem('usuario_sesion');
    return sesion ? JSON.parse(sesion) : null;
  } catch {
    return null;
  }
}

function guardarSesion(cuenta) {
  try {
    if (cuenta) {
      localStorage.setItem('usuario_sesion', JSON.stringify(cuenta));
    } else {
      localStorage.removeItem('usuario_sesion');
    }
  } catch {
    // sin almacenamiento la sesion dura hasta recargar
  }
}

export function iniciar() {
  const token = localStorage.getItem('access_token');
  const cuentaGuardada = leerSesion();
  estado.menuFijo = leerMenuFijo();

  if (token && cuentaGuardada) {
    entrar(cuentaGuardada);
    // al recargar la pagina se vuelve a donde estaba (no a Inicio)
    const vista = leerVista();
    cargarDatosDesdeDB().then(() => {
      if (vista?.scroll) window.scrollTo(0, vista.scroll);
    });
  }

  // antes de recargar o cerrar la pestaña se anota donde estaba
  window.addEventListener('pagehide', guardarVista);

  // al volver a la pestaña (o desbloquear el celular) se trae lo que otros hicieron mientras tanto
  // (y si un admin le cambio el rol o lo desactivo)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recargarSiSePuede();
  });

  // cada minuto: si le cambiaron el rol se nota sin recargar; en Usuarios, tambien los accesos y la actividad de los demas
  setInterval(() => {
    if (!usuario.id || document.visibilityState !== 'visible') return;
    if (estado.seccion === 'Usuarios') return recargarSiSePuede();
    refrescarMiCuenta()
      .then(cambioRol => cambioRol && recargarSiSePuede())
      .catch(error => console.error('No se pudo revisar la cuenta:', error));
  }, 60 * 1000);
}

// ---------- volver a donde estaba al recargar ----------
// se guarda en la pestaña (sessionStorage): sobrevive a recargar, no a cerrarla, y no lo ve otra pestaña
// seccion, filtros, busqueda, orden, scroll y la lista de productos que se estaba armando (las ventanas no)
const claveVista = 'vista';

function guardarVista() {
  if (!usuario.id) return;
  try {
    sessionStorage.setItem(claveVista, JSON.stringify({
      usuarioId: usuario.id,
      seccion: estado.seccion,
      filtro: estado.filtro,
      busqueda: estado.busqueda,
      historialFiltros: estado.historialFiltros,
      donadoresFiltros: estado.donadoresFiltros,
      inventarioFiltros: estado.inventarioFiltros,
      usuarios: estado.usuarios,
      alertasOrden: estado.alertasOrden,
      grafico: estado.grafico,
      lote: estado.lote,
      scroll: window.scrollY,
    }));
  } catch {
    // sin almacenamiento se vuelve a Inicio
  }
}

// solo lo que tiene la forma esperada: lo demas queda como al entrar
function mezclar(actual, guardado) {
  if (!guardado || typeof guardado !== 'object') return actual;
  const limpio = {};
  for (const [campo, valor] of Object.entries(actual)) {
    if (campo in guardado && typeof guardado[campo] === typeof valor) limpio[campo] = guardado[campo];
  }
  return { ...actual, ...limpio };
}

// pone lo guardado en el estado; devuelve lo guardado (o null)
function leerVista() {
  let vista = null;
  try {
    vista = JSON.parse(sessionStorage.getItem(claveVista) ?? 'null');
  } catch {
    return null;
  }
  // de otra cuenta no se usa
  if (!vista || !mismoId(vista.usuarioId, usuario.id)) return null;

  if (typeof vista.seccion === 'string') estado.seccion = vista.seccion;
  if (typeof vista.filtro === 'string') estado.filtro = vista.filtro;
  if (typeof vista.busqueda === 'string') estado.busqueda = limpiarTexto(vista.busqueda).slice(0, largos.busqueda);
  for (const grupo of ['historialFiltros', 'donadoresFiltros', 'inventarioFiltros', 'usuarios', 'alertasOrden', 'grafico']) {
    estado[grupo] = mezclar(estado[grupo], vista[grupo]);
  }
  if (vista.lote && ['Ingreso', 'Salida'].includes(vista.lote.tipo) && Array.isArray(vista.lote.items)) {
    estado.lote = vista.lote;
    // las filas nuevas no repiten id
    siguienteItem = Math.max(siguienteItem, ...vista.lote.items.map(x => Number(x.id) + 1 || 0));
  }
  refrescar();
  return vista;
}

// vuelve a traer todo de la base, sin avisos si falla
// espera a que terminen los guardados pendientes y no lo hace con una ventana abierta
// (las ventanas guardan el producto que muestran; si se cambia por otro, se guardaria sobre uno viejo)
// el panel de actividad si se puede: busca la cuenta por id
let recargando = false;
export async function recargarSiSePuede() {
  const puede = () => usuario.id && pendientes === 0 && (!estado.modal || estado.modal.tipo === 'panel-actividad');
  if (recargando || !puede()) return;
  recargando = true;
  try {
    await cola;
    // se vuelve a revisar al llegar los datos: pudo abrirse una ventana o guardarse algo mientras tanto
    if (puede()) await cargarDatosDesdeDB({ silencioso: true, aplicar: puede });
  } finally {
    recargando = false;
  }
}

export async function iniciarSesion(v) {
  const usuarioTexto = (v['login-usuario'] || v.usuario || v.username || '').trim();
  const clave = (v['login-clave'] || v.clave || v.password || '').trim();

  if (!usuarioTexto) {
    return { error: 'Ingresa tu usuario', campo: 'login-usuario' };
  }
  if (!clave) {
    return { error: 'Ingresa tu contraseña', campo: 'login-clave' };
  }

  try {
    const res = await login(usuarioTexto, clave);

    const cuenta = res.usuario || {
      id: res.id || usuarioTexto,
      nombre: res.nombre || usuarioTexto,
      usuario: usuarioTexto,
      rol: res.rol || 'Usuario'
    };

    entrar(cuenta);
    await cargarDatosDesdeDB();
    return null;
  } catch (err) {
    console.error('Error en login:', err);
    const estadoHttp = err.response?.status;
    // sin respuesta: el servidor no esta prendido o no hay red
    if (!err.response) return { error: 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo otra vez.' };
    if (estadoHttp === 429) return { error: 'Demasiados intentos. Espera un momento antes de volver a intentar.' };
    if (estadoHttp === 401 && /desactivada/i.test(err.response.data?.error ?? '')) {
      return { error: 'Tu cuenta está desactivada. Pide a un administrador que la active.', campo: 'login-usuario' };
    }
    if (estadoHttp >= 500) return { error: 'El servidor tuvo un problema. Inténtalo otra vez en un momento.' };
    return { error: 'Usuario o contraseña incorrectos', campo: 'login-clave' };
  }
}

function entrar(cuenta) {
  Object.assign(usuario, { id: cuenta.id, nombre: cuenta.nombre, rol: cuenta.rol, iniciales: iniciales(cuenta.nombre) });
  guardarSesion(cuenta);

  estado.seccion = 'Inicio';
  estado.filtro = 'Todos';
  estado.busqueda = '';
  estado.modal = null;
  refrescar();
  window.scrollTo(0, 0);
}

export function salir() {
  // el siguiente que entre empieza en Inicio
  try {
    sessionStorage.removeItem(claveVista);
  } catch {
    // sin almacenamiento no hay nada que borrar
  }
  logout(); // Elimina tokens de localStorage
  guardarSesion(null); // Elimina usuario guardado
  Object.assign(usuario, { id: null, nombre: '', iniciales: '', rol: '' });
  // no deja los datos del anterior a la vista del siguiente
  Object.assign(estado, { alimentos: [], salud: [], historial: [], donadores: [], cuentas: [], lote: null });
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
  // ultimo acceso y actividad de cada cuenta al dia
  if (seccion === 'Usuarios') recargarSiSePuede();
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
    // el orden se mantiene
    estado.historialFiltros = { ...filtrosHistorialVacios(), orden: estado.historialFiltros.orden };
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
  const agregados = estado.historial.flatMap(ninosDe).filter(n => !ninos.includes(n));
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

// ---------- campos que se repiten ----------
// para quienes es la salida ([] = uso general)
function leerPara(v) {
  const elegidos = [].concat(v.para ?? []).filter(n => n !== '');
  const lista = opcionesNinos();
  if (elegidos.some(n => n !== 'otro' && !permitido(n, lista))) falla('Elige para quién es de la lista.', 'para');

  const nombres = elegidos.filter(n => n !== 'otro');
  if (elegidos.includes('otro')) {
    const nuevo = leer(v, 'para-otro', reglas.nino);
    // si ya estaba en la lista, se usa ese nombre
    const igual = lista.find(n => n.toLowerCase() === nuevo.toLowerCase());
    nombres.push(igual ?? nuevo);
  }
  return [...new Set(nombres)];
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
// el nombre se guarda con la primera letra de cada palabra en mayuscula
function leerDonadorNuevo(v, campoNombre, campoTelefono) {
  const nombre = nombreDonador(leer(v, campoNombre, reglas.nombreDonador));
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

// el donador de un ingreso: si es nuevo, se crea antes; devuelve su nombre
// si otra persona lo acaba de crear con el mismo nombre, se usa ese (no queda repetido)
async function donadorDeMovimiento(donador) {
  if (!donador.nuevo) return donador.nombre;
  try {
    await crearDonador(donador.nuevo.nombre, donador.nuevo.telefono);
  } catch (err) {
    if (err.response?.status !== 409) throw err;
    await recargarDonadores();
  }
  return donador.nombre;
}

// lo crea en la base y recien ahi lo agrega a la lista
// creadoPorId y creado: con eso sale en la actividad de quien lo agrego (ver logica/actividad.js)
async function crearDonador(nombre, telefono, observaciones = '') {
  const creado = new Date();
  const res = await guardarDonadorAPI({ tipo: 'donador', nombre, telefono, contacto: telefono, observaciones, creado: creado.toISOString() });
  estado.donadores.push({
    id: res.id || res._id, _rev: res.rev || res._rev, tipo: 'donador', nombre, telefono, contacto: telefono, observaciones,
    creadoPor: usuario.nombre, creadoPorId: usuario.id, creado,
  });
  refrescar();
}

async function recargarDonadores() {
  const docs = await getDonadoresAPI();
  if (Array.isArray(docs)) estado.donadores = docs.map(donadorDesdeDoc);
  refrescar();
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
  const para = categoria === 'Salud' && tipo === 'Salida' ? leerPara(v) : [];
  const observaciones = leer(v, 'observaciones', reglas.observaciones);

  let donador = { nombre: '', nuevo: null };
  let actividad = '';
  if (tipo === 'Ingreso') {
    actividad = leerActividad(v);
    donador = elegirDonador(v);
  }

  const plan = tipo === 'Salida' ? planDescuento(item, cantidad) : [];
  return { cantidad, vence, plan, donador, actividad, para, observaciones, esSalud: categoria === 'Salud' };
}

// paso 2: el servidor lo guarda con el stock de ese momento
// si otra persona cambio el producto y ya no alcanza, el aviso sale en la misma ventana (y el AHORA se actualiza)
export async function confirmarMovimiento(modal, datos) {
  if (estado.modal !== modal) return;
  const { item, movimiento: tipo } = modal;
  const donador = await donadorDeMovimiento(datos.donador);
  const fila = await enviarMovimiento(item, {
    tipo: tipo === 'Salida' ? 'salida' : 'ingreso', cantidad: datos.cantidad, vence: datos.vence ?? null,
    donador, actividad: donador ? datos.actividad : '', para: datos.para, observaciones: datos.observaciones,
  });
  agregarAlHistorial(fila);
  if (estado.modal === modal) estado.modal = null;
  mostrarToast(`${tipo === 'Salida' ? 'Salida guardada' : 'Ingreso guardado'} · ${item.nombre}: quedan ${item.cantidad} ${item.unidad}`);
}

// ---------- producto nuevo ----------
// se crea desde un ingreso, cuando lo que entra no esta registrado:
// aqui solo se define (nombre, presentacion, minimo, codigo); cuanto entra, vence y donador van en su fila
// desde: { itemId } para completar esa fila (sin itemId se agrega una), nombre y codigoBarras para empezar
export function abrirProducto(categoria, desde = {}) {
  if (estado.lote?.tipo !== 'Ingreso' || !permitido(categoria, ['Alimentos', 'Salud'])) return;
  abrirModal({ ...desde, tipo: 'producto', categoria });
}

// producto que tiene ese codigo de barras: { item, categoria } o null
export function productoPorCodigo(codigo) {
  for (const categoria of ['Alimentos', 'Salud']) {
    const item = listaDe(categoria).find(i => i.codigosBarras?.includes(codigo));
    if (item) return { item, categoria };
  }
  return null;
}

// codigo de barras que no tenga otro producto
function leerCodigoBarras(v, campo, { opcional = false, delProducto = null } = {}) {
  const codigo = leer(v, campo, opcional ? reglas.codigoBarrasOpcional : reglas.codigoBarras);
  const otro = codigo && productoPorCodigo(codigo);
  if (otro && otro.item !== delProducto) falla(`Ese código ya es de "${otro.item.nombre}".`, campo);
  return codigo;
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

// ---------- nombres de productos con varios tamaños ----------
// el historial, los filtros y las uniones reconocen al producto por su nombre, asi que dos tamaños no pueden llamarse igual
// la regla: si un producto tiene un solo tamaño, el nombre va sin tamaño ("Avena 3 Ositos");
// si tiene varios, TODOS llevan su tamaño ("Leche Evaporada Gloria 400 g" y "Leche Evaporada Gloria 1 L")

// el envase sale de la unidad (latas -> Lata), no hace falta compararlo
function mismaPresentacion(a, b) {
  const igual = (x, y) => String(x ?? '').toLowerCase() === String(y ?? '').toLowerCase();
  return igual(a.unidad, b.unidad) && igual(a.contenido, b.contenido) && igual(a.medida, b.medida);
}

// lo que se agrega al nombre para distinguir presentaciones: envase y tamaño ('bolsa 1 kg', 'lata 400 g'),
// o en que se cuenta si no tiene tamaño fijo ('en sacos', 'en kg')
function sufijoTamano(p) {
  if (!p.contenido) return `en ${p.unidad}`;
  const envase = (p.envase || envaseSingular(p.unidad)).toLowerCase();
  return `${envase} ${redondear(p.contenido)} ${p.medida === 'l' ? 'L' : p.medida}`;
}

// como se nombraban antes ('Arroz a Granel', 'Leche 400 g', 'Leche Lata 400 g'): para reconocer los que ya existen
function sufijosViejos(p) {
  if (!p.contenido) return ['a Granel'];
  const tamano = `${redondear(p.contenido)} ${p.medida === 'l' ? 'L' : p.medida}`;
  return [`${p.envase || envaseSingular(p.unidad)} ${tamano}`, tamano];
}

// el nombre sin su presentacion al final: 'Leche Evaporada Gloria lata 400 g' -> 'Leche Evaporada Gloria'
export function baseDe(nombre, p) {
  for (const sufijo of [sufijoTamano(p), ...sufijosViejos(p)]) {
    if (nombre.toLowerCase().endsWith(` ${sufijo.toLowerCase()}`)) return nombre.slice(0, -sufijo.length - 1);
  }
  return nombre;
}

const mismaBase = (a, b) => palabras(a).join(' ') === palabras(b).join(' ');

// los tamaños que ya hay de ese producto, incluidos los nuevos de la lista: [{ item, categoria, nuevo }]
function familia(base, exceptoItem) {
  const existentes = todosLosProductos().filter(({ item }) => mismaBase(baseDe(item.nombre, item), base)).map(p => ({ ...p, nuevo: false }));
  const enLista = (estado.lote?.items ?? [])
    .filter(x => x.id !== exceptoItem && x.productoNuevo && mismaBase(baseDe(x.productoNuevo.nombre, x.productoNuevo), base))
    .map(x => ({ item: x.productoNuevo, categoria: x.categoria, nuevo: true }));
  return [...existentes, ...enLista];
}

// con que nombre se guardaria un producto nuevo de esa presentacion:
// { nombre, renombrar: [{ item, categoria, nuevo, nombre }] } o { repetido } si ya existe de ese mismo tamaño
export function nombreDisponible(escrito, presentacion, exceptoItem = null) {
  const base = baseDe(formatoNombre(escrito), presentacion);
  const hermanos = familia(base, exceptoItem);
  if (hermanos.length === 0) return { nombre: base, renombrar: [] };

  const repetido = hermanos.find(h => mismaPresentacion(h.item, presentacion));
  if (repetido) return { repetido };

  // el nuevo con su presentacion: 'Arroz bolsa 1 kg'
  const nombre = `${base} ${sufijoTamano(presentacion)}`;

  // los que todavia no la tienen en el nombre (o la tienen a la manera vieja: 'Arroz a Granel'), la reciben
  const renombrar = hermanos
    .map(h => ({ ...h, nombre: `${base} ${sufijoTamano(h.item)}` }))
    .filter(h => !mismaBase(h.item.nombre, h.nombre));
  return { nombre, renombrar };
}

// cambia el nombre de un producto y de sus movimientos (el historial lo reconoce por el nombre)
// el nombre viejo queda en 'unidos': los movimientos guardados en la base lo siguen teniendo y asi no se pierden al recargar
async function renombrarProducto(item, categoria, nombre) {
  const viejo = item.nombre;
  if (viejo === nombre) return;
  const unidos = [...new Set([...(item.unidos || []), viejo])];
  try {
    actualizarProducto(item, await actualizarProductoAPI(item.id, { nombre, unidos }));
  } catch (err) {
    if (motivoDelServidor(err)) throw new Invalido(motivoDelServidor(err));
    throw err;
  }
  for (const fila of estado.historial) {
    if (fila.categoria !== categoria || fila.insumo !== viejo) continue;
    fila.insumoOriginal ??= viejo;
    fila.insumo = nombre;
  }
  if (estado.historialFiltros.producto === viejo) estado.historialFiltros.producto = nombre;
}

// el producto queda en su fila hasta confirmar el ingreso; recien ahi se crea
export function guardarProducto(modal, v) {
  const { categoria } = modal;
  const lote = estado.lote;
  if (lote?.tipo !== 'Ingreso' || !permitido(categoria, ['Alimentos', 'Salud'])) return;

  const escrito = leer(v, 'nombre', reglas.nombreProducto);
  const { unidad, envase, contenido, medida } = leerPresentacion(v, categoria);
  const otros = lote.items.filter(x => x.id !== modal.itemId && x.productoNuevo);

  const libre = nombreDisponible(escrito, { unidad, envase, contenido, medida }, modal.itemId);
  if (libre.repetido) {
    const { item, categoria: suya, nuevo } = libre.repetido;
    falla(nuevo
      ? `"${item.nombre}" de ese tamaño ya se está creando en esta lista.`
      : `Ya existe "${item.nombre}" (${textoPresentacion(item) || `suelto, en ${item.unidad}`}) en ${nombreCategoria(suya)}: elígelo en vez de crearlo otra vez.`, 'nombre');
  }
  const { nombre } = libre;
  for (const r of libre.renombrar) {
    if (!reglas.nombreProducto(r.nombre).ok) falla(`Con su tamaño, "${r.item.nombre}" quedaría "${r.nombre}", que es muy largo: escribe un nombre más corto.`, 'nombre');
  }
  if (!reglas.nombreProducto(nombre).ok) falla(`Con su tamaño el nombre quedaría "${nombre}", que es muy largo: acórtalo.`, 'nombre');
  const minimo = leer(v, 'minimo', cantidadDe(unidad, { que: 'el stock mínimo', puedeSerCero: true }));
  const codigoBarras = leerCodigoBarras(v, 'codigo-barras', { opcional: true });
  if (codigoBarras && otros.some(x => x.productoNuevo.codigosBarras?.includes(codigoBarras))) falla('Ese código ya es de otro producto nuevo de esta lista.', 'codigo-barras');

  // los nuevos de esta lista se renombran ya; los que existen, al confirmar
  for (const r of libre.renombrar) if (r.nuevo) r.item.nombre = r.nombre;

  const productoNuevo = { nombre, codigo: nombre.slice(0, 2).toUpperCase(), envase, contenido, medida, unidad, minimo, cantidad: 0, lotes: [] };
  if (codigoBarras) productoNuevo.codigosBarras = [codigoBarras];

  let x = lote.items.find(i => i.id === modal.itemId);
  if (!x) {
    x = nuevoItem({});
    lote.items.push(x);
  }
  Object.assign(x, { categoria, productoId: null, productoNuevo, dudas: [], avisos: {} });
  abrirItem(x.id, { nuevo: !modal.itemId });
}

// "ya existe algo parecido": se usa ese producto en la fila
export function usarExistente(modal, categoria, id) {
  const item = productoPorId(categoria, id);
  const lote = estado.lote;
  if (!item || !lote) return;
  let x = lote.items.find(i => i.id === modal.itemId);
  if (!x) {
    x = nuevoItem({});
    lote.items.push(x);
  }
  Object.assign(x, { categoria, productoId: item.id, productoNuevo: null, dudas: [], avisos: {} });
  abrirItem(x.id, { nuevo: !modal.itemId });
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
// los que vienen de la base pueden no tener contenido/medida (undefined) y los nuevos los tienen en null: valen igual
function sePuedenUnir(item, otro) {
  const igual = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
  return !mismoId(item.id, otro.id) && igual(otro.unidad, item.unidad) && igual(otro.contenido, item.contenido) && igual(otro.medida, item.medida);
}

// todos los que se pueden unir; primero los de nombre parecido
// (antes solo salian los que compartian una palabra de 4 letras o mas: "Pan" o "Sal" nunca tenian con quien unirse)
export function abrirUnir(categoria, id) {
  if (!esAdmin()) return;
  const item = productoPorId(categoria, id);
  if (!item) return;
  const opciones = listaDe(categoria)
    .filter(o => sePuedenUnir(item, o))
    .map(o => ({ o, comunes: palabrasEnComun(item.nombre, o.nombre) + (coincideNombre(item.nombre, o.nombre) ? 1 : 0) }))
    .sort((a, b) => b.comunes - a.comunes || a.o.nombre.localeCompare(b.o.nombre))
    .map(x => x.o);
  abrirModal({ tipo: 'unir', item, categoria, opciones });
}

// el stock del repetido entra como ajuste del que se queda (lo hace el servidor, todo o nada)
export async function guardarUnion(modal, v) {
  if (!esAdmin()) return;
  const { item, categoria } = modal;
  const lista = listaDe(categoria);
  const destino = lista.find(o => mismoId(o.id, v['unir-con']));
  if (!destino || !sePuedenUnir(item, destino)) falla('Elige con qué producto se une.', 'unir-con');

  let res;
  try {
    res = await unirProductosAPI(item.id, destino.id);
  } catch (err) {
    if (motivoDelServidor(err)) falla(motivoDelServidor(err));
    throw err;
  }
  actualizarProducto(destino, res.destino);
  const i = lista.indexOf(item);
  if (i >= 0) lista.splice(i, 1);
  // sus movimientos pasan a mostrarse con el nombre del que queda
  for (const fila of estado.historial) {
    if (fila.categoria !== categoria || fila.insumo !== item.nombre) continue;
    fila.insumoOriginal ??= item.nombre;
    fila.insumo = destino.nombre;
  }
  if (res.movimiento) agregarAlHistorial(movimientoDesdeDoc(res.movimiento));
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

// paso 2: el servidor ajusta con el stock de ese momento
// si otra persona lo cambio y lo contado ya coincide, se avisa en la ventana
export async function confirmarAjuste(modal, ajuste) {
  if (estado.modal !== modal) return;
  const { item, correccion } = modal;
  const fila = await enviarMovimiento(item, {
    tipo: 'ajuste', contado: ajuste.contado, motivo: ajuste.motivo, nota: ajuste.nota, corrige: correccion?.fila?.id ?? null,
  });
  // el enlace con el ajuste que corrige (el panel del movimiento lo usa)
  if (correccion) fila.corrige = correccion.fila;
  agregarAlHistorial(fila);
  if (estado.modal === modal) estado.modal = null;
  mostrarToast(`Stock ajustado · ${item.nombre}: ${item.cantidad} ${item.unidad}`);
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

// saca los lotes vencidos como una salida (el servidor ve que esta vencido hoy)
export async function confirmarBaja(modal, v) {
  if (estado.modal !== modal) return;
  const { item } = modal;
  const nota = leer(v, 'nota', reglas.nota);
  const fila = await enviarMovimiento(item, { tipo: 'baja', nota });
  agregarAlHistorial(fila);
  if (estado.modal === modal) estado.modal = null;
  mostrarToast(`Dado de baja · ${fila.cantidad} ${item.unidad} de ${item.nombre}`);
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

export async function guardarDonador(v) {
  const { nombre, telefono } = leerDonadorNuevo(v, 'nuevo-nombre', 'nuevo-telefono');
  const observaciones = leer(v, 'nuevo-observaciones', reglas.observaciones);
  try {
    await crearDonador(nombre, telefono, observaciones);
  } catch (err) {
    if (err.response?.status === 409) {
      await recargarDonadores();
      falla(`"${nombre}" ya está registrado (otra persona lo acaba de agregar): elígelo de la lista.`, 'nuevo-nombre');
    }
    throw err;
  }
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
// quien no es admin no tiene la lista de cuentas: su cuenta se arma con lo de la sesion
export function verActividad(id) {
  const esPropio = mismoId(id, usuario.id);
  const cuenta = cuentaPorId(id) ?? (esPropio ? { id: usuario.id, nombre: usuario.nombre, usuario: leerSesion()?.usuario ?? '', rol: usuario.rol, activo: true, ultimoAcceso: null } : null);
  if (!cuenta) return;
  if (!esPropio && !esAdmin()) return;
  abrirModal({ tipo: 'panel-actividad', cuenta });
}

export async function guardarUsuario(v) {
  if (!esAdmin()) return;

  const nombre = leer(v, 'cuenta-nombre', reglas.nombreCuenta);
  const usuarioTexto = leer(v, 'cuenta-usuario', reglas.nombreUsuario);
  const clave = leerClaveNueva(v);
  const rol = v['cuenta-rol'] || 'Usuario';
  if (!permitido(rol, roles)) falla('Elige un rol.', 'cuenta-rol');
  if (estado.cuentas.some(c => c.usuario?.toLowerCase() === usuarioTexto)) falla('Ese usuario ya existe.', 'cuenta-usuario');

  const creado = new Date();
  let res;
  try {
    res = await guardarUsuarioAPI({ nombre, usuario: usuarioTexto, clave, rol, activo: true });
  } catch (err) {
    if (err.response?.status === 409) falla('Ese usuario ya existe.', 'cuenta-usuario');
    errorDelServidor(err, 'clave-nueva');
  }

  // la contraseña no se guarda en la pantalla
  estado.cuentas.push({
    id: res.id || res._id, _rev: res.rev || res._rev,
    nombre, usuario: usuarioTexto, rol, activo: true, creado, creadoPor: usuario.nombre, creadoPorId: usuario.id, ultimoAcceso: null, cambios: [],
  });
  estado.modal = null;
  refrescar();
  mostrarToast(`Usuario creado · ${nombre}`);
}

// cambia el rol o el estado de una cuenta y lo guarda en la base
// solo se manda lo que cambio; el backend lo aplica sobre la version actual (no choca si esa persona entro mientras tanto)
// accion y valor quedan en sus "cambios" para la actividad de quien lo hizo
function actualizarCuenta(c, campo, valor, accion) {
  const antes = c[campo];
  c[campo] = valor;
  c.cambios = [...(c.cambios || []), { accion, valor, quienId: usuario.id, quien: usuario.nombre, fecha: new Date().toISOString() }];
  refrescar();
  guardarEnBD(async () => {
    try {
      const res = await actualizarUsuarioAPI(c.id, { [campo]: valor });
      c._rev = res.rev || res._rev;
    } catch (err) {
      // si no se guardo, la pantalla vuelve a lo que habia (guardarEnBD avisa y recarga)
      c[campo] = antes;
      throw err;
    }
  });
}

// cuentas que el admin puede cambiar: la suya no (se quedaria sin acceso)
// y la principal (el primer administrador) tampoco, nadie
export function sePuedeAdministrar(c) {
  return Boolean(c) && esAdmin() && !mismoId(c.id, usuario.id) && !c.principal;
}

export function cambiarActivo(id) {
  const c = cuentaPorId(id);
  if (!sePuedeAdministrar(c)) return;
  actualizarCuenta(c, 'activo', !c.activo, 'estado');
}

export function cambiarRol(id, nuevoRol) {
  const c = cuentaPorId(id);
  if (!sePuedeAdministrar(c) || !permitido(nuevoRol, roles) || c.rol === nuevoRol) return;
  actualizarCuenta(c, 'rol', nuevoRol, 'rol');
}

// ---------- contraseñas ----------
// contraseña nueva escrita dos veces igual
function leerClaveNueva(v) {
  const clave = leer(v, 'clave-nueva', reglas.claveNueva);
  if ((v['clave-repetida'] ?? '') !== clave) falla('Las contraseñas no coinciden: escribe la misma en los dos campos.', 'clave-repetida');
  return clave;
}

// el error que manda el backend como Invalido, para mostrarlo en el formulario
function errorDelServidor(err, campo) {
  const mensaje = err.response?.data?.error;
  if (err.response?.status === 400 && mensaje) falla(mensaje + '.', campo);
  throw err;
}

// vuelve a la ventana de antes (el panel de la cuenta) o cierra
function volverOCerrar() {
  if (estado.modal?.volver) estado.modal.volver();
  else cerrarModal();
}

// sin cuentaId: la propia
export function abrirClave(cuentaId = null) {
  if (cuentaId && !sePuedeAdministrar(cuentaPorId(cuentaId))) return;
  abrirModal({ tipo: 'clave', cuentaId });
}

export async function cambiarMiClave(v) {
  const actual = v['clave-actual'] ?? '';
  if (!actual) falla('Escribe tu contraseña actual.', 'clave-actual');
  const nueva = leerClaveNueva(v);
  if (nueva === actual) falla('La contraseña nueva tiene que ser distinta de la actual.', 'clave-nueva');
  try {
    await cambiarClaveAPI(actual, nueva);
  } catch (err) {
    if (/actual/i.test(err.response?.data?.error ?? '')) falla('La contraseña actual no es correcta.', 'clave-actual');
    errorDelServidor(err, 'clave-nueva');
  }
  volverOCerrar();
  mostrarToast('Contraseña cambiada');
}

// el admin le pone una contraseña nueva a otra cuenta (la olvido)
export async function restablecerClave(modal, v) {
  const c = cuentaPorId(modal.cuentaId);
  if (!sePuedeAdministrar(c)) return;
  const clave = leerClaveNueva(v);
  try {
    await actualizarUsuarioAPI(c.id, { clave });
  } catch (err) {
    errorDelServidor(err, 'clave-nueva');
  }
  c.cambios = [...(c.cambios || []), { accion: 'clave', valor: true, quienId: usuario.id, quien: usuario.nombre, fecha: new Date().toISOString() }];
  volverOCerrar();
  mostrarToast(`Contraseña de ${c.nombre} cambiada`);
}

// si un admin le cambio el rol (o el nombre) a quien esta usando la app, se actualiza sin volver a entrar
// devuelve true si cambio el rol
async function refrescarMiCuenta() {
  const yo = await getMiCuentaAPI();
  const cambioRol = yo.rol !== usuario.rol;
  if (!cambioRol && yo.nombre === usuario.nombre) return false;
  Object.assign(usuario, { nombre: yo.nombre, rol: yo.rol, iniciales: iniciales(yo.nombre) });
  guardarSesion({ ...leerSesion(), id: yo.id, nombre: yo.nombre, usuario: yo.usuario, rol: yo.rol });
  if (cambioRol && !esAdmin()) {
    // ya no puede ver las cuentas
    estado.cuentas = [];
    if (estado.modal?.tipo === 'panel-actividad' || estado.modal?.tipo === 'usuario') estado.modal = null;
  }
  if (cambioRol) mostrarToast(`Tu rol cambió: ahora eres ${yo.rol}`);
  refrescar();
  return cambioRol;
}

// ---------- boton "+" segun la pestaña ----------
// en Inicio, inventario e Historial deja elegir: registrar varios, producto nuevo, donador...
export function agregar() {
  if (estado.seccion === 'Donadores') abrirModal({ tipo: 'donador' });
  else if (estado.seccion === 'Usuarios') abrirUsuario();
  else abrirModal({ tipo: 'elegir' });
}

export function abrirUsuario() {
  if (esAdmin()) abrirModal({ tipo: 'usuario' });
}

// ---------- registrar varios productos a la vez (a mano, con codigo o con voz) ----------
// estado.lote mientras se arma la lista: { tipo, items }
// cada item (una fila):
//   origen: 'manual' | 'codigo' | 'voz'; dicho: lo que se dijo; codigoBarras: lo escaneado
//   categoria + productoId, o productoNuevo (se crea al confirmar); dudas: claves de productos parecidos
//   cantidad; vence: undefined = falta decidir, null = no tiene fecha
//   donador: '' (compra del hogar), id del donador o 'nuevo' (con donadorNuevo { nombre, telefono })
//   donadorDicho: nombre que se dijo y no se encontro; actividad
//   para, observaciones
//   avisos: { presentacion: { texto, unidad, tamano } } lo dicho que no esta registrado ("bolsas de 10 L"); se quita al editar la fila
//   nombreDicho: palabras del producto, para proponer el nombre si hay que crearlo

let siguienteItem = 1;

function nuevoItem(datos) {
  return {
    id: siguienteItem++, origen: 'manual', categoria: null, productoId: null, productoNuevo: null, dudas: [], cantidad: null, vence: undefined,
    donador: '', donadorNuevo: null, donadorDicho: '', actividad: '', para: [], observaciones: '', dicho: '', nombreDicho: '', codigoBarras: '', avisos: {},
    ...datos,
  };
}

// 'Alimentos:3' identifica un producto en los desplegables; 'nuevo' es el producto que se esta creando
export const claveProducto = (categoria, id) => `${categoria}:${id}`;

export function productoPorClave(clave) {
  const corte = String(clave).indexOf(':');
  if (corte < 0) return null;
  const categoria = clave.slice(0, corte);
  if (!permitido(categoria, ['Alimentos', 'Salud'])) return null;
  const item = productoPorId(categoria, clave.slice(corte + 1));
  return item ? { item, categoria } : null;
}

export function todosLosProductos() {
  return [...estado.alimentos.map(item => ({ item, categoria: 'Alimentos' })), ...estado.salud.map(item => ({ item, categoria: 'Salud' }))];
}

// { item, categoria, nuevo } o null si todavia no se sabe que producto es
export function productoDeItem(x) {
  if (x.productoNuevo) return { item: x.productoNuevo, categoria: x.categoria, nuevo: true };
  if (x.productoId == null) return null;
  const item = productoPorId(x.categoria, x.productoId);
  return item ? { item, categoria: x.categoria, nuevo: false } : null;
}

export function nombreItem(x) {
  const producto = productoDeItem(x);
  if (producto) return producto.item.nombre;
  if (x.dicho) return `"${x.dicho}"`;
  return `Código ${x.codigoBarras}`;
}

// nombre del donador de una fila ('' si es compra del hogar)
export function donadorDeItem(x) {
  if (x.donador === 'nuevo') return x.donadorNuevo?.nombre ?? '';
  if (!x.donador) return '';
  return estado.donadores.find(d => mismoId(d.id, x.donador))?.nombre ?? '';
}

function filasDelMismo(x) {
  return estado.lote.items.filter(o => o.productoId != null && !o.productoNuevo && o.categoria === x.categoria && mismoId(o.productoId, x.productoId));
}

// lo que falta corregir en una fila (vacio si esta lista)
// lo que falta corregir en una fila; primero, si el servidor la rechazo al guardar
export function problemasItem(x) {
  return [...(x.errorServidor ? [x.errorServidor] : []), ...problemasDeFila(x)];
}

function problemasDeFila(x) {
  const { tipo } = estado.lote;
  const producto = productoDeItem(x);
  // avisos cortos: arriba de la lista se explica que se corrigen con el lapiz
  if (!producto) {
    if (x.dudas.length) return [`¿Cuál es? ${x.dudas.map(c => productoPorClave(c)?.item.nombre).filter(Boolean).join(' o ')}`];
    if (!x.dicho) return ['Código sin producto'];
    return ['No está en los productos'];
  }

  const { item } = producto;
  const problemas = [];
  // lo dicho que no esta registrado (se quita al guardar la fila)
  const otra = x.avisos.presentacion;
  if (otra) problemas.push(`No está registrada ${otra.texto.startsWith('de ') ? '' : 'en '}${otra.texto}`);
  if (x.cantidad == null) problemas.push('Falta la cantidad');
  else if (!otra) {
    const r = cantidadDe(item.unidad)(String(x.cantidad));
    if (!r.ok) problemas.push(r.error);
  }
  if (tipo === 'Ingreso') {
    if (x.vence === undefined) problemas.push('Falta la fecha de vencimiento');
    if (x.donadorDicho && !x.donador) problemas.push(`Donador "${x.donadorDicho}" no registrado`);
    if (x.donador && !x.actividad) problemas.push('Falta la actividad de la donación');
    // "donacion libre" sin decir quien: es una donacion, falta el donador
    if (!x.donador && !x.donadorDicho && x.actividad) problemas.push(`Dijiste "${x.actividad}": falta el donador`);
  }
  if (tipo === 'Salida' && x.cantidad) {
    const filas = filasDelMismo(x);
    const total = redondear(filas.reduce((s, o) => s + (o.cantidad || 0), 0));
    if (total > disponible(item)) problemas.push(`Solo hay ${disponible(item)} ${item.unidad}${filas.length > 1 ? ` (en la lista suman ${total})` : ''}`);
  }
  return problemas;
}

// ---------- abrir y moverse entre pantallas ----------
// empieza una lista; si ya habia una del mismo tipo, sigue con esa
export function empezarLote(tipo) {
  if (!permitido(tipo, ['Ingreso', 'Salida'])) return;
  if (estado.lote?.tipo !== tipo) estado.lote = { tipo, items: [] };
  if (estado.lote.items.length) abrirLista();
  else abrirBusqueda();
}

// el microfono junto al "+": ingreso o salida se sabe por lo que se diga (agregarDictado)
export function empezarDictado() {
  abrirModal({ tipo: 'lote-voz', volver: estado.lote?.items.length ? abrirLista : null, alCerrar: cerrarLote });
}

export function descartarLote() {
  estado.lote = null;
  estado.modal = null;
  mostrarToast('Lista descartada');
}

// cerrar con × o fuera de la ventana: la lista no se pierde, sigue en el boton "+"
function cerrarLote() {
  estado.modal = null;
  if (estado.lote?.items.length) mostrarToast('La lista quedó guardada: la encuentras en el botón +');
  else {
    estado.lote = null;
    refrescar();
  }
}

export function abrirLista() {
  if (estado.lote) abrirModal({ tipo: 'lote-lista', volver: null, alCerrar: cerrarLote });
}

// volver desde la busqueda: a la lista, o al menu "+" si todavia no hay nada
export function abrirBusqueda() {
  if (!estado.lote) return;
  const volver = () => {
    if (estado.lote?.items.length) return abrirLista();
    estado.lote = null;
    abrirModal({ tipo: 'elegir', volver: null });
  };
  abrirModal({ tipo: 'lote-manual', volver, alCerrar: cerrarLote });
}

export function abrirCodigo() {
  if (estado.lote) abrirModal({ tipo: 'lote-codigo', volver: abrirBusqueda, alCerrar: cerrarLote });
}

// ---------- agregar a la lista ----------
// a mano: se agrega y se abre para poner la cantidad
export function agregarManual(categoria, id) {
  const item = productoPorId(categoria, id);
  if (!item || !estado.lote) return;
  // en una salida, lo que no tiene stock no se puede elegir
  if (estado.lote.tipo === 'Salida' && disponible(item) <= 0) {
    mostrarToast(`"${item.nombre}" no tiene stock para sacar`);
    return;
  }
  const x = nuevoItem({ categoria, productoId: item.id });
  estado.lote.items.push(x);
  abrirItem(x.id, { nuevo: true });
}

// codigo escaneado o escrito; el mismo codigo otra vez suma 1
// devuelve el nombre del producto o null si el codigo no esta registrado
export function agregarCodigo(texto) {
  if (!estado.lote) return null;
  const codigo = leer({ codigo: texto }, 'codigo', reglas.codigoBarras);
  const encontrado = productoPorCodigo(codigo);
  const repetido = estado.lote.items.find(x => x.origen === 'codigo' && x.codigoBarras === codigo);
  const nueva = redondear((repetido?.cantidad ?? 0) + 1);
  if (nueva > cantidadMaxima) falla(`No se puede pasar de ${cantidadMaxima}.`, 'codigo');
  // en una salida no se escanea lo que no hay (cuenta lo que ya va en otras filas de ese producto)
  if (encontrado && estado.lote.tipo === 'Salida') {
    const { item, categoria } = encontrado;
    const hay = disponible(item);
    const enLista = redondear(filasDelMismo({ categoria, productoId: item.id }).reduce((s, o) => s + (o.cantidad || 0), 0));
    if (hay <= 0) falla(`"${item.nombre}" no tiene stock para sacar.`, 'codigo');
    if (enLista + 1 > hay) falla(`Solo hay ${hay} ${item.unidad} de "${item.nombre}" y ya van ${enLista} en la lista.`, 'codigo');
  }
  if (repetido) repetido.cantidad = nueva;
  else {
    estado.lote.items.push(nuevoItem({
      origen: 'codigo',
      codigoBarras: codigo,
      cantidad: 1,
      ...(encontrado && { categoria: encontrado.categoria, productoId: encontrado.item.id }),
    }));
  }
  refrescar();
  return encontrado ? encontrado.item.nombre : null;
}

// cantidad entendida de lo que se dijo: un numero mayor que 0 y dentro del tope, o null
// (los decimales de mas no se quitan aqui: la fila avisa "tiene que ser entero")
export function cantidadDicha(valor) {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= cantidadMaxima ? redondear(n) : null;
}


export async function agregarDictado(v) {
  // 1. Validar el tipo de operación dicho en voz ("ingreso" o "salida")
  const dicho = tipoDictado(leer(v, 'dictado', reglas.dictado));
  const abierta = estado.lote?.items.length ? estado.lote.tipo : null;

  // 2. Parser Local: Extrae donadores y actividades dinámicas desde CouchDB / Estado actual
  const interpretadoLocal = interpretarDictado(dicho.resto, todosLosProductos(), { 
    donadores: estado.donadores, 
    actividades: opcionesActividad() 
  });

  // 3. OmniRoute (LLM): Parsing de alta precisión para productos, cantidades y fechas ISO
  const itemsProcesados = await procesarTextoConOmniroute(v.dictado);

  // --- FILTRO POST-PROCESADO: Anti-alucinaciones y limpieza de ruido ---
  const ruídosComunes = new Set(['eh', 'um', 'ah', 'pantalla', 'ruido', 'undefined', 'null', 'algo', 'cosa']);
  const itemsValidos = itemsProcesados.filter(item => {
    if (!item.producto || typeof item.producto !== 'string') return false;
    const nombreLimpio = item.producto.trim().toLowerCase();
    
    // Descarte de palabras vacías/incoherentes de 1 sola letra o de la lista de ruido
    if (nombreLimpio.length < 2) return false;
    if (ruídosComunes.has(nombreLimpio)) return false;

    return true;
  });

  // Determinar la operación dominante (Ingreso vs Salida)
  if (dicho.ambos) {
    falla('Dijiste ingreso y salida: registra uno a la vez.', 'dictado');
  }
  // 1. lo dicho, 2. lo que entendio la IA, 3. la lista que ya esta abierta
  const tipoIA = { salida: 'Salida', ingreso: 'Ingreso' }[itemsValidos[0]?.tipo] ?? null;
  const tipo = dicho.tipo ?? abierta ?? tipoIA;
  if (!tipo) {
    falla('Falta decir si es ingreso o salida. Por ejemplo: "ingreso de dos kilos de arroz".', 'dictado');
  }
  if (abierta && tipo !== abierta) {
    falla(`Tienes una lista de ${abierta.toLowerCase()} sin guardar: confírmala o descártala primero.`, 'dictado');
  }

  if (!abierta) estado.lote = { tipo, items: [] };
  const lote = estado.lote;
  const esIngreso = tipo === 'Ingreso';

  // Usar la lista filtrada de la IA como base principal; si falló por completo, usar el parser local
  const listaBase = itemsValidos.length > 0 ? itemsValidos : interpretadoLocal;

  if (listaBase.length === 0) {
    falla('No se pudo reconocer ningún producto claro en el dictado. Intenta nuevamente.', 'dictado');
  }

  // 4. Mapeo final y fusión de metadatos (Híbrido IA + Local)
  for (let i = 0; i < listaBase.length; i++) {
    const itemIA = itemsValidos[i] || {};
    const r = interpretadoLocal[i] || interpretadoLocal[0] || {};

    // 💡 Prioridad de Fecha: 1. Fecha ISO de OmniRoute, 2. Regex del Parser Local
    const fechaFinal = itemIA.vence || (r.vence && reglas.vencimiento(r.vence).ok ? r.vence : null);

    // 💡 Mapeo de Donador: 1. Donador ID desde la BD local, 2. Texto del donador dicho
    const donadorId = r.donador ? String(r.donador.id) : '';
    const donadorTexto = r.donadorDicho || itemIA.donador || '';
    const actividadTexto = r.actividad || itemIA.actividad || '';

    lote.items.push(nuevoItem({
      origen: 'voz',
      dicho: (itemIA.producto || r.dicho || '').slice(0, 100),
      nombreDicho: (itemIA.producto || r.nombreDicho || '').slice(0, largos.nombreProducto),
      cantidad: cantidadDicha(itemIA.cantidad ?? r.cantidad),
      dudas: r.dudas ? r.dudas.map(d => claveProducto(d.categoria, d.item.id)) : [],
      avisos: r.presentacion ? { presentacion: r.presentacion } : {},
      
      // Metadatos adjuntos para rendering visual (previsualización y lista final)
      ...(esIngreso && fechaFinal && { vence: fechaFinal }),
      ...(r.producto && { categoria: r.producto.categoria, productoId: r.producto.item.id }),
      ...(esIngreso && {
        donador: donadorId,
        donadorDicho: donadorTexto.slice(0, largos.nombreDonador),
        actividad: actividadTexto,
      }),
    }));
  }

  abrirLista();
}
// ---------- editar o quitar una fila ----------
// nuevo: si se vuelve sin guardar, la fila se quita y se regresa a donde se eligio (la busqueda)
export function abrirItem(id, { nuevo = false } = {}) {
  if (!estado.lote?.items.some(x => x.id === id)) return;
  const anterior = estado.modal;
  const volver = () => {
    if (nuevo) {
      estado.lote.items = estado.lote.items.filter(x => x.id !== id);
      if (anterior) return abrirModal({ ...anterior, volver: anterior.volver ?? null });
    }
    if (estado.lote.items.length) abrirLista();
    else abrirBusqueda();
  };
  abrirModal({ tipo: 'lote-item', itemId: id, volver, alCerrar: volver });
}

export function quitarItem(id) {
  if (!estado.lote) return;
  estado.lote.items = estado.lote.items.filter(x => x.id !== id);
  refrescar();
}

// donador de una fila: { donador, donadorNuevo, actividad }
function leerDonadorItem(v, x) {
  const elegido = v.donador ?? '';
  if (elegido === '') return { donador: '', donadorNuevo: null, actividad: '' };
  if (elegido !== 'nuevo') {
    if (!estado.donadores.some(d => mismoId(d.id, elegido))) falla('Elige el donador de la lista.', 'donador');
    return { donador: elegido, donadorNuevo: null, actividad: leerActividad(v) };
  }
  // un donador nuevo puede repetirse en otras filas de la misma lista: se crea una vez
  const { nombre, telefono } = leerDonadorNuevo(v, 'donador-nombre', 'donador-telefono');
  const enOtraFila = estado.lote.items.find(o => o !== x && o.donadorNuevo && o.donadorNuevo.nombre.toLowerCase() === nombre.toLowerCase());
  if (enOtraFila && enOtraFila.donadorNuevo.telefono !== telefono) falla(`"${nombre}" ya está en otra fila con otro número.`, 'donador-telefono');
  return { donador: 'nuevo', donadorNuevo: { nombre, telefono }, actividad: leerActividad(v) };
}

export function guardarItem(modal, v) {
  const lote = estado.lote;
  const x = lote?.items.find(i => i.id === modal.itemId);
  if (!x) return;
  const esIngreso = lote.tipo === 'Ingreso';

  // 'nuevo' deja el producto que se esta creando
  const clave = v.producto ?? '';
  const elegido = clave === 'nuevo' && x.productoNuevo ? { item: x.productoNuevo, categoria: x.categoria, nuevo: true } : productoPorClave(clave);
  if (!elegido) falla('Elige qué producto es.', 'producto');
  const { item, categoria } = elegido;

  // el codigo escaneado se le guardara a este producto
  const duenoCodigo = x.codigoBarras && productoPorCodigo(x.codigoBarras);
  if (duenoCodigo && duenoCodigo.item !== item) falla(`El código ${x.codigoBarras} es de "${duenoCodigo.item.nombre}".`, 'producto');

  const cantidad = leer(v, 'cantidad', cantidadDe(item.unidad));
  if (!esIngreso) {
    const otras = redondear(filasDelMismo({ categoria, productoId: item.id }).filter(o => o !== x).reduce((s, o) => s + (o.cantidad || 0), 0));
    if (cantidad + otras > disponible(item)) {
      falla(`Solo se pueden sacar ${disponible(item)} ${item.unidad}${otras ? ` y en otras filas ya van ${otras}` : ''}.`, 'cantidad');
    }
  }
  const vence = esIngreso ? leerVencimiento(v) : undefined;
  const donador = esIngreso ? leerDonadorItem(v, x) : { donador: '', donadorNuevo: null, actividad: '' };
  const para = !esIngreso && categoria === 'Salud' ? leerPara(v) : [];
  const observaciones = leer(v, 'observaciones', reglas.observaciones);

  Object.assign(x, {
    categoria, productoId: elegido.nuevo ? null : item.id, productoNuevo: elegido.nuevo ? x.productoNuevo : null, cantidad, vence, ...donador, donadorDicho: '', para, observaciones, dudas: [], avisos: {}, errorServidor: '',
  });

  abrirLista();
}

// ---------- revisar y guardar todo ----------
// paso 1: todas las filas listas
export function revisarLote() {
  const lote = estado.lote;
  if (!lote) return;
  // lo que rechazo el servidor la vez anterior se vuelve a intentar
  for (const x of lote.items) x.errorServidor = '';
  if (lote.items.length === 0) falla('La lista está vacía: añade al menos un producto.');
  for (const x of lote.items) {
    const problemas = problemasItem(x);
    if (problemas.length) falla(`${nombreItem(x)}: ${problemas[0]}. Corrígelo con el lápiz.`);
    // la fecha pudo pasar mientras se armaba la lista
    if (x.vence) {
      const r = reglas.vencimiento(x.vence);
      if (!r.ok) falla(`${nombreItem(x)}: ${r.error}`);
    }
  }
}

// paso 2: guarda las filas una por una en el servidor
// las que el servidor rechaza (otra persona saco antes, ya no existe...) quedan en la lista con el motivo;
// las demas se guardan igual
export async function confirmarLote(modal) {
  if (estado.modal !== modal || !estado.lote) return;
  const lote = estado.lote;
  const { tipo } = lote;
  // donadores y productos nuevos se crean una sola vez aunque esten en varias filas
  const donadoresNuevos = new Map();
  const productosNuevos = new Map();
  const fallidas = [];
  const total = lote.items.length;

  for (const x of [...lote.items]) {
    try {
      let { item, categoria, nuevo } = productoDeItem(x);
      if (nuevo) {
        if (!productosNuevos.has(x.productoNuevo)) {
          // los otros tamaños que todavia no lo tienen reciben su presentacion en el nombre
          const { renombrar = [] } = nombreDisponible(x.productoNuevo.nombre, x.productoNuevo, x.id);
          for (const r of renombrar) if (!r.nuevo) await renombrarProducto(r.item, r.categoria, r.nombre);
          productosNuevos.set(x.productoNuevo, await crearProductoBD(x.productoNuevo, categoria));
        }
        item = productosNuevos.get(x.productoNuevo);
      }

      let donador = '';
      if (tipo === 'Ingreso' && x.donador === 'nuevo') {
        const clave = x.donadorNuevo.nombre.toLowerCase();
        if (!donadoresNuevos.has(clave)) donadoresNuevos.set(clave, await donadorDeMovimiento({ nombre: x.donadorNuevo.nombre, nuevo: x.donadorNuevo }));
        donador = donadoresNuevos.get(clave);
      } else if (tipo === 'Ingreso') donador = donadorDeItem(x);

      const fila = await enviarMovimiento(item, {
        tipo: tipo === 'Salida' ? 'salida' : 'ingreso', cantidad: x.cantidad, vence: x.vence ?? null,
        donador, actividad: donador ? x.actividad : '', para: x.para, observaciones: x.observaciones, canal: x.origen, inicial: nuevo,
        // la proxima vez el codigo ya se reconoce
        ...(x.codigoBarras && !productoPorCodigo(x.codigoBarras) && { codigo_barras: x.codigoBarras }),
      });
      agregarAlHistorial(fila);
      lote.items = lote.items.filter(o => o !== x);
    } catch (err) {
      if (!(err instanceof Invalido)) console.error('No se pudo guardar una fila:', err);
      x.errorServidor = err instanceof Invalido ? err.message.replace(/\.$/, '') : 'No se pudo guardar: revisa la conexión';
      fallidas.push(x);
    }
  }

  // lo que ya se creo no se vuelve a crear al reintentar
  for (const x of fallidas) {
    const creado = x.productoNuevo && productosNuevos.get(x.productoNuevo);
    if (creado) Object.assign(x, { productoId: creado.id, productoNuevo: null });
    const donadorCreado = x.donador === 'nuevo' && estado.donadores.find(d => d.nombre.toLowerCase() === x.donadorNuevo.nombre.toLowerCase());
    if (donadorCreado) Object.assign(x, { donador: String(donadorCreado.id), donadorNuevo: null });
  }

  const productos = n => `${n} ${n === 1 ? 'producto' : 'productos'}`;
  if (!fallidas.length) {
    estado.lote = null;
    if (estado.modal === modal) estado.modal = null;
    estado.filtro = 'Todos';
    mostrarToast(`${tipo === 'Salida' ? 'Salida guardada' : 'Ingreso guardado'} · ${productos(total)}`);
    return;
  }
  lote.items = fallidas;
  const guardadas = total - fallidas.length;
  mostrarToast(`${guardadas ? `Se guardaron ${productos(guardadas)}; ` : ''}${fallidas.length === 1 ? '1 no se guardó' : `${fallidas.length} no se guardaron`}: el motivo está en su fila`);
  abrirLista();
}

// cada movimiento muestra el nombre que el producto tiene hoy, no con el que se registro
// (si se renombro, el historial no lo mostraria como otro producto)
// se busca por producto_id; los de un producto que se unio a otro (ya borrado), por los nombres en 'unidos'
// el nombre de cuando se registro queda en insumoOriginal (no se cambia nada en la base)
function conNombreActual(historial) {
  const productos = todosLosProductos();
  for (const fila of historial) {
    const actual = productos.find(({ item }) => mismoId(item.id, fila.producto_id))
      ?? productos.find(({ item, categoria }) => categoria === fila.categoria && item.unidos?.includes(fila.insumo));
    if (actual && actual.item.nombre !== fila.insumo) {
      fila.insumoOriginal = fila.insumo;
      fila.insumo = actual.item.nombre;
    }
  }
}

// silencioso: sin aviso si no hay conexion (las recargas automaticas)
// aplicar: se pregunta al llegar los datos; si devuelve false no se cambia nada
export async function cargarDatosDesdeDB({ silencioso = false, aplicar = () => true } = {}) {
  try {
    // primero el rol actual: de eso depende si se piden las cuentas
    await refrescarMiCuenta().catch(error => console.error('No se pudo revisar la cuenta:', error));

    const resultados = await Promise.allSettled([
      getInventario(),
      getHistorialAPI(),
      getDonadoresAPI(),
      esAdmin() ? getUsuariosAPI() : Promise.resolve(null),
    ]);

    // si algo falla se avisa (lo que no cargo queda como estaba)
    if (!silencioso && resultados.some(r => r.status === 'rejected')) {
      mostrarToast('No se pudo conectar con el servidor. Algunos datos no se cargaron.');
    }
    if (!aplicar()) return;
    const [respuestaInv, respuestaHist, respuestaDon, respuestaUsu] = resultados.map(r => (r.status === 'fulfilled' ? r.value : null));

    if (respuestaInv) {
      const documentos = Array.isArray(respuestaInv) ? respuestaInv : (respuestaInv.docs || []);
      const formateados = documentos.map(productoDesdeDoc);

      const saludDB = formateados.filter(doc => 
        (doc.almacen && (doc.almacen.includes('medicinas') || doc.almacen.includes('higiene'))) || 
        ['medicinas', 'higiene', 'salud'].includes((doc.categoriaNombre || '').toLowerCase())
      );
      estado.alimentos = formateados.filter(doc => !saludDB.includes(doc));
      estado.salud = saludDB;
    }

    // historial
    if (Array.isArray(respuestaHist)) {
      const historial = respuestaHist.map(movimientoDesdeDoc);
      // lo mas nuevo primero: CouchDB no los devuelve en orden, y varias partes cuentan con eso
      // (los ultimos movimientos, "lo que paso entre dos ajustes")
      estado.historial = historial.sort((a, b) => momento(b) - momento(a));
      conNombreActual(estado.historial);
      // el ajuste que corrige a otro guarda su id: se enlaza con ese movimiento (los viejos guardaban el movimiento entero)
      for (const fila of estado.historial) {
        if (!fila.corrige) continue;
        const id = typeof fila.corrige === 'object' ? fila.corrige._id ?? fila.corrige.id : fila.corrige;
        fila.corrige = estado.historial.find(o => mismoId(o.id, id)) ?? null;
      }
    }

    // donadores
    if (Array.isArray(respuestaDon)) {
      estado.donadores = respuestaDon.map(donadorDesdeDoc);
    }

    // cuentas de usuario
    if (Array.isArray(respuestaUsu)) {
      estado.cuentas = respuestaUsu.map(doc => ({
        ...doc,
        id: doc._id || doc.id,
        _rev: doc._rev,
        nombre: doc.nombre || '',
        usuario: doc.usuario || doc.username || '',
        rol: doc.rol || 'Usuario',
        activo: doc.activo ?? true,
        ultimoAcceso: doc.ultimoAcceso ? new Date(doc.ultimoAcceso) : null,
        creado: doc.creado ? new Date(doc.creado) : null,
        creadoPor: doc.creadoPor || '',
        // cambios de rol y estado que se le hicieron (con quien los hizo)
        cambios: Array.isArray(doc.cambios) ? doc.cambios : []
      }));
    }

    refrescar();
  } catch (error) {
    console.error('Error al actualizar el estado con datos de CouchDB:', error);
  }
}