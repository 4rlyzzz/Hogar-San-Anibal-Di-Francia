// registrar varios productos a la vez: elegir como (a mano, codigo o voz), la lista, editar una fila y confirmar
import { useEffect, useRef, useState } from 'react';
import { estado } from '../estado.js';
import { usuario } from '../data/datos.js';
import { largos, decimalesDe } from '../validacion.js';
import { IconoMano, IconoCodigo, IconoMicrofono, IconoEditar, IconoBorrar, IconoIngreso, IconoSalida, IconoBuscar } from '../assets/iconos.jsx';
import {
  abrirMetodo, abrirMetodos, abrirLista, agregarManual, agregarCodigo, agregarDictado, abrirItem, quitarItem, guardarItem, revisarLote, confirmarLote,
  descartarLote, problemasItem, productoDeItem, nombreItem, donadorDeItem, todosLosProductos, claveProducto, productoPorClave,
  opcionesActividad, opcionesNinos, abrirProducto, intentar,
} from '../acciones.js';
import { nombreCategoria, textoPara, redondear, fechaActual, coincideNombre, textoPresentacion, disponible } from '../logica/comunes.js';
import { fechaVence } from '../logica/lotes.js';
import { interpretarDictado } from '../logica/dictado.js';
import { transcribir, modoVoz, usaWhisper, reconocedorNavegador, dejarNavegador, crearLector } from '../servicios/captura.js';
import { escucharWhisper, prepararWhisper, whisperPreparado } from '../servicios/whisper.js';
import {
  useFormulario, filtrarNumero, CampoNumero, Fondo, Cabecera, Botones, MensajeError, CampoVencimiento, CampoDonador, CampoPara, CampoObservaciones,
} from './Formulario.jsx';
import { Desplegable } from './Desplegable.jsx';

// lo que cambia entre ingreso y salida
const tipos = {
  Ingreso: { titulo: 'Registrar ingreso', color: 'verde', Icono: IconoIngreso, signo: '+' },
  Salida: { titulo: 'Registrar salida', color: 'naranja', Icono: IconoSalida, signo: '−' },
};

function CabeceraLote({ titulo, subtitulo, onVolver }) {
  const t = tipos[estado.lote.tipo];
  return <Cabecera codigo={<t.Icono />} color={t.color} titulo={titulo ?? t.titulo} subtitulo={subtitulo} onVolver={onVolver} />;
}

const colorCategoria = categoria => (categoria === 'Salud' ? 'azul' : 'verde');

// 'Lata x 400 g' o 'Suelto, en kg': para no confundir tamaños del mismo producto
const presentacion = item => textoPresentacion(item) || `Suelto, en ${item.unidad}`;

// ---------- 1. como agregar ----------
const metodos = [
  { metodo: 'manual', Icono: IconoMano, titulo: 'Manual', detalle: 'Busca el producto y escribe la cantidad' },
  { metodo: 'codigo', Icono: IconoCodigo, titulo: 'Código de barras', detalle: 'Escanea los productos con la cámara' },
  { metodo: 'voz', Icono: IconoMicrofono, titulo: 'Micrófono', detalle: 'Di varios productos de una vez' },
];

export function ModalLoteMetodo() {
  return (
    <Fondo>
      <div className="modal" id="lote-metodo">
        <CabeceraLote subtitulo="¿Cómo quieres agregar los productos?" />
        <div className="modal-cuerpo">
          {metodos.map(m => (
            <button key={m.metodo} type="button" className="opcion-agregar" data-metodo={m.metodo} onClick={() => abrirMetodo(m.metodo)}>
              <span className="tarjeta-codigo gris"><m.Icono /></span>
              <span>
                <b>{m.titulo}</b>
                <small>{m.detalle}</small>
              </span>
              <span className="opcion-flecha">›</span>
            </button>
          ))}
        </div>
      </div>
    </Fondo>
  );
}

// ---------- 2a. a mano ----------
export function ModalLoteManual() {
  const [busqueda, setBusqueda] = useState('');
  const productos = todosLosProductos().filter(({ item }) => !busqueda.trim() || coincideNombre(busqueda, item.nombre));
  const esSalida = estado.lote.tipo === 'Salida';

  return (
    <Fondo>
      <div className="modal" id="lote-manual">
        <CabeceraLote subtitulo="Elige el producto" />
        <div className="modal-cuerpo">
          <div className="buscador lote-buscador">
            <IconoBuscar />
            <input id="lote-buscar" type="search" maxLength={largos.busqueda} autoComplete="off" autoFocus placeholder="Buscar producto" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="lote-productos">
            {productos.length === 0 && <p className="lote-vacio">No hay productos con ese nombre.</p>}
            {productos.map(({ item, categoria }) => {
              const sinStock = esSalida && disponible(item) <= 0;
              return (
                <button key={claveProducto(categoria, item.id)} type="button" className="lote-producto" data-producto={item.nombre} disabled={sinStock} onClick={() => agregarManual(categoria, item.id)}>
                  <span className={`tarjeta-codigo ${colorCategoria(categoria)}`}>{item.codigo}</span>
                  <span>
                    <b>{item.nombre}</b>
                    <small>{presentacion(item)} · {nombreCategoria(categoria)} · {sinStock ? 'sin stock para usar' : `${item.cantidad} ${item.unidad} en stock`}</small>
                  </span>
                  <span className="opcion-flecha">›</span>
                </button>
              );
            })}
          </div>
          {!esSalida && (
            <button type="button" className="btn-anadir" data-accion="crear-producto" onClick={() => abrirProducto('Alimentos', { nombre: busqueda.trim().slice(0, largos.nombreProducto) })}>
              + ¿No está? Crear producto nuevo
            </button>
          )}
        </div>
      </div>
    </Fondo>
  );
}

