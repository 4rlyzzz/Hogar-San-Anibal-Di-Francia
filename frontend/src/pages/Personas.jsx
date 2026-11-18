import { useEstado } from '../estado.js';
import { verPersona, descargarExcelPersonas } from '../acciones.js';
import { fechaDe } from '../logica/comunes.js';
import { personas, listaPersonas, montoDe, tiposDe, chipsPersonas } from '../logica/personas.js';
import { tiposMerch, ordenTipos, soles } from '../logica/merch.js';
import { textoAgregado } from '../logica/donadores.js';
import { Encabezado, SinResultados } from '../components/Comunes.jsx';
import { BotonFiltros, PanelFiltros, CampoSelect, Chips, opcionesCon } from '../components/Filtros.jsx';
import { BotonExcel } from './Historial.jsx';

const nombresTipo = Object.fromEntries(ordenTipos.map(t => [t, tiposMerch[t].nombre]));

function PastillasTipos({ tipos }) {
  if (tipos.length === 0) return <span className="uf-nada">—</span>;
  return (
    <>
      {tipos.slice(0, 2).map(([t, n]) => <span key={t} className="pastilla-actividad">{t}{n > 1 && <> <b>×{n}</b></>}</span>)}
      {tipos.length > 2 && <span className="pastilla-actividad mas">+{tipos.length - 2}</span>}
    </>
  );
}

export function Personas({ tipo }) {
  const estado = useEstado();
  const p = personas[tipo];
  const f = estado[p.filtros];
  const lista = listaPersonas(estado, tipo);
  const total = lista.reduce((suma, x) => suma + montoDe(x.movimientos, tipo), 0);
  const operaciones = lista.reduce((suma, x) => suma + x.movimientos.length, 0);
  const chips = chipsPersonas(f, nombresTipo);
  const abierto = estado.filtrosAbiertos === p.filtros;

  const todas = estado.historial.filter(x => x.movimiento === p.movimiento && x[p.campo]);
  const anios = [...new Set(todas.map(x => String(fechaDe(x.fecha).getFullYear())))].sort().reverse();
  const tiposPosibles = tipo === 'proveedor' ? ['paneton', 'promocional'] : ordenTipos;

  return (
    <>
      <Encabezado titulo={p.titulo} contador={estado[p.lista].length} />

      <div className="con-filtros">
        <div className="tabla">
          <div className="tabla-header barra-tabla">
            <span className="barra-tabla-resumen">
              <b>{lista.length}</b> {p.plural} · {operaciones} {operaciones === 1 ? 'compra' : 'compras'}<span className="solo-desktop"> · {soles(total)}</span>
            </span>
            <BotonFiltros grupo={p.filtros} activos={chips.length} abierto={abierto} />
            <BotonExcel hay={lista.length > 0} titulo="Descargar la lista en Excel" accion={`descargar-${p.lista}`} descargar={() => descargarExcelPersonas(tipo)} />
            <Chips grupo={p.filtros} chips={chips} />
          </div>

          <div className="donador-fila persona-fila fila-titulos">
            <span>NOMBRE</span><span>CONTACTO</span><span>{tipo === 'proveedor' ? 'LE COMPRAMOS' : 'COMPRÓ'}</span><span>TOTAL</span><span>ÚLTIMA</span>
          </div>

          {lista.map(({ persona: d, movimientos }) => {
            const ultima = movimientos[0];
            const monto = montoDe(movimientos, tipo);
            return (
              <button key={d.id} className="donador-fila persona-fila fila-boton" data-accion={`ver-${tipo}`} onClick={() => verPersona(tipo, d.id)}>
                <span className="donador-nombre">
                  {d.nombre}
                  {d.creadoPor && <small>{textoAgregado(d)}</small>}
                </span>
                <span className="donador-telefono">{d.telefono || '—'}{d.ruc && <small>RUC {d.ruc}</small>}</span>
                <span className="donador-actividades"><PastillasTipos tipos={tiposDe(movimientos, estado.merch)} /></span>
                <span className="donador-donaciones persona-monto">
                  {soles(monto)}
                  <small>{movimientos.length} {movimientos.length === 1 ? 'compra' : 'compras'}</small>
                </span>
                <span className="donador-ultima">{ultima ? ultima.fecha.split(' ').slice(0, 2).join(' ') : '—'}</span>
              </button>
            );
          })}

          {lista.length === 0 && <SinResultados texto={chips.length ? `Ningún ${p.singular} coincide con los filtros` : `Todavía no hay ${p.plural} registrados`} />}
        </div>

        {abierto && (
          <PanelFiltros grupo={p.filtros} resultados={lista.length}>
            <CampoSelect grupo={p.filtros} campo="tipoMerch" titulo="Tipo de merchandising" opciones={opcionesCon('Todos', tiposPosibles.map(t => [t, nombresTipo[t]]))} actual={f.tipoMerch} />
            <CampoSelect grupo={p.filtros} campo="anio" titulo="Año" opciones={opcionesCon('Todos', anios)} actual={f.anio} />
          </PanelFiltros>
        )}
      </div>
    </>
  );
}
