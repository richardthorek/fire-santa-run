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
no app and no login. Born in Australia (RFS brigades on fire trucks under the
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
- Real-time public tracking via Web PubSub: live Santa marker, route path,
  progress, viewer count, countdown, "follow Santa" camera, thank-you state.
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

## Operational readiness

- **Web PubSub is seasonal and capacity-critical.** The free tier caps at 20
  concurrent connections — one popular run exceeds it. Scale to Standard before
  December and back down in January with
  [`infra/scale-season.sh`](infra/scale-season.sh).
- **App Service** stays at B1 year-round (custom domains need Basic+).
- **Mapbox is the sleeper cost**: every public viewer session is a map load;
  free to 50k/month, then usage-priced. Watch it through December — at large
  viewer counts it becomes the dominant cost and the trigger for item 5 above.
- **Dev and prod are fully separate deployments** matching Stripe test vs live
  mode, so test subscriptions never touch real brigade data.

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
