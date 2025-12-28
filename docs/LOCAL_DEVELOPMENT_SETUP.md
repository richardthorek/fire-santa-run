# Local Development Setup Guide

## Quick Start (Development Mode)

The fastest way to start developing is to use development mode, which bypasses authentication:

### 1. Create .env.local file

```bash
cp .env.example .env.local
```

### 2. Configure for Development

Edit `.env.local` and set:

```bash
# Enable development mode (bypasses authentication)
VITE_DEV_MODE=true

# Add your Mapbox token (required for maps)
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

### 3. Install dependencies and run

```bash
npm install
npm run dev
```

The app will open at `http://localhost:5173` with:
- ✅ No login required
- ✅ Mock brigade and user pre-configured
- ✅ All features accessible
- ✅ Data stored in localStorage

## Testing Production Authentication Locally

If you want to test the full authentication flow with Entra External ID:

### 1. Configure .env.local for Production Mode

```bash
# Disable dev mode to enable authentication
VITE_DEV_MODE=false

# Mapbox token (required)
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Entra External ID Configuration
VITE_ENTRA_CLIENT_ID=8451d08e-33f6-4c8f-9185-428d0aca7b3e
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback

# Optional: Azure Storage (if testing with real backend)
# VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```

### 2. Ensure Entra App Registration is Configured

**CRITICAL**: The Entra app registration must expose an API:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **App registrations** > **Fire Santa Run Web App**
3. Click **Expose an API**
4. Add Application ID URI: `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`
5. Save

Without this, you'll get 401 errors because tokens will have the wrong audience.

### 3. Run the Application

```bash
npm run dev
```

### 4. Run the API Functions Locally (Optional)

If testing with the backend API:

```bash
cd api
cp local.settings.json.example local.settings.json

# Edit local.settings.json and set:
# - VITE_DEV_MODE=false
# - VITE_ENTRA_CLIENT_ID=8451d08e-33f6-4c8f-9185-428d0aca7b3e
# - Other Entra variables

npm install
npm start
```

The API will run at `http://localhost:7071/api`

## Common Issues

### Issue: "No authorization token provided" (401 error)

**Cause**: The app is in production mode but authentication isn't configured.

**Solutions**:

1. **For development**: Set `VITE_DEV_MODE=true` in `.env.local`
2. **For production testing**: 
   - Set all Entra variables in `.env.local`
   - Ensure app registration exposes an API
   - Log in with a valid account

### Issue: "Invalid or expired token" - Audience Mismatch

**Cause**: Token has Microsoft Graph audience instead of app client ID.

**Solution**: Ensure the Entra app registration exposes an API as described above.

### Issue: App won't start without Mapbox token

**Cause**: Mapbox token is required for map functionality.

**Solution**: Get a free token at https://account.mapbox.com/ and add to `.env.local`

### Issue: Changes to .env.local not taking effect

**Solution**: 
1. Stop the dev server
2. Clear browser cache/storage
3. Restart: `npm run dev`

## Environment Variable Reference

### Required for All Modes

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_MAPBOX_TOKEN` | ✅ Yes | Mapbox API token for maps |
| `VITE_DEV_MODE` | ⚠️ Recommended | Set to `true` for dev, `false` for prod |

### Required for Production Mode Only

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ENTRA_CLIENT_ID` | ✅ Yes | App client ID from Azure |
| `VITE_ENTRA_TENANT_ID` | ✅ Yes | Tenant ID: `50fcb752-2a4e-4efd-bdc2-e18a5042c5a8` |
| `VITE_ENTRA_AUTHORITY` | ✅ Yes | Authority URL with tenant ID |
| `VITE_ENTRA_REDIRECT_URI` | ⚠️ Recommended | Redirect URI after login |

### Optional

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_AZURE_STORAGE_CONNECTION_STRING` | ❌ No | For testing with real Azure storage |
| `VITE_MOCK_BRIGADE_ID` | ❌ No | Custom brigade ID in dev mode |
| `VITE_MOCK_BRIGADE_NAME` | ❌ No | Custom brigade name in dev mode |

## Recommended Development Workflow

1. **Start with dev mode** (`VITE_DEV_MODE=true`)
   - Fast iteration
   - No authentication barriers
   - localStorage-backed

2. **Test authentication occasionally**
   - Switch to production mode
   - Verify login/logout flows
   - Test with real tokens

3. **Test with backend API before deploying**
   - Run Functions locally
   - Verify API endpoints work
   - Check token validation

## Next Steps

- Review [MASTER_PLAN.md](../MASTER_PLAN.md) for project architecture
- See [ENTRA_EXTERNAL_ID_SETUP.md](ENTRA_EXTERNAL_ID_SETUP.md) for Entra configuration
- Check [API_AUTHENTICATION.md](API_AUTHENTICATION.md) for API authentication details
- Read [FIX_AUTH_AUDIENCE_MISMATCH.md](FIX_AUTH_AUDIENCE_MISMATCH.md) for troubleshooting auth issues
