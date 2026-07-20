# Fire Santa Run — Master Plan

The single forward-looking guide for the product: what it is, where it stands,
and what comes next. It is deliberately short and consumable — read it to decide
the next move.

- **How it's built (as-built):** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **How it should look:** [`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md)
- **Deep-dive docs by topic:** [`docs/INDEX.md`](docs/INDEX.md)
- **Infra & deployment:** [`infra/README.md`](infra/README.md)

---

## Vision

Make the community Santa run — a fire brigade or community group taking Santa
around town at Christmas — effortless to organise and magical to follow. The
truck moves; families watch Santa cross the map in real time on any phone, with
no app and no login. Born in Australia (fire brigades on fire trucks under the
summer sun), built for Santa runs everywhere.

Two users, weighted very differently on the night:

1. **The public** — parents and kids following Santa live. ~95%+ of traffic on
   run night. Mobile-first, zero friction, always free.
2. **The organiser** — a brigade volunteer planning the route and broadcasting
   from the truck. Fewer people, higher intent. Planning is a tablet/desktop
   task; broadcasting is a mounted-phone task.

## Business model

- **Public tracking is free, forever.** It is both the right thing and the
  growth engine — every shared link and QR poster markets the paid side.
- **Fire Santa Run has no billing of its own** (retired 2026-07-19 — see
  "StationKit suite identity" below; the prior A$5/yr per-brigade Stripe
  subscription is gone). Route planning and live broadcasting are unlocked
  entirely by `santaRunEnabled` on the caller's Station Manager organisation.
- **Suite entitlement (StationKit) is the only path.** Station Manager orgs
  on a paying plan (`basic`/`ai`) get Santa Run included free; `community`-plan
  orgs can add it standalone for **$10/year (unlimited use) or $15 for a
  one-off month** — bought from the org's Station Manager billing page, not
  from this repo. There is no other way to unlock a brigade: an organisation
  that never subscribes to anything in Station Manager cannot use planning or
  broadcasting, only public tracking.
- Entitlement is enforced server-side (a single `!authResult.santaRunEnabled`
  check) and mirrored client-side via `EntitlementGate`/`EntitlementBanner`,
  which link out to Station Manager rather than starting a checkout here.

> Pricing note: the $10/yr suite add-on was set deliberately low to undercut
> competitors charging per-event fees and to make December a low-friction
> trial for brigades already in the Station Manager ecosystem. It's set and
> adjustable in Station Manager's Stripe account, not this repo — see that
> repo's own plan for pricing changes.

## Current state — v1 (shipped)

Core product is complete and live-capable:

- Route planning on an interactive map: waypoints, drag-reorder, auto-plan
  path, one-tap order optimisation, per-stop ETAs, templates, import/export.
- Turn-by-turn navigator view with voice guidance and a screen wake lock.
- Real-time public tracking via an in-process WebSocket hub (no managed
  pub/sub service): live Santa marker, route path, progress, viewer count,
  countdown, "follow Santa" camera, thank-you state.
- Multi-brigade isolation, public brigade discovery, analytics. Membership,
  roles, and brigade identity are now governed entirely by Station Manager —
  see "StationKit suite identity" below (this replaced Santa Run's own
  member-management/claiming/verification system, retired 2026-07-19).
- Soft gate that routes unentitled organisations to an "enable in Station
  Manager" screen instead of a hard wall on save — see "StationKit suite
  identity" below (this replaced Santa Run's own per-brigade Stripe billing,
  retired 2026-07-19).
- PWA: offline caching, background-sync for broadcasts, installable.
- Security hardening: every write/privileged endpoint authenticated with
  self-match / brigade-permission checks, realtime rate-limited.

### StationKit suite identity (shipped 2026-07-19)

Santa Run's own Microsoft Entra External ID (CIAM) sign-in, and its entire
member-management/invitation/admin-verification system, are **retired**.
Sign-in, brigades, and roles are now delegated entirely to **Station
Manager**, the StationKit suite's identity/licensing provider:

- **Brigade = organization.** A brigade's `id` is literally the Station
  Manager `organizationId` — no separate claiming flow. The brigade record
  auto-provisions on first sign-in from a Station-Manager-authenticated user
  whose org doesn't have one yet.
- **Bearer-token federation, no shared secret.** Both backends (`server/`,
  `api/`) validate every request by calling Station Manager's
  `GET /api/auth/me`; the response's `organizationId`/`role` drive
  authorization (`checkBrigadeAccess`) directly — no local membership table.
- **Silent cross-subdomain SSO.** The client tries Station Manager's
  `GET /api/auth/session` (its shared `sk_session` httpOnly cookie on
  `.stationkit.com.au`) before falling back to a stored token or the login
  page — a user already signed into Station Manager or Fire Break Calculator
  lands in Santa Run already authenticated.
- **Roles map onto Station Manager's three** (`owner`/`admin`/`viewer`);
  Santa Run's old `operator` role folded into `admin`.
- **Independent sign-up preserved** — `src/pages/auth/LoginPage.tsx` supports
  creating a brand-new Station Manager organization from within Santa Run, so
  brigades that never touch the rest of the suite can still sign up directly.
- **Passkey sign-in (2026-07-19), additive to password.** `LoginPage` gained a
  "Sign in with a passkey" button (feature-detected via `browserSupportsWebAuthn()`)
  and `auth/suiteAuth.ts` a `signInWithPasskey()` that runs the WebAuthn
  ceremony (`@simplewebauthn/browser`) directly on this page — it works because
  the Relying Party ID is the shared `.stationkit.com.au` parent domain, the
  same one the SSO cookie uses — then POSTs the assertion to Station Manager's
  `/api/auth/passkey/login/verify` cross-origin, which behaves exactly like
  `/login` (token + `sk_session` cookie). Usernameless/discoverable flow — no
  username field, the browser's own picker shows every passkey it holds.
  **Registration only happens in Station Manager's own account settings** —
  no "Add a passkey" UI in this app, since Station Manager is the suite's sole
  identity provider.
- **Per-brigade Stripe billing retired 2026-07-19.** Initially kept intact
  as a safety fallback in case real brigades were paying on it; the owner
  confirmed the existing Stripe subscriptions on the shared account were
  their own dev-testing ones, not real customers, so it was safe to remove.
  Deleted: `server/src/routes/stripe.ts`, both `utils/subscription.ts` files,
  `BillingPanel`/`SubscriptionBanner`/`SubscriptionGate`/
  `useSubscriptionPrice`, the `stripe` npm dependency, and the
  `subscriptionStatus`/`stripeCustomerId`/`stripeSubscriptionId`/
  `subscribedUntil` Brigade fields. Replaced with `EntitlementGate`/
  `EntitlementBanner`, which link out to Station Manager's
  `/admin/organization` instead of starting a local checkout. Every
  `!authResult.santaRunEnabled && !(await isBrigadeEntitled(...))` check
  collapsed to the single `!authResult.santaRunEnabled`.
- Config: `VITE_SUITE_AUTH_URL` (client) / `SUITE_AUTH_URL` (server) point at
  the Station Manager deployment; both default to `https://stationkit.com.au`.
