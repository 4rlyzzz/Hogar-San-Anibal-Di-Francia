export function porcentaje(item) {
  return Math.round(item.cantidad / item.maximo * 100);
}

export function TarjetaAlimento(item) {
  const pct = porcentaje(item);

  return `
    <div class="tarjeta">
      <div class="tarjeta-top">
        <div class="tarjeta-codigo ${item.color}">${item.codigo}</div>
        <div>
          <div class="tarjeta-nombre">${item.nombre}</div>
          <div class="tarjeta-meta">${item.cantidad} ${item.unidad}</div>
        </div>
        <span class="etiqueta ${item.color}">● ${item.vence}</span>
      </div>

      <div class="barra">
        <div class="barra-relleno ${item.color}" style="width: ${pct}%"></div>
      </div>
      <div class="barra-texto">
        <span>Stock restante</span>
        <b>${pct}%</b>
      </div>

      <button class="btn btn-gris" data-accion="registrar" data-categoria="Alimentos" data-id="${item.id}">Registrar salida</button>
    </div>
  `;
}

export function TarjetaSalud(item) {
  let color = 'verde';
  let mensaje = 'Stock sobre el mínimo';
  if (item.cantidad < item.minimo) {
    color = 'rojo';
    mensaje = 'Bajo stock mínimo';
  } else if (item.cantidad <= item.minimo * 1.2) {
    color = 'naranja';
    mensaje = 'Revisar consumo';
  }

  return `
    <div class="tarjeta">
      <div class="tarjeta-top arriba">
        <div class="tarjeta-codigo ${item.color}">${item.codigo}</div>
        <div>
          <div class="tarjeta-nombre">${item.nombre}</div>
          <div class="tarjeta-meta">Lote ${item.lote} · ${item.cantidad} ${item.unidad}</div>
        </div>
        <span class="etiqueta ${item.color}">${item.vence}</span>
      </div>

      <div class="aviso-minimo ${color}">
        <span class="aviso-minimo-linea"></span>
        <div>
          <div class="aviso-minimo-titulo">${mensaje}</div>
          <div class="aviso-minimo-nota">mín. ${item.minimo} · actual ${item.cantidad}</div>
        </div>
      </div>

      <button class="btn btn-azul" data-accion="registrar" data-categoria="Salud" data-id="${item.id}">Registrar uso</button>
    </div>
  `;
}
