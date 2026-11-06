import api from './api.js';
import { preprocesarTextoVoz } from '../logica/dictado.js';

// El dictado con IA pasa por Django (/api/dictado/), que llama a OmniRoute con su propia clave.
// El navegador nunca ve esa clave ni le manda el token de la app a OmniRoute.
// Si la IA no esta configurada o falla, devuelve [] y la pantalla usa el reconocimiento local.
export const procesarTextoConOmniroute = async (textoDictado) => {
  const texto = preprocesarTextoVoz(textoDictado);
  if (!texto) return [];
  try {
    const { data } = await api.post('dictado/', { texto });
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    // 503: sin IA configurada o caida. No es un error para quien usa la app.
    if (err.response?.status !== 503) console.warn('Dictado con IA no disponible:', err.message);
    return [];
  }
};
