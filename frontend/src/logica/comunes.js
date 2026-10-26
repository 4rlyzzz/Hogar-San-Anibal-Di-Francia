// funciones que se usan en varias partes (sin pantalla)

// 'Administración' -> 'AD', 'María López' -> 'ML'
// solo letras y numeros
export function iniciales(nombre) {
  const partes = String(nombre ?? '').split(/\s+/).map(p => p.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (partes.length === 0) return '?';
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2);
  return letras.toUpperCase();
}

// nombre visible de cada categoria
export const nombresCategoria = { Alimentos: 'Alimentos', Salud: 'Salud e higiene' };
export const nombreCategoria = categoria => nombresCategoria[categoria] || categoria;

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

// '07 oct 09:05' -> Date (sin año: si queda en el futuro, es del año pasado)
export function fechaDe(texto) {
  const [dia, mes, hora] = texto.split(' ');
  const [h, m] = hora.split(':');
  const hoy = new Date();
  const fecha = new Date(hoy.getFullYear(), meses.indexOf(mes), Number(dia), Number(h), Number(m));
  if (fecha > hoy) fecha.setFullYear(hoy.getFullYear() - 1);
  return fecha;
}

// ---------- productos ----------
// envases: plural -> singular
export const envases = {
  bolsas: 'Bolsa', latas: 'Lata', sacos: 'Saco', cajas: 'Caja', paquetes: 'Paquete', botellas: 'Botella',
  frascos: 'Frasco', sobres: 'Sobre', blísters: 'Blíster', ampollas: 'Ampolla', tubos: 'Tubo',
};

// 'bolsas' -> 'Bolsa'
export function envaseSingular(unidad) {
  return envases[unidad] || unidad.charAt(0).toUpperCase() + unidad.slice(1);
}

// 'Bidón' -> 'bidones'
export function pluralizar(singular) {
  const s = singular.trim().toLowerCase();
  if (/[aeiou]$/.test(s)) return s + 's';
  if (/[áéíóú]n$/.test(s)) return s.slice(0, -2) + s.at(-2).normalize('NFD')[0] + 'nes';
  return s + 'es';
}

// 'Bolsa x 1 kg'; '' si es suelto
export function textoPresentacion(item) {
  if (!item.contenido || !item.medida) return '';
  return `${item.envase || envaseSingular(item.unidad)} x ${item.contenido} ${item.medida}`;
}

// '60 kg en total'; '' si no viene en envases
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

// ---------- nombres de productos con el mismo formato ----------
// 'leche evaporada gloria 1 l' -> 'Leche Evaporada Gloria 1 L'
// las palabras cortas (de, en, con...) van en minuscula, salvo al inicio;
// las medidas quedan como se escriben (g, kg, ml, L) y lo que ya trae mayusculas no se toca (UHT, M)
const conectores = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'en', 'con', 'sin', 'para', 'por', 'a', 'al', 'x']);
const medidasEscritas = { g: 'g', kg: 'kg', mg: 'mg', ml: 'ml', l: 'L', cc: 'cc', oz: 'oz', lb: 'lb', gr: 'g' };

export function formatoNombre(texto) {
  const limpio = String(texto).trim();
  // todo en mayusculas (bloq mayus): las palabras largas se normalizan, las siglas cortas (UHT) quedan
  const todoMayuscula = limpio === limpio.toUpperCase() && /\p{L}{4}/u.test(limpio);
  return limpio.split(/\s+/).map((original, i) => {
    const palabra = todoMayuscula && original.length > 3 ? original.toLowerCase() : original;
    const minuscula = palabra.toLowerCase();
    if (minuscula in medidasEscritas && i > 0) return medidasEscritas[minuscula];
    // solo letras y todo en minuscula: se le pone mayuscula
    if (palabra !== minuscula || !/^\p{L}+$/u.test(palabra)) return palabra;
    if (i > 0 && conectores.has(minuscula)) return minuscula;
    return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
  }).join(' ');
}

// 'Leche Évaporada' -> ['leche', 'evaporada']
export function palabras(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}

