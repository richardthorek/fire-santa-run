import { defineConfig, type ConfigEnv, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(( env: ConfigEnv ): UserConfig => {
  const mode = env?.mode;
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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split React and React-DOM into separate chunk
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Split Mapbox (large mapping library) into separate chunk
            'mapbox': ['mapbox-gl', '@mapbox/mapbox-gl-geocoder', '@mapbox/mapbox-gl-draw'],
            // Split Azure SDKs into separate chunk
            'azure': ['@azure/msal-browser', '@azure/msal-react', '@azure/data-tables', '@azure/web-pubsub-client'],
            // Split UI libraries into separate chunk
            'ui-libs': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', 'qrcode.react'],
            // Split Socket.IO into separate chunk
            'realtime': ['socket.io-client'],
            // Split date utilities
            'date-utils': ['date-fns'],
          },
        },
      },
      // Set chunk size warning limit to 500KB (as per requirements)
      // Note: This is acceptable for modern web apps with mapping libraries
      // Mapbox GL alone is ~450KB gzipped. Target is to keep all OTHER chunks under 200KB
      chunkSizeWarningLimit: 500,
      // Enable module preloading for faster navigation
      modulePreload: {
        polyfill: true,
      },
      // Use terser for better minification
      minify: 'terser',
      terserOptions: {
        compress: {
          // Only drop console logs in production builds
          drop_console: !isDev,
          drop_debugger: true,
        },
      },
    },
  };
});
