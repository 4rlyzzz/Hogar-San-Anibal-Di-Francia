// registrar varios productos a la vez: buscar (o escanear o dictar), la lista, editar una fila y confirmar
import { procesarTextoConIA } from '../servicios/dictadoIA.js';
import { useEffect, useRef, useState } from 'react';
import { estado } from '../estado.js';
import { usuario } from '../data/datos.js';
import { largos, decimalesDe } from '../validacion.js';
import { IconoCodigo, IconoMicrofono, IconoEditar, IconoBorrar, IconoIngreso, IconoSalida, IconoBuscar } from '../assets/iconos.jsx';
import {
  abrirBusqueda, abrirCodigo, abrirVozLote, tipoElegido, abrirLista, agregarManual, agregarCodigo, agregarDictado, abrirItem, quitarItem, guardarItem, revisarLote, confirmarLote,
  descartarLote, problemasItem, productoDeItem, nombreItem, donadorDeItem, todosLosProductos, claveProducto, productoPorClave,
  opcionesActividad, opcionesNinos, abrirProducto, intentar, cantidadDicha, baseDe, categorias, personaDeItem, extraDictado,
  tipoDeItem, esIngresoItem, ingresosDe, salidasDe, listaMezclada, textoParaIA, personaDictada,
} from '../acciones.js';
import { nombreCategoria, colorCategoria, textoPara, redondear, fechaActual, coincideNombre, textoPresentacion, disponible } from '../logica/comunes.js';
import { CATEGORIA as MERCH, esMerch, textoMerch, textoTipo, soles, nombreMedio, totalVenta, llevaProveedor } from '../logica/merch.js';
import { CamposIngresoMerch, CamposSalidaMerch, CampoVenceMerch, textoFilaMerch } from './Merch.jsx';
import { fechaVence } from '../logica/lotes.js';
import { interpretarMezclado, tipoDictado, productoDeNombre, cantidadDeLaIA, desempatarConLocal, mismoProducto, compartirVentaIA, categoriaDeIA, enInventario } from '../logica/dictado.js';
import { reconocedorNavegador, crearLector } from '../servicios/captura.js';
import {
  useFormulario, filtrarNumero, CampoNumero, Fondo, Cabecera, Botones, MensajeError, CampoVencimiento, CampoDonador, CampoPara, CampoObservaciones,
} from './Formulario.jsx';


// lo que cambia entre ingreso y salida
const tipos = {
  Ingreso: { titulo: 'Registrar ingreso', color: 'verde', Icono: IconoIngreso, signo: '+' },
  Salida: { titulo: 'Registrar salida', color: 'naranja', Icono: IconoSalida, signo: '−' },
  // la lista tiene de los dos
  Mezcla: { titulo: 'Registrar ingresos y salidas', color: 'azul', Icono: IconoIngreso, signo: '' },
};

// tipo: el de una fila o 'Mezcla'; sin el, lo que se esta agregando
function CabeceraLote({ titulo, subtitulo, onVolver, tipo }) {
  const t = tipos[tipo ?? estado.lote.tipo];
  return <Cabecera codigo={<t.Icono />} color={t.color} titulo={titulo ?? t.titulo} subtitulo={subtitulo} onVolver={onVolver} />;
}

// 'Lata x 400 g' o 'Suelto, en kg': para no confundir tamaños del mismo producto
const presentacion = item => (item.tipoMerch ? textoMerch(item) || textoTipo(item) : textoPresentacion(item) || `Suelto, en ${item.unidad}`);

// ---------- pestañas por inventario ----------
// la lista de productos mezclaba alimentos, salud y merch: se separa por pestañas
// encontrados: lo que coincide con lo escrito (el numero de cada pestaña es de eso)
const nombresPestana = { Todos: 'Todos', Alimentos: 'Alimentos', Salud: 'Salud', [MERCH]: 'Merch' };

