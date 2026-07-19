// Azure Container Apps module for Fire Santa Run
//
// Replaces the App Service + Web PubSub pair with a single Container Apps
// Consumption workload: the same Hono server image, scaled to ZERO when idle
// and back up automatically on the next request. There is no realtime
// managed service any more — the server fans out WebSocket messages
// in-process (see server/src/realtime/) — so this is the only compute
// resource the runtime needs.
//
// Cost shape: Consumption plan is billed per vCPU-second / GiB-second while a
// replica is running, with a monthly free grant (180,000 vCPU-seconds,
// 360,000 GiB-seconds). minReplicas=0 means idle months cost ~$0; a request
// during the off-season triggers a cold start (a few seconds) before the
// first reply. Set minReplicas=1 for the December season so live tracking
// never pays a cold-start penalty mid-run — see infra/scale-season.sh.
//
// IMPORTANT scaling constraint: maxReplicas is capped at 1. The realtime hub
// (viewer/broadcaster/editor WebSocket sets, live viewer counts) lives in
// this process's memory — a second replica would not see the first replica's
// connections, silently splitting fan-out. Raise maxReplicas only after
// adding a shared backplane (e.g. Redis pub/sub) for the hub.

@description('Azure region for the Container Apps resources')
param location string = resourceGroup().location

@description('Name suffix for uniqueness')
param nameSuffix string

@description('Resource tags')
param tags object = {}

@description('Log Analytics workspace customer ID (from the monitoring module)')
param logAnalyticsCustomerId string

@description('Log Analytics workspace primary shared key (from the monitoring module)')
@secure()
param logAnalyticsSharedKey string

@description('Application Insights connection string')
param appInsightsConnectionString string = ''

@description('Minimum replica count. 0 = scale-to-zero (off-season); 1 = always warm (December — see scale-season.sh).')
@minValue(0)
@maxValue(1)
param minReplicas int = 0

@description('Maximum replica count. Capped at 1 — see module header note on the in-process realtime hub.')
@minValue(1)
@maxValue(1)
param maxReplicas int = 1

@description('Container image to deploy. Defaults to a public placeholder so the first `az deployment sub create` succeeds before CI has pushed a real image; CD then runs `az containerapp update --image ...`.')
param containerImage string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('Container registry server (e.g. ghcr.io). Leave empty for a public image / the placeholder.')
param registryServer string = ''

@description('Container registry username (e.g. the GitHub org/user for ghcr.io).')
param registryUsername string = ''

@description('Container registry password / PAT. Leave empty to skip registry auth (public image).')
@secure()
param registryPassword string = ''

var envName = 'santarun-env-${nameSuffix}'
var appName = 'santarun-app-${nameSuffix}'
var hasRegistry = !empty(registryServer) && !empty(registryPassword)

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    // Consumption-only environment: no dedicated workload profile to pay for
    // even when every app inside it is scaled to zero.
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: tags
  properties: {
    environmentId: managedEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        // 'auto' negotiates HTTP/1.1 or HTTP/2 per-request and supports the
        // HTTP/1.1 Upgrade handshake WebSocket needs — Container Apps ingress
        // supports WebSockets natively on this setting.
        transport: 'auto'
        allowInsecure: false
      }
      registries: hasRegistry ? [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ] : []
      secrets: hasRegistry ? [
        {
          name: 'registry-password'
          value: registryPassword
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'server'
          image: containerImage
          resources: {
            // Smallest Consumption allocation — this is a lightweight Node
            // API + static-file server, not a compute-heavy workload.
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'PORT', value: '8080' }
            { name: 'NODE_ENV', value: 'production' }
            { name: 'DEV_MODE', value: 'false' }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: appInsightsConnectionString
            }
            // All other settings (Storage, VAPID, CORS_ORIGIN,
            // APP_BASE_URL, SUITE_AUTH_URL, REALTIME_WS_SECRET) are
            // applied post-deploy via `az containerapp update --set-env-vars`
            // / `az containerapp secret set` — see infra/seed-secrets.sh.
            // Kept out of Bicep so re-running `az deployment sub create`
            // never risks clobbering a live secret.
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

@description('Container App name')
output appName string = containerApp.name

@description('Container Apps managed environment name')
output environmentName string = managedEnvironment.name

@description('Default (auto-generated) FQDN for the Container App')
output defaultFqdn string = containerApp.properties.configuration.ingress.fqdn
