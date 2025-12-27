# API Functions

This directory contains Azure Functions V4 (Node.js) for the Fire Santa Run backend.

## Structure

```
api/
├── README.md              # This file
├── host.json              # Azure Functions V4 host configuration
├── package.json           # API dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .funcignore            # Files to exclude from deployment
├── .oryxrc                # Oryx build configuration (Node 22)
├── src/                   # TypeScript source files
│   ├── index.ts           # Central entry point - imports all functions
│   ├── negotiate.ts       # WebSocket connection negotiation
│   ├── broadcast.ts       # Real-time location broadcasting
│   ├── routes.ts          # Routes CRUD API
│   ├── brigades.ts        # Brigades CRUD API
│   ├── users.ts           # User management API
│   ├── members.ts         # Brigade membership API
│   ├── invitations.ts     # Invitation management API
│   ├── verification.ts    # Email verification API
│   ├── admin-verification.ts  # Admin verification API
│   ├── claim.ts           # Brigade claiming API
│   ├── rfs-stations.ts    # RFS station lookup API
│   └── utils/             # Shared utilities
│       ├── auth.ts        # JWT authentication & authorization
│       ├── storage.ts     # Azure Storage connection helper
│       └── emailValidation.ts  # Email domain validation
└── dist/                  # Compiled JavaScript (gitignored)
    ├── index.js           # Main entry point for Azure Functions
    ├── *.js               # Compiled function files
    └── utils/             # Compiled utilities
```

## Azure Functions V4 Programming Model

This project uses the **Azure Functions V4 Programming Model** for Node.js:

- **Code-based configuration:** Functions are registered using `app.http()` in TypeScript
- **No function.json files:** Configuration is in code, not JSON files
- **Single entry point:** `src/index.ts` imports all function modules
- **Extension bundle:** host.json specifies bundle version `[4.*, 5.0.0)`

### Example Function Registration

```typescript
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function myFunction(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  return { status: 200, jsonBody: { message: 'Hello' } };
}

app.http('myFunction', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: myFunction
});
```

## Development Mode

In development mode (`VITE_DEV_MODE=true`):
- Frontend uses localStorage and BroadcastChannel API
- Authentication is bypassed with mock users
- Azure Functions can be tested locally but are not required

In production mode (`VITE_DEV_MODE=false`):
- All operations go through Azure Functions API
- JWT authentication via Microsoft Entra External ID
- Real-time tracking via Azure Web PubSub
- Data persistence in Azure Table Storage

## Available Functions

*The API provides **39 HTTP-triggered functions** across the following categories:*

### Real-Time Tracking (2 functions)
- **`POST /api/negotiate`** - Generate Web PubSub connection token for viewers/broadcasters
- **`POST /api/broadcast`** - Broadcast Santa's location to all viewers

### Routes Management (5 functions)
- **`GET /api/routes?brigadeId={id}`** - List all routes for a brigade
- **`GET /api/routes/{id}?brigadeId={id}`** - Get single route details
- **`POST /api/routes`** - Create new route (requires auth)
- **`PUT /api/routes/{id}`** - Update route (requires auth)
- **`DELETE /api/routes/{id}?brigadeId={id}`** - Delete route (requires auth)

### Brigade Management (5 functions)
- **`GET /api/brigades`** - List all brigades
- **`GET /api/brigades/{id}`** - Get brigade details
- **`POST /api/brigades`** - Create brigade (requires auth)
- **`PUT /api/brigades/{id}`** - Update brigade (requires auth)
- **`DELETE /api/brigades/{id}`** - Delete brigade (requires auth)

### User & Membership Management (13 functions)
- **`POST /api/users/register`** - Register new user
- **`GET /api/users/{userId}`** - Get user profile
- **`PATCH /api/users/{userId}`** - Update user profile
- **`GET /api/users/{userId}/memberships`** - Get user's memberships
- **`GET /api/brigades/{brigadeId}/members`** - List brigade members
- **`POST /api/brigades/{brigadeId}/members/invite`** - Invite member (requires auth)
- **`DELETE /api/brigades/{brigadeId}/members/{userId}`** - Remove member (requires auth)
- **`PATCH /api/brigades/{brigadeId}/members/{userId}/role`** - Change member role (requires auth)

