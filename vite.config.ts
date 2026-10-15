import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // vendor code in a few stable chunks: it changes rarely, so browsers keep it cached across releases, and the pages that need it load it in parallel
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (
            /node_modules\/(@react-aria|@react-stately|@react-types|@internationalized|react-aria|react-aria-components|react-stately)\//.test(
              id,
            )
          )
            return 'vendor-aria';
          if (/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id)) return 'vendor-motion';
          if (/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-router';
          if (/node_modules\/zod\//.test(id)) return 'vendor-zod';
          if (/node_modules\/three\//.test(id)) return 'vendor-three';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 700, // vendor-three (the 3D engine) is the one large chunk, and only the Live Floor loads it
  },
  server: { host: true, port: 5173, strictPort: true }, // host: true = listen on all interfaces so phones/tablets on the LAN can open it
});