// ---------- 2b. codigo de barras ----------
// lo que se le pasa al lector, alternando (probado con codigos chicos, borrosos y con poca luz):
// 0 = el cuadro entero; 1 = la zona del recuadro ampliada y con los niveles ajustados (poca luz);
// 2 = lo mismo y ademas enfocada (codigos chicos o un poco borrosos)
const lienzoLector = typeof document !== 'undefined' ? document.createElement('canvas') : null;

function imagenParaLeer(fuente, forma) {
  const ancho = fuente.videoWidth ?? fuente.width;
  const alto = fuente.videoHeight ?? fuente.height;
  if (!ancho) return fuente;
  const ctx = lienzoLector.getContext('2d', { willReadFrequently: true });
  // fotos grandes del celular: se achican, el lector no necesita 12 megapixeles
  if (forma === 0) {
    if (fuente.videoWidth || Math.max(ancho, alto) <= 2000) return fuente;
    const escala = 2000 / Math.max(ancho, alto);
    lienzoLector.width = Math.round(ancho * escala);
    lienzoLector.height = Math.round(alto * escala);
    ctx.drawImage(fuente, 0, 0, lienzoLector.width, lienzoLector.height);
    return lienzoLector;
  }
  // la zona del centro, donde esta el recuadro guia, al doble (sin pasar de 2400 px: el lector se pone lento)
  const zonaAncho = ancho * 0.8;
  const zonaAlto = alto * 0.5;
  const zoom = Math.min(2, 2400 / zonaAncho);
  const w = Math.round(zonaAncho * zoom);
  const h = Math.round(zonaAlto * zoom);
  lienzoLector.width = w;
  lienzoLector.height = h;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fuente, (ancho - zonaAncho) / 2, (alto - zonaAlto) / 2, zonaAncho, zonaAlto, 0, 0, w, h);

  const datos = ctx.getImageData(0, 0, w, h);
  const px = datos.data;
  const n = w * h;
  // en gris
  const gris = new Float32Array(n);
  for (let i = 0; i < n; i++) gris[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  // niveles: lo 2 % mas oscuro pasa a negro y lo 2 % mas claro a blanco (con poca luz todo esta en grises medios)
  const cuantos = new Uint32Array(256);
  for (const v of gris) cuantos[v | 0]++;
  let negro = 0;
  let blanco = 255;
  for (let suma = 0; suma + cuantos[negro] < n * 0.02; negro++) suma += cuantos[negro];
  for (let suma = 0; suma + cuantos[blanco] < n * 0.02; blanco--) suma += cuantos[blanco];
  const escala = 255 / Math.max(1, blanco - negro);
  for (let i = 0; i < n; i++) gris[i] = (gris[i] - negro) * escala;
  // enfoque: cada punto contra sus 4 vecinos marca mas los bordes de las barras
  let final = gris;
  if (forma === 2) {
    final = new Float32Array(gris);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        final[i] = 5 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - w] - gris[i + w];
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const v = final[i] < 0 ? 0 : final[i] > 255 ? 255 : final[i];
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
  }
  ctx.putImageData(datos, 0, 0);
  return lienzoLector;
}
const avisosCamara = {
  iniciando: 'Abriendo la cámara…',
  negada: 'No diste permiso para usar la cámara. Puedes escribir el código abajo.',
  'sin-camara': 'No se encontró una cámara. Escribe el código abajo.',
  'sin-lector': 'La cámara funciona, pero este navegador no pudo cargar el lector de códigos. Escribe el código abajo.',
  // el navegador solo presta la camara en https (o en la misma computadora: localhost)
  'sin-https': 'La cámara solo funciona con conexión segura (https). Desde esta dirección escribe el código abajo.',
};

