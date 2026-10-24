import { paginaInventario } from './Inventario.js';

export function paginaAlimentos(estado) {
  return paginaInventario(estado, 'Alimentos', estado.alimentos);
}
