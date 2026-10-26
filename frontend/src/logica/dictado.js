// convierte lo que se dijo ("dos kilos de arroz y tres latas de leche") en productos con su cantidad
// tambien reconoce quien dono, la actividad y el tamaño ("leche de un litro")
// no usa el DOM ni el estado: recibe el texto, los productos y los donadores
import { palabras, palabraParecida, distancia } from './comunes.js';

// ---------- numeros dichos con palabras ----------
const unidades = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const decenas = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const centenas = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

const esNumeroPalabra = t => t in unidades || t in decenas || t in centenas || t === 'mil';

// numero que empieza en tokens[i]: { valor, fin } o null
function leerNumero(tokens, i) {
  if (/^\d+(\.\d+)?$/.test(tokens[i])) return { valor: Number(tokens[i]), fin: i + 1 };
  if (tokens[i] === 'medio' || tokens[i] === 'media') return { valor: 0.5, fin: i + 1 };

  let total = 0;
  let actual = 0;
  let j = i;
  let usado = false;
  while (j < tokens.length) {
    const t = tokens[j];
    if (t in unidades) actual += unidades[t];
    else if (t in decenas) actual += decenas[t];
    else if (t in centenas) actual += centenas[t];
    else if (t === 'mil') {
      total += (actual || 1) * 1000;
      actual = 0;
    } else if (t === 'y' && usado && tokens[j + 1] in unidades && tokens[j - 1] in decenas) {
      // "treinta y dos"
    } else break;
    usado = true;
    j++;
  }
  return usado ? { valor: total + actual, fin: j } : null;
}

// ---------- unidades dichas ----------
const unidadesDichas = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', kilogramo: 'kg', kilogramos: 'kg', k: 'kg',
  gramo: 'g', gramos: 'g', g: 'g', gr: 'g', grs: 'g',
  litro: 'L', litros: 'L', l: 'L', lt: 'L', lts: 'L',
  mililitro: 'ml', mililitros: 'ml', ml: 'ml',
  lata: 'latas', latas: 'latas', bolsa: 'bolsas', bolsas: 'bolsas', saco: 'sacos', sacos: 'sacos',
  caja: 'cajas', cajas: 'cajas', paquete: 'paquetes', paquetes: 'paquetes', botella: 'botellas', botellas: 'botellas',
  frasco: 'frascos', frascos: 'frascos', sobre: 'sobres', sobres: 'sobres', blister: 'blísters', blisters: 'blísters',
  ampolla: 'ampollas', ampollas: 'ampollas', tubo: 'tubos', tubos: 'tubos', unidad: 'unidades', unidades: 'unidades',
};
const docenas = { docena: 12, docenas: 12 };


const medidas = new Set(['kg', 'g', 'L', 'ml']);

// ---------- fecha de vencimiento dicha ----------
const meses = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const avisosFecha = new Set(['vence', 'vencen', 'vencimiento', 'caduca', 'caducan', 'expira', 'expiran', 'fecha']);
const dos = n => String(n).padStart(2, '0');

// { inicio, fin, iso } de "vence el 15 de octubre de 2026", "octubre del 2026" o "vence 15 10 2026"; null si no hay
// sin dia: el ultimo del mes (asi se lee "vence 10/2026"); sin año: el proximo octubre que venga
export function buscarFecha(tokens, hoy = new Date()) {
  let inicio;
  let fin;
  let dia = null;
  let mes = null;
  let anio = null;
  const m = tokens.findIndex(t => t in meses);
  if (m >= 0) {
    mes = meses[tokens[m]];
    inicio = m;
    fin = m + 1;
    // el dia antes: "15 de octubre"
    let k = m - 1;
    if (tokens[k] === 'de') k--;
    const d = k >= 0 ? leerNumero(tokens, k) : null;
    if (d && d.fin === (tokens[m - 1] === 'de' ? m - 1 : m) && d.valor >= 1 && d.valor <= 31) {
      dia = d.valor;
      inicio = k;
    }
    // el año despues: "de 2026", "del dos mil veintiseis"
    let j = fin;
    if (tokens[j] === 'de' || tokens[j] === 'del') j++;
    const a = leerNumero(tokens, j);
    if (a && a.valor >= 2000 && a.valor <= 2100) {
      anio = a.valor;
      fin = a.fin;
    }
  } else {
    // "vence 15 10 2026"
    const v = tokens.findIndex(t => avisosFecha.has(t));
    if (v < 0) return null;
    let k = v + 1;
    if (tokens[k] === 'el') k++;
    const [d, mm, a] = [tokens[k], tokens[k + 1], tokens[k + 2]].map(Number);
    if (!(d >= 1 && d <= 31 && mm >= 1 && mm <= 12 && a >= 2000 && a <= 2100)) return null;
    [dia, mes, anio, inicio, fin] = [d, mm, a, v, k + 3];
  }
  // tambien "se vence el", "fecha de vencimiento"
  while (inicio > 0 && (avisosFecha.has(tokens[inicio - 1]) || ['el', 'de', 'se', 'la', 'en', 'para'].includes(tokens[inicio - 1]))) inicio--;
  if (!anio) anio = mes < hoy.getMonth() + 1 ? hoy.getFullYear() + 1 : hoy.getFullYear();
  if (!dia) dia = new Date(anio, mes, 0).getDate();
  return { inicio, fin, iso: `${anio}-${dos(mes)}-${dos(dia)}` };
}

