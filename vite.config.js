import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 子路径部署要相对路径
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});
