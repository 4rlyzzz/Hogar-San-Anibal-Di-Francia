import { iconoSalida, iconoIngreso } from '../assets/icons.js';
import { escapar, colorVencimiento, textoVencimiento, textoPresentacion, disponible, cantidadVencida } from './Comunes.js';

// misma tarjeta para alimentos y salud
// solo sacar e ingresar: el conteo (ajuste) esta en el detalle, es menos comun y mas delicado
export function Tarjeta(item, categoria) {
  const sirve = disponible(item);
  const vencida = cantidadVencida(item);
  let color = 'verde';
  let mensaje = 'Stock sobre el mínimo';
  if (sirve < item.minimo) {
    color = 'rojo';
    mensaje = 'Bajo stock mínimo';
  } else if (sirve <= item.minimo * 1.2) {
    color = 'naranja';
    mensaje = 'Cerca del mínimo';
  }

  const colorVence = colorVencimiento(item);

  return `
    <div class="tarjeta">
      <div class="tarjeta-top">
        <div class="tarjeta-codigo ${colorVence}">${escapar(item.codigo)}</div>
        <div class="tarjeta-info">
          <span class="tarjeta-nombre">${escapar(item.nombre)}</span>
          ${textoPresentacion(item) ? `<span class="tarjeta-descripcion">${escapar(textoPresentacion(item))}</span>` : ''}
          <button class="tarjeta-ver" data-accion="ver-producto" data-categoria="${categoria}" data-id="${item.id}">Ver detalle ›</button>
        </div>
        <span class="etiqueta ${colorVence}">${textoVencimiento(item)}</span>
      </div>

      <div class="aviso-minimo ${color}">
        <span class="aviso-minimo-linea"></span>
        <div>
          <div class="aviso-minimo-titulo">${mensaje}</div>
          <div class="aviso-minimo-nota">mín. ${item.minimo} ${escapar(item.unidad)}${vencida ? ` · ${vencida} vencidos` : ''}</div>
        </div>
        <div class="aviso-minimo-cantidad">${item.cantidad} <span>${escapar(item.unidad)}</span></div>
      </div>

      <div class="botones">
        <button class="btn btn-registrar btn-salida" data-accion="registrar" data-tipo="Salida" data-categoria="${categoria}" data-id="${item.id}">${iconoSalida} Registrar salida</button>
        <button class="btn btn-registrar btn-ingreso" data-accion="registrar" data-tipo="Ingreso" data-categoria="${categoria}" data-id="${item.id}">${iconoIngreso} Registrar ingreso</button>
      </div>
    </div>
  `;
}
