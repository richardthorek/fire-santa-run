# Backend API Architecture

## Overview

The Fire Santa Run application uses a **serverless architecture** with Azure Static Web Apps and Azure Functions. This document explains how the backend API is structured and how the frontend communicates with it.

## Architecture Pattern

```
┌─────────────────┐         ┌──────────────────┐         ┌───────────────────┐
│   Browser       │  HTTP   │  Azure Functions │  SDK    │  Azure Table      │
│   (React SPA)   │────────→│  (Node.js API)   │────────→│  Storage          │
│                 │         │                  │         │                   │
│  HttpStorage    │         │  routes.ts       │         │  routes table     │
│  Adapter        │         │  brigades.ts     │         │  brigades table   │
└─────────────────┘         └──────────────────┘         └───────────────────┘
```

**Key Principle:** The browser **never** communicates directly with Azure Table Storage. All storage operations go through the API.

## Why This Architecture?

### Problem
- Azure Table Storage SDK (`@azure/data-tables`) is **Node.js-only**
- Cannot run in browser due to dependency on Node.js crypto modules
- Attempting to use it in browser causes runtime errors

### Solution
- **Backend (Azure Functions):** Uses Azure SDK to interact with Table Storage
- **Frontend (Browser):** Uses HTTP adapter to call API endpoints
- **Dev Mode:** Uses localStorage for rapid development (no API needed)

## API Endpoints

### Routes API

Base path: `/api/routes`

| Method | Endpoint | Query Params | Body | Description |
|--------|----------|--------------|------|-------------|
| GET | `/api/routes` | `brigadeId` | - | List all routes for a brigade |
| GET | `/api/routes/{id}` | `brigadeId` | - | Get single route |
| POST | `/api/routes` | - | Route JSON | Create new route |
| PUT | `/api/routes/{id}` | - | Route JSON | Update existing route |
| DELETE | `/api/routes/{id}` | `brigadeId` | - | Delete route |

**Example Request:**
```typescript
// Get all routes for a brigade
const response = await fetch('/api/routes?brigadeId=penrith-rfs');
const routes = await response.json();

// Create a new route
const response = await fetch('/api/routes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'route-123',
    brigadeId: 'penrith-rfs',
    name: 'Summer Creek Route 2024',
    // ... other route fields
  })
});
```

### Brigades API

Base path: `/api/brigades`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brigades` | List all brigades |
| GET | `/api/brigades/{id}` | Get single brigade |
| POST | `/api/brigades` | Create new brigade |
| PUT | `/api/brigades/{id}` | Update existing brigade |
| DELETE | `/api/brigades/{id}` | Delete brigade |

**Example Request:**
```typescript
// Get a specific brigade
const response = await fetch('/api/brigades/penrith-rfs');
const brigade = await response.json();
```

### Real-Time API

Already implemented in previous phases:

- `/api/negotiate` - Generate Web PubSub connection token
- `/api/broadcast` - Broadcast location updates
- `/api/rfs-stations` - Search RFS stations

## Frontend Storage Adapters

### HttpStorageAdapter (Production)

Located: `src/storage/http.ts`

Used when `VITE_DEV_MODE=false`. Calls API endpoints over HTTP.

```typescript
class HttpStorageAdapter implements IStorageAdapter {
  async getRoutes(brigadeId: string): Promise<Route[]> {
    const response = await fetch(`/api/routes?brigadeId=${brigadeId}`);
    return await response.json();
  }
  
  async saveRoute(brigadeId: string, route: Route): Promise<void> {
    // Determines if create or update, then calls appropriate endpoint
  }
  
  // ... other methods
}
```

### LocalStorageAdapter (Development)

Located: `src/storage/localStorage.ts`

Used when `VITE_DEV_MODE=true`. Stores data in browser's localStorage for rapid development.

```typescript
class LocalStorageAdapter implements IStorageAdapter {
  async getRoutes(brigadeId: string): Promise<Route[]> {
    const data = localStorage.getItem('routes') || '[]';
    return JSON.parse(data).filter(r => r.brigadeId === brigadeId);
  }
  
  // ... other methods
}
```

### Adapter Selection

Located: `src/storage/index.ts`

```typescript
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (isDevMode) {
    return new LocalStorageAdapter(); // Dev: fast, no API needed
  } else {
    return new HttpStorageAdapter('/api'); // Prod: calls backend
  }
}

export const storageAdapter = createStorageAdapter();
```

## Backend Implementation

### Routes API (`api/src/routes.ts`)

```typescript
import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

const STORAGE_CONNECTION_STRING = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
const ROUTES_TABLE = 'routes';

function getTableClient(): TableClient {
  return TableClient.fromConnectionString(
    STORAGE_CONNECTION_STRING,
    ROUTES_TABLE
  );
}

