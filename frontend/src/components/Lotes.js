// lotes: cada ingreso de un producto es un lote, con su fecha de ingreso y su propio vencimiento
// lote: { id, ingreso: Date, vence: '2026-11-05' o null, cantidad, quedan, origen }
//   origen: de donde salio si no fue un ingreso, ej. 'Sobrante del conteo'
// en la bd el lote es el mismo movimiento de ingreso (con vence y quedan); aqui va dentro del producto
import { meses, diasHasta, escapar, cantidadVencida, disponible } from './Comunes.js';

export { cantidadVencida, disponible };

let siguiente = 1;

// dias que lleva en el almacen
export function diasDesde(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(fecha);
  dia.setHours(0, 0, 0, 0);
  return Math.round((hoy - dia) / (1000 * 60 * 60 * 24));
}

// Date -> '19 oct'
export function fechaLote(fecha) {
  return `${String(fecha.getDate()).padStart(2, '0')} ${meses[fecha.getMonth()]}`;
}

// '2026-11-05' -> '05/11/26'
export function fechaVence(iso) {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio.slice(2)}`;
}

// 0 -> 'hoy', 1 -> 'hace 1 día', 5 -> 'hace 5 días'
const haceDias = n => (n === 0 ? 'hoy' : `hace ${n} ${n === 1 ? 'día' : 'días'}`);

const redondear = n => Math.round(n * 100) / 100;

export function lotesCon(item) {
  return (item.lotes || []).filter(l => l.quedan > 0);
}

export function estaVencido(lote) {
  return lote.vence !== null && diasHasta(lote.vence) < 0;
}

export function lotesVencidos(item) {
  return lotesCon(item).filter(estaVencido);
}

// orden de uso: primero lo que vence antes; lo que no tiene fecha, al final y por orden de llegada
function ordenUso(a, b) {
  if (a.vence && b.vence) return a.vence.localeCompare(b.vence) || a.ingreso - b.ingreso;
  if (a.vence) return -1;
  if (b.vence) return 1;
  return a.ingreso - b.ingreso;
}

// de que lotes saldria una cantidad, sin cambiar nada: [{ lote, cantidad }]
// conVencidos: un faltante del conteo puede salir de cualquier lote; una salida, solo de lo que no vencio
export function planDescuento(item, cantidad, conVencidos = false) {
  const lotes = lotesCon(item).filter(l => conVencidos || !estaVencido(l)).sort(ordenUso);
  const plan = [];
  let falta = cantidad;
  for (const lote of lotes) {
    if (falta <= 0) break;
    const sale = Math.min(lote.quedan, falta);
    plan.push({ lote, cantidad: redondear(sale) });
    falta = redondear(falta - sale);
  }
  return plan;
}

// aplica el plan; devuelve lo que se guarda en el movimiento: [{ id, ingreso: '19 oct', cantidad }]
export function descontar(plan) {
  return plan.map(({ lote, cantidad }) => {
    lote.quedan = redondear(lote.quedan - cantidad);
    return { id: lote.id, ingreso: fechaLote(lote.ingreso), cantidad };
  });
}

export function nuevoLote(item, { cantidad, vence = null, origen = '', ingreso = new Date() }) {
  const lote = { id: Date.now() + siguiente++, ingreso, vence, cantidad, quedan: cantidad, origen };
  item.lotes = [...(item.lotes || []), lote];
  return lote;
}

// verde: lejos, naranja: 15 dias o menos, rojo: 3 dias o menos, azul: sin fecha
export function colorLote(lote) {
  if (!lote.vence) return 'azul';
  const dias = diasHasta(lote.vence);
  if (dias <= 3) return 'rojo';
  if (dias <= 15) return 'naranja';
  return 'verde';
}

// 'Vence 05/11/26' · 'Venció 10/10/26' · 'Sin fecha · lleva 5 días'
export function textoVenceLote(lote) {
  if (!lote.vence) {
    const dias = diasDesde(lote.ingreso);
    if (dias === 0) return 'Sin fecha · ingresó hoy';
    return `Sin fecha · lleva ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  return `${estaVencido(lote) ? 'Venció' : 'Vence'} ${fechaVence(lote.vence)}`;
}

// tabla de lotes del detalle del producto, del que se usa primero al ultimo
export function TablaLotes(item, categoria) {
  const lotes = lotesCon(item).sort(ordenUso);
  const vencida = cantidadVencida(item);

  if (lotes.length === 0) return '';

  return `
    <div class="mov-pasos-titulo">
      <b>Lotes</b>
      <span class="lotes-ayuda">se usa primero el de arriba</span>
    </div>
    <ul class="lotes">
      ${lotes.map(l => `
        <li class="lote ${estaVencido(l) ? 'vencido' : ''}">
          <span class="lote-ingreso">
            <b>Ingresó ${fechaLote(l.ingreso)}</b>
            <small>${l.origen ? escapar(l.origen) : haceDias(diasDesde(l.ingreso))}</small>
          </span>
          <span class="etiqueta ${colorLote(l)}">${textoVenceLote(l)}</span>
          <span class="lote-quedan">${l.quedan} <small>${escapar(item.unidad)}</small></span>
        </li>
      `).join('')}
    </ul>
    ${vencida > 0 ? `
      <button class="btn btn-blanco btn-baja" data-accion="dar-baja" data-categoria="${categoria}" data-id="${item.id}">
        Dar de baja lo vencido (${vencida} ${escapar(item.unidad)})
      </button>` : ''}`;
}
