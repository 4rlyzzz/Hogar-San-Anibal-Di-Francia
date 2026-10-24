import { usuario } from '../data/datos.js';
import { iconoAlimentos, iconoSalud, iconoDonadores, iconoUsuarios } from '../assets/icons.js';
import { cantidadVencida, disponible, lotesVencidos, fechaLote, fechaVence, textoVenceLote, colorLote } from './Lotes.js';
import { escapar, nombreCategoria, colorVencimiento, textoFecha, motivosAjuste, motivoCorreccion, MovimientosEntre, stockAntes, textoPresentacion, envases } from './Comunes.js';

// como viene cada producto (los valores son el plural, en lo que se cuenta)
const envasesAlimentos = ['bolsas', 'latas', 'sacos', 'cajas', 'paquetes', 'botellas', 'frascos', 'sobres'];
const envasesSalud = ['cajas', 'blísters', 'frascos', 'sobres', 'ampollas', 'tubos', 'paquetes', 'botellas'];

// suelto o a granel: se cuenta directo en una medida
const medidasSuelto = ['kg', 'g', 'L', 'unidades'];

// cuanto trae cada envase: 1 kg, 400 g, 60 ml, 10 tabletas...
const medidasAlimentos = ['kg', 'g', 'L', 'ml', 'unidades'];
const medidasSalud = ['unidades', 'ml', 'L', 'g'];

export function fechaActual() {
  return textoFecha(new Date());
}

// lista de donadores + opcion para registrar uno nuevo ahi mismo
// actividades: las opciones de la lista (las del hogar y las que se agregaron con "Otra")
function CampoDonador(donadores, actividades = []) {
  return `
    <div class="campo">
      <label>DONADOR</label>
      <select id="donador">
        <option value="">Sin donador (compra del hogar)</option>
        ${donadores.map(d => `<option value="${d.id}">${escapar(d.nombre)}</option>`).join('')}
        <option value="nuevo">+ Nuevo donador</option>
      </select>
    </div>

    <div class="dos-columnas" id="nuevo-donador" hidden>
      <div class="campo">
        <label>NOMBRE DEL DONADOR</label>
        <input id="donador-nombre" type="text" placeholder="Nombre o institución">
      </div>
      <div class="campo">
        <label>NÚMERO DE CONTACTO</label>
        <input id="donador-telefono" type="tel" placeholder="987 654 321">
      </div>
    </div>

    <!-- solo si hay donador: para que actividad o por que dono (obligatorio) -->
    <div class="campo" id="campo-actividad" hidden>
      <label for="actividad">ACTIVIDAD O MOTIVO</label>
      <select id="actividad">
        <option value="">Elige una actividad</option>
        ${actividades.map(a => `<option value="${escapar(a)}">${escapar(a)}</option>`).join('')}
        <option value="otra">+ Otra actividad…</option>
      </select>
      <input id="actividad-otra" type="text" placeholder="Ej. Colecta parroquial, Kermés" hidden>
    </div>

  `;
}

// solo en salidas de Salud: a quien se le dio
function CampoPara(ninos = []) {
  return `
    <div class="campo">
      <label for="para">PARA QUIÉN</label>
      <select id="para">
        <option value="">Uso general (no es para un niño en particular)</option>
        ${ninos.map(n => `<option value="${escapar(n)}">${escapar(n)}</option>`).join('')}
        <option value="otro">+ Otro niño/a…</option>
      </select>
      <input id="para-otro" type="text" placeholder="Nombre del niño o niña" hidden>
    </div>
  `;
}

// 'Lata de 400 g · se cuenta en latas': para saber de que producto y en que unidad se esta contando
function sobreProducto(item, antes = '') {
  const partes = [antes, textoPresentacion(item) || `suelto, en ${item.unidad}`].filter(Boolean);
  return escapar(partes.join(' · '));
}

function Cabecera(codigo, color, titulo, subtitulo) {
  return `
    <div class="modal-header">
      <div class="tarjeta-codigo ${color}">${codigo}</div>
      <div>
        <div class="modal-titulo">${titulo}</div>
        <div class="modal-sub">${subtitulo}</div>
      </div>
      <button type="button" class="btn-cerrar" data-accion="cerrar-modal">×</button>
    </div>
  `;
}

