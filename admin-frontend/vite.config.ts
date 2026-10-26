import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Dev server proxies /v1 to the backend so the browser never hits CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: { '/v1': { target: env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true } },
    },
  };
});
