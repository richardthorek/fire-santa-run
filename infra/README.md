# Fire Santa Run — Azure Infrastructure as Code

This directory contains [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/) templates to provision all Azure resources required by the Fire Santa Run application.

> **Deployment model:** production runs on **Azure Container Apps** (Consumption, scale-to-zero) as a single container image. Azure App Service and Azure Web PubSub — both used historically — are retired; see "Why Container Apps" below and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full as-built picture.

## Directory Structure

```
infra/
├── main.bicep                  # Root orchestration template (subscription scope)
├── deploy.sh                   # One-command infra deployment script (calls seed-secrets.sh)
├── seed-secrets.sh             # Idempotent Container App env var seeder (re-runnable)
├── scale-season.sh             # Flip minReplicas for the December season / off-season
├── .env.example                # Template for infra/.env.<env> secret files (gitignored)
├── backup/
│   └── backup-tables.sh        # Export every Table to the `backups` blob container
├── modules/
│   ├── containerapps.bicep     # Container Apps environment + app (hosting + API + realtime WS)
│   ├── storage.bicep           # Azure Table Storage (data persistence)
│   └── monitoring.bicep        # Application Insights + Log Analytics
└── parameters/
    ├── dev.bicepparam           # Development environment parameters
    └── prod.bicepparam          # Production environment parameters

Dockerfile                       # (repo root) multi-stage build for the container image
.github/workflows/
├── deploy-container-apps.yml    # Builds the image, pushes to ghcr.io, deploys via az CLI
└── backup-tables.yml            # Nightly Table export to blob backup (cron 15:00 UTC)
```

---

## Backups & data protection

Azure Table Storage has **no soft-delete and no point-in-time restore** — a bad
migration or an accidental delete is unrecoverable without an external copy. So:

- **Nightly export.** `.github/workflows/backup-tables.yml` runs
  `infra/backup/backup-tables.sh` at 15:00 UTC (~02:00 AEDT), writing every
  table's entities as JSON to the storage account's `backups` blob container,
  timestamped `YYYY/MM/DD/HHMMSSZ/`. Run it on demand from the Actions tab, or
  locally with `RESOURCE_GROUP=<rg> infra/backup/backup-tables.sh`.
- **Blob soft-delete + versioning** (30 days) on the storage account protect the
  backup blobs themselves against an accidental overwrite or delete
  (`modules/storage.bicep`).
- **Restore is manual and deliberate:** download the JSON for a table and replay
  its entities. There is no auto-restore — that would risk clobbering good data.
- **Retention of the exports** is governed by blob lifecycle/soft-delete; the
  raw table data itself currently has no lifecycle policy (volunteer GPS trails
  and viewer analytics persist indefinitely — a retention decision to revisit
  alongside the privacy policy).

## Deploy freeze (December)

Every Santa run happens on a December evening and production runs a **single
realtime replica** — a revision cutover drops every live viewer's WebSocket. The
CI/CD pipeline therefore **blocks auto-deploy on push during December**
(`freeze-check` job). Override for an intentional fix:

- put `[deploy-anyway]` in the commit message, **or**
- run the workflow manually with `force_deploy=true`, **or**
- set repo variable `DEPLOY_FREEZE_OVERRIDE=true` for the duration.

---

## Architecture Overview

```
Browser (React SPA, PWA)
        │ HTTPS + wss://
        ▼
Azure Container Apps (Consumption, scale-to-zero, single container)
   ├── /api/*         →  Hono Node.js server (server/)
   │     ├── /api/routes           Table Storage
   │     ├── /api/brigades         Table Storage
   │     ├── /api/negotiate        → issues a signed token + wss:// URL for privileged roles
   │     └── /api/broadcast        → fans out via the in-process realtime hub
   ├── /api/ws        →  native WebSocket upgrade (realtime tracking — no managed pub/sub service)
   └── /*              →  Static React SPA (dist/), React Router handles client-side routing

Azure Table Storage
   └── Stores routes, brigades, memberships, users, push subscriptions

Application Insights + Log Analytics
   └── Request tracing, errors, custom metrics
```

