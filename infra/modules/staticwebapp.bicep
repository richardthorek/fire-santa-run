// Azure Static Web Apps module for Fire Santa Run
// The Static Web App hosts the React + TypeScript frontend and Azure Functions API.
// Free tier: Custom domains, SSL, GitHub/Azure DevOps CI/CD — no cost.
// Standard tier: Adds authentication providers, private endpoints, etc.

@description('Azure region for the Static Web App')
param location string = resourceGroup().location

@description('Name for the Static Web App')
param name string

@description('SKU for the Static Web App')
@allowed(['Free', 'Standard'])
param sku string = 'Free'

@description('GitHub repository URL (e.g. https://github.com/org/repo)')
param repositoryUrl string = ''

@description('GitHub branch to deploy from')
param branch string = 'main'

@description('Resource tags')
param tags object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // Repository details are optional — the GitHub Actions workflow handles CI/CD
    repositoryUrl: repositoryUrl != '' ? repositoryUrl : null
    branch: branch
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

@description('Static Web App name')
output staticWebAppName string = staticWebApp.name

@description('Static Web App resource ID')
output staticWebAppId string = staticWebApp.id

@description('Default hostname for the Static Web App')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Deployment API token (used in GitHub Actions)')
@secure()
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
