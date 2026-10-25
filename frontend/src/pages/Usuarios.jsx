import { useEstado } from '../estado.js';
import { usuario } from '../data/datos.js';
import { verActividad, cambiarRol, cambiarActivo, roles } from '../acciones.js';
import { iniciales, fechaLarga, textoFecha, tiempoRelativo, mismoId } from '../logica/comunes.js';
import { actividadDe } from '../logica/actividad.js';
import { Encabezado, SinResultados, TituloOrden } from '../components/Comunes.jsx';
import { BotonFiltros, PanelFiltros, CampoSelect, Chips } from '../components/Filtros.jsx';
import { Desplegable } from '../components/Desplegable.jsx';

// ordenes; "invertido" los da vuelta
const ordenes = {
  nombre: { texto: 'Nombre (A-Z)', comparar: (a, b) => a.cuenta.nombre.localeCompare(b.cuenta.nombre) },
  acceso: { texto: 'Último acceso', comparar: (a, b) => (b.cuenta.ultimoAcceso ?? 0) - (a.cuenta.ultimoAcceso ?? 0) },
  movimientos: { texto: 'Más movimientos', comparar: (a, b) => b.registros.length - a.registros.length },
  agregado: { texto: 'Agregado recientemente', comparar: (a, b) => b.cuenta.creado - a.cuenta.creado },
};

const filtrosRol = [['Todos', 'Todos los roles'], ['Administrador', 'Administrador'], ['Usuario', 'Usuario']];
const filtrosEstado = [['Todos', 'Todos los estados'], ['Activos', 'Activos'], ['Desactivados', 'Desactivados']];

function pasaFiltros(c, filtros, texto) {
  if (filtros.rol !== 'Todos' && c.rol !== filtros.rol) return false;
  if (filtros.estado === 'Activos' && !c.activo) return false;
  if (filtros.estado === 'Desactivados' && c.activo) return false;
  return (c.nombre + ' ' + c.usuario).toLowerCase().includes(texto);
}

