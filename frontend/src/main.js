
import './styles/global.css';
import './styles/componentes.css';
import './styles/responsive.css';

import { obtenerDocumentos } from './db/database.js';
import { guardarProductoDB } from './db/productos.js';
import { guardarMovimientoDB } from './db/movimientos.js';
import { guardarDonadorDB } from './db/donadores.js';

import {
  alimentos,
  salud,
  historial,
  donadores,
  usuario
} from './data/datos.js';

import { Layout, Menu, MenuMovil } from './layouts/MainLayout.js';
import {
  ModalMovimiento,
  ModalProducto,
  fechaActual
} from './components/Modal.js';
import { paginaAlimentos } from './pages/Alimentos.js';
import { paginaSalud } from './pages/Salud.js';
import { paginaHistorial } from './pages/Historial.js';
import { paginaDonadores } from './pages/Donadores.js';

const estado = {
  seccion: 'Alimentos',
  filtro: 'Todos',
  busqueda: '',
  alertaAbierta: true,
  alimentos: [],
  salud: [],
  historial: [],
  donadores: [],
};

const paginas = {
  Alimentos: paginaAlimentos,
  Salud: paginaSalud,
  Historial: paginaHistorial,
  Donadores: paginaDonadores,
};

let seleccionado = null;

async function cargarDatos() {
  let documentos = await obtenerDocumentos();

  const tieneAlimentos = documentos.some(
    doc => doc._id === 'producto:Alimentos:1'
  );

  const tieneSalud = documentos.some(
    doc => doc._id === 'producto:Salud:1'
  );

  if (!tieneAlimentos) {
    for (const item of alimentos) {
      await guardarProductoDB({
        ...item,
        _id: `producto:Alimentos:${item.id}`,
        tipo: 'producto',
        categoria: 'Alimentos'
      });
    }
  }

  if (!tieneSalud) {
    for (const item of salud) {
      await guardarProductoDB({
        ...item,
        _id: `producto:Salud:${item.id}`,
        tipo: 'producto',
        categoria: 'Salud'
      });
    }
  }

  documentos = await obtenerDocumentos();

  const tieneHistorial = documentos.some(
    doc => doc.tipo === 'movimiento'
  );

  if (!tieneHistorial) {
    for (let i = 0; i < historial.length; i++) {
      await guardarMovimientoDB({
        ...historial[i],
        _id: `movimiento:inicial:${i}`,
        tipo: 'movimiento',
        fechaOrden: String(i).padStart(5, '0')
      });
    }
  }

  documentos = await obtenerDocumentos();

  estado.alimentos = documentos
    .filter(doc =>
      doc.tipo === 'producto' &&
      ['Alimentos', 'Dulces', 'carnes'].includes(doc.categoria)
    )
    .map(doc => ({ ...doc, categoria: 'Alimentos' }));

  estado.salud = documentos
    .filter(doc =>
      doc.tipo === 'producto' &&
      ['Salud', 'medicinas', 'higiene'].includes(doc.categoria)
    )
    .map(doc => ({ ...doc, categoria: 'Salud' }));

  estado.historial = documentos
    .filter(doc => doc.tipo === 'movimiento')
    .sort((a, b) =>
      (b.fechaOrden || '').localeCompare(a.fechaOrden || '')
    );

  estado.donadores = documentos.filter(
    doc => doc.tipo === 'donador'
  );

  render();
}

document.querySelector('#app').innerHTML = Layout();
render();

cargarDatos().catch(error => {
  console.error('Error cargando datos:', error);
  mostrarToast('Error al cargar los datos');
});

function render() {
  document.querySelector('#menu').innerHTML = Menu(estado.seccion);
  document.querySelector('#menu-movil').innerHTML =
    MenuMovil(estado.seccion);
  document.querySelector('#contenido').innerHTML =
    paginas[estado.seccion](estado);
}

function mostrarToast(mensaje) {
  const toast = document.querySelector('#toast');
  toast.innerHTML = '<div class="toast"></div>';
  toast.firstChild.textContent = mensaje;
  setTimeout(() => (toast.innerHTML = ''), 2600);
}

function valor(id) {
  const input = document.querySelector('#' + id);
  return input ? input.value.trim() : '';
}

function numero(id) {
  return Number(valor(id).replace(',', '.'));
}

function listaDe(categoria) {
  return categoria === 'Salud'
    ? estado.salud
    : estado.alimentos;
}

function abrirModal(categoria, id, tipo) {
  const item = listaDe(categoria).find(
    i => i.id === Number(id)
  );

  if (!item) {
    mostrarToast('No se encontró el producto');
    return;
  }

  seleccionado = { item, categoria, tipo };

  document.querySelector('#modal').innerHTML =
    ModalMovimiento(item, categoria, tipo, estado.donadores);

  document.querySelector('#cantidad').focus();
}

function abrirModalProducto(categoria) {
  seleccionado = { categoria };

  document.querySelector('#modal').innerHTML =
    ModalProducto(categoria, estado.donadores);

  document.querySelector('#nombre').focus();
}

function cerrarModal() {
  seleccionado = null;
  document.querySelector('#modal').innerHTML = '';
}

async function leerDonador(error) {
  const elegido = valor('donador');

  if (elegido === '') return '';

  if (elegido !== 'nuevo') {
    const donador = estado.donadores.find(
      d => String(d.id) === elegido
    );

    return donador ? donador.nombre : '';
  }

  const nombre = valor('donador-nombre');
  const telefono = valor('donador-telefono');

  if (!nombre || !telefono) {
    error.textContent =
      'Completa el nombre y el número de contacto del donador.';
    return null;
  }

  const id = Date.now();

  const nuevoDonador = {
    _id: `donador:${id}`,
    id,
    tipo: 'donador',
    nombre,
    telefono
  };

  await guardarDonadorDB(nuevoDonador);
  estado.donadores.push(nuevoDonador);

  return nombre;
}

