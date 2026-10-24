import { paginaInventario } from './Inventario.js';

export function paginaSalud(estado) {
  return paginaInventario(estado, 'Salud', estado.salud);
}
