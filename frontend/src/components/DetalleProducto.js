import { escapar, nombreCategoria, colorVencimiento, textoCambio, textoStock, textoPresentacion, textoTotal } from './Comunes.js';
import { iconoAjustar, iconoSalida, iconoIngreso } from '../assets/icons.js';
import { TablaLotes, disponible } from './Lotes.js';
import { problemasDe, ListaProblemas } from './Alertas.js';

const clases = { Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' };

// nombre visible de cada campo
const etiquetas = { unidad: 'Se cuenta en', minimo: 'Stock mínimo', consumoDiario: 'Consumo diario', unidos: 'Se le unió' };
// campos que no se listan
const internos = ['id', 'codigo', 'nombre', 'cantidad', 'lotes', 'vencimiento', 'lote', 'contenido', 'medida', '_id', '_rev', 'tipo', 'categoria'];

// movimientos recientes que se muestran
const ultimos = 8;

// cuenta solo lo que se puede usar (sin lo vencido)
function estadoStock(item) {
  const sirve = disponible(item);
  if (sirve < item.minimo) return { color: 'rojo', texto: 'Bajo el stock mínimo' };
  if (sirve <= item.minimo * 1.2) return { color: 'naranja', texto: 'Cerca del mínimo' };
  return { color: 'verde', texto: 'Sobre el mínimo' };
}

function DatosProducto(item) {
  const filas = Object.entries(item)
    .filter(([campo, valor]) => !internos.includes(campo) && valor !== '' && valor != null)
    .map(([campo, valor]) => {
      const conUnidad = campo === 'minimo' || campo === 'consumoDiario' ? ` ${item.unidad}` : '';
      if (Array.isArray(valor)) valor = valor.join(', ');
      return `
        <div>
          <dt>${escapar(etiquetas[campo] || campo)}</dt>
          <dd>${escapar(valor)}${escapar(conUnidad)}</dd>
        </div>`;
    }).join('');

  return `
    <dl class="mov-datos">
      <div><dt>Presentación</dt><dd>${escapar(textoPresentacion(item) || 'Suelto, en ' + item.unidad)}</dd></div>
      ${filas}
    </dl>`;
}

// todo el producto: stock, sus datos y lo ultimo que le paso
// movimientos: [{ fila, indice }] de este producto
// esAdmin: puede unir productos
export function PanelProducto(item, categoria, movimientos, esAdmin = false) {
  const estado = estadoStock(item);
  const problemas = problemasDe(item);

  return `
    <div class="fondo-modal fondo-panel">
      <aside class="panel-actividad panel-movimiento" aria-label="${escapar(item.nombre)}">
        <div class="panel-actividad-cabecera">
          <span class="tarjeta-codigo ${colorVencimiento(item)}">${escapar(item.codigo)}</span>
          <div>
            <div class="modal-titulo">${escapar(item.nombre)}</div>
            <div class="modal-sub">${escapar(nombreCategoria(categoria))}</div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">×</button>
        </div>

        <div class="panel-movimiento-cuerpo">
          <div class="producto-stock">
            <div>
              <b>${item.cantidad} <small>${escapar(item.unidad)}</small></b>
              ${textoPresentacion(item) ? `<span class="producto-total">${escapar(textoPresentacion(item))} · ${escapar(textoTotal(item))}</span>` : ''}
            </div>
            ${problemas.length ? '' : `<span class="texto-${estado.color}">● ${estado.texto}</span>`}
          </div>

          ${problemas.length ? `<div class="producto-alertas">${ListaProblemas(problemas)}</div>` : ''}

          <div class="botones producto-botones">
            <button class="btn btn-registrar btn-salida" data-accion="registrar" data-tipo="Salida" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">${iconoSalida} Registrar salida</button>
            <button class="btn btn-registrar btn-ingreso" data-accion="registrar" data-tipo="Ingreso" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">${iconoIngreso} Registrar ingreso</button>
          </div>
          <button class="btn btn-blanco btn-contar" data-accion="ajustar" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">
            ${iconoAjustar} Contar y corregir stock
          </button>

          ${DatosProducto(item)}

          ${TablaLotes(item, categoria)}

          <div class="mov-pasos-titulo">
            <b>Últimos movimientos</b>
            ${movimientos.length ? `<button class="link" data-accion="historial-producto" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">Ver todo en historial</button>` : ''}
          </div>
          <ul class="mov-pasos">
            ${movimientos.slice(0, ultimos).map(p => `
              <li>
                <button class="mov-paso ${clases[p.fila.movimiento]}" data-accion="ver-movimiento" data-indice="${p.indice}">
                  <span class="mov-paso-fecha">${escapar(p.fila.fecha)}</span>
                  <span class="mov-paso-tipo">● ${p.fila.inicial ? 'Registro inicial' : p.fila.movimiento}${p.fila.insumo !== item.nombre ? ` <small>de "${escapar(p.fila.insumo)}"</small>` : ''}</span>
                  <span class="mov-paso-cambio">${escapar(textoCambio(p.fila))}</span>
                  <span class="mov-paso-stock">${textoStock(p.fila)}</span>
                </button>
              </li>
            `).join('') || '<li class="vacio">Todavía no tiene movimientos</li>'}
          </ul>

          ${esAdmin ? `
            <button class="btn btn-blanco btn-unir" data-accion="unir-producto" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">
              ¿Está repetido? Unir con otro producto
            </button>` : ''}
        </div>
      </aside>
    </div>
  `;
}
