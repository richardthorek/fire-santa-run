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
          // The huge vendor chunks (mapbox-gl ~1.7 MB, Azure SDKs) are NOT
          // precached: forcing every first-time visitor to download them up
          // front burns bandwidth on pages that never open a map. The service
          // worker's runtime CacheFirst route for scripts caches them on first
          // real use instead.
          globIgnores: ['**/assets/mapbox-*.js', '**/assets/azure-data-*.js'],
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
          manualChunks: {
            // Split React and React-DOM into separate chunk
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            // Split Mapbox (large mapping library) into separate chunk
            'mapbox': ['mapbox-gl', '@mapbox/mapbox-gl-geocoder', '@mapbox/mapbox-gl-draw'],
            // Auth SDK is needed at boot (session restore), so it gets its own
            // chunk — kept separate from the Tables SDK, which browsers only
            // reach via the lazy storage adapter and should never download.
            'azure-auth': ['@azure/msal-browser', '@azure/msal-react'],
            'azure-data': ['@azure/data-tables'],
            'realtime': ['@azure/web-pubsub-client'],
            // Split UI libraries into separate chunk
            'ui-libs': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', 'qrcode.react'],
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
