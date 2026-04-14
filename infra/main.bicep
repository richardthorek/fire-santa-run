// Fire Santa Run — Azure Infrastructure (Bicep)
//
// Provisions all Azure resources required for the Fire Santa Run application:
//   • Azure App Service (Linux)  — Runs the Hono Node.js server (API + static SPA)
//   • Azure Table Storage        — NoSQL data persistence (routes, brigades, tracking)
//   • Azure Web PubSub           — Real-time WebSocket communication for live Santa tracking
//   • Application Insights       — Basic logging and monitoring (connected to Log Analytics)
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

// ─── Variables ───────────────────────────────────────────────────────────────

var resourceGroupName = 'rg-santarun-${environment}-${nameSuffix}'

var commonTags = {
  application: 'fire-santa-run'
  environment: environment
  managedBy: 'bicep'
}

// App Service SKU:
//   dev  → F1 (Free — shared compute, 60 CPU min/day, no always-on)
//   prod → B1 (Basic — dedicated compute, custom domain, SSL, always-on)
var appServiceSku = environment == 'prod' ? 'B1' : 'F1'

// Web PubSub SKU:
//   dev  → Free_F1 (20 concurrent connections, 20K messages/day)
//   prod → Standard_S1 (1,000 concurrent connections, unlimited messages)
var pubSubSku = environment == 'prod' ? 'Standard_S1' : 'Free_F1'

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
    sku: pubSubSku
    tags: commonTags
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appservice'
  scope: resourceGroup
  params: {
    location: location
    nameSuffix: nameSuffix
    sku: appServiceSku
    tags: commonTags
  }
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

@description('Resource group name')
output resourceGroupName string = resourceGroup.name

@description('App Service name (use as AZURE_APP_SERVICE_NAME GitHub Actions variable)')
output appServiceName string = appService.outputs.appName

@description('App Service URL')
output appUrl string = 'https://${appService.outputs.defaultHostname}'

@description('App Service publish profile XML (add to GitHub secret AZURE_APP_SERVICE_PUBLISH_PROFILE)')
@secure()
output appServicePublishProfile string = appService.outputs.publishProfile

@description('Azure Table Storage connection string (add to GitHub secret / env var AZURE_STORAGE_CONNECTION_STRING)')
@secure()
output storageConnectionString string = storage.outputs.connectionString

@description('Azure Web PubSub connection string (add to GitHub secret / env var AZURE_WEBPUBSUB_CONNECTION_STRING)')
@secure()
output webPubSubConnectionString string = webPubSub.outputs.connectionString

@description('Web PubSub hub name (set AZURE_WEBPUBSUB_HUB_NAME env var to this value)')
output webPubSubHubName string = webPubSub.outputs.hubName

@description('Application Insights connection string (for optional instrumentation)')
output appInsightsConnectionString string = monitoring.outputs.connectionString
