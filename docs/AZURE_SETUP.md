# Azure Storage Setup Guide

This guide provides step-by-step instructions for setting up Azure Table Storage for the Fire Santa Run application.

## Prerequisites

- Azure account ([Create free account](https://azure.microsoft.com/free/))
- Azure CLI installed ([Installation guide](https://docs.microsoft.com/cli/azure/install-azure-cli))
- Bash shell (macOS/Linux/WSL)

## Quick Setup (5 minutes)

### Step 1: Login to Azure

```bash
az login
```

This will open a browser window for authentication.

### Step 2: Run Setup Script

```bash
cd scripts
chmod +x setup-azure-storage.sh
./setup-azure-storage.sh
```

The script will:
1. Prompt for resource names
2. Create a resource group
3. Create a storage account
4. Create required tables
5. Configure CORS
6. Output connection strings

### Step 3: Save Credentials

Copy the output connection string and add it to:

**Local Development:**
1. Create `.env.local` file in project root
2. Add: `VITE_AZURE_STORAGE_CONNECTION_STRING=<your_connection_string>`

**GitHub Secrets:**
1. Go to Repository Settings > Secrets and variables > Actions
2. Add new secret: `AZURE_STORAGE_CONNECTION_STRING`
3. Paste the connection string

**Vercel/Netlify:**
1. Go to project settings > Environment Variables
2. Add: `VITE_AZURE_STORAGE_CONNECTION_STRING`
3. Set for Production, Preview, and Development

## Manual Setup (Detailed)

### Step 1: Choose Region

Select the Azure region closest to your users:
- **Australia East** (Sydney) - Best for NSW
- **Australia Southeast** (Melbourne) - Best for VIC
- **Southeast Asia** (Singapore) - Backup option

```bash
# Set your preferred region
LOCATION="australiaeast"
```

### Step 2: Create Resource Group

```bash
# Choose a unique resource group name
RESOURCE_GROUP="rg-santa-run"

# Create the resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

### Step 3: Create Storage Account

```bash
# Choose a globally unique storage account name (3-24 chars, lowercase/numbers only)
STORAGE_ACCOUNT="santarun$(date +%s)"

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --https-only true \
  --min-tls-version TLS1_2
```

### Step 4: Get Connection String

```bash
# Get and save connection string
CONNECTION_STRING=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv)

echo "Connection String: $CONNECTION_STRING"
```

**IMPORTANT:** Save this connection string securely!

### Step 5: Create Tables

```bash
# Create brigades table
az storage table create \
  --name brigades \
  --connection-string "$CONNECTION_STRING"

# Create routes table
az storage table create \
  --name routes \
  --connection-string "$CONNECTION_STRING"

# Create waypoints table
az storage table create \
  --name waypoints \
  --connection-string "$CONNECTION_STRING"

# Create tracking sessions table
az storage table create \
  --name trackingsessions \
  --connection-string "$CONNECTION_STRING"
```

### Step 6: Configure CORS

```bash
# Allow web app to access storage
az storage cors add \
  --services t \
  --methods GET POST PUT DELETE OPTIONS \
  --origins "*" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name $STORAGE_ACCOUNT \
  --connection-string "$CONNECTION_STRING"
```

**Production Note:** Replace `"*"` in `--origins` with your actual domain:
```bash
--origins "https://your-domain.com" \
```

### Step 7: Configure Firewall (Optional, for extra security)

```bash
# Allow access only from your IP
MY_IP=$(curl -s https://api.ipify.org)

az storage account network-rule add \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --ip-address $MY_IP
```

## Verification

### Test Connection

Create a test file `test-connection.ts`:

```typescript
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING!;
const tableClient = TableClient.fromConnectionString(connectionString, "brigades");

async function test() {
  try {
    // Try to create a test entity
    const testEntity = {
      partitionKey: "test",
      rowKey: "test",
      name: "Test Brigade"
    };
    
    await tableClient.createEntity(testEntity);
    console.log("✓ Connection successful!");
    
    // Clean up
    await tableClient.deleteEntity("test", "test");
  } catch (error) {
    console.error("✗ Connection failed:", error);
  }
}

test();
```

Run test:
```bash
npm install @azure/data-tables
VITE_AZURE_STORAGE_CONNECTION_STRING="<your_connection_string>" tsx test-connection.ts
```

## Cost Estimation

### Free Tier Limits
- First 5GB storage: Free
- First 20,000 transactions: Free per month

### Expected Usage (10 brigades)
- Storage: < 10 MB
- Monthly transactions: ~100,000
- **Estimated cost: $0.05 AUD/month**

### At Scale (100 brigades)
- Storage: ~100 MB
- Monthly transactions: ~1,000,000
- **Estimated cost: $0.50 AUD/month**

## Security Best Practices

### 1. Rotate Access Keys

```bash
# Regenerate primary key
az storage account keys renew \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --key primary

# Get new connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv
```

### 2. Use Managed Identity (Advanced)

For Azure-hosted apps, use Managed Identity instead of connection strings:

```bash
# Enable system-assigned identity on your App Service
az webapp identity assign \
  --name <your-app-name> \
  --resource-group $RESOURCE_GROUP

# Grant access to storage
PRINCIPAL_ID=$(az webapp identity show \
  --name <your-app-name> \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

az role assignment create \
  --role "Storage Table Data Contributor" \
  --assignee $PRINCIPAL_ID \
  --scope "/subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"
```

### 3. Enable Azure Storage Logging

```bash
az monitor diagnostic-settings create \
  --name storage-logs \
  --resource-id "/subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT" \
  --logs '[{"category": "StorageRead", "enabled": true}, {"category": "StorageWrite", "enabled": true}]' \
  --workspace <log-analytics-workspace-id>
```

## Troubleshooting

### Issue: CORS Error

**Symptom:** Browser console shows CORS policy errors

**Solution:**
1. Verify CORS is configured:
   ```bash
   az storage cors list \
     --services t \
     --account-name $STORAGE_ACCOUNT \
     --connection-string "$CONNECTION_STRING"
   ```
2. Update CORS with your domain
3. Clear browser cache

### Issue: Authentication Failed

**Symptom:** 403 Forbidden or authentication errors

**Solution:**
1. Verify connection string is correct
2. Check if storage account firewall is blocking requests
3. Ensure tables exist
4. Verify access key hasn't expired

### Issue: Table Not Found

**Symptom:** ResourceNotFound error

**Solution:**
```bash
# List all tables
az storage table list \
  --connection-string "$CONNECTION_STRING" \
  --output table

# Create missing table
az storage table create \
  --name <table-name> \
  --connection-string "$CONNECTION_STRING"
```

## Monitoring & Maintenance

### View Storage Metrics

```bash
# Get storage account metrics
az monitor metrics list \
  --resource "/subscriptions/<subscription-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT" \
  --metric "Transactions" \
  --interval PT1H
```

### Backup Strategy

Azure Table Storage has built-in redundancy, but for additional backup:

```bash
# Export table data
az storage entity query \
  --table-name brigades \
  --connection-string "$CONNECTION_STRING" > brigades-backup.json
```

### Clean Up (Delete Everything)

```bash
# WARNING: This deletes all data!
az group delete \
  --name $RESOURCE_GROUP \
  --yes \
  --no-wait
```

## Next Steps

1. ✅ Azure Storage configured
2. Add connection string to `.env.local`
3. Add secrets to GitHub repository
4. Implement storage adapters in code
5. Test CRUD operations
6. Deploy to production

## Support Resources

- [Azure Table Storage Documentation](https://docs.microsoft.com/azure/storage/tables/)
- [Azure Storage Pricing](https://azure.microsoft.com/pricing/details/storage/tables/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/storage)
- [Troubleshooting Guide](https://docs.microsoft.com/azure/storage/common/storage-monitoring-diagnosing-troubleshooting)
