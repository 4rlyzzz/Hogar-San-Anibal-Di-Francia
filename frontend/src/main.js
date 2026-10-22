import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';
import './styles/login.css';

import { alimentos, salud, historial, donadores, cuentas, actividad, actividadesDonacion, ninos, usuario } from './data/datos.js';
import { Layout, Menu, MenuMovil, seccionesVisibles } from './layouts/MainLayout.js';
import { ModalMovimiento, ModalProducto, ModalElegir, ModalDonador, ModalUsuario, ModalAjuste, ConfirmarAjuste, Coincidencias, ModalUnir, ConfirmarMovimiento, fechaActual } from './components/Modal.js';
import { PanelProducto } from './components/DetalleProducto.js';
import { calcularAlertas, PanelAlertas } from './components/Alertas.js';
import { paginaLogin } from './pages/Login.js';
import { paginaInicio } from './pages/Inicio.js';
import { paginaAlimentos } from './pages/Alimentos.js';
import { paginaSalud } from './pages/Salud.js';
import { paginaHistorial, filtrarHistorial } from './pages/Historial.js';
import { descargarHistorial, nombreArchivoHistorial, descargarDonadores, nombreArchivoDonadores } from './components/Exportar.js';
import { paginaDonadores, listaDonadores, donacionesDe, actividadesDe } from './pages/Donadores.js';
import { PanelDonador } from './components/DetalleDonador.js';
import { paginaUsuarios } from './pages/Usuarios.js';
import { iniciales, motivoCorreccion, palabras, coincideNombre, palabrasEnComun, pluralizar, envaseSingular } from './components/Comunes.js';
import { actividadDe, PanelActividad } from './components/Actividad.js';
import { PanelMovimiento } from './components/DetalleMovimiento.js';
import { activarDeslizar } from './components/Deslizar.js';

const estado = {
  seccion: 'Inicio',
  grafico: { vista: 'Movimientos', periodo: 'Mes', categoria: 'Alimentos' },
  usuarios: { rol: 'Todos', estado: 'Todos', orden: 'acceso', invertido: false },
  historialFiltros: filtrosHistorialVacios(),
  donadoresFiltros: { actividad: 'Todos', anio: 'Todos' },
  // que panel de filtros esta abierto: 'historialFiltros', 'usuarios' o null
  filtrosAbiertos: null,
  filtro: 'Todos',
  busqueda: '',
  alimentos,
  salud,
  historial,
  donadores,
  cuentas,
  actividad,
};

function filtrosHistorialVacios() {
  return { movimiento: 'Todos', categoria: 'Todos', responsable: 'Todos', producto: 'Todos', para: 'Todos', donador: 'Todos', actividad: 'Todos', desde: '', hasta: '' };
}

const paginas = {
  Inicio: paginaInicio,
  Alimentos: paginaAlimentos,
  Salud: paginaSalud,
  Historial: paginaHistorial,
  Donadores: paginaDonadores,
  Usuarios: paginaUsuarios,
};

// lo que se esta registrando en el modal abierto
let seleccionado = null;

// cuenta cuyo panel de actividad esta abierto (para refrescarlo si cambia su rol)
let panelActividadId = null;

iniciar();
quitarPantallaCarga();

// celular: las hojas que suben desde abajo se cierran deslizandolas hacia abajo
activarDeslizar(hoja => {
  if (hoja.classList.contains('panel-filtros')) {
    estado.filtrosAbiertos = null;
    render();
  } else {
    cerrarModal();
  }
});

// ---------- sesion ----------
// si ya habia entrado en esta pestaña sigue adentro; si no, va al inicio de sesion
function iniciar() {
  // si lo desactivaron mientras tenia la sesion abierta, vuelve al login
  const cuenta = cuentas.find(c => c.id === leerSesion() && c.activo);
  if (cuenta) entrar(cuenta);
  else mostrarLogin();
}

