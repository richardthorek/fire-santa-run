// Monitoring module for Fire Santa Run
// Provisions a Log Analytics Workspace and Application Insights instance.
// Both are free for the first 5 GB of data ingested per month.

@description('Azure region for monitoring resources')
param location string = resourceGroup().location

@description('Suffix appended to resource names for uniqueness')
param nameSuffix string

@description('Resource tags')
param tags object = {}

var workspaceName = 'santarun-logs-${nameSuffix}'
var appInsightsName = 'santarun-insights-${nameSuffix}'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      // PerGB2018: Pay-per-GB pricing, first 5 GB/month free
      name: 'PerGB2018'
    }
    // 30-day retention is free; longer retention incurs costs
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      // Limit daily ingestion to 0.5 GB to avoid unexpected costs during development
      dailyQuotaGb: json('0.5')
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 30
    DisableIpMasking: false
  }
}

@description('Log Analytics Workspace name')
output workspaceName string = logAnalyticsWorkspace.name

@description('Log Analytics Workspace resource ID')
output workspaceId string = logAnalyticsWorkspace.id

@description('Log Analytics Workspace customer ID (needed by the Container Apps managed environment)')
output workspaceCustomerId string = logAnalyticsWorkspace.properties.customerId

@description('Log Analytics Workspace primary shared key (needed by the Container Apps managed environment)')
@secure()
output workspaceSharedKey string = logAnalyticsWorkspace.listKeys().primarySharedKey

@description('Application Insights name')
output appInsightsName string = appInsights.name

@description('Application Insights instrumentation key')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights connection string')
output connectionString string = appInsights.properties.ConnectionString
