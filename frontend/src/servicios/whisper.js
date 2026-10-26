// puente con el hilo de Whisper: pasa la grabacion a 16 kHz mono y espera el texto
let hilo = null;
let siguiente = 1;
const pendientes = new Map();
const oyentes = new Set();
let preparado = false;

function obtenerHilo() {
  if (hilo) return hilo;
  hilo = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' });
  hilo.onmessage = ({ data }) => {
    if (data.tipo === 'progreso') return oyentes.forEach(o => o(data));
    if (data.tipo === 'preparado') {
      preparado = true;
      return oyentes.forEach(o => o(data));
    }
    const espera = pendientes.get(data.id);
    if (!espera) {
      if (data.tipo === 'error') oyentes.forEach(o => o(data));
      return;
    }
    pendientes.delete(data.id);
    if (data.tipo === 'listo') {
      preparado = true;
      espera.resolver(data.texto);
    } else espera.rechazar(new Error(data.mensaje));
  };
  return hilo;
}

export function whisperDisponible() {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof AudioContext !== 'undefined';
}

export const whisperPreparado = () => preparado;

// oyente({ tipo: 'progreso', cargado, total } | { tipo: 'preparado' } | { tipo: 'error' }); devuelve como quitarlo
export function escucharWhisper(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// empieza a descargar el modelo antes de que haga falta
export function prepararWhisper() {
  if (!preparado) obtenerHilo().postMessage({ tipo: 'preparar' });
}

// la grabacion (webm/ogg) a muestras de 16 kHz en un solo canal, como lo pide Whisper
async function aMono16k(audio) {
  const contexto = new AudioContext({ sampleRate: 16000 });
  try {
    const datos = await contexto.decodeAudioData(await audio.arrayBuffer());
    // copia: el original es del AudioBuffer y no se puede pasar al hilo
    if (datos.numberOfChannels === 1) return new Float32Array(datos.getChannelData(0));
    const mono = new Float32Array(datos.length);
    for (let c = 0; c < datos.numberOfChannels; c++) {
      const canal = datos.getChannelData(c);
      for (let i = 0; i < canal.length; i++) mono[i] += canal[i] / datos.numberOfChannels;
    }
    return mono;
  } finally {
    contexto.close();
  }
}

export async function transcribirConWhisper(audio) {
  const muestras = await aMono16k(audio);
  const id = siguiente++;
  return new Promise((resolver, rechazar) => {
    pendientes.set(id, { resolver, rechazar });
    obtenerHilo().postMessage({ tipo: 'transcribir', id, audio: muestras }, [muestras.buffer]);
  });
}
