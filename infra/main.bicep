// Fire Santa Run — Azure Infrastructure (Bicep)
//
// Provisions all Azure resources required for the Fire Santa Run application:
//   • Azure Container Apps (Consumption)  — Runs the Hono Node.js server (API,
//     static SPA, and the in-process realtime WebSocket hub). Scales to zero
//     when idle — see infra/modules/containerapps.bicep for the cost model
//     and the single-replica constraint.
//   • Azure Table Storage                 — NoSQL data persistence (routes,
//     brigades, tracking)
//   • Application Insights                — Basic logging and monitoring
//     (connected to Log Analytics)
//
// Retired: Azure App Service and Azure Web PubSub. Realtime tracking no
// longer uses a managed pub/sub service — it fans out over native WebSockets
// inside the same Container App process. See docs/ARCHITECTURE.md.
//
// Usage:
//   az deployment sub create \
//     --location australiaeast \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/dev.bicepparam
//
// See infra/README.md for full deployment instructions.

targetScope = 'subscription'

// ─── Parameters ──────────────────────────────────────────────────────────────

@description('Azure region for all resources (default: australiaeast)')
param location string = 'australiaeast'

@description('Environment name. Controls resource naming and SKU selection.')
@allowed(['dev', 'prod'])
param environment string = 'dev'

@description('Short unique suffix appended to resource names to ensure global uniqueness (e.g. "abc123")')
@minLength(3)
@maxLength(8)
param nameSuffix string

@description('Optional existing CIAM directory resource name in this resource group (e.g. brigadesantarun.onmicrosoft.com). Leave empty to skip CIAM binding.')
param ciamDirectoryName string = ''

@description('Container Apps minimum replica count. 0 = scale-to-zero (default; off-season). Flip to 1 for December via infra/scale-season.sh — no redeploy needed.')
@minValue(0)
@maxValue(1)
param minReplicas int = 0

@description('vCPU for the single replica. Default matches the original smallest Consumption allocation. Override for a registration-informed vertical bump around a cluster of known scheduled runs — see infra/modules/containerapps.bicep for the valid vCPU:memory pairing note.')
param containerCpu string = '0.25'

@description('Memory for the single replica — must pair with containerCpu. Default matches the original smallest Consumption allocation.')
param containerMemory string = '0.5Gi'

@description('Container image to deploy (e.g. ghcr.io/<owner>/fire-santa-run:<tag>). Leave the default placeholder for the first deploy — CI updates it via `az containerapp update --image`.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Container registry server (e.g. ghcr.io). Leave empty for the public placeholder image.')
param registryServer string = ''

@description('Container registry username (e.g. the GitHub org/user for ghcr.io).')
param registryUsername string = ''

@description('Container registry password / PAT. Leave empty to skip registry auth.')
@secure()
param registryPassword string = ''

// ─── Variables ───────────────────────────────────────────────────────────────

var resourceGroupName = 'rg-santarun-${environment}-${nameSuffix}'

var commonTags = {
  application: 'fire-santa-run'
  environment: environment
  managedBy: 'bicep'
}

// ─── Resource Group ──────────────────────────────────────────────────────────

resource resourceGroup 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

// ─── Modules ─────────────────────────────────────────────────────────────────

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    location: location
    nameSuffix: nameSuffix
    tags: commonTags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  scope: resourceGroup
  params: {
    location: location
    nameSuffix: nameSuffix
    environment: environment
    tags: commonTags
  }
}

module containerApps 'modules/containerapps.bicep' = {
  name: 'containerapps'
  scope: resourceGroup
  params: {
    location: location
    nameSuffix: nameSuffix
    tags: commonTags
    logAnalyticsCustomerId: monitoring.outputs.workspaceCustomerId
    logAnalyticsSharedKey: monitoring.outputs.workspaceSharedKey
    appInsightsConnectionString: monitoring.outputs.connectionString
    minReplicas: minReplicas
    containerCpu: containerCpu
    containerMemory: containerMemory
    containerImage: containerImage
    registryServer: registryServer
    registryUsername: registryUsername
    registryPassword: registryPassword
  }
}

resource ciamDirectory 'Microsoft.AzureActiveDirectory/ciamDirectories@2025-08-01-preview' existing = if (!empty(ciamDirectoryName)) {
  scope: resourceGroup
  name: ciamDirectoryName
}

// No dedicated ACS Email resource here: operational alerts
// (server/src/utils/opsAlert.ts) deliberately share Station Manager's
// existing Azure Communication Services instance (already has a verified
// custom domain wired up) rather than provisioning and paying for a second
// one — see infra/README.md and infra/.env.example for how to get its
// connection string.

// ─── Outputs ─────────────────────────────────────────────────────────────────

@description('Resource group name')
output resourceGroupName string = resourceGroup.name

@description('Container App name (use as AZURE_CONTAINER_APP_NAME GitHub Actions variable)')
output containerAppName string = containerApps.outputs.appName

@description('Container Apps managed environment name')
output containerAppsEnvironmentName string = containerApps.outputs.environmentName

@description('Container App default (auto-generated) URL — bind a custom domain separately, see infra/README.md')
output appUrl string = 'https://${containerApps.outputs.defaultFqdn}'

@description('Azure Table Storage connection string (add to GitHub secret / env var AZURE_STORAGE_CONNECTION_STRING)')
@secure()
output storageConnectionString string = storage.outputs.connectionString

@description('Application Insights connection string (for optional instrumentation)')
output appInsightsConnectionString string = monitoring.outputs.connectionString

@description('CIAM tenant ID (if ciamDirectoryName provided)')
output ciamTenantId string = ciamDirectory.?properties.?tenantId ?? ''

@description('CIAM tenant domain (if ciamDirectoryName provided)')
output ciamDomainName string = ciamDirectory.?properties.?domainName ?? ''