// la sesion dura hasta cerrar el navegador (sessionStorage), por si la compu es compartida
function leerSesion() {
  try {
    return Number(sessionStorage.getItem('sesion'));
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

function mostrarLogin() {
  document.querySelector('#app').innerHTML = paginaLogin();
}

function iniciarSesion() {
  const nombre = valor('login-usuario').toLowerCase();
  const clave = document.querySelector('#login-clave').value;
  const error = document.querySelector('#error');

  if (!nombre || !clave) {
    error.textContent = 'Escribe tu usuario y contraseña.';
    return;
  }

  const cuenta = cuentas.find(c => c.usuario === nombre && c.clave === clave);
  if (!cuenta) {
    error.textContent = 'Usuario o contraseña incorrectos.';
    document.querySelector('#login-clave').select();
    return;
  }
  if (!cuenta.activo) {
    error.textContent = 'Esta cuenta está desactivada. Comunicarse con el administrador.';
    return;
  }

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

  document.querySelector('#app').innerHTML = Layout();
  fijarMenu(leerMenuFijo());
  render();
  window.scrollTo(0, 0);
}

function salir() {
  guardarSesion(null);
  Object.assign(usuario, { id: null, nombre: '', iniciales: '', rol: '' });
  mostrarLogin();
}

function verClave(boton) {
  const input = document.querySelector('#login-clave');
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  boton.classList.toggle('activo', mostrar);
  boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

// la pantalla de carga se va cuando la app ya esta dibujada detras,
// pero se queda un minimo para que el logo alcance a verse
function quitarPantallaCarga() {
  const pantalla = document.querySelector('#pantalla-carga');
  const minimo = 1400;

  setTimeout(() => {
    pantalla.classList.add('oculta');
    pantalla.addEventListener('transitionend', () => pantalla.remove(), { once: true });
  }, Math.max(0, minimo - performance.now()));
}

// menu lateral: fijo abierto o que se abra al pasar el mouse; se recuerda en este navegador
function leerMenuFijo() {
  try {
    return localStorage.getItem('menu-fijo') === 'si';
  } catch {
    return false;
  }
}

function fijarMenu(fijo) {
  document.body.classList.toggle('menu-fijo', fijo);
  document.querySelector('#fijar-menu span').textContent = fijo ? 'Soltar menú' : 'Fijar menú';
  try {
    localStorage.setItem('menu-fijo', fijo ? 'si' : 'no');
  } catch {
    // sin almacenamiento solo dura hasta recargar
  }
}

function render() {
  // si la seccion no es para su rol (ej. Usuarios sin ser admin) vuelve a Inicio
  if (!seccionesVisibles().some(s => s.nombre === estado.seccion)) estado.seccion = 'Inicio';

  document.querySelector('#menu').innerHTML = Menu(estado.seccion);
  document.querySelector('#menu-movil').innerHTML = MenuMovil(estado.seccion);
  document.querySelector('#contenido').innerHTML = paginas[estado.seccion](estado);

  // campanita: cuantas alertas urgentes hay (vencidos, por vencer en 3 dias, stock bajo, sobrestock)
  const urgentes = calcularAlertas(estado).filter(a => a.prioridad === 'Alta').length;
  const numero = document.querySelector('#campana-numero');
  numero.hidden = urgentes === 0;
  numero.textContent = urgentes > 9 ? '9+' : urgentes;

  // el css usa la seccion actual (en celular, Inicio no muestra el buscador)
  document.body.dataset.seccion = estado.seccion;

  // los graficos de tiempo empiezan mostrando lo mas reciente (a la derecha)
  document.querySelectorAll('[data-al-final]').forEach(s => (s.scrollLeft = s.scrollWidth));
}

function mostrarToast(mensaje) {
  const toast = document.querySelector('#toast');
  toast.innerHTML = '<div class="toast"></div>';
  toast.firstChild.textContent = mensaje;
  setTimeout(() => (toast.innerHTML = ''), 2600);
}

// lee un input del formulario abierto
function valor(id) {
  const input = document.querySelector('#' + id);
  return input ? input.value.trim() : '';
}

function numero(id) {
  return Number(valor(id).replace(',', '.'));
}

function listaDe(categoria) {
  return categoria === 'Salud' ? estado.salud : estado.alimentos;
}

function abrirModal(categoria, id, tipo) {
  const item = listaDe(categoria).find(i => i.id === Number(id));
  seleccionado = { item, categoria, tipo };

  document.querySelector('#modal').innerHTML = ModalMovimiento(item, categoria, tipo, estado.donadores, opcionesActividad(), opcionesNinos());
  document.querySelector('#cantidad').focus();
}

// las actividades del hogar primero; despues las que se agregaron con "Otra actividad"
function opcionesActividad() {
  const agregadas = estado.historial
    .map(f => f.actividad)
    .filter(a => a && !actividadesDonacion.includes(a));
  return [...actividadesDonacion, ...[...new Set(agregadas)].sort((a, b) => a.localeCompare(b))];
}

// los niños de la lista y los que se agregaron con "Otro niño/a"
function opcionesNinos() {
  const agregados = estado.historial.map(f => f.para).filter(n => n && !ninos.includes(n));
  return [...ninos, ...[...new Set(agregados)].sort((a, b) => a.localeCompare(b))];
}

// para quien fue una salida de Salud: '' es uso general, null si eligio "otro" y no escribio
function leerPara(error) {
  const elegido = valor('para');
  if (elegido !== 'otro') return elegido;

  const nombre = valor('para-otro');
  if (!nombre) {
    error.textContent = 'Escribe el nombre del niño o niña.';
    return null;
  }
  return nombre;
}

// actividad de la donacion: '' si no hay donador, null si falta elegirla (y muestra el error)
function leerActividad(error) {
  if (valor('donador') === '') return '';

  const elegida = valor('actividad');
  const actividad = elegida === 'otra' ? valor('actividad-otra') : elegida;
  if (!actividad) {
    error.textContent = elegida === 'otra' ? 'Escribe cuál fue la actividad.' : 'Elige la actividad o motivo de la donación.';
    return null;
  }
  return actividad;
}

// ---------- productos parecidos (para no crear uno repetido) ----------
// los que tienen todas las palabras escritas, en cualquier orden y aunque haya un error de tipeo
// 'leche gloria' encuentra 'Leche evaporada Gloria'; 'lentjas' encuentra 'Lentejas'
function productosParecidos(nombre) {
  const todos = [
    ...estado.alimentos.map(item => ({ item, categoria: 'Alimentos' })),
    ...estado.salud.map(item => ({ item, categoria: 'Salud' })),
  ];
  return todos.filter(({ item }) => coincideNombre(nombre, item.nombre)).slice(0, 3);
}

// el mismo nombre (sin contar tildes ni mayusculas) en cualquier categoria
function productoIgual(nombre) {
  const buscado = palabras(nombre).join(' ');
  return productosParecidos(nombre).find(({ item }) => palabras(item.nombre).join(' ') === buscado);
}

// ---------- presentacion del producto nuevo ----------
// lee como viene y cuanto trae: { unidad, contenido, medida } o null si falta algo (y muestra el error)
// unidad es en lo que se cuenta: 'bolsas' si viene en bolsas, 'kg' si es suelto
function leerPresentacion(error) {
  const envase = valor('envase');
  if (!envase) {
    error.textContent = 'Elige en qué viene el producto.';
    return null;
  }
  // suelto: se cuenta directo en la medida (kg, L...)
  if (envase.startsWith('suelto:')) return { unidad: envase.slice(7), envase: null, contenido: null, medida: null };

  if (envase === 'otro' && !valor('envase-otro')) {
    error.textContent = 'Escribe cómo se llama el envase (ej. Bidón).';
    return null;
  }
  const unidad = envase === 'otro' ? pluralizar(valor('envase-otro')) : envase;
  const singular = envase === 'otro' ? valor('envase-otro') : envaseSingular(envase);

  const contenido = numero('contenido');
  if (!contenido || contenido <= 0) {
    error.textContent = `Escribe cuánto trae cada ${singular.toLowerCase()} (ej. 10 tabletas, 1 kg).`;
    return null;
  }
  return { unidad, envase: singular, contenido, medida: valor('medida') };
}

// muestra u oculta "de [10] [tabletas]" y como va a quedar: "Caja x 10 tabletas · 100 tabletas en total"
function actualizarPresentacion() {
  const envase = valor('envase');
  const suelto = envase.startsWith('suelto:');
  // sin envase elegido o suelto: solo [cantidad] [en que viene]
  document.querySelector('#fila-presentacion').classList.toggle('sin-envase', !envase || suelto);
  document.querySelector('#envase-otro').hidden = envase !== 'otro';

  const previa = document.querySelector('#presentacion-previa');
  const cantidad = numero('cantidad');
  const contenido = numero('contenido');
  const nombre = envase === 'otro' ? valor('envase-otro') : envaseSingular(envase);

  if (suelto) {
    previa.hidden = false;
    previa.textContent = `Suelto, se cuenta en ${envase.slice(7)}`;
  } else if (envase && nombre && contenido) {
    const total = cantidad ? ` · ${Math.round(cantidad * contenido * 100) / 100} ${valor('medida')} en total` : '';
    previa.hidden = false;
    previa.textContent = `${nombre} x ${contenido} ${valor('medida')}${total}`;
  } else {
    previa.hidden = true;
  }
}

function mostrarCoincidencias() {
  document.querySelector('#coincidencias').innerHTML = Coincidencias(productosParecidos(valor('nombre')));
}

// ---------- detalle de un producto ----------
function verProducto(categoria, id) {
  const item = listaDe(categoria).find(i => i.id === Number(id));
  const movimientos = estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.categoria === categoria && [item.nombre, ...(item.unidos || [])].includes(p.fila.insumo));

  document.querySelector('#modal').innerHTML = PanelProducto(item, categoria, movimientos, esAdmin());
}

// ---------- unir un producto repetido (solo administrador) ----------
function abrirModalUnir(categoria, id) {
  if (!esAdmin()) return;
  const item = listaDe(categoria).find(i => i.id === Number(id));
  const opciones = listaDe(categoria)
    .filter(o => o.id !== item.id && o.unidad === item.unidad && o.contenido === item.contenido && o.medida === item.medida)
    .map(o => ({ o, comunes: palabrasEnComun(item.nombre, o.nombre) }))
    .filter(x => x.comunes > 0)
    .sort((a, b) => b.comunes - a.comunes)
    .map(x => x.o);
  seleccionado = { item, categoria };
  document.querySelector('#modal').innerHTML = ModalUnir(item, categoria, opciones);
}

// al elegir con cual se une, dice como va a quedar
function mostrarResumenUnion() {
  const { item, categoria } = seleccionado;
  const destino = listaDe(categoria).find(o => o.id === Number(valor('unir-con')));
  const resumen = document.querySelector('#unir-resumen');

  if (!destino) {
    resumen.className = 'ajuste-diferencia';
    resumen.textContent = 'Elige el producto que se queda';
    return;
  }
  const total = redondear(destino.cantidad + item.cantidad);
  resumen.className = 'ajuste-diferencia sobra';
  resumen.textContent = `"${destino.nombre}" quedará con ${destino.cantidad} + ${item.cantidad} = ${total} ${item.unidad}`;
}

// el stock del repetido se suma como un ajuste del que se queda (asi su cadena de stock sigue cuadrando)
// y el repetido sale del inventario; sus movimientos viejos quedan en el historial con su nombre
function guardarUnion() {
  const { item, categoria } = seleccionado;
  const lista = listaDe(categoria);
  const destino = lista.find(o => o.id === Number(valor('unir-con')));
  if (!destino) {
    document.querySelector('#error').textContent = 'Elige con qué producto se une.';
    return;
  }

  destino.cantidad = redondear(destino.cantidad + item.cantidad);
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

  cerrarModal();
  render();
  mostrarToast(`Productos unidos · ${destino.nombre}: ${destino.cantidad} ${destino.unidad}`);
}

// "Ver todo en historial": el historial filtrado por ese producto
function historialProducto(categoria, id) {
  const item = listaDe(categoria).find(i => i.id === Number(id));
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria, producto: item.nombre };
  estado.seccion = 'Historial';
  cerrarModal();
}

function abrirModalProducto(categoria) {
  seleccionado = { categoria };
  document.querySelector('#modal').innerHTML = ModalProducto(categoria, estado.donadores, opcionesActividad());
  document.querySelector('#nombre').focus();
}

// ---------- ajuste de stock (cualquiera; queda guardado quien lo hizo) ----------
// corrige el stock cuando el conteo fisico no coincide; queda en el historial como 'Ajuste'
// previo: lo ya escrito (al volver del resumen) o el motivo de una correccion
function abrirModalAjuste(categoria, id, previo = {}) {
  const item = listaDe(categoria).find(i => i.id === Number(id));
  seleccionado = { item, categoria };

  document.querySelector('#modal').innerHTML = ModalAjuste(item, categoria, previo);
  document.querySelector('#contado').focus();
  if (previo.contado != null) mostrarDiferencia();
}

// desde el detalle de un ajuste: abre uno nuevo ya marcado como correccion
function corregirAjuste(indice) {
  const fila = estado.historial[Number(indice)];
  const item = listaDe(fila.categoria).find(i => i.nombre === fila.insumo);
  if (!item) {
    mostrarToast('Ese producto ya no está en el inventario');
    return;
  }
  abrirModalAjuste(fila.categoria, item.id, { motivo: motivoCorreccion, nota: `Corrige el ajuste del ${fila.fecha}` });
}

// redondea a 2 decimales para que 42.1 - 40 no de 2.1000000000000014
function redondear(n) {
  return Math.round(n * 100) / 100;
}

// mientras se escribe la cantidad contada, dice si sobra o falta
function mostrarDiferencia() {
  const { item } = seleccionado;
  const aviso = document.querySelector('#ajuste-diferencia');
  const contado = numero('contado');

  aviso.className = 'ajuste-diferencia';
  if (valor('contado') === '') {
    aviso.textContent = 'Escribe cuánto hay realmente en el almacén';
  } else if (isNaN(contado) || contado < 0) {
    aviso.textContent = 'Escribe un número de 0 o más';
  } else {
    const diferencia = redondear(contado - item.cantidad);
    if (diferencia === 0) {
      aviso.textContent = 'Coincide con el sistema: no hay nada que ajustar';
    } else {
      aviso.classList.add(diferencia > 0 ? 'sobra' : 'falta');
      aviso.textContent = `${diferencia > 0 ? 'Sobran' : 'Faltan'} ${Math.abs(diferencia)} ${item.unidad} · el stock quedará en ${contado} ${item.unidad}`;
    }
  }
}

// paso 1 -> 2: valida y muestra el resumen; todavia no cambia nada
function revisarAjuste() {
  const { item, categoria } = seleccionado;
  const error = document.querySelector('#error');
  const contado = numero('contado');
  const motivo = valor('motivo');
  const nota = valor('nota');

  if (valor('contado') === '' || isNaN(contado) || contado < 0) {
    error.textContent = 'Escribe la cantidad contada (0 o más).';
    return;
  }

  const diferencia = redondear(contado - item.cantidad);
  if (diferencia === 0) {
    error.textContent = 'La cantidad contada coincide con el sistema: no hay nada que ajustar.';
    return;
  }
  if (motivo === 'Otro' && !nota) {
    error.textContent = 'Si el motivo es "Otro", escribe el detalle.';
    return;
  }

  seleccionado.ajuste = { contado, diferencia, motivo, nota };
  document.querySelector('#modal').innerHTML = ConfirmarAjuste(item, categoria, seleccionado.ajuste);
}

// "Volver y corregir": regresa al paso 1 con lo que ya habia escrito
function volverAjuste() {
  const { item, categoria, ajuste } = seleccionado;
  abrirModalAjuste(categoria, item.id, ajuste);
}

// paso 2: recien aqui se guarda; queda en el historial con quien lo hizo
function confirmarAjuste() {
  const { item, categoria, ajuste } = seleccionado;
  item.cantidad = ajuste.contado;

  // cantidad va sin signo como en los demas movimientos; diferencia dice si sumo o resto
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
  });

  cerrarModal();
  render();
  mostrarToast(`Stock ajustado · ${item.nombre}: ${ajuste.contado} ${item.unidad}`);
}

