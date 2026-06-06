# CLAUDE.md — Fire Santa Run

Guidance for Claude Code working in this repo. Keep changes minimal, surgical, and consistent with existing patterns.

## What this is

React 19 + TypeScript PWA for Australian Rural Fire Service brigades to plan and track Santa runs with real-time GPS. Public viewers follow Santa live (no login); brigade members plan routes and broadcast location.

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Dev (client + Functions API) | `npm run dev` |
| Dev client only | `npm run dev:client` (Vite, http://localhost:5173) |
| Type check + build | `npm run build` (`tsc -b && vite build`) |
| Lint | `npm run lint` |
| Tests (watch) | `npm test` · run once: `npx vitest run` |
| A11y tests | `npm run test:a11y` |
| Lighthouse audit | `npm run audit:lighthouse` |

Before committing, ensure `npm run lint`, `npx tsc -b`, and `npx vitest run` all pass. Node >= 22 required.

## Architecture map

```
src/
  pages/        Route-level screens (Dashboard, RouteEditor, NavigationView, TrackingView, ...)
  components/   Reusable UI (barrel: components/index.ts)
  context/      AuthContext, BrigadeContext (+ useAuth, useBrigade)
  hooks/        Custom hooks (barrel: hooks/index.ts) — geolocation, navigation, webpubsub, sync, ...
  storage/      Storage adapter pattern — see below
  services/     membershipService, verificationService
  utils/        Helpers (routeHelpers, navigation, membershipRules, ...) — most unit-tested
  types/        index.ts — Route, Waypoint, LiveLocation, RouteAnalytics, etc.
  config/       mapbox.ts
api/            Azure Functions — used by LOCAL dev (npm run dev)
server/         Hono backend — used by PRODUCTION (Azure App Service)
infra/          Bicep IaC + deploy scripts
docs/           Detailed docs (see docs/INDEX.md)
```

> **Two backends, one behavior.** `api/` (Functions) runs locally; `server/` (Hono) runs in production. When changing realtime/auth/storage logic, update BOTH and keep them aligned.

## Core conventions

- **Storage adapter pattern** — never touch `localStorage` or Azure SDKs directly. Always go through `storageAdapter` from `src/storage`. Adapters: `LocalStorageAdapter` (dev) and Azure/HTTP adapters (prod). Keep both adapters in sync when adding fields.
- **Dev mode** — `VITE_DEV_MODE=true` bypasses auth and uses localStorage. Only `VITE_MAPBOX_TOKEN` is required for dev. Gate behavior with `import.meta.env.VITE_DEV_MODE === 'true'`.
- **Named exports + functional components/hooks.** Avoid default exports and class components.
- **Barrel imports** — import from `./components`, `./hooks`, `./context`, `./pages`. Update the relevant `index.ts` when adding a module.
- **Multi-brigade isolation** — data is scoped by `brigadeId` (Azure Table partition key). Never leak data across brigades.
- **Pages are lazy-loaded** in `App.tsx` for code splitting — keep that pattern for new routes.
- **TypeScript strict.** No unjustified `any`.

## UI design intent (preserve this)

The product aims for a slick, modern, information-rich, mobile-first UI with a fun Aussie-summer-Christmas theme. Don't regress it.

- **Design tokens live in `src/index.css` (`:root`)** — use the CSS variables, don't hardcode hex. Key tokens: `--fire-red` `#D32F2F`, `--summer-gold` `#FFA726`, `--christmas-green` `#43A047`; radii `--border-radius*`; shadows `--ui-shadow*`; fonts `--font-heading` (Baloo 2) / `--font-body` (Nunito). Use the WCAG-AA `--summer-gold-dark/darker` variants for text.
- **Mobile-first** (design at 375px), rounded corners, gradient buttons, festive but uncluttered. Target WCAG 2.1 AA — run `npm run test:a11y` after UI changes.

## Planning docs

- `MASTER_PLAN.md` is the project's single source of truth (large — read targeted sections via search/offset, don't load whole). `ROADMAP.md` is also large.
- `.github/copilot-instructions.md` holds the full long-form conventions; this file is the quick version.
- `docs/INDEX.md` indexes the detailed docs by topic.

## Don't

- Don't create new top-level planning docs — extend `MASTER_PLAN.md`.
- Don't commit secrets, tokens, or connection strings.
- Don't commit generated artifacts (lighthouse reports, `dist/`, coverage).
