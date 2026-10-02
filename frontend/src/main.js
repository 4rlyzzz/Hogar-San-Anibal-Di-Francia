import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';

import { alimentos, salud, historial, usuario } from './data/datos.js';
import { Layout, Menu, MenuMovil } from './layouts/MainLayout.js';
import { ModalSalida, fechaActual } from './components/Modal.js';
import { paginaAlimentos } from './pages/Alimentos.js';
import { paginaSalud } from './pages/Salud.js';
import { paginaHistorial } from './pages/Historial.js';

const estado = {
  seccion: 'Alimentos',
  filtro: 'Todos',
  busqueda: '',
  alertaAbierta: true,
  alimentos,
  salud,
  historial,
};

const paginas = {
  Alimentos: paginaAlimentos,
  Salud: paginaSalud,
  Historial: paginaHistorial,
};

// insumo que se esta registrando en el modal
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
  toast.innerHTML = `<div class="toast">${mensaje}</div>`;
  setTimeout(() => (toast.innerHTML = ''), 2600);
}

function abrirModal(categoria, id) {
  const lista = categoria === 'Salud' ? estado.salud : estado.alimentos;
  const item = lista.find(i => i.id === Number(id));
  seleccionado = { item, categoria };

  document.querySelector('#modal').innerHTML = ModalSalida(item, categoria);
  document.querySelector('#cantidad').focus();
}

function cerrarModal() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = '';
}

function guardarSalida() {
  const { item, categoria } = seleccionado;
  const cantidad = Number(document.querySelector('#cantidad').value.replace(',', '.'));
  const error = document.querySelector('#error');

  if (!cantidad || cantidad <= 0) {
    error.textContent = 'Ingresa una cantidad mayor que 0.';
    return;
  }
  if (cantidad > item.cantidad) {
    error.textContent = `No puedes sacar más de lo que hay (${item.cantidad} ${item.unidad}).`;
    return;
  }

  item.cantidad = Math.round((item.cantidad - cantidad) * 100) / 100;

  estado.historial.unshift({
    fecha: fechaActual(),
    insumo: item.nombre,
    categoria,
    movimiento: 'Salida',
    cantidad: `−${cantidad} ${item.unidad}`,
    responsable: usuario.nombre,
  });

  cerrarModal();
  render();
  mostrarToast('Registro guardado · ' + item.nombre);
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
    case 'ver-todo':
      estado.filtro = 'Todos';
      estado.busqueda = '';
      document.querySelector('#buscador').value = '';
      break;
    case 'cerrar-alerta':
      estado.alertaAbierta = false;
      break;
    case 'abrir-alerta':
      estado.alertaAbierta = true;
      break;
    case 'registrar':
      abrirModal(boton.dataset.categoria, boton.dataset.id);
      return;
    case 'cerrar-modal':
      cerrarModal();
      return;
  }

  render();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  guardarSalida();
});

document.querySelector('#buscador').addEventListener('input', e => {
  estado.busqueda = e.target.value;
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});
