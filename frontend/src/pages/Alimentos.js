import { Encabezado, SinResultados, filtrarInsumos, porVencer } from '../components/Comunes.js';
import { Tarjeta } from '../components/Tarjetas.js';

export function paginaAlimentos(estado) {
  const lista = filtrarInsumos(estado.alimentos, estado);
  const conteos = {
    'Por vencer': estado.alimentos.filter(porVencer).length,
    'Stock bajo': estado.alimentos.filter(item => item.cantidad < item.minimo).length,
  };

  return `
    ${Encabezado(`Alimentos <span class="contador">${estado.alimentos.length}</span>`, '', estado.filtro, conteos)}
    ${lista.length ? `<div class="grilla">${lista.map(item => Tarjeta(item, 'Alimentos')).join('')}</div>` : SinResultados()}
  `;
}
