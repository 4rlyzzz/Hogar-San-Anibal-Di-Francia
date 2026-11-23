import { useEffect, useRef, useState } from 'react';
import { estado } from '../estado.js';
import { largos, decimalesDe } from '../validacion.js';
import { IconoProveedores, IconoCompradores } from '../assets/iconos.jsx';
import { guardarEdicionMerch, guardarPersona } from '../acciones.js';
import {
  tiposMerch, ordenTipos, unidadesVenta, articulosDe, tallas, comprobantes, mediosPago, nombreMerch, precioSugerido, soles,
  pideVence, puedeVence, llevaLote, llevaProveedor, pideProveedor, llevaCosto, totalVenta, mayuscula, textoTipo,
} from '../logica/merch.js';
import { personas } from '../logica/personas.js';
import { formatoNombre } from '../logica/comunes.js';
import { useFormulario, CampoNumero, Fondo, Cabecera, Botones, MensajeError, CampoVencimiento } from './Formulario.jsx';
import { Desplegable } from './Desplegable.jsx';

const numeroDe = texto => {
  const n = Number(String(texto ?? '').trim().replace(',', '.'));
  return String(texto ?? '').trim() && Number.isFinite(n) ? n : null;
};

export function CampoPersona({ tipo, obligatorio = false, inicial = {} }) {
  const p = personas[tipo];
  const [elegido, setElegido] = useState(inicial.valor ?? '');
  const lista = estado[p.lista];
  const sin = tipo === 'proveedor' ? (obligatorio ? 'Elige el proveedor' : 'Sin proveedor') : 'Sin comprador registrado';
  const opciones = [['', sin], ...lista.map(d => [String(d.id), d.nombre]), ['nuevo', `+ Nuevo ${p.singular}`]];

  return (
    <>
      <div className="campo">
        <label htmlFor={tipo}>{p.singular.toUpperCase()}{obligatorio ? '' : ' (OPCIONAL)'}</label>
        <Desplegable id={tipo} name={tipo} opciones={opciones} valor={elegido} onChange={setElegido} />
      </div>
      <div className="dos-columnas" hidden={elegido !== 'nuevo'}>
        <div className="campo">
          <label htmlFor={`${tipo}-nombre`}>NOMBRE DEL {p.singular.toUpperCase()}</label>
          <input id={`${tipo}-nombre`} name={`${tipo}-nombre`} type="text" maxLength={largos.nombreDonador} placeholder={tipo === 'proveedor' ? 'Ej. Textiles Sur' : 'Ej. Rosa Quispe'} defaultValue={inicial.nombre} />
        </div>
        <div className="campo">
          <label htmlFor={`${tipo}-telefono`}>NÚMERO DE CONTACTO{p.telefonoObligatorio ? '' : ' (OPCIONAL)'}</label>
          <input id={`${tipo}-telefono`} name={`${tipo}-telefono`} type="tel" maxLength={largos.telefono} inputMode="tel" placeholder="Ej. 987 654 321" defaultValue={inicial.telefono} />
        </div>
      </div>
    </>
  );
}

function CampoComprobante({ inicial = {} }) {
  const [tipo, setTipo] = useState(inicial.comprobanteTipo ?? '');
  return (
    <div className="dos-columnas">
      <div className="campo">
        <label htmlFor="comprobante-tipo">COMPROBANTE (OPCIONAL)</label>
        <Desplegable id="comprobante-tipo" name="comprobante-tipo" valor={tipo} onChange={setTipo} opciones={[['', 'Sin comprobante'], ...comprobantes]} />
      </div>
      <div className="campo">
        <label htmlFor="comprobante-numero">N° DE COMPROBANTE (OPCIONAL)</label>
        <input id="comprobante-numero" name="comprobante-numero" type="text" autoComplete="off" maxLength={largos.comprobante} placeholder="Ej. B001-000123" defaultValue={inicial.comprobanteNumero} />
      </div>
    </div>
  );
}

export function CampoVenceMerch({ item, inicial }) {
  if (pideVence(item)) {
    return (
      <div className="campo">
        <label htmlFor="vencimiento">VENCE</label>
        <input id="vencimiento" name="vencimiento" type="date" defaultValue={inicial || ''} />
      </div>
    );
  }
  return puedeVence(item) ? <CampoVencimiento inicial={inicial} /> : null;
}

