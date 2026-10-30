/**
 * Convierte texto dictado por voz a una lista estructurada de items JSON.
 * Ejemplo: "dos kilos de arroz y tres latas de leche"
 * Output: [{ producto: 'arroz', cantidad: 2, unidad: 'kilos' }, { producto: 'leche', cantidad: 3, unidad: 'latas' }]
 */

const NUMEROS_TEXTO = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50
};

export function parsearTextoAJson(texto) {
  if (!texto || typeof texto !== 'string') return [];

  // Normalizar texto
  const limpio = texto.toLowerCase().trim();
  
  // Separar frases unidas por "y", comas o puntos
  const partes = limpio.split(/,|\se\s|\sy\s|\s\.\s/);

  const resultados = [];

  for (const parte of partes) {
    const tokens = parte.trim().split(/\s+/);
    if (!tokens.length) continue;

    let cantidad = 1;
    let unidad = 'unidades';
    let idxInicioProducto = 0;

    // Detectar número
    const primerToken = tokens[0];
    if (!isNaN(parseInt(primerToken))) {
      cantidad = parseInt(primerToken);
      idxInicioProducto = 1;
    } else if (NUMEROS_TEXTO[primerToken]) {
      cantidad = NUMEROS_TEXTO[primerToken];
      idxInicioProducto = 1;
    }

    // Detectar unidad si existe en la posición siguiente
    const unidadesComunes = ['kilo', 'kilos', 'kg', 'lata', 'latas', 'caja', 'cajas', 'bolsa', 'bolsas', 'paquete', 'paquetes', 'litro', 'litros', 'frasco', 'frascos'];
    if (tokens[idxInicioProducto] && unidadesComunes.includes(tokens[idxInicioProducto])) {
      unidad = tokens[idxInicioProducto];
      idxInicioProducto++;
    }

    // El resto del texto es el nombre del producto (omitimos conectores "de")
    let producto = tokens.slice(idxInicioProducto).join(' ');
    if (producto.startsWith('de ')) {
      producto = producto.substring(3);
    }

    if (producto) {
      resultados.push({
        producto: producto.trim(),
        cantidad: cantidad,
        unidad: unidad,
        fecha_registro: new Date().toISOString()
      });
    }
  }

  return resultados;
}