import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { visualizer } from 'rollup-plugin-visualizer';
import { mindTargetsPlugin } from './tools/vite-plugin-mind-targets.js';

// Determine base path for GitHub Pages deployment vs local dev
const repoName = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/AR-web-app/';

const base = process.env.GITHUB_ACTIONS === 'true' || process.env.GITHUB_PAGES === 'true'
  ? repoName
  : (process.env.BASE_URL || '/');

export default defineConfig({
  base,
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