export function CamposIngresoMerch({ item, inicial = {}, onAviso }) {
  const esHogar = item.tipoMerch === 'hogar';
  const lote = llevaLote(item) && (
    <div className="campo">
      <label htmlFor="lote-codigo">LOTE (OPCIONAL)</label>
      <input id="lote-codigo" name="lote-codigo" type="text" autoComplete="off" maxLength={largos.loteCodigo} placeholder="Ej. L2026-11" defaultValue={inicial.loteCodigo} />
    </div>
  );
  return (
    <>
      {llevaProveedor(item) && <CampoPersona tipo="proveedor" obligatorio={pideProveedor(item)} inicial={inicial.proveedor} />}

      {llevaCosto(item) ? (
        <>
          <div className="dos-columnas">
            <div className="campo">
              <label htmlFor="costo">COSTO UNITARIO (S/)</label>
              <CampoNumero id="costo" decimales={2} placeholder="Ej. 18.50" defaultValue={inicial.costo ?? ''} onAviso={onAviso} />
              <small>Lo que costó cada {item.unidad === 'unidades' ? 'unidad' : item.unidad.slice(0, -1)}</small>
            </div>
            {lote}
          </div>
          <CampoComprobante inicial={inicial} />
        </>
      ) : lote}

      {esHogar && (
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="taller">TALLER O GRUPO (OPCIONAL)</label>
            <input id="taller" name="taller" type="text" maxLength={largos.taller} placeholder="Ej. Taller de arte" defaultValue={inicial.taller} />
          </div>
          <div className="campo">
            <label htmlFor="costo-materiales">COSTO DE MATERIALES (OPCIONAL)</label>
            <CampoNumero id="costo-materiales" decimales={2} placeholder="Ej. S/ 15.00" defaultValue={inicial.costoMateriales ?? ''} onAviso={onAviso} />
          </div>
        </div>
      )}
    </>
  );
}

export function CamposSalidaMerch({ item, cantidad, inicial = {}, onAviso }) {
  const n = numeroDe(cantidad) ?? 0;
  const sugerido = precioSugerido(item, n);
  const [precio, setPrecio] = useState(inicial.precio != null ? String(inicial.precio) : String(sugerido));
  const tocado = useRef(inicial.precio != null && inicial.precio !== sugerido);
  const [medio, setMedio] = useState(inicial.medioPago ?? '');

  useEffect(() => {
    if (!tocado.current) setPrecio(String(sugerido));
  }, [sugerido]);

  const valor = numeroDe(precio);
  const conDescuento = item.descuentoDesde && item.precioDescuento != null;
  return (
    <>
      <div className="dos-columnas">
        <div className="campo">
          <label htmlFor="precio">PRECIO UNITARIO (S/)</label>
          <CampoNumero
            id="precio"
            decimales={2}
            placeholder="Ej. 25.00"
            value={precio}
            onChange={() => {}}
            onAviso={onAviso}
            onInput={e => {
              tocado.current = true;
              setPrecio(e.target.value);
            }}
          />
          <small>
            {conDescuento ? `Desde ${item.descuentoDesde}: ${soles(item.precioDescuento)} c/u · ` : ''}
            {tocado.current && valor !== sugerido
              ? <button type="button" className="link" data-accion="precio-sugerido" onClick={() => { tocado.current = false; setPrecio(String(sugerido)); }}>Volver a {soles(sugerido)}</button>
              : 'Se puede cambiar'}
          </small>
        </div>
        <div className="campo">
          <label>TOTAL</label>
          <div className="input-fijo merch-total" id="total-venta">{valor != null && n ? soles(totalVenta(valor, n)) : '—'}</div>
        </div>
      </div>

      <CampoPersona tipo="comprador" inicial={inicial.comprador} />

      <div className="campo">
        <label htmlFor="medio-pago">MEDIO DE PAGO (OPCIONAL)</label>
        <Desplegable id="medio-pago" name="medio-pago" valor={medio} onChange={setMedio} opciones={[['', 'Sin indicar'], ...mediosPago]} />
      </div>
      <CampoComprobante inicial={inicial} />
    </>
  );
}

