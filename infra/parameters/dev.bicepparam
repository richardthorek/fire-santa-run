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

param ciamDirectoryName = ''

// Custom domain — leave empty for a plain dev environment (default FQDN only).
// If a dev/staging box does have a hostname bound, infra/deploy.sh discovers it
// from the live app and re-asserts it automatically, so the full-PUT deploy no
// longer drops the binding. See infra/README.md → "Custom domain".
param customDomainName = ''
param customDomainCertificateId = ''
