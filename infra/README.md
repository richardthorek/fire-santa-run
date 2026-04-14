# Fire Santa Run — Azure Infrastructure as Code

This directory contains [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/) templates to provision all Azure resources required by the Fire Santa Run application.

## Directory Structure

```
infra/
├── main.bicep                  # Root orchestration template (subscription scope)
├── deploy.sh                   # One-command deployment script
├── modules/
│   ├── storage.bicep           # Azure Table Storage (data persistence)
│   ├── webpubsub.bicep         # Azure Web PubSub (real-time WebSockets)
│   ├── staticwebapp.bicep      # Azure Static Web Apps (hosting + Functions API)
│   └── monitoring.bicep        # Application Insights + Log Analytics (monitoring)
└── parameters/
    ├── dev.bicepparam           # Development environment parameters
    └── prod.bicepparam          # Production environment parameters
```

---

## Service Selection Matrix

| Service | SKU (Dev) | SKU (Prod) | Free Tier Limits | Why This Service |
|---|---|---|---|---|
| **Azure Static Web Apps** | Free | Standard | 100 GB/month bandwidth, custom domains, SSL | Native GitHub Actions CI/CD, serverless API functions (Azure Functions v4), preview environments per PR, global CDN |
| **Azure Table Storage** | Standard_LRS | Standard_LRS | 5 GB + 20,000 transactions/month free | Low-cost NoSQL with partition/row key model matching the brigade isolation pattern; supports all CRUD operations needed by the app |
| **Azure Web PubSub** | Free_F1 | Standard_S1 | 20 concurrent connections, 20,000 messages/day | Fully managed WebSocket service, standard WS protocol, group-based fan-out for per-route tracking, integrates with Azure Functions via negotiate endpoint |
| **Application Insights + Log Analytics** | PerGB2018 | PerGB2018 | 5 GB ingestion/month free, 30-day retention free | Distributed tracing for API functions, real-time metrics, custom queries; Log Analytics workspace enables future alerting |

### Why Bicep (not Terraform/Pulumi)?

- **No additional tooling** — works with the Azure CLI already required for this project.
- **First-class Azure support** — new Azure features appear in Bicep before Terraform providers.
- **Compiles to ARM** — portable, auditable, and supported natively in Azure Portal deployment history.
- **Strong typing + IDE support** — VS Code Bicep extension provides IntelliSense and validation.

---

## Prerequisites

