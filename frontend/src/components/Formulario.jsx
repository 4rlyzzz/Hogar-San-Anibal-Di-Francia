// piezas de los formularios de las ventanas
import { useEffect, useRef, useState } from 'react';
import { largos } from '../validacion.js';
import { estado } from '../estado.js';
import { cerrarModal, intentar } from '../acciones.js';
import { textoPresentacion } from '../logica/comunes.js';
import { Desplegable } from './Desplegable.jsx';

// error del formulario: lo muestra, marca el campo y lo enfoca
export function useFormulario() {
  const [error, setError] = useState('');
  const formulario = useRef(null);

  function mostrar(resultado) {
    formulario.current?.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    setError(resultado?.error ?? '');
    // por id: en los desplegables el name esta en inputs ocultos
    const campo = resultado?.campo && formulario.current?.querySelector(`[id="${resultado.campo}"]`);
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }
  }

  // corre la accion con los valores del formulario; devuelve true si salio bien
  function enviar(e, accion) {
    e.preventDefault();
    const resultado = intentar(() => accion(valoresDe(e.currentTarget)));
    mostrar(resultado);
    return !resultado;
  }

  return { error, setError, formulario, mostrar, enviar };
}

// valores del formulario como { name: valor }
// si un name se repite (desplegable de varios), queda una lista
export function valoresDe(formulario) {
  const valores = {};
  for (const [campo, valor] of new FormData(formulario)) {
    if (!(campo in valores)) valores[campo] = valor;
    else valores[campo] = [].concat(valores[campo], valor);
  }
  return valores;
}

// borra lo que no es numero y corta los decimales de mas
// devuelve un aviso si tuvo que borrar algo
export function filtrarNumero(input, decimales) {
  let limpio = input.value.replace(/[^\d.,]/g, '');
  const coma = limpio.search(/[.,]/);
  if (coma >= 0) {
    const entero = limpio.slice(0, coma);
    const resto = limpio.slice(coma + 1).split(/[.,]/)[0];
    limpio = decimales === 0 ? entero : `${entero}${limpio[coma]}${resto.slice(0, decimales)}`;
  }
  if (limpio === input.value) return null;
  input.value = limpio;
  return decimales ? `Aquí solo van números, con hasta ${decimales} decimales.` : 'Aquí solo van números enteros.';
}

// campo de numero: no deja escribir letras
// onAviso(texto): avisa cuando se borro algo
export function CampoNumero({ id, decimales, onAviso, onInput, ...resto }) {
  return (
    <input
      {...resto}
      id={id}
      name={id}
      type="text"
      inputMode={decimales ? 'decimal' : 'numeric'}
      data-numero={decimales}
      maxLength={largos.numero}
      autoComplete="off"
      onInput={e => {
        const aviso = filtrarNumero(e.target, decimales);
        if (aviso) onAviso?.(aviso);
        onInput?.(e);
      }}
    />
  );
}

// fondo oscuro de las ventanas; un clic afuera la cierra
export function Fondo({ panel = false, children }) {
  return (
    <div className={`fondo-modal ${panel ? 'fondo-panel' : ''}`} onClick={e => e.target === e.currentTarget && cerrarModal()}>
      {children}
    </div>
  );
}

