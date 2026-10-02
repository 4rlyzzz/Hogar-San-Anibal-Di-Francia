import { Encabezado, TituloSeccion, SinResultados, filtrarInsumos } from '../components/Comunes.js';
import { TarjetaAlimento, porcentaje } from '../components/Tarjetas.js';
import { Alerta } from '../components/Alerta.js';

export function paginaAlimentos(estado) {
  const lista = filtrarInsumos(estado.alimentos, estado, item => porcentaje(item) <= 25);
  const porVencer = estado.alimentos.filter(item => item.porVencer).length;

  const link = `<button class="link" data-accion="ver-todo">Ver todo el almacén</button>`;

  return `
    ${Encabezado('Alimentos', `Actualizado hoy · 09:14 · ${estado.alimentos.length} insumos en almacén seco y frío`, estado.filtro)}
    ${Alerta(estado)}
    ${TituloSeccion('AL', 'verde', 'Alimentos', `${lista.length} insumos · ${porVencer} por vencer`, link)}
    ${lista.length ? `<div class="grilla">${lista.map(TarjetaAlimento).join('')}</div>` : SinResultados()}
  `;
}