// pasar de una medida a otra
const factores = { kg: { g: 1000 }, g: { kg: 0.001 }, L: { ml: 1000 }, ml: { L: 0.001 } };

function convertir(valor, de, a) {
  if (de === a) return valor;
  return factores[de]?.[a] != null ? valor * factores[de][a] : null;
}

const redondear = n => Math.round(n * 100) / 100;

// palabras que no ayudan a saber el producto
const relleno = new Set([
  'de', 'del', 'el', 'la', 'los', 'las', 'con', 'para', 'y', 'e', 'mas', 'otro', 'otra', 'otros', 'otras', 'tambien', 'ademas',
  'llego', 'llegaron', 'entra', 'entran', 'entraron', 'ingresa', 'ingresan', 'ingreso', 'sale', 'salen', 'salio', 'salieron', 'salida',
  'sacamos', 'saca', 'sacar', 'agrega', 'agregar', 'anota', 'anotar', 'registra', 'registrar', 'pon', 'poner', 'hay', 'son', 'es',
  'que', 'se', 'por', 'favor', 'porfa', 'porfavor', 'ok', 'bueno', 'ya', 'eh', 'este', 'esta', 'esto', 'eso', 'todo', 'todos', 'nada',
  'me', 'nos', 'te', 'le', 'les', 'lo', 'estan', 'esta', 'entrando', 'llegando', 'donando', 'donan', 'dona', 'donacion', 'donaciones',
  'recibimos', 'recibi', 'tenemos', 'tengo', 'aqui', 'hoy', 'vino', 'vinieron', 'traen', 'trae', 'cada', 'en', 'a', 'al',
  'vence', 'vencen', 'vencimiento', 'caduca', 'caducan', 'expira', 'expiran', 'fecha',
]);

// ---------- separar lo dicho ----------
// minusculas sin tildes, del mismo largo que el original (para cortar el original en el mismo lugar)
function plano(texto) {
  return texto.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
}

const nombresDecenas = Object.keys(decenas).join('|');
const nombresUnidades = Object.keys(unidades).join('|');
// comas, puntos, "y", "ademas", "tambien", "luego", "despues"
// "y" no corta en "treinta y dos" ni en "kilo y medio"
const separador = new RegExp(
  `\\s*(?:[,;]|\\.(?!\\d)|\\b(?:ademas|tambien|luego|despues|aparte)\\b|(?<!\\b(?:${nombresDecenas}))\\s+y\\s+(?!(?:medio|media)\\b)|\\s+y\\s+(?!(?:${nombresUnidades}|medio|media)\\b))\\s*`,
  'g',
);

// ---------- numeros que son parte de un nombre ----------
// el 3 de "Avena 3 Ositos" o el 120 de "Paracetamol Jarabe 120 mg/5 ml" no son cantidades,
// pero solo cuando van junto a las palabras de ese nombre: "5 lentejas" si es una cantidad
function numerosEnNombres(productos) {
  const vecinos = new Map();
  for (const { item } of productos) {
    const suyas = palabras(item.nombre);
    suyas.forEach((p, k) => {
      if (!/^\d/.test(p)) return;
      if (!vecinos.has(p)) vecinos.set(p, new Set());
      for (const v of [suyas[k - 1], suyas[k + 1]]) if (v) vecinos.get(p).add(v);
    });
  }
  return vecinos;
}

