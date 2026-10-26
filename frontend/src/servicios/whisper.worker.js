// Whisper corre en este hilo aparte para que la pantalla no se congele mientras transcribe
// el modelo se descarga una sola vez y el navegador lo guarda (Cache Storage)
import { pipeline, env } from '@huggingface/transformers';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import fabrica from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

// el motor de WebAssembly sale de la app y no de un CDN (la CSP solo deja cargar codigo propio)
env.allowLocalModels = false;
env.useWasmCache = false;
env.backends.onnx.wasm.wasmPaths = { wasm, mjs: fabrica };
// sin cabeceras COOP/COEP no hay hilos compartidos: un solo hilo
env.backends.onnx.wasm.numThreads = 1;

// base entiende bastante mejor el español que tiny; pesa ~80 MB la primera vez
export const MODELO = 'onnx-community/whisper-base';

let cargando = null;

function cargar() {
  cargando ??= pipeline('automatic-speech-recognition', MODELO, {
    dtype: 'q8',
    device: 'wasm',
    // avance de la descarga, para mostrarlo en la pantalla
    progress_callback: p => {
      if (p.status === 'progress' && p.total) self.postMessage({ tipo: 'progreso', archivo: p.file, cargado: p.loaded, total: p.total });
    },
  }).catch(e => {
    // si fallo (sin internet), el proximo intento vuelve a probar
    cargando = null;
    throw e;
  });
  return cargando;
}

// mensajes: { tipo: 'preparar' } o { tipo: 'transcribir', id, audio: Float32Array a 16 kHz }
self.onmessage = async ({ data }) => {
  const { tipo, id } = data;
  try {
    const transcriptor = await cargar();
    if (tipo === 'preparar') return self.postMessage({ tipo: 'preparado' });
    const resultado = await transcriptor(data.audio, { language: 'spanish', task: 'transcribe' });
    self.postMessage({ tipo: 'listo', id, texto: resultado.text ?? '' });
  } catch (e) {
    self.postMessage({ tipo: 'error', id, mensaje: String(e?.message ?? e) });
  }
};
