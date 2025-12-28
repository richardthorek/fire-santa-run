# API Authentication & Authorization

## Overview

The Fire Santa Run API implements JWT-based authentication using Microsoft Entra External ID. All protected endpoints require a valid JWT token in the Authorization header and enforce role-based access control (RBAC).

## Authentication Flow

### 1. Obtain JWT Token (Frontend)

The frontend application uses MSAL (Microsoft Authentication Library) to obtain JWT tokens:

```typescript
// In React application
import { useMsal } from '@azure/msal-react';
import { tokenRequest } from '../auth/msalConfig';

const { instance, accounts } = useMsal();
const account = accounts[0];

// Get access token for Fire Santa Run API
// IMPORTANT: Use tokenRequest which includes the API scope (api://{clientId}/.default)
// This ensures the token has the correct audience for the backend API
const response = await instance.acquireTokenSilent({
  ...tokenRequest,
  account: account
});

const accessToken = response.accessToken;
```

**Important:** The token request must include the API scope `api://{clientId}/.default` to receive a token with the correct audience. Using only Graph scopes (like `User.Read`) will result in a token with Microsoft Graph audience (`00000003-0000-0000-c000-000000000000`), which the API will reject with a 401 Unauthorized error.

### 2. Include Token in API Requests

All API requests to protected endpoints must include the JWT token:

```typescript
// Example API request with authentication
const response = await fetch('/api/routes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify(routeData)
});
```

### 3. Token Validation (Backend)

The API validates tokens using the following process:

1. **Extract token** from `Authorization: Bearer <token>` header
2. **Verify signature** using Entra External ID public keys (JWKS)
3. **Check expiration** to ensure token is still valid
4. **Validate audience** matches one of the following:
   - The application client ID (e.g., `8451d08e-33f6-4c8f-9185-428d0aca7b3e`)
   - The API identifier (e.g., `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`)
5. **Extract user claims** (user ID, email, name)

**Important:** The backend accepts tokens with either the client ID or the `api://` format as the audience. This ensures compatibility with both approaches to requesting API tokens.

## API Scope Configuration

### App Registration Setup

To use the Fire Santa Run API with proper authentication, the Entra app registration must be configured to expose an API:

1. In Azure Portal, go to **App registrations** > **Fire Santa Run Web App**
2. Navigate to **Expose an API** in the left sidebar
3. Click **+ Add a scope**
4. Set the **Application ID URI** to `api://{clientId}` (e.g., `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e`)
5. Add a scope (or use `.default` to request all exposed permissions)

The frontend automatically uses the `.default` scope (`api://{clientId}/.default`) to request tokens that can access the API.

### Token Audience

When the frontend requests a token with the API scope:
- **Requested scope:** `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e/.default`
- **Token audience (`aud` claim):** `api://8451d08e-33f6-4c8f-9185-428d0aca7b3e` or `8451d08e-33f6-4c8f-9185-428d0aca7b3e`

The backend validates both formats to ensure maximum compatibility.

## Development Mode

When `VITE_DEV_MODE=true`, authentication is bypassed:

- Token validation returns a mock authenticated user
- All authorization checks pass
- No actual JWT validation occurs
- Enables rapid development and testing

**⚠️ Important:** Development mode must be disabled in production (`VITE_DEV_MODE=false`).

## Role-Based Access Control (RBAC)

### Roles

The system supports three roles with hierarchical permissions:

#### 1. **Admin** (Highest privilege)
- Manage routes (create, edit, delete)
- Manage members (invite, approve, remove)
- Promote/demote admins (max 2 per brigade)
- Edit brigade settings
- Start navigation
- View members
- Cancel invitations

#### 2. **Operator** (Standard brigade member)
- Manage routes (create, edit, delete)
- Start navigation
- View members

#### 3. **Viewer** (Read-only)
- View members

### Permission Checking

The API enforces permissions at two levels:

#### 1. **Authentication Check**
Validates the user has a valid JWT token:

```typescript
const authResult = await validateToken(request);
if (!authResult.authenticated) {
  return { status: 401, jsonBody: { error: 'Unauthorized' } };
}
```

#### 2. **Authorization Check**
Validates the user has permission for the requested action:

```typescript
const permissionCheck = await checkBrigadePermission(
  authResult.userId,
  brigadeId,
  'manage_routes',
  getUserMembership
);

if (!permissionCheck.authorized) {
  return { status: 403, jsonBody: { error: 'Forbidden' } };
}
```

## Protected Endpoints

### Routes API

| Endpoint | Method | Required Permission | Description |
|----------|--------|---------------------|-------------|
| `GET /api/routes` | GET | None (Public) | List routes for a brigade |
| `GET /api/routes/{id}` | GET | None (Public) | Get single route |
| `POST /api/routes` | POST | `manage_routes` | Create new route |
| `PUT /api/routes/{id}` | PUT | `manage_routes` | Update route |
| `DELETE /api/routes/{id}` | DELETE | `manage_routes` | Delete route |

### Members API

| Endpoint | Method | Required Permission | Description |
|----------|--------|---------------------|-------------|
| `GET /api/brigades/{brigadeId}/members` | GET | `view_members` | List brigade members |
| `POST /api/brigades/{brigadeId}/members/invite` | POST | `invite_members` | Invite new member |
| `DELETE /api/brigades/{brigadeId}/members/{userId}` | DELETE | `remove_members` | Remove member |
| `PATCH /api/brigades/{brigadeId}/members/{userId}/role` | PATCH | `manage_members` or `promote_admin` | Change member role |
| `GET /api/brigades/{brigadeId}/members/pending` | GET | `approve_members` | List pending approvals |
| `POST /api/brigades/{brigadeId}/members/{userId}/approve` | POST | `approve_members` | Approve member |

## Domain Whitelist & Auto-Approval

### Overview

Brigades can configure domain whitelists to automatically approve members from trusted organizations without manual approval.

### Configuration

Brigades have two whitelist fields:

1. **allowedDomains** - List of trusted email domains (e.g., `['fire.nsw.gov.au', 'rfs.nsw.gov.au']`)
2. **allowedEmails** - List of specific email addresses (e.g., `['captain@brigade.org.au']`)

### Auto-Approval Logic

When a member is invited or accepts an invitation:

1. **Check specific email** - If email is in `allowedEmails`, auto-approve
2. **Check domain** - If email domain is in `allowedDomains`, auto-approve
3. **Manual approval** - If no match, require admin approval

Example:
```typescript
// Email: john.smith@fire.nsw.gov.au
// Brigade allowedDomains: ['fire.nsw.gov.au', 'rfs.nsw.gov.au']
// Result: Auto-approved ✅

// Email: volunteer@gmail.com
// Brigade allowedDomains: ['fire.nsw.gov.au']
// Result: Manual approval required ⏳
```

### .gov.au Special Handling

- Admin roles **require** a `.gov.au` email address
- Brigade claiming is restricted to `.gov.au` emails OR verified users
- This ensures official government email addresses for administrative roles

## Error Responses

### 401 Unauthorized
Token is missing, invalid, or expired:

```json
{
  "error": "Unauthorized",
  "message": "No authorization token provided"
}
```

### 403 Forbidden
User lacks required permissions:

```json
{
  "error": "Forbidden",
  "message": "User role 'viewer' does not have 'manage_routes' permission"
}
```

### Common Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| `No authorization token provided` | Missing `Authorization` header | Include `Bearer <token>` header |
| `Invalid or expired token` | Token expired or invalid signature | Refresh token using MSAL |
| `User is not a member of this brigade` | User not in brigade | User must be invited and approved |
| `User membership is not active` | Membership pending or removed | Wait for approval or contact admin |
| `Insufficient permissions` | Role lacks permission | Contact brigade admin for role change |

## Token Lifecycle

### Token Expiration

- Access tokens expire after **1 hour** (Entra default)
- Frontend automatically refreshes tokens using MSAL
- API returns 401 if token is expired
- Frontend catches 401 and triggers token refresh

### Token Refresh (Frontend)

```typescript
try {
  // Try silent token refresh
  const response = await instance.acquireTokenSilent({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    account: account
  });
  return response.accessToken;
} catch (error) {
  // Fallback to interactive login if silent refresh fails
  const response = await instance.acquireTokenRedirect({
    scopes: ['openid', 'profile', 'email', 'User.Read'],
  });
}
```

## Security Best Practices

### Backend (API)

