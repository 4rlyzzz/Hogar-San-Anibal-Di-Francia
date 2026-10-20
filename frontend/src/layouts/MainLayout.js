import { usuario } from '../data/datos.js';
import {
  iconoBuscar, iconoCampana, iconoInicio, iconoAlimentos, iconoSalud, iconoHistorial, iconoDonadores, iconoFijar,
} from '../assets/icons.js';
import logo from '../assets/logo.png';

// grupo: titulo que se muestra encima en el menu lateral
const secciones = [
  { nombre: 'Inicio', icono: iconoInicio, grupo: 'GENERAL' },
  { nombre: 'Alimentos', icono: iconoAlimentos, grupo: 'INVENTARIO' },
  { nombre: 'Salud', icono: iconoSalud, grupo: 'INVENTARIO' },
  { nombre: 'Historial', icono: iconoHistorial, grupo: 'REGISTROS' },
  { nombre: 'Donadores', icono: iconoDonadores, grupo: 'REGISTROS' },
];

function Marca() {
  return `
    <div class="marca">
      <img class="marca-logo" src="${logo}" alt="Logo Hogar San Aníbal di Francia">
      <div>
        <div class="marca-nombre">Hogar San Aníbal</div>
        <div class="marca-sub-movil">${usuario.nombre} · ${usuario.rol}</div>
      </div>
    </div>
  `;
}

// desktop: menu lateral fijo; celular: barra de iconos abajo
export function Layout() {
  return `
    <aside class="lateral">
      ${Marca()}
      <nav class="menu" id="menu"></nav>

      <div class="menu menu-pie">
        <button data-accion="fijar-menu" id="fijar-menu">
          ${iconoFijar}
          <span>Fijar menú</span>
        </button>
      </div>
    </aside>

    <div class="principal">
      <header class="topbar">
        ${Marca()}

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
    </div>

    <nav class="menu-movil" id="menu-movil"></nav>
    <button class="btn-flotante" data-accion="agregar" aria-label="Agregar">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <div id="modal"></div>
    <div id="toast"></div>
  `;
}

export function Menu(seccionActual) {
  return secciones.map((s, i) => `
    ${s.grupo !== secciones[i - 1]?.grupo ? `<span class="menu-grupo">${s.grupo}</span>` : ''}
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}" title="${s.nombre}">
      ${s.icono}
      <span>${s.nombre}</span>
    </button>
  `).join('');
}

export function MenuMovil(seccionActual) {
  return secciones.map(s => `
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}" aria-label="${s.nombre}">
      ${s.icono}
    </button>
  `).join('');
}
