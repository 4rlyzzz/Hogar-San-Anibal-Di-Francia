import { useEstado } from '../estado.js';
import { filtrarInsumos, porVencer, bajoMinimo, nombreCategoria } from '../logica/comunes.js';
import { filtrarInventario, chipsInventario, opcionesVence, opcionesLleva, opcionesStock, ordenesInventario } from '../logica/inventario.js';
import { Encabezado, SinResultados } from '../components/Comunes.jsx';
import { BotonFiltros, Chips, PanelFiltros, CampoSelect, opcionesCon } from '../components/Filtros.jsx';
import { Tarjeta } from '../components/Tarjeta.jsx';

// pagina de Alimentos y de Salud e higiene
export function Inventario({ categoria }) {
  const estado = useEstado();
  const productos = categoria === 'Salud' ? estado.salud : estado.alimentos;
  const f = estado.inventarioFiltros;
  const lista = filtrarInventario(filtrarInsumos(productos, estado), f);
  const chips = chipsInventario(f);
  const abierto = estado.filtrosAbiertos === 'inventarioFiltros';
  const unidades = [...new Set(productos.map(item => item.unidad))].sort((a, b) => a.localeCompare(b));
  const conteos = {
    'Por vencer': productos.filter(porVencer).length,
    'Stock bajo': productos.filter(bajoMinimo).length,
  };

  return (
    <div className="con-filtros con-filtros-inventario">
      <Encabezado
        titulo={nombreCategoria(categoria)}
        contador={productos.length}
        filtroActivo={estado.filtro}
        conteos={conteos}
        extra={<BotonFiltros grupo="inventarioFiltros" activos={chips.length} abierto={abierto} />}
      />
      {chips.length > 0 && <div className="chips-inventario"><Chips grupo="inventarioFiltros" chips={chips} /></div>}
      {lista.length
        ? <div className="grilla">{lista.map(item => <Tarjeta key={item.id} item={item} categoria={categoria} />)}</div>
        : <SinResultados />}

      {abierto && (
        <PanelFiltros grupo="inventarioFiltros" resultados={lista.length}>
          <CampoSelect grupo="inventarioFiltros" campo="vencimiento" titulo="Vencimiento" opciones={opcionesVence} actual={f.vencimiento} />
          <CampoSelect grupo="inventarioFiltros" campo="lleva" titulo="Lleva en el almacén (lo que no tiene fecha)" opciones={opcionesLleva} actual={f.lleva} />
          <CampoSelect grupo="inventarioFiltros" campo="stock" titulo="Stock" opciones={opcionesStock} actual={f.stock} />
          <CampoSelect grupo="inventarioFiltros" campo="unidad" titulo="Se cuenta en" opciones={opcionesCon('Todos', unidades)} actual={f.unidad} />
          <CampoSelect grupo="inventarioFiltros" campo="orden" titulo="Ordenar por" opciones={ordenesInventario} actual={f.orden} />
        </PanelFiltros>
      )}
    </div>
  );
}
