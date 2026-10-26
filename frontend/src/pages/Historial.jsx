import { useState } from 'react';
import { useEstado } from '../estado.js';
import { IconoDescargar } from '../assets/iconos.jsx';
import { verMovimiento, descargarExcelHistorial } from '../acciones.js';
import { nombreCategoria, nombresCategoria, textoCambio, textoStock, textoDetalle } from '../logica/comunes.js';
import { filtrarHistorial, opcionesDe, chipsHistorial } from '../logica/historial.js';
import { Encabezado, clasesMovimiento } from '../components/Comunes.jsx';
import { BotonFiltros, PanelFiltros, CampoSelect, CampoFecha, Chips, opcionesCon } from '../components/Filtros.jsx';

// boton de descarga: se desactiva mientras se crea el archivo
// accion: nombre para las pruebas (data-accion)
export function BotonExcel({ hay, titulo, accion, descargar }) {
  const [creando, setCreando] = useState(false);
  return (
    <button
      className="btn-descargar"
      data-accion={accion}
      disabled={!hay || creando}
      title={titulo}
      onClick={async () => {
        setCreando(true);
        await descargar();
        setCreando(false);
      }}
    >
      <IconoDescargar /><span className="solo-desktop">Descargar</span> Excel
    </button>
  );
}

export function Historial() {
  const estado = useEstado();
  const f = estado.historialFiltros;
  const filas = filtrarHistorial(estado);
  const ingresos = filas.filter(x => x.movimiento === 'Ingreso').length;

  // los productos se acotan a la categoria elegida
  const paraProductos = f.categoria === 'Todos' ? estado.historial : estado.historial.filter(x => x.categoria === f.categoria);
  const chips = chipsHistorial(f);
  // "para quien" solo en Salud
  const ninos = f.categoria === 'Alimentos' ? [] : opcionesDe(estado.historial, 'para');
  const abierto = estado.filtrosAbiertos === 'historialFiltros';

  return (
    <>
      <Encabezado titulo="Historial" contador={estado.historial.length} />

      <div className="con-filtros">
        <div className="tabla">
          <div className="tabla-header barra-tabla">
            <span className="barra-tabla-resumen">
              <b>{filas.length}</b> movimientos<span className="solo-desktop"> · {ingresos} ingresos · {filas.length - ingresos} salidas</span>
            </span>
            <BotonFiltros grupo="historialFiltros" activos={chips.length} abierto={abierto} />
            <BotonExcel hay={filas.length > 0} titulo="Descargar lo filtrado en Excel" accion="descargar-historial" descargar={descargarExcelHistorial} />
            <Chips grupo="historialFiltros" chips={chips} />
          </div>

          <div className="fila fila-titulos">
            <span>FECHA</span><span>INSUMO</span><span>CATEGORÍA</span><span>MOVIMIENTO</span><span>CANTIDAD</span><span>STOCK</span><span>DETALLE</span><span>RESPONSABLE</span>
          </div>

          {filas.map(fila => {
            const indice = estado.historial.indexOf(fila);
            return (
              <button key={indice} className={`fila fila-boton ${clasesMovimiento[fila.movimiento]}`} data-accion="ver-movimiento" onClick={() => verMovimiento(indice)}>
                <span className="fila-fecha">{fila.fecha}</span>
                <span className="fila-insumo">{fila.insumo}</span>
                <span className="fila-categoria"><span className={`pastilla ${fila.categoria === 'Salud' ? 'azul' : 'verde'}`}>{nombreCategoria(fila.categoria)}</span></span>
                <span className="fila-movimiento">● {fila.movimiento}</span>
                <span className="fila-cantidad">{textoCambio(fila)}</span>
                <span className="fila-saldo" title="Stock antes → después de este movimiento">{textoStock(fila)}</span>
                <span className={`fila-detalle ${fila.inicial ? 'inicial' : ''}`}>{textoDetalle(fila)}</span>
                <span className="fila-responsable">{fila.responsable}</span>
              </button>
            );
          })}

          {filas.length === 0 && <div className="vacio">Ningún movimiento coincide con los filtros</div>}
        </div>

        {abierto && (
          <PanelFiltros grupo="historialFiltros" resultados={filas.length}>
            <CampoSelect grupo="historialFiltros" campo="movimiento" titulo="Movimiento" opciones={[['Todos', 'Todos'], ['Ingreso', 'Solo ingresos'], ['Salida', 'Solo salidas'], ['Ajuste', 'Solo ajustes']]} actual={f.movimiento} />
            <CampoSelect grupo="historialFiltros" campo="categoria" titulo="Categoría" opciones={opcionesCon('Todas', Object.entries(nombresCategoria))} actual={f.categoria} />
            <CampoSelect grupo="historialFiltros" campo="responsable" titulo="Responsable" opciones={opcionesCon('Todos', opcionesDe(estado.historial, 'responsable'))} actual={f.responsable} />
            <CampoSelect grupo="historialFiltros" campo="producto" titulo="Producto" opciones={opcionesCon('Todos', opcionesDe(paraProductos, 'insumo'))} actual={f.producto} />
            {ninos.length > 0 && <CampoSelect grupo="historialFiltros" campo="para" titulo="Para (niño/a)" opciones={opcionesCon('Todos', ninos)} actual={f.para} />}
            <CampoSelect grupo="historialFiltros" campo="donador" titulo="Donador" opciones={opcionesCon('Todos', opcionesDe(estado.historial, 'donador'))} actual={f.donador} />
            <CampoSelect grupo="historialFiltros" campo="actividad" titulo="Actividad de donación" opciones={opcionesCon('Todas', opcionesDe(estado.historial, 'actividad'))} actual={f.actividad} />
            <div className="campos-dos">
              <CampoFecha grupo="historialFiltros" campo="desde" titulo="Desde" actual={f.desde} />
              <CampoFecha grupo="historialFiltros" campo="hasta" titulo="Hasta" actual={f.hasta} />
            </div>
          </PanelFiltros>
        )}
      </div>
    </>
  );
}
