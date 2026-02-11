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
				entryFileNames: '[name]/[name].js',
				chunkFileNames: '[name]/[name].js',
				assetFileNames: '[name]/[name].[ext]',
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