export function ModalLoteCodigo() {
  const f = useFormulario();
  const video = useRef(null);
  const [camara, setCamara] = useState('iniciando');
  // { pista, encendida } si la camara tiene linterna (celulares)
  const [linterna, setLinterna] = useState(null);
  const [leyendoFoto, setLeyendoFoto] = useState(false);
  const lectorFoto = useRef(null);
  // lo leido en esta pantalla, lo mas nuevo arriba
  const [leidos, setLeidos] = useState([]);
  const ultimo = useRef({ codigo: '', hora: 0 });
  const alLeer = useRef(null);
  const total = estado.lote.items.length;

  // devuelve true si se agrego
  function registrar(codigo) {
    let nombre = null;
    const resultado = intentar(() => (nombre = agregarCodigo(codigo)));
    f.mostrar(resultado);
    if (resultado) return false;
    navigator.vibrate?.(60);
    setLeidos(l => [{ id: Date.now() + Math.random(), codigo: codigo.trim(), nombre }, ...l].slice(0, 6));
    return true;
  }

  async function cambiarLinterna() {
    const encendida = !linterna.encendida;
    await linterna.pista.applyConstraints({ advanced: [{ torch: encendida }] }).catch(() => {});
    setLinterna({ ...linterna, encendida });
  }

  // una foto del codigo: en el celular abre la camara del telefono, que enfoca sola
  async function leerFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setLeyendoFoto(true);
    f.mostrar(null);
    try {
      lectorFoto.current ??= await crearLector();
      if (!lectorFoto.current) return f.setError('Este navegador no pudo cargar el lector de códigos. Escribe el código.');
      const imagen = await createImageBitmap(archivo);
      for (const forma of [0, 1, 2]) {
        const [codigo] = await lectorFoto.current.detect(imagenParaLeer(imagen, forma));
        if (codigo?.rawValue) return registrar(codigo.rawValue);
      }
      f.setError('No se encontró un código en la foto. Tómala de cerca y que el código se vea nítido.');
    } catch {
      f.setError('No se pudo leer la foto. Prueba con otra o escribe el código.');
    } finally {
      setLeyendoFoto(false);
    }
  }

  // el mismo codigo seguido (la camara lo ve varias veces) cuenta una vez cada 2 segundos
  alLeer.current = codigo => {
    const ahora = Date.now();
    if (codigo === ultimo.current.codigo && ahora - ultimo.current.hora < 2000) return;
    ultimo.current = { codigo, hora: ahora };
    registrar(codigo);
  };

  useEffect(() => {
    let activo = true;
    let flujo = null;
    let temporizador = null;
    (async () => {
      const lector = await crearLector();
      if (!window.isSecureContext) return setCamara('sin-https');
      if (!navigator.mediaDevices?.getUserMedia) return setCamara('sin-camara');
      try {
        // si no se pide, las webcams dan 640x480 y el codigo sale chico y borroso
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (e) {
        if (activo) setCamara(e.name === 'NotAllowedError' ? 'negada' : 'sin-camara');
        return;
      }
      if (!activo) return flujo.getTracks().forEach(t => t.stop());
      const pista = flujo.getVideoTracks()[0];
      // enfoque continuo y linterna, si la camara los tiene (celulares)
      pista.applyConstraints?.({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      if (pista.getCapabilities?.().torch) setLinterna({ pista, encendida: false });
      video.current.srcObject = flujo;
      await video.current.play().catch(() => {});
      if (!lector) return setCamara('sin-lector');
      setCamara('lista');

      // se va alternando: el cuadro entero, y la zona del recuadro ampliada (y con mas contraste, por si hay poca luz)
      let vuelta = 0;
      const buscar = async () => {
        if (!activo) return;
        try {
          const fuente = imagenParaLeer(video.current, vuelta++ % 3);
          const codigos = await lector.detect(fuente);
          for (const c of codigos) if (c.rawValue) alLeer.current(c.rawValue);
        } catch {
          // un cuadro que no se pudo leer: se intenta con el siguiente
        }
        temporizador = setTimeout(buscar, 150);
      };
      buscar();
    })();
    return () => {
      activo = false;
      clearTimeout(temporizador);
      flujo?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <Fondo>
      <div className="modal" id="lote-codigo">
        <CabeceraLote subtitulo="Escanea los productos uno por uno" />
        <div className="modal-cuerpo">
          <div className={`escaner ${camara === 'lista' ? 'escaner-activo' : ''}`}>
            <video ref={video} muted playsInline hidden={camara !== 'lista' && camara !== 'sin-lector'} />
            {camara === 'lista' && <div className="escaner-marco" aria-hidden="true" />}
            {camara !== 'lista' && <p className="escaner-aviso" id="aviso-camara">{avisosCamara[camara]}</p>}
          </div>
          {camara === 'lista' && <small className="escaner-ayuda">Acerca el código al recuadro hasta que se vea nítido. Si no lo lee, tómale una foto.</small>}

          <div className="escaner-botones">
            {linterna && (
              <button type="button" className="btn btn-blanco" data-accion="linterna" aria-pressed={linterna.encendida} onClick={cambiarLinterna}>
                {linterna.encendida ? 'Apagar linterna' : 'Encender linterna'}
              </button>
            )}
            <label className={`btn btn-blanco ${leyendoFoto ? 'ocupado' : ''}`}>
              {leyendoFoto ? 'Leyendo la foto…' : 'Tomar o subir foto del código'}
              <input type="file" id="foto-codigo" accept="image/*" capture="environment" hidden disabled={leyendoFoto} onChange={leerFoto} />
            </label>
          </div>

          <form
            className="campo"
            id="form-codigo"
            ref={f.formulario}
            noValidate
            onSubmit={e => {
              e.preventDefault();
              const campo = e.currentTarget.elements.codigo;
              if (registrar(campo.value)) campo.value = '';
            }}
          >
            <label htmlFor="codigo">O ESCRIBE EL CÓDIGO</label>
            <div className="fila-codigo">
              <input id="codigo" name="codigo" type="text" inputMode="numeric" autoComplete="off" maxLength={largos.codigoBarras} placeholder="Ej. 7751271010016" />
              <button type="submit" className="btn btn-blanco">Agregar</button>
            </div>
          </form>

          {leidos.length > 0 && (
            <ul className="leidos" aria-live="polite">
              {leidos.map(l => (
                <li key={l.id} className={l.nombre ? 'leido-ok' : 'leido-nuevo'}>
                  {l.nombre ? <><b>✓</b> {l.nombre}</> : <><b>?</b> Código {l.codigo}: no registrado, lo eliges en la lista</>}
                </li>
              ))}
            </ul>
          )}
          <MensajeError texto={f.error} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-verde" data-accion="ver-lista" disabled={total === 0} onClick={abrirLista}>
            Ver lista ({total})
          </button>
        </div>
      </div>
    </Fondo>
  );
}

// ---------- 2c. voz ----------
// una linea de "Entendí": arriba cuanto y que; abajo, en pequeño, lo que hay que saber
function LineaEntendida({ r }) {
  const item = r.producto?.item;
  // con una presentacion no registrada se muestra la unidad tal como se dijo ("10 bolsas")
  const unidad = r.presentacion?.unidad ?? (item ? item.unidad : r.unidadDicha ?? '');
  let nombre = item?.nombre ?? `"${r.nombreDicho || r.dicho}"`;
  if (!item && r.dudas.length) nombre = r.dudas.map(d => d.item.nombre).join(' o ');

  const avisos = [];
  if (!item && r.dudas.length) avisos.push('¿cuál de ellos?');
  else if (!item) avisos.push('no está en los productos');
  if (r.presentacion) avisos.push(`no está registrada ${r.presentacion.texto.startsWith('de ') ? '' : 'en '}${r.presentacion.texto}`);
  if (item && r.cantidad == null) avisos.push('falta la cantidad');
  const datos = [];
  if (r.vence) datos.push(`vence ${fechaVence(r.vence)}`);
  if (r.donador || r.donadorDicho) datos.push(`donó ${r.donador?.nombre ?? r.donadorDicho}`);
  if (r.actividad) datos.push(r.actividad);

  return (
    <li className={avisos.length ? 'con-duda' : ''}>
      <b>{r.cantidad != null ? `${r.cantidad} ${unidad}` : '—'}</b> · {nombre}
      {avisos.length > 0 && <small className="entendido-aviso">{avisos.join(' · ')}</small>}
      {datos.length > 0 && <small>{datos.join(' · ')}</small>}
    </li>
  );
}
const maximoGrabacion = 60;

export function ModalLoteVoz() {
  const f = useFormulario();
  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [segundos, setSegundos] = useState(0);
  // 'navegador' (escribe mientras se habla) o 'grabacion' (Whisper al terminar); cambia si el navegador falla
  const [modo, setModo] = useState(modoVoz);
  const grabadora = useRef(null);
  const reconocedor = useRef(null);
  // mientras se abre el microfono no se puede volver a presionar
  const abriendo = useRef(false);
  const conVoz = Boolean(modo) && window.isSecureContext && (modo === 'navegador' || (typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)));
  // por que no se puede grabar: el navegador solo presta el microfono en https (o en localhost)
  let sinVoz = 'Este navegador no puede grabar audio. Escribe lo que se dijo.';
  if (!window.isSecureContext) sinVoz = 'El micrófono solo funciona con conexión segura (https). Desde esta dirección escribe lo que se dijo.';
  else if (!modo) sinVoz = 'El reconocimiento de voz no está disponible. Mientras tanto, escribe lo que se dijo.';
  // descarga del modelo de Whisper (solo la primera vez): porcentaje o null
  const [descarga, setDescarga] = useState(null);

  // con Whisper, el modelo empieza a bajar al abrir la pantalla (o al pasar a Whisper), asi esta listo al terminar de hablar
  useEffect(() => {
    if (modo !== 'grabacion' || !usaWhisper() || whisperPreparado()) return;
    const archivos = new Map();
    const quitar = escucharWhisper(m => {
      if (m.tipo === 'progreso') {
        archivos.set(m.archivo, m);
        const todos = [...archivos.values()];
        setDescarga(Math.round(todos.reduce((s, a) => s + a.cargado, 0) / todos.reduce((s, a) => s + a.total, 0) * 100));
      } else if (m.tipo === 'preparado') setDescarga(null);
      else if (m.tipo === 'error') {
        setDescarga(null);
        setAviso('No se pudo descargar el reconocimiento de voz. Revisa la conexión; mientras tanto, escribe lo que se dijo.');
      }
    });
    prepararWhisper();
    return quitar;
  }, [modo]);

  // vista previa de lo que se entendio
  const entendido = texto.trim() ? interpretarDictado(texto.slice(0, largos.dictado), todosLosProductos(), { donadores: estado.donadores, actividades: opcionesActividad() }) : [];

  // un toque empieza a escuchar y otro termina
  function alternar() {
    if (grabando) terminar();
    else if (modo === 'navegador') escucharConNavegador();
    else empezar();
  }

  // ---------- con el reconocimiento del navegador ----------
  function escucharConNavegador() {
    const Reconocedor = reconocedorNavegador();
    const r = new Reconocedor();
    r.lang = 'es-PE';
    r.continuous = true;
    r.interimResults = true;
    // lo que ya estaba escrito queda; lo nuevo se va agregando mientras se habla
    const antes = texto.trim();
    r.onresult = e => {
      const dicho = [...e.results].map(resultado => resultado[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
      setTexto([antes, dicho].filter(Boolean).join(', ').slice(0, largos.dictado));
    };
    r.onerror = e => {
      if (e.error === 'not-allowed') setAviso('No diste permiso para usar el micrófono.');
      else if (e.error === 'no-speech') setAviso('No se escuchó nada. Acércate al micrófono y vuelve a intentarlo.');
      else if (e.error !== 'aborted') {
        // sin internet (o el navegador no lo permite): desde ahora se usa Whisper, que funciona sin conexión
        dejarNavegador();
        setModo(modoVoz());
        // Vivaldi, Brave y Opera traen la funcion pero sin el servicio detras: falla aunque haya internet
        setAviso(navigator.onLine
          ? 'Este navegador no trae reconocimiento de voz (sí lo traen Chrome y Edge). Se usará el de este equipo: presiona otra vez para hablar.'
          : 'No hay internet. Se usará el reconocimiento de este equipo: presiona otra vez para hablar.');
      }
    };
    r.onend = () => {
      reconocedor.current = null;
      setGrabando(false);
    };
    setAviso('');
    reconocedor.current = r;
    r.start();
    setSegundos(0);
    setGrabando(true);
  }

  // ---------- grabando para Whisper ----------
  async function empezar() {
    if (abriendo.current || escribiendo) return;
    abriendo.current = true;
    setAviso('');
    let flujo;
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setAviso(e.name === 'NotAllowedError' ? 'No diste permiso para usar el micrófono.' : 'No se pudo abrir el micrófono.');
      return;
    } finally {
      abriendo.current = false;
    }

    const partes = [];
    const g = new MediaRecorder(flujo);
    const inicio = Date.now();
    g.ondataavailable = e => e.data.size && partes.push(e.data);
    g.onstop = async () => {
      flujo.getTracks().forEach(t => t.stop());
      if (Date.now() - inicio < 700) return setAviso('La grabación fue muy corta: presiona, habla y vuelve a presionar al terminar.');
      setEscribiendo(true);
      try {
        const dicho = (await transcribir(new Blob(partes, { type: g.mimeType }))).trim();
        if (!dicho) setAviso('No se escuchó nada. Acércate al micrófono y vuelve a intentarlo.');
        else {
          setAviso('');
          setTexto(t => [t.trim(), dicho].filter(Boolean).join(', ').slice(0, largos.dictado));
        }
      } catch {
        setAviso('No se pudo entender el audio. Vuelve a intentarlo o escríbelo.');
      } finally {
        setEscribiendo(false);
      }
    };
    grabadora.current = g;
    g.start();
    setSegundos(0);
    setGrabando(true);
  }

  function terminar() {
    if (reconocedor.current) {
      // al terminar llega el ultimo resultado y despues onend
      reconocedor.current.stop();
      return;
    }
    if (grabadora.current?.state === 'recording') grabadora.current.stop();
    grabadora.current = null;
    setGrabando(false);
  }

  // contador y tope de un minuto
  useEffect(() => {
    if (!grabando) return;
    const reloj = setInterval(() => setSegundos(s => {
      if (s + 1 >= maximoGrabacion) terminar();
      return s + 1;
    }), 1000);
    return () => clearInterval(reloj);
  }, [grabando]);

  // al salir de la pantalla se apaga el microfono
  useEffect(() => () => {
    reconocedor.current?.abort();
    if (grabadora.current?.state === 'recording') grabadora.current.stop();
  }, []);

  let estadoVoz = 'Presiona para hablar';
  if (grabando) estadoVoz = `Escuchando… 0:${String(segundos).padStart(2, '0')} · presiona otra vez para terminar`;
  else if (escribiendo) estadoVoz = descarga != null ? 'Escribirá lo que dijiste cuando termine de prepararse…' : 'Escribiendo lo que dijiste…';
  const comoReconoce = modo === 'navegador' ? 'Reconocimiento del navegador (usa internet)' : 'Reconocimiento en este equipo (Whisper)';

  return (
    <Fondo>
      <form className="modal" id="form-voz" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, agregarDictado)}>
        <CabeceraLote subtitulo='Ej. "dos kilos de arroz y tres latas de leche"' />
        <div className="modal-cuerpo">
          <div className="voz">
            <button
              type="button"
              id="microfono"
              className={`microfono ${grabando ? 'grabando' : ''}`}
              aria-label={grabando ? 'Terminar de grabar' : 'Empezar a grabar'}
              aria-pressed={grabando}
              disabled={!conVoz || escribiendo}
              onClick={alternar}
            >
              <IconoMicrofono />
            </button>
            <p className="voz-estado" aria-live="polite">{conVoz ? estadoVoz : sinVoz}</p>
            {conVoz && <small className="voz-modo" id="voz-modo">{comoReconoce}</small>}
            {descarga != null && (
              <div className="voz-descarga" id="voz-descarga">
                <span>Preparando el reconocimiento de voz (solo la primera vez) · {descarga}%</span>
                <div className="voz-descarga-barra"><div style={{ width: `${descarga}%` }} /></div>
              </div>
            )}
            {aviso && <p className="voz-aviso">{aviso}</p>}
          </div>

          <div className="campo">
            <label htmlFor="dictado">LO QUE SE DIJO</label>
            <textarea id="dictado" name="dictado" rows={3} maxLength={largos.dictado} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Aparece aquí lo que digas. También puedes escribir o corregir." />
          </div>

          {entendido.length > 0 && (
            <div className="entendido">
              <span>Entendí</span>
              <ul>
                {entendido.map((r, i) => <LineaEntendida key={i} r={r} />)}
              </ul>
            </div>
          )}

          <MensajeError texto={f.error} />
        </div>
        <Botones textoGuardar="Agregar a la lista" />
      </form>
    </Fondo>
  );
}

// ---------- 3. la lista ----------
// "Donó Parroquia San José · Navidad" o "Compra del hogar"
function textoDonador(x) {
  const nombre = donadorDeItem(x);
  // sin donador pero con actividad ("donacion libre"): el aviso pide el donador
  if (!nombre) return x.donadorDicho || x.actividad ? '' : 'Compra del hogar';
  return `Donó ${nombre}${x.donador === 'nuevo' ? ' (nuevo)' : ''}${x.actividad ? ` · ${x.actividad}` : ''}`;
}

function FilaLote({ x, tipo }) {
  const producto = productoDeItem(x);
  const problemas = problemasItem(x);
  const nombre = nombreItem(x);

  const detalles = [];
  if (producto) detalles.push(presentacion(producto.item));
  if (tipo === 'Ingreso' && x.vence !== undefined) detalles.push(x.vence ? `Vence ${fechaVence(x.vence)}` : 'Sin fecha de vencimiento');
  if (tipo === 'Ingreso' && textoDonador(x)) detalles.push(textoDonador(x));
  if (x.para.length) detalles.push(`Para ${textoPara(x)}`);
  if (x.observaciones) detalles.push(x.observaciones);
  if (x.origen === 'voz' && producto) detalles.push(`Dijiste "${x.dicho}"`);
  if (x.origen === 'codigo') detalles.push(`Código ${x.codigoBarras}`);

  return (
    <li className={`lote-fila ${problemas.length ? 'con-problema' : ''}`} data-item={x.id}>
      <span className={`tarjeta-codigo ${producto ? colorCategoria(producto.categoria) : 'gris'}`}>{producto ? producto.item.codigo : '?'}</span>
      <div className="lote-fila-info">
        <b>{nombre}</b>
        {producto && <span className={`pastilla ${colorCategoria(producto.categoria)}`}>{nombreCategoria(producto.categoria)}</span>}
        {producto?.nuevo && <span className="pastilla naranja">Nuevo</span>}
        {detalles.length > 0 && <small>{detalles.join(' · ')}</small>}
        {problemas.map(p => <span key={p} className="lote-problema">{p}</span>)}
      </div>
      <div className="lote-fila-cantidad">
        <b>{x.cantidad ?? '—'}</b>
        {/* tal como se dijo si esa presentacion no esta registrada ("10 bolsas") */}
        <span>{x.avisos.presentacion?.unidad ?? producto?.item.unidad}</span>
      </div>
      <div className="lote-fila-botones">
        <button type="button" className="btn-icono" data-accion="editar-item" aria-label={`Editar ${nombre}`} onClick={() => abrirItem(x.id)}><IconoEditar /></button>
        <button type="button" className="btn-icono btn-icono-rojo" data-accion="quitar-item" aria-label={`Quitar ${nombre}`} onClick={() => quitarItem(x.id)}><IconoBorrar /></button>
      </div>
    </li>
  );
}

export function ModalLoteLista({ modal }) {
  const f = useFormulario();
  // paso 2 (confirmar) o la lista
  const [confirmando, setConfirmando] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const lote = estado.lote;
  if (!lote) return null;
  const { tipo, items } = lote;
  const conProblemas = items.filter(x => problemasItem(x).length).length;

  let subtitulo = 'Puedes editar o quitar cada producto';
  if (items.length === 0) subtitulo = 'La lista está vacía';
  else if (conProblemas) subtitulo = `${conProblemas} por corregir`;

  return (
    <Fondo>
      <form className="modal modal-lote" id="form-lote" ref={f.formulario} hidden={confirmando} noValidate onSubmit={e => f.enviar(e, revisarLote) && setConfirmando(true)}>
        <CabeceraLote titulo={`${tipos[tipo].titulo} · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`} subtitulo={subtitulo} />

        <div className="modal-cuerpo">
          {conProblemas > 0 && (
            <p className="lote-ayuda" id="lote-ayuda">
              Lo que está en rojo falta corregir: toca el lápiz <IconoEditar /> de ese producto.
            </p>
          )}
          {items.length > 0 && <ul className="lote-lista">{items.map(x => <FilaLote key={x.id} x={x} tipo={tipo} />)}</ul>}
          <button type="button" className="btn-anadir" data-accion="anadir" onClick={abrirMetodos}>+ Añadir productos</button>
          <MensajeError texto={f.error} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-blanco" data-accion="descartar-lista" onClick={() => (descartar ? descartarLote() : setDescartar(true))}>
            {descartar ? '¿Seguro? Descartar' : 'Descartar'}
          </button>
          <button type="submit" className="btn btn-verde">Revisar {tipo.toLowerCase()}</button>
        </div>
      </form>

      {confirmando && <ConfirmarLote modal={modal} onVolver={() => setConfirmando(false)} />}
    </Fondo>
  );
}

// ---------- 4. confirmar ----------
function ConfirmarLote({ modal, onVolver }) {
  const { tipo, items } = estado.lote;
  const esIngreso = tipo === 'Ingreso';

  // stock que va quedando: dos filas del mismo producto se suman
  const quedan = new Map();
  const filas = items.map(x => {
    const { item, nuevo } = productoDeItem(x);
    const antes = quedan.get(item) ?? item.cantidad;
    const despues = redondear(antes + (esIngreso ? x.cantidad : -x.cantidad));
    quedan.set(item, despues);
    return { x, item, nuevo, antes, despues };
  });

  const detalle = x => [
    esIngreso ? (x.vence ? `Vence ${fechaVence(x.vence)}` : 'Sin fecha') : '',
    esIngreso ? textoDonador(x) : '',
    x.para.length ? `Para ${textoPara(x)}` : '',
    x.observaciones,
  ].filter(Boolean).join(' · ');

  return (
    <form className="modal modal-lote" id="form-lote-confirmar" noValidate onSubmit={e => { e.preventDefault(); confirmarLote(modal); }}>
      <CabeceraLote titulo={esIngreso ? 'Revisa el ingreso' : 'Revisa la salida'} subtitulo={`${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${usuario.nombre} · ${fechaActual()}`} onVolver={onVolver} />

      <div className="modal-cuerpo">
        <ul className="lote-resumen">
          {filas.map(({ x, item, nuevo, antes, despues }) => (
            <li key={x.id}>
              <div>
                <b>{item.nombre}{nuevo ? ' (producto nuevo)' : ''}</b>
                <small>{presentacion(item)}</small>
                {detalle(x) && <small>{detalle(x)}</small>}
                {!esIngreso && despues < item.minimo && <span className="lote-problema">Quedará bajo el mínimo ({item.minimo} {item.unidad})</span>}
              </div>
              <div className={`lote-cambio ${esIngreso ? 'ingreso' : 'salida'}`}>
                <em>{tipos[tipo].signo}{x.cantidad} {item.unidad}</em>
                <small>{antes} → {despues}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="modal-footer">
        <button type="submit" className="btn btn-verde">Confirmar {tipo.toLowerCase()} ({items.length})</button>
      </div>
    </form>
  );
}

// ---------- editar una fila ----------
// lo guardado del donador de la fila, como valores iniciales del formulario
function donadorInicial(x, actividades) {
  const conocida = actividades.includes(x.actividad);
  return {
    // si se dijo un donador que no esta, se propone como nuevo con ese nombre
    donador: x.donador || (x.donadorDicho ? 'nuevo' : ''),
    actividad: conocida ? x.actividad : x.actividad ? 'otra' : '',
    'actividad-otra': conocida ? '' : x.actividad,
    'donador-nombre': x.donadorNuevo?.nombre ?? x.donadorDicho,
    'donador-telefono': x.donadorNuevo?.telefono ?? '',
  };
}

export function ModalLoteItem({ modal }) {
  const f = useFormulario();
  const x = estado.lote?.items.find(i => i.id === modal.itemId);
  const [clave, setClave] = useState(() => {
    if (x?.productoNuevo) return 'nuevo';
    return x?.productoId != null ? claveProducto(x.categoria, x.productoId) : '';
  });
  const elegido = clave === 'nuevo' && x?.productoNuevo ? { item: x.productoNuevo, categoria: x.categoria, nuevo: true } : productoPorClave(clave);
  const decimales = elegido ? decimalesDe(elegido.item.unidad) : 2;

  // al cambiar de producto, corrige los decimales de lo escrito
  useEffect(() => {
    const campo = f.formulario.current?.elements.cantidad;
    if (campo) filtrarNumero(campo, decimales);
  }, [decimales, f.formulario]);

  if (!x) return null;
  const esIngreso = estado.lote.tipo === 'Ingreso';
  const actividades = opcionesActividad();

  // el nombre con su presentacion: hay varios tamaños del mismo producto
  const opciones = [['', 'Elige el producto']];
  if (x.productoNuevo) opciones.push([null, 'Nuevo'], ['nuevo', `${x.productoNuevo.nombre} · ${presentacion(x.productoNuevo)}`]);
  for (const categoria of ['Alimentos', 'Salud']) {
    opciones.push([null, nombreCategoria(categoria)]);
    for (const p of todosLosProductos().filter(p => p.categoria === categoria)) opciones.push([claveProducto(categoria, p.item.id), `${p.item.nombre} · ${presentacion(p.item)}`]);
  }
  const dudas = x.dudas.map(c => productoPorClave(c)?.item.nombre).filter(Boolean);

  // presentacion dicha que no esta registrada ("bolsas de 10 L")
  const otra = x.avisos.presentacion;
  const dicho = productoDeItem(x);
  // el nombre sin su tamaño del final: "Leche Evaporada Gloria 400 g" -> "Leche Evaporada Gloria"
  const nombreBase = dicho ? dicho.item.nombre.replace(/\s+\d+(?:[.,]\d+)?\s(?:g|kg|ml|L|unidades)$|\s+a Granel$/i, '') : x.nombreDicho;
  const crearProducto = () => abrirProducto(elegido?.categoria ?? x.categoria ?? 'Alimentos', {
    itemId: x.id,
    nombre: nombreBase,
    codigoBarras: x.codigoBarras,
    ...(otra && { presentacion: { unidad: otra.unidad ?? dicho?.item.unidad, tamano: otra.tamano } }),
  });

  let subtitulo = 'Elige qué producto es';
  if (elegido) subtitulo = `${presentacion(elegido.item)} · ${nombreCategoria(elegido.categoria)} · ${elegido.nuevo ? 'producto nuevo' : `${elegido.item.cantidad} ${elegido.item.unidad} en stock`}`;

  return (
    <Fondo>
      <form className="modal" id="form-item" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => guardarItem(modal, v))}>
        <CabeceraLote titulo={elegido ? elegido.item.nombre : 'Editar producto'} subtitulo={subtitulo} />

        <div className="modal-cuerpo">
          {x.dicho && <p className="lote-origen">Se dijo: <b>"{x.dicho}"</b></p>}
          {x.origen === 'codigo' && <p className="lote-origen">Código escaneado: <b>{x.codigoBarras}</b></p>}

          <div className="campo">
            <label htmlFor="producto">PRODUCTO</label>
            <Desplegable id="producto" name="producto" opciones={opciones} valor={clave} onChange={setClave} />
            {dudas.length > 0 && !elegido && <small>Puede ser: {dudas.join(' o ')}</small>}
            {esIngreso && !x.productoNuevo && (otra ? (
              // la presentacion dicha no esta registrada: se ofrece crearla ya rellenada
              <button type="button" className="btn-anadir lote-crear-presentacion" data-accion="crear-producto" onClick={crearProducto}>
                + Crear "{nombreBase}" en {otra.texto.startsWith('de ') ? otra.texto.slice(3) : otra.texto}
              </button>
            ) : (
              <button type="button" className="link lote-crear" data-accion="crear-producto" onClick={crearProducto}>
                ¿No está o es de otro tamaño? Crear producto nuevo
              </button>
            ))}
          </div>

          <div className="dos-columnas">
            <div className="campo">
              <label htmlFor="cantidad">CANTIDAD{elegido ? ` (${elegido.item.unidad.toUpperCase()})` : ''}</label>
              <CampoNumero id="cantidad" decimales={decimales} placeholder="0" defaultValue={x.cantidad ?? ''} autoFocus={Boolean(elegido)} onAviso={f.setError} />
              {elegido && !esIngreso && <small>Se pueden usar {disponible(elegido.item)}</small>}
            </div>
            {esIngreso && <CampoVencimiento inicial={x.vence} />}
          </div>

          {esIngreso && (
            <>
              <CampoDonador donadores={estado.donadores} actividades={actividades} inicial={donadorInicial(x, actividades)} />
              {estado.lote.items.some(o => o !== x && !o.donador && !o.donadorDicho) && (
                <label className="check-campo">
                  <input type="checkbox" name="donador-todos" />
                  Usar este donador en los productos de la lista que no tienen
                </label>
              )}
            </>
          )}
          {!esIngreso && elegido?.categoria === 'Salud' && <CampoPara ninos={opcionesNinos()} inicial={x.para} />}
          <CampoObservaciones ejemplo="Opcional" inicial={x.observaciones} />

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar="Guardar" />
      </form>
    </Fondo>
  );
}
