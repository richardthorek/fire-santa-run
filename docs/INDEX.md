# Docs Index

Topic map for `docs/`. Read the file that matches your topic instead of scanning the whole folder.

> **2026-07-19 cleanup:** ~45 stale/point-in-time docs were deleted outright
> rather than archived: phase summaries, one-off fix logs, superseded Static
> Web Apps/Functions-only setup guides, a duplicate pre-`MASTER_PLAN.md`
> roadmap, and — the important one — `ADMIN_USER_GUIDE.md`,
> `MEMBERSHIP_SYSTEM.md`, `API_AUTHENTICATION.md`,
> `AUTHENTICATION_BUSINESS_RULES.md`, and `AUTHENTICATION_TROUBLESHOOTING.md`,
> which all described the local Entra CIAM sign-in and membership/invitation
> system retired in #388 (2026-07-19) in favour of delegating identity to
> Station Manager. None of those five were updated when #388 shipped, so they
> were describing a system that no longer exists. `BRIGADE_ADMIN_ONBOARDING.md`
> had the same problem in its first three sections only (sign-in/claim/invite)
> — those were rewritten in place rather than deleting the whole doc, since
> the rest (profile, routes, sharing, going live) was still accurate. Git
> history has the deleted files if anyone needs the record.
>
> **2026-09 cleanup:** `api/` (the Azure Functions local-dev backend) was
> retired — `server/` (Hono) is now used for local dev too, pre-launch, so
> there is exactly one backend implementation instead of two kept in sync by
> hand. `SECRETS_MANAGEMENT.md` and `GITHUB_SECRETS_SETUP.md` were deleted:
> both predated the Container Apps migration and documented a Vercel/Netlify/
> Azure-App-Service/Static-Web-Apps deployment model that hasn't been true
> for some time — `../infra/README.md`'s "After Deployment — Configure CI +
> Secrets" section is the accurate, current version of that same content and
> was already the source of truth in practice. `DEV_MODE.md` and
> `ARCHITECTURE.md` were rewritten for the single-backend, Azurite-for-local-
> storage setup. Everything below is believed current as of that date.
>
> **Known gap:** there is currently no dedicated "how brigade membership
> works now" doc — see the roadmap in `MASTER_PLAN.md`.

## Start here (canonical, kept current)

- [`../MASTER_PLAN.md`](../MASTER_PLAN.md) — concise forward-looking product plan (vision, current state, roadmap, decisions)
- [ARCHITECTURE.md](ARCHITECTURE.md) — as-built architecture (Container Apps + Hono, one backend for prod and local dev, storage, realtime, billing, push, StationKit suite identity)
- [UI_GUIDELINES.md](UI_GUIDELINES.md) — design tokens, brand, per-surface device targets, accessibility, copy
- [`../infra/README.md`](../infra/README.md) — deployment, secrets seeding (incl. GitHub Actions secrets/variables), seasonal scaling, Entra setup
- [`../CLAUDE.md`](../CLAUDE.md) — quick working conventions for this repo

## User documentation

- [BRIGADE_ADMIN_ONBOARDING.md](BRIGADE_ADMIN_ONBOARDING.md) — a brigade volunteer's first-time setup walkthrough (sign in → route → share → go live). Membership/roles are managed in Station Manager — see that suite's own admin guide, linked from this doc.

## Getting started & dev

- [DEV_MODE.md](DEV_MODE.md) — local dev mode (`VITE_DEV_MODE`/`DEV_MODE`), Azurite, no-auth flow
- [MANUAL_TESTING_CHECKLIST.md](MANUAL_TESTING_CHECKLIST.md) — manual QA checklist

## Launch / security

- [SECURITY_REVIEW_LAUNCH.md](SECURITY_REVIEW_LAUNCH.md) — pre-launch security review & sign-off record (#342). Predates the #388 identity migration — treat findings about the old auth system as historical.
- [ADMIN_PORTAL.md](ADMIN_PORTAL.md) — the `/admin` platform-admin portal, Azure AI Content Safety moderation of public run/brigade names + logos, and `Brigade.publicListing` directory visibility
- E2E tests: `e2e/` (Playwright) — `npm run test:e2e`

## Infrastructure, secrets & deployment

- [`../infra/README.md`](../infra/README.md) — the single source of truth: Azure infra, GitHub Actions secrets/variables, Container App env vars, seasonal scaling, ops alert email setup
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)

## Realtime tracking & navigation

- Realtime architecture is documented in [ARCHITECTURE.md](ARCHITECTURE.md) (native in-process WebSocket — not a separate doc; a standalone `REALTIME_TRACKING.md` describing the retired Web PubSub-in-production design was deleted 2026-07-19)
- [NAVIGATION_QUICK_REFERENCE.md](NAVIGATION_QUICK_REFERENCE.md) — turn-by-turn navigation UI reference

## Fire station dataset integration

- [FIRE_STATION_DATASET.md](FIRE_STATION_DATASET.md)
- [FIRE_STATION_INTEGRATION_EXAMPLES.md](FIRE_STATION_INTEGRATION_EXAMPLES.md)

## UI, design system & accessibility

- [BUTTON_SYSTEM.md](BUTTON_SYSTEM.md) — button component system
- [ACCESSIBILITY_README.md](ACCESSIBILITY_README.md)
- [ACCESSIBILITY_AUDIT.md](ACCESSIBILITY_AUDIT.md)
- [KEYBOARD_NAVIGATION.md](KEYBOARD_NAVIGATION.md)

## Performance

- [PERFORMANCE_OPTIMIZATION_STRATEGY.md](PERFORMANCE_OPTIMIZATION_STRATEGY.md)

## CI / workflows

- [WORKFLOW_ANALYSIS.md](WORKFLOW_ANALYSIS.md)
- [WORKFLOW_FAILURE_REPORTING.md](WORKFLOW_FAILURE_REPORTING.md)
