# Production Deployment Guide with Authentication

## Overview

This guide covers deploying the Fire Santa Run application to production with Microsoft Entra External ID authentication enabled.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Authentication Setup](#authentication-setup)
3. [Azure Services Configuration](#azure-services-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment Steps](#deployment-steps)
6. [CORS Configuration](#cors-configuration)
7. [Staging Environment](#staging-environment)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Azure Resources

- ✅ Azure subscription
- ✅ Azure Static Web Apps instance
- ✅ Azure Storage Account (Table Storage)
- ✅ Azure Web PubSub instance (for real-time tracking)
- ✅ Microsoft Entra External ID tenant

### Required Tools

- ✅ Azure CLI installed
- ✅ Node.js 22+ installed
- ✅ Git installed
- ✅ GitHub account (for deployment)

### Required Access

- ✅ Azure subscription contributor access
- ✅ Entra External ID admin access
- ✅ GitHub repository admin access

---

## Authentication Setup

### Step 1: Entra External ID App Registration

Follow the complete setup guide: [ENTRA_EXTERNAL_ID_SETUP.md](./ENTRA_EXTERNAL_ID_SETUP.md)

**Key Configuration Values:**

```bash
Tenant ID: 50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
Authority: https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
Client ID: [from app registration]
```

### Step 2: Configure Redirect URIs

Add production redirect URIs to app registration:

```
Production:
https://your-app.azurestaticapps.net/auth/callback
https://your-app.azurestaticapps.net

Custom Domain (if applicable):
https://yourdomain.com/auth/callback
https://yourdomain.com
```

### Step 3: User Flow Configuration

Create sign-up/sign-in user flow:

1. **Name**: `B2C_1_signup_signin`
2. **Identity provider**: Email one-time password
3. **User attributes**: email, given_name, family_name
4. **Application claims**: email, name, User.Read

---

## Azure Services Configuration

### Azure Storage Account

**Create storage account:**

```bash
# Variables
RESOURCE_GROUP="rg-santa-run-prod"
STORAGE_ACCOUNT="santarunprod$(date +%s)"
LOCATION="australiaeast"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

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

**Create tables:**

```bash
# Get connection string
CONNECTION_STRING=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv)

# Create tables
az storage table create --name routes --connection-string "$CONNECTION_STRING"
az storage table create --name brigades --connection-string "$CONNECTION_STRING"
az storage table create --name users --connection-string "$CONNECTION_STRING"
az storage table create --name memberships --connection-string "$CONNECTION_STRING"
az storage table create --name invitations --connection-string "$CONNECTION_STRING"
az storage table create --name verificationrequests --connection-string "$CONNECTION_STRING"
```

### Azure Web PubSub

**Create Web PubSub service:**

```bash
PUBSUB_NAME="santarun-pubsub-prod"

# Create Web PubSub
az webpubsub create \
  --name $PUBSUB_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Free_F1

# Get connection string
PUBSUB_CONNECTION=$(az webpubsub key show \
  --name $PUBSUB_NAME \
  --resource-group $RESOURCE_GROUP \
  --query primaryConnectionString -o tsv)
```

### Azure Static Web Apps

**Create Static Web App:**

```bash
STATIC_APP_NAME="santa-run-prod"

# Create via Azure Portal or CLI
az staticwebapp create \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/your-org/fire-santa-run \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist"
```

---

## Environment Variables

### Production Environment Variables

Configure these in Azure Static Web Apps:

**Navigate to:** Azure Portal > Static Web App > Configuration > Application settings

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `VITE_DEV_MODE` | `false` | **CRITICAL**: Disable dev mode |
| `VITE_ENTRA_CLIENT_ID` | `[your-client-id]` | From app registration |
| `VITE_ENTRA_TENANT_ID` | `50fcb752-2a4e-4efd-bdc2-e18a5042c5a8` | Entra tenant ID |
| `VITE_ENTRA_AUTHORITY` | `https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8` | Authority URL |
| `VITE_ENTRA_REDIRECT_URI` | `https://your-app.azurestaticapps.net/auth/callback` | Callback URL |
| `VITE_AZURE_STORAGE_CONNECTION_STRING` | `[connection-string]` | Storage connection |
| `VITE_AZURE_STORAGE_ACCOUNT_NAME` | `[account-name]` | Storage account |
| `AZURE_WEBPUBSUB_CONNECTION_STRING` | `[connection-string]` | Web PubSub connection |
| `AZURE_WEBPUBSUB_HUB_NAME` | `santarun` | Hub name |
| `VITE_MAPBOX_TOKEN` | `[your-token]` | Mapbox token |
| `VITE_APP_NAME` | `Fire Santa Run` | App name |
| `VITE_APP_URL` | `https://your-app.azurestaticapps.net` | App URL |

### Setting Variables via Azure CLI

```bash
# Set application settings
az staticwebapp appsettings set \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --setting-names \
    VITE_DEV_MODE=false \
    VITE_ENTRA_CLIENT_ID="your-client-id" \
    VITE_ENTRA_TENANT_ID="50fcb752-2a4e-4efd-bdc2-e18a5042c5a8" \
    VITE_ENTRA_AUTHORITY="https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8" \
    VITE_ENTRA_REDIRECT_URI="https://your-app.azurestaticapps.net/auth/callback" \
    VITE_AZURE_STORAGE_CONNECTION_STRING="$CONNECTION_STRING" \
    AZURE_WEBPUBSUB_CONNECTION_STRING="$PUBSUB_CONNECTION" \
    VITE_MAPBOX_TOKEN="your-mapbox-token"
```

### Critical Security Checks

⚠️ **NEVER commit these to source control:**
- Connection strings
- Client secrets
- API keys
- Access tokens

✅ **DO:**
- Store in Azure Static Web App configuration
- Use Azure Key Vault for sensitive secrets
- Rotate credentials regularly
- Use different credentials for dev/staging/prod

---

## Deployment Steps

### Step 1: Prepare Repository

```bash
# Ensure repository is up to date
git checkout main
git pull origin main

# Build locally to verify
npm install
npm run build

# Test production mode locally
VITE_DEV_MODE=false npm run preview
```

### Step 2: Configure GitHub Actions

**Workflow file:** `.github/workflows/azure-static-web-apps.yml`

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
      
      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: "api"
          output_location: "dist"
        env:
          VITE_DEV_MODE: false
```

### Step 3: Deploy

```bash
# Push to main branch to trigger deployment
git push origin main

# Monitor deployment
# Visit: https://github.com/your-org/fire-santa-run/actions
```

### Step 4: Configure Custom Domain (Optional)

```bash
# Add custom domain
az staticwebapp hostname set \
  --name $STATIC_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname "yourdomain.com"

# Add DNS records as instructed
# TXT record for verification
# CNAME record pointing to *.azurestaticapps.net
```

---

## CORS Configuration

### Azure Storage CORS

Configure CORS for table storage:

```bash
az storage cors add \
  --services t \
  --methods GET POST PUT DELETE OPTIONS \
  --origins "https://your-app.azurestaticapps.net" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name $STORAGE_ACCOUNT
```

### Azure Functions CORS

**Edit:** `api/host.json`

```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "routePrefix": "api",
      "cors": {
        "allowedOrigins": [
          "https://your-app.azurestaticapps.net",
          "https://yourdomain.com"
        ],
        "supportCredentials": true
      }
    }
  }
}
```

### Entra External ID CORS

Entra handles CORS automatically for redirect URIs configured in app registration.

---

## Staging Environment

### Create Staging Environment

```bash
# Create staging resource group
STAGING_RG="rg-santa-run-staging"
az group create --name $STAGING_RG --location $LOCATION

