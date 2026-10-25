// desplegable propio: la lista del <select> del navegador no se puede pintar como el resto de la pagina
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// opciones: [[valor, texto]]; [null, 'Titulo'] es un titulo de grupo
// valor/onChange: lo maneja el padre; si no, usa valorInicial
// multiple: el valor es una lista y la lista no se cierra al elegir
// name: guarda lo elegido en inputs ocultos para leerlo con FormData
// variante: 'campo' (ventanas), 'filtro' (panel de filtros) o 'rol' (pastilla)
// textoBoton(textos): para mostrar otra cosa en el boton cerrado
export function Desplegable({ id, name, opciones, valor, valorInicial, onChange, multiple = false, variante = 'campo', placeholder = '', className = '', textoBoton, ...resto }) {
  const [propio, setPropio] = useState(valorInicial ?? (multiple ? [] : primerValor(opciones)));
  const actual = valor !== undefined ? valor : propio;
  const elegidos = multiple ? actual : [actual];

  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [lugar, setLugar] = useState(null);
  const boton = useRef(null);
  const lista = useRef(null);
  const busqueda = useRef({ texto: '', hora: 0 });
  const idLista = useId();

  const elegibles = opciones.map((o, i) => (o[0] === null ? null : i)).filter(i => i !== null);
  const textos = opciones.filter(([v]) => v !== null && elegidos.includes(v)).map(([, t]) => t);

  function elegir(v) {
    const nuevo = multiple ? (elegidos.includes(v) ? elegidos.filter(x => x !== v) : [...elegidos, v]) : v;
    if (valor === undefined) setPropio(nuevo);
    onChange?.(nuevo);
    if (!multiple) setAbierto(false);
  }

  function abrir() {
    const i = opciones.findIndex(([v]) => v !== null && elegidos.includes(v));
    setActivo(i >= 0 ? i : elegibles[0]);
    setAbierto(true);
  }

  // siguiente opcion elegible hacia arriba o abajo
  function mover(paso) {
    const pos = elegibles.indexOf(activo);
    const nueva = Math.min(elegibles.length - 1, Math.max(0, pos + paso));
    setActivo(elegibles[nueva]);
  }

  // escribir letras salta a la opcion que empieza asi
  function saltarA(letra) {
    const ahora = Date.now();
    const b = busqueda.current;
    b.texto = ahora - b.hora > 700 ? letra : b.texto + letra;
    b.hora = ahora;
    const i = elegibles.find(j => sinTildes(opciones[j][1]).startsWith(sinTildes(b.texto)));
    if (i === undefined) return;
    setActivo(i);
    if (!abierto) setAbierto(true);
  }

  function teclas(e) {
    const tecla = e.key;
    if (tecla === 'Tab') return setAbierto(false);
    if (tecla === 'Escape') {
      if (!abierto) return;
      // que no cierre tambien la ventana
      e.preventDefault();
      e.stopPropagation();
      return setAbierto(false);
    }
    if (tecla === 'ArrowDown' || tecla === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return abrir();
      return mover(tecla === 'ArrowDown' ? 1 : -1);
    }
    if (tecla === 'Home' || tecla === 'End') {
      if (!abierto) return;
      e.preventDefault();
      return setActivo(tecla === 'Home' ? elegibles[0] : elegibles.at(-1));
    }
    if (tecla === 'Enter' || tecla === ' ') {
      e.preventDefault();
      if (!abierto) return abrir();
      if (activo >= 0) elegir(opciones[activo][0]);
      return;
    }
    if (tecla.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) saltarA(tecla);
  }

  // la lista va pegada al boton, hacia abajo o hacia arriba segun el espacio
  useLayoutEffect(() => {
    if (!abierto) return;
    function ubicar() {
      const r = boton.current.getBoundingClientRect();
      const abajo = window.innerHeight - r.bottom - 12;
      const arriba = r.top - 12;
      const haciaArriba = abajo < 220 && arriba > abajo;
      setLugar({
        left: r.left,
        minWidth: r.width,
        maxWidth: Math.max(r.width, window.innerWidth - r.left - 12),
        maxHeight: Math.min(300, haciaArriba ? arriba : abajo),
        ...(haciaArriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    }
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
      setLugar(null);
    };
  }, [abierto]);

  // un clic afuera la cierra
  useEffect(() => {
    if (!abierto) return;
    const afuera = e => {
      if (!boton.current?.contains(e.target) && !lista.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('pointerdown', afuera);
    return () => document.removeEventListener('pointerdown', afuera);
  }, [abierto]);

  // la opcion marcada con el teclado siempre se ve (solo mueve la lista, no la pagina)
  useEffect(() => {
    const opcion = document.getElementById(`${idLista}-${activo}`);
    const caja = lista.current;
    if (!opcion || !caja) return;
    if (opcion.offsetTop < caja.scrollTop) caja.scrollTop = opcion.offsetTop - 6;
    else if (opcion.offsetTop + opcion.offsetHeight > caja.scrollTop + caja.clientHeight) caja.scrollTop = opcion.offsetTop + opcion.offsetHeight - caja.clientHeight + 6;
  }, [lugar, activo, idLista]);

  return (
    <>
      <button
        {...resto}
        ref={boton}
        type="button"
        id={id}
        role="combobox"
        className={`desplegable desplegable-${variante} ${abierto ? 'abierto' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-activedescendant={abierto && activo >= 0 ? `${idLista}-${activo}` : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={teclas}
        // si el foco se va (por ejemplo al campo de "Otro"), se cierra
        onBlur={() => setAbierto(false)}
      >
        <span className="desplegable-texto">{(textoBoton ? textoBoton(textos) : textos.join(', ')) || placeholder}</span>
        <svg className="desplegable-flecha" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {name && elegidos.map(v => <input key={v} type="hidden" name={name} value={v} />)}

      {abierto && lugar && createPortal(
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          className={`desplegable-lista desplegable-lista-${variante}`}
          aria-multiselectable={multiple || undefined}
          aria-labelledby={id}
          style={lugar}
        >
          {opciones.map(([v, texto], i) => (v === null
            ? <li key={`titulo-${texto}`} role="presentation" className="desplegable-grupo">{texto}</li>
            : (
              <li
                key={v}
                id={`${idLista}-${i}`}
                role="option"
                data-valor={v}
                aria-selected={elegidos.includes(v)}
                className={`desplegable-opcion ${i === activo ? 'activa' : ''} ${texto.startsWith('+') ? 'desplegable-agregar' : ''}`}
                // el foco se queda en el boton
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setActivo(i)}
                onClick={() => elegir(v)}
              >
                {multiple && <span className="desplegable-check" aria-hidden="true" />}
                <span>{texto}</span>
                {!multiple && <svg className="desplegable-marca" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.5 6 10.5 11 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </li>
            )))}
        </ul>,
        document.body,
      )}
    </>
  );
}

function primerValor(opciones) {
  return opciones.find(([v]) => v !== null)?.[0] ?? '';
}

function sinTildes(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
