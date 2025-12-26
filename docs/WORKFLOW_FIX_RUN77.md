# Azure Static Web Apps CI/CD Fix Summary

## Issue
GitHub workflow run #77 failed during the "Build And Deploy" step with Azure Static Web Apps CI/CD.

## Root Cause (Updated)

**Initial Diagnosis:** The Vite build process requires the `VITE_MAPBOX_TOKEN` environment variable, but it was not configured in the workflow's env section.

**Corrected Diagnosis:** The workflow was correctly configured to pass environment variables, BUT the secrets are stored in a GitHub **environment** called "copilot", not as repository secrets. The workflow job was not configured to use this environment, so it couldn't access the secrets.

The application code uses `import.meta.env.VITE_MAPBOX_TOKEN` in multiple components (`MapView.tsx`, `NavigationMap.tsx`, `TrackingView.tsx`, etc.), and Vite embeds these values at build time.

## Solution Implemented

### 1. Updated Workflow Configuration
**File:** `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`

**Initial fix:** Added environment variables to the "Build And Deploy" step:
```yaml
- name: Build And Deploy
  id: builddeploy
  uses: Azure/static-web-apps-deploy@v1
  env:
    VITE_DEV_MODE: 'false'
    VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
    VITE_APP_NAME: 'Fire Santa Run'
```

**Corrected fix:** Added `environment: copilot` to the job configuration:
```yaml
jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    environment: copilot  # ← This tells the workflow to use secrets from the "copilot" environment
```

This allows the workflow to access the environment secrets that are already configured in the "copilot" environment.

### 2. Enhanced Documentation
- **Updated:** `docs/SECRETS_MANAGEMENT.md` - Updated Azure Static Web Apps section to reference environment secrets
- **Updated:** `docs/GITHUB_SECRETS_SETUP.md` - Corrected instructions to add secrets to the "copilot" environment

### 3. Why This Works
Azure Static Web Apps deployment action internally runs `npm run build`, which executes:
1. `tsc -b` (TypeScript compilation)
2. `vite build` (Vite bundling)

During the Vite build, environment variables prefixed with `VITE_` are embedded into the JavaScript bundle. By adding the `env` section to the workflow step, these variables become available to the build process, allowing it to complete successfully.

## Action Required by Repository Owner (Updated)

**Good news!** The secrets are already configured in the "copilot" environment. The workflow has now been updated to use this environment.

**No action required** - the fix should work immediately. Just re-run the failed workflow:

1. **Re-run Workflow:**
   - Go to **Actions** tab
   - Find the failed workflow run #77
   - Click **"Re-run all jobs"**
   - Workflow should now succeed ✅

**Note:** The secrets listed below are already present in the "copilot" environment:
- ✅ `VITE_MAPBOX_TOKEN`
- ✅ `VITE_APP_NAME`
- ✅ `VITE_AZURE_STORAGE_CONNECTION_STRING`
- ✅ `VITE_AZURE_STORAGE_ACCOUNT_NAME`
- ✅ `AZURE_WEBPUBSUB_CONNECTION_STRING`
- ✅ `AZURE_WEBPUBSUB_HUB_NAME`

## Expected Outcome

After re-running the workflow:
- ✅ Build step completes successfully
- ✅ Application bundle includes Mapbox token
- ✅ Maps render correctly in production
- ✅ Geocoding and directions work properly
- ✅ Deployment to Azure Static Web Apps succeeds

## Files Changed

1. `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml` - Added env variables and documentation
2. `docs/SECRETS_MANAGEMENT.md` - Added Azure Static Web Apps section
3. `docs/GITHUB_SECRETS_SETUP.md` - New step-by-step setup guide

## Testing Performed

- ✅ Local build succeeds without changes to existing functionality
- ✅ TypeScript compilation passes
- ✅ No linting errors introduced
- ✅ CodeQL security scan passed (0 alerts)
- ✅ Documentation is clear and actionable

## Additional Notes

### Security Considerations
- Using GitHub secrets ensures the Mapbox token is not exposed in code or logs
- The token is a **public** token (starts with `pk.`) which is safe to use in client-side applications
- Recommended to add URL restrictions to the Mapbox token in production

### Development vs Production
- Local development: Uses `.env.local` file with `VITE_DEV_MODE=true`
- Production deployment: Uses GitHub secrets with `VITE_DEV_MODE=false`
- This approach allows developers to work locally without needing production secrets

### Future Considerations
Additional optional secrets for full production functionality:
- `VITE_AZURE_STORAGE_CONNECTION_STRING` - For persistent data storage
- `AZURE_WEBPUBSUB_CONNECTION_STRING` - For real-time tracking features

These can be added later as the deployment matures.

## References
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Azure Static Web Apps Deploy Action](https://github.com/Azure/static-web-apps-deploy)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Mapbox Access Tokens](https://docs.mapbox.com/help/getting-started/access-tokens/)

---

**Status:** ✅ Fix implemented and ready for repository owner to add the required secret.
