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
- **Brigades pay a small annual subscription** (currently A$5/yr per brigade,
  set in Stripe and adjustable without a code change) to unlock route planning
  and live broadcasting. One price, per brigade, whole year.
- Entitlement is enforced server-side and mirrored in the UI; the price shown
  everywhere is read live from Stripe.

> Pricing note: $5/yr sits below the annual infrastructure floor until roughly
> the first ~80 brigades. It is intentionally accessible for now and can be
> revised later purely in the Stripe dashboard — see "Operational readiness".

## Current state — v1 (shipped)

Core product is complete and live-capable:

- Route planning on an interactive map: waypoints, drag-reorder, auto-plan
  path, one-tap order optimisation, per-stop ETAs, templates, import/export.
- Turn-by-turn navigator view with voice guidance and a screen wake lock.
- Real-time public tracking via an in-process WebSocket hub (no managed
  pub/sub service): live Santa marker, route path, progress, viewer count,
  countdown, "follow Santa" camera, thank-you state.
- Multi-brigade isolation, member management + roles, brigade claiming with
  admin verification, public brigade discovery, analytics.
- Per-brigade Stripe subscription (Checkout + billing portal + webhook), soft
  paywall that routes unentitled brigades to a subscribe screen, self-service
  billing panel.
- PWA: offline caching, background-sync for broadcasts, installable.
- Security hardening: every write/privileged endpoint authenticated with
  self-match / permission / site-admin checks, realtime rate-limited.

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
- Brigade context now auto-loads first active membership if `brigadeId` not
  set, fixing the case where users claim a brigade but can't access it.
- Prominent **Settings** button on Dashboard for easy access to billing &
  subscription options.
- Stripe webhook and Stripe integration fully wired up for per-brigade
  subscriptions.

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
is the audience and the marketing channel.

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

## Operational readiness

- **Domain move to `santa.stationkit.com.au` (in progress, 2026-07-18).** Station
  Manager's public branding/URL moved to `stationkit.com.au`; this app is moving
  from its independent `firesantarun.com.au` domain to a `stationkit.com.au`
  subdomain to match. **Shipped:** `server/src/app.ts`'s CORS allowlist now
  accepts a comma-separated `CORS_ORIGIN` and defaults (prod) to both
  `firesantarun.com.au` and `santa.stationkit.com.au` during the transition;
  `infra/seed-secrets.sh` seeds that same two-origin default unless
  `CORS_ORIGIN` is overridden. `APP_BASE_URL` (used to build outbound links —
  SMS broadcasts, Stripe redirects, VAPID subject) deliberately still defaults
  to `firesantarun.com.au` — don't flip it until DNS for the new subdomain is
  actually live, or generated links 404. **Still open (infra/ops, not code):**
  Cloudflare DNS + TLS for `santa.stationkit.com.au` and its Container Apps
  custom-domain binding; once live, flip `APP_BASE_URL` and narrow
  `CORS_ORIGIN` back to the single new origin, retiring `firesantarun.com.au`.
  No functional Station Manager SSO integration exists in this repo today (no
  code coupling beyond this domain/CORS alignment).
- **Container Apps scale-to-zero.** `minReplicas: 0` off-season, flipped to
  1 for December via [`infra/scale-season.sh`](infra/scale-season.sh) so the
  first visitor of the season isn't stuck with a cold start mid-run.
  `maxReplicas` is pinned to 1 in Bicep (`infra/modules/containerapps.bicep`)
  because the realtime hub's state is per-process — see roadmap item 7.
- **Mapbox is the sleeper cost**: every public viewer session is a map load;
  free to 50k/month, then usage-priced. Watch it through December — at large
  viewer counts it becomes the dominant cost and the trigger for item 5 above.
- **Dev and prod are fully separate deployments** matching Stripe test vs live
  mode, so test subscriptions never touch real brigade data.
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

- Final public price (keep A$5, or move toward cost recovery ~A$25 with a
  founding-brigade discount). No brigade has subscribed yet, so there's no
  grandfathering cost to changing it.
- When to migrate the public map to open tiles (driven by Mapbox usage).
- Whether to add a district/multi-brigade tier (the landing page already
  signals "coming soon").

---

_Historical planning notes, phase/release summaries, and point-in-time audits
live in [`docs/`](docs/INDEX.md) under "Archive". This plan supersedes them for
current guidance._
