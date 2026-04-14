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

// Set to your GitHub repository URL to enable CI/CD linking via the Static Web Apps resource.
param repositoryUrl = 'https://github.com/richardthorek/fire-santa-run'

param branch = 'main'
