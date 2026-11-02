// desktop: menu lateral fijo; celular: barra de iconos abajo
import { useEffect, useRef } from 'react';
import { useEstado } from '../estado.js';
import { usuario } from '../data/datos.js';
import { largos } from '../validacion.js';
import {
  IconoBuscar, IconoCampana, IconoInicio, IconoAlimentos, IconoSalud, IconoHistorial, IconoDonadores, IconoFijar, IconoSalir, IconoUsuarios, IconoMicrofono,
} from '../assets/iconos.jsx';
import { irA, buscar, fijarMenu, agregar, empezarDictado, abrirModal, verActividad, abrirClave, salir, cambiar } from '../acciones.js';
import { calcularAlertas } from '../logica/alertas.js';
import logo from '../assets/logo.png';
import { Ventana } from './Ventana.jsx';
import { Inicio } from '../pages/Inicio.jsx';
import { Inventario } from '../pages/Inventario.jsx';
import { Historial } from '../pages/Historial.jsx';
import { Donadores } from '../pages/Donadores.jsx';
import { Usuarios } from '../pages/Usuarios.jsx';

// etiqueta: nombre que se muestra si es distinto de la clave
// grupo: titulo que se muestra encima en el menu lateral
// soloAdmin: solo aparece si entro un administrador
const secciones = [
  { nombre: 'Inicio', Icono: IconoInicio, grupo: 'GENERAL' },
  { nombre: 'Alimentos', Icono: IconoAlimentos, grupo: 'INVENTARIO' },
  { nombre: 'Salud', etiqueta: 'Salud e higiene', Icono: IconoSalud, grupo: 'INVENTARIO' },
  { nombre: 'Historial', Icono: IconoHistorial, grupo: 'REGISTROS' },
  { nombre: 'Donadores', Icono: IconoDonadores, grupo: 'REGISTROS' },
  { nombre: 'Usuarios', Icono: IconoUsuarios, grupo: 'ADMINISTRACIÓN', soloAdmin: true },
];

const paginas = {
  Inicio: () => <Inicio />,
  Alimentos: () => <Inventario key="Alimentos" categoria="Alimentos" />,
  Salud: () => <Inventario key="Salud" categoria="Salud" />,
  Historial: () => <Historial />,
  Donadores: () => <Donadores />,
  Usuarios: () => <Usuarios />,
};

// las secciones que puede ver quien entro
function seccionesVisibles() {
  return secciones.filter(s => !s.soloAdmin || usuario.rol === 'Administrador');
}

