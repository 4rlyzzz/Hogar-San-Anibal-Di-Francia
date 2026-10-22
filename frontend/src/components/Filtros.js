import { escapar } from './Comunes.js';
import { iconoFiltro } from '../assets/icons.js';

// filtros guardados en estado[grupo]; en vez de mostrarlos siempre:
// - un boton "Filtros" abre un panel (desktop: debajo del boton; celular: sube desde abajo)
// - los que estan puestos se ven como pastillas que se quitan con ×

export function BotonFiltros(grupo, activos, abierto) {
  return `
    <button class="btn-filtros ${activos ? 'con-filtros' : ''} ${abierto ? 'abierto' : ''}" data-accion="abrir-filtros" data-panel="${grupo}">
      ${iconoFiltro} Filtros ${activos ? `<span class="btn-filtros-numero">${activos}</span>` : ''}
    </button>`;
}

// resultados: cuantos quedan con los filtros puestos (para el boton "Ver ...")
export function PanelFiltros(grupo, campos, resultados) {
  return `
    <div class="filtros-fondo" data-accion="cerrar-filtros"></div>
    <div class="panel-filtros" role="dialog" aria-label="Filtros">
      <div class="panel-filtros-cabecera">
        <b>Filtros</b>
        <button class="link" data-accion="limpiar-filtros" data-panel="${grupo}">Limpiar todo</button>
      </div>
      <div class="panel-filtros-campos">${campos}</div>
      <button class="btn btn-verde panel-filtros-ver" data-accion="cerrar-filtros">Ver ${resultados} resultados</button>
    </div>`;
}

// desplegable con su titulo encima; el cambio lo maneja main.js por data-grupo y data-campo
export function CampoSelect(grupo, campo, titulo, opciones, actual) {
  return `
    <label class="campo-filtro">
      <span>${titulo}</span>
      <select data-grupo="${grupo}" data-campo="${campo}">
        ${Object.entries(opciones).map(([valor, texto]) => `
          <option value="${escapar(valor)}" ${valor === actual ? 'selected' : ''}>${escapar(texto)}</option>
        `).join('')}
      </select>
    </label>`;
}

export function CampoFecha(grupo, campo, titulo, actual) {
  return `
    <label class="campo-filtro">
      <span>${titulo}</span>
      <input type="date" data-grupo="${grupo}" data-campo="${campo}" value="${actual}">
    </label>`;
}

// chips: [{ texto, campo }] de los filtros puestos
export function Chips(grupo, chips) {
  if (chips.length === 0) return '';
  return `
    <div class="chips">
      ${chips.map(c => `
        <button class="chip" data-accion="quitar-filtro" data-panel="${grupo}" data-campo="${c.campo}" aria-label="Quitar filtro ${escapar(c.texto)}">
          ${escapar(c.texto)} <span aria-hidden="true">×</span>
        </button>
      `).join('')}
      ${chips.length > 1 ? `<button class="link" data-accion="limpiar-filtros" data-panel="${grupo}">Limpiar</button>` : ''}
    </div>`;
}
