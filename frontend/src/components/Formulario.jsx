// piezas de los formularios de las ventanas
import { useEffect, useRef, useState } from 'react';
import { largos } from '../validacion.js';
import { cerrarModal, intentar } from '../acciones.js';
import { textoPresentacion } from '../logica/comunes.js';

// error del formulario: lo muestra, marca el campo y lo enfoca
export function useFormulario() {
  const [error, setError] = useState('');
  const formulario = useRef(null);

  function mostrar(resultado) {
    formulario.current?.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    setError(resultado?.error ?? '');
    const campo = resultado?.campo && formulario.current?.elements[resultado.campo];
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
export function valoresDe(formulario) {
  const valores = {};
  for (const [campo, valor] of new FormData(formulario)) valores[campo] = valor;
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

export function Cabecera({ codigo, color, titulo, subtitulo }) {
  return (
    <div className="modal-header">
      <div className={`tarjeta-codigo ${color}`}>{codigo}</div>
      <div>
        <div className="modal-titulo">{titulo}</div>
        <div className="modal-sub">{subtitulo}</div>
      </div>
      <button type="button" className="btn-cerrar" data-accion="cerrar-modal" onClick={cerrarModal}>×</button>
    </div>
  );
}

export function Botones({ textoGuardar }) {
  return (
    <div className="modal-footer">
      <button type="button" className="btn btn-blanco" data-accion="cerrar-modal" onClick={cerrarModal}>Cancelar</button>
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
export function CampoVencimiento() {
  const [sinFecha, setSinFecha] = useState(false);
  const fecha = useRef(null);

  return (
    <div className="campo">
      <label htmlFor="vencimiento">VENCE</label>
      <input id="vencimiento" name="vencimiento" type="date" ref={fecha} disabled={sinFecha} />
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
export function CampoDonador({ donadores, actividades = [] }) {
  const [donador, setDonador] = useState('');
  const [actividad, setActividad] = useState('');
  const otra = useRef(null);
  useEffect(() => {
    if (actividad === 'otra') otra.current.focus();
  }, [actividad]);

  return (
    <>
      <div className="campo">
        <label>DONADOR</label>
        <select id="donador" name="donador" onChange={e => setDonador(e.target.value)}>
          <option value="">Sin donador (compra del hogar)</option>
          {donadores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          <option value="nuevo">+ Nuevo donador</option>
        </select>
      </div>

      <div className="dos-columnas" id="nuevo-donador" hidden={donador !== 'nuevo'}>
        <div className="campo">
          <label>NOMBRE DEL DONADOR</label>
          <input id="donador-nombre" name="donador-nombre" type="text" maxLength={largos.nombreDonador} placeholder="Nombre o institución" />
        </div>
        <div className="campo">
          <label>NÚMERO DE CONTACTO</label>
          <input id="donador-telefono" name="donador-telefono" type="tel" maxLength={largos.telefono} inputMode="tel" placeholder="987 654 321" />
        </div>
      </div>

      {/* solo si hay donador */}
      <div className="campo" id="campo-actividad" hidden={donador === ''}>
        <label htmlFor="actividad">ACTIVIDAD O MOTIVO</label>
        <select id="actividad" name="actividad" onChange={e => setActividad(e.target.value)}>
          <option value="">Elige una actividad</option>
          {actividades.map(a => <option key={a} value={a}>{a}</option>)}
          <option value="otra">+ Otra actividad…</option>
        </select>
        <input
          id="actividad-otra"
          name="actividad-otra"
          type="text"
          maxLength={largos.actividadOtra}
          placeholder="Ej. Colecta parroquial, Kermés"
          hidden={actividad !== 'otra'}
          ref={otra}
        />
      </div>
    </>
  );
}

// solo en salidas de Salud: a quien se le dio
export function CampoPara({ ninos = [] }) {
  const [elegido, setElegido] = useState('');
  const otro = useRef(null);
  useEffect(() => {
    if (elegido === 'otro') otro.current.focus();
  }, [elegido]);

  return (
    <div className="campo">
      <label htmlFor="para">PARA QUIÉN</label>
      <select id="para" name="para" onChange={e => setElegido(e.target.value)}>
        <option value="">Uso general (no es para un niño en particular)</option>
        {ninos.map(n => <option key={n} value={n}>{n}</option>)}
        <option value="otro">+ Otro niño/a…</option>
      </select>
      <input
        id="para-otro"
        name="para-otro"
        type="text"
        maxLength={largos.nino}
        placeholder="Nombre del niño o niña"
        hidden={elegido !== 'otro'}
        ref={otro}
      />
    </div>
  );
}
