import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';

import { alimentos, salud, historial, donadores, usuario } from './data/datos.js';
import { Layout, Menu, MenuMovil } from './layouts/MainLayout.js';
import { ModalMovimiento, ModalProducto, fechaActual } from './components/Modal.js';
import { paginaAlimentos } from './pages/Alimentos.js';
import { paginaSalud } from './pages/Salud.js';
import { paginaHistorial } from './pages/Historial.js';
import { paginaDonadores } from './pages/Donadores.js';

const estado = {
  seccion: 'Alimentos',
  filtro: 'Todos',
  busqueda: '',
  alertaAbierta: true,
  alimentos,
  salud,
  historial,
  donadores,
};

const paginas = {
  Alimentos: paginaAlimentos,
  Salud: paginaSalud,
  Historial: paginaHistorial,
  Donadores: paginaDonadores,
};

// lo que se esta registrando en el modal abierto
let seleccionado = null;

document.querySelector('#app').innerHTML = Layout();
render();

function render() {
  document.querySelector('#menu').innerHTML = Menu(estado.seccion);
  document.querySelector('#menu-movil').innerHTML = MenuMovil(estado.seccion);
  document.querySelector('#contenido').innerHTML = paginas[estado.seccion](estado);
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

  document.querySelector('#modal').innerHTML = ModalMovimiento(item, categoria, tipo, estado.donadores);
  document.querySelector('#cantidad').focus();
}

function abrirModalProducto(categoria) {
  seleccionado = { categoria };
  document.querySelector('#modal').innerHTML = ModalProducto(categoria, estado.donadores);
  document.querySelector('#nombre').focus();
}

function cerrarModal() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = '';
}

// devuelve el nombre del donador elegido, '' si no hay, o null si falta completar el nuevo
function leerDonador(error) {
  const elegido = valor('donador');
  if (elegido === '') return '';

  if (elegido !== 'nuevo') {
    return estado.donadores.find(d => d.id === Number(elegido)).nombre;
  }

  const nombre = valor('donador-nombre');
  const telefono = valor('donador-telefono');
  if (!nombre || !telefono) {
    error.textContent = 'Completa el nombre y el número de contacto del donador.';
    return null;
  }

  estado.donadores.push({ id: Date.now(), nombre, telefono });
  return nombre;
}

function guardarMovimiento() {
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

  let donador = '';
  if (tipo === 'Ingreso') {
    donador = leerDonador(error);
    if (donador === null) return;
  }

  // ingreso suma, salida resta
  const cambio = tipo === 'Ingreso' ? cantidad : -cantidad;
  item.cantidad = Math.round((item.cantidad + cambio) * 100) / 100;
  item.lote = valor('lote');

  const para = valor('para');
  if (categoria === 'Salud') item.paraNino = para;

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: tipo,
    cantidad,
    unidad: item.unidad,
    responsable: usuario.nombre,
    donador,
    para,
  });

  cerrarModal();
  render();
  mostrarToast('Registro guardado · ' + item.nombre);
}

function guardarProducto() {
  const { categoria } = seleccionado;
  const error = document.querySelector('#error');

  const nombre = valor('nombre');
  const cantidad = numero('cantidad');
  const unidad = valor('unidad') === 'otro' ? valor('unidad-otro') : valor('unidad');
  const minimo = numero('minimo');
  const vencimiento = valor('vencimiento');

  if (!nombre) {
    error.textContent = 'Escribe el nombre del producto.';
    return;
  }
  if (!cantidad || cantidad <= 0) {
    error.textContent = 'Ingresa una cantidad mayor que 0.';
    return;
  }
  if (!unidad) {
    error.textContent = 'Elige la unidad o escríbela en "Otro".';
    return;
  }
  if (isNaN(minimo) || minimo < 0) {
    error.textContent = 'El stock mínimo debe ser un número.';
    return;
  }
  if (categoria === 'Alimentos' && !vencimiento) {
    error.textContent = 'Los alimentos necesitan fecha de vencimiento.';
    return;
  }

  const donador = leerDonador(error);
  if (donador === null) return;

  const para = valor('para');

  listaDe(categoria).push({
    id: Date.now(),
    codigo: nombre.slice(0, 2).toUpperCase(),
    nombre,
    descripcion: valor('descripcion'),
    cantidad,
    minimo,
    unidad,
    vencimiento: vencimiento || null,
    lote: valor('lote'),
    paraNino: para,
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
    para,
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

  estado.donadores.push({ id: Date.now(), nombre, telefono });
  render();
  mostrarToast('Donador agregado · ' + nombre);
}

// todos los botones tienen data-accion
document.addEventListener('click', e => {
  if (e.target.classList.contains('fondo-modal')) {
    cerrarModal();
    return;
  }

  const boton = e.target.closest('[data-accion]');
  if (!boton) return;

  switch (boton.dataset.accion) {
    case 'seccion':
      estado.seccion = boton.dataset.seccion;
      window.scrollTo(0, 0);
      break;
    case 'filtro':
      estado.filtro = boton.dataset.filtro;
      break;
    case 'cerrar-alerta':
      estado.alertaAbierta = false;
      break;
    case 'abrir-alerta':
      estado.alertaAbierta = true;
      break;
    case 'registrar':
      abrirModal(boton.dataset.categoria, boton.dataset.id, boton.dataset.tipo);
      return;
    case 'agregar-producto':
      abrirModalProducto(boton.dataset.categoria);
      return;
    case 'cerrar-modal':
      cerrarModal();
      return;
  }

  render();
});

// cada formulario tiene su id
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'form-movimiento') guardarMovimiento();
  if (e.target.id === 'form-producto') guardarProducto();
  if (e.target.id === 'form-donador') guardarDonador();
});

// mostrar los campos extra solo si se elige "+ Nuevo donador" u "Otro"
document.addEventListener('change', e => {
  if (e.target.id === 'donador') {
    document.querySelector('#nuevo-donador').hidden = e.target.value !== 'nuevo';
  }
  if (e.target.id === 'unidad') {
    const otro = document.querySelector('#unidad-otro');
    otro.hidden = e.target.value !== 'otro';
    if (!otro.hidden) otro.focus();
  }
});

document.querySelector('#buscador').addEventListener('input', e => {
  estado.busqueda = e.target.value;
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});