function esDeNombre(vecinos, tokens, i, fin) {
  const suyos = vecinos.get(tokens[i]);
  if (!suyos) return false;
  return [tokens[i - 1], tokens[fin]].some(t => t && [...suyos].some(v => palabraCoincide(t, v)));
}

// sin comas ("10 pollos de un kilo 10 bolsas de lentejas"): una cantidad nueva despues de un producto empieza otro
// es cantidad un numero con envase ("10 bolsas", "una docena") o con medida que no va tras "de" ("2 kilos")
export function dividirPorCantidades(parte, productos = []) {
  const vecinos = numerosEnNombres(productos);
  const trozos = [...plano(parte).matchAll(/[a-z0-9ñ.]+/g)];
  const tokens = trozos.map(m => m[0]);
  // la fecha ("vence el 15 de octubre de 2026") no corta
  const fecha = buscarFecha(tokens);
  const cortes = [];
  // lo que ya tiene la parte actual: producto, cantidad, y si la cantidad vino despues ("arroz 10 kilos")
  let producto = false;
  let cantidad = false;
  let despues = false;
  const cortar = i => {
    cortes.push(trozos[i].index);
    producto = false;
    cantidad = false;
    despues = false;
  };
  for (let i = 0; i < tokens.length;) {
    if (fecha && i >= fecha.inicio && i < fecha.fin) {
      i = fecha.fin;
      continue;
    }
    const anterior = tokens[i - 1];
    const n = leerNumero(tokens, i);
    if (!n) {
      if (!relleno.has(tokens[i]) && !(tokens[i] in unidadesDichas)) {
        // "arroz 10 kilos leche...": ya estaba completo, la palabra nueva es otro producto
        if (producto && cantidad && despues) cortar(i);
        producto = true;
      }
      i++;
      continue;
    }
    const unidad = unidadesDichas[tokens[n.fin]];
    // "y medio", "cada una" y "de un litro" (tamaño) siguen con lo anterior
    // tambien "de 150" (un tamaño dicho sin la unidad)
    const sigue = ((tokens[i] === 'medio' || tokens[i] === 'media') && anterior === 'y') || anterior === 'cada'
      || (anterior === 'de' && (!unidad || medidas.has(unidad)) && !(tokens[n.fin] in docenas));
    const conUnidad = Boolean(unidad) || tokens[n.fin] in docenas;
    // un numero sin unidad despues del nombre es parte del nombre ("avena 3 ositos"),
    // salvo que ese producto ya tenga su cantidad: "10 latas de leche 10 pollos"
    const otraCantidad = producto && cantidad && !esDeNombre(vecinos, tokens, i, n.fin);
    if (!sigue && (conUnidad || !producto || otraCantidad)) {
      if (cantidad) cortar(i);
      cantidad = true;
      despues = producto;
    }
    i = n.fin;
  }
  if (cortes.length === 0) return [parte];
  const partes = [];
  let desde = 0;
  for (const corte of cortes) {
    partes.push(parte.slice(desde, corte));
    desde = corte;
  }
  partes.push(parte.slice(desde));
  // "...de un kilo de" -> "...de un kilo"
  return partes.map(p => p.trim().replace(/\s+(?:de|y|e)$/i, '')).filter(Boolean);
}

// partes del texto original, una por producto
export function separarDictado(texto) {
  const original = String(texto ?? '').replace(/\s+/g, ' ').trim();
  // "2,5 kilos" es un decimal, no dos productos
  const sinComaDecimal = original.replace(/(\d),(\d)/g, '$1.$2');
  const guia = plano(sinComaDecimal);
  const partes = [];
  let desde = 0;
  for (const corte of guia.matchAll(separador)) {
    partes.push(sinComaDecimal.slice(desde, corte.index));
    desde = corte.index + corte[0].length;
  }
  partes.push(sinComaDecimal.slice(desde));
  // ", y además" deja una "y" suelta
  return partes.map(p => p.trim().replace(/^(?:y|e)(?:\s+|$)/i, '')).filter(Boolean);
}

// ---------- parecido entre palabras ----------
const singular = p => (p.length > 4 && p.endsWith('es') ? p.slice(0, -2) : p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p);

function palabraCoincide(dicha, delNombre) {
  if (dicha === delNombre || singular(dicha) === singular(delNombre)) return true;
  return dicha.length >= 3 && palabraParecida(dicha, delNombre);
}

