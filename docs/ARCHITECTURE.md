# Architecture (as-built)

Canonical description of how Fire Santa Run is built and deployed today. For
where the product is heading, see [`../MASTER_PLAN.md`](../MASTER_PLAN.md); for
visual/design rules see [`UI_GUIDELINES.md`](UI_GUIDELINES.md).

## What it is

A React 19 + TypeScript PWA that lets fire brigades (and community
groups worldwide) plan and broadcast Christmas "Santa runs" with real-time GPS,
while the public follows Santa live with no login. Monetised with a per-brigade
Stripe subscription; public live tracking is always free.

## High-level shape

```
Browser (React SPA, PWA)
        │ HTTPS + wss://
        ▼
Azure Container Apps (Consumption, scale-to-zero, single container)
   ├── /api/*   →  Hono server (server/)  ── Azure Table Storage
   │                                        ── in-process realtime WS hub (server/src/realtime/)
   │                                        ── Stripe (checkout, portal, webhook)
   │                                        ── Web Push (VAPID, optional)
   ├── /api/ws  →  native WebSocket upgrade — realtime fan-out (no managed pub/sub service)
   └── /*       →  static React build (dist/) with SPA fallback

Application Insights + Log Analytics
   request tracing, errors, metrics
```

One container image, one process, one Container App — realtime tracking is no
longer a separate managed service; it is fanned out in-process (see "Realtime
tracking" below). This is the whole runtime: no Web PubSub, no App Service.

## Two backends, one behaviour (with one realtime exception)

There are **two API implementations**:

| Path | Runtime | Used by |
| --- | --- | --- |
| `server/` | Hono on Node.js (Azure Container Apps) | **Production** |
| `api/` | Azure Functions v4 | **Local dev** (`npm run dev`) and legacy Functions path |

When you change auth, entitlement, or storage logic, update **both** and keep
them aligned. **Realtime is the one deliberate exception**: `server/` fans out
WebSocket messages natively in-process (`server/src/realtime/`), but Azure
Functions on the Consumption plan cannot hold a persistent native WebSocket
connection the way a plain Node process can — that constraint is exactly why
production moved off Functions in the first place. `api/`'s negotiate/broadcast
routes still use the (retired-from-production) Azure Web PubSub client for that
reason. In practice this doesn't cost local dev anything: `npm run dev` runs
with `VITE_DEV_MODE=true`, so the client uses the `BroadcastChannel` dev-mode
path and never calls `api/`'s realtime routes at all. Don't wire a Web PubSub
resource back in to "fix" this — it's an intentional, harmless divergence.

Production hosting is Azure Container Apps + Hono. The historical Azure Static
Web Apps deployment and the later Azure App Service deployment are both
retired (the legacy SWA workflow now runs quality checks only, and
`staticwebapp.config.json` is not a production deploy target).

## Frontend

- **Pages** (`src/pages/`) are lazy-loaded route screens. Public: Landing,
  BrigadeDiscovery, TrackingView (`/track/:id`), demo (`/demo`), route poster
  (`/routes/:id/poster`). Authed: Dashboard, RouteEditor, NavigationView,
  BrigadeSettings (includes BillingPanel with subscribe option), Analytics,
  Templates, Profile (account info + brigade switcher for multi-org users).
- **Storage adapter pattern** (`src/storage/`) — UI code never touches
  `localStorage` or Azure SDKs directly. `LocalStorageAdapter` backs dev mode;
  the HTTP adapter backs production. Add fields to both.
- **Context** (`src/context/`) — `AuthContext` wraps `src/auth/suiteAuth.ts`,
  the StationKit suite auth client (see "Auth & authorisation" below); dev mode
  bypasses it with a mock admin session. `BrigadeContext` (current brigade +
  `isEntitled` + `refreshBrigade`) auto-provisions the brigade row for the
  user's organization on first load if one doesn't exist yet — see "Brigade =
  organization" below.
- **Realtime** (`src/hooks/useWebPubSub.ts`) — a native `WebSocket` to the
  server's own `/api/ws` endpoint (name kept for history; no Azure Web PubSub
  involved). Viewers connect read-only and anonymously; broadcasters/editors
  present a short-lived signed token minted by the (authenticated) negotiate
  call. `enabled:false` powers the simulated demo run without a backend.
- **PWA** (`src/sw.ts`, injectManifest) — offline caching, background-sync for
  queued broadcasts, and Web Push handlers for "notify me when Santa starts".
- **Audit logging** (`src/utils/auditLog.ts`) — tracks security-relevant events
  (auth, membership changes, admin actions) with server-side batch endpoint
  (`/api/audit/batch`) for compliance. Logs are queued client-side and flushed
  on page teardown via `sendBeacon`.

