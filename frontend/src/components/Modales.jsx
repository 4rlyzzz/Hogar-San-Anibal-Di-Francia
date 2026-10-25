// ventanas con formulario: ingreso o salida, producto nuevo, ajuste, unir, baja, donador y usuario
import { useEffect, useState } from 'react';
import { usuario } from '../data/datos.js';
import { largos, decimalesDe, cantidadDe } from '../validacion.js';
import { IconoAlimentos, IconoSalud, IconoDonadores, IconoUsuarios } from '../assets/iconos.jsx';
import { estado } from '../estado.js';
import {
  cerrarModal, abrirModal, abrirProducto, abrirUsuario, abrirMovimiento, esAdmin, opcionesActividad, opcionesNinos, productosParecidos,
  revisarMovimiento, confirmarMovimiento, guardarProducto, revisarAjuste, confirmarAjuste, guardarUnion, confirmarBaja,
  guardarDonador, guardarUsuario, roles, envasesAlimentos, envasesSalud, medidasSuelto, medidasAlimentos, medidasSalud,
} from '../acciones.js';
import {
  nombreCategoria, colorVencimiento, motivosAjuste, motivoCorreccion, stockAntes, textoPresentacion, envaseSingular, redondear, fechaActual,
} from '../logica/comunes.js';
import { cantidadVencida, disponible, lotesVencidos, fechaLote, fechaVence } from '../logica/lotes.js';
import { useFormulario, CampoNumero, Fondo, Cabecera, Botones, MensajeError, sobreProducto, CampoVencimiento, CampoDonador, CampoPara, filtrarNumero } from './Formulario.jsx';
import { MovimientosEntre } from './Comunes.jsx';
import { LotesSalida } from './Lotes.jsx';

// cuanto se puede sacar
function textoDisponible(item) {
  const vencida = cantidadVencida(item);
  if (!vencida) return `En stock: ${item.cantidad} ${item.unidad} · sale primero lo que vence antes`;
  return `Se pueden usar ${disponible(item)} ${item.unidad} · ${vencida} vencidos no cuentan`;
}

// AHORA -> QUEDARA en grande
function Cambio({ antes, despues, signo, cantidad, clase, unidad, etiquetas = ['AHORA', 'QUEDARÁ'] }) {
  return (
    <div className="mov-cambio">
      <div>
        <span>{etiquetas[0]}</span>
        <b>{antes}</b>
        <small>{unidad}</small>
      </div>
      <div className={`mov-flecha ${clase}`}>
        <span>→</span>
        <em>{signo}{cantidad}</em>
      </div>
      <div>
        <span>{etiquetas[1]}</span>
        <b>{despues}</b>
        <small>{unidad}</small>
      </div>
    </div>
  );
}

function Datos({ filas }) {
  return (
    <dl className="mov-datos">
      {filas.map(([etiqueta, valor]) => <div key={etiqueta}><dt>{etiqueta}</dt><dd>{valor}</dd></div>)}
    </dl>
  );
}

