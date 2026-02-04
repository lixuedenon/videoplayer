import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ['browser', 'default', 'import']
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'ffmpeg-vendor': ['@ffmpeg/ffmpeg', '@ffmpeg/util']
        }
      }
    }
  }
});