### Invitations & Verification (11 functions)
- **`GET /api/invitations?brigadeId={id}`** - List invitations
- **`POST /api/invitations`** - Create invitation (requires auth)
- **`POST /api/invitations/{id}/accept`** - Accept invitation
- **`DELETE /api/invitations/{id}`** - Cancel invitation (requires auth)
- **`POST /api/verification/send-code`** - Send email verification code
- **`POST /api/verification/verify-code`** - Verify email code
- **`GET /api/admin-verification`** - Check if user is admin for unclaimed brigade

### RFS Data (1 function)
- **`GET /api/rfs-stations?q={searchTerm}`** - Search NSW RFS station database

### Brigade Claim (2 functions)
- **`POST /api/brigades/{brigadeId}/claim`** - Claim an unclaimed brigade (requires auth)
- **`GET /api/brigades/{brigadeId}/claim-status`** - Check if brigade is claimable

## Local Development

### Prerequisites
- Node.js 22.x or higher (specified in `.oryxrc` and `package.json`)
- Azure Functions Core Tools (v4)

### Setup

1. Install dependencies:
```bash
cd api
npm install
```

2. Build TypeScript:
```bash
npm run build
```

3. Start Functions locally:
```bash
npm start
```

The API will be available at `http://localhost:7071/api/`

### Build Scripts
- **`npm run build`** - Compile TypeScript to JavaScript
- **`npm run watch`** - Watch mode for development
- **`npm run clean`** - Remove dist/ folder
- **`npm start`** - Start Azure Functions host locally

*Note: Unit tests will be added in a future phase. The current test script is a placeholder.*

## Environment Variables

Functions use these environment variables (set in Azure Portal or local.settings.json):

### Required
- `VITE_AZURE_STORAGE_CONNECTION_STRING` - Azure Table Storage connection string
- `AZURE_WEBPUBSUB_CONNECTION_STRING` - Azure Web PubSub connection string

### Optional
- `VITE_DEV_MODE` - Set to 'true' to bypass authentication (dev only)
- `VITE_ENTRA_CLIENT_ID` - Microsoft Entra External ID client ID
- `VITE_ENTRA_TENANT_ID` - Microsoft Entra External ID tenant ID

Note: Environment variables use `VITE_` prefix for consistency with frontend (Azure Static Web Apps shares environment between frontend and API).

## Authentication

Functions use JWT token validation via Microsoft Entra External ID:

- Extract token from `Authorization: Bearer <token>` header
- Verify signature using JWKS (public keys from Entra)
- Check token expiration and audience
- Extract user ID and email from claims

Dev mode bypasses authentication and returns mock user:
```typescript
if (process.env.VITE_DEV_MODE === 'true') {
  return { authenticated: true, userId: 'dev-user-1', email: 'dev@example.gov.au' };
}
```

## Authorization

Role-based permissions system:

- **admin** - Full permissions (manage routes, members, settings)
- **operator** - Manage routes, start navigation, view members
- **viewer** - View members only

Functions validate:
1. User is authenticated (valid JWT)
2. User has active membership in brigade
3. User's role has required permission for the action

## Deployment

Functions are automatically deployed via GitHub Actions to Azure Static Web Apps:

1. Code pushed to `main` branch
2. GitHub Actions workflow triggers
3. Azure Static Web Apps CLI builds frontend and API
4. Frontend deployed to Azure CDN
5. API Functions deployed to Azure Functions (V4 runtime)
6. Environment variables configured in Azure Portal

The `.funcignore` file ensures only necessary files are deployed:
- Compiled JavaScript (`dist/`)
- `package.json` and `package-lock.json`
- `host.json`
- `.oryxrc` (Node version)

Source TypeScript files, tests, and dev dependencies are excluded.

## Troubleshooting

### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build
```

### Local Testing Issues
```bash
# Check Azure Functions Core Tools version
func --version  # Should be 4.x

# Check Node version
node --version  # Should be 22.x

# View logs
npm start  # Logs appear in terminal
```

### TypeScript Errors
- Check `tsconfig.json` has correct `rootDir: "src"` and `outDir: "dist"`
- Verify all imports are correct
- Run `npm run build` to see type errors

## Resources

- [Azure Functions V4 Programming Model](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node)
- [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/)
- [Azure Table Storage SDK](https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/)
- [Azure Web PubSub](https://learn.microsoft.com/en-us/azure/azure-web-pubsub/)
