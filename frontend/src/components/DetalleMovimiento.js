import { escapar, textoCambio, stockAntes, textoStock } from './Comunes.js';

const clases = { Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' };

// campos que ya se muestran arriba o que son internos de la bd
const yaMostrados = ['fecha', 'insumo', 'categoria', 'movimiento', 'cantidad', 'diferencia', 'unidad', 'saldo', 'inicial', '_id', '_rev', 'tipo', 'fechaOrden'];

// nombre lindo de los campos conocidos; los demas se muestran con su nombre tal cual
// (la bd no es relacional: un movimiento puede traer campos nuevos y igual se ven aqui)
const etiquetas = { responsable: 'Responsable', donador: 'Donado por', actividad: 'Actividad', para: 'Para (niño/a)', motivo: 'Motivo', nota: 'Detalle', lote: 'Lote' };

function DatosMovimiento(fila) {
  const filas = Object.entries(fila)
    .filter(([campo, valor]) => !yaMostrados.includes(campo) && valor !== '' && valor != null)
    .map(([campo, valor]) => `
      <div>
        <dt>${escapar(etiquetas[campo] || campo)}</dt>
        <dd>${escapar(valor)}</dd>
      </div>
    `).join('');

  return filas ? `<dl class="mov-datos">${filas}</dl>` : '';
}

// cuanto habia y cuanto quedo, en grande
function AntesDespues(fila) {
  if (fila.saldo == null) {
    return '<p class="mov-sin-saldo">Este movimiento es anterior al registro de saldos: no se sabe cuánto había.</p>';
  }

  return `
    <div class="mov-cambio">
      <div>
        <span>ANTES</span>
        <b>${stockAntes(fila)}</b>
        <small>${escapar(fila.unidad)}</small>
      </div>
      <div class="mov-flecha ${clases[fila.movimiento]}">
        <span>→</span>
        <em>${escapar(textoCambio(fila))}</em>
      </div>
      <div>
        <span>DESPUÉS</span>
        <b>${fila.saldo}</b>
        <small>${escapar(fila.unidad)}</small>
      </div>
    </div>`;
}

// pasos: [{ fila, indice }] del mismo producto, del mas nuevo al mas antiguo
// cada paso se puede abrir para ir "hacia atras"
function PasosProducto(fila, indiceActual, pasos) {
  return `
    <div class="mov-pasos-titulo">
      <b>Pasos de este producto</b>
      <button class="link" data-accion="filtrar-producto" data-indice="${indiceActual}">Ver en historial</button>
    </div>
    <ul class="mov-pasos">
      ${pasos.map(p => `
        <li>
          <button class="mov-paso ${clases[p.fila.movimiento]} ${p.indice === indiceActual ? 'actual' : ''}" data-accion="ver-movimiento" data-indice="${p.indice}">
            <span class="mov-paso-fecha">${p.fila.fecha}</span>
            <span class="mov-paso-tipo">● ${p.fila.inicial ? 'Registro inicial' : p.fila.movimiento}</span>
            <span class="mov-paso-cambio">${escapar(textoCambio(p.fila))}</span>
            <span class="mov-paso-stock">${textoStock(p.fila)}</span>
          </button>
        </li>
      `).join('')}
    </ul>`;
}

export function PanelMovimiento(fila, indice, pasos) {
  return `
    <div class="fondo-modal fondo-panel">
      <aside class="panel-actividad panel-movimiento" aria-label="Detalle del movimiento">
        <div class="panel-actividad-cabecera">
          <span class="pastilla mov-tipo ${clases[fila.movimiento]}">${fila.inicial ? 'Registro inicial' : fila.movimiento}</span>
          <div>
            <div class="modal-titulo">${escapar(fila.insumo)}</div>
            <div class="modal-sub">${fila.fecha} · ${fila.categoria}</div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">×</button>
        </div>

        <div class="panel-movimiento-cuerpo">
          ${AntesDespues(fila)}
          ${fila.movimiento === 'Ajuste' ? `
            <button class="btn btn-blanco btn-corregir" data-accion="corregir-ajuste" data-indice="${indice}">
              ¿Se contó mal? Corregir este ajuste
            </button>` : ''}
          ${DatosMovimiento(fila)}
          ${PasosProducto(fila, indice, pasos)}
        </div>
      </aside>
    </div>
  `;
}