function Botones(textoGuardar) {
  return `
    <div class="modal-footer">
      <button type="button" class="btn btn-blanco" data-accion="cerrar-modal">Cancelar</button>
      <button type="submit" class="btn btn-verde">${textoGuardar}</button>
    </div>
  `;
}

// vencimiento del lote que entra; si no tiene o no se ve, se marca y se cuentan los dias que lleva
function CampoVencimiento() {
  return `
    <div class="campo">
      <label for="vencimiento">VENCE</label>
      <input id="vencimiento" type="date">
      <label class="check-campo">
        <input type="checkbox" id="sin-vencimiento">
        No tiene fecha
      </label>
    </div>`;
}

// en una salida: cuanto se puede sacar (lo vencido no cuenta, se da de baja aparte)
function TextoDisponible(item) {
  const vencida = cantidadVencida(item);
  if (!vencida) return `En stock: ${item.cantidad} ${escapar(item.unidad)} · sale primero lo que vence antes`;
  return `Se pueden usar ${disponible(item)} ${escapar(item.unidad)} · ${vencida} vencidos no cuentan`;
}

// tipo: 'Salida' o 'Ingreso', segun el boton que se apreto en la tarjeta
export function ModalMovimiento(item, categoria, tipo, donadores, actividades, ninos) {
  const esIngreso = tipo === 'Ingreso';
  const esSalud = categoria === 'Salud';

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-movimiento">
        ${Cabecera(escapar(item.codigo), colorVencimiento(item), escapar(item.nombre), sobreProducto(item))}

        <div class="modal-cuerpo">
          <div class="campo">
            <label>TIPO DE MOVIMIENTO</label>
            <div class="tipo-movimiento ${esIngreso ? 'tipo-ingreso' : ''}">${esIngreso ? 'Ingreso / donación' : 'Salida / consumo'}</div>
          </div>

          ${esIngreso ? `
            <div class="dos-columnas">
              <div class="campo">
                <label for="cantidad">CANTIDAD</label>
                <input id="cantidad" type="text" inputmode="decimal" placeholder="0">
                <small>En stock: ${item.cantidad} ${escapar(item.unidad)}</small>
              </div>
              ${CampoVencimiento()}
            </div>` : `
            <div class="campo">
              <label for="cantidad">CANTIDAD</label>
              <input id="cantidad" type="text" inputmode="decimal" placeholder="0">
              <small>${TextoDisponible(item)}</small>
            </div>`}

          ${esIngreso ? CampoDonador(donadores, actividades) : ''}
          ${esSalud && !esIngreso ? CampoPara(ninos) : ''}

          <div class="dos-columnas">
            <div class="campo">
              <label>RESPONSABLE</label>
              <div class="input-fijo">${usuario.nombre}</div>
            </div>
            <div class="campo">
              <label>FECHA Y HORA</label>
              <div class="input-fijo">${fechaActual()}</div>
            </div>
          </div>

          <p class="error" id="error"></p>
        </div>

        ${Botones(esIngreso ? 'Revisar ingreso' : 'Revisar salida')}
      </form>
    </div>
  `;
}

// formulario para agregar un producto nuevo al inventario
export function ModalProducto(categoria, donadores, actividades) {
  const esSalud = categoria === 'Salud';

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-producto">
        ${Cabecera('+', esSalud ? 'azul' : 'verde', 'Agregar producto', nombreCategoria(categoria))}

        <div class="modal-cuerpo">
          <div class="campo">
            <label>CATEGORÍA</label>
            <div class="filtros selector-categoria">
              ${['Alimentos', 'Salud'].map(c => `
                <button type="button" class="${c === categoria ? 'activo' : ''}" data-accion="agregar-producto" data-categoria="${c}">${c}</button>
              `).join('')}
            </div>
          </div>

          <div class="campo">
            <label>NOMBRE</label>
            <input id="nombre" type="text" autocomplete="off" placeholder="${esSalud ? 'Ej. Ibuprofeno 400 mg' : 'Ej. Fideos Don Vittorio'}">
            <div id="coincidencias"></div>
          </div>

          <!-- se lee como una frase: "10 cajas de 10 tabletas"; si es suelto, "25 kg" -->
          <div class="campo">
            <label for="cantidad">CANTIDAD QUE ENTRA</label>
            <div class="fila-presentacion sin-envase" id="fila-presentacion">
              <input id="cantidad" type="text" inputmode="decimal" placeholder="0" aria-label="Cantidad">
              <select id="envase" aria-label="En qué viene">
                <option value="">en qué viene…</option>
                <optgroup label="Envase">
                  ${(esSalud ? envasesSalud : envasesAlimentos).map(e => `<option value="${e}">${e}</option>`).join('')}
                  <option value="otro">+ otro envase…</option>
                </optgroup>
                <optgroup label="Suelto (a granel)">
                  ${medidasSuelto.map(m => `<option value="suelto:${m}">${m}</option>`).join('')}
                </optgroup>
              </select>
              <span class="fila-presentacion-de">de</span>
              <input id="contenido" type="text" inputmode="decimal" placeholder="${esSalud ? '10' : '1'}" aria-label="Cuánto trae cada uno">
              <select id="medida" aria-label="Medida">
                ${(esSalud ? medidasSalud : medidasAlimentos).map(m => `<option>${m}</option>`).join('')}
              </select>
            </div>
            <input id="envase-otro" type="text" placeholder="¿Cómo se llama el envase? Ej. Bidón" hidden>
            <small>${esSalud ? 'Ej. 5 blísters de 10 unidades · 3 frascos de 60 ml · 4 paquetes de 40 unidades' : 'Ej. 12 bolsas de 1 kg · 24 latas de 400 g · 25 kg sueltos'}</small>
          </div>

          <p class="presentacion-previa" id="presentacion-previa" hidden></p>

          <div class="dos-columnas">
            <div class="campo">
              <label>STOCK MÍNIMO</label>
              <input id="minimo" type="text" placeholder="0">
            </div>
            ${CampoVencimiento()}
          </div>

          ${CampoDonador(donadores, actividades)}

          <p class="error" id="error"></p>
        </div>

        ${Botones('Agregar producto')}
      </form>
    </div>
  `;
}

