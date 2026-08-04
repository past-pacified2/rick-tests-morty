import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Fail the build rather than silently shipping a bundle that busts the budget.
    // `npm run size` is the hard gate in CI; this is the local early warning.
    chunkSizeWarningLimit: 250,
    sourcemap: true,
  },
  preview: {
    port: 4173,
  },
});
