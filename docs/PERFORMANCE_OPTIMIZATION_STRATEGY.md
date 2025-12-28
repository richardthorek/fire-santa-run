# Performance Optimization Strategy

## Executive Summary

**Current Performance Status:**
- Performance Score: **75/100** (Target: 90+)
- Best Practices: **100/100** ✅
- Accessibility: **90/100** ✅  
- SEO: **92/100** ✅

**Key Bottleneck:** Client-Side Rendering (CSR) with React causes 5.8s LCP due to JavaScript execution delay.

## Problem Analysis

### Current Architecture Issues

1. **Single-Page Application (SPA) with CSR**
   - All pages rendered client-side via React
   - Landing page blocked by JavaScript bundle loading (2.3s FCP, 5.8s LCP)
   - Mapbox library (448KB gzipped) loaded even for non-map pages

2. **Bundle Loading Strategy**
   - Currently: All routes lazy-loaded but share common chunks
   - Issue: Even landing page pulls in heavy dependencies
   - Result: 92% of LCP time is "Render Delay" (waiting for JS to execute)

3. **Lighthouse Scoring Reality**
   - CSR React apps typically score 60-80 on performance
   - To achieve 90+, need Server-Side Rendering (SSR) or Static Generation

## Proposed Solution: Hybrid Architecture

### Strategy Overview

**Treat different parts of the app with different rendering strategies:**

1. **Landing Page** → Static HTML with progressive enhancement
2. **Public Tracking Page** → Server-Side Rendering (SSR) via Azure Function
3. **Authenticated Dashboard/Editor** → Client-Side Rendering (current approach)

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         Azure Static Web Apps                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  Landing (/)                                     │
│  ├─ Static HTML + minimal JS                    │
│  ├─ Inline Critical CSS                         │
│  └─ Lazy load React only on interaction         │
│                                                  │
│  Tracking (/track/:id)                          │
│  ├─ SSR via Azure Function                      │
│  ├─ Pre-rendered HTML with route data           │
│  ├─ Hydrate with React for interactivity        │
│  └─ Lazy load Mapbox only when needed           │
│                                                  │
│  Dashboard (/dashboard)                         │
│  ├─ Full CSR React app (current)                │
│  ├─ Heavy dependencies OK (authenticated users) │
│  └─ All Mapbox features loaded                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Static Landing Page (Quick Win)

**Goal:** Get landing page to 90+ performance score

**Approach:**
1. Create static HTML version of landing page at `/public/landing.html`
2. Use minimal vanilla JS for auth redirect
3. Inline critical CSS (< 14KB)
4. Lazy load React only when user interacts (clicks "Sign In")

**Expected Impact:**
- FCP: < 0.5s (currently 2.3s) ⬇️ 1.8s
- LCP: < 1.2s (currently 5.8s) ⬇️ 4.6s
- Performance Score: 90+ (currently 75) ⬆️ 15+

**Implementation:**
```javascript
// public/landing.html (simplified static version)
// No React, no bundles, just HTML + minimal JS
// Progressive enhancement: load React on demand

<script type="module">
  // Only load React bundle when user wants to sign in
  document.getElementById('signin-btn').addEventListener('click', async () => {
    const { initApp } = await import('/src/main.tsx');
    initApp();
  });
</script>
```

**Benefits:**
- Instant page load (no JS execution required)
- Progressive enhancement (interactive when needed)
- Minimal code changes (existing React app untouched)

---

### Phase 2: SSR for Public Tracking Pages (High Impact)

**Goal:** Make `/track/:id` pages fast and SEO-friendly

**Approach:**
1. Create Azure Function for SSR: `/api/ssr/track/{id}`
2. Pre-render HTML with route data on server
3. Send hydration-ready HTML to client
4. Progressive enhancement: load Mapbox only when map area scrolled into view

**Azure Function Implementation:**

```typescript
// api/src/ssr/track.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { renderToString } from 'react-dom/server';
import { TrackingView } from '../../../src/pages/TrackingView';

export async function trackingSsr(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const routeId = request.params.id;
  
  // Fetch route data from storage
  const route = await getRouteFromStorage(routeId);
  
  if (!route) {
    return { status: 404, body: 'Route not found' };
  }
  
  // Server-render the tracking page
  const html = renderToString(<TrackingView route={route} />);
  
  // Inject into HTML shell with hydration data
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Track ${route.name} - Fire Santa Run</title>
        <!-- Critical CSS inlined -->
        <style>${criticalCss}</style>
        
        <!-- SEO Meta Tags -->
        <meta name="description" content="Track Santa in real-time on the ${route.name} route" />
        <meta property="og:title" content="Track ${route.name}" />
        <meta property="og:type" content="website" />
        
        <!-- Preconnect to required services -->
        <link rel="preconnect" href="https://api.mapbox.com" />
      </head>
      <body>
        <div id="root">${html}</div>
        
        <!-- Hydration data -->
        <script>
          window.__INITIAL_DATA__ = ${JSON.stringify({ route })};
        </script>
        
        <!-- Load React bundle for hydration (lazy) -->
        <script type="module" src="/assets/tracking-bundle.js"></script>
      </body>
    </html>
  `;
  
  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
    },
    body: fullHtml,
  };
}

