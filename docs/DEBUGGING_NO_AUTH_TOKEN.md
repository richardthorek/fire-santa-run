# Debugging Guide: "No authorization token provided" Error

## What This Error Means

When you see `{"error":"Unauthorized","message":"No authorization token provided"}`, it means:
- The frontend is NOT attaching an `Authorization: Bearer <token>` header to the API request
- The `getAccessToken()` function is returning `null`
- The backend correctly rejects the request because there's no token

## Steps to Diagnose on Your Local Machine

### Step 1: Check Browser Console

With the latest changes, the code now logs detailed diagnostic information. Open your browser's DevTools console and try to save a route. Look for messages starting with `[HTTP]`:

#### Scenario A: Dev Mode Active
```
[HTTP] Dev mode enabled. No token required for API calls.
```
**Issue**: You're in dev mode but the backend expects authentication.
**Fix**: Set `VITE_DEV_MODE=false` in your `.env.local` file and restart the dev server.

#### Scenario B: Missing Configuration
```
[HTTP] Production mode detected (VITE_DEV_MODE=false or not set) but VITE_ENTRA_CLIENT_ID is not configured.
```
**Issue**: Production mode is enabled but Entra is not configured.
**Fix**: Add `VITE_ENTRA_CLIENT_ID=8451d08e-33f6-4c8f-9185-428d0aca7b3e` to your `.env.local` file.

#### Scenario C: Not Logged In
```
[HTTP] getAccessToken: No active account found. User may not be logged in.
```
**Issue**: The UI might show you as "logged in" but MSAL doesn't have an active account.
**Possible causes**:
- Session storage was cleared
- Login didn't complete properly
- MSAL configuration issue

**Fix**: 
1. Log out completely
2. Clear browser storage (Application tab > Storage > Clear site data)
3. Log in again
4. Try saving a route

#### Scenario D: Token Acquisition Failed
```
[HTTP] Failed to acquire access token for API request: <error details>
```
**Issue**: MSAL cannot acquire a token silently.
**Common errors**:
- `interaction_required`: Need to log in again interactively
- `consent_required`: User needs to consent to new scopes
- `invalid_grant`: Token expired or revoked

**Fix**: Log out and log in again. If error persists, check the Entra app registration configuration.

### Step 2: Verify Your .env.local Configuration

Your `.env.local` file should have:

```bash
# For production authentication testing
VITE_DEV_MODE=false

# Mapbox token (required)
VITE_MAPBOX_TOKEN=pk.your_token_here

# Entra External ID Configuration
VITE_ENTRA_CLIENT_ID=8451d08e-33f6-4c8f-9185-428d0aca7b3e
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://brigadesantarun.ciamlogin.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8/
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Important notes:**
- The authority URL uses `brigadesantarun.ciamlogin.com` (CIAM endpoint), not `login.microsoftonline.com`
- Make sure the redirect URI matches exactly (including trailing slash behavior)

### Step 3: Verify You're Actually Logged In

Check the MSAL state:

1. Open browser console
2. Type: `window.__msalInstance.getActiveAccount()`
3. Expected result: An account object with `homeAccountId`, `username`, etc.
4. If null: You're not logged in from MSAL's perspective

### Step 4: Check the Entra App Registration

The app registration MUST expose an API:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **App registrations** > **Fire Santa Run Web App**
3. Click **Expose an API**
4. Verify **Application ID URI** is set to: `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`
5. If not set, click **+ Add** and save it

Without this, MSAL will return Graph-audience tokens that the backend rejects.

### Step 5: Try the Token Acquisition Manually

In the browser console, try acquiring a token manually:

```javascript
const msalInstance = window.__msalInstance;
const account = msalInstance.getActiveAccount();

if (!account) {
  console.log('No active account - not logged in');
} else {
  console.log('Active account:', account.username);
  
  msalInstance.acquireTokenSilent({
    scopes: ['api://8451d08e-33f6-4c8f-9185-428d0aca7b3e/.default'],
    account: account
  }).then(response => {
    console.log('Token acquired!');
    console.log('Access Token:', response.accessToken.substring(0, 50) + '...');
    // Decode the token at https://jwt.io to check the audience claim
  }).catch(error => {
    console.error('Token acquisition failed:', error);
  });
}
```

### Step 6: Check Network Tab

Open DevTools Network tab:
1. Try to save a route
2. Find the POST request to `/api/routes`
3. Click on it and go to the **Headers** tab
4. Look for `Authorization: Bearer ...` in the Request Headers section

**If Authorization header is missing:**
- The `getAccessToken()` function returned `null`
- Check browser console for the reason (see Step 1)

**If Authorization header is present:**
- The backend is receiving the token
- The issue is either:
  - Wrong audience in the token (decode at jwt.io)
  - Backend validation issue

## Quick Fixes

### Option 1: Use Dev Mode (Bypass Authentication)
```bash
# In .env.local
VITE_DEV_MODE=true
```
Restart dev server and try again. This bypasses all authentication.

### Option 2: Clear Everything and Start Fresh
```bash
# 1. Stop the dev server
# 2. Clear browser data (DevTools > Application > Clear site data)
# 3. Delete node_modules and reinstall
rm -rf node_modules
npm install

# 4. Restart dev server
npm run dev

# 5. Log in again from scratch
```

### Option 3: Check MSAL Logs
Enable MSAL trace logging by adding to your `.env.local`:
```bash
VITE_MSAL_TRACE_LOGGING=true
```
Restart and check console for detailed MSAL logs.

## Still Stuck?

If none of the above helps, please provide:

1. **Console logs** when trying to save a route (especially `[HTTP]` messages)
2. **Your .env.local** configuration (redact Mapbox token)
3. **Result of** `window.__msalInstance.getActiveAccount()` in browser console
4. **Network tab** screenshot showing the `/api/routes` request headers
5. **Any MSAL errors** in the console

This information will help identify exactly where the token acquisition is failing.
