import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';
import './styles/login.css';

import { alimentos, salud, historial, donadores, cuentas, actividad, actividadesDonacion, ninos, usuario } from './data/datos.js';
import { Layout, Menu, MenuMovil, seccionesVisibles } from './layouts/MainLayout.js';
import { ModalMovimiento, ModalProducto, ModalElegir, ModalDonador, ModalUsuario, ModalAjuste, ConfirmarAjuste, Coincidencias, ModalUnir, ConfirmarMovimiento, ModalBaja, fechaActual,
  envasesAlimentos, envasesSalud, medidasSuelto, medidasAlimentos, medidasSalud } from './components/Modal.js';
import { inventarioVacio } from './components/FiltrosInventario.js';
import { reglas, cantidadDe, numero as reglaNumero, opcion, limpiarTexto, fechaFiltro, largos, decimalesDe } from './validacion.js';
import { planDescuento, descontar, nuevoLote, disponible, cantidadVencida, lotesVencidos } from './components/Lotes.js';
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
import { iniciales, nombreCategoria, motivoCorreccion, motivosAjuste, movimientosEntre, palabras, coincideNombre, palabrasEnComun, pluralizar, envaseSingular } from './components/Comunes.js';
import { actividadDe, PanelActividad } from './components/Actividad.js';
import { PanelMovimiento } from './components/DetalleMovimiento.js';
import { activarDeslizar } from './components/Deslizar.js';

