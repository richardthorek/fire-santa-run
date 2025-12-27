import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isDev = mode === 'development' || process.env.VITE_DEV_MODE === 'true';

  return {
    plugins: [react()],
    server: isDev
      ? {
          proxy: {
            '/api': {
              target: 'http://localhost:7071',
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
