import { escapar, diasParaVencer } from './Comunes.js';
import { itemSobrestock, calcularExcedente } from './Alerta.js';

// color de cada prioridad y orden en que se muestran
export const coloresPrioridad = { Alta: 'rojo', Media: 'naranja', Baja: 'azul' };
const orden = Object.keys(coloresPrioridad);
const grupos = { Alta: 'Urgente', Media: 'Pronto', Baja: 'Para revisar' };

// vencimiento y stock de cada producto de una lista
function alertasDe(lista, categoria) {
  const filas = [];

  lista.forEach(item => {
    const dias = diasParaVencer(item);
    if (dias !== null && dias < 0) {
      filas.push({ item, categoria, tipo: 'Vencido', detalle: `Venció hace ${-dias} días`, prioridad: 'Alta' });
    } else if (dias !== null && dias <= 3) {
      filas.push({ item, categoria, tipo: 'Por vencer', detalle: `Vence en ${dias} días`, prioridad: 'Alta' });
    } else if (dias !== null && dias <= 15) {
      filas.push({ item, categoria, tipo: 'Por vencer', detalle: `Vence en ${dias} días`, prioridad: 'Media' });
    }

    if (item.cantidad < item.minimo) {
      filas.push({ item, categoria, tipo: 'Stock bajo', detalle: `${item.cantidad} de ${item.minimo} ${item.unidad} mín.`, prioridad: 'Alta' });
    } else if (item.cantidad <= item.minimo * 1.2) {
      filas.push({ item, categoria, tipo: 'Revisar consumo', detalle: `${item.cantidad} de ${item.minimo} ${item.unidad} mín.`, prioridad: 'Baja' });
    }
  });

  return filas;
}

// todas las alertas, de la mas urgente a la menos
// conSobrestock: Inicio ya muestra el sobrestock en su propio recuadro, ahi va sin el
export function calcularAlertas(estado, conSobrestock = true) {
  const filas = [...alertasDe(estado.alimentos, 'Alimentos'), ...alertasDe(estado.salud, 'Salud')];

  const sobra = conSobrestock ? itemSobrestock(estado) : null;
  if (sobra) {
    const detalle = `Vence en ${diasParaVencer(sobra)} días y sobrarían ${calcularExcedente(sobra)} ${sobra.unidad}`;
    filas.unshift({ item: sobra, categoria: 'Alimentos', tipo: 'Sobrestock', detalle, prioridad: 'Alta' });
  }

  return filas.sort((a, b) => orden.indexOf(a.prioridad) - orden.indexOf(b.prioridad));
}

// panel de la campanita: todas las alertas en cualquier pestaña; tocar una abre ese producto
export function PanelAlertas(alertas) {
  const urgentes = alertas.filter(a => a.prioridad === 'Alta').length;

  const lista = orden.map(prioridad => {
    const delGrupo = alertas.filter(a => a.prioridad === prioridad);
    if (delGrupo.length === 0) return '';

    return `
      <li class="actividad-dia">${grupos[prioridad]} · ${delGrupo.length}</li>
      ${delGrupo.map(a => `
        <li>
          <button class="actividad-item alerta-item" data-accion="ver-producto" data-categoria="${a.categoria}" data-id="${a.item.id}">
            <span class="actividad-punto ${coloresPrioridad[a.prioridad]}"></span>
            <span>
              <b>${escapar(a.item.nombre)}</b>
              <small>${a.tipo} · ${escapar(a.detalle)}</small>
            </span>
            <span class="actividad-hora">${a.categoria}</span>
          </button>
        </li>
      `).join('')}
    `;
  }).join('');

  return `
    <div class="fondo-modal fondo-panel">
      <aside class="panel-actividad" aria-label="Alertas">
        <div class="panel-actividad-cabecera">
          <div>
            <div class="modal-titulo">Alertas</div>
            <div class="modal-sub">${urgentes ? `${urgentes} urgentes de ${alertas.length}` : `${alertas.length} para revisar`}</div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal" aria-label="Cerrar">×</button>
        </div>

        <ul class="panel-actividad-lista">
          ${lista || '<li class="vacio">Todo en orden, no hay alertas</li>'}
        </ul>
      </aside>
    </div>
  `;
}
