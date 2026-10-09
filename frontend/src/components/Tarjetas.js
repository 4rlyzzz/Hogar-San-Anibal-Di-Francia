import { escapar, colorVencimiento, textoVencimiento } from './Comunes.js';

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

  let extra = item.lote ? `Lote ${escapar(item.lote)}` : '';
  if (esSalud && item.paraNino) {
    extra += `${extra ? ' · ' : ''}Para: ${escapar(item.paraNino)}`;
  }

  return `
    <div class="tarjeta">
      <div class="tarjeta-top">
        <div class="tarjeta-codigo ${colorVence}">${escapar(item.codigo)}</div>
        <div>
          <div class="tarjeta-nombre">${escapar(item.nombre)}</div>
          <div class="tarjeta-descripcion">${escapar(item.descripcion)}</div>
          ${extra ? `<div class="tarjeta-meta">${extra}</div>` : ''}
        </div>
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
      </div>
    </div>
  `;
}
