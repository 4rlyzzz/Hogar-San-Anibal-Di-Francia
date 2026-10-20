import { usuario } from '../data/datos.js';
import { iconoAlimentos, iconoSalud, iconoDonadores } from '../assets/icons.js';
import { escapar, colorVencimiento, textoFecha } from './Comunes.js';

const unidadesAlimentos = ['kg', 'g', 'L', 'latas', 'bolsas', 'paquetes', 'sacos', 'cajas', 'unidades'];
const unidadesSalud = ['frascos', 'blísters', 'sobres', 'cajas', 'tabletas', 'paquetes', 'L', 'unidades'];

export function fechaActual() {
  return textoFecha(new Date());
}

// lista de donadores + opcion para registrar uno nuevo ahi mismo
function CampoDonador(donadores) {
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
  `;
}

function CampoNino(valor = '') {
  return `
    <div class="campo">
      <label>PARA QUÉ NIÑO/A (OPCIONAL)</label>
      <input id="para" type="text" value="${escapar(valor)}" placeholder="Nombre del niño o niña">
    </div>
  `;
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

// tipo: 'Salida' o 'Ingreso', segun el boton que se apreto en la tarjeta
export function ModalMovimiento(item, categoria, tipo, donadores) {
  const esIngreso = tipo === 'Ingreso';
  const esSalud = categoria === 'Salud';

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-movimiento">
        ${Cabecera(escapar(item.codigo), colorVencimiento(item), 'Registrar movimiento', `${escapar(item.nombre)} · ${categoria}`)}

        <div class="modal-cuerpo">
          <div class="campo">
            <label>TIPO DE MOVIMIENTO</label>
            <div class="tipo-movimiento ${esIngreso ? 'tipo-ingreso' : ''}">${esIngreso ? 'Ingreso / donación' : 'Salida / consumo'}</div>
          </div>

          <div class="dos-columnas">
            <div class="campo">
              <label>CANTIDAD</label>
              <input id="cantidad" type="text" placeholder="0">
              <small>En stock: ${item.cantidad} ${escapar(item.unidad)}</small>
            </div>
            <div class="campo">
              <label>LOTE</label>
              <input id="lote" type="text" value="${escapar(item.lote)}" placeholder="AV-3308">
            </div>
          </div>

          ${esIngreso ? CampoDonador(donadores) : ''}
          ${esSalud ? CampoNino(item.paraNino) : ''}

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

        ${Botones('Guardar registro')}
      </form>
    </div>
  `;
}

// formulario para agregar un producto nuevo al inventario
export function ModalProducto(categoria, donadores) {
  const esSalud = categoria === 'Salud';
  const tipo = esSalud ? 'Indispensable' : 'Perecible';

  return `
    <div class="fondo-modal">
      <form class="modal" id="form-producto">
        ${Cabecera('+', esSalud ? 'azul' : 'verde', 'Agregar producto', `${categoria} · ${tipo}`)}

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
            <input id="nombre" type="text" placeholder="${esSalud ? 'Ej. Ibuprofeno 400 mg' : 'Ej. Fideos Don Vittorio'}">
          </div>

          <div class="campo">
            <label>DESCRIPCIÓN</label>
            <input id="descripcion" type="text" placeholder="${esSalud ? 'Ej. Para dolor e inflamación' : 'Ej. Paquete de 500 g, para el almuerzo'}">
          </div>

          <div class="dos-columnas">
            <div class="campo">
              <label>CANTIDAD</label>
              <input id="cantidad" type="text" placeholder="0">
            </div>
            <div class="campo">
              <label>UNIDAD</label>
              <select id="unidad">
                <option value="">Selecciona</option>
                ${(esSalud ? unidadesSalud : unidadesAlimentos).map(u => `<option value="${u}">${u}</option>`).join('')}
                <option value="otro">Otro</option>
              </select>
              <input id="unidad-otro" type="text" placeholder="Escribe la unidad" hidden>
            </div>
          </div>

          <div class="dos-columnas">
            <div class="campo">
              <label>STOCK MÍNIMO</label>
              <input id="minimo" type="text" placeholder="0">
            </div>
            <div class="campo">
              <label>FECHA DE VENCIMIENTO</label>
              <input id="vencimiento" type="date">
              ${esSalud ? '<small>Déjalo vacío si no vence</small>' : ''}
            </div>
          </div>

          <div class="campo">
            <label>LOTE (OPCIONAL)</label>
            <input id="lote" type="text" placeholder="AB-1234">
          </div>

          ${CampoDonador(donadores)}
          ${esSalud ? CampoNino() : ''}

          <p class="error" id="error"></p>
        </div>

        ${Botones('Agregar producto')}
      </form>
    </div>
  `;
}

// desde Inicio o Historial el "+" pregunta que se quiere agregar
export function ModalElegir() {
  const opciones = [
    { accion: 'agregar-producto', categoria: 'Alimentos', color: 'verde', icono: iconoAlimentos, titulo: 'Alimento', detalle: 'Producto perecible' },
    { accion: 'agregar-producto', categoria: 'Salud', color: 'azul', icono: iconoSalud, titulo: 'Salud', detalle: 'Medicina o higiene' },
    { accion: 'agregar-donador', categoria: '', color: 'naranja', icono: iconoDonadores, titulo: 'Donador', detalle: 'Persona o institución' },
  ];

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
