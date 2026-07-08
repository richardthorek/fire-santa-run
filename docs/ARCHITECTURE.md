# Architecture (as-built)

Canonical description of how Fire Santa Run is built and deployed today. For
where the product is heading, see [`../MASTER_PLAN.md`](../MASTER_PLAN.md); for
visual/design rules see [`UI_GUIDELINES.md`](UI_GUIDELINES.md).

## What it is

A React 19 + TypeScript PWA that lets Rural Fire Service brigades (and community
groups worldwide) plan and broadcast Christmas "Santa runs" with real-time GPS,
while the public follows Santa live with no login. Monetised with a per-brigade
Stripe subscription; public live tracking is always free.

## High-level shape

```
Browser (React SPA, PWA)
        │ HTTPS
        ▼
Azure App Service (Linux, Node 22)
   ├── /api/*   →  Hono server (server/)  ── Azure Table Storage
   │                                        ── Azure Web PubSub (realtime token + broadcast)
   │                                        ── Stripe (checkout, portal, webhook)
   │                                        ── Web Push (VAPID, optional)
   └── /*       →  static React build (dist/) with SPA fallback

Azure Web PubSub (WebSockets)     Application Insights + Log Analytics
   Hub: santa_tracking               request tracing, errors, metrics
   Group: route_{routeId}
```

## Two backends, one behaviour

There are **two API implementations that must stay in sync**:

| Path | Runtime | Used by |
| --- | --- | --- |
| `server/` | Hono on Node.js (Azure App Service) | **Production** |
| `api/` | Azure Functions v4 | **Local dev** (`npm run dev`) and legacy Functions path |

When you change auth, entitlement, realtime, or storage logic, update **both**
and keep them aligned. Production hosting is App Service + Hono; the historical
Azure Static Web Apps deployment has been retired (the SWA workflow now runs
quality checks only, and `staticwebapp.config.json` is not a production deploy
target).

## Frontend

- **Pages** (`src/pages/`) are lazy-loaded route screens. Public: Landing,
  BrigadeDiscovery, TrackingView (`/track/:id`), demo (`/demo`), route poster
  (`/routes/:id/poster`). Authed: Dashboard, RouteEditor, NavigationView,
  BrigadeSettings, MemberManagement, Analytics, Templates.
- **Storage adapter pattern** (`src/storage/`) — UI code never touches
  `localStorage` or Azure SDKs directly. `LocalStorageAdapter` backs dev mode;
  the HTTP adapter backs production. Add fields to both.
- **Context** (`src/context/`) — `AuthContext` (MSAL/Entra, dev bypass) and
  `BrigadeContext` (current brigade + `isEntitled` + `refreshBrigade`).
- **Realtime** (`src/hooks/useWebPubSub.ts`) — viewers connect read-only;
  broadcasters/editors get privileged tokens. `enabled:false` powers the
  simulated demo run without a backend.
- **PWA** (`src/sw.ts`, injectManifest) — offline caching, background-sync for
  queued broadcasts, and Web Push handlers for "notify me when Santa starts".

## Data model & isolation

Azure Table Storage, partitioned by `brigadeId` for multi-brigade isolation —
data must never leak across brigades. Core entities: brigades, routes,
waypoints (two-table split), memberships, invitations, users, verification
requests, push subscriptions. Dev tables are prefixed `dev-`.

## Auth & authorisation

- Microsoft Entra External ID (CIAM) tokens, validated server-side; `DEV_MODE`
  bypasses auth and uses localStorage.
- Public read paths stay anonymous (tracking, viewer negotiate, analytics
  counts, brigade discovery).
- Write/privileged paths require a valid token plus one of: **self-match**
  (act only on your own user record), **brigade permission** (role-based via
  `checkBrigadePermission`), or the **site-admin allowlist**
  (`SITE_ADMIN_USER_IDS`) for verification review.
- Realtime broadcaster/editor tokens additionally require route ownership and
  brigade entitlement.

## Billing & entitlement

- Per-brigade subscription (Stripe Checkout, SAQ-A). The **signature-verified
  webhook is the only writer** of entitlement fields on the brigade record
  (`subscriptionStatus`, `subscribedUntil`, `stripe*`). Brigade PUTs never
  touch those fields.
- Entitlement is enforced server-side (402 on route create/edit and
  broadcaster/editor negotiate) and mirrored client-side to drive UX — the
  `SubscriptionGate` stops unentitled brigades at the editor door instead of
  letting them hit a wall on save.
- Live price is read from Stripe (`/api/stripe/price`) so the UI never goes
  stale; a static fallback prevents a blank price.

## Realtime tracking

Navigator device POSTs GPS to `/api/broadcast`; the server fans it out via
Azure Web PubSub group `route_{routeId}` to every viewer's WebSocket. The first
broadcast of a run also triggers one "Santa has started" Web Push to that
route's subscribers. See [`REALTIME_TRACKING.md`](REALTIME_TRACKING.md).

## Infrastructure

Bicep IaC in `infra/` provisions App Service, Table Storage, Web PubSub, and
Application Insights. `deploy.sh` deploys per environment (dev/prod are fully
separate deployments, matching Stripe test vs live mode); `seed-secrets.sh`
seeds app settings (Stripe, site-admin, VAPID) with a merge strategy that never
blanks an existing secret; `scale-season.sh` flips Web PubSub between the
December (Standard_S1) and off-season (Free_F1) profiles. See
[`../infra/README.md`](../infra/README.md).

## Testing

Vitest unit/integration tests (`src/**/__tests__`), a11y tests
(`npm run test:a11y`), and Playwright E2E (`e2e/`). Both backends typecheck;
`npm run build` produces the client bundle the App Service serves.