// ---------- ingreso o salida ----------
export function ModalMovimiento({ modal }) {
  const { item, categoria, movimiento: tipo } = modal;
  const esIngreso = tipo === 'Ingreso';
  const esSalud = categoria === 'Salud';
  const decimales = decimalesDe(item.unidad);
  const f = useFormulario();
  // resumen del paso 2 (null mientras se llena el formulario)
  const [datos, setDatos] = useState(null);

  function revisar(e) {
    let resumen;
    if (f.enviar(e, v => (resumen = revisarMovimiento(modal, v)))) setDatos(resumen);
  }

  return (
    <Fondo>
      {/* al revisar, el formulario se esconde sin perder lo escrito */}
      <form className="modal" id="form-movimiento" ref={f.formulario} hidden={Boolean(datos)} noValidate onSubmit={revisar}>
        <Cabecera codigo={item.codigo} color={colorVencimiento(item)} titulo={item.nombre} subtitulo={sobreProducto(item)} />

        <div className="modal-cuerpo">
          <div className="campo">
            <label>TIPO DE MOVIMIENTO</label>
            <div className={`tipo-movimiento ${esIngreso ? 'tipo-ingreso' : ''}`}>{esIngreso ? 'Ingreso / donación' : 'Salida / consumo'}</div>
          </div>

          {esIngreso ? (
            <div className="dos-columnas">
              <div className="campo">
                <label htmlFor="cantidad">CANTIDAD</label>
                <CampoNumero id="cantidad" decimales={decimales} placeholder="0" autoFocus onAviso={f.setError} />
                <small>En stock: {item.cantidad} {item.unidad}</small>
              </div>
              <CampoVencimiento />
            </div>
          ) : (
            <div className="campo">
              <label htmlFor="cantidad">CANTIDAD</label>
              <CampoNumero id="cantidad" decimales={decimales} placeholder="0" autoFocus onAviso={f.setError} />
              <small>{textoDisponible(item)}</small>
            </div>
          )}

          {esIngreso && <CampoDonador donadores={estado.donadores} actividades={opcionesActividad()} />}
          {esSalud && !esIngreso && <CampoPara ninos={opcionesNinos()} />}

          <div className="dos-columnas">
            <div className="campo">
              <label>RESPONSABLE</label>
              <div className="input-fijo">{usuario.nombre}</div>
            </div>
            <div className="campo">
              <label>FECHA Y HORA</label>
              <div className="input-fijo">{fechaActual()}</div>
            </div>
          </div>

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar={esIngreso ? 'Revisar ingreso' : 'Revisar salida'} />
      </form>

      {datos && <ConfirmarMovimiento modal={modal} datos={datos} onVolver={() => setDatos(null)} />}
    </Fondo>
  );
}

// paso 2 de un ingreso o salida
function ConfirmarMovimiento({ modal, datos, onVolver }) {
  const { item, movimiento: tipo } = modal;
  const esIngreso = tipo === 'Ingreso';
  const despues = redondear(item.cantidad + (esIngreso ? datos.cantidad : -datos.cantidad));
  const quedaBajo = !esIngreso && despues < item.minimo;

  const filas = [
    ['Vence', esIngreso ? (datos.vence ? fechaVence(datos.vence) : 'No tiene fecha') : ''],
    ['Donado por', datos.donador.nombre ? datos.donador.nombre + (datos.donador.nuevo ? ' (nuevo donador)' : '') : (esIngreso ? 'Compra del hogar' : '')],
    ['Actividad', datos.actividad],
    ['Para', datos.para || (!esIngreso && datos.esSalud ? 'Uso general' : '')],
    ['Responsable', usuario.nombre],
    ['Fecha y hora', fechaActual()],
  ].filter(([, valor]) => valor);

  return (
    <form className="modal" id="form-movimiento-confirmar" noValidate onSubmit={e => { e.preventDefault(); confirmarMovimiento(modal, datos); }}>
      <Cabecera codigo={item.codigo} color={colorVencimiento(item)} titulo={item.nombre} subtitulo={sobreProducto(item, esIngreso ? 'Revisa el ingreso' : 'Revisa la salida')} />

      <div className="modal-cuerpo">
        <Cambio antes={item.cantidad} despues={despues} signo={esIngreso ? '+' : '−'} cantidad={datos.cantidad} clase={esIngreso ? 'ingreso' : 'salida'} unidad={item.unidad} />

        <p className={`ajuste-diferencia ${esIngreso ? 'sobra' : 'falta'}`}>
          {esIngreso ? 'Entran' : 'Salen'} {datos.cantidad} {item.unidad}
        </p>

        {quedaBajo && <p className="aviso-grande">Quedará bajo el stock mínimo ({item.minimo} {item.unidad}).</p>}

        {!esIngreso && <LotesSalida plan={datos.plan} unidad={item.unidad} />}

        <Datos filas={filas} />
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-blanco" data-accion="volver-movimiento" onClick={onVolver}>Volver y corregir</button>
        <button type="submit" className="btn btn-verde">Confirmar {esIngreso ? 'ingreso' : 'salida'}</button>
      </div>
    </form>
  );
}

