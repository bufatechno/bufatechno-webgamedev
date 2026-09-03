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
          'three': ['three'],
        },
      },
    },
  },
  server: { open: false },
});
