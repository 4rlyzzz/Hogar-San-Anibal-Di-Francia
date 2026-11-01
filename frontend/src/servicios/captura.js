// reconocimiento de voz y lector de codigos de barras
// las pantallas solo usan estas funciones, asi que no hay que tocarlas para cambiar la libreria

// ---------- voz ----------
// el reconocimiento que trae el navegador (Chrome, Edge, Android, iPhone); null si no tiene
export function reconocedorNavegador() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ---------- codigos de barras ----------
// el BarcodeDetector del navegador si lo trae (Android); si no (Chrome y Edge en Windows),
// el de la libreria barcode-detector, que lee con ZXing en WebAssembly
const formatosUtiles = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code'];

async function claseLector() {
  if ('BarcodeDetector' in window) return window.BarcodeDetector;
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasm }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  // el .wasm sale de la app y no de un CDN (la CSP solo deja cargar lo propio)
  prepareZXingModule({ overrides: { locateFile: (ruta, prefijo) => (ruta.endsWith('.wasm') ? wasm : prefijo + ruta) } });
  return BarcodeDetector;
}

export async function crearLector() {
  try {
    const Lector = await claseLector();
    const soportados = (await Lector.getSupportedFormats?.()) ?? formatosUtiles;
    const formatos = formatosUtiles.filter(f => soportados.includes(f));
    return new Lector(formatos.length ? { formats: formatos } : undefined);
  } catch {
    return null;
  }
}
