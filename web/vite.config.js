import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built bundle loads from FiveM's NUI file host with relative paths
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
