// partes que se repiten en las paginas

// evita que el texto que escribe el usuario se interprete como html
export function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// dias que faltan para vencer (null si no vence)
export function diasParaVencer(item) {
  if (!item.vencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(item.vencimiento + 'T00:00:00');
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

export function porVencer(item) {
  const dias = diasParaVencer(item);
  return dias !== null && dias <= 15;
}

// verde: lejos, naranja: 15 dias o menos, rojo: 3 dias o menos, azul: no vence
export function colorVencimiento(item) {
  const dias = diasParaVencer(item);
  if (dias === null) return 'azul';
  if (dias <= 3) return 'rojo';
  if (dias <= 15) return 'naranja';
  return 'verde';
}

export function textoVencimiento(item) {
  if (!item.vencimiento) return 'Sin vencimiento';
  const [anio, mes, dia] = item.vencimiento.split('-');
  const texto = `${dia}/${mes}/${anio.slice(2)}`;
  return diasParaVencer(item) < 0 ? `Venció ${texto}` : `Vence ${texto}`;
}

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

export function TituloSeccion(codigo, color, titulo, detalle, extra = '') {
  return `
    <div class="titulo-seccion">
      <span class="titulo-seccion-icono ${color}">${codigo}</span>
      <h2>${titulo}</h2>
      <span class="titulo-seccion-detalle">${detalle}</span>
      ${extra}
    </div>
  `;
}

export function SinResultados(texto = 'Sin insumos en este filtro') {
  return `<div class="vacio">${texto}</div>`;
}

// aplica el filtro de las pestañas y lo que se escribio en el buscador
export function filtrarInsumos(lista, estado) {
  const texto = estado.busqueda.toLowerCase();

  return lista.filter(item => {
    if (estado.filtro === 'Por vencer' && !porVencer(item)) return false;
    if (estado.filtro === 'Stock bajo' && item.cantidad >= item.minimo) return false;
    if (texto && !(item.nombre + ' ' + item.descripcion + ' ' + item.lote).toLowerCase().includes(texto)) return false;
    return true;
  });
}
