# Fire Santa Run — Azure Infrastructure as Code

This directory contains [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/) templates to provision all Azure resources required by the Fire Santa Run application.

## Directory Structure

```
infra/
├── main.bicep                  # Root orchestration template (subscription scope)
├── deploy.sh                   # One-command deployment script
├── modules/
│   ├── appservice.bicep        # Azure App Service (hosting + API + WebSocket support)
│   ├── storage.bicep           # Azure Table Storage (data persistence)
│   ├── webpubsub.bicep         # Azure Web PubSub (real-time fan-out)
│   └── monitoring.bicep        # Application Insights + Log Analytics
└── parameters/
    ├── dev.bicepparam           # Development environment parameters (free tier)
    └── prod.bicepparam          # Production environment parameters
```

---

## Architecture Overview

```
Browser (React SPA)
        │ HTTPS
        ▼
Azure App Service (Linux)
   ├── GET /api/*         →  Hono Node.js server (server/)
   │     ├── /api/routes           Table Storage
   │     ├── /api/brigades         Table Storage
   │     ├── /api/negotiate        → Azure Web PubSub token
   │     └── /api/broadcast        → Azure Web PubSub group
   │
   └── GET /*             →  Static React SPA (dist/)
                                React Router handles client-side routing

Azure Web PubSub (WebSockets)
   └── Hub: santa_tracking
         Group: route_{routeId}   →  wss:// to browser (live tracking)

Azure Table Storage
   └── Stores routes, brigades, memberships, users

Application Insights + Log Analytics
   └── Request tracing, errors, custom metrics
```

The Hono server is a clean, framework-native Node.js HTTP server with no adapter wrappers. It serves both the API and the compiled React SPA from a single App Service instance.

---

## Service Selection Matrix

| Service | SKU (Dev) | SKU (Prod) | Free Tier Limits | Why This Service |
|---|---|---|---|---|
| **Azure App Service (Linux)** | Free F1 | Basic B1 | 60 CPU-min/day, 1 GB RAM, no always-on | Native Node.js runtime, native WebSocket support, startup command configurable, standard zip/publish-profile deployment |
| **Azure Table Storage** | Standard_LRS | Standard_LRS | 5 GB + 20,000 tx/month free | Low-cost NoSQL with partition/row key model matching brigade isolation pattern |
| **Azure Web PubSub** | Free_F1 | Standard_S1 | 20 concurrent connections, 20K messages/day | Managed WebSocket fan-out for per-route live tracking; standard WS protocol; integrates with the Hono server via negotiate endpoint |
| **Application Insights + Log Analytics** | PerGB2018 | PerGB2018 | 5 GB ingestion/month free, 30-day retention free | Request tracing, error tracking, custom queries |

### Why App Service (not Static Web Apps + Functions)?

Azure Static Web Apps with Azure Functions was the original prototype approach.
The switch to App Service is intentional:

| Concern | Static Web Apps + Functions | App Service + Hono |
|---|---|---|
| **Backend framework** | Azure Functions SDK (`app.http()` registration) | Hono — standard Node.js HTTP server, no framework lock-in |
| **WebSocket support** | Requires Azure Web PubSub for any WS fan-out; Functions cannot hold persistent connections | App Service supports native WebSockets on all tiers; Web PubSub still used for managed fan-out |
| **Cold starts** | Functions cold-start on first request (seconds) | Always-on from B1+; F1 has shared compute with reasonable warm times |
| **Local development** | Requires `azure-functions-core-tools` (heavy toolchain) | Standard `node server/dist/main.js` — no special tooling |
| **Deployment unit** | Two separately deployed artifacts (SPA + API zip) | Single deployment root containing both `dist/` and `server/` |
| **Future extensibility** | Functions model limits persistent connections (SSE, WS) | Full Node.js — add WS server, streaming responses, middleware freely |

### Why Bicep?

- No additional tooling beyond Azure CLI (already required).
- First-class Azure support — new features appear in Bicep before Terraform providers.
- Compiles to ARM JSON: portable, auditable, viewable in Azure Portal deployment history.
- Strong typing with VS Code Bicep extension IntelliSense.

---

## Prerequisites