function abrirModalDonador() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = ModalDonador();
  document.querySelector('#nuevo-nombre').focus();
}

// el "+" depende de la pestaña: abre su formulario, o pregunta que agregar en Inicio e Historial
function agregar() {
  if (estado.seccion === 'Alimentos' || estado.seccion === 'Salud') {
    abrirModalProducto(estado.seccion);
  } else if (estado.seccion === 'Donadores') {
    abrirModalDonador();
  } else if (estado.seccion === 'Usuarios') {
    abrirModalUsuario();
  } else {
    document.querySelector('#modal').innerHTML = ModalElegir(esAdmin());
  }
}

// ---------- detalle de un movimiento ----------
// antes y despues, todos sus datos y los pasos del mismo producto (para ir hacia atras)
function verMovimiento(indice) {
  const fila = estado.historial[Number(indice)];
  const pasos = estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.insumo === fila.insumo && p.fila.categoria === fila.categoria)
    .slice(0, 40);

  document.querySelector('#modal').innerHTML = PanelMovimiento(fila, Number(indice), pasos);
}

// "Ver en historial": deja filtrado solo ese producto
function filtrarProducto(indice) {
  const fila = estado.historial[Number(indice)];
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria: fila.categoria, producto: fila.insumo };
  estado.seccion = 'Historial';
  cerrarModal();
}