export function CamposProductoMerch({ modal, onAviso, onNombre }) {
  const [tipo, setTipo] = useState(modal.tipoMerch ?? 'paneton');
  const subs = tiposMerch[tipo].subcategorias;
  const [sub, setSub] = useState(subs[0]?.[0] ?? null);
  const [unidad, setUnidad] = useState('unidades');
  const [articulo, setArticulo] = useState('');
  const [talla, setTalla] = useState('');
  const [perecible, setPerecible] = useState('');
  const [campos, setCampos] = useState({ nombreBase: modal.nombre ?? '', marca: '', presentacion: '', variante: '', color: '' });

  function cambiarTipo(t) {
    setTipo(t);
    setSub(tiposMerch[t].subcategorias[0]?.[0] ?? null);
    setArticulo('');
  }

  const lista = articulosDe(tipo, sub);
  const escribir = campo => e => {
    const nuevos = { ...campos, [campo]: e.target.value };
    setCampos(nuevos);
    if (campo === 'nombreBase') onNombre?.(e.target.value);
  };

  const previa = campos.nombreBase.trim() ? nombreMerch({
    tipoMerch: tipo, subcategoria: sub, nombreBase: formatoNombre(campos.nombreBase), marca: campos.marca, presentacion: campos.presentacion,
    variante: campos.variante, talla: talla || '…', color: formatoNombre(campos.color || '…'),
  }) : '';

  return (
    <>
      <div className="campo">
        <label>TIPO</label>
        <div className="filtros selector-categoria selector-merch" role="radiogroup" aria-label="Tipo de merchandising">
          {ordenTipos.map(t => (
            <button key={t} type="button" role="radio" aria-checked={t === tipo} className={t === tipo ? 'activo' : ''} data-accion="tipo-producto-merch" data-tipo={t} onClick={() => cambiarTipo(t)}>
              {tiposMerch[t].nombre}
            </button>
          ))}
        </div>
        <input type="hidden" id="tipo-merch" name="tipo-merch" value={tipo} />
        <small>{tiposMerch[tipo].detalle}</small>
      </div>

      {subs.length > 0 && (
        <div className="campo">
          <label>SUBCATEGORÍA</label>
          <div className="filtros selector-categoria">
            {subs.map(([s, texto]) => (
              <button key={s} type="button" className={s === sub ? 'activo' : ''} data-accion="subcategoria-merch" onClick={() => { setSub(s); setArticulo(''); }}>{texto}</button>
            ))}
          </div>
          <input type="hidden" id="subcategoria" name="subcategoria" value={sub ?? ''} />
        </div>
      )}

      <div className="campo">
        <label htmlFor="nombre">NOMBRE</label>
        <input id="nombre" name="nombre" type="text" maxLength={largos.nombreProducto} autoComplete="off" autoFocus defaultValue={modal.nombre}
          placeholder={{ paneton: 'Ej. Panetón Clásico', hogar: 'Ej. Rosario de madera', promocional: 'Ej. Polo del Hogar' }[tipo]} onInput={escribir('nombreBase')} />
      </div>

      {tipo === 'paneton' && (
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="marca">MARCA</label>
            <input id="marca" name="marca" type="text" maxLength={largos.marca} placeholder="Ej. D'Onofrio" onInput={escribir('marca')} />
          </div>
          <div className="campo">
            <label htmlFor="presentacion">PRESENTACIÓN</label>
            <input id="presentacion" name="presentacion" type="text" maxLength={largos.presentacionMerch} placeholder="Ej. caja 900 g" onInput={escribir('presentacion')} />
          </div>
        </div>
      )}

      {lista.length > 0 && (
        <div className="campo">
          <label htmlFor="articulo">TIPO DE ARTÍCULO</label>
          <Desplegable id="articulo" name="articulo" valor={articulo} onChange={setArticulo} opciones={[['', 'Elige…'], ...lista.map(a => [a, mayuscula(a)])]} />
        </div>
      )}

      {tipo === 'hogar' && sub === 'general' && (
        <div className="campo">
          <label htmlFor="variante">VARIANTE (OPCIONAL)</label>
          <input id="variante" name="variante" type="text" maxLength={largos.variante} placeholder="Ej. color marrón" onInput={escribir('variante')} />
          <small>Cada variante es un producto distinto</small>
        </div>
      )}

      {tipo === 'hogar' && sub === 'alimentos' && (
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="presentacion">PRESENTACIÓN</label>
            <input id="presentacion" name="presentacion" type="text" maxLength={largos.presentacionMerch} placeholder="Ej. bolsa 250 g" onInput={escribir('presentacion')} />
          </div>
          <div className="campo">
            <label htmlFor="perecible">¿ES PERECIBLE?</label>
            <Desplegable id="perecible" name="perecible" valor={perecible} onChange={setPerecible} opciones={[['', 'Elige…'], ['si', 'Sí, vence'], ['no', 'No']]} />
          </div>
        </div>
      )}

      {sub === 'prendas' && (
        <>
          <div className="dos-columnas">
            <div className="campo">
              <label htmlFor="talla">TALLA</label>
              <Desplegable id="talla" name="talla" valor={talla} onChange={setTalla} opciones={[['', 'Elige…'], ...tallas.map(t => [t, mayuscula(t)])]} />
            </div>
            <div className="campo">
              <label htmlFor="color">COLOR</label>
              <input id="color" name="color" type="text" maxLength={largos.color} placeholder="Ej. Azul" onInput={escribir('color')} />
            </div>
          </div>
          <div className="campo">
            <label htmlFor="material">MATERIAL (OPCIONAL)</label>
            <input id="material" name="material" type="text" maxLength={largos.material} placeholder="Ej. algodón" />
          </div>
          <small className="merch-nota">Cada combinación de talla y color es un producto distinto.</small>
        </>
      )}

      {tipo === 'promocional' && (
        <div className="campo">
          <label htmlFor="diseno">DISEÑO O PERSONALIZACIÓN (OPCIONAL)</label>
          <input id="diseno" name="diseno" type="text" maxLength={largos.diseno} placeholder="Ej. logo del hogar" />
        </div>
      )}

      {tipo !== 'paneton' && (
        <div className="campo">
          <label htmlFor="unidad">UNIDAD DE VENTA</label>
          <Desplegable id="unidad" name="unidad" valor={unidad} onChange={setUnidad} opciones={unidadesVenta} />
          <small>El stock se cuenta en esta unidad</small>
        </div>
      )}

      {previa && <p className="presentacion-previa" id="nombre-previo">Se guardará como "{previa}"</p>}

      <CamposPrecio esPaneton={tipo === 'paneton'} unidad={tipo === 'paneton' ? 'unidades' : unidad} onAviso={onAviso} />

      <div className="campo">
        <label htmlFor="descripcion">DESCRIPCIÓN (OPCIONAL)</label>
        <textarea id="descripcion" name="descripcion" rows={2} maxLength={largos.descripcion} placeholder="Ej. hecho por los niños" />
      </div>
    </>
  );
}

