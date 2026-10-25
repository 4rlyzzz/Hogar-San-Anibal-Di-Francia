import { Encabezado, SinResultados, filtrarInsumos, porVencer, bajoMinimo, nombreCategoria, escapar } from '../components/Comunes.js';
import { Tarjeta } from '../components/Tarjetas.js';
import { BotonFiltros, Chips } from '../components/Filtros.js';
import { filtrarInventario, chipsInventario, PanelInventario } from '../components/FiltrosInventario.js';

// pagina de Alimentos y de Salud e higiene
export function paginaInventario(estado, categoria, productos) {
  const f = estado.inventarioFiltros;
  const lista = filtrarInventario(filtrarInsumos(productos, estado), f);
  const chips = chipsInventario(f);
  const abierto = estado.filtrosAbiertos === 'inventarioFiltros';
  const unidades = [...new Set(productos.map(item => item.unidad))].sort((a, b) => a.localeCompare(b));
  const conteos = {
    'Por vencer': productos.filter(porVencer).length,
    'Stock bajo': productos.filter(bajoMinimo).length,
  };
  const titulo = `${escapar(nombreCategoria(categoria))} <span class="contador">${productos.length}</span>`;

  return `
    <div class="con-filtros con-filtros-inventario">
      ${Encabezado(titulo, '', estado.filtro, conteos, BotonFiltros('inventarioFiltros', chips.length, abierto))}
      ${chips.length ? `<div class="chips-inventario">${Chips('inventarioFiltros', chips)}</div>` : ''}
      ${lista.length ? `<div class="grilla">${lista.map(item => Tarjeta(item, categoria)).join('')}</div>` : SinResultados()}
      ${abierto ? PanelInventario(f, unidades, lista.length) : ''}
    </div>
  `;
}
