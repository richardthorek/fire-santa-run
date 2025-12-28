# Fix: Authentication Token Audience Mismatch

## Problem Summary

When attempting to save a route as a signed-in user with brigade membership, the API was returning 401 Unauthorized errors. Investigation revealed that:

- **Frontend behavior:** MSAL was requesting tokens with default scopes (`openid`, `profile`, `email`, `User.Read`)
- **Token received:** Access tokens had audience (`aud` claim) set to `00000003-0000-0000-c000-000000000000` (Microsoft Graph)
- **Backend expectation:** API functions expected tokens with audience matching the app's client ID (`8451d08e-33f6-4c8f-9185-428d0aca7b3e`)
- **Result:** JWT validation failed because the audience didn't match, causing 401 Unauthorized responses

## Root Cause

The issue occurred because:

1. The frontend was only requesting Microsoft Graph scopes (`User.Read`)
2. When requesting Graph scopes, MSAL returns tokens intended for Microsoft Graph API, not the Fire Santa Run API
3. The backend couldn't validate these tokens because they had the wrong audience

## Solution Implemented

### 1. Frontend Changes (`src/auth/msalConfig.ts`)

**Added API scope configuration:**
```typescript
function getApiScope(): string {
  return `api://${clientId}/.default`;
}
```

**Separated token requests:**
- `loginRequest`: Basic authentication scopes (`openid`, `profile`, `email`) - used during initial login
- `graphTokenRequest`: Microsoft Graph scopes (`User.Read`) - for future Graph API calls
- `tokenRequest`: API scope (`api://{clientId}/.default`) - for Fire Santa Run API calls

**Updated protected resources:**
```typescript
export const protectedResources = {
  api: {
    endpoint: '/api',
    scopes: clientId ? [getApiScope()] : [],
  },
};
```

### 2. Backend Changes (`api/src/utils/auth.ts`)

**Updated audience validation to accept both formats:**
```typescript
const validAudiences = ENTRA_CLIENT_ID 
  ? [ENTRA_CLIENT_ID, `api://${ENTRA_CLIENT_ID}`] as [string, string]
  : undefined;
```

The backend now accepts tokens with audience in either format:
- `8451d08e-33f6-4c8f-9185-428d0aca7b3e` (client ID)
- `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e` (API identifier)

### 3. Documentation Updates

Updated the following documentation files:
- `docs/API_AUTHENTICATION.md`: Added API scope configuration and troubleshooting
- `docs/ENTRA_EXTERNAL_ID_SETUP.md`: Added "Expose an API" setup instructions

## Next Steps for Deployment

### 1. Configure Entra App Registration

**CRITICAL:** You must expose an API in the Azure app registration for this fix to work:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Microsoft Entra ID** > **App registrations** > **Fire Santa Run Web App**
3. Click **Expose an API** in the left sidebar
4. Click **+ Add** next to **Application ID URI**
5. Accept the default value: `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`
6. Click **Save**

**Optional:** Add a custom scope:
- Click **+ Add a scope**
- Scope name: `access_as_user`
- Who can consent: Admins and users
- Fill in display names and descriptions
- State: Enabled

Without this configuration, MSAL will continue to return Graph-audience tokens.

### 2. Update Environment Variables

Ensure the following are set correctly:

```bash
# In .env.local (local development)
VITE_DEV_MODE=false  # Must be false to test authentication
VITE_ENTRA_CLIENT_ID=8451d08e-33f6-4c8f-9185-428d0aca7b3e
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
```

### 3. Test the Fix

**Clear tokens and re-login:**
1. Open the application in a browser
2. Clear browser cache/storage (or use incognito mode)
3. Log in with credentials
4. Try to save a route
5. Check Network tab in DevTools

**Verify token audience:**
1. Open DevTools Network tab
2. Find a POST request to `/api/routes`
3. Copy the `Authorization: Bearer <token>` header value
4. Go to [jwt.io](https://jwt.io) and paste the token
5. Verify the `aud` claim is either:
   - `8451d08e-33f6-4c8f-9185-428d0aca7b3e` (client ID)
   - `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e` (API identifier)

**Expected behavior:**
- ✅ POST to `/api/routes` should return 201 Created (or appropriate success status)
- ✅ Route should be saved successfully
- ✅ No 401 Unauthorized errors

### 4. Troubleshooting

If you still see 401 errors after deploying:

1. **Check Entra configuration:**
   - Verify "Expose an API" is configured
   - Verify Application ID URI is set correctly

2. **Check token audience:**
   - Decode token in jwt.io
   - Confirm `aud` claim matches client ID or API identifier
   - If still showing Graph audience, the app registration isn't properly exposed

3. **Check environment variables:**
   - Verify `VITE_ENTRA_CLIENT_ID` is set correctly
   - Verify client ID matches the one in Azure Portal

4. **Clear tokens:**
   - Logout and login again
   - Clear browser storage
   - Use incognito/private browsing mode

5. **Check backend logs:**
   - Look for JWT validation errors
   - Check audience mismatch messages

## Technical Details

### Token Flow Before Fix

```
User Login
    ↓
MSAL requests: ['openid', 'profile', 'email', 'User.Read']
    ↓
Entra returns token with aud: '00000003-0000-0000-c000-000000000000' (Graph)
    ↓
Frontend sends token to /api/routes
    ↓
Backend validates token audience
    ↓
❌ Audience mismatch: Expected '8451d08e...', got '00000003...'
    ↓
401 Unauthorized
```

### Token Flow After Fix

```
User Login
    ↓
MSAL requests: ['openid', 'profile', 'email'] (login)
    ↓
For API calls, MSAL requests: ['api://8451d08e-33f6-4c8f-9185-428d0aca7b3e/.default']
    ↓
Entra returns token with aud: 'api://8451d08e-33f6-4c8f-9185-428d0aca7b3e'
    ↓
Frontend sends token to /api/routes
    ↓
Backend validates token audience
    ↓
✅ Audience matches: Expected '8451d08e...' or 'api://8451d08e...', got 'api://8451d08e...'
    ↓
200/201 Success
```

## References

- Issue: [BUG - Auth Problems attempting to save route]
- MSAL.js Documentation: https://github.com/AzureAD/microsoft-authentication-library-for-js
- Azure AD Token Claims: https://learn.microsoft.com/en-us/azure/active-directory/develop/access-tokens
- Expose an API: https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-configure-app-expose-web-apis

## Summary

This fix ensures that the frontend requests tokens with the correct scope for the Fire Santa Run API, and the backend validates those tokens correctly. The key changes are:

1. Frontend requests API-scoped tokens (`api://{clientId}/.default`)
2. Backend accepts both client ID and API identifier as valid audiences
3. Documentation updated with setup and troubleshooting instructions

After configuring the Entra app registration to expose an API, users should be able to save routes without authentication errors.
