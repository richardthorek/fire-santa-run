import { defineConfig, loadEnv, type ConfigEnv, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(( env: ConfigEnv ): UserConfig => {
  const mode = env?.mode;
  const isDev = mode === 'development' || process.env.VITE_DEV_MODE === 'true';

  // Security hardening (post-launch audit, 2026-09): VITE_AZURE_STORAGE_CONNECTION_STRING
  // (src/storage/index.ts — a dev-only escape hatch for testing the browser
  // against real Azure Table Storage) shares its exact name with the
  // backend's real Azure Storage master key, AZURE_STORAGE_CONNECTION_STRING
  // (server/src/utils/storage.ts also reads the VITE_-prefixed name as a
  // fallback, a leftover from the retired Azure Static Web Apps deployment,
  // which shared one env namespace between frontend and API). Vite statically
  // inlines any VITE_-prefixed value referenced via import.meta.env into the
  // shipped browser bundle — if this var is ever set to the real production
  // key during a non-dev build (e.g. a misconfigured CI step, or a shared
  // shell env), the full storage account key — read/write/delete across every
  // brigade's data — would be permanently baked into the public JS. Today's
  // deploy workflow only ever sets the correctly-named, non-VITE_ backend
  // variable (infra/seed-secrets.sh), so this is not currently exploited —
  // this guard makes sure a future misconfiguration can't silently ship it.
  //
  // Check both process.env AND the .env files: Vite inlines VITE_-prefixed
  // values from .env / .env.local / .env.[mode] into the bundle too, but does
  // not copy them onto process.env — so a real key dropped into
  // .env.production would bypass a process.env-only check.
  if (!isDev) {
    const fileEnv = loadEnv(mode ?? 'production', process.cwd(), '');
    const leaked =
      process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ??
      fileEnv.VITE_AZURE_STORAGE_CONNECTION_STRING;
    if (leaked && /AccountKey=/i.test(leaked)) {
      throw new Error(
        'Refusing to build: VITE_AZURE_STORAGE_CONNECTION_STRING is set to what looks like ' +
          'a real Azure Storage connection string (contains "AccountKey="). This variable is ' +
          'read client-side and would be baked into the public bundle. The backend already ' +
          'reads the correctly-scoped AZURE_STORAGE_CONNECTION_STRING (no VITE_ prefix) — ' +
          'unset VITE_AZURE_STORAGE_CONNECTION_STRING for this build.',
      );
    }
  }

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
            // server/ (the same Hono backend production runs), not the
            // retired api/ Functions app — see package.json's dev:server.
            '/api': {
              target: 'http://localhost:8080',
              changeOrigin: true,
              // Forward WebSocket upgrades too — server/'s /api/ws is a real
              // endpoint now (unlike api/'s Web PubSub client, which local dev
              // never actually exercised; VITE_DEV_MODE=true still bypasses
              // this entirely via BroadcastChannel, but VITE_DEV_MODE=false
              // locally now gets the genuine realtime path, not a dead one).
              ws: true,
            },
          },
        }
      : undefined,
    build: {
      rollupOptions: {
        output: {
          // Vite 8 (Rolldown) only accepts the function form of manualChunks;
          // the object form fails type-checking and the build.
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) return undefined;
            const chunkGroups: Record<string, string[]> = {
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
            };
            for (const [chunk, packages] of Object.entries(chunkGroups)) {
              if (packages.some((pkg) => id.includes(`node_modules/${pkg}/`))) {
                return chunk;
              }
            }
            return undefined;
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