1. **Always validate tokens** - Never trust client-provided user IDs
2. **Check permissions** - Validate role-based permissions for all actions
3. **Use HTTPS** - Never transmit tokens over HTTP
4. **Log security events** - Track authentication failures and permission denials
5. **Rate limiting** - Implement rate limiting to prevent abuse

### Frontend (React)

1. **Use MSAL** - Never implement JWT handling manually
2. **Store tokens securely** - Use MSAL's session storage (cleared on tab close)
3. **Refresh proactively** - Refresh tokens before expiration
4. **Handle errors gracefully** - Show user-friendly error messages
5. **Clear tokens on logout** - Ensure tokens are cleared from storage

## Testing Authentication

### Development Mode Testing

```bash
# Enable dev mode in .env.local
VITE_DEV_MODE=true

# All API calls will bypass authentication
# Mock user: dev-user-1, dev@example.gov.au
```

### Production Mode Testing

```bash
# Disable dev mode in .env.local
VITE_DEV_MODE=false

# Configure Entra External ID
VITE_ENTRA_CLIENT_ID=your_client_id
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8

# Test with real authentication
npm run dev
```

### Testing Authorization

Test different role permissions:

```typescript
// Test as viewer (should fail to create route)
POST /api/routes
Authorization: Bearer <viewer_token>
// Expected: 403 Forbidden

// Test as operator (should succeed)
POST /api/routes
Authorization: Bearer <operator_token>
// Expected: 201 Created

// Test as admin (should succeed)
POST /api/brigades/{id}/members/invite
Authorization: Bearer <admin_token>
// Expected: 201 Created
```

## Troubleshooting

### "Invalid or expired token" - Audience Mismatch

**Cause:** Token has wrong audience (e.g., Microsoft Graph `00000003-0000-0000-c000-000000000000` instead of app client ID)

**Symptoms:**
- 401 Unauthorized error when calling API endpoints
- Network tab shows token with `aud` claim set to Microsoft Graph

**Fix:**
1. Ensure the frontend uses `tokenRequest` from `msalConfig.ts` (includes API scope)
2. Verify the app registration exposes an API with identifier `api://{clientId}`
3. Check that `VITE_ENTRA_CLIENT_ID` is set correctly in environment variables
4. Clear browser cache and re-login to get a fresh token
5. Inspect token in browser DevTools Network tab to verify `aud` claim matches client ID

**How to inspect token audience:**
```typescript
// In browser console after login
const token = localStorage.getItem('msal.token.keys');
// Decode the JWT (use jwt.io) and check the "aud" claim
// It should be either the client ID or api://{clientId}
```

### "No authorization token provided"

**Cause:** Missing `Authorization` header  
**Fix:** Ensure frontend includes bearer token in all API requests

### "Invalid or expired token"

**Cause:** Token expired or signature invalid  
**Fix:** 
1. Check MSAL token refresh is working
2. Verify `VITE_ENTRA_CLIENT_ID` matches app registration
3. Check system clock is synchronized

### "User is not a member of this brigade"

**Cause:** User not invited to brigade  
**Fix:** Brigade admin must invite user via member management

### "Insufficient permissions"

**Cause:** User's role lacks required permission  
**Fix:** Brigade admin must promote user to appropriate role

### JWKS fetch errors

**Cause:** Cannot fetch Entra public keys  
**Fix:**
1. Check internet connectivity
2. Verify `VITE_ENTRA_TENANT_ID` is correct
3. Ensure Entra tenant is active

## Environment Variables

### Required for Production

```bash
# Entra External ID Configuration
VITE_ENTRA_CLIENT_ID=your_client_id_here
VITE_ENTRA_TENANT_ID=50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/50fcb752-2a4e-4efd-bdc2-e18a5042c5a8

# Storage Connection
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string

# Disable dev mode
VITE_DEV_MODE=false
```

### Optional

```bash
# Enable trace logging for MSAL
VITE_MSAL_TRACE_LOGGING=true
```

## References

- [Microsoft Entra External ID Documentation](https://learn.microsoft.com/en-us/azure/active-directory/external-identities/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [JWT Introduction](https://jwt.io/introduction)
- [JWKS Specification](https://tools.ietf.org/html/rfc7517)
- [OAuth 2.0 Authorization Code Flow with PKCE](https://oauth.net/2/pkce/)
