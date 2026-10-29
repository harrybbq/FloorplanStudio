import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In production the app is served from https://harrybbq.github.io/FloorplanStudio/,
// so built asset URLs must be prefixed with that sub-path. Dev server stays at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/FloorplanStudio/' : '/',
  plugins: [react()],
  server: { port: 5180 },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes rarely — keep it in its own cacheable chunks.
        manualChunks: {
          react: ['react', 'react-dom'],
          konva: ['konva', 'react-konva'],
        },
      },
    },
  },
}));
