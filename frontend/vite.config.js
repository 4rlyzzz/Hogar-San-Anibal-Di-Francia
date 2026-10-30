import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/omniroute': {
        target: 'http://localhost:20128',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/omniroute/, ''),
      },
    },
  },
});