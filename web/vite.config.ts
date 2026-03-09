import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const project = env.VITE_FIREBASE_PROJECT_ID || 'your-firebase-project-id';
  const directProxy = env.VITE_PROXY_DIRECT === '1';
  const proxy = {
    '/api': {
      target: 'http://localhost:5001',
      changeOrigin: true,
      rewrite: (path: string) => {
        if (directProxy) return path;
        return `/${project}/us-central1${path}`;
      }
    }
  };

  return {
    plugins: [react()],
    server: {
      proxy
    },
    preview: {
      proxy
    },
    build: {
      outDir: 'dist'
    }
  };
});
