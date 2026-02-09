import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				popup: resolve(__dirname, 'src/popup/popup.html'),
				background: resolve(__dirname, 'src/background/background.js'),
			},
			output: {
				entryFileNames: '[name].js',
				chunkFileNames: '[name].js',
				assetFileNames: '[name].[ext]',
				dir: 'dist'
			}
		},
		outDir: 'dist',
		emptyOutDir: true
	},
	// Important: don't inject scripts into HTML
	server: {
		hmr: false
	}
});