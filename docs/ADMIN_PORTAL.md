# Admin Portal, Content Moderation & Directory Visibility

Operator-facing controls for the whole Fire Santa Run deployment. Added
2026-09-02. See [`../MASTER_PLAN.md`](../MASTER_PLAN.md) for the summary entry.

---

## 1. Platform admin

There is now a role above the per-brigade `owner`/`admin`/`viewer` from Station
Manager: the **platform administrator**, who operates the whole deployment.

### How access is granted

Station Manager is the source of truth. `GET /api/auth/me` already returns an
`isPlatformAdmin` boolean, driven by the Station Manager backend's own
`PLATFORM_ADMIN_EMAILS` env var (see the Station-Manager repo,
`backend/src/middleware/platformAdmin.ts`). Fire Santa Run trusts that flag.

Fire Santa Run **also** honours its own `PLATFORM_ADMIN_EMAILS` env var
(comma-separated, case-insensitive) as a local bridge — for the first operator,
or a self-hosted / non-Station-Manager setup. Either path sets
`AuthResult.isPlatformAdmin` server-side and `useAuth().isPlatformAdmin` in the
client.

In dev mode (`DEV_MODE=true` / `VITE_DEV_MODE=true`) the mock user is a platform
admin, so `/admin` is reachable locally with no configuration.

### What it unlocks

- The **`/admin` portal** page (`src/pages/admin/`), lazy-loaded, linked from
  the app header user menu when `isPlatformAdmin`.
- The **`/api/admin/*`** API (`server/src/routes/admin.ts`), every route gated
  by `requirePlatformAdmin` (401 unauthenticated, 403 non-admin).

### Portal tabs

| Tab | What it shows / does |
| --- | --- |
| Overview | Brigade / user / run / viewer-session counts, runs by status, open moderation count. |
| Brigades | Every brigade, route count, directory-visibility control, **delete** (cascades to routes → viewer sessions → memberships). |
| Runs | Every run across all brigades, filterable by status. **Unpublish** (→ draft) or **delete** (+ viewer sessions). |
| Users | Every user record (email, name, id). |
| Moderation | The content-safety review queue — see below. |

The admin API is deliberately **not** brigade-scoped and has no
`santaRunEnabled` / membership checks — the platform admin acts across every
brigade. All destructive actions log `who` (admin email) and `what` to the
container logs.

---

## 2. Content moderation

Brigades publish free-text run names, a brigade name, and can upload a brigade
logo. All of these render on public, unauthenticated surfaces (the discovery
page, every brigade's public page, the live tracker, OG images), so all are
screened before they go live.

### Service

**Azure AI Content Safety** — REST API, no SDK dependency
(`server/src/utils/contentSafety.ts`). Provisioned by
[`../infra/modules/contentsafety.bicep`](../infra/modules/contentsafety.bicep)
(S0 pay-as-you-go tier; first 5,000 text + 5,000 image records/month are free,
so the effective cost for a brigade Santa app is ~$0).

Config (seeded onto the Container App by `infra/seed-secrets.sh`, which reads
the endpoint + key live from the provisioned account like it does the Storage
connection string):

| Env var | Meaning |
| --- | --- |
| `CONTENT_SAFETY_ENDPOINT` | `https://<account>.cognitiveservices.azure.com` |
| `CONTENT_SAFETY_KEY` | account key |
| `CONTENT_SAFETY_BLOCK_SEVERITY` | min category severity (0/2/4/6) that blocks. Default **4** ("Medium"). |
| `CONTENT_SAFETY_BLOCKLIST` | comma-separated Content Safety *blocklist* names — custom prohibited-term lists you create in the Azure portal / blocklist REST API. Applied to text only. |

If `CONTENT_SAFETY_ENDPOINT`/`_KEY` are unset, moderation is a no-op (every
check returns `skipped`) and a `[config] WARNING` is logged at startup.

### Enforcement

| Surface | When checked | On a flag |
| --- | --- | --- |
| Run name + description | `POST`/`PUT /api/routes` when the resulting status is public (`published`/`active`/`completed`/`archived`) | `422`, publish rejected |
| Brigade name | `POST /api/brigades` (incl. auto-provision) and `PUT` when it changes | `422`, save rejected |
| Brigade logo (image) | `PUT /api/brigades` when the logo changes | `422`, save rejected |

- **Definite flag** (category severity ≥ threshold, or a blocklist hit) →
  the write is **blocked** with `422` and a `blocked` flag is recorded.
- **Service skipped / unreachable** → **fail open**: the write proceeds, but a
  `pending` flag is recorded so an admin reviews it. A brigade's legitimate
  work is never blocked by a Content Safety outage.
- **Allow** → nothing recorded.

The client surfaces the server's message: `RouteWriteError` (route editor) and
`HttpStorageAdapter.saveBrigade` (brigade settings) both pass the 422 `message`
through to the UI.

### Review queue (`moderationflags` table)

One row per flagged attempt. Partition key = subject type (`brigade` / `route`),
row key = generated flag id. An admin resolves each flag from the Moderation
tab:

| Action | Effect |
| --- | --- |
| **Approve** | False positive. The exact value is allowed through on the brigade's next save (`hasApproval` short-circuits the guard). For a logo, "this brigade's current logo is approved" until they change it. |
| **Removed** | You have taken the content down — edit the brigade on the Brigades tab, or unpublish/delete the run — then mark the flag. |
| **Dismiss** | No action needed (e.g. the brigade already changed it). |

Moderation-logging failures never break the caller (`recordFlag` swallows its
own errors).

---

## 3. Brigade directory visibility

`Brigade.publicListing`: `'auto'` (default) | `'shown'` | `'hidden'`.

| Value | In the public `/brigades` directory? |
| --- | --- |
| `auto` | Only while the brigade has a **current or upcoming run** (`active`, or `published` dated today-or-later). |
| `shown` | Always. |
| `hidden` | Never. |

A brigade's own public page (`/brigade/:slug`) stays reachable by direct link
regardless — this only controls the search directory.

- **Control:** brigade settings page → "Public Directory" section (radio group).
  Also settable per-brigade from the admin portal's Brigades tab.
- **Server:** `GET /api/brigades` and `/api/brigades/public` filter via
  `directoryVisibleBrigades()` — one scan of `published`/`active` routes to
  find which brigades have something upcoming.
- **Client (dev / localStorage):** `LocalStorageAdapter.getBrigades()` applies
  the same rule via `shouldListInDirectory()` (`src/utils/publicBrigade.ts`),
  which mirrors the server logic — **keep the two in sync**.

### Why `auto` is the default

A brigade is 1:1 with a Station Manager organization and its row is
auto-provisioned the first time an entitled member opens the app. That means
stale / test organizations reappear in the directory even after their row is
deleted. `auto` keeps them out until they actually have a run scheduled, which
is also the only time a public visitor has a reason to find them.
