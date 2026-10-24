// partes que se repiten en las paginas

// evita que el texto que escribe el usuario se interprete como html
export function escapar(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// 'Administración' -> 'AD', 'María López' -> 'ML'
export function iniciales(nombre) {
  const partes = nombre.trim().split(/\s+/);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : nombre.slice(0, 2);
  return letras.toUpperCase();
}

// nombre que se muestra de cada categoria; en los datos se guarda la clave corta
export const nombresCategoria = { Alimentos: 'Alimentos', Salud: 'Salud e higiene' };
export const nombreCategoria = categoria => nombresCategoria[categoria] || categoria;

// titulo de columna que ordena al hacer clic; la flecha muestra el orden actual
// grupo: donde se guarda el orden en el estado ('usuarios', 'alertasOrden')
export function TituloOrden(texto, orden, filtros, grupo) {
  const activo = filtros.orden === orden;
  const flecha = activo ? (filtros.invertido ? '↑' : '↓') : '';
  return `<button class="titulo-orden ${activo ? 'activo' : ''}" data-accion="ordenar" data-grupo="${grupo}" data-orden="${orden}">${texto} ${flecha}</button>`;
}

export const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

// Date -> '07 oct 09:05' (asi se guarda en el historial)
export function textoFecha(d) {
  const dos = n => String(n).padStart(2, '0');
  return `${dos(d.getDate())} ${meses[d.getMonth()]} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

// Date -> '01 ago 2026'
export function fechaLarga(d) {
  return `${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Date -> 'hace 5 min', 'hace 3 h', 'ayer', 'hace 9 días'
export function tiempoRelativo(d) {
  const minutos = Math.round((Date.now() - d) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  return fechaLarga(d);
}

// '07 oct 09:05' -> Date. no trae año: si quedaria en el futuro es del año pasado
export function fechaDe(texto) {
  const [dia, mes, hora] = texto.split(' ');
  const [h, m] = hora.split(':');
  const hoy = new Date();
  const fecha = new Date(hoy.getFullYear(), meses.indexOf(mes), Number(dia), Number(h), Number(m));
  if (fecha > hoy) fecha.setFullYear(hoy.getFullYear() - 1);
  return fecha;
}

// ---------- productos ----------
// envases: se guarda el plural (es en lo que se cuenta: "12 bolsas") y se muestra el singular ("Bolsa x 1 kg")
export const envases = {
  bolsas: 'Bolsa', latas: 'Lata', sacos: 'Saco', cajas: 'Caja', paquetes: 'Paquete', botellas: 'Botella',
  frascos: 'Frasco', sobres: 'Sobre', blísters: 'Blíster', ampollas: 'Ampolla', tubos: 'Tubo',
};

// 'bolsas' -> 'Bolsa'; los envases escritos a mano ('bidones') se muestran tal cual con mayuscula
export function envaseSingular(unidad) {
  return envases[unidad] || unidad.charAt(0).toUpperCase() + unidad.slice(1);
}

// 'Bidón' -> 'bidones', 'Galonera' -> 'galoneras' (para un envase nuevo escrito a mano)
export function pluralizar(singular) {
  const s = singular.trim().toLowerCase();
  if (/[aeiou]$/.test(s)) return s + 's';
  if (/[áéíóú]n$/.test(s)) return s.slice(0, -2) + s.at(-2).normalize('NFD')[0] + 'nes';
  return s + 'es';
}

// presentacion como en la etiqueta: 'Bolsa x 1 kg', 'Caja x 10 tabletas'; '' si es suelto (se cuenta en kg, L...)
// item.envase: el singular tal como se escribio (para envases que no estan en la lista, ej. 'Bidón')
export function textoPresentacion(item) {
  if (!item.contenido || !item.medida) return '';
  return `${item.envase || envaseSingular(item.unidad)} x ${item.contenido} ${item.medida}`;
}

// cuanto suma todo lo que hay: '60 kg en total', '60 cápsulas en total'; '' si no viene en envases
export function textoTotal(item) {
  if (!item.contenido || !item.medida) return '';
  let total = item.cantidad * item.contenido;
  let medida = item.medida;
  // 38400 g se lee mejor como 38.4 kg
  if ((medida === 'g' || medida === 'ml') && total >= 1000) {
    total /= 1000;
    medida = medida === 'g' ? 'kg' : 'L';
  }
  return `${Math.round(total * 100) / 100} ${medida} en total`;
}

// 'Leche Évaporada' -> ['leche', 'evaporada']: sin tildes, mayusculas ni signos
export function palabras(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}

// cuantas letras hay que cambiar, agregar o quitar para pasar de una palabra a otra
function distancia(a, b) {
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = arriba;
    }
  }
  return fila[b.length];
}

// 'lentjas' se parece a 'lentejas': empieza igual o tiene 1 error (2 si la palabra es larga)
function palabraParecida(escrita, otra) {
  if (otra.startsWith(escrita)) return true;
  if (escrita.length < 4) return false;
  return distancia(escrita, otra) <= (escrita.length >= 8 ? 2 : 1);
}

// al buscar: todas las palabras escritas estan en el nombre (en cualquier orden, con algun error de tipeo)
export function coincideNombre(buscado, nombre) {
  const buscadas = palabras(buscado).filter(p => p.length >= 2);
  if (buscadas.length === 0) return false;
  const delNombre = palabras(nombre);
  return buscadas.every(b => delNombre.some(p => palabraParecida(b, p)));
}

// al unir: cuantas palabras importantes comparten dos nombres (0 = nada que ver, como Lentejas y Manzana)
export function palabrasEnComun(a, b) {
  const deB = palabras(b);
  return palabras(a).filter(p => p.length >= 4 && deB.some(q => palabraParecida(p, q) || palabraParecida(q, p))).length;
}

// ---------- movimientos ----------
// tipos: Ingreso suma, Salida resta, Ajuste corrige el stock tras un conteo (puede sumar o restar)
// todo ajuste viene de un conteo fisico; el motivo dice por que no coincidia con el sistema
export const motivosAjuste = [
  'Sin identificar',
  'Producto malogrado o vencido',
  'Salida no registrada',
  'Ingreso o donación no registrada',
  'Error al registrar un movimiento',
  'Otro',
];
// motivo fijo de los ajustes que corrigen a otro (no esta en la lista de arriba)
export const motivoCorreccion = 'Corrección de un ajuste anterior';

// movimientos del mismo producto que hubo despues de "viejo" y antes de "nuevo" (null = hasta ahora)
// el historial va del mas nuevo al mas antiguo; devuelve [{ fila, indice }]
export function movimientosEntre(historial, viejo, nuevo = null) {
  const desde = nuevo ? historial.indexOf(nuevo) + 1 : 0;
  return historial
    .map((fila, indice) => ({ fila, indice }))
    .slice(desde, historial.indexOf(viejo))
    .filter(p => p.fila.insumo === viejo.insumo && p.fila.categoria === viejo.categoria);
}

// esos movimientos en lista, con lo que sumaron en total
// navegable: cada fila abre su detalle (en el panel); en un modal se muestran fijas
export function MovimientosEntre(pasos, unidad, navegable = false) {
  if (pasos.length === 0) return '<p class="correccion-vacio">No hubo ingresos, salidas ni ajustes en medio.</p>';

  const total = Math.round(pasos.reduce((suma, p) => suma + cambioDe(p.fila), 0) * 100) / 100;
  const clase = { Ingreso: 'ingreso', Salida: 'salida', Ajuste: 'ajuste' };
  const etiqueta = navegable ? 'button' : 'div';

  return `
    <ul class="mov-pasos correccion-lista">
      ${pasos.map(p => `
        <li>
          <${etiqueta} class="mov-paso ${clase[p.fila.movimiento]}" ${navegable ? `data-accion="ver-movimiento" data-indice="${p.indice}"` : ''}>
            <span class="mov-paso-fecha">${p.fila.fecha}</span>
            <span class="mov-paso-tipo">● ${p.fila.movimiento} <small>${escapar(p.fila.responsable)}</small></span>
            <span class="mov-paso-cambio">${escapar(textoCambio(p.fila))}</span>
          </${etiqueta}>
        </li>
      `).join('')}
    </ul>
    <p class="correccion-total">En total: ${total > 0 ? '+' : total < 0 ? '−' : ''}${Math.abs(total)} ${escapar(unidad)}</p>`;
}

// cuanto cambio el stock, con signo: +20, -5
export function cambioDe(fila) {
  if (fila.movimiento === 'Ajuste') return fila.diferencia;
  return fila.movimiento === 'Ingreso' ? fila.cantidad : -fila.cantidad;
}

// cuanto habia antes del movimiento: lo que quedo menos lo que cambio
// null si el movimiento es de antes de que se guardara el saldo
export function stockAntes(fila) {
  if (fila.saldo == null) return null;
  return Math.round((fila.saldo - cambioDe(fila)) * 100) / 100;
}

// '100 → 95' (sin unidad); '—' si no hay saldo
export function textoStock(fila) {
  return fila.saldo == null ? '—' : `${stockAntes(fila)} → ${fila.saldo}`;
}

// lo importante de cada movimiento segun su tipo: de donde vino, a quien fue o por que cambio
export function textoDetalle(fila) {
  const nota = fila.nota ? ' · ' + fila.nota : '';
  if (fila.movimiento === 'Ajuste') return (fila.motivo || 'Ajuste') + nota;
  if (fila.movimiento === 'Ingreso') {
    if (fila.donador) return fila.donador + (fila.actividad ? ' · ' + fila.actividad : '') + nota;
    return fila.inicial ? 'Registro inicial' : 'Compra del hogar';
  }
  if (fila.motivo) return fila.motivo + nota;
  if (fila.para) return 'Para ' + fila.para;
  return fila.categoria === 'Salud' ? 'Uso general' : '';
}

// '+20 kg', '−5 kg' (con el signo menos tipografico)
export function textoCambio(fila) {
  const cambio = cambioDe(fila);
  return `${cambio >= 0 ? '+' : '−'}${Math.abs(cambio)} ${fila.unidad}`;
}

// '2026-11-05' -> dias que faltan desde hoy (negativo si ya paso)
export function diasHasta(iso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(iso + 'T00:00:00');
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

// el vencimiento mas proximo entre los lotes que tienen stock (lo ya vencido tambien cuenta)
// null si ningun lote tiene fecha; los productos sin lotes (docs viejos) usan su campo vencimiento
export function vencimientoDe(item) {
  if (!item.lotes) return item.vencimiento ?? null;
  const fechas = item.lotes.filter(l => l.quedan > 0 && l.vence).map(l => l.vence).sort();
  return fechas[0] ?? null;
}

// cuanto stock esta en lotes ya vencidos
export function cantidadVencida(item) {
  const vencida = (item.lotes || [])
    .filter(l => l.quedan > 0 && l.vence && diasHasta(l.vence) < 0)
    .reduce((suma, l) => suma + l.quedan, 0);
  return Math.round(vencida * 100) / 100;
}

// lo que se puede usar: el stock menos lo vencido
export function disponible(item) {
  return Math.round((item.cantidad - cantidadVencida(item)) * 100) / 100;
}

// stock bajo: lo que se puede usar no llega al minimo
export function bajoMinimo(item) {
  return disponible(item) < item.minimo;
}

// dias que faltan para vencer (null si no vence)
export function diasParaVencer(item) {
  const vence = vencimientoDe(item);
  return vence ? diasHasta(vence) : null;
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

// sin fecha: cuantos dias lleva el lote mas antiguo, para que quien revisa decida si sigue bien
export function textoVencimiento(item) {
  const vence = vencimientoDe(item);
  if (!vence) {
    const antiguo = (item.lotes || []).filter(l => l.quedan > 0).sort((a, b) => a.ingreso - b.ingreso)[0];
    if (!antiguo) return 'Sin vencimiento';
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const desde = new Date(antiguo.ingreso);
    desde.setHours(0, 0, 0, 0);
    const dias = Math.round((hoy - desde) / (1000 * 60 * 60 * 24));
    if (dias === 0) return 'Sin fecha · ingresó hoy';
    return `Sin fecha · ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  const [anio, mes, dia] = vence.split('-');
  const texto = `${dia}/${mes}/${anio.slice(2)}`;
  return diasHasta(vence) < 0 ? `Venció ${texto}` : `Vence ${texto}`;
}

// conteos: cuantos hay en cada filtro, ej. { 'Por vencer': 3 } (se muestra dentro del boton)
// extra: lo que va al lado de los filtros (ej. el boton "Filtros")
export function Encabezado(titulo, subtitulo = '', filtroActivo, conteos = {}, extra = '') {
  let filtros = '';
  if (filtroActivo) {
    filtros = `
      <div class="filtros">
        ${['Todos', 'Por vencer', 'Stock bajo'].map(f => `
          <button class="${f === filtroActivo ? 'activo' : ''}" data-accion="filtro" data-filtro="${f}">
            ${f}${conteos[f] ? ` <span class="filtro-numero">${conteos[f]}</span>` : ''}
          </button>
        `).join('')}
      </div>`;
  }

  return `
    <div class="encabezado">
      <div>
        <h1>${titulo}</h1>
        ${subtitulo ? `<p>${subtitulo}</p>` : ''}
      </div>
      ${extra ? `<div class="encabezado-derecha">${filtros}${extra}</div>` : filtros}
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

// recuadro de resumen (Inicio, Usuarios); unidad: [singular, plural]
export function Recuadro(color, icono, numero, titulo, detalle, unidad = ['producto', 'productos']) {
  return `
    <div class="recuadro">
      <div class="recuadro-cabecera">
        <div class="recuadro-icono ${color}">${icono}</div>
        <span class="recuadro-titulo">${titulo}</span>
      </div>
      <div class="recuadro-fila">
        <b class="recuadro-numero">${numero}</b>
        <span class="recuadro-unidad">${numero === 1 ? unidad[0] : unidad[1]}</span>
        <span class="recuadro-detalle texto-${color}">${detalle}</span>
      </div>
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
    if (estado.filtro === 'Stock bajo' && !bajoMinimo(item)) return false;
    if (texto && !(item.nombre + ' ' + textoPresentacion(item)).toLowerCase().includes(texto)) return false;
    return true;
  });
}
