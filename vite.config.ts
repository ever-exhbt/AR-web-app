import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { visualizer } from 'rollup-plugin-visualizer';
import { mindTargetsPlugin } from './tools/vite-plugin-mind-targets.js';

export default defineConfig({
  plugins: [
    basicSsl(),
    mindTargetsPlugin(),
    visualizer({
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
      open: false
    })
  ],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'esnext'
  }
});
