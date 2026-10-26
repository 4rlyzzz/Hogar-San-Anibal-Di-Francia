import { diasParaVencer, diasHasta, nombreCategoria } from './comunes.js';
import { lotesCon, lotesVencidos, cantidadVencida, disponible, estaVencido } from './lotes.js';

// excedente = stock - consumo diario * dias que faltan para vencer
export function calcularExcedente(item) {
  return item.cantidad - item.consumoDiario * diasParaVencer(item);
}

// producto con riesgo de sobrestock, o null si no hay
// solo aplica si quedan 15 dias o menos y sobra producto
export function itemSobrestock(estado) {
  // por ahora solo la avena tiene datos de consumo para la alerta
  const avena = estado.alimentos.find(item => item.consumoDiario);
  if (!avena) return null;

  const dias = diasParaVencer(avena);
  if (dias <= 0 || dias > 15 || calcularExcedente(avena) <= 0) return null;
  return avena;
}

// color y orden de cada prioridad
export const coloresPrioridad = { Alta: 'rojo', Media: 'naranja', Baja: 'azul' };
export const orden = Object.keys(coloresPrioridad);
export const grupos = { Alta: 'Urgente', Media: 'Pronto', Baja: 'Para revisar' };

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