// ---------- producto nuevo ----------
export function ModalProducto({ modal }) {
  const { categoria } = modal;
  const esSalud = categoria === 'Salud';
  const f = useFormulario();
  const [parecidos, setParecidos] = useState([]);
  // lo que hace falta para mostrar u ocultar campos y la vista previa
  const [envase, setEnvase] = useState('');
  const [medida, setMedida] = useState(esSalud ? medidasSalud[0] : medidasAlimentos[0]);
  const [envaseOtro, setEnvaseOtro] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [contenido, setContenido] = useState('');

  const suelto = envase.startsWith('suelto:');
  // decimales segun lo elegido
  const decimalesCantidad = suelto ? decimalesDe(envase.slice(7)) : envase ? 0 : 2;
  const decimalesContenido = medida === 'unidades' ? 0 : 2;

  // al cambiar los decimales, corrige lo que ya estaba escrito
  useEffect(() => {
    const campos = f.formulario.current.elements;
    for (const campo of [campos.cantidad, campos.minimo]) filtrarNumero(campo, decimalesCantidad);
    filtrarNumero(campos['contenido-envase'], decimalesContenido);
    setCantidad(campos.cantidad.value);
    setContenido(campos['contenido-envase'].value);
  }, [decimalesCantidad, decimalesContenido, f.formulario]);

  useEffect(() => {
    if (envase === 'otro') f.formulario.current.elements['envase-otro'].focus();
  }, [envase, f.formulario]);

  // vista previa: "Caja x 10 tabletas · 100 tabletas en total"
  const numero = texto => {
    const r = cantidadDe('kg')(texto);
    return r.ok ? r.valor : 0;
  };
  let previa = '';
  const nombreEnvase = envase === 'otro' ? envaseOtro : envase && envaseSingular(envase);
  if (suelto) {
    previa = `Suelto, se cuenta en ${envase.slice(7)}`;
  } else if (envase && nombreEnvase && numero(contenido)) {
    const total = numero(cantidad) ? ` · ${redondear(numero(cantidad) * numero(contenido))} ${medida} en total` : '';
    previa = `${nombreEnvase} x ${numero(contenido)} ${medida}${total}`;
  }

  return (
    <Fondo>
      <form className="modal" id="form-producto" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => guardarProducto(modal, v))}>
        <Cabecera codigo="+" color={esSalud ? 'azul' : 'verde'} titulo="Agregar producto" subtitulo={nombreCategoria(categoria)} />

        <div className="modal-cuerpo">
          <div className="campo">
            <label>CATEGORÍA</label>
            <div className="filtros selector-categoria">
              {['Alimentos', 'Salud'].map(c => (
                <button key={c} type="button" className={c === categoria ? 'activo' : ''} data-accion="agregar-producto" onClick={() => abrirProducto(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className="campo">
            <label>NOMBRE</label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              maxLength={largos.nombreProducto}
              autoComplete="off"
              autoFocus
              placeholder={esSalud ? 'Ej. Ibuprofeno 400 mg' : 'Ej. Fideos Don Vittorio'}
              onInput={e => setParecidos(productosParecidos(e.target.value))}
            />
            <div id="coincidencias"><Coincidencias parecidos={parecidos} /></div>
          </div>

          {/* "10 cajas de 10 tabletas" o "25 kg" */}
          <div className="campo">
            <label htmlFor="cantidad">CANTIDAD QUE ENTRA</label>
            <div className={`fila-presentacion ${!envase || suelto ? 'sin-envase' : ''}`} id="fila-presentacion">
              <CampoNumero id="cantidad" decimales={decimalesCantidad} placeholder="0" aria-label="Cantidad" onAviso={f.setError} onInput={e => setCantidad(e.target.value)} />
              <select id="envase" name="envase" aria-label="En qué viene" value={envase} onChange={e => setEnvase(e.target.value)}>
                <option value="">en qué viene…</option>
                <optgroup label="Envase">
                  {(esSalud ? envasesSalud : envasesAlimentos).map(e => <option key={e} value={e}>{e}</option>)}
                  <option value="otro">+ otro envase…</option>
                </optgroup>
                <optgroup label="Suelto (a granel)">
                  {medidasSuelto.map(m => <option key={m} value={`suelto:${m}`}>{m}</option>)}
                </optgroup>
              </select>
              <span className="fila-presentacion-de">de</span>
              <CampoNumero id="contenido-envase" decimales={decimalesContenido} placeholder={esSalud ? '10' : '1'} aria-label="Cuánto trae cada uno" onAviso={f.setError} onInput={e => setContenido(e.target.value)} />
              <select id="medida" name="medida" aria-label="Medida" value={medida} onChange={e => setMedida(e.target.value)}>
                {(esSalud ? medidasSalud : medidasAlimentos).map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <input
              id="envase-otro"
              name="envase-otro"
              type="text"
              maxLength={largos.envaseOtro}
              placeholder="¿Cómo se llama el envase? Ej. Bidón"
              hidden={envase !== 'otro'}
              onInput={e => setEnvaseOtro(e.target.value.trim())}
            />
            <small>{esSalud ? 'Ej. 5 blísters de 10 unidades · 3 frascos de 60 ml · 4 paquetes de 40 unidades' : 'Ej. 12 bolsas de 1 kg · 24 latas de 400 g · 25 kg sueltos'}</small>
          </div>

          <p className="presentacion-previa" id="presentacion-previa" hidden={!previa}>{previa}</p>

          <div className="dos-columnas">
            <div className="campo">
              <label>STOCK MÍNIMO</label>
              <CampoNumero id="minimo" decimales={decimalesCantidad} placeholder="0" onAviso={f.setError} />
            </div>
            <CampoVencimiento />
          </div>

          <CampoDonador donadores={estado.donadores} actividades={opcionesActividad()} />

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar="Agregar producto" />
      </form>
    </Fondo>
  );
}

// productos parecidos al que se agrega; tocar uno abre su ingreso (no se crea repetido)
function Coincidencias({ parecidos }) {
  if (parecidos.length === 0) return null;
  return (
    <div className="coincidencias">
      <span>Ya existe algo parecido. ¿Es alguno de estos?</span>
      {parecidos.map(({ item, categoria }) => (
        <button key={item.id} type="button" className="coincidencia" data-accion="registrar" onClick={() => abrirMovimiento(categoria, item.id, 'Ingreso')}>
          <span>
            <b>{item.nombre}</b>
            <small>{nombreCategoria(categoria)} · {item.cantidad} {item.unidad}{textoPresentacion(item) ? ' · ' + textoPresentacion(item) : ''}</small>
          </span>
          <em>Registrar ingreso →</em>
        </button>
      ))}
    </div>
  );
}

// ---------- ajuste de stock ----------
// datos del ajuste que se corrige
function BloqueCorreccion({ correccion, item }) {
  const { fila, entre } = correccion;
  return (
    <div className="correccion">
      <b>Estás corrigiendo el conteo del {fila.fecha}</b>
      <p>Ese día el sistema decía <b>{stockAntes(fila)} {item.unidad}</b> y {fila.responsable} contó <b>{fila.saldo} {item.unidad}</b>.</p>
      <span className="correccion-sub">Después de ese conteo hubo</span>
      <MovimientosEntre pasos={entre} unidad={item.unidad} />
      <p>Por eso hoy el sistema dice <b>{item.cantidad} {item.unidad}</b>.</p>
      <p className="correccion-nota">Vuelve a contar lo que hay hoy y escríbelo abajo.</p>
    </div>
  );
}

// muestra si sobra o falta mientras se escribe
function Diferencia({ item, contado }) {
  if (contado === '') return <p className="ajuste-diferencia" id="ajuste-diferencia">Escribe cuánto hay realmente en el almacén</p>;
  const resultado = cantidadDe(item.unidad, { que: 'la cantidad contada', puedeSerCero: true })(contado);
  if (!resultado.ok) return <p className="ajuste-diferencia" id="ajuste-diferencia">{resultado.error}</p>;

  const diferencia = redondear(resultado.valor - item.cantidad);
  if (diferencia === 0) return <p className="ajuste-diferencia" id="ajuste-diferencia">Coincide con el sistema: no hay nada que ajustar</p>;
  return (
    <p className={`ajuste-diferencia ${diferencia > 0 ? 'sobra' : 'falta'}`} id="ajuste-diferencia">
      {diferencia > 0 ? 'Sobran' : 'Faltan'} {Math.abs(diferencia)} {item.unidad} · el stock quedará en {resultado.valor} {item.unidad}
    </p>
  );
}

export function ModalAjuste({ modal }) {
  const { item, correccion } = modal;
  const f = useFormulario();
  const [contado, setContado] = useState('');
  const [motivo, setMotivo] = useState(motivosAjuste[0]);
  // resumen del paso 2
  const [ajuste, setAjuste] = useState(null);

  function revisar(e) {
    let resumen;
    if (f.enviar(e, v => (resumen = revisarAjuste(modal, v)))) setAjuste(resumen);
  }

  return (
    <Fondo>
      <form className="modal" id="form-ajuste" ref={f.formulario} hidden={Boolean(ajuste)} noValidate onSubmit={revisar}>
        <Cabecera codigo={item.codigo} color={colorVencimiento(item)} titulo={item.nombre} subtitulo={sobreProducto(item, 'Ajustar stock')} />

        <div className="modal-cuerpo">
          {correccion && <BloqueCorreccion correccion={correccion} item={item} />}

          <div className="dos-columnas">
            <div className="campo">
              <label>SEGÚN SISTEMA</label>
              <div className="input-fijo">{item.cantidad} {item.unidad}</div>
            </div>
            <div className="campo">
              <label htmlFor="contado">CANTIDAD CONTADA</label>
              <CampoNumero id="contado" decimales={decimalesDe(item.unidad)} placeholder="0" autoFocus onAviso={f.setError} onInput={e => setContado(e.target.value.trim())} />
            </div>
          </div>

          <Diferencia item={item} contado={contado} />

          {correccion ? (
            <>
              <div className="campo">
                <label>MOTIVO</label>
                <div className="input-fijo">{motivoCorreccion}</div>
              </div>
              <div className="campo">
                <label htmlFor="nota">¿QUÉ PASÓ EN EL CONTEO ANTERIOR? (OPCIONAL)</label>
                <input id="nota" name="nota" type="text" maxLength={largos.nota} placeholder="Ej. se contó una caja dos veces" />
              </div>
            </>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="motivo">¿POR QUÉ NO COINCIDÍA?</label>
                <select id="motivo" name="motivo" value={motivo} onChange={e => setMotivo(e.target.value)}>
                  {motivosAjuste.map(m => <option key={m}>{m}</option>)}
                </select>
                <small>Si no sabes la causa, deja "Sin identificar"</small>
              </div>
              <div className="campo">
                <label htmlFor="nota">DETALLE {motivo === 'Otro' ? '' : '(OPCIONAL)'}</label>
                <input id="nota" name="nota" type="text" maxLength={largos.nota} placeholder="Ej. 3 latas abolladas" />
              </div>
            </>
          )}

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar="Revisar ajuste" />
      </form>

      {ajuste && <ConfirmarAjuste modal={modal} ajuste={ajuste} onVolver={() => setAjuste(null)} />}
    </Fondo>
  );
}

// paso 2: resumen para confirmar
// grande: diferencia de mas del 25%
function ConfirmarAjuste({ modal, ajuste, onVolver }) {
  const { item, correccion } = modal;
  const grande = Math.abs(ajuste.diferencia) > item.cantidad * 0.25;

  return (
    <form className="modal" id="form-ajuste-confirmar" noValidate onSubmit={e => { e.preventDefault(); confirmarAjuste(modal, ajuste); }}>
      <Cabecera codigo={item.codigo} color={colorVencimiento(item)} titulo={item.nombre} subtitulo={sobreProducto(item, 'Revisa el ajuste')} />

      <div className="modal-cuerpo">
        <Cambio
          antes={item.cantidad}
          despues={ajuste.contado}
          signo={ajuste.diferencia > 0 ? '+' : '−'}
          cantidad={Math.abs(ajuste.diferencia)}
          clase="ajuste"
          unidad={item.unidad}
          etiquetas={['SISTEMA', 'CONTADO']}
        />

        {correccion && <BloqueCorreccion correccion={correccion} item={item} />}

        <p className={`ajuste-diferencia ${ajuste.diferencia > 0 ? 'sobra' : 'falta'}`}>
          {ajuste.diferencia > 0 ? 'Sobran' : 'Faltan'} {Math.abs(ajuste.diferencia)} {item.unidad}
        </p>

        {grande && <p className="aviso-grande">Es una diferencia grande. Si puedes, vuelve a contar antes de confirmar.</p>}

        <Datos filas={[
          ['Motivo', ajuste.motivo],
          ...(ajuste.nota ? [['Detalle', ajuste.nota]] : []),
          ['Responsable', usuario.nombre],
          ['Fecha y hora', fechaActual()],
        ]} />

        <p className="ajuste-nota">
          Los ajustes no se borran ni se editan. Si te equivocas, abre este ajuste en el historial
          y usa "Corregir este ajuste".
        </p>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-blanco" data-accion="volver-ajuste" onClick={onVolver}>Volver y corregir</button>
        <button type="submit" className="btn btn-verde">Confirmar ajuste</button>
      </div>
    </form>
  );
}

// ---------- unir un producto repetido (solo administrador) ----------
// opciones: productos con la misma unidad
export function ModalUnir({ modal }) {
  const { item, categoria, opciones } = modal;
  const f = useFormulario();
  const [elegido, setElegido] = useState('');
  const destino = opciones.find(o => String(o.id) === elegido);

  return (
    <Fondo>
      <form className="modal" id="form-unir" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => guardarUnion(modal, v))}>
        <Cabecera codigo={item.codigo} color={colorVencimiento(item)} titulo={item.nombre} subtitulo={sobreProducto(item, 'Unir productos')} />

        <div className="modal-cuerpo">
          <p className="ajuste-nota">
            Úsalo cuando el mismo producto se registró dos veces. "{item.nombre}" dejará de aparecer
            y sus {item.cantidad} {item.unidad} se sumarán al producto que elijas. Su historial no se borra.
          </p>

          {opciones.length ? (
            <>
              <div className="campo">
                <label htmlFor="unir-con">SE UNE CON</label>
                <select id="unir-con" name="unir-con" onChange={e => setElegido(e.target.value)}>
                  <option value="">Elige el producto que se queda</option>
                  {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre} · {o.cantidad} {o.unidad}</option>)}
                </select>
              </div>
              <p className={`ajuste-diferencia ${destino ? 'sobra' : ''}`} id="unir-resumen">
                {destino
                  ? `"${destino.nombre}" quedará con ${destino.cantidad} + ${item.cantidad} = ${redondear(destino.cantidad + item.cantidad)} ${item.unidad}`
                  : 'Elige el producto que se queda'}
              </p>
            </>
          ) : (
            <p className="ajuste-diferencia">No hay otro producto en {nombreCategoria(categoria)} que se cuente en {item.unidad}.</p>
          )}

          <MensajeError texto={f.error} />
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-blanco" data-accion="cerrar-modal" onClick={cerrarModal}>Cancelar</button>
          <button type="submit" className="btn btn-verde" disabled={!opciones.length}>Unir productos</button>
        </div>
      </form>
    </Fondo>
  );
}