// texto: lo que se esta buscando (para mostrar la x)
// el input no lo maneja React: buscar() limpia el texto y se comeria el espacio que se esta escribiendo
function Buscador({ texto }) {
  const campo = useRef(null);
  return (
    <div className="buscador">
      <IconoBuscar />
      <input id="buscador" ref={campo} type="search" maxLength={largos.busqueda} autoComplete="off" placeholder="Buscar insumo o categoría" defaultValue={texto} onInput={e => buscar(e.target.value)} />
      {texto && (
        <button
          type="button"
          className="buscador-borrar"
          data-accion="borrar-busqueda"
          aria-label="Borrar búsqueda"
          onClick={() => {
            campo.current.value = '';
            buscar('');
            campo.current.focus();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  );
}

const IconoLlave = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.7" /><path d="M11 12l8-8m-3 3 2 2m-4 0 1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
);

function Marca() {
  return (
    <div className="marca">
      <img className="marca-logo" src={logo} alt="Logo Hogar San Aníbal di Francia" />
      <div>
        <div className="marca-nombre">Hogar San Aníbal</div>
        <div className="marca-sub-movil">{usuario.nombre} · {usuario.rol}</div>
      </div>
    </div>
  );
}

function Menu({ seccion }) {
  const lista = seccionesVisibles();
  return lista.map((s, i) => [
    s.grupo !== lista[i - 1]?.grupo && <span key={s.grupo} className="menu-grupo">{s.grupo}</span>,
    <button
      key={s.nombre}
      className={s.nombre === seccion ? 'activo' : ''}
      data-accion="seccion"
      data-seccion={s.nombre}
      title={s.etiqueta || s.nombre}
      onClick={e => {
        // con el mouse suelta el foco para que el menu se cierre (con teclado se queda donde estaba)
        if (e.detail > 0) e.currentTarget.blur();
        irA(s.nombre);
      }}
    >
      <s.Icono />
      <span>{s.etiqueta || s.nombre}</span>
    </button>,
  ]);
}

function MenuMovil({ seccion }) {
  return seccionesVisibles().map(s => (
    <button key={s.nombre} className={s.nombre === seccion ? 'activo' : ''} data-accion="seccion" data-seccion={s.nombre} aria-label={s.etiqueta || s.nombre} onClick={() => irA(s.nombre)}>
      <s.Icono />
    </button>
  ));
}

function MenuUsuario({ abierto }) {
  return (
    <div className="usuario-caja">
      <button className="usuario" data-accion="menu-usuario" aria-haspopup="true" aria-expanded={abierto} onClick={() => cambiar(e => (e.menuUsuario = !e.menuUsuario))}>
        <div className="avatar">{usuario.iniciales}</div>
        <div className="usuario-datos">
          <span className="usuario-nombre">{usuario.nombre}</span>
          <span className="usuario-rol">{usuario.rol}</span>
        </div>
      </button>

      <div className="usuario-menu" id="usuario-menu" hidden={!abierto}>
        <div className="usuario-menu-datos">
          <b>{usuario.nombre}</b>
          <span>{usuario.rol}</span>
        </div>
        <button className="usuario-menu-opcion" data-accion="mi-actividad" onClick={() => verActividad(usuario.id)}><IconoHistorial /> Mi actividad</button>
        <button className="usuario-menu-opcion" data-accion="cambiar-mi-clave" onClick={() => abrirClave()}><IconoLlave /> Cambiar mi contraseña</button>
        <button data-accion="salir" onClick={salir}><IconoSalir /> Cerrar sesión</button>
      </div>
    </div>
  );
}

export function Layout() {
  const estado = useEstado();
  // si no puede ver la seccion, va a Inicio
  const seccion = seccionesVisibles().some(s => s.nombre === estado.seccion) ? estado.seccion : 'Inicio';
  // numero de la campanita: alertas urgentes
  const urgentes = calcularAlertas(estado).filter(a => a.prioridad === 'Alta').length;

  // el css usa la seccion actual y si el menu esta fijo
  useEffect(() => {
    document.body.dataset.seccion = seccion;
    document.body.classList.toggle('menu-fijo', estado.menuFijo);
  }, [seccion, estado.menuFijo]);

  // el menu del usuario se cierra al hacer clic en otro lado
  useEffect(() => {
    if (!estado.menuUsuario) return;
    const cerrar = e => {
      if (!e.target.closest('.usuario-caja')) cambiar(x => (x.menuUsuario = false));
    };
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, [estado.menuUsuario]);

  return (
    <>
      <aside className="lateral">
        <Marca />
        <nav className="menu" id="menu"><Menu seccion={seccion} /></nav>
        <div className="menu menu-pie">
          <button data-accion="fijar-menu" id="fijar-menu" onClick={e => { fijarMenu(); e.currentTarget.blur(); }}>
            <IconoFijar />
            <span>{estado.menuFijo ? 'Soltar menú' : 'Fijar menú'}</span>
          </button>
        </div>
      </aside>

      <div className="principal">
        <header className="topbar">
          <Marca />

          {/* en Inicio no se busca: no hay lista que filtrar */}
          {seccion !== 'Inicio' && <Buscador texto={estado.busqueda} />}

          <div className="topbar-derecha">
            <button className="campana" data-accion="ver-alertas" aria-label="Alertas" onClick={() => abrirModal({ tipo: 'alertas' })}>
              <IconoCampana />
              <span className="campana-numero" id="campana-numero" hidden={urgentes === 0}>{urgentes > 9 ? '9+' : urgentes}</span>
            </button>
            <MenuUsuario abierto={estado.menuUsuario} />
          </div>
        </header>

        <main className="contenedor" id="contenido">{paginas[seccion]()}</main>
      </div>

      <nav className="menu-movil" id="menu-movil"><MenuMovil seccion={seccion} /></nav>
      {/* en Donadores y Usuarios el "+" no registra movimientos */}
      {seccion !== 'Donadores' && seccion !== 'Usuarios' && (
        <button className="btn-flotante btn-flotante-voz" data-accion="dictar" aria-label="Registrar por voz" title="Registrar por voz" onClick={empezarDictado}>
          <IconoMicrofono />
        </button>
      )}
      <button className="btn-flotante" data-accion="agregar" aria-label="Agregar" onClick={agregar}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <div id="modal">{estado.modal && <Ventana key={estado.modal.id} modal={estado.modal} />}</div>
      <div id="toast">{estado.toast && <div className="toast" key={estado.toast.id}>{estado.toast.texto}</div>}</div>
    </>
  );
}