app.http('trackingSsr', {
  methods: ['GET'],
  route: 'ssr/track/{id}',
  authLevel: 'anonymous',
  handler: trackingSsr,
});
```

**Routing Configuration (staticwebapp.config.json):**
```json
{
  "routes": [
    {
      "route": "/track/*",
      "rewrite": "/api/ssr/track/{id}",
      "allowedRoles": ["anonymous"]
    }
  ]
}
```

**Expected Impact:**
- FCP: < 0.8s (currently 2.3s on tracking pages)
- LCP: < 1.8s (pre-rendered content visible immediately)
- TTI: < 2.5s (hydration faster than full render)
- Performance Score: 90+ for public tracking pages
- **Bonus:** Perfect SEO with server-rendered meta tags

---

### Phase 3: Optimize Dashboard with Code Splitting

**Goal:** Keep dashboard fast while maintaining full functionality

**Current Status:** Already implemented (manual chunks for Mapbox, Azure, etc.)

**Additional Optimizations:**

1. **Route-based code splitting:**
```typescript
// vite.config.ts - Enhanced manual chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Mapbox only loaded on map-heavy pages
          if (id.includes('mapbox')) {
            return 'mapbox';
          }
          // Azure SDKs for authenticated pages only
          if (id.includes('@azure/')) {
            return 'azure';
          }
          // Per-page chunks
          if (id.includes('src/pages/RouteEditor')) {
            return 'page-route-editor';
          }
          if (id.includes('src/pages/NavigationView')) {
            return 'page-navigation';
          }
          // Shared vendor code
          if (id.includes('node_modules/react')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
```

2. **Intersection Observer for Mapbox:**
```typescript
// Only initialize Mapbox when map container is visible
const mapRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // Lazy load Mapbox
        import('mapbox-gl').then((mapboxgl) => {
          initializeMap(mapboxgl);
        });
        observer.disconnect();
      }
    },
    { threshold: 0.1 }
  );
  
  if (mapRef.current) {
    observer.observe(mapRef.current);
  }
  
  return () => observer.disconnect();
}, []);
```

---

### Phase 4: API Optimizations

**Current Issue:** Client fetches data, then renders

**Proposed:** Optimize API responses for performance

1. **GraphQL-style field selection:**
```typescript
// Allow clients to request only needed fields
// GET /api/routes?fields=id,name,waypoints
// Reduces payload size by 60-80%

export async function getRoute(id: string, fields?: string[]) {
  const route = await storage.getRoute(id);
  
  if (fields) {
    return pick(route, fields);
  }
  
  return route;
}
```

2. **API-side data aggregation:**
```typescript
// Instead of: client fetches routes, then waypoints, then status
// GET /api/routes/123
// GET /api/routes/123/waypoints
// GET /api/routes/123/status

