import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Firebase changes rarely; a separate chunk stays cached between app updates.
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] },
      },
    },
    // Firestore + Auth alone is ~780 kB minified (~195 kB gzipped).
    chunkSizeWarningLimit: 800,
  },
});