// distancia entre dos palabras (letras distintas)
export function distancia(a, b) {
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

// parecidas: empiezan igual o tienen 1 o 2 errores
export function palabraParecida(escrita, otra) {
  if (otra.startsWith(escrita)) return true;
  if (escrita.length < 4) return false;
  return distancia(escrita, otra) <= (escrita.length >= 8 ? 2 : 1);
}

// todas las palabras buscadas estan en el nombre
export function coincideNombre(buscado, nombre) {
  const buscadas = palabras(buscado).filter(p => p.length >= 2);
  if (buscadas.length === 0) return false;
  const delNombre = palabras(nombre);
  return buscadas.every(b => delNombre.some(p => palabraParecida(b, p)));
}

// cuantas palabras comparten dos nombres
export function palabrasEnComun(a, b) {
  const deB = palabras(b);
  return palabras(a).filter(p => p.length >= 4 && deB.some(q => palabraParecida(p, q) || palabraParecida(q, p))).length;
}

// ---------- movimientos ----------
// Ingreso suma, Salida resta, Ajuste corrige tras un conteo
export const motivosAjuste = [
  'Sin identificar',
  'Producto malogrado o vencido',
  'Salida no registrada',
  'Ingreso o donación no registrada',
  'Error al registrar un movimiento',
  'Otro',
];
// motivo de los ajustes que corrigen a otro
export const motivoCorreccion = 'Corrección de un ajuste anterior';

// movimientos del producto entre "viejo" y "nuevo" (null = hasta ahora)
export function movimientosEntre(historial, viejo, nuevo = null) {
  const desde = nuevo ? historial.indexOf(nuevo) + 1 : 0;
  return historial
    .map((fila, indice) => ({ fila, indice }))
    .slice(desde, historial.indexOf(viejo))
    .filter(p => p.fila.insumo === viejo.insumo && p.fila.categoria === viejo.categoria);
}

// cuanto cambio el stock, con signo: +20, -5
export function cambioDe(fila) {
  if (fila.movimiento === 'Ajuste') return fila.diferencia;
  return fila.movimiento === 'Ingreso' ? fila.cantidad : -fila.cantidad;
}

// stock antes del movimiento
// null si no tiene saldo guardado
export function stockAntes(fila) {
  if (fila.saldo == null) return null;
  return Math.round((fila.saldo - cambioDe(fila)) * 100) / 100;
}

// '100 → 95' (sin unidad); '—' si no hay saldo
export function textoStock(fila) {
  return fila.saldo == null ? '—' : `${stockAntes(fila)} → ${fila.saldo}`;
}

// niños de una salida como lista
// los movimientos viejos guardan un solo nombre como texto
export function ninosDe(fila) {
  if (Array.isArray(fila.para)) return fila.para;
  return fila.para ? [fila.para] : [];
}

// ['Mateo', 'Lucía', 'Thiago'] -> 'Mateo, Lucía y Thiago'
export function textoPara(fila) {
  const ninos = ninosDe(fila);
  return ninos.length > 1 ? ninos.slice(0, -1).join(', ') + ' y ' + ninos.at(-1) : ninos.join('');
}

// texto de la columna DETALLE
export function textoDetalle(fila) {
  const extra = [fila.nota, fila.observaciones].filter(Boolean).map(t => ' · ' + t).join('');
  if (fila.movimiento === 'Ajuste') return (fila.motivo || 'Ajuste') + extra;
  if (fila.movimiento === 'Ingreso') {
    if (fila.donador) return fila.donador + (fila.actividad ? ' · ' + fila.actividad : '') + extra;
    return (fila.inicial ? 'Registro inicial' : 'Compra del hogar') + extra;
  }
  if (fila.motivo) return fila.motivo + extra;
  if (ninosDe(fila).length) return 'Para ' + textoPara(fila) + extra;
  const base = fila.categoria === 'Salud' ? 'Uso general' : '';
  return base ? base + extra : extra.slice(3);
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

// vencimiento mas proximo de los lotes con stock
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

// color segun los dias que faltan
export function colorVencimiento(item) {
  const dias = diasParaVencer(item);
  if (dias === null) return 'azul';
  if (dias <= 3) return 'rojo';
  if (dias <= 15) return 'naranja';
  return 'verde';
}

// sin fecha: dias que lleva el lote mas antiguo
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

// filtro rapido y buscador
export function filtrarInsumos(lista, estado) {
  const texto = estado.busqueda.toLowerCase();

  return lista.filter(item => {
    if (estado.filtro === 'Por vencer' && !porVencer(item)) return false;
    if (estado.filtro === 'Stock bajo' && !bajoMinimo(item)) return false;
    if (texto && !(item.nombre + ' ' + textoPresentacion(item)).toLowerCase().includes(texto)) return false;
    return true;
  });
}

// compara ids como texto (en CouchDB los _id son texto)
export function mismoId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

// redondea a 2 decimales
export function redondear(n) {
  return Math.round(n * 100) / 100;
}

export function fechaActual() {
  return textoFecha(new Date());
}
