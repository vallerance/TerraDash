import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/TerraDash/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        diagnostics: 'diagnostics.html',
      },
    },
  },
});
