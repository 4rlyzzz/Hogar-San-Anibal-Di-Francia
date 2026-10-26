// partes que se repiten en las paginas
import { ordenar, verMovimiento, cambiar } from '../acciones.js';
import { cambioDe, textoCambio } from '../logica/comunes.js';

export const clasesMovimiento = { Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' };

// titulo de columna que ordena
// grupo: donde se guarda el orden en el estado
export function TituloOrden({ texto, orden, filtros, grupo }) {
  const activo = filtros.orden === orden;
  const flecha = activo ? (filtros.invertido ? '↑' : '↓') : '';
  return (
    <button className={`titulo-orden ${activo ? 'activo' : ''}`} data-accion="ordenar" onClick={() => ordenar(grupo, orden)}>
      {texto} {flecha}
    </button>
  );
}

// filtroActivo: Todos / Por vencer / Stock bajo (solo en Alimentos y Salud)
// conteos: numero que va en cada boton de filtro
// extra: lo que va al lado (boton Filtros)
export function Encabezado({ titulo, contador, subtitulo, filtroActivo, conteos = {}, extra }) {
  const filtros = filtroActivo && (
    <div className="filtros">
      {['Todos', 'Por vencer', 'Stock bajo'].map(f => (
        <button key={f} className={f === filtroActivo ? 'activo' : ''} data-accion="filtro" onClick={() => cambiar(e => (e.filtro = f))}>
          {f}{conteos[f] ? <> <span className="filtro-numero">{conteos[f]}</span></> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div className="encabezado">
      <div>
        <h1>{titulo}{contador != null && <> <span className="contador">{contador}</span></>}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {extra ? <div className="encabezado-derecha">{filtros}{extra}</div> : filtros}
    </div>
  );
}

export function TituloSeccion({ codigo, color, titulo, detalle, children }) {
  return (
    <div className="titulo-seccion">
      <span className={`titulo-seccion-icono ${color}`}>{codigo}</span>
      <h2>{titulo}</h2>
      <span className="titulo-seccion-detalle">{detalle}</span>
      {children}
    </div>
  );
}

// recuadro de resumen; unidad: [singular, plural]
export function Recuadro({ color, Icono, numero, titulo, detalle, unidad = ['producto', 'productos'] }) {
  return (
    <div className="recuadro">
      <div className="recuadro-cabecera">
        <div className={`recuadro-icono ${color}`}><Icono /></div>
        <span className="recuadro-titulo">{titulo}</span>
      </div>
      <div className="recuadro-fila">
        <b className="recuadro-numero">{numero}</b>
        <span className="recuadro-unidad">{numero === 1 ? unidad[0] : unidad[1]}</span>
        <span className={`recuadro-detalle texto-${color}`}>{detalle}</span>
      </div>
    </div>
  );
}

export function SinResultados({ texto = 'Sin insumos en este filtro' }) {
  return <div className="vacio">{texto}</div>;
}

// lista de movimientos con su total
// navegable: cada fila abre su detalle
export function MovimientosEntre({ pasos, unidad, navegable = false }) {
  if (pasos.length === 0) return <p className="correccion-vacio">No hubo ingresos, salidas ni ajustes en medio.</p>;

  const total = Math.round(pasos.reduce((suma, p) => suma + cambioDe(p.fila), 0) * 100) / 100;
  const Etiqueta = navegable ? 'button' : 'div';

  return (
    <>
      <ul className="mov-pasos correccion-lista">
        {pasos.map(p => (
          <li key={p.indice}>
            <Etiqueta
              className={`mov-paso ${clasesMovimiento[p.fila.movimiento]}`}
              {...(navegable ? { 'data-accion': 'ver-movimiento', onClick: () => verMovimiento(p.indice) } : {})}
            >
              <span className="mov-paso-fecha">{p.fila.fecha}</span>
              <span className="mov-paso-tipo">● {p.fila.movimiento} <small>{p.fila.responsable}</small></span>
              <span className="mov-paso-cambio">{textoCambio(p.fila)}</span>
            </Etiqueta>
          </li>
        ))}
      </ul>
      <p className="correccion-total">En total: {total > 0 ? '+' : total < 0 ? '−' : ''}{Math.abs(total)} {unidad}</p>
    </>
  );
}