// ---------- donadores ----------
// su historial: que dono, cuando y para que actividad
function verDonador(id) {
  const d = estado.donadores.find(x => x.id === Number(id));
  document.querySelector('#modal').innerHTML = PanelDonador(d, donacionesDe(estado, d.nombre));
}

// "Ver sus donaciones en el historial": deja el historial filtrado por ese donador
function historialDonador(id) {
  const d = estado.donadores.find(x => x.id === Number(id));
  estado.historialFiltros = { ...filtrosHistorialVacios(), donador: d.nombre };
  estado.seccion = 'Historial';
  cerrarModal();
}

// la lista tal como se ve (con filtros de actividad y año) para agradecer o contactar
async function descargarExcelDonadores(boton) {
  const filas = listaDonadores(estado).map(x => ({ ...x, actividades: actividadesDe(x.donaciones) }));
  if (filas.length === 0) return;

  boton.disabled = true;
  try {
    await descargarDonadores(filas, nombreArchivoDonadores(estado.donadoresFiltros));
    mostrarToast(`Excel descargado · ${filas.length} donadores`);
  } catch (error) {
    console.error('Error al crear el Excel:', error);
    mostrarToast('No se pudo crear el Excel');
  } finally {
    boton.disabled = false;
  }
}

// ---------- descarga del historial ----------
// baja a Excel justo lo que se ve con los filtros puestos
async function descargarExcel(boton) {
  const filas = filtrarHistorial(estado);
  if (filas.length === 0) return;

  boton.disabled = true;
  try {
    await descargarHistorial(filas, nombreArchivoHistorial(estado.historialFiltros));
    mostrarToast(`Excel descargado · ${filas.length} movimientos`);
  } catch (error) {
    console.error('Error al crear el Excel:', error);
    mostrarToast('No se pudo crear el Excel');
  } finally {
    boton.disabled = false;
  }
}

