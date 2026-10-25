import { escapar, diasParaVencer, diasHasta, nombreCategoria } from './Comunes.js';
import { lotesCon, lotesVencidos, cantidadVencida, disponible, estaVencido } from './Lotes.js';
import { itemSobrestock, calcularExcedente } from './Alerta.js';

// color y orden de cada prioridad
export const coloresPrioridad = { Alta: 'rojo', Media: 'naranja', Baja: 'azul' };
const orden = Object.keys(coloresPrioridad);
const grupos = { Alta: 'Urgente', Media: 'Pronto', Baja: 'Para revisar' };

// de la mas grave a la menos
const tipos = ['Vencido', 'Sobrestock', 'Por vencer', 'Stock bajo', 'Cerca del mínimo'];

const dias = n => `${n} ${n === 1 ? 'día' : 'días'}`;

// problemas de un producto: vencido, por vencer y stock
// el stock se cuenta sin lo vencido
export function problemasDe(item) {
  const u = item.unidad;
  const vencidos = lotesVencidos(item);
  const vencida = cantidadVencida(item);
  const problemas = [];

  if (vencidos.length) {
    const masViejo = Math.max(...vencidos.map(l => -diasHasta(l.vence)));
    const cuanto = vencida >= item.cantidad ? `Todo (${vencida} ${u})` : `${vencida} ${u}`;
    problemas.push({ tipo: 'Vencido', detalle: `${cuanto} venció hace ${dias(masViejo)}`, corto: `${cuanto}, hace ${dias(masViejo)}`, prioridad: 'Alta' });
    if (vencida >= item.cantidad) return problemas;
  }

  // proximo lote en vencer
  const proximo = lotesCon(item)
    .filter(l => l.vence && !estaVencido(l))
    .sort((a, b) => a.vence.localeCompare(b.vence))[0];
  const vence = proximo ? diasHasta(proximo.vence) : null;
  if (vence !== null && vence <= 15) {
    const cuando = vence === 0 ? 'vence hoy' : `vence en ${dias(vence)}`;
    const cuanto = proximo.quedan === item.cantidad ? 'Todo' : `${proximo.quedan} ${u}`;
    const enCuanto = vence === 0 ? 'hoy' : `en ${dias(vence)}`;
    problemas.push({ tipo: 'Por vencer', detalle: `${cuanto} ${cuando}`, corto: `${cuanto} ${enCuanto}`, prioridad: vence <= 3 ? 'Alta' : 'Media' });
  }

  // cerca del minimo: hasta 20% sobre el minimo
  const sirve = disponible(item);
  const quedan = `Quedan ${sirve} ${u}${vencida ? ' que sirven' : ''} · mín. ${item.minimo}`;
  const deMinimo = `${sirve} de ${item.minimo} ${u}`;
  if (sirve < item.minimo) {
    problemas.push({ tipo: 'Stock bajo', detalle: quedan, corto: deMinimo, prioridad: 'Alta' });
  } else if (sirve <= item.minimo * 1.2) {
    problemas.push({ tipo: 'Cerca del mínimo', detalle: quedan, corto: deMinimo, prioridad: 'Baja' });
  }
  return problemas;
}

// una fila por producto, con la prioridad mas alta
function alertasDe(lista, categoria) {
  return lista.flatMap(item => {
    const problemas = problemasDe(item);
    if (problemas.length === 0) return [];
    return [{
      item,
      categoria,
      tipo: problemas.map(p => p.tipo).join(', ').replace(/, ([^,]*)$/, ' y $1'),
      detalle: problemas.map(p => p.detalle).join(' · '),
      prioridad: orden.find(o => problemas.some(p => p.prioridad === o)),
      problemas,
    }];
  });
}

// todas las alertas ordenadas por prioridad
// en Inicio va sin sobrestock porque tiene su recuadro
export function calcularAlertas(estado, conSobrestock = true) {
  let filas = [...alertasDe(estado.alimentos, 'Alimentos'), ...alertasDe(estado.salud, 'Salud')];

  // el sobrestock reemplaza la fila de ese producto
  const sobra = conSobrestock ? itemSobrestock(estado) : null;
  if (sobra) {
    const detalle = `Vence en ${dias(diasParaVencer(sobra))} y sobrarían ${calcularExcedente(sobra)} ${sobra.unidad}`;
    const problema = { tipo: 'Sobrestock', detalle, corto: `sobrarían ${calcularExcedente(sobra)} ${sobra.unidad}`, prioridad: 'Alta' };
    filas = [{ item: sobra, categoria: 'Alimentos', ...problema, problemas: [problema] }, ...filas.filter(f => f.item !== sobra)];
  }

  return filas.sort(porPrioridad);
}

const rangoTipo = f => tipos.findIndex(t => f.tipo.startsWith(t));
const porPrioridad = (a, b) => orden.indexOf(a.prioridad) - orden.indexOf(b.prioridad) || rangoTipo(a) - rangoTipo(b);

// orden de cada columna; si empatan, por prioridad
const comparar = {
  producto: (a, b) => a.item.nombre.localeCompare(b.item.nombre),
  categoria: (a, b) => nombreCategoria(a.categoria).localeCompare(nombreCategoria(b.categoria)),
  alerta: (a, b) => rangoTipo(a) - rangoTipo(b),
  prioridad: porPrioridad,
};

export function ordenarAlertas(filas, { orden: columna, invertido }) {
  const sentido = invertido ? -1 : 1;
  return [...filas].sort((a, b) => sentido * comparar[columna](a, b) || porPrioridad(a, b));
}

// problemas en franjas de color (detalle del producto)
export function ListaProblemas(problemas) {
  return `
    <span class="lista-alertas">
      ${problemas.map(p => `
        <span class="lista-alertas-item ${coloresPrioridad[p.prioridad]}">
          <span class="actividad-punto ${coloresPrioridad[p.prioridad]}"></span>
          <span><b>${p.tipo}</b> · ${escapar(p.detalle)}</span>
        </span>`).join('')}
    </span>`;
}

// problemas en una linea (tabla de Inicio)
export function PastillasProblemas(problemas) {
  return problemas.map(p => `
    <span class="pastilla-alerta ${coloresPrioridad[p.prioridad]}" title="${escapar(p.tipo + ': ' + p.detalle)}"><b>${p.tipo}</b> · ${escapar(p.corto)}</span>`).join('');
}

// panel de la campanita
export function PanelAlertas(alertas) {
  const urgentes = alertas.filter(a => a.prioridad === 'Alta').length;

  const lista = orden.map(prioridad => {
    const delGrupo = alertas.filter(a => a.prioridad === prioridad);
    if (delGrupo.length === 0) return '';

    return `
      <li class="actividad-dia">${grupos[prioridad]} · ${delGrupo.length}</li>
      ${delGrupo.map(a => `
        <li>
          <button class="actividad-item alerta-item" data-accion="ver-producto" data-categoria="${escapar(a.categoria)}" data-id="${escapar(a.item.id)}">
            <span class="actividad-punto ${coloresPrioridad[a.prioridad]}"></span>
            <span>
              <b>${escapar(a.item.nombre)}</b>
              <small>${a.tipo} · ${escapar(a.detalle)}</small>
            </span>
            <span class="actividad-hora">${escapar(nombreCategoria(a.categoria))}</span>
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
