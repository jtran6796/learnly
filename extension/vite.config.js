import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),  // ← ADD THIS!
  ],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        background: resolve(__dirname, 'src/background/background.js'),
      },
      output: {
        entryFileNames: 'src/[name]/[name].js',
        chunkFileNames: 'src/[name]/[name].js',
        assetFileNames: 'src/[name]/[name].[ext]',
        dir: 'dist'
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    hmr: false
  }
});