The Hono server is a clean, framework-native Node.js HTTP server with no adapter wrappers. It serves the API, the compiled React SPA, and the realtime WebSocket endpoint from a single container process — see [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#realtime-tracking) for how the in-process hub replaces a managed pub/sub service, and the single-replica constraint that comes with it.

---

## Service Selection Matrix

| Service | Plan | Free Tier | Why This Service |
|---|---|---|---|
| **Azure Container Apps** | Consumption (`minReplicas` 0 off-season / 1 in December, `maxReplicas` 1) | 180,000 vCPU-seconds + 360,000 GiB-seconds/month free | Scales to zero when idle — near-$0 for 11 months of the year; scales to a warm replica for December with one CLI flip, no redeploy |
| **Azure Table Storage** | Standard_LRS | 5 GB + 20,000 tx/month free | Low-cost NoSQL with partition/row key model matching brigade isolation pattern |
| **Application Insights + Log Analytics** | PerGB2018 | 5 GB ingestion/month free, 30-day retention free | Request tracing, error tracking, custom queries |

### Why Container Apps (not App Service, not Web PubSub)?

The app has been through three hosting models. Each move fixed a real constraint of the one before it:

| Concern | Static Web Apps + Functions (original) | App Service + Hono (2nd) | Container Apps + Hono (current) |
|---|---|---|---|
| **Backend framework** | Azure Functions SDK (`app.http()`) | Hono — standard Node.js HTTP server | Same Hono server, containerised |
| **Realtime / WebSockets** | Functions can't hold persistent connections → required Azure Web PubSub | App Service supports native WebSockets, but still used managed Web PubSub for fan-out | **In-process** native WebSocket hub (`server/src/realtime/`) — no managed pub/sub service, no per-message billing |
| **Idle cost** | Functions Consumption is near-$0 idle, but Web PubSub Standard (needed for >20 connections) is ~US$50–75/month **flat, whether or not anyone is watching** | App Service Basic (needed for a custom domain) is billed 24/7 regardless of traffic | **Scale-to-zero** — near-$0 for the ~11 idle months/year; a warm replica for December costs a few dollars |
| **Local development** | Requires `azure-functions-core-tools` (heavy toolchain) | Standard `node server/dist/main.js` | Same — `docker build` optional, not required for dev |
| **Deployment unit** | Two separately deployed artifacts (SPA + API zip) | Single deployment root (`dist/` + `server/`) | Single container image (same two artifacts, one Dockerfile) |

The deciding factor for this move: Fire Santa Run's traffic is **radically seasonal** (a spike in December, near-silence the rest of the year), and neither Functions+Web PubSub nor App Service+Web PubSub let the realtime piece scale down — Web PubSub's Free tier caps at 20 concurrent connections (too small for a single popular run) and its Standard tier bills flat regardless of usage. Moving fan-out in-process and hosting on Container Apps' Consumption plan means the **whole stack**, not just the API, scales to zero.

**The trade-off, stated plainly:** the in-process hub is per-process state, so the Container App is capped at `maxReplicas: 1` — every connection for a route must land on the same instance. That's enough headroom for the foreseeable traffic level; raising it needs a shared backplane (e.g. Redis pub/sub) for the hub first. See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#realtime-tracking).

### Why Bicep?

- No additional tooling beyond Azure CLI (already required).
- First-class Azure support — new features appear in Bicep before Terraform providers.
- Compiles to ARM JSON: portable, auditable, viewable in Azure Portal deployment history.
- Strong typing with VS Code Bicep extension IntelliSense.

---

## Prerequisites

1. **Azure CLI** ≥ 2.60 with the `containerapp` extension — [Install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
2. **Bicep CLI** — installed automatically with Azure CLI 2.20+, or run:
   ```bash
   az bicep install && az bicep upgrade
   ```
3. **Docker** (only if you want to build/push an image yourself instead of letting CI do it)
4. **Azure subscription** — [Free account](https://azure.microsoft.com/free/) includes $200 credit

```bash
az --version                                  # Should show 2.60+
az bicep version                              # Should show 0.20+
az extension add --name containerapp --upgrade
az account show                               # Confirm logged in to correct subscription
```

---

## Quick Start (Single Command)

```bash
# Deploy dev environment (public placeholder image; CI updates it after the first push)
./infra/deploy.sh

# Deploy with a custom name suffix (3–8 lowercase alphanumeric chars)
./infra/deploy.sh --suffix abc123

# Deploy in another region
./infra/deploy.sh --suffix dev020 --location australiasoutheast

# Bind existing CIAM directory resource in target RG (optional)
./infra/deploy.sh --suffix dev020 --ciam-directory brigadesantarun.onmicrosoft.com

# Point at an image you've already built and pushed yourself
REGISTRY_PASSWORD=ghp_xxx ./infra/deploy.sh --image ghcr.io/you/fire-santa-run:latest \
  --registry-server ghcr.io --registry-username you

# Validate without deploying
./infra/deploy.sh --dry-run

# Deploy production
./infra/deploy.sh --env prod --suffix prod1
```

The script will:
1. Verify Azure CLI login
2. Run the Bicep deployment (Container Apps environment + app, Storage, Application Insights)
3. Seed the Container App's base environment variables
4. Print what to add to GitHub so CI can deploy new images

---

## Manual Deployment

```bash
az login
az account set --subscription "<subscription-name-or-id>"

az deployment sub create \
  --location australiaeast \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --name santarun-dev-$(date +%Y%m%d)

# View outputs
az deployment sub show \
  --name <deployment-name> \
  --query 'properties.outputs'
```

---

## Building and Pushing the Image

CI (`.github/workflows/deploy-container-apps.yml`) builds the root `Dockerfile` and pushes it to `ghcr.io/<owner>/<repo>` on every push to `main`, then updates the Container App to that image tag. To do it by hand:

```bash
docker build \
  --build-arg VITE_MAPBOX_TOKEN=pk.your_token \
  -t ghcr.io/<owner>/fire-santa-run:manual .

docker push ghcr.io/<owner>/fire-santa-run:manual

az containerapp update \
  --name <container-app-name> \
  --resource-group <resource-group> \
  --image ghcr.io/<owner>/fire-santa-run:manual
```

`VITE_*` build args are baked into the SPA bundle at **build time** (Vite requirement) — pass the ones your deployment needs (see the Dockerfile header comment). They are not secrets that need runtime protection; the real secrets (storage connection string, VAPID keys) are set as Container App environment variables at **runtime**, never baked into the image.

### GHCR package visibility

The simplest setup is a **public** `ghcr.io` package — Container Apps then needs no registry credentials to pull it (leave `--registry-server` unset). If you'd rather keep the image private, create a classic GitHub PAT with `read:packages` scope and pass it as the Container App's registry password (`REGISTRY_PASSWORD` env var to `deploy.sh`, or `GHCR_PULL_TOKEN` documented in the workflow file).

---

## After Deployment — Configure CI + Secrets

### GitHub Actions Secrets & Variables (for CI/CD)

CI deploys via `az containerapp update`, authenticated with **OIDC federated credentials** — no long-lived Azure secret stored in GitHub.

**One-time setup** (Entra admin, once per environment you want CI to deploy to):

```bash
# 1. Create an app registration (or reuse one)
az ad app create --display-name "fire-santa-run-cd"
APP_ID=$(az ad app list --display-name "fire-santa-run-cd" --query '[0].appId' -o tsv)
az ad sp create --id "$APP_ID"

# 2. Add a federated credential scoped to this repo's main branch
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "fire-santa-run-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<owner>/<repo>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

# 3. Grant it Contributor on the resource group (or narrower — Container Apps + storage roles)
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/<sub-id>/resourceGroups/<resource-group>"
```

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | The app registration's application (client) ID |
| `AZURE_TENANT_ID` | Your Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | The target subscription ID |
| `VITE_MAPBOX_TOKEN` | Mapbox API token for frontend maps |

| Variable (not a secret) | Value |
|---|---|
| `AZURE_CONTAINER_APP_NAME` | From `deploy.sh` output, e.g. `santarun-app-dev001` |
| `AZURE_RESOURCE_GROUP` | e.g. `rg-santarun-dev-dev001` |

(Settings → Secrets and variables → Actions, in the `copilot` environment used by the workflow.)

### Container App Environment Variables (seeded automatically)

`deploy.sh` calls **`seed-secrets.sh`** at the end of a deploy to populate these.
The seeder reads the Storage connection string **live from the deployed
resource** (so it needs no deployment output) and pulls the suite-auth /
VAPID secrets from a gitignored `infra/.env.<env>` file (or the shell env). It
is idempotent — `az containerapp update --set-env-vars` only touches the keys
you provide.

| Setting | Value | Source |
|---|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Storage account primary connection string | read live from Azure |
| `DEV_MODE` | `false` | fixed |
| `NODE_ENV` / `PORT` | `production` / `8080` | fixed |
| `APP_BASE_URL` | Public origin used for generated links (prod: `https://firesantarun.com.au`; dev: the Container App's auto-generated FQDN, or `APP_ORIGIN` override) | derived |
| `CORS_ORIGIN` | Comma-separated CORS allowlist (prod default: `https://firesantarun.com.au,https://santa.stationkit.com.au` during the suite rebrand transition; dev: same as `APP_BASE_URL`) | derived, override with `CORS_ORIGIN` |
| `SUITE_AUTH_URL` | Station Manager base URL used to validate suite bearer tokens (`GET /api/auth/me`) — Fire Santa Run has no billing of its own; entitlement (`santaRunEnabled`) comes entirely from the caller's Station Manager organisation | `infra/.env.<env>` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push keys for "notify me when Santa starts" (optional — hides the button when unset) | `infra/.env.<env>` |
| `VAPID_SUBJECT` | Contact URI sent to push services (optional; defaults to a `mailto:`) | `infra/.env.<env>` |
| `REALTIME_WS_SECRET` | Signs the short-lived tokens broadcaster/editor WebSocket connections present (optional — falls back to a hash of the storage connection string) | `infra/.env.<env>` |

**Re-seed without a full redeploy** (e.g. after rotating a VAPID key or changing
`SUITE_AUTH_URL`):

```bash
cp infra/.env.example infra/.env.dev     # first time only, then edit
./infra/seed-secrets.sh --env dev --dry-run   # preview (values masked)
./infra/seed-secrets.sh --env dev             # apply
```

The suffix defaults to the value in `parameters/<env>.bicepparam`; override with
`--suffix`. Secrets set in the shell env take precedence over the file, so CI can
inject them without a file present.

---

## Dev / Prod Environments

Dev and prod are **fully separate deployments**, not slots — each gets its own
resource group, Storage account, and Container App, provisioned from
the matching parameter file:

```bash
./infra/deploy.sh --env dev  --suffix dev001    # rg-santarun-dev-dev001
./infra/deploy.sh --env prod --suffix prod1      # rg-santarun-prod-prod1
```

Separate environments (rather than a slot) are the right choice here because
the app is stateful (Table Storage) — dev gets its own storage account so
local/test data never touches production brigade data.

Fire Santa Run has no billing of its own — entitlement (`santaRunEnabled`)
comes entirely from the caller's Station Manager organisation via
`SUITE_AUTH_URL` (see the settings table above). Secrets set in the shell env
override the gitignored `infra/.env.<env>` file, so CI can inject them without
committing anything. Local dev (`DEV_MODE=true`) bypasses entitlement
entirely — every session is treated as entitled.

### Web Push ("notify me when Santa starts")

Optional feature — when unconfigured the tracking page simply hides the notify
button. To enable it, generate a VAPID key pair and add it via `seed-secrets.sh`:

```bash
npx web-push generate-vapid-keys
# → add to infra/.env.<env>:
#   VAPID_PUBLIC_KEY=BOx...
#   VAPID_PRIVATE_KEY=k3v...
#   VAPID_SUBJECT=mailto:admin@firesantarun.com.au   (optional, defaults to this)
```

Subscriptions are stored per-route in the `pushsubscriptions` table; the first
location broadcast of a run sends one "Santa is on the way!" push to that
route's subscribers (12-hour re-send guard, expired subscriptions cleaned up on
410/404 responses).

### Ops alert emails

Optional — when unconfigured, the app-level alerts in
[`server/src/utils/opsAlert.ts`](../server/src/utils/opsAlert.ts) (realtime
connections near/at the 5,000-connection cap; an elevated broadcast failure
rate) are logged only, not emailed. Deliberately **shares Station Manager's
existing Azure Communication Services instance** rather than provisioning a
second one — that repo already has a verified custom domain wired up for its
own transactional email, and a handful of alert emails a season doesn't
justify a duplicate resource:

```bash
# Get the connection string from Station Manager's ACS resource (that repo's
# infra/email-service.bicep / infra/email-service.bicepparam name the
# actual resource):
az communication list-key \
  --name <station-manager's communicationServiceName> \
  --resource-group <station-manager's resource group> \
  --query primaryConnectionString --output tsv

# → add to infra/.env.<env>:
#   AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://...
#   EMAIL_FROM_ADDRESS=noreply@stationkit.com.au   (reuse Station Manager's sender,
#                                                    or add a distinct alerts@
#                                                    sender there if you want these
#                                                    visually separate — optional)
#   OPS_ALERT_EMAIL=you@wherever-you-want-these.example
```

Then `./infra/seed-secrets.sh --env prod` applies it. This is app code + a
shared existing resource — no Bicep deploy needed to turn it on.

### Seeing what's coming: the upcoming-runs report

There's deliberately no cross-brigade "list every scheduled run" API
endpoint (see the December-readiness review in `MASTER_PLAN.md`), so use
this instead as brigades register through the season:

```bash
AZURE_STORAGE_CONNECTION_STRING=... npm run report:upcoming-runs
```

Groups every published/active/completed route by date and flags any night
with more than one brigade running — the input for deciding *when* to run
`scale-season.sh` around a specific window (see below) rather than
blanket-warming the whole month.

---

## Seasonal Scaling (read before December!)

Santa runs are hyper-seasonal. The Container App defaults to `minReplicas: 0`
(scale-to-zero) — cheap for the ~11 idle months, but the first request after a
quiet spell pays one cold start (typically a few seconds). Flip to a warm
replica before your first December run so no viewer or broadcaster ever hits
that delay mid-run:

```bash
./infra/scale-season.sh --rg rg-santarun-prod-prod1 season      # ~Dec 1 (minReplicas=1)
./infra/scale-season.sh --rg rg-santarun-prod-prod1 offseason   # ~Jan 7 (minReplicas=0)
```

`maxReplicas` is fixed at 1 by the Bicep module — see "Why Container Apps"
above and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md#realtime-tracking)
for why (the in-process realtime hub is per-process state).

Cost intuition: a warm `minReplicas=1` replica at the smallest Consumption size
(0.25 vCPU / 0.5 GiB) costs roughly a few dollars a month if left on; scaling to
zero for eleven months makes that close to nothing.

**Registration-informed, not blanket, for year 1+.** Rather than warming for
the whole month regardless of actual demand, run
[`npm run report:upcoming-runs`](#seeing-whats-coming-the-upcoming-runs-report)
periodically as brigades register and flip `scale-season.sh` around the
specific window their runs actually cluster in. If a particular night's
cluster genuinely warrants more than the smallest allocation, `containerCpu`
/ `containerMemory` are now Bicep parameters (default: the original
`0.25`/`0.5Gi` — override at deploy time rather than editing the template;
Container Apps enforces a fixed vCPU:memory ratio and rejects an invalid
pairing at deploy time, so double-check the current allowed set before
picking a new value). This isn't needed at today's expected scale — see
`MASTER_PLAN.md` roadmap item 7 — but the knob is there.

**Mapbox is the other seasonal cost**: every public viewer session is one map
load; 50k loads/month are free, then ~US$5 per 1,000. Watch the Mapbox usage
dashboard through December — at very large viewer counts this becomes the
dominant cost and is the trigger to consider MapLibre + open tiles for the
public tracking page.

---

## Verifying the Deployment

The CI/CD workflow automatically verifies deployments using the health endpoint:

```bash
# Container App status + URL
az containerapp show \
  --resource-group rg-santarun-dev-<suffix> \
  --name santarun-app-<suffix> \
  --query '{fqdn:properties.configuration.ingress.fqdn,replicas:properties.template.scale}'

# Health check — returns status, version, and commit SHA
curl https://<fqdn>/api/health
# → { "status": "ok", "version": "...", "commitSha": "abc123...", "uptimeSeconds": 45, "timestamp": "..." }

# Deployment verification — the workflow polls this every 10s for up to 2 minutes
# and verifies the commitSha matches the deployed commit before marking success.
# If this endpoint is unreachable or the SHA doesn't match, the workflow fails.

# Realtime negotiate endpoint (viewer role, anonymous)
curl "https://<fqdn>/api/negotiate?routeId=test-route&role=viewer"
# → { "url": "wss://<fqdn>/api/ws?routeId=test-route&role=viewer", "role": "viewer", "routeId": "test-route" }
```

**CI/CD Deployment Verification:**
The workflow (`.github/workflows/deploy-container-apps.yml`) includes an automatic health check step that:
1. Polls `/api/health` every 10 seconds for up to 2 minutes after deploying the image.
2. Verifies the returned `commitSha` matches the deployed git commit (`github.sha`).
3. Fails the deployment if verification doesn't pass (prevents silent failures).

This ensures the new image is actually running and responding before the deployment is marked complete.

---

## Custom domain (`santa.stationkit.com.au`)

The public hostname is bound to the Container App ingress with an SNI TLS
certificate. **How it survives redeploys:** `az deployment sub create` does a
full PUT on the Container App, so anything the Bicep template doesn't restate is
wiped. The custom-domain binding used to be applied only out-of-band, so an
infra redeploy silently unbound it — the origin then had no certificate for the
`santa.stationkit.com.au` SNI and Cloudflare returned **525 (SSL handshake
failed)**. That happened on 2026-09-02.

Now:

- `infra/modules/containerapps.bicep` **declares** `ingress.customDomains` (and
  an explicit `ingress.traffic` block), guarded by the `customDomainName` /
  `customDomainCertificateId` params.
- `infra/deploy.sh` **auto-discovers** the live binding (hostname + certificate
  ID) and the running image *before* deploying and passes them back as
  parameters, so a redeploy re-asserts them even when the param file leaves them
  empty. Verified with `az deployment sub what-if`: with discovery the
  `customDomains` array is unchanged; without it, it goes to `null`.
- Seeded env vars are still applied afterwards by `seed-secrets.sh`, which CI
  re-runs after every deploy.

### The certificate is issued once, out-of-band

Bicep does **not** create the managed certificate. Azure's free managed cert is
issued and renewed by DigiCert, which validates via a CNAME that must resolve
**directly** to the Container App's `*.azurecontainerapps.io` FQDN. The DNS
record is proxied through Cloudflare (orange-cloud), which breaks that
validation. So the certificate is created manually and then referenced:

```bash
RG=rg-santarun-dev-dev003        # the live resource group
APP=santarun-app-dev003
ENV=santarun-env-dev003

# 1. Create + bind (needs the asuid TXT + CNAME records to resolve; if managed
#    cert issuance fails because of the Cloudflare proxy, either flip the record
#    to DNS-only briefly, or upload a Cloudflare Origin Certificate instead —
#    see below).
az containerapp hostname add  -g "$RG" -n "$APP" --hostname santa.stationkit.com.au
CERT_ID=$(az containerapp env certificate list -g "$RG" -n "$ENV" \
  --query "[?properties.subjectName=='santa.stationkit.com.au'].id | [0]" -o tsv)
az containerapp hostname bind -g "$RG" -n "$APP" --hostname santa.stationkit.com.au \
  --environment "$ENV" --certificate "$CERT_ID"

# 2. (optional) Pin it in infra/parameters/<env>.bicepparam so it's declared
#    even for a fresh environment:
#      param customDomainName = 'santa.stationkit.com.au'
#      param customDomainCertificateId = '<CERT_ID>'
#    Otherwise deploy.sh discovers it from the live app each run.
```

### Cloudflare settings

- The `santa` record proxies to the Container App FQDN. SSL/TLS mode must be
  **Full (strict)** once a real cert is on the origin.
- **Managed-cert renewal will fail while the record is proxied.** Long-term,
  either (a) run the `santa` record DNS-only, or (b) put a **Cloudflare Origin
  Certificate** (15-year, no renewal) on the Container App as an uploaded cert
  and reference *that* ID — this is the durable option for a proxied origin.
  Tracked in `MASTER_PLAN.md` → Operational readiness.

---

## Free Tier Limits & Constraints

### Azure Container Apps (Consumption)
- 180,000 vCPU-seconds + 360,000 GiB-seconds free per month, per subscription
- `minReplicas=0` scales fully to zero between requests — near-$0 outside December
- Custom domains and managed certificates are supported directly on the Container App (no Basic-tier requirement, unlike App Service)

### Azure Table Storage
- First 5 GB free; first 20,000 transactions/month free
- Estimated cost for typical brigade usage: **< $0.10 AUD/month**

### Application Insights + Log Analytics
- First 5 GB data free per month
- Daily cap set to 0.5 GB to prevent unexpected development costs

---

## Upgrade Path to Production

1. Switch to `prod` parameters: `./infra/deploy.sh --env prod --suffix myprod`
2. Bind a custom domain — see **[Custom domain](#custom-domain-santastationkitcomau)** above (`hostname add` + `bind` once, then the binding is preserved on every redeploy by `deploy.sh` + the Bicep `customDomain*` params)
3. Set `VITE_SUITE_AUTH_URL`/`SUITE_AUTH_URL` to the production Station Manager origin (GitHub secrets, baked into the SPA build and passed to the container) — sign-in is entirely delegated to Station Manager, the StationKit suite identity provider (see `../docs/ARCHITECTURE.md`)
4. Flip to `minReplicas=1` for the December season (`scale-season.sh`)
5. If a single replica is ever not enough: add a shared backplane (e.g. Redis pub/sub) for the realtime hub, then raise `maxReplicas` in `infra/modules/containerapps.bicep`

---

## Troubleshooting

**"Subscription not found" error:**
```bash
az account list --output table && az account set --subscription "<id>"
```

**"Resource name already taken":** Change `nameSuffix` to a unique value.

**App returns 404 on direct URL loads (React Router routes):**
The Hono server's SPA fallback (`app.get('*', serveStatic(...index.html))`) handles this.
Confirm the image built correctly — `dist/` (client) and `server/dist/` (server) must both be present.

**WebSocket connection fails:**
- The realtime endpoint is same-origin (`wss://<your-domain>/api/ws`) — no external host to allow in CSP `connect-src` any more (`'self'` covers it).
- Test the negotiate endpoint returns `{ url, role, routeId }` with a `wss://` URL pointing at your own domain.
- Container Apps ingress supports WebSockets on the default `transport: auto` setting — no extra config needed.

**Container App stuck on the placeholder image:**
CI hasn't pushed a real image yet (first deploy only) — either wait for CI to run on `main`, or push one manually and run `az containerapp update --image ...` (see "Building and Pushing the Image" above). After the first real image, `deploy.sh` reads the running image before an infra redeploy and passes it back as a parameter, so a Bicep PUT no longer reverts to the placeholder.

**Custom domain returns Cloudflare 525 (SSL handshake failed):**
The hostname is unbound from the Container App ingress — the origin has no
certificate for that SNI. Re-bind it (see **[Custom domain](#custom-domain-santastationkitcomau)**):
```bash
RG=rg-santarun-dev-dev003; APP=santarun-app-dev003; ENV=santarun-env-dev003
CERT_ID=$(az containerapp env certificate list -g "$RG" -n "$ENV" \
  --query "[?properties.subjectName=='santa.stationkit.com.au'].id | [0]" -o tsv)
az containerapp hostname add  -g "$RG" -n "$APP" --hostname santa.stationkit.com.au
az containerapp hostname bind -g "$RG" -n "$APP" --hostname santa.stationkit.com.au \
  --environment "$ENV" --certificate "$CERT_ID"
```
If it keeps recurring, an infra redeploy is running without the binding params —
confirm `deploy.sh`'s discovery step logs `custom domain: santa.stationkit.com.au`.

---

## Clean Up

```bash
az group delete \
  --name rg-santarun-dev-<suffix> \
  --yes --no-wait
```

> ⚠️ This permanently deletes all resources and data.

### CIAM Directory Lifecycle Note

If an External Configuration Tenant (`Microsoft.AzureActiveDirectory/ciamDirectories`) is in `Deleting` state, Azure blocks move/rebind operations from that RG.

- Do not force CIAM binding during this state.
- Keep `ciamDirectoryName` empty for deployments until the resource is healthy in the target RG.
- Verify status with:

```bash
az resource list --query "[?type=='Microsoft.AzureActiveDirectory/ciamDirectories'].{name:name,rg:resourceGroup,state:properties.provisioningState}" -o table
```