async function guardarMovimiento() {
  if (!seleccionado) return;

  const { item, categoria, tipo } = seleccionado;
  const cantidad = numero('cantidad');
  const error = document.querySelector('#error');

  if (!cantidad || cantidad <= 0) {
    error.textContent = 'Ingresa una cantidad mayor que 0.';
    return;
  }

  if (tipo === 'Salida' && cantidad > item.cantidad) {
    error.textContent =
      `No puedes sacar más de lo que hay (${item.cantidad} ${item.unidad}).`;
    return;
  }

  try {
    let donador = '';

    if (tipo === 'Ingreso') {
      donador = await leerDonador(error);
      if (donador === null) return;
    }

    const cambio = tipo === 'Ingreso' ? cantidad : -cantidad;

    const productoActualizado = {
      ...item,
      cantidad: Math.round((item.cantidad + cambio) * 100) / 100,
      lote: valor('lote')
    };

    const para = valor('para');

    if (categoria === 'Salud') {
      productoActualizado.paraNino = para;
    }

    const fecha = fechaActual();
    const idMovimiento = Date.now();

    const movimiento = {
      _id: `movimiento:${idMovimiento}`,
      tipo: 'movimiento',
      fecha,
      fechaOrden: new Date().toISOString(),
      insumo: item.nombre,
      categoria,
      movimiento: tipo,
      cantidad,
      unidad: item.unidad,
      responsable: usuario.nombre,
      donador,
      para
    };

    await guardarProductoDB({
      ...productoActualizado,
      _id: item._id || `producto:${categoria}:${item.id}`,
      tipo: 'producto',
      categoria
    });

    await guardarMovimientoDB(movimiento);

    Object.assign(item, productoActualizado);
    estado.historial.unshift(movimiento);

    cerrarModal();
    render();
    mostrarToast('Registro guardado · ' + item.nombre);
  } catch (error) {
    console.error('Error guardando movimiento:', error);
    mostrarToast('No se pudo guardar el movimiento');
  }
}

async function guardarProducto() {
  if (!seleccionado) return;

  const { categoria } = seleccionado;
  const error = document.querySelector('#error');

  const nombre = valor('nombre');
  const cantidad = numero('cantidad');
  const unidad = valor('unidad') === 'otro'
    ? valor('unidad-otro')
    : valor('unidad');
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
    error.textContent =
      'Los alimentos necesitan fecha de vencimiento.';
    return;
  }

  try {
    const donador = await leerDonador(error);
    if (donador === null) return;

    const para = valor('para');
    const id = Date.now();

    const producto = {
      _id: `producto:${categoria}:${id}`,
      id,
      tipo: 'producto',
      categoria,
      codigo: nombre.slice(0, 2).toUpperCase(),
      nombre,
      descripcion: valor('descripcion'),
      cantidad,
      minimo,
      unidad,
      vencimiento: vencimiento || null,
      lote: valor('lote'),
      paraNino: para
    };

    const movimiento = {
      _id: `movimiento:${Date.now()}`,
      tipo: 'movimiento',
      fecha: fechaActual(),
      fechaOrden: new Date().toISOString(),
      insumo: nombre,
      categoria,
      movimiento: 'Ingreso',
      cantidad,
      unidad,
      responsable: usuario.nombre,
      donador,
      para
    };

    await guardarProductoDB(producto);
    await guardarMovimientoDB(movimiento);

    listaDe(categoria).push(producto);
    estado.historial.unshift(movimiento);

    cerrarModal();
    estado.filtro = 'Todos';
    render();
    mostrarToast('Producto agregado · ' + nombre);
  } catch (error) {
    console.error('Error guardando producto:', error);
    mostrarToast('No se pudo guardar el producto');
  }
}

async function guardarDonador() {
  const nombre = valor('nuevo-nombre');
  const telefono = valor('nuevo-telefono');

  if (!nombre || !telefono) {
    document.querySelector('#error').textContent =
      'Completa el nombre y el número de contacto.';
    return;
  }

  try {
    const id = Date.now();

    const donador = {
      _id: `donador:${id}`,
      id,
      tipo: 'donador',
      nombre,
      telefono
    };

    await guardarDonadorDB(donador);
    estado.donadores.push(donador);

    render();
    mostrarToast('Donador agregado · ' + nombre);
  } catch (error) {
    console.error('Error guardando donador:', error);
    mostrarToast('No se pudo guardar el donador');
  }
}

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
      abrirModal(
        boton.dataset.categoria,
        boton.dataset.id,
        boton.dataset.tipo
      );
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

document.addEventListener('submit', e => {
  e.preventDefault();

  if (e.target.id === 'form-movimiento') guardarMovimiento();
  if (e.target.id === 'form-producto') guardarProducto();
  if (e.target.id === 'form-donador') guardarDonador();
});

document.addEventListener('change', e => {
  if (e.target.id === 'donador') {
    const nuevo = document.querySelector('#nuevo-donador');

    if (nuevo) {
      nuevo.hidden = e.target.value !== 'nuevo';
    }
  }

  if (e.target.id === 'unidad') {
    const otro = document.querySelector('#unidad-otro');

    if (otro) {
      otro.hidden = e.target.value !== 'otro';
      if (!otro.hidden) otro.focus();
    }
  }
});

document.querySelector('#buscador').addEventListener('input', e => {
  estado.busqueda = e.target.value;
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarModal();
});
