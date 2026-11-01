import { defineConfig } from 'vite';

// OmniRoute (dictado) corre aparte en el puerto 20128
const proxy = {
  '/omniroute': {
    target: 'http://localhost:20128',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/omniroute/, ''),
  },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
});