function CamposPrecio({ esPaneton, unidad, onAviso, inicial = {} }) {
  return (
    <>
      <div className="dos-columnas">
        <div className="campo">
          <label htmlFor="precio">PRECIO DE VENTA (S/)</label>
          <CampoNumero id="precio" decimales={2} placeholder="Ej. 25.00" defaultValue={inicial.precio ?? ''} onAviso={onAviso} />
          <small>Por {unidad === 'unidades' ? 'unidad' : unidad.slice(0, -1)}</small>
        </div>
        <div className="campo">
          <label htmlFor="minimo">STOCK MÍNIMO</label>
          <CampoNumero id="minimo" decimales={decimalesDe(unidad)} placeholder="Ej. 5" defaultValue={inicial.minimo ?? ''} onAviso={onAviso} />
        </div>
      </div>
      {esPaneton && (
        <div className="dos-columnas">
          <div className="campo">
            <label htmlFor="descuento-desde">DESCUENTO DESDE (OPCIONAL)</label>
            <CampoNumero id="descuento-desde" decimales={0} placeholder="Ej. 6 unidades" defaultValue={inicial.descuentoDesde ?? ''} onAviso={onAviso} />
          </div>
          <div className="campo">
            <label htmlFor="precio-descuento">PRECIO CON DESCUENTO (S/)</label>
            <CampoNumero id="precio-descuento" decimales={2} placeholder="Ej. 22.00" defaultValue={inicial.precioDescuento ?? ''} onAviso={onAviso} />
            <small>Obligatorio si pones desde cuántas</small>
          </div>
        </div>
      )}
    </>
  );
}

