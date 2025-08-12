import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => {
          const project = process.env.VITE_FIREBASE_PROJECT_ID || 'your-firebase-project-id';
          return `/${project}/us-central1${path}`;
        }
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});


