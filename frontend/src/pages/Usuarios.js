import { Encabezado, SinResultados, TituloOrden, escapar, iniciales, fechaLarga, textoFecha, tiempoRelativo } from '../components/Comunes.js';
import { actividadDe } from '../components/Actividad.js';
import { BotonFiltros, PanelFiltros, CampoSelect, Chips } from '../components/Filtros.js';
import { usuario } from '../data/datos.js';

const roles = ['Usuario', 'Administrador'];

// ordenes; "invertido" los da vuelta
const ordenes = {
  nombre: { texto: 'Nombre (A-Z)', comparar: (a, b) => a.cuenta.nombre.localeCompare(b.cuenta.nombre) },
  acceso: { texto: 'Último acceso', comparar: (a, b) => (b.cuenta.ultimoAcceso ?? 0) - (a.cuenta.ultimoAcceso ?? 0) },
  movimientos: { texto: 'Más movimientos', comparar: (a, b) => b.registros.length - a.registros.length },
  agregado: { texto: 'Agregado recientemente', comparar: (a, b) => b.cuenta.creado - a.cuenta.creado },
};

// valor guardado -> texto del desplegable
const filtrosRol = { Todos: 'Todos los roles', Administrador: 'Administrador', Usuario: 'Usuario' };
const filtrosEstado = { Todos: 'Todos los estados', Activos: 'Activos', Desactivados: 'Desactivados' };

function pasaFiltros(c, filtros, texto) {
  if (filtros.rol !== 'Todos' && c.rol !== filtros.rol) return false;
  if (filtros.estado === 'Activos' && !c.activo) return false;
  if (filtros.estado === 'Desactivados' && c.activo) return false;
  return (c.nombre + ' ' + c.usuario).toLowerCase().includes(texto);
}

// solo la ve el administrador (ver MainLayout y main.js)
export function paginaUsuarios(estado) {
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
  const opcionesOrden = Object.fromEntries(Object.entries(ordenes).map(([clave, o]) => [clave, o.texto]));

  return `
    ${Encabezado(`Usuarios <span class="contador">${estado.cuentas.length}</span>`)}

    <div class="con-filtros">
    <div class="tabla">
      <div class="tabla-header barra-tabla">
        <span class="barra-tabla-resumen">
          ${hayFiltros ? `<b>${lista.length}</b> de ${estado.cuentas.length} usuarios` : `<b>${activos}</b> activos de ${estado.cuentas.length}`}
          <span class="barra-tabla-orden">· ${ordenes[filtros.orden].texto}</span>
        </span>
        ${BotonFiltros('usuarios', chips.length, abierto)}
        ${Chips('usuarios', chips)}
      </div>

      <div class="usuario-fila fila-titulos">
        <span>${TituloOrden('USUARIO', 'nombre', filtros, 'usuarios')}</span><span>ROL</span><span>ESTADO</span>
        <span>${TituloOrden('ÚLTIMO ACCESO', 'acceso', filtros, 'usuarios')}</span>
        <span>ÚLTIMA ACTIVIDAD</span>
        <span>${TituloOrden('MOV.', 'movimientos', filtros, 'usuarios')}</span>
        <span>${TituloOrden('AGREGADO', 'agregado', filtros, 'usuarios')}</span><span></span>
      </div>

      ${lista.map(f => FilaUsuario(f.cuenta, f.registros, f.ultima)).join('')}

      ${lista.length === 0 ? SinResultados(hayFiltros ? 'Ningún usuario coincide con los filtros' : 'Todavía no hay usuarios') : ''}
    </div>

    ${abierto ? PanelFiltros('usuarios', `
      ${CampoSelect('usuarios', 'rol', 'Rol', filtrosRol, filtros.rol)}
      ${CampoSelect('usuarios', 'estado', 'Estado', filtrosEstado, filtros.estado)}
      ${CampoSelect('usuarios', 'orden', 'Ordenar por', opcionesOrden, filtros.orden)}
    `, lista.length) : ''}
    </div>
  `;
}

// ultima: lo ultimo que hizo
function FilaUsuario(c, registros, ultima) {
  // no puede cambiarse el rol ni desactivarse a si mismo
  const esYo = c.id === usuario.id;

  const rol = esYo
    ? `<span class="pastilla azul">${escapar(c.rol)}</span>`
    : `<select class="selector-rol" data-id="${escapar(c.id)}" aria-label="Rol de ${escapar(c.nombre)}">
        ${roles.map(r => `<option ${r === c.rol ? 'selected' : ''}>${r}</option>`).join('')}
      </select>`;

  return `
    <div class="usuario-fila ${c.activo ? '' : 'inactivo'}">
      <button class="uf-usuario" data-accion="ver-actividad" data-id="${escapar(c.id)}" title="Ver su actividad">
        <span class="avatar ${c.rol === 'Administrador' ? '' : 'avatar-verde'}">${iniciales(c.nombre)}</span>
        <span>
          <b>${escapar(c.nombre)}</b>
          <small>@${escapar(c.usuario)}${esYo ? ' · tú' : ''}<span class="solo-movil"> · ${escapar(c.rol)}</span></small>
        </span>
      </button>

      <span class="uf-rol">${rol}</span>

      <span class="uf-estado">
        <span class="pastilla ${c.activo ? 'verde' : 'gris'}">● ${c.activo ? 'Activo' : 'Desactivado'}</span>
      </span>

      <span class="uf-acceso">
        ${c.ultimoAcceso
          ? `${tiempoRelativo(c.ultimoAcceso)}<small>${textoFecha(c.ultimoAcceso)}</small>`
          : '<span class="uf-nada">Nunca entró</span>'}
      </span>

      <span class="uf-actividad">
        ${ultima
          ? `${escapar(ultima.texto)}<small>${tiempoRelativo(ultima.fecha)}</small>`
          : '<span class="uf-nada">Sin actividad</span>'}
      </span>

      <span class="uf-movimientos">${registros.length}</span>

      <span class="uf-creado">
        ${fechaLarga(c.creado)}
        <small>${c.creadoPor ? 'por ' + escapar(c.creadoPor) : 'cuenta inicial'}</small>
      </span>

      <span class="uf-acciones">${esYo ? '' : `
        <button class="btn-mini ${c.activo ? 'btn-mini-rojo' : ''}" data-accion="activar-usuario" data-id="${escapar(c.id)}">
          ${c.activo ? 'Desactivar' : 'Activar'}
        </button>
      `}</span>
    </div>
  `;
}