// ---------- dar de baja lo vencido ----------
export function ModalBaja({ modal }) {
  const { item } = modal;
  const f = useFormulario();
  const vencida = cantidadVencida(item);

  return (
    <Fondo>
      <form className="modal" id="form-baja" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => confirmarBaja(modal, v))}>
        <Cabecera codigo={item.codigo} color="rojo" titulo={item.nombre} subtitulo={sobreProducto(item, 'Dar de baja lo vencido')} />

        <div className="modal-cuerpo">
          <Cambio antes={item.cantidad} despues={redondear(item.cantidad - vencida)} signo="−" cantidad={vencida} clase="salida" unidad={item.unidad} />

          <Datos filas={[
            ...lotesVencidos(item).map(l => [`Lote del ${fechaLote(l.ingreso)}`, `${l.quedan} ${item.unidad} · venció ${fechaVence(l.vence)}`]),
            ['Motivo', 'Baja por vencimiento'],
            ['Responsable', usuario.nombre],
            ['Fecha y hora', fechaActual()],
          ]} />

          <div className="campo">
            <label htmlFor="nota">DETALLE (OPCIONAL)</label>
            <input id="nota" name="nota" type="text" maxLength={largos.nota} placeholder="Ej. se botó, olía mal" />
          </div>

          <MensajeError texto={f.error} />

          <p className="ajuste-nota">Confirma solo cuando ya lo hayas sacado del almacén.</p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-blanco" data-accion="cerrar-modal" onClick={cerrarModal}>Cancelar</button>
          <button type="submit" className="btn btn-rojo">Dar de baja {vencida} {item.unidad}</button>
        </div>
      </form>
    </Fondo>
  );
}