// desde Inicio o Historial el "+" pregunta que se quiere agregar
// esAdmin: el administrador tambien puede agregar usuarios
export function ModalElegir(esAdmin) {
  const opciones = [
    { accion: 'agregar-producto', categoria: 'Alimentos', color: 'verde', icono: iconoAlimentos, titulo: 'Alimento', detalle: 'Producto perecible' },
    { accion: 'agregar-producto', categoria: 'Salud', color: 'azul', icono: iconoSalud, titulo: 'Salud e higiene', detalle: 'Medicinas, pañales, aseo' },
    { accion: 'agregar-donador', categoria: '', color: 'naranja', icono: iconoDonadores, titulo: 'Donador', detalle: 'Persona o institución' },
  ];
  if (esAdmin) {
    opciones.push({ accion: 'agregar-usuario', categoria: '', color: 'gris', icono: iconoUsuarios, titulo: 'Usuario', detalle: 'Cuenta para entrar al inventario' });
  }

  return `
    <div class="fondo-modal">
      <div class="modal">
        ${Cabecera('+', 'verde', '¿Qué quieres agregar?', 'Elige una opción')}

        <div class="modal-cuerpo">
          ${opciones.map(o => `
            <button type="button" class="opcion-agregar" data-accion="${o.accion}" data-categoria="${o.categoria}">
              <span class="tarjeta-codigo ${o.color}">${o.icono}</span>
              <span>
                <b>${o.titulo}</b>
                <small>${o.detalle}</small>
              </span>
              <span class="opcion-flecha">›</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function ModalDonador() {
  return `
    <div class="fondo-modal">
      <form class="modal" id="form-donador">
        ${Cabecera('+', 'naranja', 'Agregar donador', 'Persona o institución que dona al hogar')}

        <div class="modal-cuerpo">
          <div class="campo">
            <label>NOMBRE</label>
            <input id="nuevo-nombre" type="text" placeholder="Nombre o institución">
          </div>
          <div class="campo">
            <label>NÚMERO DE CONTACTO</label>
            <input id="nuevo-telefono" type="tel" placeholder="987 654 321">
          </div>
          <p class="error" id="error"></p>
        </div>

        ${Botones('Agregar donador')}
      </form>
    </div>
  `;
}

// solo el administrador crea cuentas desde aqui
export function ModalUsuario() {
  return `
    <div class="fondo-modal">
      <form class="modal" id="form-usuario" novalidate>
        ${Cabecera('+', 'azul', 'Agregar usuario', 'Cuenta para entrar al inventario')}

        <div class="modal-cuerpo">
          <div class="campo">
            <label>NOMBRE</label>
            <input id="cuenta-nombre" type="text" placeholder="Ej. Cocina, María López">
            <small>Así aparecerá como responsable en el historial</small>
          </div>

          <div class="dos-columnas">
            <div class="campo">
              <label>USUARIO</label>
              <input id="cuenta-usuario" type="text" autocapitalize="none" autocomplete="off" placeholder="Ej. cocina">
            </div>
            <div class="campo">
              <label>CONTRASEÑA</label>
              <input id="cuenta-clave" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
            </div>
          </div>

          <div class="campo">
            <label>ROL</label>
            <select id="cuenta-rol">
              <option value="Usuario">Usuario · registra ingresos y salidas</option>
              <option value="Administrador">Administrador · además gestiona usuarios</option>
            </select>
          </div>

          <p class="error" id="error"></p>
        </div>

        ${Botones('Agregar usuario')}
      </form>
    </div>
  `;
}

// paso 1: se corrige el stock cuando el conteo fisico no coincide con el sistema
// la diferencia se va mostrando mientras se escribe (ver mostrarDiferencia en main.js)
// previo: lo ya escrito al volver del paso 2, o el motivo puesto al corregir un ajuste
// al corregir un ajuste: cual se corrige y que paso con el producto desde entonces
// el nuevo ajuste igual se hace sobre el stock de ahora (ya incluye esos movimientos)
function BloqueCorreccion(correccion, item) {
  const { fila, entre } = correccion;
  const u = escapar(item.unidad);
  return `
    <div class="correccion">
      <b>Estás corrigiendo el conteo del ${fila.fecha}</b>
      <p>Ese día el sistema decía <b>${stockAntes(fila)} ${u}</b> y ${escapar(fila.responsable)} contó <b>${fila.saldo} ${u}</b>.</p>
      <span class="correccion-sub">Después de ese conteo hubo</span>
      ${MovimientosEntre(entre, item.unidad)}
      <p>Por eso hoy el sistema dice <b>${item.cantidad} ${u}</b>.</p>
      <p class="correccion-nota">Vuelve a contar lo que hay hoy y escríbelo abajo.</p>
    </div>`;
}

// correccion: { fila, entre } si se esta corrigiendo un ajuste anterior
export function ModalAjuste(item, categoria, previo = {}, correccion = null) {
  const motivo = previo.motivo || motivosAjuste[0];

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-ajuste" novalidate>
        ${Cabecera(escapar(item.codigo), colorVencimiento(item), escapar(item.nombre), sobreProducto(item, 'Ajustar stock'))}

        <div class="modal-cuerpo">
          ${correccion ? BloqueCorreccion(correccion, item) : ''}

          <div class="dos-columnas">
            <div class="campo">
              <label>SEGÚN SISTEMA</label>
              <div class="input-fijo">${item.cantidad} ${escapar(item.unidad)}</div>
            </div>
            <div class="campo">
              <label for="contado">CANTIDAD CONTADA</label>
              <input id="contado" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${previo.contado ?? ''}">
            </div>
          </div>

          <p class="ajuste-diferencia" id="ajuste-diferencia">Escribe cuánto hay realmente en el almacén</p>

          ${correccion ? `
            <div class="campo">
              <label>MOTIVO</label>
              <div class="input-fijo">${motivoCorreccion}</div>
            </div>

            <div class="campo">
              <label for="nota">¿QUÉ PASÓ EN EL CONTEO ANTERIOR? (OPCIONAL)</label>
              <input id="nota" type="text" placeholder="Ej. se contó una caja dos veces" value="${escapar(previo.nota ?? '')}">
            </div>` : `
            <div class="campo">
              <label for="motivo">¿POR QUÉ NO COINCIDÍA?</label>
              <select id="motivo">
                ${motivosAjuste.map(m => `<option ${m === motivo ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
              <small>Si no sabes la causa, deja "Sin identificar"</small>
            </div>

            <div class="campo">
              <label for="nota">DETALLE ${motivo === 'Otro' ? '' : '(OPCIONAL)'}</label>
              <input id="nota" type="text" placeholder="Ej. 3 latas abolladas" value="${escapar(previo.nota ?? '')}">
            </div>`}

          <p class="error" id="error"></p>
        </div>

        ${Botones('Revisar ajuste')}
      </form>
    </div>
  `;
}

// paso 2: resumen para confirmar; no se guarda nada hasta apretar "Confirmar"
// grande: la diferencia es mas del 25% del stock, se pide volver a contar
export function ConfirmarAjuste(item, categoria, ajuste, correccion = null) {
  const antes = item.cantidad;
  const grande = Math.abs(ajuste.diferencia) > antes * 0.25;
  const signo = ajuste.diferencia > 0 ? 'sobra' : 'falta';

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-ajuste-confirmar" novalidate>
        ${Cabecera(escapar(item.codigo), colorVencimiento(item), escapar(item.nombre), sobreProducto(item, 'Revisa el ajuste'))}

        <div class="modal-cuerpo">
          <div class="mov-cambio">
            <div>
              <span>SISTEMA</span>
              <b>${antes}</b>
              <small>${escapar(item.unidad)}</small>
            </div>
            <div class="mov-flecha ajuste">
              <span>→</span>
              <em>${ajuste.diferencia > 0 ? '+' : '−'}${Math.abs(ajuste.diferencia)}</em>
            </div>
            <div>
              <span>CONTADO</span>
              <b>${ajuste.contado}</b>
              <small>${escapar(item.unidad)}</small>
            </div>
          </div>

          ${correccion ? BloqueCorreccion(correccion, item) : ''}

          <p class="ajuste-diferencia ${signo}">
            ${ajuste.diferencia > 0 ? 'Sobran' : 'Faltan'} ${Math.abs(ajuste.diferencia)} ${escapar(item.unidad)}
          </p>

          ${grande ? `
            <p class="aviso-grande">
              Es una diferencia grande. Si puedes, vuelve a contar antes de confirmar.
            </p>` : ''}

          <dl class="mov-datos">
            <div><dt>Motivo</dt><dd>${escapar(ajuste.motivo)}</dd></div>
            ${ajuste.nota ? `<div><dt>Detalle</dt><dd>${escapar(ajuste.nota)}</dd></div>` : ''}
            <div><dt>Responsable</dt><dd>${usuario.nombre}</dd></div>
            <div><dt>Fecha y hora</dt><dd>${fechaActual()}</dd></div>
          </dl>

          <p class="ajuste-nota">
            Los ajustes no se borran ni se editan. Si te equivocas, abre este ajuste en el historial
            y usa "Corregir este ajuste".
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-blanco" data-accion="volver-ajuste">Volver y corregir</button>
          <button type="submit" class="btn btn-verde">Confirmar ajuste</button>
        </div>
      </form>
    </div>
  `;
}

// aviso bajo el nombre al agregar un producto: los que ya existen y se parecen
// parecidos: [{ item, categoria }]; tocar uno lleva a registrar su ingreso (no se crea repetido)
export function Coincidencias(parecidos) {
  if (parecidos.length === 0) return '';
  return `
    <div class="coincidencias">
      <span>Ya existe algo parecido. ¿Es alguno de estos?</span>
      ${parecidos.map(({ item, categoria }) => `
        <button type="button" class="coincidencia" data-accion="registrar" data-tipo="Ingreso" data-categoria="${categoria}" data-id="${item.id}">
          <span>
            <b>${escapar(item.nombre)}</b>
            <small>${nombreCategoria(categoria)} · ${item.cantidad} ${escapar(item.unidad)}${textoPresentacion(item) ? ' · ' + escapar(textoPresentacion(item)) : ''}</small>
          </span>
          <em>Registrar ingreso →</em>
        </button>
      `).join('')}
    </div>`;
}

// unir un producto repetido con el que se queda (solo administrador)
// opciones: los otros productos de la categoria con la misma unidad (no se suman kg con latas)
export function ModalUnir(item, categoria, opciones) {
  return `
    <div class="fondo-modal">
      <form class="modal" id="form-unir" novalidate>
        ${Cabecera(escapar(item.codigo), colorVencimiento(item), escapar(item.nombre), sobreProducto(item, 'Unir productos'))}

        <div class="modal-cuerpo">
          <p class="ajuste-nota">
            Úsalo cuando el mismo producto se registró dos veces. "${escapar(item.nombre)}" dejará de aparecer
            y sus ${item.cantidad} ${escapar(item.unidad)} se sumarán al producto que elijas. Su historial no se borra.
          </p>

          ${opciones.length ? `
            <div class="campo">
              <label for="unir-con">SE UNE CON</label>
              <select id="unir-con">
                <option value="">Elige el producto que se queda</option>
                ${opciones.map(o => `
                  <option value="${o.id}">${escapar(o.nombre)} · ${o.cantidad} ${escapar(o.unidad)}</option>
                `).join('')}
              </select>
            </div>
            <p class="ajuste-diferencia" id="unir-resumen">Elige el producto que se queda</p>
          ` : `
            <p class="ajuste-diferencia">No hay otro producto en ${nombreCategoria(categoria)} que se cuente en ${escapar(item.unidad)}.</p>
          `}

          <p class="error" id="error"></p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-blanco" data-accion="cerrar-modal">Cancelar</button>
          <button type="submit" class="btn btn-verde" ${opciones.length ? '' : 'disabled'}>Unir productos</button>
        </div>
      </form>
    </div>
  `;
}

// dar de baja lo vencido: sale del stock como una salida con motivo, y queda en el historial
export function ModalBaja(item) {
  const vencidos = lotesVencidos(item);
  const vencida = cantidadVencida(item);
  const despues = Math.round((item.cantidad - vencida) * 100) / 100;

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-baja" novalidate>
        ${Cabecera(escapar(item.codigo), 'rojo', escapar(item.nombre), sobreProducto(item, 'Dar de baja lo vencido'))}

        <div class="modal-cuerpo">
          <div class="mov-cambio">
            <div>
              <span>AHORA</span>
              <b>${item.cantidad}</b>
              <small>${escapar(item.unidad)}</small>
            </div>
            <div class="mov-flecha salida">
              <span>→</span>
              <em>−${vencida}</em>
            </div>
            <div>
              <span>QUEDARÁ</span>
              <b>${despues}</b>
              <small>${escapar(item.unidad)}</small>
            </div>
          </div>

          <dl class="mov-datos">
            ${vencidos.map(l => `
              <div><dt>Lote del ${fechaLote(l.ingreso)}</dt><dd>${l.quedan} ${escapar(item.unidad)} · venció ${fechaVence(l.vence)}</dd></div>`).join('')}
            <div><dt>Motivo</dt><dd>Baja por vencimiento</dd></div>
            <div><dt>Responsable</dt><dd>${usuario.nombre}</dd></div>
            <div><dt>Fecha y hora</dt><dd>${fechaActual()}</dd></div>
          </dl>

          <div class="campo">
            <label for="nota">DETALLE (OPCIONAL)</label>
            <input id="nota" type="text" placeholder="Ej. se botó, olía mal">
          </div>

          <p class="ajuste-nota">Confirma solo cuando ya lo hayas sacado del almacén.</p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-blanco" data-accion="cerrar-modal">Cancelar</button>
          <button type="submit" class="btn btn-rojo">Dar de baja ${vencida} ${escapar(item.unidad)}</button>
        </div>
      </form>
    </div>
  `;
}

// en la confirmacion de una salida: cuanto queda en cada lote que se toca
function LotesSalida(plan, unidad) {
  return `
    <div class="lotes-salida">
      <div class="mov-pasos-titulo">
        <b>De qué lotes sale</b>
        <span class="lotes-ayuda">primero lo que vence antes</span>
      </div>
      <ul class="lotes">
        ${plan.map(({ lote, cantidad }) => `
          <li class="lote lote-sale">
            <span class="lote-ingreso">
              <b>Ingresó ${fechaLote(lote.ingreso)}</b>
              <small class="texto-${colorLote(lote)}">${textoVenceLote(lote)}</small>
            </span>
            <span class="lote-menos">−${cantidad}</span>
            <span class="lote-quedan">${lote.quedan} → ${Math.round((lote.quedan - cantidad) * 100) / 100} <small>${escapar(unidad)}</small></span>
          </li>`).join('')}
      </ul>
    </div>`;
}

// paso 2 de un ingreso o salida: se muestra encima del formulario (que queda escondido, sin perder lo escrito)
// datos: { cantidad, vence, plan, donador: { nombre, nuevo }, actividad, para }
// plan: de que lotes sale una salida (ver planDescuento en Lotes.js)
export function ConfirmarMovimiento(item, tipo, datos) {
  const esIngreso = tipo === 'Ingreso';
  const despues = Math.round((item.cantidad + (esIngreso ? datos.cantidad : -datos.cantidad)) * 100) / 100;
  const quedaBajo = !esIngreso && despues < item.minimo;

  const filas = [
    ['Vence', esIngreso ? (datos.vence ? fechaVence(datos.vence) : 'No tiene fecha') : ''],
    ['Donado por', datos.donador.nombre ? datos.donador.nombre + (datos.donador.nuevo ? ' (nuevo donador)' : '') : (esIngreso ? 'Compra del hogar' : '')],
    ['Actividad', datos.actividad],
    ['Para', datos.para || (item && !esIngreso && datos.esSalud ? 'Uso general' : '')],
    ['Responsable', usuario.nombre],
    ['Fecha y hora', fechaActual()],
  ].filter(([, valor]) => valor);

  return `
    <form class="modal" id="form-movimiento-confirmar" novalidate>
      ${Cabecera(escapar(item.codigo), colorVencimiento(item), escapar(item.nombre), sobreProducto(item, esIngreso ? 'Revisa el ingreso' : 'Revisa la salida'))}

      <div class="modal-cuerpo">
        <div class="mov-cambio">
          <div>
            <span>AHORA</span>
            <b>${item.cantidad}</b>
            <small>${escapar(item.unidad)}</small>
          </div>
          <div class="mov-flecha ${esIngreso ? 'ingreso' : 'salida'}">
            <span>→</span>
            <em>${esIngreso ? '+' : '−'}${datos.cantidad}</em>
          </div>
          <div>
            <span>QUEDARÁ</span>
            <b>${despues}</b>
            <small>${escapar(item.unidad)}</small>
          </div>
        </div>

        <p class="ajuste-diferencia ${esIngreso ? 'sobra' : 'falta'}">
          ${esIngreso ? 'Entran' : 'Salen'} ${datos.cantidad} ${escapar(item.unidad)}
        </p>

        ${quedaBajo ? `
          <p class="aviso-grande">
            Quedará bajo el stock mínimo (${item.minimo} ${escapar(item.unidad)}).
          </p>` : ''}

        ${esIngreso ? '' : LotesSalida(datos.plan, item.unidad)}

        <dl class="mov-datos">
          ${filas.map(([etiqueta, valor]) => `<div><dt>${etiqueta}</dt><dd>${escapar(valor)}</dd></div>`).join('')}
        </dl>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-blanco" data-accion="volver-movimiento">Volver y corregir</button>
        <button type="submit" class="btn btn-verde">Confirmar ${esIngreso ? 'ingreso' : 'salida'}</button>
      </div>
    </form>
  `;
}