function PestanasCategoria({ valor, onCambiar, encontrados }) {
  return (
    <div className="filtros lote-categorias" role="radiogroup" aria-label="Inventario">
      {['Todos', ...categorias].map(c => {
        const n = c === 'Todos' ? encontrados.length : encontrados.filter(p => p.categoria === c).length;
        return (
          <button key={c} type="button" role="radio" aria-checked={valor === c} className={valor === c ? 'activo' : ''} data-accion="categoria-lote" onClick={() => onCambiar(c)}>
            {nombresPestana[c]} <span className="lote-categoria-numero">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

const enCategoria = (lista, categoria) => (categoria === 'Todos' ? lista : lista.filter(p => p.categoria === categoria));

// ---------- 1a. buscar el producto ----------
export function ModalLoteManual() {
  const [busqueda, setBusqueda] = useState('');
  // desde la pagina de un inventario se empieza en esa pestaña
  const [categoria, setCategoria] = useState(() => (categorias.includes(estado.seccion) ? estado.seccion : 'Todos'));
  const encontrados = todosLosProductos().filter(({ item }) => !busqueda.trim() || coincideNombre(busqueda, item.nombre));
  const productos = enCategoria(encontrados, categoria);
  const esSalida = estado.lote.tipo === 'Salida';

  return (
    <Fondo>
      <div className="modal" id="lote-manual">
        <CabeceraLote subtitulo="Elige el producto" />
        <div className="modal-cuerpo">
          <div className="lote-buscar-fila">
            <div className="buscador lote-buscador">
              <IconoBuscar />
              <input id="lote-buscar" type="search" maxLength={largos.busqueda} autoComplete="off" autoFocus placeholder="Buscar producto" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
            <button type="button" className="btn btn-blanco lote-camara" data-accion="escanear" title="Escanear el código de barras con la cámara" onClick={abrirCodigo}>
              <IconoCodigo /> <span className="lote-boton-texto">Escanear</span>
            </button>
            <button type="button" className="btn btn-blanco lote-camara" data-accion="dictar" title="Decir los productos con el micrófono" onClick={abrirVozLote}>
              <IconoMicrofono /> <span className="lote-boton-texto">Hablar</span>
            </button>
          </div>
          <PestanasCategoria valor={categoria} onCambiar={setCategoria} encontrados={encontrados} />
          <div className="lote-productos">
            {productos.length === 0 && <p className="lote-vacio">{encontrados.length ? `No hay en ${nombresPestana[categoria]}: mira en las otras pestañas.` : 'No hay productos con ese nombre.'}</p>}
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
            <button type="button" className="btn-anadir" data-accion="crear-producto" onClick={() => abrirProducto(categoria !== 'Todos' ? categoria : categorias.includes(estado.seccion) ? estado.seccion : 'Alimentos', { nombre: busqueda.trim().slice(0, largos.nombreProducto) })}>
              + ¿No está? Crear producto nuevo
            </button>
          )}
        </div>
      </div>
    </Fondo>
  );
}

// ---------- 1b. codigo de barras ----------
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

// ---------- 1c. voz (se abre con el microfono junto al "+") ----------
// cuanto esperar (ms) despues de la ultima tecla para actualizar "Entendí"
// al escribir no se consulta a la IA (cada consulta cuesta): eso pasa al soltar el microfono o al agregar
const ESPERA_AL_ESCRIBIR = 300;

// una linea de "Entendí": arriba cuanto y que; abajo, en pequeño, lo que hay que saber
function LineaEntendida({ r, conTipo = false }) {
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
  else if (r.sinVence) datos.push('sin fecha de vencimiento');
  if (r.donador || r.donadorDicho) datos.push(`donó ${r.donador?.nombre ?? r.donadorDicho}`);
  if (r.actividad) datos.push(r.actividad);
  // comprador, proveedor y medio de pago solo son de merchandising: comprador y pago en una salida,
  // proveedor en un ingreso (y no en lo hecho en el hogar)
  const deVenta = !item || item.tipoMerch;
  const esSalida = r.tipo ? r.tipo === 'Salida' : true;
  const esIngreso = r.tipo ? r.tipo === 'Ingreso' : true;
  if (deVenta && esSalida && (r.comprador || r.compradorDicho)) datos.push(`compra ${r.comprador?.nombre ?? r.compradorDicho}`);
  if (deVenta && esIngreso && (!item || llevaProveedor(item)) && (r.proveedor || r.proveedorDicho)) datos.push(`proveedor ${r.proveedor?.nombre ?? r.proveedorDicho}`);
  if (r.precio != null) datos.push(`${soles(r.precio)} c/u`);
  if (deVenta && esSalida && r.medioPago) datos.push(nombreMedio(r.medioPago));

  return (
    <li className={avisos.length ? 'con-duda' : ''}>
      {conTipo && r.tipo && <span className={`pastilla ${r.tipo === 'Salida' ? 'naranja' : 'verde'} entendido-tipo`}>{r.tipo}</span>}
      <b>{r.cantidad != null ? `${r.cantidad} ${unidad}` : '—'}</b> · {nombre}
      {avisos.length > 0 && <small className="entendido-aviso">{avisos.join(' · ')}</small>}
      {datos.length > 0 && <small>{datos.join(' · ')}</small>}
    </li>
  );
}

const erroresMicrofono = {
  'not-allowed': 'Permiso de micrófono denegado. Actívalo en el candado junto a la dirección.',
  'service-not-allowed': 'Permiso de micrófono denegado. Actívalo en el candado junto a la dirección.',
  'audio-capture': 'No se encontró el micrófono o lo está usando otro programa.',
  'network': 'Sin conexión con el servicio de voz. Revisa internet o usa Chrome o Edge.',
};

// cortes del servicio de voz seguidos (sin oir nada entre ellos) que se reintentan solos
const MAXIMO_CORTES = 3;

function detenerReconocedor(ref) {
  const r = ref.current;
  if (!r) return;
  r.debeSeguir = false;
  try { r.abort(); } catch { /* ya estaba detenido */ }
}

export function ModalLoteVoz() {
  const f = useFormulario();
  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [cargandoIA, setCargandoIA] = useState(false);
  const [itemsEntendidos, setItemsEntendidos] = useState([]);
  const [aviso, setAviso] = useState('');
  const reconocedor = useRef(null);
  // cada consulta lleva un numero: si llega una respuesta vieja (se siguio escribiendo), no pisa a la nueva
  const consulta = useRef(0);
  // el temporizador de "dejo de escribir"
  const espera = useRef(null);

  // lo escrito a mano se entiende con el reconocimiento local, sin gastar en la IA
  // (al agregar a la lista, agregarDictado si consulta a la IA una vez)
  const vistaLocal = (textoCompleto) => {
    // una respuesta de la IA que venga en camino ya no corresponde a lo escrito
    ++consulta.current;
    setCargandoIA(false);
    setAviso('');
    const dichoTipo = tipoDictado(textoCompleto);
    // igual que procesarConOmni: con el tipo se sabe si "a María López" compra o vende
    const tipoVoz = dichoTipo.tipo ?? tipoElegido();
    if (!dichoTipo.resto.trim()) return setItemsEntendidos([]);
    // cada producto con su tipo ("ingreso de arroz y salida de leche")
    const local = interpretarMezclado(textoCompleto, todosLosProductos(), extraDictado, tipoVoz);
    setItemsEntendidos(local.map(r => ({ ...r, cantidad: cantidadDicha(r.cantidad) })));
  };

  // Procesa con la IA y obtiene la lista visual para el bloque "ENTENDÍ"
  const procesarConOmni = async (textoCompleto) => {
    const numero = ++consulta.current;
    // "ingreso" o "salida" no son productos
    const dichoTipo = tipoDictado(textoCompleto);
    // con el tipo, "a María López" es quien compra (venta) o a quien se le compro (ingreso)
    const tipoVoz = dichoTipo.tipo ?? tipoElegido();
    if (!dichoTipo.resto.trim()) return setItemsEntendidos([]);
    setCargandoIA(true);
    setAviso('');

    try {
      // 1. Petición a la IA (por Django)
      // con ingreso y salida dichos va todo el texto: la IA dice de que tipo es cada producto
      const json = await procesarTextoConIA(textoParaIA(textoCompleto));
      if (numero !== consulta.current) return;

      // 2. Mapeo para previsualización gráfica en UI
      // lo que no trae producto se descarta; una cantidad invalida (0, negativa, texto) queda como "falta la cantidad"
      // el nombre que entendio la IA se busca entre los registrados (con su dosis: 100 mg no es 50 mg)
      const productos = todosLosProductos();
      // el dictado local sirve para revisar la cantidad ("5 sacos de 50 kg" no son 50 sacos)
      const local = interpretarMezclado(textoCompleto, productos, extraDictado, tipoVoz);
      const mapeados = compartirVentaIA(Array.isArray(json) ? json.filter(i => i && typeof i === 'object') : [])
        .filter(i => i && typeof i.producto === 'string' && i.producto.trim())
        .map(i => {
          // si empatan varios, vale el que entendio el local por el tamaño dicho ("cajas de 20 unidades")
          // con el inventario dicho ("a merchandising"), solo entre sus productos
          const { producto, dudas } = desempatarConLocal(productoDeNombre(i.producto, enInventario(productos, categoriaDeIA(i, local))), local);
          const suyo = producto && local.find(x => mismoProducto(x.producto, producto));
          return {
            // con los dos dichos, el tipo sale del orden de lo dicho (el local); la IA a veces se equivoca
            tipo: dichoTipo.ambos ? (suyo?.tipo ?? { salida: 'Salida', ingreso: 'Ingreso' }[i.tipo] ?? null) : tipoVoz,
            vence: i.vence || suyo?.vence || null,
            donador: suyo?.donador ?? null,
            donadorDicho: suyo?.donadorDicho || '',
            actividad: suyo?.actividad || null,
            sinVence: !i.vence && Boolean(suyo?.sinVence),
            cantidad: cantidadDicha(cantidadDeLaIA(i.cantidad, i.unidad, producto?.item, suyo || null)),
            unidadDicha: typeof i.unidad === 'string' ? i.unidad : '',
            nombreDicho: i.producto.trim().slice(0, largos.nombreProducto),
            producto,
            dudas,
            presentacion: suyo?.presentacion ?? null,
            // igual que en la lista (personaDictada): asi "Entendí" muestra a quien quedara registrado
            compradorDicho: (() => { const p = personaDictada('comprador', i, suyo || {}); return p.registrado?.nombre ?? p.dicho; })(),
            proveedorDicho: (() => { const p = personaDictada('proveedor', i, suyo || {}); return p.registrado?.nombre ?? p.dicho; })(),
            precio: cantidadDicha(i.precio) ?? suyo?.precio ?? null,
            medioPago: i.medio_pago || suyo?.medioPago || '',
          };
        });
      // sin respuesta de la IA (no configurada o caida): se usa la interpretacion local
      if (!mapeados.length) throw new Error('sin IA');
      setItemsEntendidos(mapeados);
    } catch {
      if (numero !== consulta.current) return;
      // Fallback: si la IA da error, usamos la interpretación local nativa
      if (typeof interpretarMezclado === 'function') {
        const local = interpretarMezclado(textoCompleto, todosLosProductos(), extraDictado, tipoVoz);
        // igual que al agregar a la lista (agregarDictado)
        setItemsEntendidos(local.map(r => ({ ...r, cantidad: cantidadDicha(r.cantidad) })));
      } else {
        setAviso('No se pudo usar la IA: se usa el reconocimiento local.');
      }
    } finally {
      if (numero === consulta.current) setCargandoIA(false);
    }
  };

  function escucharNavegador() {
    const Reconocedor = reconocedorNavegador();
    if (!Reconocedor) {
      setAviso('Usa Edge o Chrome para habilitar la voz nativa.');
      return;
    }

    const r = new Reconocedor();
    r.lang = 'es-PE';
    r.continuous = true;
    r.interimResults = false;

    r.onresult = (e) => {
      // oyo algo: los cortes de antes ya no cuentan como seguidos
      r.cortes = 0;
      let trascripcion = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        trascripcion += e.results[i][0].transcript + ' ';
      }
      setTexto(prev => {
        const nuevoTexto = (prev + ' ' + trascripcion).trim();
        return nuevoTexto;
      });
    };

    r.onerror = (e) => {
      // 'no-speech' es solo silencio: se sigue escuchando
      if (e.error === 'no-speech') return;
      // 'network': el servicio de voz del navegador (Google) corta las sesiones largas aunque haya internet.
      // Se vuelve a encender solo (onend) y lo dicho se conserva; solo se avisa si se corta varias veces
      // seguidas sin oir nada, que ya es un corte de verdad
      if (e.error === 'network' && r.debeSeguir && (r.cortes = (r.cortes ?? 0) + 1) <= MAXIMO_CORTES) return;
      // cualquier otro error detiene de verdad (si no, onend lo reinicia y falla en bucle)
      r.debeSeguir = false;
      if (e.error !== 'aborted') setAviso(erroresMicrofono[e.error] ?? 'Error o corte en el micrófono.');
      if (reconocedor.current === r) setGrabando(false);
    };

    r.onend = () => {
      // solo se reinicia el reconocedor activo y si no se pidio parar
      if (r.debeSeguir && reconocedor.current === r) {
        const reanudar = () => {
          if (!r.debeSeguir || reconocedor.current !== r) return;
          try { r.start(); } catch { r.debeSeguir = false; setGrabando(false); }
        };
        // tras un corte se espera un poco antes de reconectar
        if (r.cortes) setTimeout(reanudar, 400);
        else reanudar();
      } else if (reconocedor.current === r) {
        setGrabando(false);
      }
    };

    // nunca dos reconocedores a la vez
    detenerReconocedor(reconocedor);
    r.debeSeguir = true;
    reconocedor.current = r;
    setAviso('');
    try {
      r.start();
      setGrabando(true);
    } catch {
      r.debeSeguir = false;
      setAviso('No se pudo iniciar el micrófono.');
    }
  }

  // al cerrar la ventana de voz se apaga el microfono y no queda una consulta pendiente
  useEffect(() => () => {
    detenerReconocedor(reconocedor);
    clearTimeout(espera.current);
  }, []);

  function alternar() {
    if (grabando) {
      clearTimeout(espera.current);
      if (reconocedor.current) reconocedor.current.debeSeguir = false;
      reconocedor.current?.stop();
      setGrabando(false);
      // Al apagar el micrófono (Tiempo 2), consultamos a la IA
      procesarConOmni(texto);
    } else {
      escucharNavegador();
    }
  }

  // ingreso o salida: lo que se dijo o, si no se dijo, el de la lista que ya esta abierta
  // con los dos dichos ("ingreso de arroz y salida de leche") van juntos a la lista
  const dicho = tipoDictado(texto);
  const tipo = tipos[dicho.ambos ? 'Mezcla' : dicho.tipo ?? tipoElegido()];
  let falta = '';
  if (texto.trim() && !tipo) falta = 'Falta decir si es ingreso o salida.';

  return (
    <Fondo>
      <form
        className="modal"
        id="form-voz"
        ref={f.formulario}
        noValidate
        /* 
           Simplemente pasamos agregarDictado como callback a f.enviar. 
           f.enviar le enviará la referencia del formulario (v) donde 
           leer(v, 'dictado') extraerá automáticamente el valor del textarea.
        */
        onSubmit={e => f.enviar(e, agregarDictado)}
      >
        <Cabecera
          codigo={tipo ? <tipo.Icono /> : <IconoMicrofono />}
          color={tipo?.color ?? 'gris'}
          titulo={tipo?.titulo ?? 'Registrar por voz'}
          subtitulo='Di "ingreso" o "salida" y los productos (pueden ir los dos)'
        />
        <div className="modal-cuerpo">
          <div className="voz">
            <button
              type="button"
              className={`microfono ${grabando ? 'grabando' : ''}`}
              onClick={alternar}
              disabled={cargandoIA}
            >
              <IconoMicrofono />
            </button>
            <p className="voz-estado">
              {grabando ? 'Escuchando... vuelve a presionar para procesar' : 'Presiona el micrófono para hablar'}
            </p>
            {aviso && <p className="voz-aviso">{aviso}</p>}
          </div>

          <div className="campo">
            <label htmlFor="dictado">LO QUE SE DIJO</label>
            <textarea
              id="dictado"
              name="dictado" // 👈 Nombre crucial requerido por leer(v, 'dictado')
              rows={2}
              value={texto}
              onChange={e => {
                const escrito = e.target.value;
                setTexto(escrito);
                // se actualiza cuando deja de escribir, no con cada tecla
                clearTimeout(espera.current);
                espera.current = setTimeout(() => vistaLocal(escrito), ESPERA_AL_ESCRIBIR);
              }}
              placeholder='Ej. "ingreso de dos kilos de arroz", "salida de tres latas de leche" o "venta de 2 panetones a Rosa Quispe, pagó con Yape"'
            />
            {falta && <small id="voz-falta">{falta}</small>}
          </div>

          {cargandoIA && <p style={{ textAlign: 'center', color: '#007acc' }}>🤖 Procesando con IA…</p>}

          {/* Renderizado de la lista entendida */}
          {itemsEntendidos.length > 0 && (
            <div className="entendido">
              <span>ENTENDÍ</span>
              <ul>
                {itemsEntendidos.map((r, idx) => (
                  <LineaEntendida key={idx} r={r} conTipo={dicho.ambos} />
                ))}
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

// ---------- 2. la lista ----------
// "Donó Parroquia San José · Navidad" o "Compra del hogar"
function textoDonador(x) {
  const nombre = donadorDeItem(x);
  // sin donador pero con actividad ("donacion libre"): el aviso pide el donador
  if (!nombre) return x.donadorDicho || x.actividad ? '' : 'Compra del hogar';
  return `Donó ${nombre}${x.donador === 'nuevo' ? ' (nuevo)' : ''}${x.actividad ? ` · ${x.actividad}` : ''}`;
}

function textoMerchFila(x, tipo) {
  const esIngreso = tipo === 'Ingreso';
  const nombre = campo => personaDeItem(x, campo) || x[`${campo}Dicho`] || '';
  return textoFilaMerch({
    esIngreso, proveedor: nombre('proveedor'), comprador: nombre('comprador'), costo: x.costo, precio: x.precio,
    cantidad: x.cantidad, medio: nombreMedio(x.medioPago), taller: x.taller,
  });
}

function FilaLote({ x, tipo }) {
  const producto = productoDeItem(x);
  const problemas = problemasItem(x);
  const nombre = nombreItem(x);

  const detalles = [];
  const merch = producto && esMerch(producto.categoria);
  if (producto) detalles.push(presentacion(producto.item));
  if (tipo === 'Ingreso' && x.vence !== undefined && (!merch || x.vence)) detalles.push(x.vence ? `Vence ${fechaVence(x.vence)}` : 'Sin fecha de vencimiento');
  if (merch && textoMerchFila(x, tipo)) detalles.push(textoMerchFila(x, tipo));
  else if (tipo === 'Ingreso' && !merch && textoDonador(x)) detalles.push(textoDonador(x));
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
  const { items } = lote;
  const conProblemas = items.filter(x => problemasItem(x).length).length;
  // ingresos y salidas en la misma lista: cada uno en su seccion
  const mezcla = listaMezclada(lote);
  const tipo = mezcla ? 'Mezcla' : items.length ? tipoDeItem(items[0]) : lote.tipo;
  const secciones = mezcla
    ? [['Ingreso', 'Ingresos', ingresosDe(lote)], ['Salida', 'Salidas', salidasDe(lote)]]
    : [[tipo, null, items]];

  let subtitulo = 'Puedes editar o quitar cada producto';
  if (items.length === 0) subtitulo = 'La lista está vacía';
  else if (conProblemas) subtitulo = `${conProblemas} por corregir`;
  else if (mezcla) subtitulo = `${ingresosDe(lote).length} de ingreso y ${salidasDe(lote).length} de salida`;
  const revisar = { Ingreso: 'Revisar ingreso', Salida: 'Revisar salida', Mezcla: 'Revisar todo' }[tipo];

  return (
    <Fondo>
      <form className="modal modal-lote" id="form-lote" ref={f.formulario} hidden={confirmando} noValidate onSubmit={e => f.enviar(e, revisarLote) && setConfirmando(true)}>
        <CabeceraLote tipo={tipo} titulo={`${tipos[tipo].titulo} · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`} subtitulo={subtitulo} />

        <div className="modal-cuerpo">
          {conProblemas > 0 && (
            <p className="lote-ayuda" id="lote-ayuda">
              Lo que está en rojo falta corregir: toca el lápiz <IconoEditar /> de ese producto.
            </p>
          )}
          {items.length > 0 && secciones.map(([t, titulo, filas]) => (
            <section key={t} className="lote-seccion">
              {titulo && <h3 className={`lote-seccion-titulo ${tipos[t].color}`}><span>{tipos[t].signo}</span> {titulo} <small>{filas.length}</small></h3>}
              <ul className="lote-lista">{filas.map(x => <FilaLote key={x.id} x={x} tipo={t} />)}</ul>
            </section>
          ))}
          <button type="button" className="btn-anadir" data-accion="anadir" onClick={abrirBusqueda}>+ Añadir productos</button>
          <MensajeError texto={f.error} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-blanco" data-accion="descartar-lista" onClick={() => (descartar ? descartarLote() : setDescartar(true))}>
            {descartar ? '¿Seguro? Descartar' : 'Descartar'}
          </button>
          <button type="submit" className="btn btn-verde">{revisar}</button>
        </div>
      </form>

      {confirmando && <ConfirmarLote modal={modal} onVolver={() => setConfirmando(false)} />}
    </Fondo>
  );
}

// ---------- 3. confirmar ----------
function ConfirmarLote({ modal, onVolver }) {
  // se guarda fila por fila en el servidor: mientras tanto el boton queda en "Guardando…"
  const f = useFormulario();
  const lote = estado.lote;
  const { items } = lote;
  const mezcla = listaMezclada(lote);
  const tipo = mezcla ? 'Mezcla' : tipoDeItem(items[0]);

  // stock que va quedando: dos filas del mismo producto se suman
  // en el orden en que se guardan: primero los ingresos
  const quedan = new Map();
  const filas = [...ingresosDe(lote), ...salidasDe(lote)].map(x => {
    const { item, nuevo, categoria } = productoDeItem(x);
    const esIngreso = esIngresoItem(x);
    const antes = quedan.get(item) ?? item.cantidad;
    const despues = redondear(antes + (esIngreso ? x.cantidad : -x.cantidad));
    quedan.set(item, despues);
    return { x, item, nuevo, antes, despues, esIngreso, merch: esMerch(categoria) };
  });
  const secciones = mezcla
    ? [['Ingreso', 'Ingresos', filas.filter(r => r.esIngreso)], ['Salida', 'Salidas', filas.filter(r => !r.esIngreso)]]
    : [[tipo, null, filas]];

  const detalle = (x, merch, esIngreso) => [
    esIngreso && (!merch || x.vence) ? (x.vence ? `Vence ${fechaVence(x.vence)}` : 'Sin fecha') : '',
    merch ? textoMerchFila(x, tipoDeItem(x)) : esIngreso ? textoDonador(x) : '',
    x.para.length ? `Para ${textoPara(x)}` : '',
    x.observaciones,
  ].filter(Boolean).join(' · ');
  const ventas = redondear(salidasDe(lote).reduce((s, x) => s + (x.precio != null && x.cantidad ? totalVenta(x.precio, x.cantidad) : 0), 0));
  const tituloRevisa = { Ingreso: 'Revisa el ingreso', Salida: 'Revisa la salida', Mezcla: 'Revisa ingresos y salidas' }[tipo];
  const confirmar = { Ingreso: 'Confirmar ingreso', Salida: 'Confirmar salida', Mezcla: 'Confirmar todo' }[tipo];

  return (
    <form className="modal modal-lote" id="form-lote-confirmar" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, () => confirmarLote(modal))}>
      <CabeceraLote tipo={tipo} titulo={tituloRevisa} subtitulo={`${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${usuario.nombre} · ${fechaActual()}`} onVolver={onVolver} />

      <div className="modal-cuerpo">
        {secciones.map(([t, titulo, filasSeccion]) => (
          <section key={t} className="lote-seccion">
            {titulo && <h3 className={`lote-seccion-titulo ${tipos[t].color}`}><span>{tipos[t].signo}</span> {titulo} <small>{filasSeccion.length}</small></h3>}
            <ul className="lote-resumen">
              {filasSeccion.map(({ x, item, nuevo, antes, despues, merch, esIngreso }) => (
                <li key={x.id}>
                  <div>
                    <b>{item.nombre}{nuevo ? ' (producto nuevo)' : ''}</b>
                    <small>{presentacion(item)}</small>
                    {detalle(x, merch, esIngreso) && <small>{detalle(x, merch, esIngreso)}</small>}
                    {!esIngreso && despues < item.minimo && <span className="lote-problema">Quedará bajo el mínimo ({item.minimo} {item.unidad})</span>}
                  </div>
                  <div className={`lote-cambio ${esIngreso ? 'ingreso' : 'salida'}`}>
                    <em>{tipos[esIngreso ? 'Ingreso' : 'Salida'].signo}{x.cantidad} {item.unidad}</em>
                    <small>{antes} → {despues}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {ventas > 0 && <p className="lote-total-ventas">Total de ventas: <b>{soles(ventas)}</b></p>}
        <MensajeError texto={f.error} />
      </div>

      <Botones textoGuardar={`${confirmar} (${items.length})`} enviando={f.enviando} conCancelar={false} />
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

function merchInicial(x) {
  const persona = tipo => ({
    valor: x[tipo] || (x[`${tipo}Dicho`] ? 'nuevo' : ''),
    nombre: x[`${tipo}Nuevo`]?.nombre ?? x[`${tipo}Dicho`] ?? '',
    telefono: x[`${tipo}Nuevo`]?.telefono ?? '',
  });
  return {
    vence: x.vence, loteCodigo: x.loteCodigo, costo: x.costo, taller: x.taller, costoMateriales: x.costoMateriales,
    precio: x.precio, medioPago: x.medioPago, comprobanteTipo: x.comprobanteTipo, comprobanteNumero: x.comprobanteNumero,
    proveedor: persona('proveedor'), comprador: persona('comprador'),
  };
}

// elegir el producto escribiendo su nombre (con muchos productos una lista desplegable no sirve)
// sin escribir nada muestra primero los que pueden ser (lo dictado), si los hay
const MAXIMO_SUGERIDOS = 40;

function ElegirProducto({ clave, onElegir, x, esSalida }) {
  const nuevo = x.productoNuevo ? { item: x.productoNuevo, categoria: x.categoria, nuevo: true } : null;
  const elegido = clave === 'nuevo' ? nuevo : productoPorClave(clave);
  const [buscando, setBuscando] = useState(!elegido);
  const [texto, setTexto] = useState('');

  const posibles = x.dudas.map(c => productoPorClave(c)).filter(Boolean);
  // empieza en la pestaña del producto elegido; con dudas ("¿cuál de estos?") se ven todas
  // o en la del inventario que se dijo ("ingreso a merchandising de ...")
  const [categoria, setCategoria] = useState(() => (!posibles.length && elegido && !elegido.nuevo ? elegido.categoria : x.categoriaDicha ?? 'Todos'));
  const todos = todosLosProductos();
  const encontrados = texto.trim() ? todos.filter(({ item }) => coincideNombre(texto, item.nombre)) : posibles.length ? posibles : todos;
  const enPestana = enCategoria(encontrados, categoria);
  const visibles = enPestana.slice(0, MAXIMO_SUGERIDOS);

  function elegir(nuevaClave) {
    onElegir(nuevaClave);
    setBuscando(false);
    setTexto('');
  }

  if (elegido && !buscando) {
    return (
      <>
        <input type="hidden" name="producto" value={clave} />
        <div className="lote-producto lote-elegido">
          <span className={`tarjeta-codigo ${colorCategoria(elegido.categoria)}`}>{elegido.item.codigo ?? '+'}</span>
          <span>
            <b>{elegido.item.nombre}</b>
            <small>{presentacion(elegido.item)} · {nombreCategoria(elegido.categoria)}{elegido.nuevo ? ' · producto nuevo' : ''}</small>
          </span>
          <button type="button" className="link" data-accion="cambiar-producto" onClick={() => setBuscando(true)}>Cambiar</button>
        </div>
      </>
    );
  }

  return (
    <>
      <input type="hidden" name="producto" value={elegido ? clave : ''} />
      <div className="buscador lote-buscador">
        <IconoBuscar />
        <input
          id="producto"
          type="search"
          maxLength={largos.busqueda}
          autoComplete="off"
          autoFocus={Boolean(elegido) || !x.dudas.length}
          placeholder="Escribe para buscar el producto"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          // Enter elige el primero (no envia el formulario)
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (visibles[0]) elegir(claveProducto(visibles[0].categoria, visibles[0].item.id));
          }}
        />
      </div>
      <PestanasCategoria valor={categoria} onCambiar={setCategoria} encontrados={encontrados} />
      <div className="lote-productos lote-productos-elegir">
        {nuevo && !texto.trim() && (categoria === 'Todos' || categoria === nuevo.categoria) && (
          <button type="button" className="lote-producto" onClick={() => elegir('nuevo')}>
            <span className={`tarjeta-codigo ${colorCategoria(nuevo.categoria)}`}>+</span>
            <span><b>{nuevo.item.nombre}</b><small>{presentacion(nuevo.item)} · producto nuevo</small></span>
            <span className="opcion-flecha">›</span>
          </button>
        )}
        {!texto.trim() && posibles.length > 0 && <p className="lote-elegir-nota">Puede ser:</p>}
        {visibles.map(({ item, categoria }) => {
          const k = claveProducto(categoria, item.id);
          return (
            <button key={k} type="button" className={`lote-producto ${k === clave ? 'activo' : ''}`} data-producto={item.nombre} onClick={() => elegir(k)}>
              <span className={`tarjeta-codigo ${colorCategoria(categoria)}`}>{item.codigo}</span>
              <span>
                <b>{item.nombre}</b>
                <small>{presentacion(item)} · {nombreCategoria(categoria)} · {esSalida ? `se pueden usar ${disponible(item)}` : `${item.cantidad} ${item.unidad} en stock`}</small>
              </span>
              <span className="opcion-flecha">›</span>
            </button>
          );
        })}
        {encontrados.length === 0 && <p className="lote-vacio">No hay productos con ese nombre.</p>}
        {encontrados.length > 0 && enPestana.length === 0 && <p className="lote-vacio">No hay en {nombresPestana[categoria]}: mira en las otras pestañas.</p>}
        {enPestana.length > visibles.length && <p className="lote-elegir-nota">Y {enPestana.length - visibles.length} más: escribe más letras para encontrarlo.</p>}
        {!texto.trim() && posibles.length > 0 && <p className="lote-elegir-nota">¿No es ninguno? Escribe para buscar entre todos.</p>}
      </div>
    </>
  );
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
  const merch = Boolean(elegido && esMerch(elegido.categoria));
  const [cantidad, setCantidad] = useState(x?.cantidad != null ? String(x.cantidad) : '');

  // al cambiar de producto, corrige los decimales de lo escrito
  useEffect(() => {
    const campo = f.formulario.current?.elements.cantidad;
    if (campo) filtrarNumero(campo, decimales);
  }, [decimales, f.formulario]);

  if (!x) return null;
  // cada fila con su tipo (la lista puede tener ingresos y salidas)
  const esIngreso = esIngresoItem(x);
  const actividades = opcionesActividad();

  const dudas = x.dudas.map(c => productoPorClave(c)?.item.nombre).filter(Boolean);

  // presentacion dicha que no esta registrada ("bolsas de 10 L")
  const otra = x.avisos.presentacion;
  const dicho = productoDeItem(x);
  // el nombre sin su presentacion del final: "Leche Evaporada Gloria lata 400 g" -> "Leche Evaporada Gloria"
  const nombreBase = dicho ? baseDe(dicho.item.nombre, dicho.item) : x.nombreDicho;
  const crearProducto = () => abrirProducto(elegido?.categoria ?? x.categoria ?? x.categoriaDicha ?? 'Alimentos', {
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
        <CabeceraLote tipo={tipoDeItem(x)} titulo={elegido ? elegido.item.nombre : 'Editar producto'} subtitulo={subtitulo} />

        <div className="modal-cuerpo">
          {x.dicho && <p className="lote-origen">Se dijo: <b>"{x.dicho}"</b></p>}
          {x.origen === 'codigo' && <p className="lote-origen">Código escaneado: <b>{x.codigoBarras}</b></p>}

          <div className="campo">
            <label htmlFor="producto">PRODUCTO</label>
            <ElegirProducto clave={clave} onElegir={setClave} x={x} esSalida={!esIngreso} />
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
              <CampoNumero id="cantidad" decimales={decimales} placeholder="Ej. 10" defaultValue={x.cantidad ?? ''} autoFocus={Boolean(elegido)} onAviso={f.setError} onInput={e => setCantidad(e.target.value)} />
              {elegido && !esIngreso && <small>Se pueden usar {disponible(elegido.item)}</small>}
            </div>
            {esIngreso && !merch && <CampoVencimiento inicial={x.vence} />}
            {esIngreso && merch && <CampoVenceMerch key={clave} item={elegido.item} inicial={x.vence} />}
          </div>

          {merch && esIngreso && <CamposIngresoMerch key={clave} item={elegido.item} inicial={merchInicial(x)} onAviso={f.setError} />}
          {merch && !esIngreso && <CamposSalidaMerch key={clave} item={elegido.item} cantidad={cantidad} inicial={merchInicial(x)} onAviso={f.setError} />}
          {esIngreso && !merch && (
            <>
              <CampoDonador donadores={estado.donadores} actividades={actividades} inicial={donadorInicial(x, actividades)} />
            </>
          )}
          {!esIngreso && elegido?.categoria === 'Salud' && <CampoPara ninos={opcionesNinos()} inicial={x.para} />}
          <CampoObservaciones ejemplo="Ej. una lata llegó abollada" inicial={x.observaciones} />

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar="Guardar" />
      </form>
    </Fondo>
  );
}
