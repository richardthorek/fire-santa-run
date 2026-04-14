// Fire Santa Run — Azure Infrastructure (Bicep)
// 
// Provisions all Azure resources required for the Fire Santa Run application:
//   • Azure Static Web Apps  — Hosts the React frontend + Azure Functions API
//   • Azure Table Storage    — NoSQL data persistence (routes, brigades, tracking)
//   • Azure Web PubSub       — Real-time WebSocket communication for live Santa tracking
//   • Application Insights   — Basic logging and monitoring (connected to Log Analytics)
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

@description('GitHub repository URL for Static Web Apps CI/CD integration (optional)')
param repositoryUrl string = ''

@description('GitHub branch to deploy from')
param branch string = 'main'

// ─── Variables ───────────────────────────────────────────────────────────────

var resourceGroupName = 'rg-santarun-${environment}-${nameSuffix}'

var commonTags = {
  application: 'fire-santa-run'
  environment: environment
  managedBy: 'bicep'
}

// Static Web Apps SKU: Free tier is sufficient for development.
// Note: The existing production SWA uses Standard (needed for custom auth providers).
// Switch to 'Standard' when enabling Entra External ID authentication in production.
var swaSkuName = environment == 'prod' ? 'Standard' : 'Free'
var staticWebAppName = 'santarun-web-${environment}-${nameSuffix}'

// Web PubSub SKU: Free_F1 provides 20 concurrent connections and 20K messages/day.
// Sufficient for development and small-scale testing.
// Switch to Standard_S1 for production workloads.
var pubSubSkuName = environment == 'prod' ? 'Standard_S1' : 'Free_F1'

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

module webPubSub 'modules/webpubsub.bicep' = {
  name: 'webpubsub'
  scope: resourceGroup
  params: {
    location: location
    nameSuffix: nameSuffix
    sku: pubSubSkuName
    tags: commonTags
  }
}

module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp'
  scope: resourceGroup
  params: {
    location: location
    name: staticWebAppName
    sku: swaSkuName
    repositoryUrl: repositoryUrl
    branch: branch
    tags: commonTags
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

@description('Resource group name')
output resourceGroupName string = resourceGroup.name

@description('Static Web App URL')
output appUrl string = 'https://${staticWebApp.outputs.defaultHostname}'

@description('Static Web App deployment API token (add to GitHub secret AZURE_STATIC_WEB_APPS_API_TOKEN)')
@secure()
output staticWebAppDeploymentToken string = staticWebApp.outputs.deploymentToken

@description('Azure Table Storage connection string (add to GitHub secret / env var AZURE_STORAGE_CONNECTION_STRING)')
@secure()
output storageConnectionString string = storage.outputs.connectionString

@description('Azure Web PubSub connection string (add to GitHub secret / env var AZURE_WEBPUBSUB_CONNECTION_STRING)')
@secure()
output webPubSubConnectionString string = webPubSub.outputs.connectionString

@description('Web PubSub hub name (set AZURE_WEBPUBSUB_HUB_NAME env var to this value)')
output webPubSubHubName string = webPubSub.outputs.hubName

@description('Application Insights connection string (for optional frontend/backend instrumentation)')
output appInsightsConnectionString string = monitoring.outputs.connectionString
