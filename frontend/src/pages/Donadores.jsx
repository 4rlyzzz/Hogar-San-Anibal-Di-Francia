import { useEstado } from '../estado.js';
import { verDonador, descargarExcelDonadores } from '../acciones.js';
import { fechaDe } from '../logica/comunes.js';
import { listaDonadores, actividadesDe, chipsDonadores, textoAgregado } from '../logica/donadores.js';
import { Encabezado, SinResultados } from '../components/Comunes.jsx';
import { BotonFiltros, PanelFiltros, CampoSelect, Chips, opcionesCon } from '../components/Filtros.jsx';
import { BotonExcel } from './Historial.jsx';

// pastillas de actividades: las 2 que mas apoyo y "+N" si hay mas
function PastillasActividades({ actividades }) {
  if (actividades.length === 0) return <span className="uf-nada">—</span>;
  return (
    <>
      {actividades.slice(0, 2).map(([a, n]) => <span key={a} className="pastilla-actividad">{a}{n > 1 && <> <b>×{n}</b></>}</span>)}
      {actividades.length > 2 && <span className="pastilla-actividad mas">+{actividades.length - 2}</span>}
    </>
  );
}

export function Donadores() {
  const estado = useEstado();
  const f = estado.donadoresFiltros;
  const lista = listaDonadores(estado);
  const totalDonaciones = lista.reduce((suma, x) => suma + x.donaciones.length, 0);
  const chips = chipsDonadores(f);
  const abierto = estado.filtrosAbiertos === 'donadoresFiltros';

  // opciones de los filtros
  const todas = estado.historial.filter(x => x.movimiento === 'Ingreso' && x.donador);
  const actividades = [...new Set(todas.map(x => x.actividad).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const anios = [...new Set(todas.map(x => String(fechaDe(x.fecha).getFullYear())))].sort().reverse();

  return (
    <>
      <Encabezado titulo="Donadores" contador={estado.donadores.length} />

      <div className="con-filtros">
        <div className="tabla">
          <div className="tabla-header barra-tabla">
            <span className="barra-tabla-resumen">
              <b>{lista.length}</b> donadores · {totalDonaciones} donaciones
            </span>
            <BotonFiltros grupo="donadoresFiltros" activos={chips.length} abierto={abierto} />
            <BotonExcel hay={lista.length > 0} titulo="Descargar la lista en Excel" accion="descargar-donadores" descargar={descargarExcelDonadores} />
            <Chips grupo="donadoresFiltros" chips={chips} />
          </div>

          <div className="donador-fila fila-titulos">
            <span>NOMBRE</span><span>CONTACTO</span><span>ACTIVIDADES QUE APOYÓ</span><span>DONACIONES</span><span>ÚLTIMA</span>
          </div>

          {lista.map(({ donador: d, donaciones }) => {
            const n = donaciones.length;
            const ultima = donaciones[0];
            return (
              <button key={d.id} className="donador-fila fila-boton" data-accion="ver-donador" onClick={() => verDonador(d.id)}>
                <span className="donador-nombre">
                  {d.nombre}
                  {d.creadoPor && <small>{textoAgregado(d)}</small>}
                </span>
                <span className="donador-telefono">{d.telefono}</span>
                <span className="donador-actividades"><PastillasActividades actividades={actividadesDe(donaciones)} /></span>
                <span className="donador-donaciones">{n}<span className="solo-movil"> {n === 1 ? 'donación' : 'donaciones'}</span></span>
                <span className="donador-ultima">{ultima ? ultima.fecha.split(' ').slice(0, 2).join(' ') : '—'}</span>
              </button>
            );
          })}

          {lista.length === 0 && <SinResultados texto={chips.length ? 'Ningún donador coincide con los filtros' : 'Todavía no hay donadores registrados'} />}
        </div>

        {abierto && (
          <PanelFiltros grupo="donadoresFiltros" resultados={lista.length}>
            <CampoSelect grupo="donadoresFiltros" campo="actividad" titulo="Actividad que apoyó" opciones={opcionesCon('Todas', actividades)} actual={f.actividad} />
            <CampoSelect grupo="donadoresFiltros" campo="anio" titulo="Año" opciones={opcionesCon('Todos', anios)} actual={f.anio} />
          </PanelFiltros>
        )}
      </div>
    </>
  );
}
