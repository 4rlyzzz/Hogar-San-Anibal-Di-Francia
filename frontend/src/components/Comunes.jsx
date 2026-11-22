// partes que se repiten en las paginas
import { useRef, useState } from 'react';
import { ordenar, verMovimiento, cambiar } from '../acciones.js';
import { cambioDe, textoCambio } from '../logica/comunes.js';
import { paginar } from '../logica/paginas.js';

// ---------- paginas ----------
// cuantos por pagina eligio cada lista (se recuerda mientras la app esta abierta)
const tamanosElegidos = new Map();

// clave: nombre de la lista; opciones: tamanos posibles (tamanosTabla o tamanosTarjetas)
// firma: cambia cuando cambian los filtros o la busqueda, y entonces se vuelve a la pagina 1
export function usePaginacion(clave, lista, opciones, firma) {
  const [porPagina, setPorPagina] = useState(() => tamanosElegidos.get(clave) ?? opciones[0]);
  const [pagina, setPagina] = useState(1);
  const [firmaVista, setFirmaVista] = useState(firma);
  if (firma !== firmaVista) {
    setFirmaVista(firma);
    setPagina(1);
  }
  const p = paginar(lista, pagina, porPagina);
  return {
    visibles: p.visibles,
    control: {
      ...p,
      opciones,
      porPagina,
      irA: setPagina,
      cambiarTamano: n => {
        tamanosElegidos.set(clave, n);
        setPorPagina(n);
        setPagina(1);
      },
    },
  };
}

// debajo de la lista: cuantos ver y las flechas para pasar de pagina
// con pocos (no llegan al tamano mas chico) no se muestra
export function Paginacion({ control, nombre = 'resultados' }) {
  const barra = useRef(null);
  const { total, pagina, paginas, desde, hasta, opciones, porPagina, irA, cambiarTamano } = control;
  if (total <= opciones[0]) return null;

  // al cambiar de pagina se vuelve al principio de la lista
  const subir = () => requestAnimationFrame(() => {
    const lista = barra.current?.closest('.con-filtros') ?? barra.current?.parentElement;
    if (lista && lista.getBoundingClientRect().top < 0) lista.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  const ir = n => {
    irA(n);
    subir();
  };

  return (
    <nav className="paginacion" ref={barra} aria-label={`Páginas de ${nombre}`}>
      <div className="paginacion-tamano">
        <span>Ver</span>
        <div className="filtros" role="group" aria-label="Cuántos ver por página">
          {opciones.map(n => (
            <button key={n} type="button" className={n === porPagina ? 'activo' : ''} aria-pressed={n === porPagina} data-accion="por-pagina" onClick={() => cambiarTamano(n)}>{n}</button>
          ))}
        </div>
      </div>
      <span className="paginacion-rango"><b>{desde}–{hasta}</b> de {total}</span>
      <div className="paginacion-flechas">
        <button type="button" className="paginacion-flecha" data-accion="pagina-anterior" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)}>‹</button>
        <span className="paginacion-pagina">{pagina} / {paginas}</span>
        <button type="button" className="paginacion-flecha" data-accion="pagina-siguiente" aria-label="Página siguiente" disabled={pagina >= paginas} onClick={() => ir(pagina + 1)}>›</button>
      </div>
    </nav>
  );
}

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