// Do: Server aggregates in single response
// GET /api/routes/123?include=waypoints,status
export async function getRouteWithIncludes(id: string, includes: string[]) {
  const [route, waypoints, status] = await Promise.all([
    storage.getRoute(id),
    includes.includes('waypoints') ? storage.getWaypoints(id) : null,
    includes.includes('status') ? getRouteStatus(id) : null,
  ]);
  
  return { route, waypoints, status };
}
```

3. **HTTP/2 Server Push (Azure Static Web Apps supports this):**
```json
// staticwebapp.config.json
{
  "routes": [
    {
      "route": "/dashboard",
      "headers": {
        "Link": "</assets/mapbox.js>; rel=preload; as=script, </assets/azure.js>; rel=preload; as=script"
      }
    }
  ]
}
```

4. **Edge Caching for public routes:**
```typescript
// Cache route data at CDN edge
export async function getPublicRoute(id: string) {
  const route = await storage.getRoute(id);
  
  return {
    route,
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      'CDN-Cache-Control': 'max-age=300',
    },
  };
}
```

---

## Alternative: Migrate to Framework with SSR

If the hybrid approach is insufficient, consider migrating to:

### Option A: Next.js (React SSR Framework)

**Pros:**
- Server-Side Rendering built-in
- Automatic code splitting
- Image optimization
- API routes (could replace Azure Functions)
- Can deploy to Azure Static Web Apps (with adapter)

**Cons:**
- Major refactoring required
- May lose some Azure SWA integration benefits
- Learning curve for team

**Migration Effort:** 2-3 weeks

### Option B: Astro (Static + Islands Architecture)

**Pros:**
- Static generation by default (100 Lighthouse score)
- "Islands" architecture: load React only where needed
- Can use React components (partial migration)
- Excellent performance out-of-box

**Cons:**
- Less mature ecosystem than Next.js
- Interactivity requires careful planning

**Migration Effort:** 1-2 weeks

### Option C: Remix (React SSR + Data Loading)

**Pros:**
- Built for performance
- Progressive enhancement
- Azure deployment support
- Nested routing

**Cons:**
- Different mental model from SPA
- Requires backend rethinking

**Migration Effort:** 2-3 weeks

---

## Recommended Approach

### Immediate (This PR): Quick Wins ✅

Already implemented:
- ✅ Bundle splitting (Mapbox, Azure SDKs separated)
- ✅ Terser minification with console stripping
- ✅ Async font loading
- ✅ Critical CSS inlining
- ✅ Resource hints (preconnect, dns-prefetch)

### Short-term (Next Sprint): Hybrid Architecture

**Priority 1: Static Landing Page**
- Effort: 1 day
- Impact: +15-20 performance points on landing page
- Risk: Low (doesn't touch existing app)

**Priority 2: SSR for Tracking Pages**
- Effort: 2-3 days
- Impact: +15-20 performance points + perfect SEO
- Risk: Medium (new Azure Function + routing changes)

**Priority 3: Lazy Mapbox Loading**
- Effort: 1 day
- Impact: +5-10 performance points on non-map pages
- Risk: Low (progressive enhancement)

### Long-term (Future): Consider Framework Migration

If hybrid approach doesn't reach 90+, evaluate Next.js/Astro migration in Q2 2024.

---

## Success Metrics

### Performance Targets by Page Type

| Page Type | Current | Target | Strategy |
|-----------|---------|--------|----------|
| Landing | 75 | 90+ | Static HTML |
| Tracking | 75 | 90+ | SSR via Azure Function |
| Dashboard | 75 | 85+ | Optimized CSR (acceptable) |
| Route Editor | 75 | 80+ | Optimized CSR (acceptable) |

### Why Different Targets?

- **Landing/Tracking:** Public-facing, SEO-critical → Must be 90+
- **Dashboard/Editor:** Authenticated, feature-rich → 80-85 acceptable for CSR
- Lighthouse penalizes heavy apps (maps, real-time) even with good practices

---

## Implementation Checklist

### Phase 1: Static Landing (This Sprint)
- [ ] Create `/public/landing-static.html`
- [ ] Inline critical CSS (< 14KB)
- [ ] Add progressive enhancement JS
- [ ] Update routing to serve static version
- [ ] Test Lighthouse score (expect 90+)

### Phase 2: SSR Tracking Pages (Next Sprint)
- [ ] Set up React SSR in Azure Function
- [ ] Create `/api/ssr/track/{id}` endpoint
- [ ] Implement route data fetching
- [ ] Generate SEO meta tags server-side
- [ ] Configure Static Web Apps routing
- [ ] Implement client-side hydration
- [ ] Add CDN caching headers
- [ ] Test Lighthouse score (expect 90+)

### Phase 3: Dashboard Optimizations (Ongoing)
- [ ] Implement Intersection Observer for Mapbox
- [ ] Add per-page code splitting
- [ ] Optimize API response sizes
- [ ] Add HTTP/2 server push hints
- [ ] Monitor bundle sizes in CI

---

## Conclusion

**Recommended Path Forward:**

1. **Quick Win:** Implement static landing page (1 day) → Get to 90+ on landing
2. **High Impact:** Add SSR for tracking pages (3 days) → Get to 90+ on public pages  
3. **Continuous:** Optimize dashboard with lazy loading (1 day) → Improve to 80-85

**Total Effort:** 5 days development + 1 day testing = **1 sprint**

**Expected Results:**
- Landing page: 75 → 92+ ⬆️ 17 points
- Tracking pages: 75 → 91+ ⬆️ 16 points  
- Dashboard: 75 → 82+ ⬆️ 7 points

This hybrid approach balances **performance goals** with **development effort** while leveraging existing Azure Functions infrastructure.