# Create staging storage
STAGING_STORAGE="santarunstaging$(date +%s)"
az storage account create \
  --name $STAGING_STORAGE \
  --resource-group $STAGING_RG \
  --location $LOCATION \
  --sku Standard_LRS

# Create staging Static Web App
STAGING_APP="santa-run-staging"
az staticwebapp create \
  --name $STAGING_APP \
  --resource-group $STAGING_RG \
  --location $LOCATION \
  --source https://github.com/your-org/fire-santa-run \
  --branch staging
```

### Staging Environment Variables

```bash
# Set staging variables (same as production but different values)
az staticwebapp appsettings set \
  --name $STAGING_APP \
  --resource-group $STAGING_RG \
  --setting-names \
    VITE_DEV_MODE=false \
    VITE_ENTRA_CLIENT_ID="staging-client-id" \
    VITE_ENTRA_REDIRECT_URI="https://staging-app.azurestaticapps.net/auth/callback"
```

### Staging Workflow

1. **Develop** on feature branches
2. **Merge** to `staging` branch
3. **Test** in staging environment
4. **Merge** to `main` branch
5. **Deploy** to production

---

## Verification

### Post-Deployment Checklist

#### Authentication Verification

- [ ] Navigate to app URL
- [ ] Click "Login"
- [ ] Redirects to Entra External ID
- [ ] Can sign in with email OTP
- [ ] Redirects back to app after login
- [ ] User profile created successfully
- [ ] Can access protected routes
- [ ] Can logout successfully

#### API Verification

- [ ] Create brigade (if first time)
- [ ] Invite member
- [ ] Accept invitation
- [ ] Approve member (admin)
- [ ] Create route
- [ ] Update route
- [ ] Delete route
- [ ] Start navigation
- [ ] Real-time tracking works

#### Security Verification

- [ ] Unauthenticated users redirected to login
- [ ] Cannot access API without token
- [ ] Role permissions enforced
- [ ] .gov.au requirement for admins
- [ ] Domain whitelist working
- [ ] CORS properly configured

### Testing Commands

```bash
# Test authentication endpoint
curl -X GET https://your-app.azurestaticapps.net/api/routes \
  -H "Authorization: Bearer [token]"