## Data model & isolation

Azure Table Storage, partitioned by `brigadeId` for multi-brigade isolation —
data must never leak across brigades. Core entities: brigades, routes,
waypoints (two-table split), users (local profile only — see below), push
subscriptions. Dev tables are prefixed `dev-`. There is no membership,
invitation, or verification-request table: brigade membership and role are
governed entirely by Station Manager (see below).

## Auth & authorisation

Fire Santa Run has **no identity system of its own**. It is a member of the
StationKit suite, and Station Manager is the suite's identity/licensing
provider for all three suite apps.

- **Bearer-token federation** — every request carries a Station Manager JWT.
  `validateToken()` (`server/src/utils/auth.ts` / `api/src/utils/auth.ts`)
  validates it by calling `GET {SUITE_AUTH_URL}/api/auth/me` on Station
  Manager (60s in-memory cache); the response's `organizationId` and `role`
  (`owner | admin | viewer`) become the request's `AuthResult`. `DEV_MODE`
  bypasses this with a mock `owner`/`admin` session.
- **Silent cross-subdomain SSO** — the client first tries
  `GET {SUITE_AUTH_URL}/api/auth/session` with `credentials: 'include'`
  (`src/auth/suiteAuth.ts` → `restoreSession()`), which reads Station
  Manager's shared `sk_session` httpOnly cookie (scoped to
  `.stationkit.com.au`) and returns a fresh bearer token — no separate Santa
  Run login needed if the visitor is already signed in elsewhere in the
  suite. Falls back to a locally stored token, then to the login page.
- **Brigade = organization** — a brigade's `id` **is** the Station Manager
  `organizationId`; there is no separate claiming step. `BrigadeContext`
  auto-provisions the brigade row (name/branding placeholders) the first time
  a user from that organization loads the app.
- Public read paths stay anonymous (tracking, viewer negotiate, analytics
  counts, brigade discovery).
- Write/privileged paths require a valid token plus `checkBrigadeAccess()`:
  the token's `organizationId` must equal the target `brigadeId`, and its
  `role` must carry the required permission (`ROLE_PERMISSIONS`: `owner`/
  `admin` can manage routes, edit settings, and start navigation; `viewer`
  cannot). There is no per-user membership row to look up — the SM token's
  own claims are the source of truth.
- Realtime broadcaster/editor tokens additionally require route ownership and
  brigade entitlement.

## Billing & entitlement

Two independent-but-OR'd entitlement paths, reflecting that Santa Run sells
both as a suite add-on and as a standalone product:

- **Suite entitlement** — Station Manager orgs on a paying plan (`basic`/`ai`)
  get `santaRunEnabled: true` for free; `community`-plan orgs can buy it as a
  standalone add-on ($10/year or $15/one-off month) from their SM
  organization settings. Either way, the SM `/api/auth/me` response's
  `santaRunEnabled` flag is OR'd into every entitlement check
  (`!authResult.santaRunEnabled && !(await isBrigadeEntitled(...))`).
- **Per-brigade subscription** (pre-existing, kept as-is) — Stripe Checkout,
  SAQ-A, scoped to a single brigade regardless of suite plan. The
  **signature-verified webhook is the only writer** of entitlement fields on
  the brigade record (`subscriptionStatus`, `subscribedUntil`, `stripe*`).
  Brigade PUTs never touch those fields. This path is unaffected by the suite
  auth migration — it exists so a brigade can use Santa Run without any
  Station Manager subscription at all.
- Entitlement is enforced server-side (402 on route create/edit and
  broadcaster/editor negotiate) and mirrored client-side to drive UX — the
  `SubscriptionGate` stops unentitled brigades at the editor door instead of
  letting them hit a wall on save.
- Live price is read from Stripe (`/api/stripe/price`) so the UI never goes
  stale; a static fallback prevents a blank price.

## Realtime tracking

Realtime fan-out is **in-process** — `server/src/realtime/`:

- `hub.ts` — per-route sets of viewer / broadcaster / editor WebSocket
  connections, held in memory. Fan-out is a loop over a `Set`; there is no
  per-message cost and no separate service to configure.
- `wsServer.ts` — the `/api/ws` upgrade handler, attached to the same Node
  HTTP server as the API. Anonymous for viewers; broadcaster/editor
  connections must present a signed token (see `wsToken.ts`) because browsers
  cannot set an `Authorization` header on a WebSocket handshake — the
  authenticated `negotiate` call mints that token and embeds it in the
  `wss://` URL it returns. Heartbeat ping/pong drops dead connections
  (dropped rural coverage, closed tabs) so viewer counts stay accurate.
