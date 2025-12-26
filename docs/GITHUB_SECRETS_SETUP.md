# GitHub Secrets Setup for CI/CD

This guide explains how to add the required GitHub secrets for the Azure Static Web Apps CI/CD workflow to work properly.

## ⚠️ Critical: Required Secret

The Azure Static Web Apps CI/CD workflow **requires** the `VITE_MAPBOX_TOKEN` secret to build successfully. Without it, the build will fail.

## Quick Setup (2 minutes)

### Step 1: Get Your Mapbox Token

1. Sign up or log in at [Mapbox](https://account.mapbox.com/)
2. Go to [Access Tokens](https://account.mapbox.com/access-tokens/)
3. Click **"Create a token"**
4. Configure the token:
   - **Name:** `Fire Santa Run Production`
   - **Scopes:** Enable `styles:read`, `fonts:read`, `geocoding:read`, `directions:read`
   - **URL restrictions (recommended):**
     - Add your Azure Static Web Apps URL: `https://*.azurestaticapps.net/*`
     - Add your custom domain (if any): `https://yourdomain.com/*`
5. Click **"Create token"**
6. Copy the token (starts with `pk.`)

### Step 2: Add Secret to GitHub Environment

This repository uses a GitHub environment called "copilot" for deployment secrets.

1. Go to your repository on GitHub
2. Click the **"Settings"** tab
3. In the left sidebar, navigate to **"Environments"**
4. Click on the **"copilot"** environment (if it doesn't exist, you may need to create it first)
5. Scroll down to **"Environment secrets"** section
6. Click **"Add secret"**
7. Add the secret:
   - **Name:** `VITE_MAPBOX_TOKEN` (case-sensitive, must be exact)
   - **Value:** Paste your Mapbox token (the one that starts with `pk.`)
8. Click **"Add secret"**

**Note:** If the "copilot" environment doesn't exist, you can create it by:
- Settings → Environments → New environment → Name it "copilot" → Configure environment

### Step 3: Verify

1. Go to the **"Actions"** tab in your repository
2. Find the latest "Azure Static Web Apps CI/CD" workflow run
3. Click **"Re-run all jobs"** (if it failed previously)
4. The workflow should now complete successfully! ✅

## How It Works

The workflow uses the `VITE_MAPBOX_TOKEN` secret during the build process:

```yaml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  env:
    VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
```

Vite bundles this token into the application at build time, allowing the maps to work in production.

## Optional: Production Secrets

For full production functionality, you can also add these optional secrets:

### Azure Storage (for persistent data)
```
Name: VITE_AZURE_STORAGE_CONNECTION_STRING
Value: DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...
```

### Azure Web PubSub (for real-time tracking)
```
Name: AZURE_WEBPUBSUB_CONNECTION_STRING
Value: Endpoint=https://...webpubsub.azure.com;AccessKey=...;Version=1.0;
```

These are not required for the initial deployment but enable advanced features.

## Troubleshooting

### Build still failing after adding secret?

1. **Check the secret name:** Must be exactly `VITE_MAPBOX_TOKEN` (case-sensitive)
2. **Check the secret value:** Should start with `pk.` (public token)
3. **Re-run the workflow:** Secrets are only available to new workflow runs
4. **Check workflow logs:** Go to Actions → Click the failed run → Check "Build And Deploy" step

### Need to update the token?

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click on `VITE_MAPBOX_TOKEN`
3. Click **"Update secret"**
4. Paste the new token value
5. Save and re-run the workflow

### Token not working in production?

1. **Check URL restrictions:** If you set URL restrictions on your Mapbox token, ensure your Azure Static Web Apps URL is included
2. **Check token scopes:** Ensure `styles:read`, `fonts:read`, `geocoding:read`, and `directions:read` are enabled
3. **Check token status:** Verify the token hasn't expired or been revoked in Mapbox dashboard

## Security Notes

- ✅ **DO:** Store Mapbox tokens as GitHub secrets
- ✅ **DO:** Use URL restrictions on production tokens
- ✅ **DO:** Use separate tokens for development and production
- ❌ **DON'T:** Commit tokens to the repository
- ❌ **DON'T:** Share tokens in issue comments or pull requests
- ❌ **DON'T:** Use secret tokens (starting with `sk.`) - only public tokens

## Related Documentation

- [Secrets Management Guide](./SECRETS_MANAGEMENT.md) - Complete secrets documentation
- [Azure Setup Guide](./AZURE_SETUP.md) - Azure Storage and Web PubSub setup
- [Development Mode Guide](./DEV_MODE.md) - Local development without secrets

## Need Help?

If you're still having issues:

1. Check the workflow logs (Actions tab in your repository) for detailed error messages
2. Review the [Secrets Management Guide](./SECRETS_MANAGEMENT.md)
3. Open an issue in the repository with the error details
