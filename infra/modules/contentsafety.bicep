// Azure AI Content Safety module for Fire Santa Run
//
// Moderates the free-text and image content brigades can publish to public,
// unauthenticated surfaces: run names, brigade names, and brigade logos
// (server/src/utils/contentSafety.ts). A flagged name blocks the route
// publish / brigade save with HTTP 422; a platform admin reviews and can
// override from the /admin portal.
//
// Cost shape: the S0 (pay-as-you-go) tier bills per record — roughly
// US$0.75 / 1,000 text records and US$1.50 / 1,000 images, with the first
// 5,000 of each free every month. A brigade Santa app publishes a handful of
// runs and logos per season, so the effective cost is ~$0. F0 (free tier,
// hard-capped at 5,000/month of each) is available via `sku` but Azure
// permits only one F0 Content Safety account per subscription per region.
//
// Key auth needs a custom subdomain on the account so the endpoint host is
// unique — `customSubDomainName` below provides it.

@description('Azure region for the Content Safety account')
param location string = resourceGroup().location

@description('Name suffix for uniqueness (mirrors the other modules)')
param nameSuffix string

@description('Resource tags')
param tags object = {}

@description('Pricing tier. S0 = pay-as-you-go (recommended); F0 = free, one per subscription/region.')
@allowed(['S0', 'F0'])
param sku string = 'S0'

var accountName = 'santarun-cs-${nameSuffix}'

resource contentSafety 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'ContentSafety'
  sku: {
    name: sku
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    // Required for key-based auth against a stable per-account endpoint host.
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    // Content Safety analyses transient request payloads only — it stores no
    // customer content — so no additional data-residency config is needed.
  }
}

@description('Content Safety account name')
output accountName string = contentSafety.name

@description('Content Safety endpoint (CONTENT_SAFETY_ENDPOINT)')
output endpoint string = contentSafety.properties.endpoint

@description('Content Safety primary key (CONTENT_SAFETY_KEY) — seed as a Container App secret')
@secure()
output primaryKey string = contentSafety.listKeys().key1
