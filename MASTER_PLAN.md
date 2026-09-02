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

### December-readiness security/performance/UX review (2026-09-02)

A pre-season review (security, performance/scale, public/brigade UX balance,
and Station Manager cross-app SSO status — four targeted investigations plus
one cross-domain synthesis pass) found real gaps. This pass fixed every
**pure-code** finding; anything needing Azure CLI/portal access, or a
cost/SKU decision, is explicitly called out below rather than done silently.

**Shipped (code only, both `server/` and `api/` kept aligned):**

- **Broadcast endpoints now check route ownership.** `POST /broadcast`,
  `/broadcast/status`, and `/broadcast/editor-presence` previously accepted
  any *authenticated* Station Manager account — any organisation, anywhere in
  the suite, free to create — with no check that the caller belonged to the
  brigade running the target route. `negotiate.ts` already did this check for
  the WS token; the HTTP endpoints that actually move Santa's position or set
  run status did not. Fixed by resolving the route's owning brigade per
  request and calling `checkBrigadeAccess()` (mirroring `negotiate.ts`),
  plus a server-side log line (`user`, `brigade`, observed IP) so a
  falsified broadcast can be attributed after the fact — there was
  previously no record at all. `server/src/routes/broadcast.ts`,
  `api/src/broadcast.ts`.
- **Viewer-session analytics locked to brigade members.**
  `GET /analytics/routes/:routeId/sessions` had no auth check and returned
  every tracker's raw IP address and user agent to anyone holding the route's
  public tracking link. Now requires membership in the route's owning
  brigade, same bar as editing the route. `server/src/routes/analytics.ts`
  (no `api/` equivalent — production-only feature).
- **Anonymous route reads scoped to what's actually public.**
  `GET /routes?brigadeId=` and `GET /routes/:id?brigadeId=` carried a
  `// Brigade-scoped lookup (members)` comment but no auth check at all —
  any caller supplying a brigadeId (not a secret; `GET /brigades/public`
  hands every one out) got every route for that brigade, including
  unpublished drafts with real names on internal comments. Now: an actual
  member of the brigade (any role) still sees everything; anyone else only
  sees publicly-visible statuses, same bar the fully-anonymous lookup path
  already enforced. `server/src/routes/routes.ts`, `api/src/routes.ts`.
- **Rate limiter reads the trustworthy IP hop.** `clientIp()` trusted the
  first (client-controlled, trivially spoofed) `X-Forwarded-For` hop — correct
  for the retired App Service target the code comment described, wrong for
  Container Apps, which only guarantees the *rightmost* hop. This defeated
  the only throttle on the broadcast endpoint. `server/src/utils/rateLimit.ts`,
  `api/src/rateLimit.ts`.
