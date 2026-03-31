import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('three')) return 'three-vendor';
          if (id.includes('react') || id.includes('scheduler') || id.includes('react-router')) return 'react-vendor';
          if (id.includes('@tanstack')) return 'query-vendor';
          if (id.includes('@radix-ui')) return 'radix-vendor';
          if (id.includes('framer-motion')) return 'motion-vendor';
          if (id.includes('@base44') || id.includes('socket.io-client')) return 'app-services';
        },
      },
    },
  },
});