- `wsToken.ts` — short-lived HMAC token, `{routeId, role, exp}`, verified with
  a timing-safe comparison. Secret resolves from `REALTIME_WS_SECRET` if set,
  else a hash of the Storage connection string (always present in prod) —
  no new required config.

Flow: the navigator device POSTs GPS to `/api/broadcast`; the server fans it
out via `hub.broadcastLocation()` to every open `/api/ws` viewer connection for
that route. The first broadcast of a run also triggers one "Santa has started"
Web Push to that route's subscribers. See
[`REALTIME_TRACKING.md`](REALTIME_TRACKING.md).

**Scaling constraint — read before raising `maxReplicas`:** the hub's state is
per-process. The Container App is pinned to `maxReplicas: 1` (see
`infra/modules/containerapps.bicep`) so every connection for a route lands on
the same instance; a second replica would not see the first one's connections
and would silently split fan-out. Raise it only after adding a shared
backplane (e.g. Redis pub/sub) for the hub — tracked as a roadmap item in
[`../MASTER_PLAN.md`](../MASTER_PLAN.md).

## Infrastructure

Bicep IaC in `infra/` provisions Azure Container Apps (Consumption,
scale-to-zero), Table Storage, and Application Insights — see
[`../infra/README.md`](../infra/README.md) and
[`infra/modules/containerapps.bicep`](../infra/modules/containerapps.bicep).

- `Dockerfile` (repo root) — multi-stage build: React SPA (Vite), Hono server
  (tsc), then a minimal runtime image. Built by CI and pushed to GitHub
  Container Registry with commit SHA as tag. Bakes `COMMIT_SHA` into the image
  for deployment verification.
- `.github/workflows/deploy-container-apps.yml` — unified CI/CD pipeline:
  - Change detection: detects IaC and code changes to skip unnecessary work.
  - Quality checks (lint, type-check, unit tests) and E2E tests (Playwright).
  - Deployment (infrastructure + image + secrets) only on push to main.
  - GitHub OIDC federated credentials for Azure login (no stored secrets).
  - Health check verification: polls `/api/health` and verifies commit SHA
    matches before marking deployment successful (prevents silent failures).
  - Conditional execution: skips Bicep deploy if only code changed, skips
    image build if only IaC changed.
- `deploy.sh` — provisions the Bicep stack per environment (dev/prod are fully
  separate deployments, matching Stripe test vs live mode) and seeds base
  config.
- `seed-secrets.sh` — seeds Container App env vars (Stripe, site-admin, VAPID,
  the realtime WS secret) with a merge strategy that never blanks an existing
  secret. Called automatically by the workflow after deployment.
- `scale-season.sh` — flips the Container App's `minReplicas` between 1
  (December — always warm, no cold starts mid-run) and 0 (off-season —
  scale-to-zero).

## CI/CD & Deployment

GitHub Actions unified pipeline (`.github/workflows/deploy-container-apps.yml`):

1. **Change detection** — Git diff determines if IaC (Bicep, Dockerfile) or code changed. Allows conditional execution and cost savings by skipping unnecessary work.
2. **Quality gates** (every push + PR):
   - Lint (ESLint)
   - Type check (TypeScript)
   - Unit tests (Vitest)
   - E2E tests (Playwright)
3. **Deployment** (main branch push only):
   - Validate Azure OIDC config (fail-fast).
   - Deploy infrastructure (Bicep) if IaC changed.
   - Build and push Docker image if code changed; image tagged with commit SHA.
   - Deploy image revision to Container Apps.
   - Seed secrets to Container App (Stripe, VAPID, realtime WS secret).
   - **Health check verification:** polls `/api/health` every 10 seconds for up to 2 minutes, verifies returned `commitSha` matches deployed commit. Workflow fails if verification doesn't pass, preventing deployments with silent failures.

**Security & secrets:**
- GitHub OIDC federated credentials (workload identity federation) — no long-lived secrets stored in GitHub.
- Secrets (Stripe keys, VAPID, site-admin IDs) sourced from:
  - Local `infra/.env.<env>` files (gitignored) during manual runs.
  - GitHub Actions secrets for CI/CD runs.
- Storage connection string read live from deployed resource (no hardcoding or versioning).

**Environments:** dev and prod are fully separate Azure subscriptions / deployments, matching Stripe test vs live mode.

## Testing

Vitest unit/integration tests (`src/**/__tests__`), a11y tests
(`npm run test:a11y`), and Playwright E2E (`e2e/`). Both backends typecheck;
`npm run build` produces the client bundle the container serves.
