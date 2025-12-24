# API Functions

This directory contains Azure Functions for the Fire Santa Run backend.

## Structure

```
api/
├── README.md           # This file
├── host.json           # Azure Functions host configuration
├── package.json        # API dependencies
├── tsconfig.json       # TypeScript configuration for API
└── functions/          # Individual function implementations (to be added)
```

## Development Mode

In development mode (`VITE_DEV_MODE=true`), the frontend uses localStorage and mocks, so Azure Functions are not required for local development.

## Production Mode

In production mode (`VITE_DEV_MODE=false`), Azure Functions provide:
- WebSocket connection negotiation for Azure Web PubSub
- Storage operations for Azure Table Storage
- Authentication validation
- Route sharing and tracking APIs

## Setup (Phase 7+)

Azure Functions will be implemented in Phase 7 when authentication and production deployment are configured.

### Planned Functions

1. **negotiate** - WebSocket connection negotiation for Azure Web PubSub
2. **broadcast-location** - Broadcast Santa location updates
3. **get-route** - Fetch route details for public tracking
4. **save-route** - Save route data to Azure Table Storage
5. **get-brigade** - Fetch brigade information

## Local Testing

To test Azure Functions locally (when implemented):

```bash
cd api
npm install
npm start  # Uses Azure Functions Core Tools
```

## Deployment

Azure Functions are automatically deployed via GitHub Actions to Azure Static Web Apps when code is pushed to the `main` branch.
