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
    // No chunkSizeWarningLimit. It only ever warned — it cannot fail a build — and it
    // measures one chunk uncompressed, while the budget in .size-limit.json is written
    // in gzipped bytes across the entry. Set at 250 it printed on every single build
    // against a 316 kB entry chunk, which is how a warning teaches people to skip
    // reading warnings. `npm run size` is the gate, and it now runs locally too: in
    // `npm run check` and in the pre-push hook (docs/adr/0007-ci-pipeline.md).
    sourcemap: true,
  },
  preview: {
    port: 4173,
  },
});