# Should return 401 without token
curl -X GET https://your-app.azurestaticapps.net/api/routes

# Test CORS
curl -X OPTIONS https://your-app.azurestaticapps.net/api/routes \
  -H "Origin: https://your-app.azurestaticapps.net" \
  -H "Access-Control-Request-Method: POST"
```

---

## Troubleshooting

### Authentication Issues

**Problem:** Redirect loop after login  
**Solution:**
- Verify redirect URI in app registration matches exactly
- Check VITE_ENTRA_REDIRECT_URI environment variable
- Clear browser cookies and cache

**Problem:** "CORS error" during login  
**Solution:**
- Add all redirect URIs to app registration
- Verify CORS configured in Azure Functions
- Check browser console for specific CORS error

**Problem:** "Invalid client" error  
**Solution:**
- Verify VITE_ENTRA_CLIENT_ID matches app registration
- Check VITE_ENTRA_TENANT_ID is correct
- Ensure app registration is in correct tenant

### API Authorization Issues

**Problem:** 401 Unauthorized on all API calls  
**Solution:**
- Verify VITE_DEV_MODE=false
- Check token is being sent in Authorization header
- Validate token hasn't expired
- Check VITE_ENTRA_CLIENT_ID configuration

**Problem:** 403 Forbidden on API calls  
**Solution:**
- Verify user is member of brigade
- Check user's membership status is "active"
- Verify user's role has required permission
- Check brigade membership was approved

### Deployment Issues

**Problem:** Build fails in GitHub Actions  
**Solution:**
- Check environment variables are set
- Verify all dependencies installed
- Review build logs for errors
- Test build locally first

**Problem:** App deployed but shows blank page  
**Solution:**
- Check browser console for errors
- Verify all environment variables set
- Check static web app configuration
- Review deployment logs

### Database Issues

**Problem:** "Table not found" errors  
**Solution:**
- Verify all tables created in storage account
- Check connection string is correct
- Ensure storage account is accessible
- Verify CORS configuration

**Problem:** "Connection string not configured"  
**Solution:**
- Set VITE_AZURE_STORAGE_CONNECTION_STRING
- Verify connection string format
- Check storage account exists
- Validate access keys

---

## Monitoring & Maintenance

### Application Insights

Configure Application Insights for monitoring:

```bash
# Create Application Insights
APPINSIGHTS_NAME="santa-run-insights"

az monitor app-insights component create \
  --app $APPINSIGHTS_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APPINSIGHTS_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)
```

Add to environment variables:
```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=[connection-string]
```

### Regular Maintenance Tasks

**Weekly:**
- [ ] Review Application Insights for errors
- [ ] Check authentication success rate
- [ ] Monitor API response times
- [ ] Review failed login attempts

**Monthly:**
- [ ] Rotate storage account keys
- [ ] Review and remove inactive users
- [ ] Update dependencies (`npm audit`)
- [ ] Backup brigade data

**Quarterly:**
- [ ] Review and update documentation
- [ ] Audit user permissions
- [ ] Performance optimization review
- [ ] Security audit

---

## Support

### Getting Help

- **Documentation**: Check [docs/](.) directory
- **Issues**: GitHub Issues
- **Email**: support@firesantarun.com.au

### Additional Resources

- [API Authentication](./API_AUTHENTICATION.md)
- [Admin User Guide](./ADMIN_USER_GUIDE.md)
- [Entra External ID Setup](./ENTRA_EXTERNAL_ID_SETUP.md)
- [Azure Storage Setup](./AZURE_SETUP.md)
- [Master Plan](../MASTER_PLAN.md)