// ---------- actividad ----------
// lo que no es ingreso ni salida queda anotado aqui (en la bd: tipo 'actividad')
function registrarActividad(accion, texto, detalle) {
  estado.actividad.unshift({
    id: Date.now(),
    fecha: new Date(),
    quienId: usuario.id,
    quien: usuario.nombre,
    accion,
    texto,
    detalle,
  });
}

function nuevoDonador(nombre, telefono) {
  registrarActividad('donador', 'Agregó donador', nombre);
  return { id: Date.now(), nombre, telefono, creadoPor: usuario.nombre, creadoPorId: usuario.id, creado: new Date() };
}

// el admin ve la de cualquiera (desde Usuarios); los demas solo la suya (menu del usuario)
function verActividad(id) {
  const cuenta = cuentaPorId(id);
  const esPropio = cuenta.id === usuario.id;
  if (!esPropio && !esAdmin()) return;

  document.querySelector('#usuario-menu').hidden = true;
  panelActividadId = cuenta.id;
  document.querySelector('#modal').innerHTML = PanelActividad(cuenta, actividadDe(estado, cuenta), esPropio, !esPropio && esAdmin());
}

// despues de cambiar rol o estado desde el panel, se vuelve a dibujar con los datos nuevos
function refrescarPanelActividad() {
  if (panelActividadId) verActividad(panelActividadId);
}

// ---------- filtros (Historial y Usuarios) ----------
// valor de "sin filtro" de cada campo
function sinFiltro(campo) {
  return campo === 'desde' || campo === 'hasta' ? '' : 'Todos';
}

function limpiarFiltros(grupo) {
  if (grupo === 'historialFiltros') {
    estado.historialFiltros = filtrosHistorialVacios();
  } else if (grupo === 'donadoresFiltros') {
    estado.donadoresFiltros = { actividad: 'Todos', anio: 'Todos' };
  } else {
    // en usuarios el orden no es un filtro, se mantiene
    estado.usuarios.rol = 'Todos';
    estado.usuarios.estado = 'Todos';
  }
}

// ---------- usuarios (solo administrador) ----------
function esAdmin() {
  return usuario.rol === 'Administrador';
}

function abrirModalUsuario() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = ModalUsuario();
  document.querySelector('#cuenta-nombre').focus();
}

