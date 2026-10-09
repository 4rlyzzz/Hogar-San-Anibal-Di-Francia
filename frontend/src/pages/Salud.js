import { Encabezado, TituloSeccion, SinResultados, filtrarInsumos } from '../components/Comunes.js';
import { Tarjeta } from '../components/Tarjetas.js';
import { Alerta } from '../components/Alerta.js';

export function paginaSalud(estado) {
  const lista = filtrarInsumos(estado.salud, estado);
  const bajoMinimo = estado.salud.filter(item => item.cantidad < item.minimo).length;

  const boton = `<button class="btn-agregar" data-accion="agregar-producto" data-categoria="Salud">+ Agregar producto</button>`;

  return `
    ${Encabezado('Salud y medicinas', `Productos indispensables · ${estado.salud.length} insumos · ${bajoMinimo} bajo stock mínimo`, estado.filtro)}
    ${Alerta(estado)}
    ${TituloSeccion('SA', 'azul', 'Salud y medicinas', `${lista.length} insumos · ${bajoMinimo} bajo mínimo`, boton)}
    ${lista.length ? `<div class="grilla">${lista.map(item => Tarjeta(item, 'Salud')).join('')}</div>` : SinResultados()}
  `;
}
