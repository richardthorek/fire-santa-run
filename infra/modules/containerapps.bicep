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

@description('vCPU allocation for the single replica. Matches the current production default (0.25) unless overridden — e.g. for a registration-informed vertical bump around a cluster of known scheduled runs (see MASTER_PLAN.md, infra/README.md). Container Apps Consumption enforces a fixed vCPU:memory ratio (1 : 2 GiB) and only accepts specific paired values (0.25/0.5Gi, 0.5/1Gi, 0.75/1.5Gi, 1.0/2Gi, ...) — an invalid pairing is rejected at deploy time by Azure itself, not silently accepted, so double-check the current allowed set (`az containerapp show --query properties.template.containers[0].resources` on an existing app, or the Container Apps docs) before picking a new value rather than trusting this comment alone.')
param containerCpu string = '0.25'

@description('Memory allocation for the single replica — must pair with containerCpu per the ratio note above. Matches the current production default (0.5Gi) unless overridden.')
param containerMemory string = '0.5Gi'

@description('Custom domain bound to the ingress (e.g. santa.stationkit.com.au). Empty = default FQDN only (dev). When set (with customDomainCertificateId) the binding is declared in the template, so a full-PUT `az deployment sub create` re-asserts it instead of dropping it — see the note on the ingress block. deploy.sh auto-discovers the live value, so CI keeps the binding even if a param file omits it.')
param customDomainName string = ''

@description('Resource ID of an EXISTING managed/uploaded certificate on this Container Apps environment for customDomainName. This template deliberately does NOT issue the certificate: DigiCert domain-control validation cannot complete while the DNS record is proxied (Cloudflare orange-cloud — see infra/README.md), so the cert is created once out-of-band (`az containerapp hostname add` + `bind`, or the portal) and referenced here. Discover it with: az containerapp env certificate list -g <rg> -n <env> --query "[?properties.subjectName==\'<domain>\'].id | [0]" -o tsv')
param customDomainCertificateId string = ''

var envName = 'santarun-env-${nameSuffix}'
var appName = 'santarun-app-${nameSuffix}'
var hasRegistry = !empty(registryServer) && !empty(registryPassword)
var bindCustomDomain = !empty(customDomainName) && !empty(customDomainCertificateId)

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
        // Restated explicitly so a full-PUT deploy preserves single-revision
        // routing instead of falling back to the implicit default.
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        // Custom-domain binding is part of the template (guarded by the two
        // customDomain* params) so `az deployment sub create` re-asserts it
        // every run. A missing binding here is what caused the 2026-09-02
        // santa.stationkit.com.au outage (Cloudflare 525 — origin had no cert
        // for the SNI). The certificate itself is NOT created here — see the
        // customDomainCertificateId param. deploy.sh discovers the live
        // hostname + cert pre-deploy and passes them back as params, so the
        // binding survives even when a param file doesn't list it.
        customDomains: bindCustomDomain ? [
          {
            name: customDomainName
            bindingType: 'SniEnabled'
            certificateId: customDomainCertificateId
          }
        ] : []
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
            // Parameterized (default matches the prior hardcoded smallest
            // Consumption allocation) so a registration-informed vertical
            // bump for a specific event window doesn't require editing this
            // template — see the containerCpu/containerMemory params above.
            cpu: json(containerCpu)
            memory: containerMemory
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
            // APP_BASE_URL, SUITE_AUTH_URL, REALTIME_WS_SECRET,
            // AZURE_COMMUNICATION_CONNECTION_STRING / EMAIL_FROM_ADDRESS /
            // OPS_ALERT_EMAIL) are applied post-deploy via
            // `az containerapp update --set-env-vars` / `az containerapp
            // secret set` — see infra/seed-secrets.sh. They stay out of Bicep
            // so a redeploy never risks clobbering a live secret, and CI
            // re-runs seed-secrets.sh after every Bicep deploy.
            //
            // Bicep still does a full PUT on the containerApp resource, so
            // `az deployment sub create` resets anything this template does
            // not restate. The two things that used to break on a redeploy
            // are now handled:
            //   • image  — deploy.sh reads the running image pre-deploy and
            //     passes it back as `containerImage`, so the PUT keeps it
            //     instead of reverting to the placeholder.
            //   • custom domain + ingress traffic — declared above (the
            //     customDomain* params + the explicit `traffic` block);
            //     deploy.sh discovers the live hostname/cert and passes them
            //     as params so the binding is re-asserted, not dropped.
            // The seeded env vars above are the only remaining post-deploy
            // step, and CI always re-runs it. Verified via `what-if`
            // 2026-09-02 (pre-fix behaviour).
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

@description('Custom domain bound to the ingress this deploy (empty if none). The public URL when set.')
output customDomain string = bindCustomDomain ? customDomainName : ''