// que tanto se parece lo dicho al nombre (0 = nada)
function puntaje(dichas, nombre) {
  const delNombre = palabras(nombre);
  const aciertos = dichas.filter(d => delNombre.some(p => palabraCoincide(d, p))).length;
  if (aciertos === 0) return 0;
  return aciertos / dichas.length + (aciertos / delNombre.length) * 0.5;
}

// ---------- buscar el producto ----------
// tamano: { valor, medida } dicho ("de un litro"); ayuda a elegir la presentacion
function tieneTamano(item, tamano) {
  const base = item.medida && item.contenido ? { valor: item.contenido, medida: item.medida } : null;
  if (!base) return false;
  const enSuMedida = convertir(tamano.valor, tamano.medida, base.medida);
  return enSuMedida != null && Math.abs(enSuMedida - base.valor) < 0.001;
}

// productos: [{ item, categoria }]
// devuelve { producto, dudas, otroTamano } (dudas: los que empatan; otroTamano: no hay de ese tamano)
export function buscarProducto(dichas, productos, tamano = null) {
  const nada = { producto: null, dudas: [], otroTamano: false };
  if (dichas.length === 0) return nada;
  let candidatos = productos
    .map(p => ({ ...p, puntos: puntaje(dichas, p.item.nombre) }))
    .filter(p => p.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);
  if (candidatos.length === 0) return nada;

  let otroTamano = false;
  if (tamano) {
    const delTamano = candidatos.filter(p => tieneTamano(p.item, tamano));
    if (delTamano.length) candidatos = delTamano;
    else otroTamano = true;
  }

  const empatan = candidatos.filter(p => p.puntos === candidatos[0].puntos);
  // ningun tamaño coincide ("leche en bolsas de 10 L"): no es cual de los dos, es una presentacion que no esta registrada
  if (empatan.length > 1 && !otroTamano) return { producto: null, dudas: empatan.map(({ item, categoria }) => ({ item, categoria })), otroTamano };
  const { item, categoria } = candidatos[0];
  return { producto: { item, categoria }, dudas: [], otroTamano };
}

// ---------- donador y actividad ----------
// "que me lo donó la parroquia", "donado por Plaza Vea", "de parte de la familia Quispe"
const avisosDonador = [['donado', 'por'], ['donada', 'por'], ['donados', 'por'], ['donadas', 'por'], ['de', 'parte', 'de'], ['dono'], ['donaron'], ['trajo'], ['trajeron'], ['regalaron'], ['enviaron'], ['envio']];

function buscarAviso(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    // la primera palabra puede venir mal escrita ("danadas por")
    const aviso = avisosDonador.find(a => a.every((t, k) => tokens[i + k] === t || (k === 0 && t.length >= 5 && tokens[i + k] && palabraCoincide(tokens[i + k], t))));
    if (aviso) return { inicio: i, fin: i + aviso.length };
  }
  return null;
}

// donadores: [{ id, nombre }]; devuelve el que mas se parece o null
function buscarDonador(dichas, donadores) {
  const conPuntaje = donadores.map(d => ({ d, puntos: puntaje(dichas, d.nombre) })).filter(x => x.puntos >= 0.5).sort((a, b) => b.puntos - a.puntos);
  if (conPuntaje.length === 0) return null;
  if (conPuntaje.length > 1 && conPuntaje[1].puntos === conPuntaje[0].puntos) return null;
  return conPuntaje[0].d;
}

// palabras que estan en varias actividades o se dicen siempre: solas no dicen cual es
const generales = new Set(['donacion', 'dia', 'campana', 'hogar', 'del']);

// la actividad cuyas palabras se dijeron todas ("donacion libre"),
// o al menos una que sea solo suya ("para el aniversario")
function buscarActividad(tokens, actividades) {
  const palabrasDe = actividades.map(a => palabras(a).filter(p => p.length >= 3 && p !== 'del'));
  let mejor = null;
  actividades.forEach((actividad, i) => {
    const suyas = palabrasDe[i];
    const posiciones = suyas.map(p => tokens.findIndex(t => palabraCoincide(t, p)));
    const todas = suyas.length && posiciones.every(k => k >= 0);
    const propias = suyas.filter((p, j) => posiciones[j] >= 0 && !generales.has(p) && palabrasDe.filter(otras => otras.includes(p)).length === 1);
    const puntos = todas ? 2 : propias.length ? 1 : 0;
    if (puntos > (mejor?.puntos ?? 0)) mejor = { actividad, puntos, posiciones: posiciones.filter(k => k >= 0) };
  });
  return mejor;
}

