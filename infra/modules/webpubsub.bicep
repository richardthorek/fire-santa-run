// Azure Web PubSub module for Fire Santa Run
// Provisions a Web PubSub hub for real-time WebSocket communication.
// Free tier: 20 concurrent connections, 20,000 messages/day — sufficient for dev/staging.

@description('Azure region for the Web PubSub instance')
param location string = resourceGroup().location

@description('Suffix appended to the Web PubSub name for uniqueness')
param nameSuffix string

@description('SKU for the Web PubSub service')
@allowed(['Free_F1', 'Standard_S1'])
param sku string = 'Free_F1'

@description('Resource tags')
param tags object = {}

// Hub name must match AZURE_WEBPUBSUB_HUB_NAME used by the application
var hubName = 'santa-tracking'
var webPubSubName = 'santarun-pubsub-${nameSuffix}'

resource webPubSub 'Microsoft.SignalRService/webPubSub@2023-02-01' = {
  name: webPubSubName
  location: location
  tags: tags
  sku: {
    name: sku
    // Free tier has a fixed capacity of 1 unit
    capacity: sku == 'Free_F1' ? 1 : 1
  }
  properties: {
    // Disable local auth to enforce managed identity / access key usage
    disableLocalAuth: false
    // Disable AAD auth for simplicity during development
    disableAadAuth: false
    publicNetworkAccess: 'Enabled'
    tls: {
      clientCertEnabled: false
    }
  }
}

resource webPubSubHub 'Microsoft.SignalRService/webPubSub/hubs@2023-02-01' = {
  parent: webPubSub
  name: hubName
  properties: {
    // Allow anonymous connections — the negotiate endpoint handles auth
    anonymousConnectPolicy: 'allow'
    eventHandlers: []
    eventListeners: []
  }
}

@description('Web PubSub instance name')
output webPubSubName string = webPubSub.name

@description('Web PubSub resource ID')
output webPubSubId string = webPubSub.id

@description('Web PubSub hub name')
output hubName string = hubName

@description('Web PubSub hostname')
output hostname string = webPubSub.properties.hostName

@description('Web PubSub connection string (primary key)')
@secure()
output connectionString string = webPubSub.listKeys().primaryConnectionString
