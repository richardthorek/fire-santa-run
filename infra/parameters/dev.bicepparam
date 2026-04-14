// Development environment parameters for Fire Santa Run
// All resources use free/minimal SKUs suitable for local dev and staging.
//
// Usage:
//   az deployment sub create \
//     --location australiaeast \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters/dev.bicepparam

using '../main.bicep'

// Override nameSuffix with a short unique string, e.g. your initials + 4-digit number.
// Must be 3–8 lowercase alphanumeric characters. Ensures globally unique resource names.
// Example: 'abc1234', 'rjt2025', 'dev0001'
param nameSuffix = 'dev001'

param environment = 'dev'

param location = 'australiaeast'

// Set to your GitHub repo URL to enable automatic CI/CD linking.
// Leave empty to configure CI/CD manually via the Azure Portal or GitHub Actions token.
param repositoryUrl = ''

param branch = 'main'
