# RFS Station Locations Dataset Integration

## Overview

This document describes the integration of the Rural & Country Fire Service (RFS) Facilities dataset from the Digital Atlas of Australia into the Fire Santa Run application.

## Dataset Information

- **Source**: [Digital Atlas of Australia - Rural & Country Fire Service Facilities](https://digital.atlas.gov.au/datasets/digitalatlas::rural-country-fire-service-facilities/api)
- **API Type**: ArcGIS Feature Service (REST API)
- **Coverage**: All Australian states and territories
- **Update Frequency**: Regularly updated by government agencies
- **License**: Open data (Australian Government)

## Dataset Schema

The dataset includes the following key fields:

| Field | Type | Description |
|-------|------|-------------|
| `OBJECTID` | number | Unique identifier for each facility |
| `FACILITY_NAME` | string | Official name of the fire service facility |
| `FACILITY_ADDRESS` | string | Street address of the facility |
| `FACILITY_STATE` | string | Australian state/territory (NSW, VIC, QLD, etc.) |
| `FACILITY_LAT` | number | Latitude (WGS84) |
| `FACILITY_LONG` | number | Longitude (WGS84) |
| `FACILITY_OPERATIONALSTATUS` | string | Operational status of the facility |
| `ABS_SUBURB` | string | Suburb name |
| `ABS_POSTCODE` | string | Postcode |
| `FACILITY_DATE` | number | Last update timestamp |

## Architecture

### Development Mode (localStorage)

In development mode (`VITE_DEV_MODE=true`), RFS station data is:
1. Fetched directly from the ArcGIS API via the frontend
2. Cached in browser `localStorage` for 7 days
3. Re-fetched automatically when cache expires

### Production Mode (Azure Functions)

In production mode, RFS station data is:
1. Accessed via `/api/rfs-stations` Azure Function
2. Proxied through Azure to avoid CORS issues
3. Cached with HTTP headers for 24 hours
4. Can be optionally stored in Azure Table Storage for faster access

## Usage

### Frontend (TypeScript/React)

```typescript
import { 
  getAllStations, 
  searchStations, 
  findNearestStation,
  searchStationsByName,
  getStationsByState,
} from '@/utils/rfsData';

// Get all stations (cached)
const allStations = await getAllStations();

// Search by name
const stations = await searchStationsByName('Griffith', 10);

// Find nearest station to coordinates
const nearest = await findNearestStation([143.5, -37.5], 50); // [lng, lat], 50km radius

// Search by state
const nswStations = await getStationsByState('NSW');

// Advanced search
const results = await searchStations({
  state: 'VIC',
  suburb: 'Melbourne',
  nearLocation: {
    coordinates: [144.9631, -37.8136],
    radiusKm: 25,
  },
  limit: 20,
});
```

### API Endpoint

**Endpoint**: `GET /api/rfs-stations`

**Query Parameters**:
- `state` (optional): Filter by Australian state (e.g., NSW, VIC, QLD)
- `name` (optional): Search by station name (partial match)
- `suburb` (optional): Filter by suburb
- `postcode` (optional): Filter by postcode
- `lat`, `lng`, `radius` (optional): Find stations near location (radius in km)
- `limit` (optional): Max number of results (default: 100)

**Example Requests**:

```bash
# Get stations in Victoria
curl "https://your-app.azurestaticapps.net/api/rfs-stations?state=VIC&limit=50"

# Search by name
curl "https://your-app.azurestaticapps.net/api/rfs-stations?name=Griffith"

# Find stations near coordinates
curl "https://your-app.azurestaticapps.net/api/rfs-stations?lat=-37.5&lng=143.5&radius=50&limit=10"
```

**Response Format**:

```json
{
  "stations": [
    {
      "id": 1234,
      "name": "Griffith Rural Fire Service",
      "address": "123 Main Street",
      "state": "NSW",
      "suburb": "Griffith",
      "postcode": "2680",
      "coordinates": [146.0396, -34.2873],
      "operationalStatus": "Operational",
      "lastUpdated": "2024-01-15T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

## Caching Strategy

### Why Caching?

The RFS dataset contains thousands of records. Fetching on every page load would be slow and wasteful. Our caching strategy ensures:
- Fast lookups (< 50ms after initial load)
- Reduced API calls
- Offline capability (in dev mode)
- Lower bandwidth usage

### Cache Configuration

- **Cache Duration**: 7 days (development), 24 hours (API responses)
- **Cache Key**: `rfs-stations-cache`
- **Cache Version**: `1.0.0` (incremented when schema changes)
- **Storage**: `localStorage` (dev mode) or HTTP cache (production)

### Cache Management

```typescript
import { clearCache, getCacheInfo } from '@/utils/rfsData';

// Check cache status
const info = getCacheInfo();
console.log(info);
// { isCached: true, lastFetched: Date, stationCount: 2500 }

// Clear cache (forces re-fetch)
clearCache();
```

## Integration Points

### 1. Brigade Onboarding

When creating a new brigade, suggest station names based on location:

```typescript
import { findNearestStation } from '@/utils/rfsData';

async function suggestBrigadeName(userLocation: [number, number]) {
  const station = await findNearestStation(userLocation, 50);
  if (station) {
    return station.name; // e.g., "Griffith Rural Fire Service"
  }
  return null;
}
```

### 2. Route Planning

Set default map center based on brigade's station location:

```typescript
import { searchStationsByName } from '@/utils/rfsData';

async function getDefaultMapCenter(brigadeName: string) {
  const stations = await searchStationsByName(brigadeName, 1);
  if (stations.length > 0) {
    return stations[0].coordinates; // [lng, lat]
  }
  return [133.7751, -25.2744]; // Default: center of Australia
}
```

### 3. Brigade Discovery

Show nearby brigades to users based on their location:

```typescript
import { searchStations } from '@/utils/rfsData';

async function findNearbyBrigades(userLocation: [number, number]) {
  return await searchStations({
    nearLocation: {
      coordinates: userLocation,
      radiusKm: 100,
    },
    limit: 10,
  });
}
```

## Performance Considerations

### Initial Load Time

- **First visit**: ~2-5 seconds to fetch and cache all stations (typically 2000-3000 records)
- **Subsequent visits**: < 50ms (loaded from cache)

### Data Size

- Full dataset: ~500KB - 1MB JSON (compressed)
- Each station record: ~200-300 bytes

### Optimization Tips

1. **Lazy Loading**: Only fetch when needed (e.g., when user opens brigade search)
2. **Progressive Loading**: Show results as they're fetched (pagination)
3. **Preloading**: Start fetch in background on app load
4. **Indexed Search**: Use Map/Set for O(1) lookups if searching frequently

```typescript
// Example: Preload on app initialization
import { getAllStations } from '@/utils/rfsData';

// Start loading in background
getAllStations().catch(err => {
  console.warn('Failed to preload RFS stations:', err);
});
```

## Testing

### Development Mode Testing

```bash
# Start dev server
npm run dev

# Open browser console
const { getAllStations } = await import('/src/utils/rfsData.ts');
const stations = await getAllStations();
console.log(`Loaded ${stations.length} stations`);
```

### API Testing (Production)

```bash
# Test API endpoint locally
cd api
npm start

# In another terminal
curl "http://localhost:7071/api/rfs-stations?state=NSW&limit=5"
```

## Troubleshooting

### Cache Issues

If cached data seems stale or corrupted:

```typescript
import { clearCache } from '@/utils/rfsData';
clearCache();
location.reload();
```

### API Errors

Check browser console for errors. Common issues:
- Network connectivity
- CORS (use API proxy in production)
- Rate limiting (should not occur with caching)

### Empty Results

If searches return no results:
- Check state abbreviations (use uppercase: NSW, VIC, not nsw, vic)
- Verify coordinates are in correct format: [longitude, latitude]
- Check radius is reasonable (50-100km for rural areas)

## Future Enhancements

Potential improvements for future phases:

1. **Azure Table Storage**: Store preprocessed data in Table Storage for faster queries
2. **Fuzzy Search**: Add fuzzy string matching for typo tolerance
3. **Geocoding**: Reverse geocode user location to find state automatically
4. **Brigade Verification**: Cross-reference user's brigade claim with station data
5. **Analytics**: Track which stations/brigades are most active
6. **Offline Support**: PWA with IndexedDB for full offline capability

## References

- [ArcGIS REST API Documentation](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service/)
- [Digital Atlas Dataset](https://digital.atlas.gov.au/datasets/digitalatlas::rural-country-fire-service-facilities/about)
- [Haversine Formula (distance calculation)](https://en.wikipedia.org/wiki/Haversine_formula)
