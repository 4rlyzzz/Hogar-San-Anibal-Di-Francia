import { useEstado } from '../estado.js';
import { cambiar } from '../acciones.js';
import { filtrarInsumos, porVencer, bajoMinimo, disponible } from '../logica/comunes.js';
import {
  CATEGORIA, filtrarMerch, chipsMerch, opcionesTipo, opcionesSubcategoria, opcionesStockMerch, opcionesVenceMerch, ordenesMerch,
  tiposMerch, ordenTipos, soles,
} from '../logica/merch.js';
import { Encabezado, SinResultados } from '../components/Comunes.jsx';
import { BotonFiltros, Chips, PanelFiltros, CampoSelect } from '../components/Filtros.jsx';
import { Tarjeta } from '../components/Tarjeta.jsx';

function PestanasTipo({ productos, actual }) {
  return (
    <div className="filtros pestanas-merch" role="tablist" aria-label="Tipo de merchandising">
      {['Todos', ...ordenTipos].map(t => {
        const n = t === 'Todos' ? productos.length : productos.filter(p => p.tipoMerch === t).length;
        return (
          <button key={t} role="tab" aria-selected={t === actual} className={t === actual ? 'activo' : ''} data-accion="tipo-merch" data-tipo={t}
            onClick={() => cambiar(e => { e.merchFiltros.tipoMerch = t; e.merchFiltros.subcategoria = 'Todos'; })}>
            {t === 'Todos' ? 'Todos' : tiposMerch[t].nombre} <span className="filtro-numero">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Merchandising() {
  const estado = useEstado();
  const productos = estado.merch;
  const f = estado.merchFiltros;
  const lista = filtrarMerch(filtrarInsumos(productos, estado), f);
  const chips = chipsMerch(f).filter(c => c.campo !== 'tipoMerch');
  const abierto = estado.filtrosAbiertos === 'merchFiltros';
  const conteos = {
    'Por vencer': productos.filter(porVencer).length,
    'Stock bajo': productos.filter(bajoMinimo).length,
  };
  const subs = f.tipoMerch === 'Todos' ? opcionesSubcategoria : [['Todos', 'Todas'], ...tiposMerch[f.tipoMerch].subcategorias];
  const valorStock = Math.round(lista.reduce((suma, p) => suma + disponible(p) * (p.precio ?? 0), 0) * 100) / 100;

  return (
    <div className="con-filtros con-filtros-inventario">
      <Encabezado
        titulo="Merchandising"
        contador={productos.length}
        filtroActivo={estado.filtro}
        conteos={conteos}
        extra={<BotonFiltros grupo="merchFiltros" activos={chips.length} abierto={abierto} />}
      />
      <div className="merch-barra">
        <PestanasTipo productos={productos} actual={f.tipoMerch} />
        {lista.length > 0 && <span className="merch-valor" title="Precio de venta por lo que se puede vender">En stock: <b>{soles(valorStock)}</b> a precio de venta</span>}
      </div>
      {chips.length > 0 && <div className="chips-inventario"><Chips grupo="merchFiltros" chips={chips} /></div>}
      {lista.length
        ? <div className="grilla">{lista.map(item => <Tarjeta key={item.id} item={item} categoria={CATEGORIA} />)}</div>
        : <SinResultados texto={productos.length ? 'Sin productos en este filtro' : 'Todavía no hay merchandising: regístralo con el botón + (Registrar ingreso → Crear producto nuevo)'} />}

      {abierto && (
        <PanelFiltros grupo="merchFiltros" resultados={lista.length}>
          <CampoSelect grupo="merchFiltros" campo="tipoMerch" titulo="Tipo" opciones={opcionesTipo} actual={f.tipoMerch} />
          {subs.length > 1 && <CampoSelect grupo="merchFiltros" campo="subcategoria" titulo="Subcategoría" opciones={subs} actual={f.subcategoria} />}
          <CampoSelect grupo="merchFiltros" campo="stock" titulo="Stock" opciones={opcionesStockMerch} actual={f.stock} />
          <CampoSelect grupo="merchFiltros" campo="vencimiento" titulo="Vencimiento (panetones y alimentos)" opciones={opcionesVenceMerch} actual={f.vencimiento} />
          <CampoSelect grupo="merchFiltros" campo="orden" titulo="Ordenar por" opciones={ordenesMerch} actual={f.orden} />
        </PanelFiltros>
      )}
    </div>
  );
}
