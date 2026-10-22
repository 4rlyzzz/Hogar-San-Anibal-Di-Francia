import { usuario } from '../data/datos.js';
import {
  iconoBuscar, iconoCampana, iconoInicio, iconoAlimentos, iconoSalud, iconoHistorial, iconoDonadores, iconoFijar, iconoSalir, iconoUsuarios,
} from '../assets/icons.js';
import logo from '../assets/logo.png';

// grupo: titulo que se muestra encima en el menu lateral
// soloAdmin: solo aparece si entro un administrador
const secciones = [
  { nombre: 'Inicio', icono: iconoInicio, grupo: 'GENERAL' },
  { nombre: 'Alimentos', icono: iconoAlimentos, grupo: 'INVENTARIO' },
  { nombre: 'Salud', icono: iconoSalud, grupo: 'INVENTARIO' },
  { nombre: 'Historial', icono: iconoHistorial, grupo: 'REGISTROS' },
  { nombre: 'Donadores', icono: iconoDonadores, grupo: 'REGISTROS' },
  { nombre: 'Usuarios', icono: iconoUsuarios, grupo: 'ADMINISTRACIÓN', soloAdmin: true },
];

// las secciones que puede ver quien entro
export function seccionesVisibles() {
  return secciones.filter(s => !s.soloAdmin || usuario.rol === 'Administrador');
}

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
          <button class="campana" data-accion="ver-alertas" aria-label="Alertas">
            ${iconoCampana}
            <span class="campana-numero" id="campana-numero" hidden></span>
          </button>
          <div class="usuario-caja">
            <button class="usuario" data-accion="menu-usuario" aria-haspopup="true">
              <div class="avatar">${usuario.iniciales}</div>
              <div class="usuario-datos">
                <span class="usuario-nombre">${usuario.nombre}</span>
                <span class="usuario-rol">${usuario.rol}</span>
              </div>
            </button>

            <div class="usuario-menu" id="usuario-menu" hidden>
              <div class="usuario-menu-datos">
                <b>${usuario.nombre}</b>
                <span>${usuario.rol}</span>
              </div>
              <button class="usuario-menu-opcion" data-accion="mi-actividad">${iconoHistorial} Mi actividad</button>
              <button data-accion="salir">${iconoSalir} Cerrar sesión</button>
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
  const lista = seccionesVisibles();
  return lista.map((s, i) => `
    ${s.grupo !== lista[i - 1]?.grupo ? `<span class="menu-grupo">${s.grupo}</span>` : ''}
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}" title="${s.nombre}">
      ${s.icono}
      <span>${s.nombre}</span>
    </button>
  `).join('');
}

export function MenuMovil(seccionActual) {
  return seccionesVisibles().map(s => `
    <button class="${s.nombre === seccionActual ? 'activo' : ''}" data-accion="seccion" data-seccion="${s.nombre}" aria-label="${s.nombre}">
      ${s.icono}
    </button>
  `).join('');
}