1. **Azure CLI** ≥ 2.50 — [Install guide](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
2. **Bicep CLI** — installed automatically with Azure CLI 2.20+, or run:
   ```bash
   az bicep install
   az bicep upgrade
   ```
3. **Azure subscription** — [Free account](https://azure.microsoft.com/free/) includes $200 credit

Verify your setup:
```bash
az --version       # Should show 2.50+
az bicep version   # Should show 0.20+
az account show    # Confirm you're logged in to the correct subscription
```

---

## Quick Start (Single Command)

```bash
# Deploy development environment (uses free SKUs)
./infra/deploy.sh

# Deploy with a custom name suffix (must be 3–8 lowercase alphanumeric chars)
./infra/deploy.sh --suffix abc123

# Validate without deploying (dry run)
./infra/deploy.sh --dry-run

# Deploy production environment
./infra/deploy.sh --env prod --suffix prod1
```

The script will:
1. Check Azure CLI is installed and you are logged in
2. Show you a deployment summary and ask for confirmation (prod only)
3. Create the resource group and all resources
4. Output the connection strings and secrets you need to configure

---

## Manual Deployment

If you prefer to run the Azure CLI commands directly:

```bash
# Log in
az login

# (Optional) Select the subscription you want to use
az account set --subscription "<subscription-name-or-id>"

# Deploy to dev environment
az deployment sub create \
  --location australiaeast \
  --template-file infra/main.bicep \
  --parameters infra/parameters/dev.bicepparam \
  --name santarun-dev-$(date +%Y%m%d)

# View outputs (connection strings, app URL, etc.)
az deployment sub show \
  --name <deployment-name> \
  --query 'properties.outputs'
```

---

## After Deployment — Configure GitHub Secrets

After deploying, add the following secrets to your GitHub repository  
(**Settings → Secrets and variables → Actions**):

| Secret Name | Source | Required |
|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Bicep output `staticWebAppDeploymentToken` | ✅ Yes |
| `AZURE_STORAGE_CONNECTION_STRING` | Bicep output `storageConnectionString` | ✅ Yes (production) |
| `AZURE_WEBPUBSUB_CONNECTION_STRING` | Bicep output `webPubSubConnectionString` | ✅ Yes (production) |

The Static Web Apps API token is used in `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml` and is **required for CI/CD deployment**.

To retrieve secrets after deployment:
```bash
az deployment sub show \
  --name <deployment-name> \
  --query 'properties.outputs.storageConnectionString.value' \
  --output tsv
```

---

## Verifying WebSocket Support

Azure Web PubSub provides managed WebSocket support. To verify the hub is working:

```bash
# Check the resource was created
az webpubsub show \
  --resource-group rg-santarun-dev-<suffix> \
  --name santarun-pubsub-<suffix> \
  --query '{sku:sku.name,hostName:properties.hostName,status:properties.provisioningState}'

# Test the negotiate endpoint (after app deployment)
curl https://<your-app>.azurestaticapps.net/api/negotiate?routeId=test-route
```

In the browser (once deployed), open the tracking page and check the **Network** tab for a WebSocket connection to `wss://*.webpubsub.azure.com`.

---

## Free Tier Limits & Constraints

### Azure Static Web Apps (Free)
- 100 GB bandwidth/month
- 2 custom domains
- No SLA
- **No** Azure Functions premium features (e.g., VNet integration)
- Upgrade to **Standard** ($9 USD/month) when enabling Entra External ID authentication

### Azure Web PubSub (Free_F1)
- **20 concurrent WebSocket connections**
- **20,000 messages per day**
- Suitable for development and small-scale testing (≤ 20 simultaneous viewers)
- No SLA
- Upgrade to **Standard_S1** ($49 USD/month) for production (1,000 connections)

### Azure Table Storage (Standard_LRS)
- First 5 GB storage free
- First 20,000 read/write transactions free per month
- Estimated cost for typical brigade usage: **< $0.10 AUD/month**

### Application Insights + Log Analytics
- First 5 GB data ingested free per month
- 30-day retention included
- Daily cap set to 0.5 GB to prevent unexpected costs during development

---

## Upgrade Path to Production

When you are ready for production:

1. **Static Web Apps → Standard** (enables Entra External ID, private endpoints):
   ```bash
   ./infra/deploy.sh --env prod --suffix prod1
   ```

2. **Web PubSub → Standard_S1** (1,000 concurrent connections):
   The `prod.bicepparam` parameters file already selects `Standard_S1`.

3. **Storage → Geo-redundant** (for higher durability, optional):
   Edit `infra/modules/storage.bicep` and change `Standard_LRS` to `Standard_GRS`.

4. **Monitoring → Long retention** (optional):
   Edit `infra/modules/monitoring.bicep` and increase `retentionInDays` (90 days = additional cost).

---

## Real-Time Architecture

```
Brigade Operator (GPS device)
        │
        ▼ HTTP POST /api/broadcast
Azure Functions API (Static Web Apps)
        │
        ▼ WebPubSubServiceClient.sendToGroup()
Azure Web PubSub Hub: 'santa-tracking'
  Group: 'route_{routeId}'
        │
        ▼ WebSocket push (wss://)
Public Viewers (tracking page /track/{routeId})
```

The `negotiate` Azure Function generates a client access token, allowing viewers to join a route-specific group and receive live location updates without authentication.

**Fallback strategy:** If WebSocket is unavailable (firewalls, old browsers), the app falls back to HTTP long-polling via the `/api/location` endpoint.

---

## Notes on Alternative Real-Time Approaches

| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| **Azure Web PubSub** ✅ | Fully managed, standard WS, group fan-out, integrates with Functions | Costs $49/month at Standard tier | **Use this** — chosen approach |
| **Server-Sent Events (SSE)** | Simpler, HTTP/1.1, no WebSocket required | Unidirectional only (server → client) | Good fallback for read-only viewers |
| **HTTP Long-Polling** | Works everywhere, no WS support needed | Higher latency, more server load | Implemented as fallback |
| **Azure SignalR Service** | Similar to Web PubSub, supports SignalR clients | Higher complexity, less standard | Not recommended (Web PubSub is simpler) |
| **Azure App Service WebSockets** | True persistent WS, supports custom logic | Requires always-on server, no serverless | Use for future if full duplex app logic needed |

The current architecture uses Azure Web PubSub as the primary real-time channel because the Static Web Apps + Azure Functions serverless model does not support persistent server-side connections needed by App Service WebSockets.

---

## Troubleshooting

**"Subscription not found" error:**
```bash
az account list --output table
az account set --subscription "<id>"
```

**"Resource name already taken" error:**
Change the `nameSuffix` parameter to something unique (globally unique names are required for Storage Accounts and Web PubSub).

**WebSocket connection fails in browser:**
- Ensure `wss://*.webpubsub.azure.com` is allowed in your Content-Security-Policy
- Check the `staticwebapp.config.json` `connect-src` header includes `wss://*.webpubsub.azure.com`
- Verify the negotiate endpoint returns a valid client URL

**Deployment fails with permissions error:**
You need at least **Contributor** role on the subscription (or resource group if deploying at RG scope).

---

## Clean Up

To delete all resources (and stop all costs):

```bash
# Remove the entire resource group
az group delete \
  --name rg-santarun-dev-<suffix> \
  --yes \
  --no-wait
```

> ⚠️ **Warning:** This permanently deletes all data including Table Storage tables and their contents.
