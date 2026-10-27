// lo que hace la app: guardar, cambiar el estado, abrir ventanas
import { 
  login, 
  logout,
  getInventario, 
  guardarProductoAPI, 
  actualizarProductoAPI, 
  getHistorialAPI, 
  registrarMovimientoAPI,
  getDonadoresAPI,
  guardarDonadorAPI,
  getUsuariosAPI,
  guardarUsuarioAPI,
  actualizarUsuarioAPI
} from './servicios/api.js';
// los formularios mandan sus valores como objeto { campo: texto }; si algo no pasa la validacion se lanza Invalido
import { estado, refrescar } from './estado.js';
import { usuario, actividadesDonacion, ninos } from './data/datos.js';
import { reglas, cantidadDe, numero as reglaNumero, opcion, limpiarTexto, fechaFiltro, largos } from './validacion.js';
import {
  iniciales, nombreCategoria, motivoCorreccion, motivosAjuste, movimientosEntre, palabras, coincideNombre, palabrasEnComun,
  pluralizar, envaseSingular, mismoId, redondear, fechaActual, ninosDe, textoPresentacion, formatoNombre,
} from './logica/comunes.js';
import { planDescuento, descontar, nuevoLote, disponible, cantidadVencida, lotesVencidos } from './logica/lotes.js';
import { inventarioVacio } from './logica/inventario.js';
import { filtrarHistorial, filtrosHistorialVacios } from './logica/historial.js';
import { listaDonadores, actividadesDe } from './logica/donadores.js';
import { descargarHistorial, nombreArchivoHistorial, descargarDonadores, nombreArchivoDonadores } from './logica/exportar.js';
import { interpretarDictado } from './logica/dictado.js';

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
  }
}

export function iniciar() {
  const token = localStorage.getItem('access_token');
  const cuentaGuardada = leerSesion();
  estado.menuFijo = leerMenuFijo();

  if (token && cuentaGuardada) {
    entrar(cuentaGuardada);
    cargarDatosDesdeDB();
  }
}

// 5 intentos fallidos: esperar 30 segundos
const intentos = { fallidos: 0, esperarHasta: 0 };

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
  logout(); // Elimina tokens de localStorage
  guardarSesion(null); // Elimina usuario guardado
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

