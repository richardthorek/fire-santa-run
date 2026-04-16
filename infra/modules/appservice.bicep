// Azure App Service module for Fire Santa Run
// Provisions an App Service Plan + Web App to run the Hono Node.js server.
//
// The App Service:
//   - Serves the API on /api/* using the Hono server
//   - Serves the built React SPA as static files for all other paths
//   - Supports native WebSockets (if needed in future; currently Azure Web PubSub handles fan-out)
//
// Free tier (F1):  Shared compute, 60 min/day CPU, no custom domain, no SLA — dev/staging only
//                  Application Insights auto-instrumentation agent is DISABLED on F1 to prevent
//                  background monitoring tasks from exhausting the daily CPU quota when idle.
// Basic tier (B1): Dedicated compute, custom domains, SSL, always-on — production minimum
//                  Application Insights auto-instrumentation agent is ENABLED for full telemetry.

@description('Azure region for the App Service resources')
param location string = resourceGroup().location

@description('Name suffix for uniqueness')
param nameSuffix string

@description('SKU for the App Service Plan')
@allowed(['F1', 'B1', 'B2', 'B3', 'S1'])
param sku string = 'F1'

@description('Node.js version to use (must match project engines.node requirement)')
param nodeVersion string = 'NODE|22-lts'

@description('Resource tags')
param tags object = {}

@description('Optional Application Insights connection string to inject into App Service settings')
param appInsightsConnectionString string = ''

var planName = 'santarun-plan-${nameSuffix}'
var appName = 'santarun-web-${nameSuffix}'

// App Service Plan — the compute tier
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: sku
    // F1 and B1 are single-instance; scale out requires S1+
    tier: sku == 'F1' ? 'Free' : (sku == 'B1' || sku == 'B2' || sku == 'B3' ? 'Basic' : 'Standard')
  }
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux plans
  }
}

// Web App — runs the Hono Node.js server
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: nodeVersion
      // Start the server from the repo root so that './dist' resolves to the React build output
      appCommandLine: 'node server/dist/main.js'
      // Enable WebSocket support (native WebSockets, in addition to Azure Web PubSub)
      webSocketsEnabled: true
      // Disable FTP deployment — use zip deploy or GitHub Actions only
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
    clientAffinityEnabled: false
  }
}

// App Service settings — Application Insights connection string is always injected when provided.
// The auto-instrumentation agent (ApplicationInsightsAgent_EXTENSION_VERSION) is only enabled for
// non-Free tiers because the agent runs continuous background monitoring tasks (heartbeats,
// performance counters, dependency tracking) that consume CPU even with zero user traffic.
// On F1 (60 CPU-minutes/day shared compute) this background agent can exhaust the entire daily
// quota before any real user requests are served.  On paid tiers (B1+) the agent is safe to enable.
resource appSettings 'Microsoft.Web/sites/config@2023-01-01' = if (!empty(appInsightsConnectionString)) {
  parent: webApp
  name: 'appsettings'
  properties: union(
    {
      APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
    },
    // Enable auto-instrumentation agent only on paid tiers — not on Free (F1)
    sku != 'F1' ? { ApplicationInsightsAgent_EXTENSION_VERSION: '~3' } : {}
  )
}

@description('App Service name')
output appName string = webApp.name

@description('App Service resource ID')
output appId string = webApp.id

@description('Default hostname for the App Service')
output defaultHostname string = webApp.properties.defaultHostName