- **Brigade reads no longer return the raw entity.** `GET /brigades`,
  `/brigades/by-station/:id`, and `/brigades/:id` returned every stored field
  unauthenticated; `/public` and `/by-slug/:slug` already correctly used a
  `toPublicBrigade()` projection. On inspection this was a smaller gap than
  first flagged: `contact.email`/`contact.phone` are already public by
  design (`PublicBrigadePage` renders them as `mailto:`/`tel:` links on every
  brigade's own public page), so the only fields the full entity actually
  added were a couple of redundant flat `contactEmail`/`contactPhone`
  properties and an internal `updatedAt` timestamp — not the severe PII leak
  it first looked like. Fixed anyway for consistency (no unauthenticated read
  needs the raw entity shape); verified `BrigadeSettingsPage` (the one
  authenticated consumer) only ever reads fields the public projection
  already includes, so no frontend change was needed.
  `server/src/routes/brigades.ts`, `api/src/brigades.ts`.
- **Storage-connection-string landmine closed.** `VITE_AZURE_STORAGE_CONNECTION_STRING`
  (a dev-only escape hatch, `src/storage/index.ts`) shares its exact name
  with the backend's real Azure Storage master key; Vite would bake it into
  the public bundle if it were ever set for a production build. Not
  currently exploited (the real deploy path only ever sets the correctly-
  scoped backend variable) — added a `vite build` guard that refuses to
  build if this looks like a real connection string outside dev mode.
  `.env.example`'s "PRODUCTION CONFIGURATION" section previously,
  confusingly, suggested setting this exact variable — corrected.
  `vite.config.ts`, `.env.example`.
- **`SUITE_AUTH_URL` validated at startup**, replacing a stale check for
  retired Entra CIAM variables (and a dead check for Stripe vars — billing
  was fully retired 2026-07-19, no code reads them any more). A misdirected
  `SUITE_AUTH_URL` is a full auth bypass, since `validateToken()` trusts
  whatever it points at; startup now fails fast on a non-`https://` value and
  warns on a host that doesn't look like `stationkit.com.au`.
  `server/src/utils/configValidation.ts`.
- **Content-Security-Policy added**, shipped as
  `Content-Security-Policy-Report-Only` rather than enforcing — see "Not done"
  below. `server/src/app.ts`.
- **Route create/update payloads bounds-checked** (name/description length,
  comment count and length, waypoint count and coordinate sanity) — matches
  the validation pattern `broadcast.ts`/`push.ts` already used elsewhere in
  this codebase, previously absent here. `server/src/routes/routes.ts`,
  `api/src/routes.ts`.

**Not done — needs Azure CLI/portal access (a different session):**

- Station Manager: confirm/set `COOKIE_DOMAIN=.stationkit.com.au` and add
  Fire Santa Run's origins to `FRONTEND_URLS` on the live App Service — both
  flagged open in that repo's own changelog since 2026-07-18 with no later
  closure. Until set, the silent cross-subdomain SSO above does not reliably
  work in production (falls back to explicit login, which does work) and
  cross-origin passkey login is broken. **Sequencing matters**: don't land
  this before the broadcast-ownership fix above has actually deployed —
  making suite sign-in more frictionless on top of an open broadcast
  endpoint would have been the wrong order. That fix is now merged, so this
  is unblocked.
- Fire Santa Run: finish the `santa.stationkit.com.au` Cloudflare DNS/TLS +
  Container Apps custom-domain binding (tracked in Operational readiness
  below).
- Flip the CSP above from Report-Only to enforcing: load the app in a real
  browser (production, or a local build with a real `VITE_MAPBOX_TOKEN`),
  exercise the map, sign-in, and push opt-in, confirm devtools shows zero
  violations for legitimate requests, then rename the header — see the
  comment above `buildCsp()` in `server/src/app.ts`.
- Turn on ops alert emails: get the connection string from Station Manager's
  existing ACS instance and set `AZURE_COMMUNICATION_CONNECTION_STRING` /
  `EMAIL_FROM_ADDRESS` / `OPS_ALERT_EMAIL` via `infra/seed-secrets.sh` — see
  `infra/.env.example` for the exact `az communication list-key` command and
  roadmap item 7 below for what ships once this is set.

Capacity/scaling approach (registration-informed vertical warming, minimum-
viable alerting) is covered in the roadmap below (item 7) — most of it
shipped as code in this pass; the ACS wiring above and an actual load test
are what's left, both needing Azure access from a different session.

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

### Single-backend consolidation — `api/` (Azure Functions) retired (2026-09)

Pre-launch, so safe to do now rather than after: `api/`, the Azure Functions
app that only ever backed local dev (a holdover from the pre-Container-Apps
Static Web Apps era), is deleted. `server/` (Hono) is the sole backend —
`npm run dev` now runs it locally too, against **Azurite** (a local Table
Storage emulator, new dev dependency) instead of real Azure Storage, so
local dev still needs no cloud account. Net effect: one API implementation
to maintain and reason about, not two kept in sync by hand.

- `npm run dev` = Azurite + `server/` (`DEV_MODE=true`) + Vite, concurrently.
  `npm run setup` installs root + `server/` deps only.
- `server/src/utils/storage.ts` defaults to Azurite's well-known connection
  string when `DEV_MODE=true` and no real connection string is set.
- `vite.config.ts`'s dev proxy target moved from `localhost:7071` (Functions)
  to `localhost:8080` (`server/`), with WebSocket upgrade forwarding added so
  `VITE_DEV_MODE=false` locally now exercises the real realtime path too.
- Fixed a genuine pre-existing bug found during the removal: `analytics.ts`
  used un-hyphenated dev table names (`devroutes`/`devviewersessions`) while
  every other route file used the hyphenated `dev-` convention, so dev-mode
  analytics queries were silently hitting empty tables.
- Found and fixed a real feature gap the deletion would otherwise have
  caused: OG image generation (`GET /api/og-image`, used by `SEO.tsx` /
  `TrackingView.tsx` for social-preview cards on shared tracking links) only
  ever existed in `api/` — it had never been ported to `server/`, so
  production would have silently lost social-preview images the moment
  `api/` was deleted. Ported `og-image.ts`, `utils/ogImageBuilder.ts`
  (pure-function SVG builder, now unit-tested again at
  `src/__tests__/ogImageBuilder.test.ts`), and `utils/blobStorage.ts`
  (optional Blob Storage caching, no-ops without a connection string) into
  `server/`, added `@azure/storage-blob` as a `server/` dependency, and
  wired the route into `app.ts`. Config (`MAPBOX_TOKEN`,
  `AZURE_BLOB_STORAGE_CONNECTION_STRING`) was already documented in
  `.env.example` and needed no changes.
- CI gained a `server/` typecheck step (previously only the frontend was
  typechecked in CI).
- Docs updated to match: `docs/DEV_MODE.md` (rewritten), `docs/ARCHITECTURE.md`,
  `CLAUDE.md`, `.github/copilot-instructions.md`, `docs/FIRE_STATION_DATASET.md`.
  `docs/SECRETS_MANAGEMENT.md` and `docs/GITHUB_SECRETS_SETUP.md` deleted —
  both described a pre-Container-Apps deploy model; `infra/README.md` was
  already the accurate source for that content.
- `.devcontainer/devcontainer.json` added the same week, sized for this end
  state (Node 22, Azure CLI, GitHub CLI, Docker-outside-of-Docker, Claude
  Code — no Functions Core Tools).

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
   Santa Run sign-up path still works standalone. Not yet done — needs
   Station Manager's `COOKIE_DOMAIN`/`FRONTEND_URLS` set (Azure CLI/portal
   access, a different session) and the `santa.stationkit.com.au` domain move
   below completed. Now unblocked from this repo's side: the broadcast-
   ownership fix that had to land first (see the December-readiness review
   above) is merged.
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
7. **December capacity — registration-informed, not blanket.** The
   December-readiness review (above) initially flagged the single Container
   Apps replica (hard-pinned `maxReplicas: 1` because the realtime hub's
   state is in-process) plus the global `MAX_TOTAL_CONNECTIONS = 5000` cap as
   plausibly reachable organically on Christmas Eve. Owner context that
   revises that: **this is year 1** — a dozen registered brigades would be a
   strong result — so that ceiling is very unlikely to bind this season. The
   chosen approach going forward, once brigades start registering, is
   **proactive and event-driven, not a blanket month-long toggle or a
   reactive autoscaler**: use real registration data to warm (and, if a
   cluster of runs on one night genuinely warrants it, vertically size up)
   the single replica around specific known windows, informed by an actual
   number instead of a guess.

   **Shipped:**
   - `npm run report:upcoming-runs` (`scripts/upcoming-runs-report.js`) —
     reads the routes/brigades tables directly (there's deliberately no
     cross-brigade "list every run" API) and prints every scheduled run
     grouped by date, flagging any night with more than one brigade running.
     Run this periodically through the season to see clustering as brigades
     register, then decide when to run `infra/scale-season.sh` around that
     specific window.
   - `containerCpu`/`containerMemory` are now Bicep parameters
     (`infra/main.bicep`, `infra/modules/containerapps.bicep`), defaulted to
     the original smallest allocation — a future vertical bump for a
     specific event window no longer needs editing the template.
   - Minimum-viable app-level alerting (`server/src/utils/opsAlert.ts`):
     emails when realtime connections approach/hit the 5,000 cap
     (`server/src/realtime/wsServer.ts`) or the broadcast failure rate spikes
     (`server/src/routes/broadcast.ts`), debounced per alert kind. Deliberately
     app-level rather than a generic Azure Monitor metric alert — "connections
     near the cap" is in-process state a platform metric can't see. Sends via
     Station Manager's *existing* Azure Communication Services instance
     (shared, not a second ACS resource — it already has a verified domain)
     — see `infra/.env.example` for how to get its connection string. Configure
     `AZURE_COMMUNICATION_CONNECTION_STRING` / `EMAIL_FROM_ADDRESS` /
     `OPS_ALERT_EMAIL` via `infra/seed-secrets.sh` to turn it on; unset, it
     just logs instead of emailing.
   - Not covered by app-level alerting: the process crashing or failing to
     start at all (a dead process can't send its own "I'm down" email). An
     Application Insights availability ping on `/api/health` would close
     that gap — cheap, standard, not yet set up; worth adding if this grows
     past a hobby-scale deployment.

   **Deliberately not built this season**: a shared pub/sub backplane (e.g.
   Redis) behind `server/src/realtime/hub.ts` so `maxReplicas` could exceed
   1, and per-run dedicated compute (a separate container provisioned per
   scheduled run). Both solve a scale/isolation problem this product doesn't
   have yet at year-1 volumes, at a cost (the former: real engineering effort
   plus an ongoing resource cost; the latter: a multi-week rebuild — a
   routing/discovery layer in front of per-run workers, since the realtime
   hub's connections are pinned to one process and the REST API can't be
   per-run since brigades plan at any time, not just during their own run)
   disproportionate to the actual traffic expected. Revisit once real
   registration/viewer numbers from an actual season exist, not before —
   the horizontal-backplane path is the natural next step if the shared
   instance's ceiling is ever genuinely approached; per-run isolation would
   only earn its complexity at a scale or noisy-neighbour risk well beyond
   that.
   - Still open, no code involved: an actual load test before December
     (nobody has measured real per-connection cost on this exact
     Consumption allocation) — needs a deployed target, so a different
     session with Azure access.
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