// ---------- una parte: cantidad, unidad, tamaño, producto y donador ----------
// extra: { donadores, actividades } para reconocer quien dono
export function interpretarParte(parte, productos, { donadores = [], actividades = [] } = {}) {
  // las mismas palabras normalizadas y como se escribieron (plano no cambia el largo)
  const trozos = [...plano(parte).replace(/[^a-z0-9ñ.\s]/g, ' ').matchAll(/\S+/g)];
  const tokens = trozos.map(m => m[0]);
  const originales = trozos.map(m => parte.slice(m.index, m.index + m[0].length));
  const usados = new Set();

  // "cada una" no es una cantidad
  tokens.forEach((t, k) => {
    if (t === 'cada') usados.add(k).add(k + 1);
  });

  // actividad
  const act = buscarActividad(tokens, actividades);
  if (act) act.posiciones.forEach(k => usados.add(k));

  // donador: desde el aviso hasta el final
  let donador = null;
  let donadorDicho = '';
  const aviso = buscarAviso(tokens);
  if (aviso) {
    const resto = [];
    let desde = -1;
    for (let k = aviso.inicio; k < tokens.length; k++) {
      if (!usados.has(k) && k >= aviso.fin && !relleno.has(tokens[k])) {
        resto.push(tokens[k]);
        if (desde < 0) desde = k;
      }
      usados.add(k);
    }
    donador = buscarDonador(resto, donadores);
    // como se dijo, para proponerlo como donador nuevo
    if (!donador && resto.length) donadorDicho = originales.slice(desde).join(' ');
  }

  // fecha de vencimiento dicha ("vence el 15 de octubre de 2026"): sus palabras no son producto ni cantidad
  const fecha = buscarFecha(tokens);
  if (fecha) for (let k = fecha.inicio; k < fecha.fin; k++) usados.add(k);

  // numeros; los que son parte de un nombre ("3 Ositos") no son cantidad
  const vecinos = numerosEnNombres(productos);
  const primeroUtil = tokens.findIndex((t, k) => !usados.has(k) && !relleno.has(t));
  const numeros = [];
  for (let i = 0; i < tokens.length;) {
    const n = usados.has(i) ? null : leerNumero(tokens, i);
    if (n) {
      const siguiente = tokens[n.fin];
      numeros.push({
        ...n,
        inicio: i,
        unidad: unidadesDichas[siguiente] ?? null,
        docena: siguiente in docenas,
        deNombre: esDeNombre(vecinos, tokens, i, n.fin) && !(siguiente in unidadesDichas),
      });
      i = n.fin;
    } else i++;
  }
  // "de un litro", "de 400 gramos": despues de "de" una medida es el tamaño, no cuanto entra
  const esTamano = n => n.unidad && medidas.has(n.unidad) && tokens[n.inicio - 1] === 'de';
  const utiles = numeros.filter(n => !n.deNombre && !esTamano(n));
  // "3 latas de leche 400 gramos": una medida despues de un envase es el tamaño
  // ("10 kg de avena en 10 bolsas" no: ahi los kg van primero y son la cantidad)
  const envase = utiles.find(n => n.unidad && !medidas.has(n.unidad));
  const delTamano = numeros.find(esTamano)
    ?? (envase ? utiles.find(n => n.unidad && medidas.has(n.unidad) && n.inicio > envase.inicio) : null);
  const tamano = delTamano ? { valor: delTamano.valor, medida: delTamano.unidad } : null;

  // primero el producto: con las palabras que no son numeros ni unidades
  const deNumeros = new Set();
  for (const n of numeros) if (!n.deNombre) for (let k = n.inicio; k < n.fin; k++) deNumeros.add(k);
  const deProducto = tokens.map((t, k) => k).filter(k => {
    const t = tokens[k];
    return !usados.has(k) && !deNumeros.has(k) && !relleno.has(t) && !(t in unidadesDichas) && !(t in docenas) && !esNumeroPalabra(t) && t !== 'medio' && t !== 'media';
  });
  const dichas = deProducto.map(k => tokens[k]);
  const { producto, dudas } = buscarProducto(dichas, productos, tamano);
  const item = producto?.item;

  // despues la cantidad: la que esta en la unidad del producto ("10 kg de avena en 10 bolsas" son 10 kg)
  const enSuUnidad = n => item && n.unidad && (n.unidad === item.unidad || convertir(1, n.unidad, item.unidad) != null
    || (item.medida && item.contenido && convertir(1, n.unidad, item.medida) != null));
  const elegido = utiles.find(n => n !== delTamano && enSuUnidad(n))
    ?? utiles.find(n => n !== delTamano && n.docena)
    ?? utiles.find(n => n !== delTamano && !n.unidad && n.inicio === primeroUtil)
    ?? utiles.find(n => n !== delTamano && n.unidad && !medidas.has(n.unidad))
    ?? utiles.find(n => n !== delTamano && n.unidad)
    ?? utiles.find(n => n !== delTamano);

  let cantidad = null;
  let unidadDicha = null;
  if (elegido) {
    cantidad = elegido.valor;
    let k = elegido.fin;
    if (tokens[k] in docenas) {
      cantidad *= docenas[tokens[k]];
      k++;
      if (tokens[k] === 'de') k++;
    }
    if (tokens[k] in unidadesDichas) unidadDicha = unidadesDichas[tokens[k++]];
    // "un kilo y medio"
    if (tokens[k] === 'y' && (tokens[k + 1] === 'medio' || tokens[k + 1] === 'media')) cantidad += 0.5;
  }

  // ¿asi esta registrado? si no, no se adivina ni se multiplica: se avisa "no está registrada en bolsas de 10 L"
  let presentacion = null;
  if (item) {
    const unidadOk = !unidadDicha || enSuUnidad({ unidad: unidadDicha });
    const tamanoOk = !tamano || tieneTamano(item, tamano);
    if (unidadOk && tamanoOk && unidadDicha && cantidad != null) {
      // "5 kilos de lentejas" con bolsas de 1 kg -> 5 bolsas; "500 gramos de avena" -> 0,5 kg
      const directa = convertir(cantidad, unidadDicha, item.unidad);
      if (directa != null) cantidad = directa;
      else if (item.medida && item.contenido) cantidad = convertir(cantidad, unidadDicha, item.medida) / item.contenido;
    }
    if (!unidadOk || !tamanoOk) {
      const tamanoTexto = tamano ? `${redondear(tamano.valor)} ${tamano.medida}` : '';
      presentacion = {
        unidad: unidadOk ? null : unidadDicha,
        tamano: tamanoOk ? null : tamano,
        texto: [unidadOk ? '' : unidadDicha, tamanoOk ? '' : `de ${tamanoTexto}`].filter(Boolean).join(' '),
      };
    }
  }
  if (cantidad != null) cantidad = redondear(cantidad);

  return {
    dicho: parte,
    producto,
    dudas,
    cantidad,
    // en que unidad se dijo la cantidad (para mostrarla tal cual si la presentacion no esta registrada)
    unidadDicha,
    // la presentacion dicha que no esta registrada: { unidad, tamano, texto: 'bolsas de 10 L' } o null
    presentacion,
    vence: fecha?.iso ?? null,
    // para proponer un producto nuevo con ese nombre
    nombreDicho: deProducto.map(k => originales[k]).join(' '),
    donador,
    donadorDicho,
    actividad: act?.actividad ?? null,
    // "todo esto lo donó..." vale para todos
    paraTodos: tokens.includes('todo') || tokens.includes('todos'),
  };
}

