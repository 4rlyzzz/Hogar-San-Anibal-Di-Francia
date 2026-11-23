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
  blista: 'blísters', blistas: 'blísters', blisteres: 'blísters',
  ampolla: 'ampollas', ampollas: 'ampollas', tubo: 'tubos', tubos: 'tubos', unidad: 'unidades', unidades: 'unidades',
  pack: 'packs', packs: 'packs',
};
const docenas = { docena: 12, docenas: 12 };


const medidas = new Set(['kg', 'g', 'L', 'ml']);

// la dosis ("100 miligramos") es parte del nombre: ni cantidad ni una palabra que diga otro producto
const dosis = new Set(['mg', 'mcg', 'miligramo', 'miligramos', 'microgramo', 'microgramos']);

// ---------- tallas dichas ----------
// el reconocedor escribe la talla como suena: "talla eme", "talla equis ele" -> "talla M", "talla XL"
// (sin esto "talla eme" no dice cual polo es, y la "l" de "talla L" se tomaba por litros)
const letrasTalla = { doble: 'X', equis: 'X', x: 'X', ese: 'S', s: 'S', eme: 'M', m: 'M', ele: 'L', l: 'L', xs: 'XS', xl: 'XL', xxl: 'XXL' };
const tallasValidas = new Set(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
const tallaDicha = new RegExp(`\\b(tallas?)((?:\\s+(?:${Object.keys(letrasTalla).join('|')}))+)\\b`, 'gi');
const esPalabraTalla = t => t === 'talla' || t === 'tallas';

export function escribirTallas(texto) {
  return String(texto ?? '').replace(tallaDicha, (todo, palabra, letras) => {
    const lista = letras.trim().split(/\s+/);
    // la talla mas larga que forman las primeras letras ("talla ese azul" -> S; "talla equis ele" -> XL)
    for (let n = Math.min(lista.length, 3); n > 0; n--) {
      const talla = lista.slice(0, n).map(l => letrasTalla[l.toLowerCase()]).join('');
      if (tallasValidas.has(talla)) return [palabra, talla, ...lista.slice(n)].join(' ');
    }
    return todo;
  });
}

// "de 400 gramos", "cajas de 10 unidades": lo que trae cada envase, no cuantos entran
// tambien sin "de", justo despues del envase: "blister, 10 unidades", "caja 900 g" (la coma se pierde al leer)
function esTamanoDicho(tokens, inicio, unidad) {
  if (!unidad) return false;
  const esEnvase = t => Boolean(unidadesDichas[t]) && !medidas.has(unidadesDichas[t]) && unidadesDichas[t] !== 'unidades';
  if (tokens[inicio - 1] !== 'de') return esEnvase(tokens[inicio - 1]) && (medidas.has(unidad) || unidad === 'unidades');
  if (medidas.has(unidad)) return true;
  return unidad === 'unidades' && esEnvase(tokens[inicio - 2]);
}

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
    // "el primero de enero" es el dia 1
    const d = k >= 0 ? (['primero', 'primer'].includes(tokens[k]) ? { valor: 1, fin: k + 1 } : leerNumero(tokens, k)) : null;
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
const factores = { kg: { g: 1000 }, g: { kg: 0.001, mg: 1000 }, mg: { g: 0.001 }, L: { ml: 1000 }, ml: { L: 0.001 } };

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
// cada numero guarda la palabra que va antes y la que va despues en el nombre, cada una en su lado:
// en "15 arpiprazol 15 mg" el primer 15 es la cantidad (en el nombre el 15 va DESPUES de arpiprazol)
function numerosEnNombres(productos) {
  const vecinos = new Map();
  for (const { item } of productos) {
    const suyas = palabras(item.nombre);
    suyas.forEach((p, k) => {
      if (!/^\d/.test(p)) return;
      if (!vecinos.has(p)) vecinos.set(p, { antes: new Set(), despues: new Set() });
      if (suyas[k - 1]) vecinos.get(p).antes.add(suyas[k - 1]);
      if (suyas[k + 1]) vecinos.get(p).despues.add(suyas[k + 1]);
    });
  }
  return vecinos;
}

function esDeNombre(vecinos, tokens, i, fin) {
  const suyos = vecinos.get(tokens[i]);
  if (!suyos) return false;
  const junto = (t, lado) => Boolean(t) && [...lado].some(v => palabraCoincide(t, v));
  return junto(tokens[i - 1], suyos.antes) || junto(tokens[fin], suyos.despues);
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
      if (!relleno.has(tokens[i]) && !(tokens[i] in unidadesDichas) && !dosis.has(tokens[i])) {
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
      || (anterior === 'de' && (!unidad || medidas.has(unidad)) && !(tokens[n.fin] in docenas))
      || esTamanoDicho(tokens, i, unidad)
      // "a 6 soles cada una", "S/ 6": es el precio, no otro producto
      || esSoles(tokens, n.fin) || (anterior === 's' && !esPalabraTalla(tokens[i - 2]));
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

// ---------- ingreso o salida, dicho en voz alta ----------
// 'saco' no va: tambien es un envase ("un saco de arroz")
const palabrasTipo = {
  Ingreso: ['ingreso', 'ingresos', 'ingresa', 'ingresan', 'ingresar', 'ingresamos', 'ingresaron', 'entrada', 'entradas', 'entra', 'entran', 'entro', 'entraron', 'llego', 'llegaron', 'recibimos', 'compramos'],
  Salida: ['salida', 'salidas', 'sale', 'salen', 'salio', 'salieron', 'saca', 'sacan', 'sacar', 'sacamos', 'sacaron', 'venta', 'ventas', 'vendi', 'vendimos', 'vendieron', 'vender', 'vendemos',
    'vendido', 'vendida', 'vendidos', 'vendidas'],
};
const tipoDePalabra = new Map(Object.entries(palabrasTipo).flatMap(([tipo, lista]) => lista.map(p => [p, tipo])));
// tambien lo que la acompaña: "registrar un ingreso de ..." (ese "un" no es una cantidad)
const avisoTipo = new RegExp(`\\b(?:(?:registrar|registra|registro|anotar|anota|hacer|haz|es|una?)\\s+)*(${[...tipoDePalabra.keys()].join('|')})\\b(?:\\s*[:,.])?(?:\\s+(?:de|del)\\b)?`, 'g');

// { tipo: 'Ingreso' | 'Salida' | null, ambos: si dijo los dos, resto: el texto sin esas palabras }
// { tipo: 'Ingreso' | 'Salida' | null, resto: el texto sin esas palabras }
export function tipoDictado(texto) {
  const original = String(texto ?? '');
  const dichos = [];
  let resto = '';
  let desde = 0;
  
  const guia = plano(original);
  for (const m of guia.matchAll(avisoTipo)) {
    // "venta de 3 entradas para la kermés", "una entrada": tras un numero o "de" es un producto, no el tipo
    // (solo si ya se dijo el tipo; "una entrada de arroz" al empezar si es un ingreso)
    const antes = guia.slice(0, m.index + m[0].search(new RegExp(`\\b${m[1]}\\b`))).match(/([a-z0-9ñ]+)\s*$/)?.[1];
    if (dichos.length && antes && (/^\d/.test(antes) || esNumeroPalabra(antes) || ['de', 'del', 'las', 'los', 'unas', 'unos'].includes(antes))) continue;
    const tipoEncontrado = tipoDePalabra.get(m[1]);
    if (tipoEncontrado && !dichos.includes(tipoEncontrado)) {
      dichos.push(tipoEncontrado);
    }
    resto += `${original.slice(desde, m.index)} `;
    desde = m.index + m[0].length;
  }
  resto += original.slice(desde);

  return {
    // si se dijeron ambos no se adivina: la pantalla avisa que se registre uno a la vez
    tipo: dichos.length === 1 ? dichos[0] : null,
    ambos: dichos.length > 1,
    resto: resto.replace(/\s+/g, ' ').replace(/^[\s,.;:]+/, '').trim(),
  };
}

// "ingreso de 3 kilos de arroz y salida de 2 latas de leche": un trozo por cada tipo dicho
// -> [{ tipo: 'Ingreso' | 'Salida' | null, texto }] (null: lo que va antes de decir el tipo)
// con la misma regla que tipoDictado: "venta de 3 entradas" no es un ingreso
export function partirPorTipo(texto) {
  const original = String(texto ?? '');
  const guia = plano(original);
  const trozos = [];
  let actual = { tipo: null, texto: '' };
  let desde = 0;
  let dijo = false;
  for (const m of guia.matchAll(avisoTipo)) {
    const antes = guia.slice(0, m.index + m[0].search(new RegExp(`\\b${m[1]}\\b`))).match(/([a-z0-9ñ]+)\s*$/)?.[1];
    if (dijo && antes && (/^\d/.test(antes) || esNumeroPalabra(antes) || ['de', 'del', 'las', 'los', 'unas', 'unos'].includes(antes))) continue;
    const tipo = tipoDePalabra.get(m[1]);
    if (!tipo) continue;
    dijo = true;
    actual.texto += original.slice(desde, m.index);
    if (/[a-z0-9ñ]/i.test(actual.texto)) trozos.push(actual);
    actual = { tipo, texto: '' };
    desde = m.index + m[0].length;
  }
  actual.texto += original.slice(desde);
  if (/[a-z0-9ñ]/i.test(actual.texto)) trozos.push(actual);
  // "y" o comas que quedan al final de un trozo ("3 kilos de arroz y | salida de ...")
  return trozos.map(t => ({ ...t, texto: t.texto.replace(/[\s,.;:]+$/, '').replace(/\s+(?:y|e)$/i, '').replace(/^[\s,.;:]+/, '').trim() }));
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
  const limpias = partes.map(p => p.trim().replace(/^(?:y|e)(?:\s+|$)/i, '')).filter(Boolean);
  // una parte que es solo un numero es una pausa al dictar ("venta de 5. Rosario de madera"): va con lo que sigue
  const juntas = [];
  for (let i = 0; i < limpias.length; i++) {
    if (i < limpias.length - 1 && soloNumero(limpias[i])) {
      limpias[i + 1] = `${limpias[i]} ${limpias[i + 1]}`;
      continue;
    }
    juntas.push(limpias[i]);
  }
  return juntas;
}

function soloNumero(parte) {
  const tokens = plano(parte).match(/[a-z0-9ñ]+/g) ?? [];
  const sinRelleno = tokens.filter(t => t !== 'de' && t !== 'del');
  const n = sinRelleno.length ? leerNumero(sinRelleno, 0) : null;
  return Boolean(n && n.fin === sinRelleno.length);
}

// ---------- parecido entre palabras ----------
const singular = p => (p.length > 4 && p.endsWith('es') ? p.slice(0, -2) : p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p);

// el reconocedor de voz confunde las letras que suenan casi igual: "arbibrasol" por "arpiprazol"
// p=b, t=d, k=g (ademas de lo que ya junta sonido(): v=b, z=s, c=k...)
const sonidoParecido = p => sonido(p).replace(/p/g, 'b').replace(/t/g, 'd').replace(/k/g, 'g');

// cuanto se parece una palabra dicha a una del nombre: 1 igual, 0.9 con una letra distinta,
// 0.7 solo suena parecido, 0 nada (asi "pollo" prefiere "Pollo" antes que "Bollo")
function parecido(dicha, delNombre) {
  if (dicha === delNombre || singular(dicha) === singular(delNombre)) return 1;
  if (dicha.length < 3) return 0;
  if (palabraParecida(dicha, delNombre)) return 0.9;
  if (dicha.length >= 5 && palabraParecida(sonidoParecido(dicha), sonidoParecido(delNombre))) return 0.7;
  return 0;
}

function palabraCoincide(dicha, delNombre) {
  return parecido(dicha, delNombre) > 0;
}

const mejorParecido = (dicha, delNombre) => Math.max(0, ...delNombre.map(p => parecido(dicha, p)));

// que tanto se parece lo dicho al nombre (0 = nada)
function puntaje(dichas, nombre) {
  const delNombre = palabras(nombre);
  const aciertos = dichas.reduce((suma, d) => suma + mejorParecido(d, delNombre), 0);
  if (aciertos === 0) return 0;
  return aciertos / dichas.length + (aciertos / delNombre.length) * 0.5;
}

// ---------- buscar el producto ----------
// tamano: { valor, medida } dicho ("de un litro"); ayuda a elegir la presentacion
function tieneTamano(item, tamano) {
  const base = tamanoDeItem(item);
  if (!base) return false;
  const enSuMedida = convertir(tamano.valor, tamano.medida, base.medida);
  return enSuMedida != null && Math.abs(enSuMedida - base.valor) < 0.001;
}

// el tamaño registrado; en merchandising va en el nombre ("Panetón ... caja 900 g", "Mermelada frasco 300 g")
function tamanoDeItem(item) {
  if (item.medida && item.contenido) return { valor: item.contenido, medida: item.medida };
  // merchandising: en su presentacion ("caja 900 g"); los viejos lo tenian en el nombre
  for (const m of plano(`${item.presentacion ?? ''} ${item.nombre ?? ''}`).matchAll(medidaSuelta)) {
    const medida = medidaRegistrada[abreviatura(m[2])];
    if (medida) return { valor: Number(m[1].replace(',', '.')), medida };
  }
  return null;
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

// ---------- el nombre que entendio la IA -> el producto registrado ----------
// la dosis o el tamaño distingue productos: "Paracetamol 100 mg" no es "Paracetamol 50 mg"
// por eso "100 mg", "100mg" y "100 miligramos" se juntan en una sola palabra ("100mg") antes de comparar
function abreviatura(unidad) {
  if (/^(?:miligramos?|mg)$/.test(unidad)) return 'mg';
  if (unidad === 'mcg') return 'mcg';
  if (/^(?:kilogramos?|kilos?|kg)$/.test(unidad)) return 'kg';
  if (/^(?:gramos?|grs?|g)$/.test(unidad)) return 'g';
  if (/^(?:mililitros?|ml)$/.test(unidad)) return 'ml';
  if (/^(?:litros?|lts?|l)$/.test(unidad)) return 'l';
  return null;
}

const medidaSuelta = /(\d+(?:[.,]\d+)?)\s*(miligramos?|mcg|mg|kilogramos?|kilos?|kg|gramos?|grs?|g|mililitros?|ml|litros?|lts?|l)(?![a-zñ])/g;

function palabrasConMedida(texto) {
  return plano(String(texto ?? ''))
    // las medidas de largo por ancho van juntas: "10 x 10 cm", "10x10cm" y "10 por 10 cm" son lo mismo
    .replace(/(\d+)\s*(?:x|por)\s*(\d+)\s*(cm|mm|m)?(?![a-zñ])/g, (_, a, b, u) => `${a}x${b}${u ?? ''}`)
    .replace(medidaSuelta, (_, n, u) => n.replace(',', '.') + abreviatura(u))
    .split(/[^a-z0-9ñ.]+/)
    .map(p => p.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

const esMedidaDicha = p => /^\d/.test(p);
const medidaRegistrada = { mg: 'mg', mcg: null, g: 'g', kg: 'kg', ml: 'ml', l: 'L' };

// el producto sin la dosis en el nombre pero con su tamaño registrado (Leche Gloria, latas de 400 g)
function contradiceTamano(item, medida) {
  const m = medida.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
  const suyo = tamanoDeItem(item);
  if (!m || !suyo) return false;
  const enSuMedida = medidaRegistrada[m[2]] ? convertir(Number(m[1]), medidaRegistrada[m[2]], suyo.medida) : null;
  return enSuMedida != null && Math.abs(enSuMedida - suyo.valor) >= 0.001;
}

// productos: [{ item, categoria }]; devuelve { producto, dudas } como buscarProducto
export function productoDeNombre(nombre, productos) {
  const nada = { producto: null, dudas: [] };
  const dichas = palabrasConMedida(escribirTallas(nombre)).filter(p => !relleno.has(p));
  if (!dichas.some(p => !esMedidaDicha(p))) return nada;
  const medidasDichas = dichas.filter(esMedidaDicha);

  const candidatos = productos.map(p => {
    const suyas = palabrasConMedida(p.item.nombre);
    const suyasMedidas = suyas.filter(esMedidaDicha);
    // una dosis dicha que no es la suya lo descarta
    const contradice = medidasDichas.some(m => (suyasMedidas.length ? !suyasMedidas.includes(m) : contradiceTamano(p.item, m)));
    if (contradice || !suyas.length) return { ...p, puntos: 0 };
    // las dosis tienen que ser iguales; las palabras pueden sonar parecido ("arbibrasol")
    const acierto = d => Math.max(0, ...suyas.map(s => (esMedidaDicha(d) || esMedidaDicha(s) ? Number(d === s) : parecido(d, s))));
    const palabrasAcertadas = dichas.filter(d => !esMedidaDicha(d) && acierto(d) > 0).length;
    if (palabrasAcertadas === 0) return { ...p, puntos: 0 };
    const aciertos = dichas.reduce((suma, d) => suma + acierto(d), 0);
    return { ...p, puntos: aciertos / dichas.length + (aciertos / suyas.length) * 0.5 };
  }).filter(p => p.puntos > 0).sort((a, b) => b.puntos - a.puntos);

  if (!candidatos.length) return nada;
  const empatan = candidatos.filter(p => p.puntos === candidatos[0].puntos);
  if (empatan.length > 1) return { producto: null, dudas: empatan.map(({ item, categoria }) => ({ item, categoria })) };
  const { item, categoria } = candidatos[0];
  return { producto: { item, categoria }, dudas: [] };
}

export const mismoProducto = (a, b) => Boolean(a && b && a.categoria === b.categoria
  && (a.item === b.item || (a.item.id != null && a.item.id === b.item.id)));

// la IA dijo "Paracetamol 100 mg" y hay de cajas de 10 y de 20: si el dictado local entendio
// uno de ellos (oyo "cajas de 20 unidades"), ese es. locales: lo que devolvio interpretarDictado
export function desempatarConLocal({ producto, dudas }, locales) {
  if (producto || !dudas.length) return { producto, dudas };
  const elegido = dudas.find(d => locales.some(x => mismoProducto(x.producto, d)));
  return elegido ? { producto: elegido, dudas: [] } : { producto, dudas };
}

// ---------- la cantidad que entendio la IA ----------
// la IA devuelve el numero tal como se dijo y la palabra que lo acompaña ("60" y null, "5" y "sacos");
// la cuenta la hace este codigo, igual que el dictado local:
// - sin unidad o con el envase del producto: es la cantidad ("60 paracetamol en cajas de 10" -> 60 cajas)
// - con una medida o "unidades": se pasa a envases ("100 kg" de arroz en sacos de 50 kg -> 2 sacos)
// local: lo que entendio el dictado local de ese mismo producto ({ cantidad, unidadDicha }) o null
export function cantidadDeLaIA(cantidad, unidad, item, local = null) {
  if (typeof cantidad !== 'number' || !Number.isFinite(cantidad)) return local?.cantidad ?? null;
  // "salida de paracetamol en cajas de 20 unidades": ese 20 es el tamaño dicho, no cuantos salen
  // (si no se dijo cuantos, queda sin cantidad y la pantalla avisa "falta la cantidad")
  if (local?.tamano && cantidad === local.tamano.valor && local.cantidad !== cantidad) return local.cantidad ?? null;
  if (!item) return cantidad;
  const dicha = unidadesDichas[plano(String(unidad ?? '')).match(/[a-zñ]+/)?.[0]] ?? null;
  const tamano = item.medida && item.contenido ? { valor: item.contenido, medida: item.medida } : null;
  const esMedida = dicha && dicha !== item.unidad && (medidas.has(dicha) || (dicha === 'unidades' && item.medida === 'unidades'));

  if (esMedida) {
    // "50 kg" de un arroz en sacos de 50 kg: es el tamaño del saco; cuantos sacos lo dice el dictado local
    const enSuMedida = tamano ? convertir(cantidad, dicha, tamano.medida) : null;
    if (enSuMedida != null && Math.abs(enSuMedida - tamano.valor) < 0.001) return local ? local.cantidad : 1;
    // "100 kg de arroz" en sacos de 50 kg -> 2 sacos; "500 g" de algo en kg -> 0,5; "30 unidades" en cajas de 10 -> 3
    const directa = convertir(cantidad, dicha, item.unidad);
    if (directa != null) return redondear(directa);
    if (enSuMedida != null) return redondear(enSuMedida / tamano.valor);
    return cantidad;
  }
  // "50 sacos" de un saco de 50 kg, cuando el dictado local oyo claramente "5 sacos": la IA tomo el tamaño
  if (tamano && cantidad === tamano.valor && local?.unidadDicha === item.unidad && local.cantidad != null && local.cantidad !== cantidad) {
    return local.cantidad;
  }
  return cantidad;
}

// un donador registrado cuyo nombre (de dos palabras o mas) se dijo completo y seguido
// si su nombre esta dentro del de un producto ("Taza Hogar San Aníbal" y el donador "Hogar San Aníbal"), no cuenta:
// sin "donado por" puede ser el producto
function donadorNombrado(tokens, usados, donadores, productos = []) {
  // con las mismas letras que tokens (plano deja la ñ)
  const palabrasPlanas = t => plano(String(t ?? '')).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const nombresProductos = productos.map(p => ` ${palabrasPlanas(p.item.nombre).join(' ')} `);
  for (const d of donadores) {
    const suyas = palabrasPlanas(d.nombre).filter(p => !relleno.has(p));
    if (suyas.length < 2) continue;
    if (nombresProductos.some(n => n.includes(` ${suyas.join(' ')} `))) continue;
    for (let i = 0; i + suyas.length <= tokens.length; i++) {
      if (suyas.every((p, k) => !usados.has(i + k) && tokens[i + k] === p)) {
        return { donador: d, posiciones: suyas.map((_, k) => i + k) };
      }
    }
  }
  return null;
}

// ---------- sin fecha de vencimiento ----------
const avisosSinVence = [['sin', 'fecha'], ['sin', 'vencimiento'], ['sin', 'vence'], ['no', 'vence'], ['no', 'vencen'], ['no', 'caduca'], ['no', 'caducan'],
  ['no', 'tiene', 'fecha'], ['no', 'tienen', 'fecha'], ['no', 'tiene', 'vencimiento'], ['no', 'expira']];

// marca sus palabras como usadas (con "de vencimiento" si sigue); true si se dijo
function buscarSinVence(tokens, usados) {
  for (const aviso of avisosSinVence) {
    for (let i = 0; i + aviso.length <= tokens.length; i++) {
      if (!aviso.every((p, k) => tokens[i + k] === p)) continue;
      let fin = i + aviso.length;
      if (tokens[fin] === 'de' && ['vencimiento', 'caducidad', 'expiracion'].includes(tokens[fin + 1])) fin += 2;
      for (let k = i; k < fin; k++) usados.add(k);
      return true;
    }
  }
  return false;
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

const avisosComprador = [['vendido', 'a'], ['vendida', 'a'], ['vendidos', 'a'], ['vendidas', 'a'],
  ['comprado', 'por'], ['comprada', 'por'], ['comprados', 'por'], ['compradas', 'por'], ['le', 'vendi', 'a'], ['a', 'nombre', 'de'],
  ['comprador'], ['compradora'], ['cliente'], ['compro'], ['compraron']];
const avisosProveedor = [['comprado', 'a'], ['comprada', 'a'], ['comprados', 'a'], ['compradas', 'a'], ['proveedor'], ['proveedora'], ['distribuidor'], ['por', 'la', 'distribuidora']];
const mediosDichos = { yape: 'yape-plin', llape: 'yape-plin', yapeo: 'yape-plin', plin: 'yape-plin', plim: 'yape-plin', efectivo: 'efectivo', cash: 'efectivo', transferencia: 'transferencia', deposito: 'transferencia', transfirio: 'transferencia' };
const palabrasPago = new Set(['pago', 'pagaron', 'pagado', 'pagada', 'pagan', 'paga']);
const palabrasSoles = new Set(['soles', 'sol']);
// "a 25 soles", "a 25 nuevos soles" ("3 nuevos polos" no es un precio)
const esSoles = (tokens, k) => palabrasSoles.has(tokens[k]) || (tokens[k] === 'nuevos' && palabrasSoles.has(tokens[k + 1]));

function buscarAvisoDe(avisos, tokens, usados) {
  for (let i = 0; i < tokens.length; i++) {
    if (usados.has(i)) continue;
    const aviso = avisos.find(a => a.every((t, k) => tokens[i + k] === t && !usados.has(i + k)));
    if (aviso) return { inicio: i, fin: i + aviso.length };
  }
  return null;
}

function buscarPago(tokens, usados) {
  let medioPago = '';
  let precio = null;
  tokens.forEach((t, k) => {
    if (t in mediosDichos && !usados.has(k)) {
      medioPago = mediosDichos[t];
      usados.add(k);
      for (let j = k - 1; j >= 0 && j >= k - 3 && ['con', 'en', 'por', 'y', ...palabrasPago].includes(tokens[j]); j--) usados.add(j);
    }
    if (palabrasPago.has(t)) usados.add(k);
  });
  for (let i = 0; i < tokens.length; i++) {
    if (usados.has(i)) continue;
    const n = leerNumero(tokens, i);
    if (!n) continue;
    const conSoles = esSoles(tokens, n.fin);
    // "S/ 25" es un precio, pero "talla S 3 tazas" no
    const conSigno = tokens[i - 1] === 's' && !esPalabraTalla(tokens[i - 2]);
    if (!conSoles && !conSigno) {
      i = n.fin - 1;
      continue;
    }
    precio = n.valor;
    for (let k = i; k < n.fin; k++) usados.add(k);
    if (conSigno) usados.add(i - 1);
    let k = n.fin;
    while (esSoles(tokens, k)) usados.add(k++);
    if (tokens[k] === 'con' && /^\d{1,2}$/.test(tokens[k + 1] ?? '')) {
      precio += Number(tokens[k + 1]) / 100;
      usados.add(k).add(k + 1);
      k += 2;
    }
    if (tokens[k] === 'cada') usados.add(k).add(k + 1);
    if (tokens[i - 1] === 'a' || tokens[i - 1] === 'por') usados.add(i - 1);
    if (tokens[i - 2] === 'a' && conSigno) usados.add(i - 2);
    // "a un precio de 14 soles", "costo de 14 soles": ese "un" no es una cantidad
    const precioDicho = ['precio', 'costo'].includes(tokens[i - 1]) || (tokens[i - 1] === 'de' && ['precio', 'costo'].includes(tokens[i - 2]));
    for (let j = i - 1; precioDicho && j >= 0 && ['de', 'precio', 'costo', 'un', 'el', 'su', 'a', 'al', 'con'].includes(tokens[j]); j--) usados.add(j);
    break;
  }
  return { medioPago, precio: precio != null ? redondear(precio) : null };
}

function personaRegistrada(previas, tokens, usados, lista) {
  for (let i = 0; i < tokens.length; i++) {
    if (usados.has(i) || !previas.includes(tokens[i])) continue;
    // el nombre termina en un numero ("a Rosa Quispe 2 panetones": el 2 y lo que sigue no son del nombre)
    const posiciones = [];
    for (let k = i + 1; k < tokens.length && posiciones.length < 5 && !usados.has(k) && !leerNumero(tokens, k); k++) {
      if (!relleno.has(tokens[k]) && !titulos.has(tokens[k])) posiciones.push(k);
    }
    // las palabras que mejor dicen el nombre (con el mismo puntaje, las menos)
    // todas las dichas tienen que ser de su nombre ("a Carmen Rosario" no es Rosario Mendoza); tras "de" o "del"
    // ademas se dice el nombre completo ("polos de algodón" no es el proveedor Algodones Perú; "de Textiles Sur" si)
    let mejor = null;
    for (let n = 1; n <= posiciones.length; n++) {
      const dichas = posiciones.slice(0, n).map(k => tokens[k]);
      const persona = buscarDonador(dichas, lista);
      if (!persona) continue;
      const suyas = palabras(persona.nombre);
      const todasSuyas = dichas.every(d => mejorParecido(d, suyas) > 0);
      const completo = suyas.every(s => dichas.some(d => parecido(d, s) > 0));
      const puntos = puntaje(dichas, persona.nombre);
      if (todasSuyas && (completo || (tokens[i] !== 'de' && tokens[i] !== 'del'))
        && puntos >= 0.75 && puntos > (mejor?.puntos ?? 0)) mejor = { persona, puntos, hasta: posiciones[n - 1] };
    }
    if (mejor) {
      for (let k = i; k <= mejor.hasta; k++) usados.add(k);
      return mejor.persona;
    }
  }
  return null;
}

function buscarPersona(avisos, tokens, originales, usados, lista, previas = []) {
  const aviso = buscarAvisoDe(avisos, tokens, usados);
  if (!aviso) return { persona: previas.length ? personaRegistrada(previas, tokens, usados, lista) : null, dicho: '' };
  const resto = [];
  const posiciones = [];
  for (let k = aviso.inicio; k < tokens.length; k++) {
    if (usados.has(k)) continue;
    if (k >= aviso.fin && !relleno.has(tokens[k]) && tokens[k] !== 'es' && !titulos.has(tokens[k])) {
      resto.push(tokens[k]);
      posiciones.push(k);
    }
    usados.add(k);
  }
  const persona = resto.length ? buscarDonador(resto, lista) : null;
  return { persona, dicho: persona ? '' : posiciones.map(k => originales[k]).join(' ') };
}

// "venta de 3 panetones a María López" (o "compramos 20 panetones a Distribuidora Lima"): una persona que aun
// no esta registrada, dicha solo con "a". Se toma lo que sigue a la ultima "a" hasta un numero o algo ya usado,
// si ninguna de esas palabras es de un producto. Marca esas palabras como usadas (no son del producto).
const titulos = new Set(['sr', 'sra', 'senor', 'senora', 'señor', 'señora', 'srta', 'senorita', 'señorita', 'don', 'dona', 'doña', 'el', 'la']);
// "María de la Cruz": van dentro del nombre, no lo cortan
const conectores = new Set(['de', 'del', 'la', 'las', 'los']);

function personaConA(tokens, originales, usados, palabrasProductos) {
  for (let i = tokens.length - 1; i > 0; i--) {
    if (usados.has(i) || (tokens[i] !== 'a' && tokens[i] !== 'al')) continue;
    const posiciones = [];
    let pendientes = [];
    for (let k = i + 1; k < tokens.length && !usados.has(k) && !leerNumero(tokens, k) && !(tokens[k] in unidadesDichas); k++) {
      const t = tokens[k];
      if (!posiciones.length && titulos.has(t)) continue;
      if (conectores.has(t)) {
        if (posiciones.length) pendientes.push(k);
        continue;
      }
      if (relleno.has(t)) break;
      posiciones.push(...pendientes, k);
      pendientes = [];
    }
    const delNombre = posiciones.filter(k => !conectores.has(tokens[k]));
    if (!delNombre.length || delNombre.length > 5) return '';
    // "a la cocina", "a rosa" (el color) no son personas; "a Rosario Mendoza" si, aunque haya un producto Rosario
    if (delNombre.every(k => palabrasProductos.some(p => palabraCoincide(tokens[k], p)))) return '';
    for (let k = i; k <= posiciones.at(-1); k++) usados.add(k);
    return posiciones.map(k => originales[k]).join(' ');
  }
  return '';
}

const esDeMerch = r => Boolean(r.producto ? r.producto.item.tipoMerch : r.dudas.length && r.dudas.every(d => d.item.tipoMerch));

// ---------- una parte: cantidad, unidad, tamaño, producto y donador ----------
// extra: { donadores, actividades } para reconocer quien dono
// tipo ('Ingreso' | 'Salida'): con el, "a María López" es quien compra (salida) o a quien se le compro (ingreso)
export function interpretarParte(parte, productos, { donadores = [], actividades = [], compradores = [], proveedores = [], tipo = null } = {}) {
  // las mismas palabras normalizadas y como se escribieron (plano no cambia el largo)
  const trozos = [...plano(parte).replace(/[^a-z0-9ñ.\s]/g, ' ').matchAll(/\S+/g)];
  const tokens = trozos.map(m => m[0]);
  const originales = trozos.map(m => parte.slice(m.index, m.index + m[0].length));
  const usados = new Set();

  // "cada una" no es una cantidad
  tokens.forEach((t, k) => {
    if (t === 'cada') usados.add(k).add(k + 1);
  });

  const pago = buscarPago(tokens, usados);
  const comprador = buscarPersona(avisosComprador, tokens, originales, usados, compradores, ['a', 'para']);
  const proveedor = buscarPersona(avisosProveedor, tokens, originales, usados, proveedores, ['a', 'de', 'del']);

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
  } else {
    // sin aviso (el reconocedor escribio "nadas por" en vez de "donadas por"): un donador registrado
    // dicho con su nombre completo ("por el Colegio San José")
    const encontrado = donadorNombrado(tokens, usados, donadores, productos);
    if (encontrado) {
      donador = encontrado.donador;
      encontrado.posiciones.forEach(k => usados.add(k));
    }
  }

  // fecha de vencimiento dicha ("vence el 15 de octubre de 2026"): sus palabras no son producto ni cantidad
  const fecha = buscarFecha(tokens);
  if (fecha) for (let k = fecha.inicio; k < fecha.fin; k++) usados.add(k);
  // "sin fecha de vencimiento", "no vence", "no tiene fecha": que no tiene (no es que falte decirla)
  const sinVence = !fecha && buscarSinVence(tokens, usados);

  // la persona nueva dicha con "a" (la registrada ya la encontro buscarPersona)
  const rol = { Salida: comprador, Ingreso: proveedor }[tipo];
  // "... Rosa Quispe con Yape": una parte sin numeros que solo nombra a alguien registrado es esa persona
  // (todas sus palabras son del nombre; si no, "Rosa" seria parte de "Rosario")
  if (rol && !rol.persona && !rol.dicho) {
    const libres = tokens.map((t, k) => k).filter(k => !usados.has(k) && !relleno.has(tokens[k]) && !titulos.has(tokens[k]));
    const dichas = libres.map(k => tokens[k]);
    const persona = libres.length && !libres.some(k => leerNumero(tokens, k)) ? buscarDonador(dichas, tipo === 'Salida' ? compradores : proveedores) : null;
    if (persona && dichas.every(d => mejorParecido(d, palabras(persona.nombre)) === 1)) {
      rol.persona = persona;
      libres.forEach(k => usados.add(k));
    }
  }
  const personaNueva = rol && !rol.persona && !rol.dicho
    ? personaConA(tokens, originales, usados, productos.flatMap(p => palabras(p.item.nombre)))
    : '';

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
  // tambien "en blister de 10 unidades"
  const esTamano = n => esTamanoDicho(tokens, n.inicio, n.unidad);
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
    // la talla es parte del nombre aunque sea una letra de medida ("talla L" no son litros)
    if (!usados.has(k) && esPalabraTalla(tokens[k - 1]) && tallasValidas.has(t.toUpperCase())) return true;
    return !usados.has(k) && !deNumeros.has(k) && !relleno.has(t) && !(t in unidadesDichas) && !dosis.has(t) && !(t in docenas) && !esNumeroPalabra(t) && t !== 'medio' && t !== 'media';
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
      // lo que se vende por docenas ("2 docenas de galletas") no se multiplica
      if (item?.unidad !== 'docenas') cantidad *= docenas[tokens[k]];
      k++;
      if (tokens[k] === 'de') k++;
    }
    // "3 cajas de panetón" (caja 900 g), "3 bolsas ecológicas": si el envase esta en su nombre son unidades de ese producto
    // (solo si se cuenta por unidades y sin contenido registrado: "2 cajas de paracetamol" de 10 unidades se convierte aparte)
    const envaseDelNombre = item && item.unidad === 'unidades' && !item.contenido
      && tokens[k] in unidadesDichas && !medidas.has(unidadesDichas[tokens[k]])
      && mejorParecido(tokens[k], palabras(`${item.nombre} ${item.presentacion ?? ''}`)) === 1;
    if (envaseDelNombre) k++;
    else if (tokens[k] in unidadesDichas) unidadDicha = unidadesDichas[tokens[k++]];
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

  // solo en merchandising hay comprador o proveedor ("salida de arroz para Rosa" no es una venta, aunque
  // haya una compradora Rosa). Sin producto se deja: puede ser el final de lo anterior ("... a Rosa Quispe")
  const esVenta = esDeMerch({ producto, dudas }) || (!producto && !dudas.length);
  if (!esVenta) {
    Object.assign(comprador, { persona: null, dicho: '' });
    Object.assign(proveedor, { persona: null, dicho: '' });
  } else if (personaNueva) {
    if (tipo === 'Salida') comprador.dicho = personaNueva;
    else proveedor.dicho = personaNueva;
  }

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
    // se dijo que no tiene fecha de vencimiento
    sinVence,
    // el tamaño dicho ("cajas de 20 unidades" -> { valor: 20, medida: 'unidades' }) o null
    tamano,
    // para proponer un producto nuevo con ese nombre
    nombreDicho: deProducto.map(k => originales[k]).join(' '),
    donador,
    donadorDicho,
    actividad: act?.actividad ?? null,
    comprador: comprador.persona,
    compradorDicho: comprador.dicho,
    proveedor: proveedor.persona,
    proveedorDicho: proveedor.dicho,
    precio: pago.precio,
    medioPago: pago.medioPago,
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
        let hasta = trozos[j].index + trozos[j][0].length;
        // "paracetamol 100 mg" con "Paracetamol 100mg" registrado: el "mg" dicho ya va en el nombre
        const pegada = suyas.at(-1).match(/^(\d+)([a-z]+)$/);
        if (pegada && dichas[j] === pegada[1] && dichas[j + 1] && abreviatura(dichas[j + 1]) === pegada[2]) {
          hasta = trozos[j + 1].index + trozos[j + 1][0].length;
        }
        if (parecido >= 0.8) cambios.push({ desde: trozos[i].index, hasta, reemplazo, parecido });
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
// ---------- ingresos y salidas en el mismo dictado ----------
// cada producto con su tipo (r.tipo): el dicho antes de el o, si no se dijo, porDefecto
// extraDe(tipo): los donadores, compradores... para ese tipo (con el tipo, "a María" compra o vende)
export function interpretarMezclado(texto, productos, extraDe = () => ({}), porDefecto = null) {
  const trozos = partirPorTipo(texto);
  // lo dicho antes del primer tipo va con el primero que se dijo ("3 kilos de arroz, ingreso")
  const primero = trozos.find(t => t.tipo)?.tipo ?? null;
  return trozos.flatMap(t => {
    const tipo = t.tipo ?? porDefecto ?? primero;
    return interpretarDictado(t.texto, productos, extraDe(tipo)).map(r => ({ ...r, tipo }));
  });
}

// ---------- el inventario dicho ----------
// un mismo producto puede estar en dos inventarios ("Mermelada de fresa" en Alimentos y en Merchandising):
// "ingreso a alimentos de 3 mermeladas" o "3 mermeladas de merchandising" dice cual es
// (el reconocedor escribe "merchandising" de varias formas: "merch", "merchan", "marchandising")
const inventarioDicho = new RegExp(String.raw`(?:\b(?:a|al|en|de|del|para)\s+)?(?:\b(?:el|la|los)\s+)?(?:\b(?:inventario|seccion|categoria|parte)\s+(?:de\s+|del\s+)?)?\b(alimentos|salud(?:\s+(?:e|y)\s+higiene)?|merch[a-z]*|march[a-z]*ising)\b(?:\s*[:,.])?`, 'g');
const conConector = /^(?:a|al|en|de|del|para|el|la|los|inventario|seccion|categoria|parte)\s/;
// lo que va antes del inventario: nada, o termina en coma o "y": vale para lo que sigue
const empiezaParte = /(?:^|[,.;:]|\b(?:y|e|ademas|tambien|luego|despues|aparte))\s*$/;

export function categoriaDe(palabra) {
  const p = plano(String(palabra ?? '')).trim();
  if (p.startsWith('alimento')) return 'Alimentos';
  if (p.startsWith('salud')) return 'Salud';
  if (p.startsWith('merch') || p.startsWith('march')) return 'Merchandising';
  return null;
}

// el texto en trozos: [{ texto, categoria, alFinal }]
// categoria: el inventario dicho antes ("ingreso a alimentos de ..."), vale para todos los productos del trozo
// alFinal: el dicho despues de un producto ("3 mermeladas de merchandising"), solo para el ultimo producto del trozo
// una palabra que es parte del nombre de un producto ("Kit Salud Bucal") solo cuenta con "a", "de", "en"... delante
export function partirPorInventario(texto, productos = []) {
  const original = String(texto ?? '');
  const guia = plano(original);
  const deNombres = new Set(productos.flatMap(p => plano(p.item.nombre).split(/[^a-z0-9ñ]+/)));
  const trozos = [];
  let actual = { texto: '', categoria: null, alFinal: null };
  let adelante = null;
  let desde = 0;
  for (const m of guia.matchAll(inventarioDicho)) {
    const categoria = categoriaDe(m[1]);
    if (!categoria || (deNombres.has(m[1].split(/\s+/)[0]) && !conConector.test(m[0]))) continue;
    const antes = guia.slice(desde, m.index);
    actual.texto += original.slice(desde, m.index);
    if (empiezaParte.test(antes) || !/[a-z0-9ñ]/.test(actual.texto.replace(/\b(?:y|e|de|del)\b/gi, ''))) {
      // "a alimentos de 3 mermeladas": para lo que sigue
      if (/[a-z0-9ñ]/i.test(actual.texto)) trozos.push(actual);
      adelante = categoria;
      actual = { texto: '', categoria, alFinal: null };
    } else {
      // "3 mermeladas de merchandising": para el producto de antes
      trozos.push({ ...actual, alFinal: categoria });
      actual = { texto: '', categoria: adelante, alFinal: null };
    }
    desde = m.index + m[0].length;
  }
  actual.texto += original.slice(desde);
  if (/[a-z0-9ñ]/i.test(actual.texto) || !trozos.length) trozos.push(actual);
  return trozos.map(t => ({ ...t, texto: t.texto.replace(/^[\s,.;:]*(?:(?:de|del)\s+)?/i, '').trim() }));
}

export const enInventario = (productos, categoria) => (categoria ? productos.filter(p => p.categoria === categoria) : productos);

// el inventario de un producto que entendio la IA: el que ella dijo ("categoria") o, si no lo dio,
// el que entendio el dictado local cuando vale para todo lo dicho ("ingreso a merchandising de ...")
export function categoriaDeIA(itemIA, locales = []) {
  const dicha = categoriaDe(itemIA?.categoria);
  if (dicha) return dicha;
  const dichas = new Set(locales.map(r => r.categoriaDicha ?? null));
  return dichas.size === 1 ? [...dichas][0] : null;
}

export function interpretarDictado(texto, productos, extra = {}) {
  const resultado = [];
  let paraTodos = null;
  // cada parte con el inventario dicho para ella (si se dijo, solo se busca entre sus productos)
  const partes = partirPorInventario(texto, productos).flatMap(t => {
    const suyas = separarDictado(corregirNombres(escribirTallas(t.texto), productos)).flatMap(p => dividirPorCantidades(p, productos));
    return suyas.map((parte, k) => ({ parte, categoria: (k === suyas.length - 1 && t.alFinal) || t.categoria }));
  });
  for (const { parte, categoria } of partes) {
    const deAqui = enInventario(productos, categoria);
    let r = interpretarParte(parte, deAqui, extra);
    // "10 kg de avena. En 10 bolsas. Donado por la parroquia. Vence en octubre.": el reconocedor pone un punto
    // en cada pausa; lo que no nombra un producto es del anterior (salvo "todo esto lo donó...", que es para todos)
    const anterior = resultado.at(-1);
    const sinProducto = !r.producto && !r.dudas.length && !r.nombreDicho;
    const paraTodosSolo = r.paraTodos && (r.donador || r.donadorDicho || r.actividad);
    // "... Rosa Quispe con Yape" ya dice quien compro: no se vuelve a leer junto con lo anterior
    const soloPersona = r.comprador || r.proveedor;
    // "3 paquetes. Fideo tallarín Don Vittorio": la pausa separo la cantidad de su producto
    const cantidadSola = anterior && !anterior.producto && !anterior.dudas.length && !anterior.nombreDicho && anterior.cantidad != null;
    if (cantidadSola && (r.producto || r.dudas.length) && r.cantidad == null) {
      r = interpretarParte(`${anterior.dicho} ${parte}`, deAqui, extra);
      resultado.pop();
    } else if (anterior && sinProducto && !paraTodosSolo && !soloPersona) {
      r = interpretarParte(`${anterior.dicho} ${parte}`, enInventario(productos, categoria ?? anterior.categoriaDicha), extra);
      if (!categoria && anterior.categoriaDicha) r.categoriaDicha = anterior.categoriaDicha;
      resultado.pop();
    }
    if (categoria) r.categoriaDicha = categoria;
    const esProducto = r.producto || r.dudas.length || r.cantidad != null;
    const tieneDonador = r.donador || r.donadorDicho || r.actividad;
    const tieneVenta = r.comprador || r.compradorDicho || r.proveedor || r.proveedorDicho || r.medioPago || r.precio != null;
    if (esProducto) {
      resultado.push(r);
      if (r.paraTodos && tieneDonador) paraTodos = r;
    } else if (tieneVenta && resultado.length) {
      const anterior = resultado.at(-1);
      for (const campo of ['comprador', 'compradorDicho', 'proveedor', 'proveedorDicho', 'medioPago']) if (r[campo]) anterior[campo] = r[campo];
      if (r.precio != null) anterior.precio = r.precio;
      // si despues se vuelve a leer junto con lo que sigue ("... Con yape."), esto no se pierde
      anterior.dicho = `${anterior.dicho} ${parte}`;
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
  compartirVenta(resultado.filter(esDeMerch), [['comprador', 'compradorDicho'], ['proveedor', 'proveedorDicho'], ['medioPago']]);
  return resultado;
}

// "vendimos 4 panetones, 2 tazas y 1 polo a Rosa Quispe, con Yape": quien compro (o a quien se le compro) y como
// se pago se dicen una vez y valen para toda la venta. Solo si se dijo uno solo; con dos distintos no se adivina.
// campos: grupos que van juntos ([persona registrada, como se dijo]); el primero dice cual es
function compartirVenta(items, grupos) {
  for (const campos of grupos) {
    const tienen = items.filter(r => campos.some(c => r[c]));
    const cual = r => {
      const v = r[campos[0]];
      return v && typeof v === 'object' ? `id:${v.id}` : plano(String(v || r[campos[1]] || '')).trim();
    };
    if (!tienen.length || new Set(tienen.map(cual)).size !== 1) continue;
    for (const r of items) {
      if (!campos.some(c => r[c])) for (const c of campos) r[c] = tienen[0][c];
    }
  }
}

// lo mismo con lo que entendio la IA: [{ producto, comprador, proveedor, medio_pago, ... }]
// solo entre los del mismo tipo: quien compro es de las ventas, el proveedor de los ingresos
export function compartirVentaIA(items) {
  for (const tipo of new Set(items.map(i => i.tipo ?? null))) {
    compartirVenta(items.filter(i => (i.tipo ?? null) === tipo), [['comprador'], ['proveedor'], ['medio_pago']]);
  }
  return items;
}

export function preprocesarTextoVoz(texto) {
  if (!texto) return '';

  let limpio = String(texto)
    // 1. Reemplazar puntos y signos causados por silencios del micro por espacios ("2.5 kilos" se queda: es un decimal)
    .replace(/(?:\.(?!\d)|[;:!?])+/g, ' ')
    // las autocorrecciones ("dos no, tres") las resuelve la IA (el prompt dice "usa la ultima"): quitarlas aqui
    // rompia nombres como "Taza Mejor Papá" o "Polo No te rindas"
    // 2. Quitar espacios múltiples
    .replace(/\s+/g, ' ')
    .trim();

  return limpio;
}
