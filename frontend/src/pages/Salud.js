import { Encabezado, SinResultados, filtrarInsumos, porVencer } from '../components/Comunes.js';
import { Tarjeta } from '../components/Tarjetas.js';

export function paginaSalud(estado) {
  const lista = filtrarInsumos(estado.salud, estado);
  const conteos = {
    'Por vencer': estado.salud.filter(porVencer).length,
    'Stock bajo': estado.salud.filter(item => item.cantidad < item.minimo).length,
  };

  return `
    ${Encabezado(`Salud <span class="contador">${estado.salud.length}</span>`, '', estado.filtro, conteos)}
    ${lista.length ? `<div class="grilla">${lista.map(item => Tarjeta(item, 'Salud')).join('')}</div>` : SinResultados()}
  `;
}
