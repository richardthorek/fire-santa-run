# Development Mode Guide

## Overview

Fire Santa Run supports **Development Mode** so you can work on the app with
no Azure account and no Station Manager sign-in. This guide explains how to
use it.

## Why Development Mode?

- Build and test features without setting up Station Manager auth first
- No cloud account required for local iteration — everything runs on your
  machine (Vite, `server/`, and Azurite as a local Table Storage emulator)
- Easy demos and previews without account management
- Simpler test setup (no auth mocking needed)

## Security rationale

**Why is this safe for Fire Santa Run?**

1. Public tracking is intentionally public by design — anyone can view
   Santa's location with no login, in production too.
2. Dev mode is disabled in production: `DEV_MODE`/`VITE_DEV_MODE` default to
   `false`, and the deploy pipeline never sets them to `true`.
3. Dev mode uses mock identity and local/emulated data, never real brigade
   or Station Manager credentials.

## Two independent dev-mode flags

There are **two** `DEV_MODE` flags, one per process, and both matter for a
full local setup:

| Flag | Where | Effect when `true` |
|---|---|---|
| `VITE_DEV_MODE` | Client (Vite/browser) | `AuthContext` uses a mock signed-in admin instead of calling Station Manager; `storageAdapter` (`src/storage/index.ts`) uses `LocalStorageAdapter` — all route/waypoint/brigade CRUD stays in the browser's `localStorage`, unchanged, and never calls `server/` |
| `DEV_MODE` | Server (`server/`) | `validateToken()` returns a mock `owner`/`admin` session instead of calling Station Manager's `/api/auth/me`; `storage.ts` defaults to Azurite's well-known connection string if no explicit one is set |

`npm run dev` sets both automatically (see `package.json`'s `dev:client` /
`dev:server` scripts) — you don't need to configure this yourself for normal
local work.

> **What removing `api/` actually changed:** the frontend's dev-mode storage
> path (`VITE_DEV_MODE=true` → `LocalStorageAdapter`) is unchanged — it never
> talked to `api/` and still doesn't talk to `server/`. What changed is that
> `server/` (the same Hono backend production runs) is now the *only* backend
> implementation, used for local dev too, instead of a second, separately
> maintained Functions app (`api/`) that the frontend's HTTP adapter used to
> proxy to when dev mode was off. `server/` + Azurite matter locally for: (a)
> developing/testing `server/` itself directly; (b) calls the frontend makes
> to the backend regardless of dev mode — e.g. push-notification key
> fetches, audit-log beacons — which now hit a real local backend instead of
> a dead `localhost:7071` proxy target; and (c) the `VITE_DEV_MODE=false`
> integration-testing path below, where `HttpStorageAdapter` does talk to
> `server/` for real.

## Local development setup

### Prerequisites

