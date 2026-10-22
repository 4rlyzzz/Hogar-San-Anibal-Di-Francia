import { escapar, colorVencimiento, textoVencimiento, textoPresentacion } from './Comunes.js';
import { iconoAjustar } from '../assets/icons.js';

// misma tarjeta para alimentos y salud
export function Tarjeta(item, categoria) {
  let color = 'verde';
  let mensaje = 'Stock sobre el mínimo';
  if (item.cantidad < item.minimo) {
    color = 'rojo';
    mensaje = 'Bajo stock mínimo';
  } else if (item.cantidad <= item.minimo * 1.2) {
    color = 'naranja';
    mensaje = 'Revisar consumo';
  }

  const esSalud = categoria === 'Salud';
  const colorVence = colorVencimiento(item);

  return `
    <div class="tarjeta">
      <div class="tarjeta-top">
        <div class="tarjeta-codigo ${colorVence}">${escapar(item.codigo)}</div>
        <button class="tarjeta-info" data-accion="ver-producto" data-categoria="${categoria}" data-id="${item.id}" title="Ver detalle">
          <span class="tarjeta-nombre">${escapar(item.nombre)}</span>
          ${textoPresentacion(item) ? `<span class="tarjeta-descripcion">${escapar(textoPresentacion(item))}</span>` : ''}
        </button>
        <span class="etiqueta ${colorVence}">${textoVencimiento(item)}</span>
      </div>

      <div class="aviso-minimo ${color}">
        <span class="aviso-minimo-linea"></span>
        <div>
          <div class="aviso-minimo-titulo">${mensaje}</div>
          <div class="aviso-minimo-nota">mín. ${item.minimo} ${escapar(item.unidad)}</div>
        </div>
        <div class="aviso-minimo-cantidad">${item.cantidad} <span>${escapar(item.unidad)}</span></div>
      </div>

      <div class="botones">
        <button class="btn ${esSalud ? 'btn-azul' : 'btn-gris'}" data-accion="registrar" data-tipo="Salida" data-categoria="${categoria}" data-id="${item.id}">
          ${esSalud ? 'Registrar uso' : 'Registrar salida'}
        </button>
        <button class="btn btn-verde-claro" data-accion="registrar" data-tipo="Ingreso" data-categoria="${categoria}" data-id="${item.id}">+ Ingreso</button>
        <button class="btn btn-ajustar" data-accion="ajustar" data-categoria="${categoria}" data-id="${item.id}" title="Ajustar stock según conteo" aria-label="Ajustar stock">${iconoAjustar}</button>
      </div>
    </div>
  `;
}
