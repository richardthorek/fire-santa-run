#!/bin/bash

# Fire Santa Run - Azure Storage Setup Script
# This script automates the creation of Azure Table Storage resources

set -e

echo "======================================"
echo "Fire Santa Run - Azure Storage Setup"
echo "======================================"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed."
    echo "Please install it from: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    echo "📝 Please login to Azure..."
    az login
fi

echo "✓ Azure CLI authenticated"
echo ""

# Get current subscription
SUBSCRIPTION=$(az account show --query name --output tsv)
echo "Using subscription: $SUBSCRIPTION"
echo ""

# Prompt for configuration
read -p "Enter resource group name [rg-santa-run]: " RESOURCE_GROUP
RESOURCE_GROUP=${RESOURCE_GROUP:-rg-santa-run}

read -p "Enter storage account name (3-24 chars, lowercase/numbers only) [santarun$(date +%s | tail -c 7)]: " STORAGE_ACCOUNT
STORAGE_ACCOUNT=${STORAGE_ACCOUNT:-santarun$(date +%s | tail -c 7)}

echo ""
echo "Select Azure region:"
echo "1) Australia East (Sydney)"
echo "2) Australia Southeast (Melbourne)"
echo "3) Southeast Asia (Singapore)"
echo "4) West US 2"
read -p "Enter choice [1]: " REGION_CHOICE
REGION_CHOICE=${REGION_CHOICE:-1}

case $REGION_CHOICE in
    1) LOCATION="australiaeast";;
    2) LOCATION="australiasoutheast";;
    3) LOCATION="southeastasia";;
    4) LOCATION="westus2";;
    *) LOCATION="australiaeast";;
esac

echo ""
echo "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Region: $LOCATION"
echo ""
read -p "Proceed with setup? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting Azure setup..."
echo ""

# Create resource group
echo "📦 Creating resource group..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --output none

echo "✓ Resource group created"

# Create storage account
echo "💾 Creating storage account..."
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false \
  --output none

echo "✓ Storage account created"

# Get connection string
echo "🔑 Retrieving connection string..."
CONNECTION_STRING=$(az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  --output tsv)

echo "✓ Connection string retrieved"

# Create tables
echo "📋 Creating tables..."
TABLES=("brigades" "routes" "waypoints" "trackingsessions")

for table in "${TABLES[@]}"; do
    echo "  Creating table: $table"
    az storage table create \
      --name "$table" \
      --connection-string "$CONNECTION_STRING" \
      --output none
done

echo "✓ All tables created"

# Configure CORS
echo "🌐 Configuring CORS..."
az storage cors add \
  --services t \
  --methods GET POST PUT DELETE OPTIONS \
  --origins "*" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name "$STORAGE_ACCOUNT" \
  --connection-string "$CONNECTION_STRING" \
  --output none

echo "✓ CORS configured"

# Get account key
ACCOUNT_KEY=$(az storage account keys list \
  --account-name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].value" \
  --output tsv)

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Azure Resources Created:"
echo "  • Resource Group: $RESOURCE_GROUP"
echo "  • Storage Account: $STORAGE_ACCOUNT"
echo "  • Region: $LOCATION"
echo "  • Tables: brigades, routes, waypoints, trackingsessions"
echo ""
echo "======================================"
echo "📝 IMPORTANT - Save These Credentials:"
echo "======================================"
echo ""
echo "Connection String:"
echo "$CONNECTION_STRING"
echo ""
echo "Storage Account Name:"
echo "$STORAGE_ACCOUNT"
echo ""
echo "Storage Account Key:"
echo "$ACCOUNT_KEY"
echo ""
echo "======================================"
echo "Next Steps:"
echo "======================================"
echo ""
echo "1. Local Development:"
echo "   Create .env.local file with:"
echo "   VITE_AZURE_STORAGE_CONNECTION_STRING=\"$CONNECTION_STRING\""
echo ""
echo "2. GitHub Secrets:"
echo "   Go to: Repository Settings > Secrets > Actions"
echo "   Add secret: AZURE_STORAGE_CONNECTION_STRING"
echo "   Value: <connection string above>"
echo ""
echo "3. Vercel/Netlify:"
echo "   Add environment variable:"
echo "   VITE_AZURE_STORAGE_CONNECTION_STRING"
echo "   Value: <connection string above>"
echo ""
echo "4. Test connection:"
echo "   npm install @azure/data-tables"
echo "   npm run test:storage"
echo ""
echo "💰 Cost Estimate: ~$0.05 AUD/month for typical usage"
echo ""
echo "📚 Documentation: docs/AZURE_SETUP.md"
echo "🔒 Security: Rotate keys every 90 days"
echo ""