- Node.js 22+
- A Mapbox token (`VITE_MAPBOX_TOKEN`) — the only thing you must supply yourself; get one free at [mapbox.com](https://account.mapbox.com/auth/signup/)

### Setup

```bash
cp .env.example .env.local
echo "VITE_MAPBOX_TOKEN=pk.your_token" >> .env.local

npm run setup   # installs root + server/ dependencies
npm run dev     # starts Azurite, server/, and the Vite frontend together
```

`npm run dev` runs three processes concurrently (see `package.json`):

- `dev:storage` — Azurite (`azurite-table`), a local, offline Table Storage
  emulator. `server/` defaults to its well-known connection string
  automatically when `DEV_MODE=true` and no real connection string is set
  (`server/src/utils/storage.ts`) — nothing to configure.
- `dev:server` — `server/` itself (`tsx watch`), with `DEV_MODE=true`.
- `dev:client` — Vite, the React frontend, with `VITE_DEV_MODE=true` (from
  `.env.local`).

Open http://localhost:5173 — you're signed in as a mock admin for
`dev-brigade-1`, no login screen, and data persists in Azurite between
restarts (until you clear its local data files — see `.gitignore`).

### Testing against real Station Manager / real Azure Storage instead

Sometimes you want to test the real integration rather than the mocks —
e.g. verifying the Station Manager auth flow, or checking behaviour against
a real dev Azure Storage account shared with the team:

```bash
# .env.local
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.your_token
```

and, for `server/`, either export `DEV_MODE=false` (or just don't set it —
it defaults to false) before running `dev:server` on its own. With
`DEV_MODE=false`, `server/` requires a real `AZURE_STORAGE_CONNECTION_STRING`
(a real Azure account, or a dev account with `dev`-prefixed tables — see
`server/src/routes/*.ts`'s `isDevMode ? 'dev-...' : '...'` table-name
pattern, which is a *separate* mechanism from the `DEV_MODE` flag and still
applies) and validates bearer tokens against the real `SUITE_AUTH_URL`
(defaults to `https://stationkit.com.au`), so you'll need an actual Station
Manager account and a real bearer token to exercise authenticated routes.

## Implementation patterns

### Auth bypass (client)

```typescript
// src/context/AuthContext.tsx (simplified)
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

if (isDevMode) {
  // Mock signed-in owner/admin, no Station Manager round-trip.
} else {
  // Real flow: src/auth/suiteAuth.ts — silent SSO via Station Manager's
  // shared session cookie, falling back to a stored token or /login.
}
```

### Auth bypass (server)

```typescript
// server/src/utils/auth.ts (simplified)
export async function validateToken(request: Request): Promise<AuthResult> {
  if (isDevMode) {
    return { authenticated: true, userId: 'dev-user-1', organizationId: 'dev-brigade-1', role: 'admin', santaRunEnabled: true };
  }
  // Real flow: calls Station Manager's GET /api/auth/me with the caller's bearer token.
}
```

### Storage default (server)

```typescript
// server/src/utils/storage.ts (simplified)
export const STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ||
  (isDevMode ? AZURITE_CONNECTION_STRING : '');
```

## Testing

### Unit tests

`vitest.config.ts` / test setup already runs with dev-mode semantics where
relevant — no auth mocking needed in most component tests.

### E2E tests

Playwright (`npm run test:e2e`) runs against `VITE_DEV_MODE=true` and starts
only the Vite dev server (`playwright.config.ts`'s `webServer.command` is
`npm run dev:client`) — it does not start `server/` or Azurite. This means
E2E tests exercise the frontend's dev-mode paths, not the real backend; there
is currently no automated end-to-end coverage of `server/` itself (tracked as
a gap — see `MASTER_PLAN.md`).

## Troubleshooting

### "Azure Storage connection string not configured" in dev mode

`server/`'s Azurite default only applies when `DEV_MODE=true` is actually
set on that process. If you're running `server/` directly (not via
`npm run dev`), make sure you export `DEV_MODE=true` first, and that
Azurite is actually running (`npm run dev:storage` in another terminal).

### Features not accessible in production

**Cause:** `VITE_DEV_MODE` or `DEV_MODE` is still `true`.
**Solution:** confirm both are unset (or `false`) in the deployed
environment — `infra/seed-secrets.sh` always sets the server one to
`false`; check the Container App's build args for the client one.

### Tests failing with authentication errors

Set `VITE_DEV_MODE=true` (client) in the test environment/setup file.

## Best practices

### ✅ Do this

- Use dev mode for all local development and automated testing
- Keep `DEV_MODE=false` in every deployed environment
- Test the real Station Manager flow occasionally, not just the mock

### ❌ Don't do this

- Don't commit real credentials to `.env.local`
- Don't store real brigade data via the dev-mode/Azurite path
- Don't assume dev-mode behaviour matches production auth exactly — it's a
  convenience bypass, not a faithful simulation of Station Manager's actual
  session/token semantics

## Resources

- [MASTER_PLAN.md](../MASTER_PLAN.md) — product plan and current state
- [ARCHITECTURE.md](ARCHITECTURE.md) — as-built architecture, auth & storage
- [.env.example](../.env.example) — environment variable reference
- [infra/README.md](../infra/README.md) — production deployment, secrets