// varios en el mismo momento no repiten id
let siguienteDonador = 0;
function nuevoDonador(nombre, telefono) {
  registrarActividad('donador', 'Agregó donador', nombre);
  const fechaCreado = new Date();

  // Objeto en memoria para React (con fecha como Date)
  const donadorObjeto = {
    id: Date.now() + siguienteDonador++,
    tipo: 'donador',
    nombre,
    telefono,
    contacto: telefono,
    creadoPor: usuario.nombre,
    creadoPorId: usuario.id,
    creado: fechaCreado
  };

  // Objeto serializado para CouchDB (con fecha como String)
  const donadorDocBD = {
    ...donadorObjeto,
    creado: fechaCreado.toISOString()
  };

  guardarDonadorAPI(donadorDocBD)
    .then(res => {
      if (res?.id || res?._id) {
        donadorObjeto.id = res.id || res._id;
        donadorObjeto._rev = res.rev || res._rev;
      }
    })
    .catch(err => console.error('Error al guardar donador en CouchDB:', err));

  return donadorObjeto;
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

// paso 2: guarda el movimiento
export async function confirmarMovimiento(modal, datos) {
  if (estado.modal !== modal) return;
  const { item, categoria, movimiento: tipo } = modal;
  const donador = guardarDonadorElegido(datos.donador);
  estado.modal = null;
  mostrarToast(`${tipo === 'Salida' ? 'Salida guardada' : 'Ingreso guardado'} · ${item.nombre}`);
  await registrarMovimiento({ ...datos, item, categoria, tipo, donador });
}

// cambia el stock y anota el movimiento (ya validado)
// plan: de que lotes sale; si no viene, se calcula ahora
// inicial: primer ingreso de un producto nuevo
async function registrarMovimiento({ item, categoria, tipo, cantidad, vence = null, plan, donador = '', actividad = '', para = [], observaciones = '', inicial = false }) {
  const usados = tipo === 'Salida' ? descontar(plan ?? planDescuento(item, cantidad)) : null;
  item.cantidad = redondear(item.cantidad + (tipo === 'Ingreso' ? cantidad : -cantidad));
  const lote = tipo === 'Ingreso' ? nuevoLote(item, { cantidad, vence }) : null;

  // Formato compatible con React y con la BD
  const catNormalizada = categoria.toLowerCase() === 'salud' ? 'Salud' : 'Alimentos';
  const tipoNormalizado = tipo.charAt(0).toUpperCase() + tipo.slice(1).toLowerCase();

  const movimientoDoc = {
    tipo: 'movimiento',
    producto_id: item.id || null,
    tipo_movimiento: tipoNormalizado.toLowerCase(), // 'ingreso' | 'salida'
    movimiento: tipoNormalizado,                   // 'Ingreso' | 'Salida'
    insumo: item.nombre,
    categoria: catNormalizada,
    cantidad,
    unidad: item.unidad,
    fecha: fechaActual(),
    canal: 'manual',
    usuario_id: usuario.id || usuario.nombre,
    responsable: usuario.nombre,
    donador,
    actividad,
    para,
    observaciones,
    saldo: item.cantidad,
    ...(inicial && { inicial: true }),
    ...(lote ? { loteId: lote.id, vence: lote.vence } : { lotes: usados }),
  };

  estado.historial.unshift(movimientoDoc);
  refrescar();

  try {
    const yaExisteEnDB = Boolean(item.id && typeof item.id === 'string' && item._rev);

    if (yaExisteEnDB && item._rev) {
      const productoDoc = {
        _id: item.id,
        _rev: item._rev,
        tipo: 'producto',
        nombre: item.nombre,
        categoria: catNormalizada.toLowerCase(),
        cantidad: item.cantidad,
        unidad: item.unidad,
        stock_minimo: item.minimo || 0,
        lotes: item.lotes || []
      };
      const res = await actualizarProductoAPI(item.id, productoDoc);
      if (res?.rev || res?._rev) item._rev = res.rev || res._rev;
    } else {
      const productoNuevoDoc = {
        tipo: 'producto',
        nombre: item.nombre,
        categoria: catNormalizada.toLowerCase(),
        cantidad: item.cantidad,
        unidad: item.unidad,
        stock_minimo: item.minimo || 0,
        lotes: item.lotes || []
      };
      const res = await guardarProductoAPI(productoNuevoDoc);
      
      if (res?.id || res?._id) {
        item.id = res.id || res._id;
        item._rev = res.rev || res._rev;
        movimientoDoc.producto_id = item.id;
      }
    }

    await registrarMovimientoAPI(movimientoDoc);
  } catch (error) {
    console.error('Error al guardar en CouchDB:', error);
  }
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

// lo que se agrega al nombre: '400 g', o 'Bolsa 1 L' si hace falta distinguir el envase; suelto: 'a Granel'
function sufijoTamano(p, conEnvase = false) {
  if (!p.contenido) return 'a Granel';
  const envase = p.envase || envaseSingular(p.unidad);
  return `${conEnvase && envase ? `${envase} ` : ''}${redondear(p.contenido)} ${p.medida === 'l' ? 'L' : p.medida}`;
}

// el nombre sin su tamaño al final: 'Leche Evaporada Gloria 400 g' -> 'Leche Evaporada Gloria'
function baseDe(nombre, p) {
  for (const sufijo of [sufijoTamano(p, true), sufijoTamano(p)]) {
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

  // el nuevo con su tamaño; si otro ya se llama asi (mismo tamaño, otro envase), se agrega el envase
  let nombre = `${base} ${sufijoTamano(presentacion)}`;
  if (hermanos.some(h => mismaBase(h.item.nombre, nombre))) nombre = `${base} ${sufijoTamano(presentacion, true)}`;

  // los que todavia no tienen el tamaño en el nombre, lo reciben
  const renombrar = hermanos
    .filter(h => mismaBase(h.item.nombre, base))
    .map(h => {
      const suyo = `${base} ${sufijoTamano(h.item)}`;
      return { ...h, nombre: mismaBase(suyo, nombre) ? `${base} ${sufijoTamano(h.item, true)}` : suyo };
    });
  return { nombre, renombrar };
}

// cambia el nombre de un producto y de sus movimientos (el historial lo reconoce por el nombre)
function renombrarProducto(item, categoria, nombre) {
  const viejo = item.nombre;
  if (viejo === nombre) return;
  for (const fila of estado.historial) if (fila.categoria === categoria && fila.insumo === viejo) fila.insumo = nombre;
  if (estado.historialFiltros.producto === viejo) estado.historialFiltros.producto = nombre;
  item.nombre = nombre;
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
      para: [],
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
export async function confirmarAjuste(modal, ajuste) {
  if (estado.modal !== modal) return;
  const { item, categoria, correccion } = modal;
  item.cantidad = ajuste.contado;

  const lotes = ajuste.diferencia < 0
    ? { lotes: descontar(planDescuento(item, -ajuste.diferencia, true)) }
    : { loteId: nuevoLote(item, { cantidad: ajuste.diferencia, origen: 'Sobrante del conteo' }).id };

  const movimientoAjuste = {
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: 'Ajuste',
    cantidad: Math.abs(ajuste.diferencia),
    diferencia: ajuste.diferencia,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador: '',
    para: [],
    saldo: ajuste.contado,
    motivo: ajuste.motivo,
    nota: ajuste.nota,
    corrige: correccion?.fila ?? null,
    ...lotes,
  };

  estado.historial.unshift(movimientoAjuste);
  estado.modal = null;
  refrescar();
  mostrarToast(`Stock ajustado · ${item.nombre}: ${ajuste.contado} ${item.unidad}`);

  try {
    if (item.id && typeof item.id === 'string' && item._rev) {
      const res = await actualizarProductoAPI(item.id, { ...item, tipo: 'producto', categoria });
      if (res?._rev) item._rev = res._rev;
    }
    await registrarMovimientoAPI(movimientoAjuste);
  } catch (error) {
    console.error('Error al guardar ajuste en CouchDB:', error);
  }
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
export async function confirmarBaja(modal, v) {
  if (estado.modal !== modal) return;
  const { item, categoria } = modal;
  const nota = leer(v, 'nota', reglas.nota);
  const vencida = cantidadVencida(item);
  if (vencida <= 0) return;
  const usados = descontar(lotesVencidos(item).map(lote => ({ lote, cantidad: lote.quedan })));
  item.cantidad = redondear(item.cantidad - vencida);

  const movimientoBaja = {
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: 'Salida',
    cantidad: vencida,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador: '',
    para: [],
    saldo: item.cantidad,
    motivo: 'Baja por vencimiento',
    nota,
    lotes: usados,
  };

  estado.historial.unshift(movimientoBaja);
  estado.modal = null;
  refrescar();
  mostrarToast(`Dado de baja · ${vencida} ${item.unidad} de ${item.nombre}`);

  try {
    if (item.id && typeof item.id === 'string' && item._rev) {
      const res = await actualizarProductoAPI(item.id, { ...item, tipo: 'producto', categoria });
      if (res?._rev) item._rev = res._rev;
    }
    await registrarMovimientoAPI(movimientoBaja);
  } catch (error) {
    console.error('Error al guardar baja en CouchDB:', error);
  }
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

export async function guardarUsuario(v) {
  if (!esAdmin()) return;

  const nombre = (v['cuenta-nombre'] || '').trim();
  const usuarioTexto = (v['cuenta-usuario'] || '').trim();
  const clave = (v['cuenta-clave'] || '').trim();
  const rol = v['cuenta-rol'] || 'Usuario';

  const fechaActual = new Date();

  const usuarioDoc = {
    tipo: 'usuario',
    nombre,
    usuario: usuarioTexto,
    clave,
    rol,
    activo: true,
    creado: fechaActual.toISOString(),
    creadoPor: usuario.nombre,
    ultimoAcceso: null
  };

  try {
    const res = await guardarUsuarioAPI(usuarioDoc);

    const usuarioObjeto = {
      ...usuarioDoc,
      id: res.id || res._id,
      _rev: res.rev || res._rev,
      creado: fechaActual
    };

    estado.cuentas.push(usuarioObjeto);
    refrescar();
    cerrarModal();
  } catch (err) {
    console.error('Error al guardar el usuario en CouchDB:', err);
  }
}

// el admin no puede desactivarse ni quitarse el rol a si mismo
export async function cambiarActivo(id) {
  const c = estado.cuentas.find(x => mismoId(x.id, id));
  if (!c) return;

  c.activo = !c.activo;
  refrescar();

  try {
    const usuarioDoc = {
      ...c,
      _id: c.id,
      tipo: 'usuario',
      activo: c.activo,
      creado: c.creado instanceof Date ? c.creado.toISOString() : c.creado,
      ultimoAcceso: c.ultimoAcceso instanceof Date ? c.ultimoAcceso.toISOString() : c.ultimoAcceso
    };
    const res = await actualizarUsuarioAPI(c.id, usuarioDoc);
    if (res?.rev || res?._rev) c._rev = res.rev || res._rev;
  } catch (err) {
    console.error('Error al cambiar estado activo/desactivado en DB:', err);
  }
}

export async function cambiarRol(id, nuevoRol) {
  const c = estado.cuentas.find(x => mismoId(x.id, id));
  if (!c) return;

  c.rol = nuevoRol;
  refrescar();

  try {
    const usuarioDoc = {
      ...c,
      _id: c.id,
      tipo: 'usuario',
      rol: nuevoRol,
      creado: c.creado instanceof Date ? c.creado.toISOString() : c.creado,
      ultimoAcceso: c.ultimoAcceso instanceof Date ? c.ultimoAcceso.toISOString() : c.ultimoAcceso
    };
    const res = await actualizarUsuarioAPI(c.id, usuarioDoc);
    if (res?.rev || res?._rev) c._rev = res.rev || res._rev;
  } catch (err) {
    console.error('Error al cambiar rol en DB:', err);
  }
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
export function problemasItem(x) {
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
  else abrirMetodos();
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

// volver desde elegir metodo: a la lista, o al menu "+" si todavia no hay nada
export function abrirMetodos() {
  if (!estado.lote) return;
  const volver = () => {
    if (estado.lote?.items.length) return abrirLista();
    estado.lote = null;
    abrirModal({ tipo: 'elegir', volver: null });
  };
  abrirModal({ tipo: 'lote-metodo', volver, alCerrar: cerrarLote });
}

export function abrirMetodo(metodo) {
  if (estado.lote && permitido(metodo, ['manual', 'codigo', 'voz'])) abrirModal({ tipo: `lote-${metodo}`, volver: abrirMetodos, alCerrar: cerrarLote });
}

// ---------- agregar a la lista ----------
// a mano: se agrega y se abre para poner la cantidad
export function agregarManual(categoria, id) {
  const item = productoPorId(categoria, id);
  if (!item || !estado.lote) return;
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
  if (repetido) repetido.cantidad = redondear((repetido.cantidad ?? 0) + 1);
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

// lo que se dijo (o se escribio) se separa en productos, cada uno con su donador
export function agregarDictado(v) {
  const lote = estado.lote;
  if (!lote) return;
  const texto = leer(v, 'dictado', reglas.dictado);
  const entendido = interpretarDictado(texto, todosLosProductos(), { donadores: estado.donadores, actividades: opcionesActividad() });
  if (entendido.length === 0) falla('No reconocí ningún producto. Prueba con algo como "dos kilos de arroz y tres latas de leche".', 'dictado');

  const esIngreso = lote.tipo === 'Ingreso';
  for (const r of entendido) {
    lote.items.push(nuevoItem({
      origen: 'voz',
      dicho: r.dicho.slice(0, 100),
      nombreDicho: r.nombreDicho.slice(0, largos.nombreProducto),
      cantidad: r.cantidad,
      dudas: r.dudas.map(d => claveProducto(d.categoria, d.item.id)),
      avisos: r.presentacion ? { presentacion: r.presentacion } : {},
      // la fecha dicha, si es valida (no pasada ni muy lejana)
      ...(esIngreso && r.vence && reglas.vencimiento(r.vence).ok && { vence: r.vence }),
      ...(r.producto && { categoria: r.producto.categoria, productoId: r.producto.item.id }),
      // quien dono solo cuenta en los ingresos
      ...(esIngreso && {
        donador: r.donador ? String(r.donador.id) : '',
        donadorDicho: r.donadorDicho.slice(0, largos.nombreDonador),
        actividad: r.actividad ?? '',
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
    else abrirMetodos();
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
    categoria, productoId: elegido.nuevo ? null : item.id, productoNuevo: elegido.nuevo ? x.productoNuevo : null, cantidad, vence, ...donador, donadorDicho: '', para, observaciones, dudas: [], avisos: {},
  });

  // "mismo donador para los que no tienen": ahorra elegirlo fila por fila (no toca a los que dijeron otro)
  if (esIngreso && v['donador-todos'] && x.donador) {
    for (const o of lote.items) {
      // la actividad que ya tenia la fila ("donacion libre") se respeta
      if (o !== x && !o.donador && !o.donadorDicho) Object.assign(o, { donador: x.donador, donadorNuevo: x.donadorNuevo, actividad: o.actividad || x.actividad, donadorDicho: '' });
    }
  }
  abrirLista();
}

// ---------- revisar y guardar todo ----------
// paso 1: todas las filas listas
export function revisarLote() {
  const lote = estado.lote;
  if (!lote) return;
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

// paso 2: guarda un movimiento por fila
export function confirmarLote(modal) {
  if (estado.modal !== modal || !estado.lote) return;
  const { tipo, items } = estado.lote;
  // donadores y productos nuevos se crean una sola vez aunque esten en varias filas
  const donadoresNuevos = new Map();
  const productosNuevos = new Map();

  for (const x of items) {
    let { item, categoria, nuevo } = productoDeItem(x);
    if (nuevo) {
      if (!productosNuevos.has(x.productoNuevo)) {
        // los otros tamaños que todavia no lo tienen reciben su tamaño en el nombre
        const { renombrar = [] } = nombreDisponible(x.productoNuevo.nombre, x.productoNuevo, x.id);
        for (const r of renombrar) if (!r.nuevo) renombrarProducto(r.item, r.categoria, r.nombre);
        const creado = { ...x.productoNuevo, id: Date.now() + productosNuevos.size, lotes: [] };
        listaDe(categoria).push(creado);
        productosNuevos.set(x.productoNuevo, creado);
      }
      item = productosNuevos.get(x.productoNuevo);
    }
    // la proxima vez el codigo ya se reconoce
    if (x.codigoBarras && !productoPorCodigo(x.codigoBarras)) item.codigosBarras = [...(item.codigosBarras ?? []), x.codigoBarras];

    let donador = '';
    if (tipo === 'Ingreso' && x.donador === 'nuevo') {
      const clave = x.donadorNuevo.nombre.toLowerCase();
      if (!donadoresNuevos.has(clave)) {
        estado.donadores.push(nuevoDonador(x.donadorNuevo.nombre, x.donadorNuevo.telefono));
        donadoresNuevos.set(clave, x.donadorNuevo.nombre);
      }
      donador = donadoresNuevos.get(clave);
    } else if (tipo === 'Ingreso') donador = donadorDeItem(x);

    registrarMovimiento({
      item, categoria, tipo, cantidad: x.cantidad, vence: x.vence ?? null, donador, actividad: donador ? x.actividad : '', para: x.para, observaciones: x.observaciones,
      inicial: nuevo,
    });
  }

  estado.lote = null;
  estado.modal = null;
  estado.filtro = 'Todos';
  mostrarToast(`${tipo === 'Salida' ? 'Salida guardada' : 'Ingreso guardado'} · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`);
}

// Carga los documentos de CouchDB en el estado global de React
export async function cargarDatosDesdeDB() {
  try {
    const [respuestaInv, respuestaHist, respuestaDon, respuestaUsu] = await Promise.all([
      getInventario().catch(() => []),
      getHistorialAPI().catch(() => []),
      getDonadoresAPI().catch(() => []),
      getUsuariosAPI().catch(() => [])
    ]);

    // 1. Inventario (se mantiene igual)
    const documentos = Array.isArray(respuestaInv) ? respuestaInv : (respuestaInv?.docs || []);
    if (documentos.length > 0) {
      const formateados = documentos.map(doc => ({
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
          ingreso: lote.ingreso ? new Date(lote.ingreso) : new Date()
        })),
        almacen: doc.almacen || '',
        categoriaNombre: doc.categoria || ''
      }));

      const saludDB = formateados.filter(doc => 
        (doc.almacen && (doc.almacen.includes('medicinas') || doc.almacen.includes('higiene'))) || 
        ['medicinas', 'higiene', 'salud'].includes((doc.categoriaNombre || '').toLowerCase())
      );
      estado.alimentos = formateados.filter(doc => !saludDB.includes(doc));
      estado.salud = saludDB;
    }

    // 2. Historial (se mantiene igual)
    if (Array.isArray(respuestaHist) && respuestaHist.length > 0) {
      estado.historial = respuestaHist.map(doc => {
        const rawMov = doc.movimiento || doc.tipo_movimiento || 'Ingreso';
        const movimiento = rawMov.charAt(0).toUpperCase() + rawMov.slice(1).toLowerCase();
        const rawCat = doc.categoria || 'alimentos';
        const categoria = rawCat.toLowerCase() === 'salud' ? 'Salud' : 'Alimentos';

        return {
          ...doc,
          id: doc._id || doc.id,
          movimiento,
          categoria,
          insumo: doc.insumo || doc.nombre || 'Sin insumo',
          cantidad: Number(doc.cantidad) || 0,
          saldo: Number(doc.saldo) || 0,
          responsable: doc.responsable || doc.usuario_id || 'admin'
        };
      });
    }

    // 3. Donadores (se mantiene igual)
    if (Array.isArray(respuestaDon) && respuestaDon.length > 0) {
      estado.donadores = respuestaDon.map(doc => ({
        ...doc,
        id: doc._id || doc.id,
        _rev: doc._rev,
        nombre: doc.nombre || '',
        telefono: doc.telefono || doc.contacto || '',
        contacto: doc.contacto || doc.telefono || '',
        creadoPor: doc.creadoPor || 'admin',
        creado: doc.creado ? new Date(doc.creado) : new Date()
      }));
    }

    // 4. Cuentas de usuario desde CouchDB
    if (Array.isArray(respuestaUsu) && respuestaUsu.length > 0) {
      estado.cuentas = respuestaUsu.map(doc => ({
        ...doc,
        id: doc._id || doc.id,
        _rev: doc._rev,
        nombre: doc.nombre || '',
        usuario: doc.usuario || doc.username || '',
        rol: doc.rol || 'Usuario',
        activo: doc.activo ?? true,
        ultimoAcceso: doc.ultimoAcceso ? new Date(doc.ultimoAcceso) : null,
        creado: doc.creado ? new Date(doc.creado) : new Date(),
        creadoPor: doc.creadoPor || ''
      }));
    }

    refrescar();
  } catch (error) {
    console.error('Error al actualizar el estado con datos de CouchDB:', error);
  }
}