const estado = {
  seccion: 'Inicio',
  grafico: { vista: 'Movimientos', periodo: 'Mes', categoria: 'Alimentos' },
  usuarios: { rol: 'Todos', estado: 'Todos', orden: 'acceso', invertido: false },
  alertasOrden: { orden: 'prioridad', invertido: false },
  historialFiltros: filtrosHistorialVacios(),
  donadoresFiltros: { actividad: 'Todos', anio: 'Todos' },
  inventarioFiltros: inventarioVacio(),
  // panel de filtros abierto (o null)
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

// cuenta con el panel de actividad abierto
let panelActividadId = null;

iniciar();
quitarPantallaCarga();

// celular: deslizar hacia abajo cierra el panel
activarDeslizar(hoja => {
  if (hoja.classList.contains('panel-filtros')) {
    estado.filtrosAbiertos = null;
    render();
  } else {
    cerrarModal();
  }
});

// ---------- sesion ----------
function iniciar() {
  // si la cuenta se desactivo, vuelve al login
  const cuenta = cuentas.find(c => mismoId(c.id, leerSesion()) && c.activo);
  if (cuenta) entrar(cuenta);
  else mostrarLogin();
}

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

function mostrarLogin() {
  document.querySelector('#app').innerHTML = paginaLogin();
}

// 5 intentos fallidos: esperar 30 segundos
const intentos = { fallidos: 0, esperarHasta: 0 };

function iniciarSesion() {
  const error = document.querySelector('#error');

  const espera = Math.ceil((intentos.esperarHasta - Date.now()) / 1000);
  if (espera > 0) {
    error.textContent = `Demasiados intentos. Espera ${espera} segundos y vuelve a probar.`;
    return;
  }

  const nombre = leer('login-usuario', reglas.nombreUsuario, error);
  if (nombre === null) return;
  const clave = leer('login-clave', reglas.claveLogin, error);
  if (clave === null) return;

  const cuenta = cuentas.find(c => c.usuario === nombre && c.clave === clave);
  if (!cuenta) {
    intentos.fallidos++;
    if (intentos.fallidos >= 5) {
      intentos.fallidos = 0;
      intentos.esperarHasta = Date.now() + 30000;
    }
    error.textContent = 'Usuario o contraseña incorrectos.';
    document.querySelector('#login-clave').select();
    return;
  }
  intentos.fallidos = 0;
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

// quita la pantalla de carga (minimo 1.4 s)
function quitarPantallaCarga() {
  const pantalla = document.querySelector('#pantalla-carga');
  const minimo = 1400;

  setTimeout(() => {
    pantalla.classList.add('oculta');
    pantalla.addEventListener('transitionend', () => pantalla.remove(), { once: true });
  }, Math.max(0, minimo - performance.now()));
}

// menu lateral fijo o no (se guarda en el navegador)
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
  // si no puede ver la seccion, vuelve a Inicio
  if (!seccionesVisibles().some(s => s.nombre === estado.seccion)) estado.seccion = 'Inicio';

  document.querySelector('#menu').innerHTML = Menu(estado.seccion);
  document.querySelector('#menu-movil').innerHTML = MenuMovil(estado.seccion);
  document.querySelector('#contenido').innerHTML = paginas[estado.seccion](estado);

  // numero de la campanita: alertas urgentes
  const urgentes = calcularAlertas(estado).filter(a => a.prioridad === 'Alta').length;
  const numero = document.querySelector('#campana-numero');
  numero.hidden = urgentes === 0;
  numero.textContent = urgentes > 9 ? '9+' : urgentes;

  // el css usa la seccion actual
  document.body.dataset.seccion = estado.seccion;

  // los graficos empiezan en lo mas reciente
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

// solo para vistas previas (para guardar se usa leer)
function numero(id) {
  const resultado = reglaNumero({ max: Infinity, decimales: 2 })(valor(id));
  return resultado.ok ? resultado.valor : NaN;
}

// lee un input y lo valida con su regla
// si no pasa, muestra el error y devuelve null
function leer(id, regla, error) {
  const input = document.querySelector('#' + id);
  const resultado = regla(input ? input.value : '');
  if (input) input.toggleAttribute('aria-invalid', !resultado.ok);
  if (!resultado.ok) {
    error.textContent = resultado.error;
    input?.focus();
    return null;
  }
  return resultado.valor;
}

// en campos de numeros borra lo que no es numero
// data-numero: decimales permitidos
function filtrarNumero(input) {
  const decimales = Number(input.dataset.numero) || 0;
  let limpio = input.value.replace(/[^\d.,]/g, '');
  const coma = limpio.search(/[.,]/);
  if (coma >= 0) {
    const entero = limpio.slice(0, coma);
    const resto = limpio.slice(coma + 1).split(/[.,]/)[0];
    limpio = decimales === 0 ? entero : `${entero}${limpio[coma]}${resto.slice(0, decimales)}`;
  }
  if (limpio === input.value) return;

  input.value = limpio;
  const error = document.querySelector('#error');
  if (error) error.textContent = decimales ? `Aquí solo van números, con hasta ${decimales} decimales.` : 'Aquí solo van números enteros.';
}

// compara ids como texto (en CouchDB los _id son texto)
function mismoId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

// el valor tiene que estar en la lista
function permitido(valorElegido, permitidos) {
  return permitidos.includes(valorElegido);
}

function listaDe(categoria) {
  return categoria === 'Salud' ? estado.salud : estado.alimentos;
}

function abrirModal(categoria, id, tipo) {
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  seleccionado = { item, categoria, tipo };

  document.querySelector('#modal').innerHTML = ModalMovimiento(item, categoria, tipo, estado.donadores, opcionesActividad(), opcionesNinos());
  document.querySelector('#cantidad').focus();
}

// actividades de la lista y las agregadas
function opcionesActividad() {
  const agregadas = estado.historial
    .map(f => f.actividad)
    .filter(a => a && !actividadesDonacion.includes(a));
  return [...actividadesDonacion, ...[...new Set(agregadas)].sort((a, b) => a.localeCompare(b))];
}

// niños de la lista y los agregados
function opcionesNinos() {
  const agregados = estado.historial.map(f => f.para).filter(n => n && !ninos.includes(n));
  return [...ninos, ...[...new Set(agregados)].sort((a, b) => a.localeCompare(b))];
}

// para quien es la salida ('' = uso general, null = error)
function leerPara(error) {
  const elegido = valor('para');
  if (elegido === 'otro') return leer('para-otro', reglas.nino, error);
  if (!permitido(elegido, ['', ...opcionesNinos()])) {
    error.textContent = 'Elige para quién es de la lista.';
    return null;
  }
  return elegido;
}

// actividad de la donacion ('' sin donador, null = error)
function leerActividad(error) {
  if (valor('donador') === '') return '';

  const elegida = valor('actividad');
  if (elegida === 'otra') return leer('actividad-otra', reglas.actividadOtra, error);
  if (!permitido(elegida, opcionesActividad())) {
    error.textContent = 'Elige la actividad o motivo de la donación.';
    return null;
  }
  return elegida;
}

// ---------- productos parecidos ----------
function productosParecidos(nombre) {
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

// ---------- presentacion del producto nuevo ----------
// { unidad, envase, contenido, medida } o null si hay error
function leerPresentacion(error, categoria) {
  const envase = valor('envase');
  const envasesPermitidos = [
    ...(categoria === 'Salud' ? envasesSalud : envasesAlimentos),
    'otro',
    ...medidasSuelto.map(m => 'suelto:' + m),
  ];
  if (!permitido(envase, envasesPermitidos)) {
    error.textContent = 'Elige en qué viene el producto.';
    return null;
  }
  // suelto: se cuenta en la medida
  if (envase.startsWith('suelto:')) return { unidad: envase.slice(7), envase: null, contenido: null, medida: null };

  let singular = envaseSingular(envase);
  if (envase === 'otro') {
    singular = leer('envase-otro', reglas.envaseOtro, error);
    if (singular === null) return null;
  }
  const unidad = envase === 'otro' ? pluralizar(singular) : envase;

  const medida = valor('medida');
  if (!permitido(medida, categoria === 'Salud' ? medidasSalud : medidasAlimentos)) {
    error.textContent = 'Elige la medida de la lista.';
    return null;
  }
  // 'unidades' va entero; las demas medidas, 2 decimales
  const reglaContenido = reglaNumero({
    min: 0, max: 10000, decimales: medida === 'unidades' ? 0 : 2, minimoExcluido: true,
    que: `cuánto trae cada ${singular.toLowerCase()}`,
  });
  const contenido = leer('contenido-envase', reglaContenido, error);
  if (contenido === null) return null;

  return { unidad, envase: singular, contenido, medida };
}

// muestra los campos de presentacion y la vista previa
function actualizarPresentacion() {
  const envase = valor('envase');
  const suelto = envase.startsWith('suelto:');

  // decimales segun lo elegido
  const decimalesCantidad = suelto ? decimalesDe(envase.slice(7)) : envase ? 0 : 2;
  for (const id of ['cantidad', 'minimo']) {
    const input = document.querySelector('#' + id);
    if (input) {
      input.dataset.numero = decimalesCantidad;
      input.inputMode = decimalesCantidad ? 'decimal' : 'numeric';
      filtrarNumero(input);
    }
  }
  const inputContenido = document.querySelector('#contenido-envase');
  if (inputContenido) {
    inputContenido.dataset.numero = valor('medida') === 'unidades' ? 0 : 2;
    filtrarNumero(inputContenido);
  }
  // sin envase o suelto: solo cantidad
  document.querySelector('#fila-presentacion').classList.toggle('sin-envase', !envase || suelto);
  document.querySelector('#envase-otro').hidden = envase !== 'otro';

  const previa = document.querySelector('#presentacion-previa');
  const cantidad = numero('cantidad');
  const contenido = numero('contenido-envase');
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
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  const movimientos = estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.categoria === categoria && [item.nombre, ...(item.unidos || [])].includes(p.fila.insumo));

  document.querySelector('#modal').innerHTML = PanelProducto(item, categoria, movimientos, esAdmin());
}

// ---------- unir un producto repetido (solo administrador) ----------
function abrirModalUnir(categoria, id) {
  if (!esAdmin()) return;
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  const opciones = listaDe(categoria)
    .filter(o => sePuedenUnir(item, o))
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
  const destino = listaDe(categoria).find(o => mismoId(o.id, valor('unir-con')));
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

// otro producto con la misma unidad y presentacion
function sePuedenUnir(item, otro) {
  return !mismoId(item.id, otro.id) && otro.unidad === item.unidad && otro.contenido === item.contenido && otro.medida === item.medida;
}

// el stock del repetido entra como ajuste del que se queda
function guardarUnion() {
  const { item, categoria } = seleccionado;
  const lista = listaDe(categoria);
  const destino = lista.find(o => mismoId(o.id, valor('unir-con')));
  if (!destino || !sePuedenUnir(item, destino)) {
    document.querySelector('#error').textContent = 'Elige con qué producto se une.';
    return;
  }

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

  cerrarModal();
  render();
  mostrarToast(`Productos unidos · ${destino.nombre}: ${destino.cantidad} ${destino.unidad}`);
}

// "Ver todo en historial": el historial filtrado por ese producto
function historialProducto(categoria, id) {
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria, producto: item.nombre };
  estado.seccion = 'Historial';
  cerrarModal();
}

function abrirModalProducto(categoria) {
  seleccionado = { categoria };
  document.querySelector('#modal').innerHTML = ModalProducto(categoria, estado.donadores, opcionesActividad());
  document.querySelector('#nombre').focus();
}

// ---------- ajuste de stock ----------
// previo: lo ya escrito al volver
// correccion: { fila, entre } si corrige otro ajuste
function abrirModalAjuste(categoria, id, previo = {}, correccion = null) {
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  seleccionado = { item, categoria, correccion };

  document.querySelector('#modal').innerHTML = ModalAjuste(item, categoria, previo, correccion);
  document.querySelector('#contado').focus();
  if (previo.contado != null) mostrarDiferencia();
}

// abre un ajuste nuevo enlazado al anterior
function corregirAjuste(indice) {
  const fila = estado.historial[Number(indice)];
  const item = listaDe(fila.categoria).find(i => i.nombre === fila.insumo);
  if (!item) {
    mostrarToast('Ese producto ya no está en el inventario');
    return;
  }
  abrirModalAjuste(fila.categoria, item.id, {}, { fila, entre: movimientosEntre(estado.historial, fila) });
}

// redondea a 2 decimales
function redondear(n) {
  return Math.round(n * 100) / 100;
}

// muestra si sobra o falta mientras se escribe
function mostrarDiferencia() {
  const { item } = seleccionado;
  const aviso = document.querySelector('#ajuste-diferencia');
  const resultado = cantidadDe(item.unidad, { que: 'la cantidad contada', puedeSerCero: true })(valor('contado'));
  const contado = resultado.valor;

  aviso.className = 'ajuste-diferencia';
  if (valor('contado') === '') {
    aviso.textContent = 'Escribe cuánto hay realmente en el almacén';
  } else if (!resultado.ok) {
    aviso.textContent = resultado.error;
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

// paso 1: valida y muestra el resumen
function revisarAjuste() {
  const { item, categoria, correccion } = seleccionado;
  const error = document.querySelector('#error');
  const contado = leer('contado', cantidadDe(item.unidad, { que: 'la cantidad contada', puedeSerCero: true }), error);
  if (contado === null) return;

  const motivo = correccion ? motivoCorreccion : valor('motivo');
  if (!correccion && !permitido(motivo, motivosAjuste)) {
    error.textContent = 'Elige el motivo de la lista.';
    return;
  }
  // con "Otro" el detalle es obligatorio
  const nota = leer('nota', motivo === 'Otro' ? reglas.notaObligatoria : reglas.nota, error);
  if (nota === null) return;

  const diferencia = redondear(contado - item.cantidad);
  if (diferencia === 0) {
    error.textContent = 'La cantidad contada coincide con el sistema: no hay nada que ajustar.';
    return;
  }
  seleccionado.ajuste = { contado, diferencia, motivo, nota };
  document.querySelector('#modal').innerHTML = ConfirmarAjuste(item, categoria, seleccionado.ajuste, seleccionado.correccion);
}

// vuelve al paso 1
function volverAjuste() {
  const { item, categoria, ajuste, correccion } = seleccionado;
  abrirModalAjuste(categoria, item.id, ajuste, correccion);
}

// paso 2: guarda el ajuste
function confirmarAjuste() {
  const { item, categoria, ajuste, correccion } = seleccionado;
  item.cantidad = ajuste.contado;

  // si falta, se descuenta de los lotes; si sobra, es un lote nuevo
  const lotes = ajuste.diferencia < 0
    ? { lotes: descontar(planDescuento(item, -ajuste.diferencia, true)) }
    : { loteId: nuevoLote(item, { cantidad: ajuste.diferencia, origen: 'Sobrante del conteo' }).id };

  // diferencia: con signo
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

  cerrarModal();
  render();
  mostrarToast(`Stock ajustado · ${item.nombre}: ${ajuste.contado} ${item.unidad}`);
}

// ---------- baja por vencimiento ----------
// saca los lotes vencidos como una salida
function abrirModalBaja(categoria, id) {
  const item = listaDe(categoria).find(i => mismoId(i.id, id));
  if (!item || cantidadVencida(item) <= 0) {
    mostrarToast('Este producto no tiene nada vencido');
    return;
  }
  seleccionado = { item, categoria };
  document.querySelector('#modal').innerHTML = ModalBaja(item);
}

function confirmarBaja() {
  const { item, categoria } = seleccionado;
  const nota = leer('nota', reglas.nota, document.querySelector('#error'));
  if (nota === null) return;
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

  cerrarModal();
  render();
  mostrarToast(`Dado de baja · ${vencida} ${item.unidad} de ${item.nombre}`);
}

function abrirModalDonador() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = ModalDonador();
  document.querySelector('#nuevo-nombre').focus();
}

// boton "+" segun la pestaña
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
function verMovimiento(indice) {
  const fila = estado.historial[Number(indice)];
  const pasos = estado.historial
    .map((f, i) => ({ fila: f, indice: i }))
    .filter(p => p.fila.insumo === fila.insumo && p.fila.categoria === fila.categoria)
    .slice(0, 40);

  // ajuste que corrige y quien lo corrigio
  const corrige = fila.corrige ? estado.historial.indexOf(fila.corrige) : -1;
  const corregidoPor = estado.historial.findIndex(f => f.corrige === fila);
  const enlaces = {
    corrige: corrige >= 0 ? { fila: fila.corrige, indice: corrige, entre: movimientosEntre(estado.historial, fila.corrige, fila) } : null,
    corregidoPor: corregidoPor >= 0 ? { fila: estado.historial[corregidoPor], indice: corregidoPor } : null,
  };

  document.querySelector('#modal').innerHTML = PanelMovimiento(fila, Number(indice), pasos, enlaces);
}

// "Ver en historial": deja filtrado solo ese producto
function filtrarProducto(indice) {
  const fila = estado.historial[Number(indice)];
  estado.historialFiltros = { ...filtrosHistorialVacios(), categoria: fila.categoria, producto: fila.insumo };
  estado.seccion = 'Historial';
  cerrarModal();
}

// ---------- donadores ----------
function verDonador(id) {
  const d = estado.donadores.find(x => mismoId(x.id, id));
  document.querySelector('#modal').innerHTML = PanelDonador(d, donacionesDe(estado, d.nombre));
}

// historial filtrado por ese donador
function historialDonador(id) {
  const d = estado.donadores.find(x => mismoId(x.id, id));
  estado.historialFiltros = { ...filtrosHistorialVacios(), donador: d.nombre };
  estado.seccion = 'Historial';
  cerrarModal();
}

// descarga la lista como se ve
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
// descarga lo filtrado
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
// acciones que no son movimientos
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

// el admin ve la de todos; los demas solo la suya
function verActividad(id) {
  const cuenta = cuentaPorId(id);
  const esPropio = cuenta.id === usuario.id;
  if (!esPropio && !esAdmin()) return;

  document.querySelector('#usuario-menu').hidden = true;
  panelActividadId = cuenta.id;
  document.querySelector('#modal').innerHTML = PanelActividad(cuenta, actividadDe(estado, cuenta), esPropio, !esPropio && esAdmin());
}

// vuelve a dibujar el panel abierto
function refrescarPanelActividad() {
  if (panelActividadId) verActividad(panelActividadId);
}

// ---------- filtros ----------
// valor sin filtro
function sinFiltro(campo) {
  return campo === 'desde' || campo === 'hasta' ? '' : 'Todos';
}

function limpiarFiltros(grupo) {
  if (grupo === 'historialFiltros') {
    estado.historialFiltros = filtrosHistorialVacios();
  } else if (grupo === 'donadoresFiltros') {
    estado.donadoresFiltros = { actividad: 'Todos', anio: 'Todos' };
  } else if (grupo === 'inventarioFiltros') {
    // el orden se mantiene
    estado.inventarioFiltros = { ...inventarioVacio(), orden: estado.inventarioFiltros.orden };
  } else {
    // el orden se mantiene
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

// roles validos
const roles = ['Usuario', 'Administrador'];

function guardarUsuario() {
  if (!esAdmin()) return;
  const error = document.querySelector('#error');

  const nombre = leer('cuenta-nombre', reglas.nombreCuenta, error);
  if (nombre === null) return;
  const nombreUsuario = leer('cuenta-usuario', reglas.nombreUsuario, error);
  if (nombreUsuario === null) return;
  if (estado.cuentas.some(c => c.usuario === nombreUsuario)) {
    error.textContent = `Ya existe el usuario "${nombreUsuario}".`;
    return;
  }
  const clave = leer('cuenta-clave', reglas.claveNueva, error);
  if (clave === null) return;
  const rol = leer('cuenta-rol', opcion(roles, 'el rol'), error);
  if (rol === null) return;

  estado.cuentas.push({
    id: Date.now(),
    usuario: nombreUsuario,
    clave,
    nombre,
    rol,
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
  return estado.cuentas.find(c => mismoId(c.id, id));
}

function cambiarActivo(id) {
  const cuenta = cuentaPorId(id);
  if (!esAdmin() || !cuenta || mismoId(cuenta.id, usuario.id)) return;
  cuenta.activo = !cuenta.activo;
  registrarActividad('estado', cuenta.activo ? 'Activó a' : 'Desactivó a', cuenta.nombre);
  render();
  refrescarPanelActividad();
  mostrarToast(`${cuenta.nombre} · ${cuenta.activo ? 'activado' : 'desactivado'}`);
}

function cambiarRol(id, rol) {
  const cuenta = cuentaPorId(id);
  if (!esAdmin() || !cuenta || mismoId(cuenta.id, usuario.id) || !permitido(rol, roles)) return;
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

// donador elegido, sin crearlo todavia
// devuelve null si hay error
function elegirDonador(error) {
  const elegido = valor('donador');
  if (elegido === '') return { nombre: '', nuevo: null };

  if (elegido !== 'nuevo') {
    const donador = estado.donadores.find(d => String(d.id) === elegido);
    if (!donador) {
      error.textContent = 'Elige el donador de la lista.';
      return null;
    }
    return { nombre: donador.nombre, nuevo: null };
  }

  const nuevo = leerDonadorNuevo('donador-nombre', 'donador-telefono', error);
  return nuevo ? { nombre: nuevo.nombre, nuevo } : null;
}

// datos del donador nuevo (sin repetir)
function leerDonadorNuevo(idNombre, idTelefono, error) {
  const nombre = leer(idNombre, reglas.nombreDonador, error);
  if (nombre === null) return null;
  if (estado.donadores.some(d => d.nombre.toLowerCase() === nombre.toLowerCase())) {
    error.textContent = `"${nombre}" ya está registrado: elígelo de la lista.`;
    return null;
  }
  const telefono = leer(idTelefono, reglas.telefono, error);
  if (telefono === null) return null;
  return { nombre, telefono };
}

// agrega el donador si era nuevo y devuelve su nombre
function guardarDonadorElegido(donador) {
  if (donador.nuevo) estado.donadores.push(nuevoDonador(donador.nuevo.nombre, donador.nuevo.telefono));
  return donador.nombre;
}

// nombre del donador ('' si no hay, null si hay error)
function leerDonador(error) {
  const donador = elegirDonador(error);
  return donador ? guardarDonadorElegido(donador) : null;
}

// ---------- ingreso o salida: revisar y confirmar ----------
// paso 1: valida y muestra el resumen
function revisarMovimiento() {
  const { item, categoria, tipo } = seleccionado;
  const error = document.querySelector('#error');
  const cantidad = leer('cantidad', cantidadDe(item.unidad), error);
  if (cantidad === null) return;

  // lo vencido no cuenta para salidas
  if (tipo === 'Salida' && cantidad > disponible(item)) {
    error.textContent = cantidadVencida(item)
      ? `Solo se pueden usar ${disponible(item)} ${item.unidad}; lo vencido se saca con "Dar de baja" en el detalle del producto.`
      : `No puedes sacar más de lo que hay (${item.cantidad} ${item.unidad}).`;
    return;
  }

  // vencimiento del lote nuevo
  const vence = tipo === 'Ingreso' ? leerVencimiento(error) : null;
  if (vence === false) return;

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
  const plan = tipo === 'Salida' ? planDescuento(item, cantidad) : [];
  seleccionado.movimiento = { cantidad, vence, plan, donador, actividad, para, esSalud: categoria === 'Salud' };

  const formulario = document.querySelector('#form-movimiento');
  formulario.hidden = true;
  formulario.insertAdjacentHTML('afterend', ConfirmarMovimiento(item, tipo, seleccionado.movimiento));
}

// vuelve al formulario
function volverMovimiento() {
  document.querySelector('#form-movimiento-confirmar').remove();
  document.querySelector('#form-movimiento').hidden = false;
}

// paso 2: guarda el movimiento
function confirmarMovimiento() {
  const { item, categoria, tipo, movimiento } = seleccionado;
  const donador = guardarDonadorElegido(movimiento.donador);

  const cambio = tipo === 'Ingreso' ? movimiento.cantidad : -movimiento.cantidad;
  item.cantidad = Math.round((item.cantidad + cambio) * 100) / 100;
  const lote = tipo === 'Ingreso' ? nuevoLote(item, { cantidad: movimiento.cantidad, vence: movimiento.vence }) : null;

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
    // lote creado o lotes usados
    ...(lote ? { loteId: lote.id, vence: lote.vence } : { lotes: descontar(movimiento.plan) }),
  });

  cerrarModal();
  render();
  mostrarToast(`${tipo} guardado · ${item.nombre}`);
}

// fecha, null si no tiene, false si hay error
function leerVencimiento(error) {
  if (document.querySelector('#sin-vencimiento')?.checked) return null;
  if (!valor('vencimiento')) {
    error.textContent = 'Pon la fecha de vencimiento o marca "No tiene fecha".';
    return false;
  }
  return leer('vencimiento', reglas.vencimiento, error) ?? false;
}

function guardarProducto() {
  const { categoria } = seleccionado;
  const error = document.querySelector('#error');

  if (!permitido(categoria, ['Alimentos', 'Salud'])) return;

  const nombre = leer('nombre', reglas.nombreProducto, error);
  if (nombre === null) return;
  const igual = productoIgual(nombre);
  if (igual) {
    error.textContent = `Ya existe "${igual.item.nombre}" en ${nombreCategoria(igual.categoria)}. Para sumar stock, registra un ingreso de ese producto.`;
    return;
  }
  const presentacion = leerPresentacion(error, categoria);
  if (!presentacion) return;
  const { unidad, envase, contenido, medida } = presentacion;

  const cantidad = leer('cantidad', cantidadDe(unidad), error);
  if (cantidad === null) return;
  const minimo = leer('minimo', cantidadDe(unidad, { que: 'el stock mínimo', puedeSerCero: true }), error);
  if (minimo === null) return;
  const vence = leerVencimiento(error);
  if (vence === false) return;

  const actividad = leerActividad(error);
  if (actividad === null) return;
  const donador = leerDonador(error);
  if (donador === null) return;


  const item = {
    id: Date.now(),
    codigo: nombre.slice(0, 2).toUpperCase(),
    nombre,
    envase,
    contenido,
    medida,
    cantidad,
    minimo,
    unidad,
  };
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

  cerrarModal();
  estado.filtro = 'Todos';
  render();
  mostrarToast('Producto agregado · ' + nombre);
}

function guardarDonador() {
  const nuevo = leerDonadorNuevo('nuevo-nombre', 'nuevo-telefono', document.querySelector('#error'));
  if (!nuevo) return;
  const { nombre, telefono } = nuevo;

  estado.donadores.push(nuevoDonador(nombre, telefono));
  cerrarModal();
  render();
  mostrarToast('Donador agregado · ' + nombre);
}

// grupos y ordenes que se pueden cambiar
const gruposFiltro = { historialFiltros: true, donadoresFiltros: true, inventarioFiltros: true, usuarios: true };
const ordenesPermitidos = {
  usuarios: ['nombre', 'acceso', 'movimientos', 'agregado'],
  alertasOrden: ['producto', 'categoria', 'alerta', 'prioridad'],
};

// atrapa errores para que la app no se trabe
function seguro(manejar) {
  return e => {
    try {
      manejar(e);
    } catch (error) {
      console.error(error);
      mostrarToast('Ocurrió un error inesperado. Revisa el historial antes de volver a intentarlo.');
    }
  };
}

// errores de promesas (descargas, bd)
window.addEventListener('unhandledrejection', e => {
  console.error(e.reason);
  mostrarToast('Ocurrió un error inesperado. Vuelve a intentarlo.');
});

// todos los botones tienen data-accion
document.addEventListener('click', seguro(e => {
  if (e.target.classList.contains('fondo-modal')) {
    cerrarModal();
    return;
  }

  // cierra el menu del usuario
  const menuUsuario = document.querySelector('#usuario-menu');
  if (menuUsuario && !e.target.closest('.usuario-caja')) menuUsuario.hidden = true;

  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  switch (boton.dataset.accion) {
    case 'seccion':
      estado.seccion = boton.dataset.seccion;
      estado.filtrosAbiertos = null;
      // limpia los filtros al cambiar de pestaña
      estado.inventarioFiltros = inventarioVacio();
      window.scrollTo(0, 0);
      break;
    case 'filtro':
      estado.filtro = boton.dataset.filtro;
      break;
    case 'grafico':
      estado.grafico[boton.dataset.campo] = boton.dataset.valor;
      break;
    case 'ordenar': {
      if (!permitido(boton.dataset.orden, ordenesPermitidos[boton.dataset.grupo] ?? [])) return;
      // otro clic invierte el orden
      const orden = estado[boton.dataset.grupo];
      if (orden.orden === boton.dataset.orden) {
        orden.invertido = !orden.invertido;
      } else {
        orden.orden = boton.dataset.orden;
        orden.invertido = false;
      }
      break;
    }
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
    case 'dar-baja':
      abrirModalBaja(boton.dataset.categoria, boton.dataset.id);
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
      if (!Object.hasOwn(gruposFiltro, boton.dataset.panel) || !Object.hasOwn(estado[boton.dataset.panel], boton.dataset.campo)) return;
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
}));

// cada formulario tiene su id
document.addEventListener('submit', seguro(e => {
  e.preventDefault();
  if (e.target.id === 'form-login') iniciarSesion();
  if (e.target.id === 'form-movimiento') revisarMovimiento();
  if (e.target.id === 'form-movimiento-confirmar') confirmarMovimiento();
  if (e.target.id === 'form-ajuste') revisarAjuste();
  if (e.target.id === 'form-unir') guardarUnion();
  if (e.target.id === 'form-ajuste-confirmar') confirmarAjuste();
  if (e.target.id === 'form-baja') confirmarBaja();
  if (e.target.id === 'form-producto') guardarProducto();
  if (e.target.id === 'form-donador') guardarDonador();
  if (e.target.id === 'form-usuario') guardarUsuario();
}));

// cambios en selects y filtros
document.addEventListener('change', seguro(e => {
  if (e.target.classList.contains('selector-rol')) {
    cambiarRol(e.target.dataset.id, e.target.value);
  }
  // filtros: solo grupos, campos y valores validos
  if (e.target.dataset.grupo) {
    const { grupo, campo } = e.target.dataset;
    if (!Object.hasOwn(gruposFiltro, grupo) || !Object.hasOwn(estado[grupo], campo)) return;
    const elegido = e.target.tagName === 'SELECT'
      ? [...e.target.options].some(o => o.value === e.target.value)
      : fechaFiltro(e.target.value).ok;
    if (!elegido) return;
    estado[grupo][campo] = e.target.value;
    if (grupo === 'usuarios' && campo === 'orden') estado.usuarios.invertido = false;
    // al cambiar de categoria se limpian producto y niño
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
}));

document.addEventListener('input', seguro(e => {
  if (e.target.dataset.numero !== undefined) filtrarNumero(e.target);
  if (e.target.id === 'contado') mostrarDiferencia();
  if (['contenido-envase', 'envase-otro'].includes(e.target.id) || (e.target.id === 'cantidad' && document.querySelector('#fila-presentacion'))) actualizarPresentacion();
  if (e.target.id === 'nombre' && document.querySelector('#coincidencias')) mostrarCoincidencias();
  if (e.target.id === 'buscador') {
    estado.busqueda = limpiarTexto(e.target.value).slice(0, largos.busqueda);
    render();
  }
}));

document.addEventListener('keydown', seguro(e => {
  if (e.key === 'Escape') {
    cerrarModal();
    if (estado.filtrosAbiertos) {
      estado.filtrosAbiertos = null;
      if (usuario.id) render();
    }
    const menuUsuario = document.querySelector('#usuario-menu');
    if (menuUsuario) menuUsuario.hidden = true;
  }
}));
