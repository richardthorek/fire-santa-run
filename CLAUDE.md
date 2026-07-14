# CLAUDE.md — Fire Santa Run

Guidance for Claude Code working in this repo. Keep changes minimal, surgical, and consistent with existing patterns.

## What this is

React 19 + TypeScript PWA for Australian fire brigades and community groups to plan and track Santa runs with real-time GPS. Public viewers follow Santa live (no login); brigade members plan routes and broadcast location.

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
server/         Hono backend — used by PRODUCTION (Azure Container Apps); realtime WS hub lives in server/src/realtime/
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

The product aims for a slick, modern, information-rich UI with a fun Aussie-summer-Christmas theme. Don't regress it. Full rules: **[`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md)**.

- **Design tokens live in `src/index.css` (`:root`)** — use the CSS variables, don't hardcode hex. Key tokens: `--fire-red` `#D32F2F`, `--summer-gold` `#FFA726`, `--christmas-green` `#43A047`; radii `--border-radius*`; shadows `--ui-shadow*`; fonts `--font-heading` (Baloo 2) / `--font-body` (Nunito). Use the WCAG-AA `--summer-gold-dark/darker` variants for text.
- **Design each surface for its user**: public tracking, the demo, and the navigator (in-truck) view are **mobile-first** (design at 375px); the **route editor and dashboard are tablet/desktop-first** (planning is a lean-back task). Rounded corners, gradient buttons, festive but uncluttered. Target WCAG 2.1 AA — run `npm run test:a11y` after UI changes.

## Key docs (keep these current)

- **[`MASTER_PLAN.md`](MASTER_PLAN.md)** — concise forward-looking product plan (vision, current state, roadmap, open decisions). Start here for "what next".
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — as-built architecture (Container Apps + Hono prod, Functions local dev, in-process realtime WS, storage, billing, push).
- **[`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md)** — design tokens, brand, per-surface device targets, accessibility, copy.
- **[`docs/INDEX.md`](docs/INDEX.md)** — topic map for the rest of `docs/` (current vs archive).
- **[`infra/README.md`](infra/README.md)** — deployment, secrets seeding, seasonal scaling.
- `.github/copilot-instructions.md` holds the full long-form conventions; this file is the quick version.

Production runs on **Azure Container Apps + Hono** (`server/`), scale-to-zero, single container built from the root `Dockerfile`. Both Azure Static Web Apps and Azure App Service are retired — don't reintroduce either as the deploy target. Realtime tracking is native WebSocket fanned out in-process (`server/src/realtime/`), not a managed pub/sub service — see `docs/ARCHITECTURE.md` before touching realtime code, especially the single-replica (`maxReplicas: 1`) constraint.

## Don't

- Don't create new top-level planning docs — extend `MASTER_PLAN.md`.
- Don't commit secrets, tokens, or connection strings.
- Don't commit generated artifacts (lighthouse reports, `dist/`, coverage).
