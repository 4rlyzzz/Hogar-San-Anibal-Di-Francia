import { Encabezado, TituloSeccion, SinResultados, filtrarInsumos } from '../components/Comunes.js';
import { TarjetaSalud } from '../components/Tarjetas.js';
import { Alerta } from '../components/Alerta.js';

export function paginaSalud(estado) {
  const lista = filtrarInsumos(estado.salud, estado, item => item.cantidad < item.minimo);
  const bajoMinimo = estado.salud.filter(item => item.cantidad < item.minimo).length;

  const link = `<button class="link" data-accion="seccion" data-seccion="Historial">Historial de entregas</button>`;

  return `
    ${Encabezado('Salud y medicinas', `Actualizado hoy · 09:14 · ${estado.salud.length} insumos · ${bajoMinimo} bajo stock mínimo`, estado.filtro)}
    ${Alerta(estado)}
    ${TituloSeccion('SA', 'azul', 'Salud y medicinas', `${lista.length} insumos · ${bajoMinimo} bajo mínimo`, link)}
    ${lista.length ? `<div class="grilla">${lista.map(TarjetaSalud).join('')}</div>` : SinResultados()}
  `;
}
