# Microsoft Entra External ID Setup Guide

## Overview

This guide provides step-by-step instructions for configuring Microsoft Entra External ID (formerly Azure AD B2C) for the Fire Santa Run application. This setup enables secure authentication with email-based login, allowing brigade members to access protected features while keeping public tracking pages open to everyone.

## Prerequisites

- Azure subscription with appropriate permissions
- Access to Azure Portal (https://portal.azure.com)
- Entra External ID tenant created (see "Existing Tenant" section below)

## Existing Tenant Information

The Brigade Santa Run Entra External ID tenant has already been created:

- **Name:** Brigade Santa Run
- **Tenant ID:** `50fcb752-2a4e-4efd-bdc2-e18a5042c5a8`
- **Primary Domain:** `brigadesantarun.onmicrosoft.com`

## Step 1: Configure Application Registration

### 1.1 Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** > **App registrations**
3. Click **+ New registration**
4. Configure the following:
   - **Name:** `Fire Santa Run Web App`
   - **Supported account types:** 
     - Select "Accounts in this organizational directory only (Brigade Santa Run only - Single tenant)"
   - **Redirect URI:** 
     - Platform: **Single-page application (SPA)**
     - URI: Leave blank for now (we'll add it in the next step)
5. Click **Register**
6. **Save the Application (client) ID** - you'll need this later as `VITE_ENTRA_CLIENT_ID`

### 1.2 Configure Redirect URIs

After creating the app registration:

1. Go to **Authentication** in the left sidebar
2. Under **Platform configurations** > **Single-page application**, add the following redirect URIs:
   
   **Local Development:**
   ```
   http://localhost:5173/auth/callback
   http://localhost:5173
   ```
   
   **Production:**
   ```
   https://your-production-domain.com/auth/callback
   https://your-production-domain.com
   ```
   
   Replace `your-production-domain.com` with your actual Azure Static Web Apps domain or custom domain.

3. Under **Implicit grant and hybrid flows** (should be disabled by default for SPA):
   - ✅ Leave **both checkboxes unchecked** (Access tokens and ID tokens)
   - SPAs use PKCE flow, not implicit flow

4. Under **Advanced settings**:
   - **Allow public client flows:** No
   - **Enable the following mobile and desktop flows:** No

5. Click **Save**

### 1.3 Configure API Permissions

1. Go to **API permissions** in the left sidebar
2. The `User.Read` permission for Microsoft Graph should already be present
3. Add additional permissions:
   - Click **+ Add a permission**
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Check the following permissions:
     - `email` - View users' email address
     - `openid` - Sign users in
     - `profile` - View users' basic profile
   - Click **Add permissions**

4. **(Optional but Recommended)** Grant admin consent:
   - Click **Grant admin consent for [Your Tenant]**
   - Confirm by clicking **Yes**
   - This prevents users from seeing a consent screen

### 1.4 Expose an API (Required for Backend Authentication)

**IMPORTANT:** This step is critical for the backend API to validate access tokens correctly.

1. Go to **Expose an API** in the left sidebar
2. Click **+ Add** next to **Application ID URI**
3. Accept the default value `api://{clientId}` or customize it
   - Default: `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`
   - Click **Save**

4. Add a scope for API access (optional, or use `.default`):
   - Click **+ Add a scope**
   - **Scope name:** `access_as_user`
   - **Who can consent:** Admins and users
   - **Admin consent display name:** Access Fire Santa Run API
   - **Admin consent description:** Allows the app to access the Fire Santa Run API on behalf of the signed-in user
   - **User consent display name:** Access Fire Santa Run API
   - **User consent description:** Allows the app to access your brigade data and perform actions on your behalf
   - **State:** Enabled
   - Click **Add scope**

5. The frontend automatically uses `api://{clientId}/.default` to request tokens for the API

**Why this matters:**
- Without exposing an API, MSAL will return tokens with Microsoft Graph audience
- The backend requires tokens with the app's client ID as the audience
- Exposing the API allows the frontend to request properly-scoped tokens

### 1.5 Enable Token Configuration

1. Go to **Token configuration** in the left sidebar
2. Add optional claims for ID token:
   - Click **+ Add optional claim**
   - Select **ID**
   - Check the following claims:
     - `email`
     - `family_name`
     - `given_name`
   - Click **Add**
   - If prompted about Microsoft Graph permissions, check the box and click **Add**

### 1.6 Configure Token Lifetimes

Token lifetimes are configured at the tenant level using token lifetime policies. For most applications, the default settings are appropriate:

- **Access tokens:** 1 hour (default)
- **Refresh tokens:** 24 hours (default for SPA)
- **ID tokens:** 1 hour (default)

To customize token lifetimes (optional):

1. Use **Azure AD PowerShell** or **Microsoft Graph API**
2. Create a token lifetime policy:
   ```powershell
   New-AzureADPolicy -Definition @('{"TokenLifetimePolicy":{"Version":1,"AccessTokenLifetime":"01:00:00","RefreshTokenMaxInactiveTime":"1.00:00:00"}}') -DisplayName "FireSantaRunTokenPolicy" -Type "TokenLifetimePolicy"
   ```
3. Assign the policy to your application

**Note:** For this application, default token lifetimes are recommended for security.

## Step 2: Configure User Flows for Sign-Up and Sign-In

### 2.1 Create User Flow for Email Authentication

1. In Azure Portal, go to **Microsoft Entra ID**
2. Navigate to **External Identities** > **User flows**
3. Click **+ New user flow**
4. Select **Sign up and sign in**
5. Configure the user flow:
   - **Name:** `FireSantaRun_SignUpSignIn`
   - **Identity providers:**
     - ✅ **Email signup** (Email with password)
     - ✅ **Email one-time passcode** (Recommended for better UX)
   - **Multifactor authentication:**
     - For production: **Required** (Recommended)
     - For development/testing: **Optional**
   - **Conditional Access:**
     - Configure as needed based on your security requirements
   - **User attributes:**
     - ✅ Email Address (Collect and return in token)
     - ✅ Display Name (Collect and return in token)
     - ✅ Given Name (Optional - return in token)
     - ✅ Surname (Optional - return in token)
6. Click **Create**

### 2.2 Configure Email One-Time Passcode (Recommended)

Email one-time passcode (OTP) provides a better user experience by sending a code to the user's email instead of requiring password management:

1. Go to **Microsoft Entra ID** > **External Identities** > **All identity providers**
2. Select **Email one-time passcode**
3. Enable for guest users:
   - Select **Yes** to enable
4. This allows users to sign in by entering a code sent to their email

### 2.3 Configure Email Templates (Optional)

Customize the email templates for verification codes and password resets:

1. Go to **Microsoft Entra ID** > **External Identities** > **Company branding**
2. Customize email templates with Fire Santa Run branding
3. Add logo and color scheme matching the application

## Step 3: Gather Configuration Values

After completing the above steps, gather the following values for your application configuration:

### Required Environment Variables

```bash
# Entra External ID Configuration
VITE_ENTRA_CLIENT_ID=<Application (client) ID from Step 1.1>
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback  # or production URL
```

### How to Find These Values

1. **Client ID**: 
   - Go to **App registrations** > **Fire Santa Run Web App** > **Overview**
   - Copy the **Application (client) ID**

2. **Tenant ID**: 
   - Already provided: `50fcb752-2a4e-4efd-bdc2-e18a5042c5a8`

3. **Authority URL**: 
   - Format: `https://login.microsoftonline.com/{tenant-id}`
   - For this app: `https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8`

4. **Redirect URI**: 
   - Use `http://localhost:5173/auth/callback` for local development
   - Use your production domain for deployment

## Step 4: Update Application Configuration

### 4.1 Update .env.local (Local Development)

Create or update `/home/runner/work/fire-santa-run/fire-santa-run/.env.local`:

```bash
# Development Mode Configuration
VITE_DEV_MODE=true  # Set to false when testing authentication

# Mapbox (Required)
VITE_MAPBOX_TOKEN=your_mapbox_token_here

# Entra External ID (Required for production authentication)
VITE_ENTRA_CLIENT_ID=<your-client-id-here>
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_REDIRECT_URI=http://localhost:5173/auth/callback
```

### 4.2 Update Azure Static Web App Configuration (Production)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App resource
3. Go to **Configuration** in the left sidebar
4. Add the following application settings:
   ```
   VITE_DEV_MODE=false
   VITE_ENTRA_CLIENT_ID=<your-client-id>
   VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
   VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
   VITE_ENTRA_REDIRECT_URI=https://your-production-domain.com/auth/callback
   ```
5. Click **Save**

## Step 5: Configure CORS (If Needed)

CORS is typically not needed for SPAs using MSAL.js with the PKCE flow, as all authentication happens through redirects. However, if you encounter CORS issues:

1. In your **App registration**, go to **Authentication**
2. Ensure redirect URIs are correctly configured
3. MSAL.js handles authentication via redirects, not API calls, so CORS configuration is usually not required

## Step 6: Test the Configuration

### 6.1 Test in Development Mode

1. Set `VITE_DEV_MODE=false` in `.env.local` to test authentication
2. Run the application: `npm run dev`
3. Navigate to a protected route (e.g., `/dashboard`)
4. You should be redirected to the Entra login page
5. Test sign-up with a new email address
6. Verify email OTP (if configured)
7. Confirm successful redirect back to application

### 6.2 Verify Token Claims

After successful login, check the browser console for:
- Access token
- ID token with user claims (email, name, etc.)
- Token expiration times

### 6.3 Test Token Refresh

1. Wait for access token to expire (or manually clear it)
2. Verify that MSAL automatically refreshes the token
3. Confirm no login prompt appears during refresh

## Authentication Flow Diagram

```
┌─────────────┐
│   User      │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Access protected route
       ▼
┌─────────────────────────────────────┐
│  Fire Santa Run Web App (React)     │
│  - Detects unauthenticated user     │
└──────┬──────────────────────────────┘
       │
       │ 2. Redirect to login
       ▼
┌─────────────────────────────────────┐
│  Microsoft Entra External ID        │
│  - Email + OTP authentication       │
│  - User signs in/signs up           │
└──────┬──────────────────────────────┘
       │
       │ 3. Redirect with auth code
       ▼
┌─────────────────────────────────────┐
│  /auth/callback (React)             │
│  - MSAL handles auth code exchange  │
│  - Receives ID token + access token │
└──────┬──────────────────────────────┘
       │
       │ 4. Redirect to original route
       ▼
┌─────────────────────────────────────┐
│  Protected Route                    │
│  - User now authenticated           │
│  - Access granted                   │
└─────────────────────────────────────┘
```

## Troubleshooting

### Common Issues

#### Issue: "AADSTS50011: The reply URL specified in the request does not match"

**Solution:** 
- Verify redirect URIs in app registration match exactly what's in your code
- Check for trailing slashes or protocol mismatches (http vs https)
- Ensure URIs include `/auth/callback` if that's your callback route

#### Issue: "AADSTS700016: Application not found"

**Solution:**
- Verify `VITE_ENTRA_CLIENT_ID` matches the Application ID in Azure
- Check that you're using the correct tenant ID

#### Issue: CORS errors during login

**Solution:**
- MSAL.js uses redirects, not API calls, so CORS shouldn't be an issue
- If you see CORS errors, ensure you're using `loginRedirect()` not `loginPopup()`
- Check browser console for specific error messages

#### Issue: Tokens not refreshing automatically

**Solution:**
- Ensure `acquireTokenSilent()` is called with correct scopes
- Check that refresh tokens are enabled in your app registration
- Verify token cache is persisted correctly (session storage)

### Support Resources

- [Microsoft Entra External ID Documentation](https://learn.microsoft.com/en-us/azure/active-directory/external-identities/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-browser)
- [MSAL React Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-react)

## Security Best Practices

1. **Never commit secrets to source control**
   - Use `.env.local` for local development
   - Use Azure Static Web App configuration for production

2. **Enable MFA for production**
   - Require multi-factor authentication for all users
   - Configure in user flows

3. **Use HTTPS in production**
   - Never use http:// redirect URIs in production
   - Azure Static Web Apps provides free SSL certificates

4. **Rotate credentials regularly**
   - If client secrets are used (not needed for SPAs), rotate them every 6-12 months

5. **Monitor authentication logs**
   - Use Azure AD sign-in logs to detect suspicious activity
   - Set up alerts for failed login attempts

6. **Implement proper session timeouts**
   - Configure appropriate token lifetimes
   - Implement inactivity detection in the application

## Next Steps

After completing this setup:

1. ✅ Install MSAL packages in the application
2. ✅ Create MSAL configuration file (`src/auth/msalConfig.ts`)
3. ✅ Implement authentication context with MSAL hooks
4. ✅ Build authentication UI pages
5. ✅ Test authentication flows in development
6. ✅ Deploy to production and test with real users

For implementation details, see the main Phase 7 implementation documentation.
