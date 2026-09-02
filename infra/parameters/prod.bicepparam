// Production environment parameters for Fire Santa Run
// Resources use paid SKUs where required for production workloads.
// Review SKU choices and costs in infra/README.md before deploying.
//
// Usage:
//   az deployment sub create \
//     --location australiaeast \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/prod.bicepparam

using '../main.bicep'

// Use a consistent suffix for your production resources.
// Must be 3–8 lowercase alphanumeric characters.
param nameSuffix = 'prod1'

param environment = 'prod'

param location = 'australiaeast'

param ciamDirectoryName = ''

// Custom domain bound to the Container App ingress.
//
// Leave BOTH empty to let infra/deploy.sh auto-discover and re-assert whatever
// hostname/cert is already bound to the live app (the normal case — the
// certificate is issued once out-of-band because Cloudflare-proxied DNS blocks
// DigiCert validation; see infra/README.md → "Custom domain").
//
// Pin them explicitly only if you want the binding declared even for a
// first-ever deploy of a fresh environment. customDomainCertificateId is the
// full resource ID from:
//   az containerapp env certificate list -g <rg> -n <env> \
//     --query "[?properties.subjectName=='santa.stationkit.com.au'].id | [0]" -o tsv
param customDomainName = ''
param customDomainCertificateId = ''