function guardarUsuario() {
  const error = document.querySelector('#error');
  const nombre = valor('cuenta-nombre');
  const nombreUsuario = valor('cuenta-usuario').toLowerCase();
  const clave = document.querySelector('#cuenta-clave').value;

  if (!nombre || !nombreUsuario || !clave) {
    error.textContent = 'Completa nombre, usuario y contraseña.';
    return;
  }
  if (nombreUsuario.includes(' ')) {
    error.textContent = 'El usuario no puede tener espacios.';
    return;
  }
  if (estado.cuentas.some(c => c.usuario === nombreUsuario)) {
    error.textContent = `Ya existe el usuario "${nombreUsuario}".`;
    return;
  }
  if (clave.length < 6) {
    error.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }

  estado.cuentas.push({
    id: Date.now(),
    usuario: nombreUsuario,
    clave,
    nombre,
    rol: valor('cuenta-rol'),
    activo: true,
    creado: new Date(),
    creadoPor: usuario.nombre,
    ultimoAcceso: null,
  });
  registrarActividad('usuario', 'Agregó usuario', nombre);

  cerrarModal();
  render();
  mostrarToast('Usuario agregado · ' + nombre);
}

function cuentaPorId(id) {
  return estado.cuentas.find(c => c.id === Number(id));
}

function cambiarActivo(id) {
  const cuenta = cuentaPorId(id);
  cuenta.activo = !cuenta.activo;
  registrarActividad('estado', cuenta.activo ? 'Activó a' : 'Desactivó a', cuenta.nombre);
  render();
  refrescarPanelActividad();
  mostrarToast(`${cuenta.nombre} · ${cuenta.activo ? 'activado' : 'desactivado'}`);
}

function cambiarRol(id, rol) {
  const cuenta = cuentaPorId(id);
  cuenta.rol = rol;
  registrarActividad('rol', 'Cambió el rol de', `${cuenta.nombre} a ${rol}`);
  render();
  refrescarPanelActividad();
  mostrarToast(`${cuenta.nombre} ahora es ${rol}`);
}

function cerrarModal() {
  seleccionado = null;
  panelActividadId = null;
  const modal = document.querySelector('#modal');
  if (modal) modal.innerHTML = '';
}

// el donador elegido, sin crearlo todavia: { nombre, nuevo } (nombre '' si no hay)
// nuevo: { nombre, telefono } si se eligio "+ Nuevo donador"; null si falta completarlo (y muestra el error)
function elegirDonador(error) {
  const elegido = valor('donador');
  if (elegido === '') return { nombre: '', nuevo: null };

  if (elegido !== 'nuevo') {
    return { nombre: estado.donadores.find(d => d.id === Number(elegido)).nombre, nuevo: null };
  }

  const nombre = valor('donador-nombre');
  const telefono = valor('donador-telefono');
  if (!nombre || !telefono) {
    error.textContent = 'Completa el nombre y el número de contacto del donador.';
    return null;
  }
  return { nombre, nuevo: { nombre, telefono } };
}

// agrega el donador si era nuevo y devuelve su nombre
function guardarDonadorElegido(donador) {
  if (donador.nuevo) estado.donadores.push(nuevoDonador(donador.nuevo.nombre, donador.nuevo.telefono));
  return donador.nombre;
}

// devuelve el nombre del donador elegido, '' si no hay, o null si falta completar el nuevo
function leerDonador(error) {
  const donador = elegirDonador(error);
  return donador ? guardarDonadorElegido(donador) : null;
}

// ---------- ingreso o salida: revisar y confirmar ----------
// paso 1 -> 2: valida y muestra el resumen encima del formulario; todavia no cambia nada
function revisarMovimiento() {
  const { item, categoria, tipo } = seleccionado;
  const cantidad = numero('cantidad');
  const error = document.querySelector('#error');

  if (!cantidad || cantidad <= 0) {
    error.textContent = 'Ingresa una cantidad mayor que 0.';
    return;
  }
  if (tipo === 'Salida' && cantidad > item.cantidad) {
    error.textContent = `No puedes sacar más de lo que hay (${item.cantidad} ${item.unidad}).`;
    return;
  }

  const para = leerPara(error);
  if (para === null) return;

  let donador = { nombre: '', nuevo: null };
  let actividad = '';
  if (tipo === 'Ingreso') {
    actividad = leerActividad(error);
    if (actividad === null) return;
    donador = elegirDonador(error);
    if (donador === null) return;
  }

  error.textContent = '';
  seleccionado.movimiento = { cantidad, lote: valor('lote'), donador, actividad, para, esSalud: categoria === 'Salud' };

  const formulario = document.querySelector('#form-movimiento');
  formulario.hidden = true;
  formulario.insertAdjacentHTML('afterend', ConfirmarMovimiento(item, tipo, seleccionado.movimiento));
}

// "Volver y corregir": quita el resumen y vuelve el formulario tal como estaba
function volverMovimiento() {
  document.querySelector('#form-movimiento-confirmar').remove();
  document.querySelector('#form-movimiento').hidden = false;
}