// flecha arriba a la izquierda: vuelve a la ventana anterior
// onVolver: para volver dentro de la misma ventana (del paso 2 al paso 1)
export function BotonVolver({ onVolver }) {
  const volver = onVolver ?? estado.modal?.volver;
  if (!volver) return null;
  return (
    <button type="button" className="btn-volver" data-accion="volver" aria-label="Volver" onClick={() => volver()}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

export function Cabecera({ codigo, color, titulo, subtitulo, onVolver }) {
  return (
    <div className="modal-header">
      <BotonVolver onVolver={onVolver} />
      <div className={`tarjeta-codigo ${color}`}>{codigo}</div>
      <div>
        <div className="modal-titulo">{titulo}</div>
        <div className="modal-sub">{subtitulo}</div>
      </div>
      <button type="button" className="btn-cerrar" data-accion="cerrar-modal" onClick={cerrarModal}>×</button>
    </div>
  );
}

// abajo va solo la accion principal; "Cancelar" solo si arriba no hay flecha para volver
export function Botones({ textoGuardar }) {
  return (
    <div className="modal-footer">
      {!estado.modal?.volver && <button type="button" className="btn btn-blanco" data-accion="cerrar-modal" onClick={cerrarModal}>Cancelar</button>}
      <button type="submit" className="btn btn-verde">{textoGuardar}</button>
    </div>
  );
}

export function MensajeError({ texto }) {
  return <p className="error" id="error">{texto}</p>;
}

// subtitulo con la presentacion del producto
export function sobreProducto(item, antes = '') {
  return [antes, textoPresentacion(item) || `suelto, en ${item.unidad}`].filter(Boolean).join(' · ');
}

// fecha de vencimiento o "No tiene fecha"
// inicial: fecha ya elegida, null si no tiene fecha (al editar)
export function CampoVencimiento({ inicial }) {
  const [sinFecha, setSinFecha] = useState(inicial === null);
  const fecha = useRef(null);

  return (
    <div className="campo">
      <label htmlFor="vencimiento">VENCE</label>
      <input id="vencimiento" name="vencimiento" type="date" ref={fecha} disabled={sinFecha} defaultValue={inicial || ''} />
      <label className="check-campo">
        <input
          type="checkbox"
          id="sin-vencimiento"
          name="sin-vencimiento"
          checked={sinFecha}
          onChange={e => {
            setSinFecha(e.target.checked);
            if (e.target.checked) fecha.current.value = '';
          }}
        />
        No tiene fecha
      </label>
    </div>
  );
}

// donador de la lista o uno nuevo; si hay donador, se pide la actividad
// inicial: lo que ya se habia escrito ({ donador, actividad, ... })
export function CampoDonador({ donadores, actividades = [], inicial = {} }) {
  const [donador, setDonador] = useState(inicial.donador ?? '');
  const [actividad, setActividad] = useState(inicial.actividad ?? '');
  const otra = useRef(null);
  useEffect(() => {
    if (actividad === 'otra') otra.current.focus();
  }, [actividad]);

  const opcionesDonador = [['', 'Sin donador (compra del hogar)'], ...donadores.map(d => [String(d.id), d.nombre]), ['nuevo', '+ Nuevo donador']];
  const opcionesActividad = [['', 'Elige una actividad'], ...actividades.map(a => [a, a]), ['otra', '+ Otra actividad…']];

  return (
    <>
      <div className="campo">
        <label htmlFor="donador">DONADOR</label>
        <Desplegable id="donador" name="donador" opciones={opcionesDonador} valor={donador} onChange={setDonador} />
      </div>

      <div className="dos-columnas" id="nuevo-donador" hidden={donador !== 'nuevo'}>
        <div className="campo">
          <label>NOMBRE DEL DONADOR</label>
          <input id="donador-nombre" name="donador-nombre" type="text" maxLength={largos.nombreDonador} placeholder="Nombre o institución" defaultValue={inicial['donador-nombre']} />
        </div>
        <div className="campo">
          <label>NÚMERO DE CONTACTO</label>
          <input id="donador-telefono" name="donador-telefono" type="tel" maxLength={largos.telefono} inputMode="tel" placeholder="987 654 321" defaultValue={inicial['donador-telefono']} />
        </div>
      </div>

      {/* solo si hay donador */}
      <div className="campo" id="campo-actividad" hidden={donador === ''}>
        <label htmlFor="actividad">ACTIVIDAD O MOTIVO</label>
        <Desplegable id="actividad" name="actividad" opciones={opcionesActividad} valor={actividad} onChange={setActividad} />
        <input
          id="actividad-otra"
          name="actividad-otra"
          type="text"
          maxLength={largos.actividadOtra}
          placeholder="Ej. Colecta parroquial, Kermés"
          defaultValue={inicial['actividad-otra']}
          hidden={actividad !== 'otra'}
          ref={otra}
        />
      </div>
    </>
  );
}

// solo en salidas de Salud: a quien o a quienes se les dio
// sin nadie elegido es uso general
// inicial: nombres ya elegidos (al editar); uno que no esta en la lista va como "otro"
export function CampoPara({ ninos = [], inicial = [] }) {
  const deFuera = inicial.find(n => !ninos.includes(n));
  const [elegidos, setElegidos] = useState(() => [...inicial.filter(n => ninos.includes(n)), ...(deFuera ? ['otro'] : [])]);
  const [nombreOtro, setNombreOtro] = useState(deFuera ?? '');
  const otro = useRef(null);
  const conOtro = elegidos.includes('otro');
  useEffect(() => {
    if (conOtro) otro.current.focus();
  }, [conOtro]);

  const opciones = [['', 'Uso general (no es para un niño en particular)'], ...ninos.map(n => [n, n]), ['otro', '+ Otro niño/a…']];
  const mostrado = elegidos.length ? elegidos : [''];

  // elegir "uso general" quita a los niños, y elegir un niño quita "uso general"
  function cambiar(nuevo) {
    const agregado = nuevo.find(v => !mostrado.includes(v));
    setElegidos(agregado === '' ? [] : nuevo.filter(v => v !== ''));
  }

  return (
    <div className="campo">
      <label htmlFor="para">PARA QUIÉN</label>
      <Desplegable
        id="para"
        name="para"
        multiple
        opciones={opciones}
        valor={mostrado}
        onChange={cambiar}
        // en vez de "+ Otro niño/a…" muestra el nombre que se escribio
        textoBoton={() => (elegidos.length
          ? elegidos.map(n => (n === 'otro' ? nombreOtro.trim() || 'otro niño/a' : n)).join(', ')
          : opciones[0][1])}
      />
      <input
        id="para-otro"
        name="para-otro"
        type="text"
        maxLength={largos.nino}
        placeholder="Nombre del niño o niña"
        hidden={!conOtro}
        ref={otro}
        defaultValue={deFuera}
        onInput={e => setNombreOtro(e.target.value)}
      />
      <small>Puedes elegir a varios niños.</small>
    </div>
  );
}

// texto libre opcional de los ingresos y salidas
export function CampoObservaciones({ ejemplo, inicial = '' }) {
  return (
    <div className="campo">
      <label htmlFor="observaciones">OBSERVACIONES (OPCIONAL)</label>
      <textarea id="observaciones" name="observaciones" rows={2} maxLength={largos.observaciones} placeholder={ejemplo} defaultValue={inicial} />
    </div>
  );
}
