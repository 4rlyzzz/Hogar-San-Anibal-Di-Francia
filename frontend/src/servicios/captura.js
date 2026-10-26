// reconocimiento de voz y lector de codigos de barras
// las pantallas solo usan estas funciones, asi que no hay que tocarlas para cambiar la libreria
import { whisperDisponible, transcribirConWhisper } from './whisper.js';

// ---------- voz ----------
// hay dos formas:
//   'navegador': el reconocimiento que trae el navegador (Chrome, Edge, Android, iPhone). Es el mas preciso
//                y escribe mientras se habla, pero necesita internet (el audio lo procesa Google, Microsoft o Apple)
//   'grabacion': se graba y se transcribe en el propio equipo con Whisper (src/servicios/whisper.js), sin internet
// si el del navegador no existe o falla por falta de internet, se usa Whisper

// transcriptor puesto a mano (pruebas u otra libreria): async (audio: Blob) => texto; null = ninguno
let elegido;
// el del navegador fallo (sin internet): se sigue con Whisper
let sinNavegador = false;

export function usarTranscriptor(funcion) {
  elegido = typeof funcion === 'function' ? funcion : null;
}

export function reconocedorNavegador() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function dejarNavegador() {
  sinNavegador = true;
}

// 'navegador', 'grabacion' o null si no hay forma de reconocer la voz
export function modoVoz() {
  if (elegido !== undefined) return elegido ? 'grabacion' : null;
  if (reconocedorNavegador() && !sinNavegador) return 'navegador';
  return whisperDisponible() ? 'grabacion' : null;
}

export function hayTranscriptor() {
  return modoVoz() !== null;
}

// si se esta usando Whisper (para mostrar la descarga del modelo)
export function usaWhisper() {
  return elegido === undefined && modoVoz() === 'grabacion';
}

export async function transcribir(audio) {
  const transcriptor = elegido ?? (whisperDisponible() ? transcribirConWhisper : null);
  if (!transcriptor) throw new Error('No hay reconocimiento de voz.');
  const texto = await transcriptor(audio);
  return typeof texto === 'string' ? texto : '';
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