// paso 2: recien aqui se guarda (y se crea el donador si era nuevo)
function confirmarMovimiento() {
  const { item, categoria, tipo, movimiento } = seleccionado;
  const donador = guardarDonadorElegido(movimiento.donador);

  // ingreso suma, salida resta
  const cambio = tipo === 'Ingreso' ? movimiento.cantidad : -movimiento.cantidad;
  item.cantidad = Math.round((item.cantidad + cambio) * 100) / 100;
  item.lote = movimiento.lote;

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: tipo,
    cantidad: movimiento.cantidad,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador,
    actividad: movimiento.actividad,
    para: movimiento.para,
    saldo: item.cantidad,
  });

  cerrarModal();
  render();
  mostrarToast(`${tipo} guardado · ${item.nombre}`);
}

function guardarProducto() {
  const { categoria } = seleccionado;
  const error = document.querySelector('#error');

  const nombre = valor('nombre');
  const cantidad = numero('cantidad');
  const minimo = numero('minimo');
  const vencimiento = valor('vencimiento');

  if (!nombre) {
    error.textContent = 'Escribe el nombre del producto.';
    return;
  }
  const igual = productoIgual(nombre);
  if (igual) {
    error.textContent = `Ya existe "${igual.item.nombre}" en ${igual.categoria}. Para sumar stock, registra un ingreso de ese producto.`;
    return;
  }
  if (!cantidad || cantidad <= 0) {
    error.textContent = 'Ingresa una cantidad mayor que 0.';
    return;
  }
  const presentacion = leerPresentacion(error);
  if (!presentacion) return;
  const { unidad, envase, contenido, medida } = presentacion;
  if (isNaN(minimo) || minimo < 0) {
    error.textContent = 'El stock mínimo debe ser un número.';
    return;
  }
  const sinVencimiento = document.querySelector('#sin-vencimiento')?.checked;
  if (!vencimiento && !sinVencimiento) {
    error.textContent = categoria === 'Alimentos'
      ? 'Los alimentos necesitan fecha de vencimiento.'
      : 'Pon la fecha de vencimiento o marca "No tiene fecha de vencimiento".';
    return;
  }

  const actividad = leerActividad(error);
  if (actividad === null) return;
  const donador = leerDonador(error);
  if (donador === null) return;


  listaDe(categoria).push({
    id: Date.now(),
    codigo: nombre.slice(0, 2).toUpperCase(),
    nombre,
    envase,
    contenido,
    medida,
    cantidad,
    minimo,
    unidad,
    vencimiento: vencimiento || null,
    lote: valor('lote'),
  });

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
  });

  cerrarModal();
  estado.filtro = 'Todos';
  render();
  mostrarToast('Producto agregado · ' + nombre);
}

function guardarDonador() {
  const nombre = valor('nuevo-nombre');
  const telefono = valor('nuevo-telefono');

  if (!nombre || !telefono) {
    document.querySelector('#error').textContent = 'Completa el nombre y el número de contacto.';
    return;
  }

  estado.donadores.push(nuevoDonador(nombre, telefono));
  cerrarModal();
  render();
  mostrarToast('Donador agregado · ' + nombre);
}

// todos los botones tienen data-accion
document.addEventListener('click', e => {
  if (e.target.classList.contains('fondo-modal')) {
    cerrarModal();
    return;
  }

  // el menu del usuario se cierra al hacer clic en cualquier otro lado
  const menuUsuario = document.querySelector('#usuario-menu');
  if (menuUsuario && !e.target.closest('.usuario-caja')) menuUsuario.hidden = true;

  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  switch (boton.dataset.accion) {
    case 'seccion':
      estado.seccion = boton.dataset.seccion;
      estado.filtrosAbiertos = null;
      window.scrollTo(0, 0);
      break;
    case 'filtro':
      estado.filtro = boton.dataset.filtro;
      break;
    case 'grafico':
      estado.grafico[boton.dataset.campo] = boton.dataset.valor;
      break;
    case 'ordenar-usuarios':
      // otro clic en la misma columna invierte el orden
      if (estado.usuarios.orden === boton.dataset.orden) {
        estado.usuarios.invertido = !estado.usuarios.invertido;
      } else {
        estado.usuarios.orden = boton.dataset.orden;
        estado.usuarios.invertido = false;
      }
      break;
    case 'ver-alertas':
      document.querySelector('#modal').innerHTML = PanelAlertas(calcularAlertas(estado));
      return;
    case 'registrar':
      abrirModal(boton.dataset.categoria, boton.dataset.id, boton.dataset.tipo);
      return;
    case 'ajustar':
      abrirModalAjuste(boton.dataset.categoria, boton.dataset.id);
      return;
    case 'volver-movimiento':
      volverMovimiento();
      return;
    case 'volver-ajuste':
      volverAjuste();
      return;
    case 'corregir-ajuste':
      corregirAjuste(boton.dataset.indice);
      return;
    case 'ver-donador':
      verDonador(boton.dataset.id);
      return;
    case 'historial-donador':
      historialDonador(boton.dataset.id);
      break;
    case 'descargar-donadores':
      descargarExcelDonadores(boton);
      return;
    case 'unir-producto':
      abrirModalUnir(boton.dataset.categoria, boton.dataset.id);
      return;
    case 'ver-producto':
      verProducto(boton.dataset.categoria, boton.dataset.id);
      return;
    case 'historial-producto':
      historialProducto(boton.dataset.categoria, boton.dataset.id);
      break;
    case 'ver-movimiento':
      verMovimiento(boton.dataset.indice);
      return;
    case 'filtrar-producto':
      filtrarProducto(boton.dataset.indice);
      break;
    case 'agregar':
      agregar();
      return;
    case 'fijar-menu':
      fijarMenu(!document.body.classList.contains('menu-fijo'));
      boton.blur();
      return;
    case 'agregar-producto':
      abrirModalProducto(boton.dataset.categoria);
      return;
    case 'agregar-donador':
      abrirModalDonador();
      return;
    case 'agregar-usuario':
      abrirModalUsuario();
      return;
    case 'activar-usuario':
      cambiarActivo(boton.dataset.id);
      return;
    case 'descargar-historial':
      descargarExcel(boton);
      return;
    case 'abrir-filtros':
      estado.filtrosAbiertos = estado.filtrosAbiertos === boton.dataset.panel ? null : boton.dataset.panel;
      break;
    case 'cerrar-filtros':
      estado.filtrosAbiertos = null;
      break;
    case 'limpiar-filtros':
      limpiarFiltros(boton.dataset.panel);
      break;
    case 'quitar-filtro':
      estado[boton.dataset.panel][boton.dataset.campo] = sinFiltro(boton.dataset.campo);
      break;
    case 'ver-actividad':
      verActividad(boton.dataset.id);
      return;
    case 'mi-actividad':
      verActividad(usuario.id);
      return;
    case 'cerrar-modal':
      cerrarModal();
      return;
    case 'ver-clave':
      verClave(boton);
      return;
    case 'menu-usuario':
      menuUsuario.hidden = !menuUsuario.hidden;
      return;
    case 'salir':
      salir();
      return;
  }

  render();
});

