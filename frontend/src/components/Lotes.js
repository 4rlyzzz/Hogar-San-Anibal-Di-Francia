// cada ingreso es un lote con su propio vencimiento
// lote: { id, ingreso, vence, cantidad, quedan, origen }
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

// primero lo que vence antes; sin fecha, por orden de llegada
function ordenUso(a, b) {
  if (a.vence && b.vence) return a.vence.localeCompare(b.vence) || a.ingreso - b.ingreso;
  if (a.vence) return -1;
  if (b.vence) return 1;
  return a.ingreso - b.ingreso;
}

// de que lotes sale una cantidad (sin cambiar nada)
// conVencidos: para el faltante de un conteo
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

// descuenta el plan y devuelve lo que se guarda en el movimiento
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

// color segun los dias que faltan
export function colorLote(lote) {
  if (!lote.vence) return 'azul';
  const dias = diasHasta(lote.vence);
  if (dias <= 3) return 'rojo';
  if (dias <= 15) return 'naranja';
  return 'verde';
}

export function textoVenceLote(lote) {
  if (!lote.vence) {
    const dias = diasDesde(lote.ingreso);
    if (dias === 0) return 'Sin fecha · ingresó hoy';
    return `Sin fecha · lleva ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  return `${estaVencido(lote) ? 'Venció' : 'Vence'} ${fechaVence(lote.vence)}`;
}

// tabla de lotes del detalle del producto
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
      <button class="btn btn-blanco btn-baja" data-accion="dar-baja" data-categoria="${escapar(categoria)}" data-id="${escapar(item.id)}">
        Dar de baja lo vencido (${vencida} ${escapar(item.unidad)})
      </button>` : ''}`;
}