1. **Azure CLI** ≥ 2.50 — [Install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
2. **Bicep CLI** — installed automatically with Azure CLI 2.20+, or run:
   ```bash
   az bicep install && az bicep upgrade
   ```
3. **Azure subscription** — [Free account](https://azure.microsoft.com/free/) includes $200 credit

```bash
az --version       # Should show 2.50+
az bicep version   # Should show 0.20+
az account show    # Confirm logged in to correct subscription
```

---

## Quick Start (Single Command)

```bash
# Deploy dev environment (uses free F1 tier)
./infra/deploy.sh

# Deploy with a custom name suffix (3–8 lowercase alphanumeric chars)
./infra/deploy.sh --suffix abc123

# Deploy in another region (useful when F1 quota is exhausted in current region)
./infra/deploy.sh --suffix dev020 --location australiasoutheast

# Bind existing CIAM directory resource in target RG (optional)
./infra/deploy.sh --suffix dev020 --ciam-directory brigadesantarun.onmicrosoft.com

# Validate without deploying
./infra/deploy.sh --dry-run

# Deploy production (B1 App Service, Standard Web PubSub)
./infra/deploy.sh --env prod --suffix prod1
```

The script will:
1. Verify Azure CLI login
2. Run the Bicep deployment
3. Automatically configure App Service application settings (connection strings)
4. Output the secrets you need to add to GitHub

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

## After Deployment — Configure Secrets

### GitHub Actions Secrets (for CI/CD)

| Secret | Description |
|---|---|
| `AZURE_APP_SERVICE_PUBLISH_PROFILE` | App Service publish profile XML (from `az webapp deployment list-publishing-profiles --xml`) |
| `VITE_MAPBOX_TOKEN` | Mapbox API token for frontend maps |

### App Service Application Settings (set automatically by `deploy.sh`, or via Portal)

| Setting | Value |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | From Bicep `storageConnectionString` output |
| `AZURE_WEBPUBSUB_CONNECTION_STRING` | From Bicep `webPubSubConnectionString` output |
| `AZURE_WEBPUBSUB_HUB_NAME` | `santa_tracking` |
| `DEV_MODE` | `false` |
| `PORT` | `8080` |
| `CORS_ORIGIN` / `APP_BASE_URL` | Public origin for this environment (prod: `https://firesantarun.com.au`; dev: the `*.azurewebsites.net` host, or set `APP_ORIGIN` in the deploy shell) |
| `STRIPE_SECRET_KEY` | Stripe secret key — **test** key for dev, **live** key for prod (only set when exported in the deploy shell) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret (`whsec_…`) for that environment's webhook endpoint |
| `STRIPE_PRICE_ID` | Price id (`price_…`) of the $5/yr recurring price (test vs live mode) |
| `SITE_ADMIN_USER_IDS` | Comma-separated Entra `oid.tid` IDs allowed to review brigade verification |

To set app settings manually:
```bash
az webapp config appsettings set \
  --resource-group rg-santarun-dev-<suffix> \
  --name santarun-web-<suffix> \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=<value>" \
    "AZURE_WEBPUBSUB_CONNECTION_STRING=<value>" \
   "AZURE_WEBPUBSUB_HUB_NAME=santa_tracking" \
    "DEV_MODE=false" "PORT=8080"
```

---

## Dev / Prod Environments

Dev and prod are **fully separate deployments**, not slots — each gets its own
resource group, Storage account, Web PubSub, and App Service, provisioned from
the matching parameter file:

```bash
./infra/deploy.sh --env dev  --suffix dev001    # rg-santarun-dev-dev001   (F1 / Free_F1)
./infra/deploy.sh --env prod --suffix prod1      # rg-santarun-prod-prod1   (B1 / Standard_S1)
```

Separate environments (rather than an App Service deployment slot) are the right
choice here because the app is stateful (Table Storage + Web PubSub) and because
Stripe has distinct **test** and **live** modes: the dev environment points at
Stripe test mode with its own storage, so test subscriptions never touch real
brigade data. A prod deployment slot can still be added later purely for
zero-downtime code releases — that is orthogonal to environment isolation.

### Stripe configuration per environment

The `/api/stripe` routes return `503` until fully configured, and the paywall
treats brigades as unentitled until the webhook records a subscription. Export
the environment-appropriate values in the shell before running `deploy.sh` (or
set them in the Portal / CI secrets):

```bash
# DEV — Stripe test mode
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...      # from the dev webhook endpoint
export STRIPE_PRICE_ID=price_...            # $5/yr recurring price, test mode
export SITE_ADMIN_USER_IDS=oid.tid,oid2.tid2
./infra/deploy.sh --env dev --suffix dev001

# PROD — Stripe live mode (live keys, live price, live webhook secret)
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export STRIPE_PRICE_ID=price_...
./infra/deploy.sh --env prod --suffix prod1
```

Point each environment's Stripe webhook at `https://<origin>/api/stripe/webhook`
and subscribe to `checkout.session.completed` and `customer.subscription.*`.
Locally you can forward events with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

Note: local dev (`DEV_MODE=true`) bypasses billing entirely — every brigade is
treated as entitled — so Stripe is only needed against deployed environments.

---

## GitHub Actions Variable

Add the App Service name as a **repository variable** (not a secret):
- **Name:** `AZURE_APP_SERVICE_NAME`
- **Value:** `santarun-web-<your-suffix>`

(Settings → Secrets and variables → Actions → Variables tab)

---

## Verifying WebSocket Support

Azure App Service has WebSocket support enabled in the Bicep (`webSocketsEnabled: true`).
The live tracking feature uses Azure Web PubSub for fan-out to multiple viewers.

```bash
# Verify App Service WebSocket setting
az webapp show \
  --resource-group rg-santarun-dev-<suffix> \
  --name santarun-web-<suffix> \
  --query 'siteConfig.webSocketsEnabled'

# Verify Web PubSub resource
az webpubsub show \
  --resource-group rg-santarun-dev-<suffix> \
  --name santarun-pubsub-<suffix> \
  --query '{sku:sku.name,status:properties.provisioningState}'

# Test negotiate endpoint (after deployment)
curl https://santarun-web-<suffix>.azurewebsites.net/api/negotiate?routeId=test-route
```

---

## Free Tier Limits & Constraints

### App Service F1 (Free)
- **60 CPU-minutes per day** shared — suitable for development and demos
- No always-on: app sleeps after 20 minutes of inactivity (cold start of ~10s on wake)
- No custom domain, no SSL termination at custom domain
- No deployment slots (preview environments)
- Upgrade to **B1** (~$18 AUD/month) for always-on, custom domain, and SLA
- F1 quotas are region-scoped and subscription-scoped; if you hit `QuotaExceeded`, deploy to another region or scale to B1

### Azure Web PubSub Free_F1
- **20 concurrent WebSocket connections**
- **20,000 messages per day**
- Suitable for development and small-scale testing
- Upgrade to **Standard_S1** (~$68 AUD/month) for production (1,000 connections)

### Azure Table Storage
- First 5 GB free; first 20,000 transactions/month free
- Estimated cost for typical brigade usage: **< $0.10 AUD/month**

### Application Insights + Log Analytics
- First 5 GB data free per month
- Daily cap set to 0.5 GB to prevent unexpected development costs

---

## Upgrade Path to Production

1. Switch to `prod` parameters: `./infra/deploy.sh --env prod --suffix myprod`
   - App Service: `F1` → `B1` (always-on, custom domain, SSL)
   - Web PubSub: `Free_F1` → `Standard_S1` (1,000 concurrent connections)

2. Set custom domain in Azure Portal → App Service → Custom domains

3. Configure Entra External ID for auth (Phase 7 in MASTER_PLAN.md):
   - Add `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`, etc. to GitHub secrets

4. Scale up App Service for higher traffic:
   - `S1` for auto-scaling, deployment slots, and traffic splitting

---

## Real-Time Architecture (WebSockets)

```
Navigator device (GPS)
        │ POST /api/broadcast
        ▼
Hono Server (App Service)
        │ WebPubSubServiceClient.group(route_{id}).sendToAll(message)
        ▼
Azure Web PubSub — Hub: santa_tracking
                   Group: route_{routeId}
        │ wss:// push
        ▼
Public viewer browsers (tracking page)
```

**Negotiate flow:**
1. Browser calls `GET /api/negotiate?routeId=abc&role=viewer`
2. Hono server issues a Web PubSub client access token scoped to `route_abc`
3. Browser opens native WebSocket to `wss://*.webpubsub.azure.com` using that token
4. Browser receives location updates pushed by the navigator

**Native WebSocket fallback:** App Service has `webSocketsEnabled: true`. If a future use case requires direct persistent connections to the server (e.g., low-latency two-way messaging), this can be implemented in the Hono server using Node.js `ws` or any standard WebSocket library — no reconfiguration needed.

---

## Troubleshooting

**"Subscription not found" error:**
```bash
az account list --output table && az account set --subscription "<id>"
```

**"Resource name already taken":** Change `nameSuffix` to a unique value.

**App returns 404 on direct URL loads (React Router routes):**
The Hono server's SPA fallback (`app.get('*', serveStatic(...index.html))`) handles this.
Confirm the server built correctly: `STATIC_FILES_PATH` env var should point to the `dist/` directory.

**WebSocket connection fails:**
- Check that `wss://*.webpubsub.azure.com` is in your Content-Security-Policy `connect-src`
- Verify `AZURE_WEBPUBSUB_CONNECTION_STRING` is set in App Service application settings
- Test the negotiate endpoint returns `{ url, role, routeId, groupName }`

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