- Companion work: Station Manager (`santaRunEnabled` entitlement + standalone
  add-on billing, `richardthorek/station-manager` PR #686) and Fire Break
  Calculator (matching silent-SSO client) — see those repos' own plans.

Public-growth and polish shipped in the latest pass:

- Public-first landing with "Find a Santa run near me" (geolocated), jargon-free
  copy, merged organiser CTA.
- Brigade discovery sorts by distance when the visitor shares location.
- Personal ETA — a viewer pins their place and sees how far Santa is along the
  route.
- "Notify me when Santa starts" web push (optional; hidden when unconfigured).
- Simulated demo run (`/demo`) — full live UI with no login, to convert both
  audiences.
- Printable A4 poster + QR pack per published route.

Hosting/runtime consolidation & CI/CD hardening shipped in this pass:

**Deployment Infrastructure:**
- Retired Azure Web PubSub and Azure App Service. Production now runs a
  single Azure Container Apps (Consumption, scale-to-zero) container serving
  both the API and the static build; realtime fan-out moved in-process
  (`server/src/realtime/`) — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **GitHub OIDC federated credentials** replace stored secrets for Azure
  deployments (no long-lived credentials in GitHub).
- **Unified CI/CD pipeline** consolidates testing, quality checks, and
  deployment into a single efficient workflow with change detection to skip
  unnecessary operations.
- **Commit-hash health verification:** workflow polls `/api/health` after
  deployment and verifies the commit SHA matches before marking deployment
  successful — prevents silent failures.

**Application Improvements:**
- Fixed audit logging endpoint and static file serving (manifest.json,
  registerSW.js now served with correct MIME types).
- Prominent **Settings** button on Dashboard for easy access to Fire Santa Run
  access status (now via Station Manager — see "StationKit suite identity").

**Intent:** Web PubSub Standard (needed each December to clear the 20
concurrent connection free-tier cap, ~A$50+/mo) plus a year-round App
Service B1 (~A$13-15/mo) were the largest fixed costs relative to a $5/yr
subscription price.
**Outcome:** no separate realtime service to size, provision, or scale for
December — one container image, one deploy target. Off-season cost
approaches $0 (Consumption scale-to-zero); `scale-season.sh` now flips
`minReplicas` (0 ⇄ 1) instead of a SKU. Trade-off: the in-process hub is
per-process state, so the Container App is pinned to `maxReplicas: 1` until
a shared backplane is added — tracked in the roadmap below.

## Roadmap — what's next

Ordered by leverage. Public-side items move the needle most because the public
is the audience and the marketing channel. One exception: item 0 below is a
correctness/infra gap left by the StationKit SSO migration and should land
before relying on the unified suite login in production.

0. **Cross-repo SSO end-to-end verification** — manually confirm silent SSO
   actually works across Station Manager, Fire Santa Run, and Fire Break
   Calculator once all three are deployed with the `.stationkit.com.au`
   cookie domain live: sign in once, land authenticated in all three; sign out
   in one, confirm the others still behave sanely; confirm the independent
   Santa Run sign-up path still works standalone. Not yet done.
1. **Proximity push** — extend "notify me" to "Santa is ~10 min from your pin".
   The route + live position + personal ETA already exist; this is the highest
   emotional-value feature and the clearest differentiator over "we post on
   Facebook".
2. **Editor planning depth** — surface cumulative arrival times per stop against
   the run start ("reach the school ~7:52"), and richer leg data, so brigades
   publish times families can rely on.
3. **Real-device navigator hardening** — verify 2-hour battery drain (screen +
   GPS + WebSocket) and graceful behaviour when rural coverage drops (queue and
   resume broadcasts; show "last seen" rather than a frozen Santa).
4. **Growth surfaces** — brigade-page embeds/share cards; "runs on tonight"
   view in discovery; social Open Graph polish.
5. **Cost/scale for success** — evaluate MapLibre + open tiles for the public
   tracking page so viewer growth doesn't scale Mapbox cost linearly (see
   below).
6. **Billing UX depth** — receipts/renewal reminders, grace-period messaging
   refinements, optional multi-year.
7. **Realtime backplane for horizontal scale** — if a single Container Apps
   replica ever caps out on concurrent WebSocket connections, add a shared
   pub/sub backplane (e.g. Redis) behind `server/src/realtime/hub.ts` so
   `maxReplicas` can go above 1. Not needed at current or projected traffic;
   revisit only if a run's viewer count approaches the practical ceiling of
   one instance.
8. **Write a "brigade membership under Station Manager" user doc.** The
   2026-07-19 docs cleanup deleted `ADMIN_USER_GUIDE.md`,
   `MEMBERSHIP_SYSTEM.md`, `API_AUTHENTICATION.md`,
   `AUTHENTICATION_BUSINESS_RULES.md`, and `AUTHENTICATION_TROUBLESHOOTING.md`
   because they described the local Entra CIAM/membership system #388
   retired — none had been updated when #388 shipped, so they were actively
   wrong rather than merely stale. There's currently no replacement doc
   explaining brigade membership/roles/invitations from a Fire Santa Run
   admin's point of view now that it's delegated to Station Manager
   (`BRIGADE_ADMIN_ONBOARDING.md` was patched to stop describing the old
   flow, but only points at Station Manager rather than explaining it).
   Consider whether this belongs as Fire Santa Run doc at all, or whether
   Station Manager's own admin guide is the single source of truth suite-wide
   (see `richardthorek/station-manager`'s in-app wiki work, shipped
   2026-07-19, which would be the natural place).

