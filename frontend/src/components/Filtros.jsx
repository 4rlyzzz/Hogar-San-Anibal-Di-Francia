// filtros guardados en estado[grupo]; en vez de mostrarlos siempre:
// - un boton "Filtros" abre el panel
// - los que estan puestos se ven como pastillas que se quitan con ×
import { useId } from 'react';
import { IconoFiltro } from '../assets/iconos.jsx';
import { Desplegable } from './Desplegable.jsx';
import { abrirFiltros, cerrarFiltros, limpiarFiltros, cambiarFiltro, quitarFiltro } from '../acciones.js';

export function BotonFiltros({ grupo, activos, abierto }) {
  return (
    <button className={`btn-filtros ${activos ? 'con-filtros' : ''} ${abierto ? 'abierto' : ''}`} data-accion="abrir-filtros" onClick={() => abrirFiltros(grupo)}>
      <IconoFiltro /> Filtros {activos ? <span className="btn-filtros-numero">{activos}</span> : null}
    </button>
  );
}

// resultados: cuantos quedan
export function PanelFiltros({ grupo, resultados, children }) {
  return (
    <>
      <div className="filtros-fondo" data-accion="cerrar-filtros" onClick={cerrarFiltros} />
      <div className="panel-filtros" role="dialog" aria-label="Filtros">
        <div className="panel-filtros-cabecera">
          <b>Filtros</b>
          <button className="link" data-accion="limpiar-filtros" onClick={() => limpiarFiltros(grupo)}>Limpiar todo</button>
        </div>
        <div className="panel-filtros-campos">{children}</div>
        <button className="btn btn-verde panel-filtros-ver" data-accion="cerrar-filtros" onClick={cerrarFiltros}>Ver {resultados} resultados</button>
      </div>
    </>
  );
}

// opciones: [[valor, texto]]; solo se acepta un valor de la lista
export function CampoSelect({ grupo, campo, titulo, opciones, actual }) {
  const valores = opciones.map(([valor]) => valor);
  const id = useId();
  return (
    <div className="campo-filtro">
      <span id={id}>{titulo}</span>
      <Desplegable variante="filtro" data-campo={campo} aria-labelledby={id} opciones={opciones} valor={actual} onChange={v => cambiarFiltro(grupo, campo, v, valores)} />
    </div>
  );
}

export function CampoFecha({ grupo, campo, titulo, actual }) {
  return (
    <label className="campo-filtro">
      <span>{titulo}</span>
      <input type="date" value={actual} onChange={e => cambiarFiltro(grupo, campo, e.target.value)} />
    </label>
  );
}

// chips: [{ texto, campo }] de los filtros puestos
export function Chips({ grupo, chips }) {
  if (chips.length === 0) return null;
  return (
    <div className="chips">
      {chips.map(c => (
        <button key={c.campo} className="chip" data-accion="quitar-filtro" onClick={() => quitarFiltro(grupo, c.campo)} aria-label={`Quitar filtro ${c.texto}`}>
          {c.texto} <span aria-hidden="true">×</span>
        </button>
      ))}
      {chips.length > 1 && <button className="link" data-accion="limpiar-filtros" onClick={() => limpiarFiltros(grupo)}>Limpiar</button>}
    </div>
  );
}

// { 'a': 'A' } o ['a'] -> [['a', 'A']] con la opcion "todos" primero
export function opcionesCon(todos, valores) {
  return [['Todos', todos], ...valores.map(v => (Array.isArray(v) ? v : [v, v]))];
}