export function ModalEditarMerch({ modal }) {
  const { item } = modal;
  const f = useFormulario();
  return (
    <Fondo>
      <form className="modal" id="form-editar-merch" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => guardarEdicionMerch(modal, v))}>
        <Cabecera codigo={item.codigo} color="morado" titulo={item.nombre} subtitulo={`${textoTipo(item)} · Editar precio y datos`} />
        <div className="modal-cuerpo">
          <CamposPrecio esPaneton={item.tipoMerch === 'paneton'} unidad={item.unidad} onAviso={f.setError} inicial={item} />
          {item.tipoMerch === 'promocional' && (
            <div className="campo">
              <label htmlFor="diseno">DISEÑO O PERSONALIZACIÓN (OPCIONAL)</label>
              <input id="diseno" name="diseno" type="text" maxLength={largos.diseno} defaultValue={item.diseno} />
            </div>
          )}
          {item.subcategoria === 'prendas' && (
            <div className="campo">
              <label htmlFor="material">MATERIAL (OPCIONAL)</label>
              <input id="material" name="material" type="text" maxLength={largos.material} defaultValue={item.material} />
            </div>
          )}
          <div className="campo">
            <label htmlFor="descripcion">DESCRIPCIÓN (OPCIONAL)</label>
            <textarea id="descripcion" name="descripcion" rows={2} maxLength={largos.descripcion} defaultValue={item.descripcion} />
          </div>
          <p className="ajuste-nota">El nuevo precio vale para las próximas ventas: las ya registradas conservan el suyo.</p>
          <MensajeError texto={f.error} />
        </div>
        <Botones textoGuardar="Guardar cambios" enviando={f.enviando} />
      </form>
    </Fondo>
  );
}

export function ModalPersona({ modal }) {
  const f = useFormulario();
  const tipo = modal.persona;
  const p = personas[tipo];
  const esProveedor = tipo === 'proveedor';
  const Icono = esProveedor ? IconoProveedores : IconoCompradores;
  return (
    <Fondo>
      <form className="modal" id="form-persona" ref={f.formulario} noValidate onSubmit={e => f.enviar(e, v => guardarPersona(modal, v))}>
        <Cabecera codigo={<Icono />} color={p.color} titulo={`Agregar ${p.singular}`} subtitulo={esProveedor ? 'A quién se le compra merchandising' : 'A quién se le vende merchandising'} />
        <div className="modal-cuerpo">
          <div className="campo">
            <label htmlFor="nuevo-nombre">NOMBRE</label>
            <input id="nuevo-nombre" name="nuevo-nombre" type="text" maxLength={largos.nombreDonador} placeholder={esProveedor ? 'Ej. Textiles Arequipa' : 'Ej. Rosa Quispe'} autoFocus />
          </div>
          <div className={esProveedor ? 'dos-columnas' : ''}>
            <div className="campo">
              <label htmlFor="nuevo-telefono">NÚMERO DE CONTACTO{p.telefonoObligatorio ? '' : ' (OPCIONAL)'}</label>
              <input id="nuevo-telefono" name="nuevo-telefono" type="tel" maxLength={largos.telefono} inputMode="tel" placeholder="Ej. 987 654 321" />
            </div>
            {esProveedor && (
              <div className="campo">
                <label htmlFor="nuevo-ruc">RUC (OPCIONAL)</label>
                <input id="nuevo-ruc" name="nuevo-ruc" type="text" inputMode="numeric" maxLength={largos.ruc} placeholder="Ej. 20123456789" />
              </div>
            )}
          </div>
          <div className="campo">
            <label htmlFor="nuevo-observaciones">OBSERVACIONES (OPCIONAL)</label>
            <textarea id="nuevo-observaciones" name="nuevo-observaciones" rows={2} maxLength={largos.observaciones} placeholder={esProveedor ? 'Ej. pide adelanto' : 'Ej. compra cada Navidad'} />
          </div>
          <MensajeError texto={f.error} />
        </div>
        <Botones textoGuardar={`Agregar ${p.singular}`} enviando={f.enviando} />
      </form>
    </Fondo>
  );
}

export function textoFilaMerch({ esIngreso, proveedor, comprador, costo, precio, cantidad, medio, taller }) {
  if (esIngreso) {
    return [proveedor ? `Compra a ${proveedor}` : taller ? `Hecho por ${taller}` : '', costo != null ? `${soles(costo)} c/u` : ''].filter(Boolean).join(' · ');
  }
  return [comprador ? `Venta a ${comprador}` : 'Venta', precio != null && cantidad ? soles(totalVenta(precio, cantidad)) : '', medio].filter(Boolean).join(' · ');
}
