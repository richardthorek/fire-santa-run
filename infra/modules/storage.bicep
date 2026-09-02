// Azure Table Storage module for Fire Santa Run
// Provisions a Storage Account with the required tables for the application.
// Free tier: First 5 GB storage + 20,000 transactions/month at no charge.

@description('Azure region for the storage account')
param location string = resourceGroup().location

@description('Suffix appended to the storage account name for uniqueness')
param nameSuffix string

@description('Environment name (dev or prod). Dev mode prefixes table names with "dev".')
@allowed(['dev', 'prod'])
param environment string = 'dev'

@description('Resource tags')
param tags object = {}

var storageAccountName = 'santarun${nameSuffix}'
// Tables the server also creates on first use at runtime (getTableClient) — listed
// here so a fresh deploy has them ready and their existence is documented in IaC.
var tables = ['brigades', 'routes', 'waypoints', 'trackingsessions', 'viewersessions', 'users', 'memberships', 'invitations', 'verifications', 'moderationflags']

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    // Standard_LRS: Locally-redundant storage — lowest cost, sufficient for dev/prod
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // Enable hierarchical namespace for future Blob Storage features
    isHnsEnabled: false
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

// Blob service hosts the nightly Table backups (see infra/backup/). Azure Table
// Storage has no soft-delete or point-in-time restore, so the exported JSON in
// this container IS the recovery path. Soft-delete + versioning protect the
// backups themselves (and any future blob data) against an accidental delete
// or overwrite for 30 days.
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
  }
}

resource backupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'backups'
  properties: {
    publicAccess: 'None'
  }
}

// Production tables (no prefix)
resource prodTables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = [
  for tableName in tables: if (environment == 'prod') {
    parent: tableService
    name: tableName
  }
]

// Dev tables (prefixed with 'dev' to isolate from production data)
resource devTables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = [
  for tableName in tables: if (environment == 'dev') {
    parent: tableService
    name: 'dev${tableName}'
  }
]

@description('Storage account name')
output storageAccountName string = storageAccount.name

@description('Storage account resource ID')
output storageAccountId string = storageAccount.id

@description('Primary connection string for the storage account')
@secure()
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
