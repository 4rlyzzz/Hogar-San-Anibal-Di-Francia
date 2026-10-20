import { Encabezado, TituloSeccion, SinResultados, filtrarInsumos, porVencer } from '../components/Comunes.js';
import { Tarjeta } from '../components/Tarjetas.js';
import { Alerta } from '../components/Alerta.js';

export function paginaAlimentos(estado) {
  const lista = filtrarInsumos(estado.alimentos, estado);
  const cantidadPorVencer = estado.alimentos.filter(porVencer).length;

  const boton = `<button class="btn-agregar" data-accion="agregar-producto" data-categoria="Alimentos">+ Agregar producto</button>`;

  return `
    ${Encabezado('Alimentos', `Productos perecibles · ${estado.alimentos.length} insumos en almacén seco y frío`, estado.filtro)}
    ${Alerta(estado)}
    ${TituloSeccion('AL', 'verde', 'Alimentos', `${lista.length} insumos · ${cantidadPorVencer} por vencer`, boton)}
    ${lista.length ? `<div class="grilla">${lista.map(item => Tarjeta(item, 'Alimentos')).join('')}</div>` : SinResultados()}
  `;
}