// ---------- nombres mal escuchados ----------
// el reconocimiento de voz a veces escribe mal un nombre: "leche y borrada de gloria" por "Leche Evaporada Gloria"
// si un trozo empieza y termina como un producto y suena parecido, se cambia por su nombre antes de separar

const vacias = new Set(['y', 'e', 'de', 'del', 'la', 'el', 'los', 'las', 'con', 'en']);

// como suena: b=v, s=z=c(e,i), k=c=qu, y=ll, sin h, sin letras dobles; los numeros dichos como cifras
function sonido(palabra) {
  if (palabra in unidades) return String(unidades[palabra]);
  return palabra.replace(/v/g, 'b').replace(/z/g, 's').replace(/c([ei])/g, 's$1').replace(/qu/g, 'k').replace(/c/g, 'k')
    .replace(/ll/g, 'y').replace(/h/g, '').replace(/(.)\1/g, '$1');
}
const compacto = lista => lista.filter(p => !vacias.has(p)).map(sonido).join('');

// las palabras del nombre sin el tamaño del final ('leche evaporada gloria 400 g' -> leche evaporada gloria)
function palabrasDelNombre(nombre) {
  const lista = palabras(nombre);
  while (lista.length > 2 && (/^\d/.test(lista.at(-1)) || medidas.has(lista.at(-1)) || lista.at(-1) === 'l')) lista.pop();
  return lista;
}