// ---------- "+" en Inicio e Historial: que agregar ----------
export function ModalElegir() {
  const opciones = [
    { accion: 'agregar-producto', color: 'verde', Icono: IconoAlimentos, titulo: 'Alimento', detalle: 'Producto perecible', abrir: () => abrirProducto('Alimentos') },
    { accion: 'agregar-producto', color: 'azul', Icono: IconoSalud, titulo: 'Salud e higiene', detalle: 'Medicinas, pañales, aseo', abrir: () => abrirProducto('Salud') },
    { accion: 'agregar-donador', color: 'naranja', Icono: IconoDonadores, titulo: 'Donador', detalle: 'Persona o institución', abrir: () => abrirModal({ tipo: 'donador' }) },
  ];
  if (esAdmin()) {
    opciones.push({ accion: 'agregar-usuario', color: 'gris', Icono: IconoUsuarios, titulo: 'Usuario', detalle: 'Cuenta para entrar al inventario', abrir: abrirUsuario });
  }

  return (
    <Fondo>
      <div className="modal">
        <Cabecera codigo="+" color="verde" titulo="¿Qué quieres agregar?" subtitulo="Elige una opción" />
        <div className="modal-cuerpo">
          {opciones.map(o => (
            <button key={o.titulo} type="button" className="opcion-agregar" data-accion={o.accion} onClick={o.abrir}>
              <span className={`tarjeta-codigo ${o.color}`}><o.Icono /></span>
              <span>
                <b>{o.titulo}</b>
                <small>{o.detalle}</small>
              </span>
              <span className="opcion-flecha">›</span>
            </button>
          ))}
        </div>
      </div>
    </Fondo>
  );
}

