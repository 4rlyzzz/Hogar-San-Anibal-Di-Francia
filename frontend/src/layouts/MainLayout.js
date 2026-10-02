import { usuario } from '../data/datos.js';
import { iconoBuscar, iconoCampana } from '../assets/icons.js';

const secciones = [
  { nombre: 'Alimentos', icono: 'AL' },
  { nombre: 'Salud', icono: 'SA' },
  { nombre: 'Historial', icono: 'HI' },
];

export function Layout() {
  return `
    <header class="topbar">
      <div class="marca">
        <div class="marca-logo">HA</div>
        <div>
          <div class="marca-nombre">Hogar San Aníbal Di Francia</div>
          <div class="marca-sub">Inventario · Alimentos y Salud</div>
          <div class="marca-sub-movil">${usuario.nombre} · ${usuario.rol}</div>
        </div>
      </div>

      <nav class="menu" id="menu"></nav>

      <div class="buscador">
        ${iconoBuscar}
        <input id="buscador" type="text" placeholder="Buscar insumo, lote o categoría">
      </div>

      <div class="topbar-derecha">
        <button class="campana" data-accion="abrir-alerta">
          ${iconoCampana}
          <span class="campana-punto"></span>
        </button>
        <div class="usuario">
          <div class="avatar">${usuario.iniciales}</div>
          <div class="usuario-datos">
            <span class="usuario-nombre">${usuario.nombre}</span>
            <span class="usuario-rol">${usuario.rol}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="contenedor" id="contenido"></main>

    <nav class="menu-movil" id="menu-movil"></nav>
    <div id="modal"></div>
    <div id="toast"></div>
  `;
}

export function Menu(seccionActual) {
  return secciones.map(s => `
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}">${s.nombre}</button>
  `).join('');
}

export function MenuMovil(seccionActual) {
  return secciones.map(s => `
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}">
      <span class="menu-movil-icono">${s.icono}</span>
      ${s.nombre}
    </button>
  `).join('');
}
