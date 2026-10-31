// Polyfills estrictamente para el scope del Web Worker
if (typeof self !== 'undefined') {
  self.window = self;
  self.global = self;
}

export const MODELO = 'onnx-community/whisper-base';

let cargando = null;

async function cargar() {
  if (!cargando) {
    cargando = (async () => {
      // Importación dinámica limpia
      const { pipeline, env } = await import('@huggingface/transformers');
      const wasm = (await import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url')).default;
      const fabrica = (await import('onnxruntime-web/ort-wasm-simd-threaded.mjs?url')).default;

      env.allowLocalModels = false;
      env.useWasmCache = false;
      env.backends.onnx.wasm.wasmPaths = { wasm, mjs: fabrica };
      env.backends.onnx.wasm.numThreads = 1;

      return pipeline('automatic-speech-recognition', MODELO, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            self.postMessage({ tipo: 'progreso', archivo: p.file, cargado: p.loaded, total: p.total });
          }
        },
      });
    })().catch(e => {
      cargando = null;
      throw e;
    });
  }
  return cargando;
}

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