// ---------- donador nuevo ----------
export function ModalDonador() {
  const f = useFormulario();
  return (
    <Fondo>
      <form className="modal" id="form-donador" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, guardarDonador)}>
        <Cabecera codigo="+" color="naranja" titulo="Agregar donador" subtitulo="Persona o institución que dona al hogar" />
        <div className="modal-cuerpo">
          <div className="campo">
            <label>NOMBRE</label>
            <input id="nuevo-nombre" name="nuevo-nombre" type="text" maxLength={largos.nombreDonador} placeholder="Nombre o institución" autoFocus />
          </div>
          <div className="campo">
            <label>NÚMERO DE CONTACTO</label>
            <input id="nuevo-telefono" name="nuevo-telefono" type="tel" maxLength={largos.telefono} inputMode="tel" placeholder="987 654 321" />
          </div>
          <MensajeError texto={f.error} />
        </div>
        <Botones textoGuardar="Agregar donador" />
      </form>
    </Fondo>
  );
}

// ---------- usuario nuevo (solo administrador) ----------
export function ModalUsuario() {
  const f = useFormulario();
  return (
    <Fondo>
      <form className="modal" id="form-usuario" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, guardarUsuario)}>
        <Cabecera codigo="+" color="azul" titulo="Agregar usuario" subtitulo="Cuenta para entrar al inventario" />

        <div className="modal-cuerpo">
          <div className="campo">
            <label>NOMBRE</label>
            <input id="cuenta-nombre" name="cuenta-nombre" type="text" maxLength={largos.nombreCuenta} placeholder="Ej. Cocina, María López" autoFocus />
            <small>Así aparecerá como responsable en el historial</small>
          </div>

          <div className="dos-columnas">
            <div className="campo">
              <label>USUARIO</label>
              <input id="cuenta-usuario" name="cuenta-usuario" type="text" maxLength={largos.nombreUsuario} autoCapitalize="none" autoComplete="off" placeholder="Ej. cocina" />
            </div>
            <div className="campo">
              <label>CONTRASEÑA</label>
              <input id="cuenta-clave" name="cuenta-clave" type="password" maxLength={largos.clave} autoComplete="new-password" placeholder="Mínimo 8, con letras y números" />
            </div>
          </div>

          <div className="campo">
            <label>ROL</label>
            <select id="cuenta-rol" name="cuenta-rol">
              <option value={roles[0]}>Usuario · registra ingresos y salidas</option>
              <option value={roles[1]}>Administrador · además gestiona usuarios</option>
            </select>
          </div>

          <MensajeError texto={f.error} />
        </div>

        <Botones textoGuardar="Agregar usuario" />
      </form>
    </Fondo>
  );
}

