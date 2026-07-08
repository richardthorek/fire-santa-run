# Docs Index

Topic map for `docs/`. Read the file that matches your topic instead of scanning the whole folder.

## Start here (canonical, kept current)

- [`../MASTER_PLAN.md`](../MASTER_PLAN.md) — concise forward-looking product plan (vision, current state, roadmap, decisions)
- [ARCHITECTURE.md](ARCHITECTURE.md) — as-built architecture (App Service + Hono prod, Functions local dev, storage, realtime, billing, push)
- [UI_GUIDELINES.md](UI_GUIDELINES.md) — design tokens, brand, per-surface device targets, accessibility, copy
- [`../infra/README.md`](../infra/README.md) — deployment, secrets seeding, seasonal scaling
- [`../CLAUDE.md`](../CLAUDE.md) — quick working conventions for this repo

## Getting started & dev
- [DEV_MODE.md](DEV_MODE.md) — local dev mode (`VITE_DEV_MODE`), localStorage, no-auth flow
- [MANUAL_TESTING_CHECKLIST.md](MANUAL_TESTING_CHECKLIST.md) — manual QA checklist

## Launch (v1.0)
- [BRIGADE_ADMIN_ONBOARDING.md](BRIGADE_ADMIN_ONBOARDING.md) — admin getting-started guide (claim → invite → route → share → go live)
- [SECURITY_REVIEW_LAUNCH.md](SECURITY_REVIEW_LAUNCH.md) — pre-launch security review & sign-off (#342)
- E2E tests: `e2e/` (Playwright) — `npm run test:e2e`

## Authentication & membership
- [API_AUTHENTICATION.md](API_AUTHENTICATION.md) — API auth model
- [AUTHENTICATION_BUSINESS_RULES.md](AUTHENTICATION_BUSINESS_RULES.md) — business rules for auth
- [AUTHENTICATION_PLANNING_SUMMARY.md](AUTHENTICATION_PLANNING_SUMMARY.md)
- [AUTHENTICATION_TROUBLESHOOTING.md](AUTHENTICATION_TROUBLESHOOTING.md)
- [DEBUGGING_NO_AUTH_TOKEN.md](DEBUGGING_NO_AUTH_TOKEN.md)
- [MEMBERSHIP_SYSTEM.md](MEMBERSHIP_SYSTEM.md) — membership/roles system
- [CLAIM_BRIGADE_FIX.md](CLAIM_BRIGADE_FIX.md)

## Infrastructure, secrets & deployment
- [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) — env vars & secrets
- [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- (Azure infra: see [`../infra/README.md`](../infra/README.md))

## Realtime tracking & navigation
- [REALTIME_TRACKING.md](REALTIME_TRACKING.md) — Web PubSub live tracking architecture
- [NAVIGATION_QUICK_REFERENCE.md](NAVIGATION_QUICK_REFERENCE.md)
- [NAVIGATION_UI_CHANGES.md](NAVIGATION_UI_CHANGES.md)

## RFS dataset integration
- [RFS_DATASET.md](RFS_DATASET.md)
- [RFS_INTEGRATION_EXAMPLES.md](RFS_INTEGRATION_EXAMPLES.md)
- [RFS_IMPLEMENTATION_SUMMARY.md](RFS_IMPLEMENTATION_SUMMARY.md)

## UI, design system & accessibility
- [BUTTON_SYSTEM.md](BUTTON_SYSTEM.md) — button component system
- [VISUAL_OVERHAUL_SUMMARY.md](VISUAL_OVERHAUL_SUMMARY.md)
- [ACCESSIBILITY_README.md](ACCESSIBILITY_README.md)
- [ACCESSIBILITY_AUDIT.md](ACCESSIBILITY_AUDIT.md)
- [KEYBOARD_NAVIGATION.md](KEYBOARD_NAVIGATION.md)

## Performance
- [PERFORMANCE_OPTIMIZATION_STRATEGY.md](PERFORMANCE_OPTIMIZATION_STRATEGY.md)

## CI / workflows
- [WORKFLOW_ANALYSIS.md](WORKFLOW_ANALYSIS.md)
- [WORKFLOW_REFACTORING_SUMMARY.md](WORKFLOW_REFACTORING_SUMMARY.md)
- [WORKFLOW_FAILURE_REPORTING.md](WORKFLOW_FAILURE_REPORTING.md)
- [AUTO_BUG_ISSUE_SUMMARY.md](AUTO_BUG_ISSUE_SUMMARY.md)
- [WORKFLOW_FIX_RUN55.md](WORKFLOW_FIX_RUN55.md) · [WORKFLOW_FIX_RUN77.md](WORKFLOW_FIX_RUN77.md)

## Archive — point-in-time records (may name retired approaches, e.g. Static Web Apps)

These are historical logs kept for provenance. For current guidance use the canonical docs at the top; where an archive doc conflicts with them, the canonical doc wins.

- Phases: [PHASE_1_SUMMARY.md](PHASE_1_SUMMARY.md) · [PHASE2_SUMMARY.md](PHASE2_SUMMARY.md) · [README_PHASE2.md](README_PHASE2.md) · [PHASE3_SUMMARY.md](PHASE3_SUMMARY.md) · [PHASE4_SUMMARY.md](PHASE4_SUMMARY.md) · [PHASE5_SUMMARY.md](PHASE5_SUMMARY.md) · [PHASE6_SUMMARY.md](PHASE6_SUMMARY.md) · [PHASE_7A_SUMMARY.md](PHASE_7A_SUMMARY.md)
- Releases: [RELEASE_1_SUMMARY.md](RELEASE_1_SUMMARY.md) · [RELEASE_2_1_SUMMARY.md](RELEASE_2_1_SUMMARY.md)
- Workflow fix logs and visual/auth summaries elsewhere in this folder are similarly historical.