async function getRoutes(request: HttpRequest): Promise<HttpResponseInit> {
  const brigadeId = request.query.get('brigadeId');
  const client = getTableClient();
  
  const entities = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${brigadeId}'` }
  });
  
  const routes = [];
  for await (const entity of entities) {
    routes.push(entityToRoute(entity)); // Convert to Route object
  }
  
  return { status: 200, jsonBody: routes };
}

// Register endpoints
app.http('routes-list', {
  methods: ['GET'],
  route: 'routes',
  handler: getRoutes
});
```

### Key Points

1. **Environment Variables:** API functions read from `process.env`
2. **Table Naming:** Dev mode uses 'devroutes', production uses 'routes'
3. **Partition Key:** All routes for a brigade use `brigadeId` as partition key
4. **Row Key:** Route ID is used as row key
5. **JSON Serialization:** Complex fields (waypoints, geometry) stored as JSON strings

## Data Flow Examples

### Creating a Route

```
1. User fills out route form in browser
2. React calls: storageAdapter.saveRoute(brigadeId, route)
3. HttpStorageAdapter: POST /api/routes (with route JSON)
4. Azure Function receives request
5. Function validates data
6. Function calls TableClient.createEntity()
7. Data written to Azure Table Storage
8. Function returns success response
9. Frontend updates UI
```

### Listing Routes

```
1. Dashboard component loads
2. React calls: storageAdapter.getRoutes(brigadeId)
3. HttpStorageAdapter: GET /api/routes?brigadeId=xxx
4. Azure Function receives request
5. Function queries TableClient.listEntities()
6. Function converts entities to Route objects
7. Function returns JSON array
8. Frontend renders route list
```

## Environment Configuration

### Development Mode

`.env.local`:
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
# No Azure variables needed - uses localStorage
```

### Production Mode

Static Web App Configuration (Azure Portal):
```bash
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_WEBPUBSUB_CONNECTION_STRING=Endpoint=https://...
```

## Security Considerations

### Current (Pre-Authentication)

- ⚠️ API endpoints have `authLevel: 'anonymous'`
- ⚠️ Anyone can call the API (acceptable for MVP)
- ✅ CORS handled by Static Web Apps
- ✅ HTTPS enforced in production

### Future (Phase 7 - Authentication)

Will be updated to:
- 🔒 `authLevel: 'function'` with JWT validation
- 🔒 Brigade ID validated against user's token
- 🔒 Role-based access control (admin, operator, viewer)
- 🔒 Audit logging of all operations

## Testing the API

### Local Development

1. Start API functions:
```bash
cd api
npm install
npm run build
npm start
```

2. Start frontend:
```bash
cd ..
npm run dev
```

3. API runs on `http://localhost:7071`
4. Frontend proxies `/api/*` to API server

### Production

API functions automatically deployed with Static Web App:
- Frontend: `https://your-app.azurestaticapps.net`
- API: `https://your-app.azurestaticapps.net/api/*`

## Debugging

### Enable Debug Logging

Add to API function:
```typescript
context.log('Request received:', {
  method: request.method,
  url: request.url,
  brigadeId: request.query.get('brigadeId')
});
```

View logs in Azure Portal → Function App → Log Stream

### Common Issues

**Issue:** "Route not found" errors  
**Solution:** Check partitionKey matches brigadeId exactly

**Issue:** JSON parse errors  
**Solution:** Verify data written to Table Storage is valid JSON

**Issue:** CORS errors  
**Solution:** Ensure Static Web App configuration includes API routes

## Performance Considerations

### Caching

Currently: No caching (every request hits database)

Future improvements:
- Response caching in Azure CDN
- In-memory cache in Azure Functions (with TTL)
- Client-side caching with React Query

### Pagination

Current: Returns all routes for a brigade (fine for MVP)

Future: Add pagination for brigades with 100+ routes
```typescript
GET /api/routes?brigadeId=xxx&page=1&perPage=20
```

## Related Documentation

- [Storage Adapter Pattern](../MASTER_PLAN.md#12-data-model--storage-strategy)
- [Azure Functions Guide](https://learn.microsoft.com/en-us/azure/azure-functions/)
- [Azure Table Storage SDK](https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/)
- [Static Web Apps API](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview)

## Summary

✅ **Correct Architecture:** Browser → API → Database  
✅ **Dev Friendly:** localStorage for rapid development  
✅ **Production Ready:** Serverless, auto-scaling API  
✅ **Type Safe:** TypeScript end-to-end  
✅ **Maintainable:** Clear separation of concerns  

The backend API architecture now follows Azure Static Web Apps best practices and serverless patterns.