## Operational readiness

- **Domain move to `santa.stationkit.com.au` (in progress, 2026-07-18).** Station
  Manager's public branding/URL moved to `stationkit.com.au`; this app is moving
  from its independent `firesantarun.com.au` domain to a `stationkit.com.au`
  subdomain to match. **Shipped:** `server/src/app.ts`'s CORS allowlist now
  accepts a comma-separated `CORS_ORIGIN` and defaults (prod) to both
  `firesantarun.com.au` and `santa.stationkit.com.au` during the transition;
  `infra/seed-secrets.sh` seeds that same two-origin default unless
  `CORS_ORIGIN` is overridden. `APP_BASE_URL` (used to build outbound links —
  SMS broadcasts, VAPID subject) deliberately still defaults
  to `firesantarun.com.au` — don't flip it until DNS for the new subdomain is
  actually live, or generated links 404. **Still open (infra/ops, not code):**
  Cloudflare DNS + TLS for `santa.stationkit.com.au` and its Container Apps
  custom-domain binding; once live, flip `APP_BASE_URL` and narrow
  `CORS_ORIGIN` back to the single new origin, retiring `firesantarun.com.au`.
  As of 2026-07-19 the StationKit SSO integration itself is fully wired (see
  "StationKit suite identity" above) — the cross-subdomain silent-SSO cookie
  only actually reaches Santa Run once this domain move lands, since the
  cookie is scoped to `.stationkit.com.au`; until then, users fall back to a
  stored bearer token or an explicit login. See roadmap item 0 for the
  outstanding end-to-end verification.
- **Container Apps scale-to-zero.** `minReplicas: 0` off-season, flipped to
  1 for December via [`infra/scale-season.sh`](infra/scale-season.sh) so the
  first visitor of the season isn't stuck with a cold start mid-run.
  `maxReplicas` is pinned to 1 in Bicep (`infra/modules/containerapps.bicep`)
  because the realtime hub's state is per-process — see roadmap item 7.
- **Mapbox is the sleeper cost**: every public viewer session is a map load;
  free to 50k/month, then usage-priced. Watch it through December — at large
  viewer counts it becomes the dominant cost and the trigger for item 5 above.
- **Dev and prod are fully separate deployments**, each with its own Table
  Storage account, so test data never touches real brigade data.
- **December deploy freeze.** Because a revision cutover drops every live
  viewer's WebSocket on the single realtime replica, CI blocks auto-deploy on
  push during December (override with a `[deploy-anyway]` commit, manual
  `force_deploy`, or `DEPLOY_FREEZE_OVERRIDE`). See `infra/README.md`.
- **Nightly backups.** Table Storage has no soft-delete or point-in-time
  restore, so a scheduled job exports every table to the `backups` blob
  container each night; blob soft-delete + versioning protect the exports. Raw
  table data still has no retention policy — a decision to revisit with the
  privacy policy.
- **Run interruptions are handled live.** The navigator can pause the run
  (viewers see "back shortly") or emergency-stop it if the truck is called away
  (viewers see an explicit message; pending "Santa's starting" pushes are
  suppressed). The realtime hub replays the last position/status on connect, so
  a reconnect or redeploy no longer leaves a frozen or blank map.

## Open decisions

- When to migrate the public map to open tiles (driven by Mapbox usage).
- Whether to add a district/multi-brigade tier (the landing page already
  signals "coming soon").

---

_Historical planning notes, phase/release summaries, and point-in-time audits
live in [`docs/`](docs/INDEX.md) under "Archive". This plan supersedes them for
current guidance._
