# Authentication Troubleshooting Guide

## Overview

This guide provides solutions to common authentication and authorization issues in the Fire Santa Run application.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Authentication Errors](#authentication-errors)
- [Authorization Errors](#authorization-errors)
- [Token Issues](#token-issues)
- [Browser Issues](#browser-issues)
- [Development Mode Issues](#development-mode-issues)
- [Production Deployment Issues](#production-deployment-issues)
- [Getting Help](#getting-help)

---

## Quick Diagnostics

### Check Current State

**Browser Console:**
```javascript
// Check if authenticated
console.log('Authenticated:', localStorage.getItem('msal.account.keys'));

// Check dev mode
console.log('Dev Mode:', import.meta.env.VITE_DEV_MODE);

// Check configuration
console.log('Client ID:', import.meta.env.VITE_ENTRA_CLIENT_ID);
console.log('Authority:', import.meta.env.VITE_ENTRA_AUTHORITY);
```

**Network Tab:**
- Check for 401 (Unauthorized) or 403 (Forbidden) responses
- Verify Authorization header is present
- Check token in request headers

**Application Tab:**
- Look for MSAL cache entries in Session Storage
- Check for authentication state

---

## Authentication Errors

### "No authorization token provided"

**Symptoms:**
- API returns 401 Unauthorized
- Error message: "No authorization token provided"

**Causes:**
1. Token not included in API request
2. Authorization header missing
3. MSAL not properly initialized

**Solutions:**

```typescript
// ✅ Correct: Include token in request
const { instance, accounts } = useMsal();
const account = accounts[0];

const response = await instance.acquireTokenSilent({
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  account: account
});

fetch('/api/routes', {
  headers: {
    'Authorization': `Bearer ${response.accessToken}`
  }
});

// ❌ Wrong: Missing authorization header
fetch('/api/routes');
```

### "Invalid or expired token"

**Symptoms:**
- Login successful but API calls fail
- Error: "Invalid or expired token"

**Causes:**
1. Token expired (default 1 hour)
2. Token signature invalid
3. Wrong client ID in token validation
4. Clock skew between systems

**Solutions:**

**1. Check token expiration:**
```typescript
// Decode token to check expiration
const token = response.accessToken;
const base64Url = token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const payload = JSON.parse(window.atob(base64));

console.log('Token expires at:', new Date(payload.exp * 1000));
console.log('Current time:', new Date());
```

**2. Force token refresh:**
```typescript
const response = await instance.acquireTokenSilent({
  scopes: ['openid', 'profile', 'email', 'User.Read'],
  account: account,
  forceRefresh: true  // Force fresh token
});
```

**3. Verify configuration:**
- Check `VITE_ENTRA_CLIENT_ID` matches app registration
- Verify `VITE_ENTRA_TENANT_ID` is correct
- Ensure clock is synchronized (NTP)

### "Redirect loop" after login

**Symptoms:**
- Browser keeps redirecting between app and Entra
- Never completes login flow
- Login page keeps reloading

**Causes:**
1. Redirect URI mismatch
2. MSAL configuration error
3. Browser cache issues
4. Cookie blocking

**Solutions:**

**1. Verify redirect URI:**
```bash
# In app registration, redirect URI must match exactly:
http://localhost:5173/auth/callback  # Local dev
https://your-app.azurestaticapps.net/auth/callback  # Production

# Check environment variable:
echo $VITE_ENTRA_REDIRECT_URI
```

**2. Clear browser cache:**
- Open DevTools
- Application tab > Clear storage
- Delete all MSAL cache entries
- Clear cookies for app domain

**3. Check MSAL configuration:**
```typescript
// Verify redirectUri is set
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: import.meta.env.VITE_ENTRA_AUTHORITY,
    redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin + '/auth/callback',
  }
};
```

### "User cancelled login"

**Symptoms:**
- Error: "User cancelled the authentication flow"
- Login popup/redirect cancelled

**Causes:**
1. User clicked "Cancel" or "Back"
2. Browser blocked popup
3. Network timeout

**Solutions:**

**1. Handle user cancellation gracefully:**
```typescript
try {
  await instance.loginRedirect(loginRequest);
} catch (error: any) {
  if (error.errorCode === 'user_cancelled') {
    // Show friendly message
    console.log('Login was cancelled');
    // Don't show error, allow user to try again
  } else {
    // Show error for other issues
    console.error('Login failed:', error);
  }
}
```

**2. Use redirect instead of popup:**
```typescript
// ✅ Use redirect (recommended)
await instance.loginRedirect(loginRequest);

// ❌ Avoid popup (may be blocked)
await instance.loginPopup(loginRequest);
```

---

## Authorization Errors

### "User is not a member of this brigade"

**Symptoms:**
- 403 Forbidden error
- Message: "User is not a member of this brigade"
- User can login but can't access brigade

**Causes:**
1. User not invited to brigade
2. Invitation not accepted
3. Membership not approved

**Solutions:**

**Step 1: Verify membership status**
- Navigate to brigade member management page
- Check if user appears in member list
- Check membership status (pending/active)

**Step 2: If user not in list:**
- Admin must invite user
- User must accept invitation
- Admin must approve (if not auto-approved)

**Step 3: If user shows as "pending":**
- Admin must approve membership
- Check domain whitelist configuration
- Verify email domain matches whitelist

### "Insufficient permissions"

**Symptoms:**
- 403 Forbidden error
- Message: "User role 'viewer' does not have 'manage_routes' permission"
- User is member but can't perform action

**Causes:**
1. User's role lacks permission
2. Action requires higher privilege
3. Role not properly assigned

**Solutions:**

**Check permission requirements:**

| Action | Required Role |
|--------|---------------|
| View members | Viewer, Operator, Admin |
| Create routes | Operator, Admin |
| Invite members | Admin |
| Approve members | Admin |
| Remove members | Admin |
| Promote admin | Admin |

**Change user role:**
1. Admin navigates to member management
2. Click role dropdown next to user
3. Select appropriate role
4. Confirm change

**Example:**
```
Current: Bob Wilson (Viewer)
Action: Create route
Result: 403 Forbidden

Solution: Admin promotes Bob to Operator
New: Bob Wilson (Operator)
Result: Can now create routes ✅
```

### "Cannot promote to admin - email domain required"

**Symptoms:**
- Cannot promote member to admin
- Error: "Email must be from a .gov.au domain"

**Causes:**
1. User's email not from .gov.au domain
2. Security requirement for admin role

**Solutions:**

**Verify email domain:**
```
✅ Valid admin emails:
- john@fire.nsw.gov.au
- mary@rfs.qld.gov.au
- captain@emergency.vic.gov.au

❌ Invalid admin emails:
- volunteer@gmail.com
- member@outlook.com
- user@brigade.org.au (not .gov.au)
```

**If user needs admin access:**
1. Request user obtain .gov.au email
2. User updates profile with .gov.au email
3. Admin can then promote to admin role

**Alternative:**
- Grant Operator role (doesn't require .gov.au)
- Operator can still manage routes and navigation

---

## Token Issues

### Token refresh fails

**Symptoms:**
- Silent token refresh returns error
- User logged out unexpectedly
- InteractionRequiredAuthError

**Causes:**
1. Refresh token expired
2. Session expired
3. Account signed out elsewhere
4. Policy change in Entra

**Solutions:**

**1. Fallback to interactive login:**
```typescript
try {
  const response = await instance.acquireTokenSilent({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    account: account
  });
} catch (error: any) {
  if (error.name === 'InteractionRequiredAuthError') {
    // Silent refresh failed, need user interaction
    const response = await instance.acquireTokenRedirect({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
    });
  }
}
```

**2. Check session validity:**
```typescript
const accounts = instance.getAllAccounts();
if (accounts.length === 0) {
  // No active session, redirect to login
  await instance.loginRedirect();
}
```

### Token claims missing

**Symptoms:**
- User ID or email missing from token
- Cannot extract user information
- Profile creation fails

**Causes:**
1. Optional claims not configured
2. Scopes not requested
3. User consent not granted

**Solutions:**

**1. Verify token configuration:**
- Go to Entra app registration
- Token configuration tab
- Add optional claims: email, given_name, family_name

**2. Request correct scopes:**
```typescript
const loginRequest = {
  scopes: [
    'openid',      // Required for ID token
    'profile',     // Includes name, given_name, family_name
    'email',       // Includes email claim
    'User.Read'    // Microsoft Graph user info
  ]
};
```

**3. Grant admin consent:**
- Entra app registration
- API permissions tab
- Click "Grant admin consent"

---

## Browser Issues

### CORS errors

**Symptoms:**
- Console error: "CORS policy blocked"
- API calls fail from browser
- Works in development, fails in production

**Causes:**
1. CORS not configured for production domain
2. Credentials not included in request
3. Preflight request failed

**Solutions:**

**1. Configure CORS in API:**

`api/host.json`:
```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "cors": {
        "allowedOrigins": [
          "http://localhost:5173",
          "https://your-app.azurestaticapps.net",
          "https://yourdomain.com"
        ],
        "supportCredentials": true
      }
    }
  }
}
```

**2. Include credentials in requests:**
```typescript
fetch('/api/routes', {
  credentials: 'include',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Cookie/storage blocked

**Symptoms:**
- Login succeeds but session not persisted
- Logged out on page refresh
- Private browsing issues

**Causes:**
1. Third-party cookies blocked
2. Private/incognito mode
3. Browser security settings
4. Storage quota exceeded

**Solutions:**

**1. Check browser settings:**
- Allow cookies for app domain
- Disable tracking prevention for app
- Use normal browsing mode (not private)

**2. Use session storage (default):**
```typescript
// MSAL configuration
cache: {
  cacheLocation: 'sessionStorage',  // Cleared on tab close
  storeAuthStateInCookie: false      // Don't use cookies
}
```

**3. Prompt user:**
```
⚠️ Cookies Required

This application requires cookies to function.
Please allow cookies for this site in your
browser settings.

[Learn More] [Dismiss]
```

---

## Development Mode Issues

### Dev mode not working

**Symptoms:**
- Authentication required in development
- Mock user not provided
- Dev mode seems disabled

**Causes:**
1. `VITE_DEV_MODE` not set to 'true'
2. Environment variable not loaded
3. Case sensitivity issue

**Solutions:**

**1. Check environment variable:**
```bash
# .env.local file
VITE_DEV_MODE=true  # Must be exactly 'true' (lowercase)

# Verify it's loaded
npm run dev
# Check console for "Development mode enabled"
```

**2. Restart dev server:**
```bash
# Stop server (Ctrl+C)
# Clear cache
rm -rf node_modules/.vite
# Restart
npm run dev
```

**3. Verify in code:**
```typescript
console.log('Dev mode:', import.meta.env.VITE_DEV_MODE);
// Should print: Dev mode: true

// Check type
console.log(import.meta.env.VITE_DEV_MODE === 'true');
// Should print: true
```

### Dev mode in production

**⚠️ CRITICAL SECURITY ISSUE**

**Symptoms:**
- Production site has no authentication
- Anyone can access admin features
- No token validation

**This is a CRITICAL security vulnerability!**

**Immediate action:**
1. Set `VITE_DEV_MODE=false` in production
2. Verify environment variables in Azure
3. Redeploy application immediately
4. Review access logs for unauthorized access

**Prevention:**
- Never set `VITE_DEV_MODE=true` in production
- Use separate environment configurations
- Implement deployment checklist
- Automated security scanning

---

## Production Deployment Issues

### Environment variables not applied

**Symptoms:**
- App uses development settings in production
- Authentication doesn't work after deployment
- Configuration seems wrong

**Causes:**
1. Variables not set in Azure Static Web Apps
2. Build-time vs runtime variables confusion
3. Cache not cleared

**Solutions:**

**1. Verify variables in Azure:**
```bash
# List all settings
az staticwebapp appsettings list \
  --name your-app-name \
  --resource-group your-rg

# Check specific variable
az staticwebapp appsettings list \
  --name your-app-name \
  --resource-group your-rg \
  --query "[?name=='VITE_DEV_MODE'].value"
```

**2. Rebuild application:**
- Variables are embedded at build time
- Must rebuild after changing variables
- Push to repository to trigger rebuild

**3. Clear CDN cache:**
- Azure Static Web Apps uses CDN
- May serve cached old version
- Wait 5-10 minutes or purge cache

### Redirect URI not working in production

**Symptoms:**
- Login works locally but fails in production
- Redirect back to app fails
- MSAL error about redirect URI

**Causes:**
1. Production redirect URI not added to app registration
2. URI doesn't match exactly (trailing slash, http vs https)
3. Environment variable wrong

**Solutions:**

**1. Add production URI to app registration:**
```
Azure Portal > Entra ID > App Registrations > Your App > Authentication

Add redirect URIs:
✅ https://your-app.azurestaticapps.net/auth/callback
✅ https://your-app.azurestaticapps.net
✅ https://yourdomain.com/auth/callback  (if custom domain)
```

**2. Verify exact match:**
```typescript
// Check what URI is being used
console.log('Redirect URI:', msalConfig.auth.redirectUri);

// Should exactly match one in app registration
// Including:
// - http vs https
// - trailing slash or not
// - domain spelling
```

**3. Set environment variable:**
```bash
# In Azure Static Web Apps configuration
VITE_ENTRA_REDIRECT_URI=https://your-app.azurestaticapps.net/auth/callback
```

---

## Getting Help

### Diagnostic Information to Collect

When reporting authentication issues, include:

```typescript
// Browser console
console.log('User Agent:', navigator.userAgent);
console.log('Dev Mode:', import.meta.env.VITE_DEV_MODE);
console.log('Client ID:', import.meta.env.VITE_ENTRA_CLIENT_ID);
console.log('Authority:', import.meta.env.VITE_ENTRA_AUTHORITY);
console.log('Accounts:', instance.getAllAccounts());
console.log('Active Account:', instance.getActiveAccount());

// Network tab
// - Copy failed request as cURL
// - Include response headers
// - Screenshot of error
```

### Support Contacts

- **Technical Issues**: support@firesantarun.com.au
- **Account Issues**: accounts@firesantarun.com.au
- **GitHub Issues**: https://github.com/your-org/fire-santa-run/issues

### Additional Resources

- [API Authentication Documentation](./API_AUTHENTICATION.md)
- [Admin User Guide](./ADMIN_USER_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Entra External ID Setup](./ENTRA_EXTERNAL_ID_SETUP.md)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)

### Debug Mode

Enable verbose logging:

```typescript
// In src/auth/msalConfig.ts
system: {
  loggerOptions: {
    logLevel: LogLevel.Verbose,  // Most detailed
    piiLoggingEnabled: false,
    loggerCallback: (level, message, containsPii) => {
      console.log('[MSAL]', message);
    }
  }
}
```

Or via environment variable:
```bash
VITE_MSAL_TRACE_LOGGING=true
```
