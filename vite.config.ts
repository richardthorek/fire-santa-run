import { defineConfig, type ConfigEnv, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(( env: ConfigEnv ): UserConfig => {
  const mode = env?.mode;
  const isDev = mode === 'development' || process.env.VITE_DEV_MODE === 'true';

  return {
    plugins: [
      react(),
      VitePWA({
        // Use injectManifest so we can write a fully custom service worker
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        // We manage manifest.json in public/ manually
        manifest: false,
        injectManifest: {
          // Precache all JS, CSS, HTML, common image/font formats
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Raise the per-file size limit to accommodate the Mapbox bundle (~1.7 MB gzipped).
          // The default Workbox limit is 2 MB; mapbox-gl routinely exceeds this.
          // All other chunks are well below 500 KB.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        },
        // Service worker is only active in production builds
        devOptions: {
          enabled: false,
        },
      }),
    ],
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
          // Vite 8 / Rollup 4: use the function form of manualChunks (the object
          // form is deprecated). Groupings below match the previous explicit map.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // Split React core into a separate chunk
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'react-vendor';
            }
            // Split Mapbox (large mapping library) into a separate chunk
            if (id.includes('mapbox-gl') || id.includes('@mapbox/mapbox-gl-geocoder') || id.includes('@mapbox/mapbox-gl-draw')) {
              return 'mapbox';
            }
            // Split Azure SDKs into a separate chunk
            if (id.includes('@azure/msal-browser') || id.includes('@azure/msal-react') || id.includes('@azure/data-tables') || id.includes('@azure/web-pubsub-client')) {
              return 'azure';
            }
            // Split UI libraries into a separate chunk
            if (id.includes('@dnd-kit/') || id.includes('qrcode.react')) {
              return 'ui-libs';
            }
            // Split Socket.IO into a separate chunk
            if (id.includes('socket.io-client')) {
              return 'realtime';
            }
            // Split date utilities
            if (id.includes('date-fns')) {
              return 'date-utils';
            }
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