const parecidas = (a, b) => palabraCoincide(a, b) || sonido(a) === sonido(b);

export function corregirNombres(texto, productos) {
  const trozos = [...plano(texto).matchAll(/[a-z0-9ñ]+/g)];
  const dichas = trozos.map(m => m[0]);
  const cambios = [];
  for (const { item } of productos) {
    const suyas = palabrasDelNombre(item.nombre);
    // los nombres de una palabra ya los encuentra la busqueda normal
    if (suyas.length < 2) continue;
    const objetivo = compacto(suyas);
    const reemplazo = item.nombre.split(/\s+/).slice(0, suyas.length).join(' ');
    for (let i = 0; i < dichas.length; i++) {
      if (!parecidas(dichas[i], suyas[0])) continue;
      for (let j = i + 1; j < Math.min(dichas.length, i + suyas.length + 3); j++) {
        if (!parecidas(dichas[j], suyas.at(-1))) continue;
        const ventana = compacto(dichas.slice(i, j + 1));
        const parecido = 1 - distancia(ventana, objetivo) / Math.max(ventana.length, objetivo.length);
        if (parecido >= 0.8) cambios.push({ desde: trozos[i].index, hasta: trozos[j].index + trozos[j][0].length, reemplazo, parecido });
      }
    }
  }
  // los mas parecidos primero; los que se pisan con otro ya elegido no se usan
  const elegidos = [];
  for (const c of cambios.sort((a, b) => b.parecido - a.parecido || (b.hasta - b.desde) - (a.hasta - a.desde))) {
    if (!elegidos.some(e => c.desde < e.hasta && e.desde < c.hasta)) elegidos.push(c);
  }
  let resultado = texto;
  for (const c of elegidos.sort((a, b) => b.desde - a.desde)) resultado = resultado.slice(0, c.desde) + c.reemplazo + resultado.slice(c.hasta);
  return resultado;
}

// todo el dictado
// una parte que solo dice quien dono o la actividad ("que es donación libre") se suma a la anterior
export function interpretarDictado(texto, productos, extra = {}) {
  const resultado = [];
  let paraTodos = null;
  for (const parte of separarDictado(corregirNombres(String(texto ?? ''), productos)).flatMap(p => dividirPorCantidades(p, productos))) {
    let r = interpretarParte(parte, productos, extra);
    // "10 kg de avena. En 10 bolsas. Donado por la parroquia. Vence en octubre.": el reconocedor pone un punto
    // en cada pausa; lo que no nombra un producto es del anterior (salvo "todo esto lo donó...", que es para todos)
    const anterior = resultado.at(-1);
    const sinProducto = !r.producto && !r.dudas.length && !r.nombreDicho;
    const paraTodosSolo = r.paraTodos && (r.donador || r.donadorDicho || r.actividad);
    if (anterior && sinProducto && !paraTodosSolo) {
      r = interpretarParte(`${anterior.dicho} ${parte}`, productos, extra);
      resultado.pop();
    }
    const esProducto = r.producto || r.dudas.length || r.cantidad != null;
    const tieneDonador = r.donador || r.donadorDicho || r.actividad;
    if (esProducto) {
      resultado.push(r);
      if (r.paraTodos && tieneDonador) paraTodos = r;
    } else if (tieneDonador) {
      if (r.paraTodos || resultado.length === 0) paraTodos = r;
      else {
        const anterior = resultado.at(-1);
        if (r.donador || r.donadorDicho) Object.assign(anterior, { donador: r.donador, donadorDicho: r.donadorDicho });
        if (r.actividad) anterior.actividad = r.actividad;
      }
    }
  }
  // lo que no dijo donador toma el de "todo esto lo donó..."
  if (paraTodos) {
    for (const r of resultado) {
      if (!r.donador && !r.donadorDicho) Object.assign(r, { donador: paraTodos.donador, donadorDicho: paraTodos.donadorDicho });
      if (!r.actividad) r.actividad = paraTodos.actividad;
    }
  }
  return resultado;
}
