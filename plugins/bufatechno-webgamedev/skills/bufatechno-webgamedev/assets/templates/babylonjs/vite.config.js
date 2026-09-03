import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'baseline-widely-available',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'babylon': ['@babylonjs/core'],
        },
      },
    },
  },
});