// ultima: lo ultimo que hizo
function FilaUsuario({ c, registros, ultima }) {
  // no puede cambiarse el rol ni desactivarse a si mismo
  const esYo = mismoId(c.id, usuario.id);

  return (
    <div className={`usuario-fila ${c.activo ? '' : 'inactivo'}`}>
      <button className="uf-usuario" data-accion="ver-actividad" title="Ver su actividad" onClick={() => verActividad(c.id)}>
        <span className={`avatar ${c.rol === 'Administrador' ? '' : 'avatar-verde'}`}>{iniciales(c.nombre)}</span>
        <span>
          <b>{c.nombre}</b>
          <small>@{c.usuario}{esYo ? ' · tú' : ''}<span className="solo-movil"> · {c.rol}</span></small>
        </span>
      </button>

      <span className="uf-rol">
        {esYo
          ? <span className="pastilla azul">{c.rol}</span>
          : (
            <Desplegable variante="rol" className="selector-rol" data-id={c.id} aria-label={`Rol de ${c.nombre}`} valor={c.rol} onChange={r => cambiarRol(c.id, r)} opciones={roles.map(r => [r, r])} />
          )}
      </span>

      <span className="uf-estado">
        <span className={`pastilla ${c.activo ? 'verde' : 'gris'}`}>● {c.activo ? 'Activo' : 'Desactivado'}</span>
      </span>

      <span className="uf-acceso">
        {c.ultimoAcceso
          ? <>{tiempoRelativo(c.ultimoAcceso)}<small>{textoFecha(c.ultimoAcceso)}</small></>
          : <span className="uf-nada">Nunca entró</span>}
      </span>

      <span className="uf-actividad">
        {ultima
          ? <>{ultima.texto}<small>{tiempoRelativo(ultima.fecha)}</small></>
          : <span className="uf-nada">Sin actividad</span>}
      </span>

      <span className="uf-movimientos">{registros.length}</span>

      <span className="uf-creado">
        {fechaLarga(c.creado)}
        <small>{c.creadoPor ? 'por ' + c.creadoPor : 'cuenta inicial'}</small>
      </span>

      <span className="uf-acciones">
        {!esYo && (
          <button className={`btn-mini ${c.activo ? 'btn-mini-rojo' : ''}`} data-accion="activar-usuario" data-id={c.id} onClick={() => cambiarActivo(c.id)}>
            {c.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </span>
    </div>
  );
}

// solo la ve el administrador (ver Layout.jsx)
export function Usuarios() {
  const estado = useEstado();
  const filtros = estado.usuarios;
  const texto = estado.busqueda.toLowerCase();

  // movimientos de cada cuenta
  const registros = nombre => estado.historial.filter(f => f.responsable === nombre);

  const comparar = ordenes[filtros.orden].comparar;
  const lista = estado.cuentas
    .filter(c => pasaFiltros(c, filtros, texto))
    .map(c => ({ cuenta: c, registros: registros(c.nombre), ultima: actividadDe(estado, c)[0] }))
    .sort((a, b) => (filtros.invertido ? -comparar(a, b) : comparar(a, b)));

  const chips = [];
  if (filtros.rol !== 'Todos') chips.push({ campo: 'rol', texto: filtros.rol });
  if (filtros.estado !== 'Todos') chips.push({ campo: 'estado', texto: filtros.estado });
  const hayFiltros = chips.length || texto;
  const abierto = estado.filtrosAbiertos === 'usuarios';
  const activos = estado.cuentas.filter(c => c.activo).length;

  return (
    <>
      <Encabezado titulo="Usuarios" contador={estado.cuentas.length} />

      <div className="con-filtros">
        <div className="tabla">
          <div className="tabla-header barra-tabla">
            <span className="barra-tabla-resumen">
              {hayFiltros ? <><b>{lista.length}</b> de {estado.cuentas.length} usuarios</> : <><b>{activos}</b> activos de {estado.cuentas.length}</>}
              <span className="barra-tabla-orden"> · {ordenes[filtros.orden].texto}</span>
            </span>
            <BotonFiltros grupo="usuarios" activos={chips.length} abierto={abierto} />
            <Chips grupo="usuarios" chips={chips} />
          </div>

          <div className="usuario-fila fila-titulos">
            <span><TituloOrden texto="USUARIO" orden="nombre" filtros={filtros} grupo="usuarios" /></span><span>ROL</span><span>ESTADO</span>
            <span><TituloOrden texto="ÚLTIMO ACCESO" orden="acceso" filtros={filtros} grupo="usuarios" /></span>
            <span>ÚLTIMA ACTIVIDAD</span>
            <span><TituloOrden texto="MOV." orden="movimientos" filtros={filtros} grupo="usuarios" /></span>
            <span><TituloOrden texto="AGREGADO" orden="agregado" filtros={filtros} grupo="usuarios" /></span><span />
          </div>

          {lista.map(f => <FilaUsuario key={f.cuenta.id} c={f.cuenta} registros={f.registros} ultima={f.ultima} />)}

          {lista.length === 0 && <SinResultados texto={hayFiltros ? 'Ningún usuario coincide con los filtros' : 'Todavía no hay usuarios'} />}
        </div>

        {abierto && (
          <PanelFiltros grupo="usuarios" resultados={lista.length}>
            <CampoSelect grupo="usuarios" campo="rol" titulo="Rol" opciones={filtrosRol} actual={filtros.rol} />
            <CampoSelect grupo="usuarios" campo="estado" titulo="Estado" opciones={filtrosEstado} actual={filtros.estado} />
            <CampoSelect grupo="usuarios" campo="orden" titulo="Ordenar por" opciones={Object.entries(ordenes).map(([clave, o]) => [clave, o.texto])} actual={filtros.orden} />
          </PanelFiltros>
        )}
      </div>
    </>
  );
}