// cada formulario tiene su id
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'form-login') iniciarSesion();
  if (e.target.id === 'form-movimiento') revisarMovimiento();
  if (e.target.id === 'form-movimiento-confirmar') confirmarMovimiento();
  if (e.target.id === 'form-ajuste') revisarAjuste();
  if (e.target.id === 'form-unir') guardarUnion();
  if (e.target.id === 'form-ajuste-confirmar') confirmarAjuste();
  if (e.target.id === 'form-producto') guardarProducto();
  if (e.target.id === 'form-donador') guardarDonador();
  if (e.target.id === 'form-usuario') guardarUsuario();
});

// mostrar los campos extra solo si se elige "+ Nuevo donador" u "Otro"; y el rol en Usuarios
document.addEventListener('change', e => {
  if (e.target.classList.contains('selector-rol')) {
    cambiarRol(e.target.dataset.id, e.target.value);
  }
  // filtros de Usuarios e Historial: data-grupo dice que parte del estado cambia
  if (e.target.dataset.grupo) {
    const { grupo, campo } = e.target.dataset;
    estado[grupo][campo] = e.target.value;
    if (grupo === 'usuarios' && campo === 'orden') estado.usuarios.invertido = false;
    // al cambiar de categoria, el producto y el niño elegidos pueden no estar en la nueva
    if (grupo === 'historialFiltros' && campo === 'categoria') {
      estado.historialFiltros.producto = 'Todos';
      estado.historialFiltros.para = 'Todos';
    }
    render();
  }
  if (e.target.id === 'donador') {
    document.querySelector('#nuevo-donador').hidden = e.target.value !== 'nuevo';
    document.querySelector('#campo-actividad').hidden = e.target.value === '';
  }
  if (e.target.id === 'unir-con') mostrarResumenUnion();
  if (e.target.id === 'sin-vencimiento') {
    const fecha = document.querySelector('#vencimiento');
    fecha.disabled = e.target.checked;
    if (e.target.checked) fecha.value = '';
  }
  if (e.target.id === 'para') {
    const otro = document.querySelector('#para-otro');
    otro.hidden = e.target.value !== 'otro';
    if (!otro.hidden) otro.focus();
  }
  if (e.target.id === 'actividad') {
    const otra = document.querySelector('#actividad-otra');
    otra.hidden = e.target.value !== 'otra';
    if (!otra.hidden) otra.focus();
  }
  if (['envase', 'medida'].includes(e.target.id)) {
    actualizarPresentacion();
    if (e.target.id === 'envase' && e.target.value === 'otro') document.querySelector('#envase-otro').focus();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'contado') mostrarDiferencia();
  if (['contenido', 'envase-otro'].includes(e.target.id) || (e.target.id === 'cantidad' && document.querySelector('#fila-presentacion'))) actualizarPresentacion();
  if (e.target.id === 'nombre' && document.querySelector('#coincidencias')) mostrarCoincidencias();
  if (e.target.id === 'buscador') {
    estado.busqueda = e.target.value;
    render();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cerrarModal();
    if (estado.filtrosAbiertos) {
      estado.filtrosAbiertos = null;
      if (usuario.id) render();
    }
    const menuUsuario = document.querySelector('#usuario-menu');
    if (menuUsuario) menuUsuario.hidden = true;
  }
});
