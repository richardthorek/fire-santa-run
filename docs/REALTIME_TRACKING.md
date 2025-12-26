# Real-Time Tracking Quick Reference

## Overview
Phase 4 implements real-time Santa tracking using Azure Web PubSub for production and BroadcastChannel API for local development.

## Key Files

### Backend (API)
- `api/src/negotiate.ts` - Generate Web PubSub connection tokens
- `api/src/broadcast.ts` - Broadcast location updates to viewers

### Frontend (React)
- `src/hooks/useWebPubSub.ts` - Web PubSub connection management
- `src/hooks/useLocationBroadcast.ts` - Location broadcasting with throttling
- `src/pages/TrackingView.tsx` - Public tracking page
- `src/pages/NavigationView.tsx` - Navigator with location broadcasting

### Types
- `src/types/index.ts` - `LocationBroadcast` interface

## Environment Variables

### Development Mode (.env.local)
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_API_BASE_URL=http://localhost:7071/api
```

### Production Mode
```bash
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_API_BASE_URL=https://your-site.azurestaticapps.net/api
AZURE_WEBPUBSUB_CONNECTION_STRING=Endpoint=...;AccessKey=...;Version=1.0;
```

## API Endpoints

### GET/POST /api/negotiate
Generate Web PubSub connection token.

**Query Parameters:**
- `routeId` (required) - Route ID to connect to
- `role` (optional) - `viewer` (default) or `broadcaster`

**Response:**
```json
{
  "url": "wss://...",
  "role": "viewer",
  "routeId": "route-123",
  "groupName": "route_route-123"
}
```

### POST /api/broadcast
Broadcast location update to viewers.

**Body:**
```json
{
  "routeId": "route-123",
  "location": [151.2093, -33.8688],
  "timestamp": 1703577600000,
  "heading": 45,
  "speed": 5.5,
  "currentWaypointIndex": 2,
  "nextWaypointEta": "5 min"
}
```

## Usage Examples

### Navigator: Broadcast Location
```typescript
import { useLocationBroadcast } from '@/hooks';

// In NavigationView or similar component
const { isConnected } = useLocationBroadcast({
  routeId: route.id,
  position: currentPosition,
  routeProgress: {
    currentWaypointIndex: 2,
    completedWaypoints: ['wp-1', 'wp-2'],
  },
  isNavigating: true,
  nextWaypointEta: '5 min',
});

// Broadcasts automatically every 5 seconds while isNavigating is true
```

### Viewer: Receive Location Updates
```typescript
import { useWebPubSub } from '@/hooks';

const { isConnected, error } = useWebPubSub({
  routeId: 'route-123',
  role: 'viewer',
  onLocationUpdate: (location) => {
    console.log('Santa is at:', location.location);
    // Update map marker, etc.
  },
});
```

### Manual Send (Broadcaster)
```typescript
import { useWebPubSub } from '@/hooks';

const { sendLocation, isConnected } = useWebPubSub({
  routeId: 'route-123',
  role: 'broadcaster',
});

// Send location update
await sendLocation({
  routeId: 'route-123',
  location: [151.2093, -33.8688],
  timestamp: Date.now(),
  heading: 45,
  speed: 5.5,
});
```

## Dev Mode (BroadcastChannel API)

In development mode (`VITE_DEV_MODE=true`), the system uses BroadcastChannel API instead of Azure Web PubSub. This allows testing real-time features across browser tabs without Azure dependencies.

**How it works:**
1. Navigator creates a BroadcastChannel: `santa-tracking-{routeId}`
2. Navigator posts location messages to the channel
3. Viewers listen to the same channel in other tabs
4. Messages are delivered instantly within the same browser

**Benefits:**
- No Azure setup required for development
- Instant local testing
- No network latency
- Free and unlimited

**Limitations:**
- Only works within same browser/device
- Requires multiple tabs to test multi-viewer
- No cross-device testing

## Production Mode (Azure Web PubSub)

In production mode (`VITE_DEV_MODE=false`), the system uses Azure Web PubSub for real-time communication.

**How it works:**
1. Viewer/Navigator calls `/api/negotiate` to get connection token
2. Client establishes WebSocket connection to Azure Web PubSub
3. Client joins route-specific group: `route_{routeId}`
4. Navigator sends location to `/api/broadcast`
5. API function broadcasts to Web PubSub group
6. All viewers in the group receive the update

**Benefits:**
- Cross-device real-time updates
- Scalable to 1000+ concurrent viewers
- Managed reconnection and reliability
- Global Azure infrastructure

**Requirements:**
- Azure Web PubSub resource created
- Connection string configured
- API functions deployed

## Connection Status

The connection status indicator shows:
- 🟢 **Green (Connected):** Real-time updates active
- 🟠 **Orange (Connecting):** Establishing connection
- 🔴 **Red (Disconnected):** Connection lost or failed

Auto-reconnection attempts up to 5 times with 3-second delays.

## Routes

- **Navigator:** `/routes/:id/navigate` - Brigade operator navigation view
- **Public Tracking:** `/track/:id` - Public viewer tracking page
- **Dashboard:** `/dashboard` - Route management (authenticated)

## Troubleshooting

### Dev Mode: Location not updating in viewer tab
- Ensure both tabs are from same origin (same protocol, domain, port)
- Check browser console for BroadcastChannel messages
- Verify `VITE_DEV_MODE=true` in environment

### Production: Connection fails
- Verify `AZURE_WEBPUBSUB_CONNECTION_STRING` is set correctly
- Check Azure Web PubSub resource is running
- Verify `santa-tracking` hub exists
- Check browser console for connection errors
- Verify API functions are deployed and accessible

### Location not broadcasting
- Check navigator has location permissions granted
- Verify navigation is started (`isNavigating: true`)
- Check 5-second throttle interval
- Look for "Broadcasted location" logs in console

### Viewer not receiving updates
- Verify navigator is broadcasting (check navigator console)
- Check viewer connection status (should be green)
- Verify route IDs match between navigator and viewer
- Check for WebSocket connection errors

## Performance Tips

### Reduce Bandwidth
- Increase broadcast interval (default: 5 seconds)
- Reduce location update precision
- Implement dead reckoning for viewer-side prediction

### Improve Latency
- Use Azure region closest to users
- Enable WebSocket compression
- Optimize message payload size

### Scale to More Viewers
- Upgrade to Standard tier Web PubSub
- Add multiple units for more connections
- Implement message batching if needed

## Security Notes

- **Public Tracking:** No authentication required (by design for public viewing)
- **Token Expiration:** Tokens expire after 2 hours
- **Rate Limiting:** Frontend throttles to 5-second intervals
- **Permissions:** Viewers are read-only, broadcasters can only send to their route
- **Future:** Consider adding API-level rate limiting for production

## Testing Checklist

- [ ] Navigator broadcasts location in dev mode
- [ ] Viewer receives updates in dev mode
- [ ] Multiple viewers receive updates simultaneously
- [ ] Connection auto-reconnects after interruption
- [ ] Navigator broadcasts in production mode (with Azure)
- [ ] Viewer receives updates in production mode
- [ ] Map updates smoothly with animations
- [ ] Connection status indicator works correctly
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Network interruption recovery

## Resources

- [Azure Web PubSub Documentation](https://learn.microsoft.com/en-us/azure/azure-web-pubsub/)
- [BroadcastChannel API MDN](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- MASTER_PLAN.md Section 6: Real-Time Tracking System
- MASTER_PLAN.md Section 22a: Azure Web PubSub Setup Instructions
