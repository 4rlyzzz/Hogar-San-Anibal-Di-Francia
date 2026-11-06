import { defineConfig, loadEnv } from 'vite';

// Content-Security-Policy de index.html: solo deja correr el js de la app y hablar con el backend.
// El backend sale de VITE_API_URL (en Railway se define antes del build: ver DESPLIEGUE.md).
// - wasm-unsafe-eval: compilar el WebAssembly del lector de codigos (no permite eval de texto)
// - google: el reconocimiento de voz de Chrome
function politicaSeguridad(origenApi, desarrollo) {
  const reglas = {
    'default-src': ["'self'"],
    'connect-src': ["'self'", origenApi, 'https://*.google.com', 'https://*.googleapis.com', 'wss://*.google.com'],
    'script-src': ["'self'", "'wasm-unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  if (desarrollo) {
    // el servidor de desarrollo de Vite recarga la pagina por websocket
    reglas['connect-src'].push('ws://localhost:*', 'ws://127.0.0.1:*');
  }
  return Object.entries(reglas).map(([k, v]) => `${k} ${v.join(' ')}`).join('; ');
}

function origenDe(url) {
  try {
    return new URL(url).origin;
  } catch {
    return 'http://127.0.0.1:8000';
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const origenApi = origenDe(env.VITE_API_URL || 'http://127.0.0.1:8000/api/');
  return {
    plugins: [{
      name: 'politica-seguridad',
      transformIndexHtml: html => html.replace('__CSP__', politicaSeguridad(origenApi, command === 'serve')),
    }],
  };
});
