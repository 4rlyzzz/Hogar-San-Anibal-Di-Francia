// partes que se repiten en las paginas

export function Encabezado(titulo, subtitulo, filtroActivo) {
  let filtros = '';
  if (filtroActivo) {
    filtros = `
      <div class="filtros">
        ${['Todos', 'Por vencer', 'Stock bajo'].map(f => `
          <button class="${f === filtroActivo ? 'activo' : ''}" data-accion="filtro" data-filtro="${f}">${f}</button>
        `).join('')}
      </div>`;
  }

  return `
    <div class="encabezado">
      <div>
        <h1>${titulo}</h1>
        <p>${subtitulo}</p>
      </div>
      ${filtros}
    </div>
  `;
}

export function TituloSeccion(codigo, color, titulo, detalle, link = '') {
  return `
    <div class="titulo-seccion">
      <span class="titulo-seccion-icono ${color}">${codigo}</span>
      <h2>${titulo}</h2>
      <span class="titulo-seccion-detalle">${detalle}</span>
      ${link}
    </div>
  `;
}

export function SinResultados() {
  return `<div class="vacio">Sin insumos en este filtro</div>`;
}

// aplica el filtro de las pestañas y lo que se escribio en el buscador
export function filtrarInsumos(lista, estado, esStockBajo) {
  const texto = estado.busqueda.toLowerCase();

  return lista.filter(item => {
    if (estado.filtro === 'Por vencer' && !item.porVencer) return false;
    if (estado.filtro === 'Stock bajo' && !esStockBajo(item)) return false;
    if (texto && !(item.nombre + ' ' + (item.lote || '')).toLowerCase().includes(texto)) return false;
    return true;
  });
}
