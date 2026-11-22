import api from './api.js';
import { preprocesarTextoVoz } from '../logica/dictado.js';

// El dictado con IA pasa por Django (/api/dictado/), que llama a la IA (Groq, Gemini...) con sus propias claves.
// El navegador nunca ve esa clave ni le manda el token de la app a la IA.
// Si la IA no esta configurada o falla, devuelve [] y la pantalla usa el reconocimiento local.

// la vista previa ("Entendí") y "Agregar a la lista" piden lo mismo: se guarda la consulta
// para no gastar dos veces los tokens. Si llega mientras la primera sigue en camino, espera esa misma.
// Lo que falla no se guarda, asi se puede volver a intentar.
const recientes = new Map();
const MAX_RECIENTES = 10;

export const procesarTextoConIA = (textoDictado) => {
  const texto = preprocesarTextoVoz(textoDictado);
  if (!texto) return Promise.resolve([]);
  if (!recientes.has(texto)) {
    const consulta = api.post('dictado/', { texto })
      .then(({ data }) => (Array.isArray(data?.items) ? data.items : []))
      .catch(err => {
        recientes.delete(texto);
        // 503: sin IA configurada o caida. No es un error para quien usa la app.
        if (err.response?.status !== 503) console.warn('Dictado con IA no disponible:', err.message);
        return [];
      });
    recientes.set(texto, consulta);
    // solo los ultimos dictados
    if (recientes.size > MAX_RECIENTES) recientes.delete(recientes.keys().next().value);
  }
  return recientes.get(texto);
};
