import { usuario } from '../data/datos.js';

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function fechaActual() {
  const d = new Date();
  const dos = n => String(n).padStart(2, '0');
  return `${dos(d.getDate())} ${meses[d.getMonth()]} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// el usuario solo puede registrar salidas, los ingresos son del admin
export function ModalSalida(item, categoria) {
  return `
    <div class="fondo-modal">
      <form class="modal" id="form-salida">
        <div class="modal-header">
          <div class="tarjeta-codigo ${item.color}">${item.codigo}</div>
          <div>
            <div class="modal-titulo">Registrar movimiento</div>
            <div class="modal-sub">${item.nombre} · ${categoria}</div>
          </div>
          <button type="button" class="btn-cerrar" data-accion="cerrar-modal">×</button>
        </div>

        <div class="modal-cuerpo">
          <div class="campo">
            <label>TIPO DE MOVIMIENTO</label>
            <div class="tipo-movimiento">Salida / consumo</div>
          </div>

          <div class="dos-columnas">
            <div class="campo">
              <label>CANTIDAD</label>
              <input id="cantidad" type="text" placeholder="0">
              <small>Disponible: ${item.cantidad} ${item.unidad}</small>
            </div>
            <div class="campo">
              <label>LOTE</label>
              <input id="lote" type="text" value="${item.lote || ''}" placeholder="AV-3308">
            </div>
          </div>

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

          <p class="nota">Como Usuario solo puedes registrar salidas y consumo. Los ingresos y donaciones los registra un administrador.</p>

          <div class="campo">
            <label>OBSERVACIÓN (OPCIONAL)</label>
            <input id="observacion" type="text" placeholder="Ej. entrega a cocina para desayuno">
          </div>

          <p class="error" id="error"></p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-blanco" data-accion="cerrar-modal">Cancelar</button>
          <button type="submit" class="btn btn-verde">Guardar registro</button>
        </div>
      </form>
    </div>
  `;
}
