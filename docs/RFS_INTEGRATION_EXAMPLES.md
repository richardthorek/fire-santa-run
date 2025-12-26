# RFS Dataset Integration Examples

This document provides practical code examples for integrating the RFS station locations dataset into various parts of the Fire Santa Run application.

## Example 1: Brigade Onboarding with Station Suggestions

Show suggested brigade names based on user's location during onboarding:

```typescript
import { useState, useEffect } from 'react';
import { findNearestStation, searchStationsByName } from '@/utils/rfsData';
import type { RFSStation } from '@/types/rfs';

export function BrigadeOnboarding() {
  const [brigadeName, setBrigadeName] = useState('');
  const [suggestions, setSuggestions] = useState<RFSStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<RFSStation | null>(null);

  // Auto-suggest based on user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const coords: [number, number] = [
          position.coords.longitude,
          position.coords.latitude
        ];
        
        const nearest = await findNearestStation(coords, 50);
        if (nearest) {
          setSuggestions([nearest]);
        }
      });
    }
  }, []);

  // Search as user types
  const handleNameChange = async (name: string) => {
    setBrigadeName(name);
    
    if (name.length >= 3) {
      const results = await searchStationsByName(name, 5);
      setSuggestions(results);
    }
  };

  // Select a suggestion
  const handleSelectStation = (station: RFSStation) => {
    setSelectedStation(station);
    setBrigadeName(station.name);
  };

  return (
    <div>
      <h2>Create Your Brigade</h2>
      
      <input
        type="text"
        value={brigadeName}
        onChange={(e) => handleNameChange(e.target.value)}
        placeholder="Brigade name"
      />

      {suggestions.length > 0 && (
        <div className="suggestions">
          <p>Suggested brigades:</p>
          <ul>
            {suggestions.map((station) => (
              <li key={station.id} onClick={() => handleSelectStation(station)}>
                {station.name}
                <br />
                <small>{station.suburb}, {station.state}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedStation && (
        <div className="selected-details">
          <h3>Brigade Details</h3>
          <p><strong>Location:</strong> {selectedStation.suburb}, {selectedStation.state}</p>
          <p><strong>Address:</strong> {selectedStation.address}</p>
          <p><strong>Coordinates:</strong> {selectedStation.coordinates.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
```

## Example 2: Set Default Map Center for Brigade

Automatically center the map on the brigade's station location when planning routes:

```typescript
import { useEffect, useState } from 'react';
import { searchStationsByName } from '@/utils/rfsData';
import type { Map } from 'mapbox-gl';

export function RouteMap({ brigadeName }: { brigadeName: string }) {
  const [map, setMap] = useState<Map | null>(null);
  const [center, setCenter] = useState<[number, number]>([133.7751, -25.2744]); // Default: Australia center

  // Get brigade's station location
  useEffect(() => {
    async function loadBrigadeLocation() {
      const stations = await searchStationsByName(brigadeName, 1);
      if (stations.length > 0) {
        const coords = stations[0].coordinates;
        setCenter(coords);
        
        // Fly to the brigade location if map is initialized
        if (map) {
          map.flyTo({ center: coords, zoom: 12 });
        }
      }
    }

    if (brigadeName) {
      loadBrigadeLocation();
    }
  }, [brigadeName, map]);

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '600px' }} />
      <p>Map centered on: {brigadeName}</p>
    </div>
  );
}
```

## Example 3: Nearby Brigades Discovery

Show users brigades near their location on a public page:

```typescript
import { useState, useEffect } from 'react';
import { searchStations } from '@/utils/rfsData';
import type { RFSStation } from '@/types/rfs';

export function NearbyBrigades() {
  const [nearbyStations, setNearbyStations] = useState<RFSStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNearby() {
      if (!navigator.geolocation) {
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];

          const stations = await searchStations({
            nearLocation: { coordinates: coords, radiusKm: 100 },
            limit: 10,
          });

          setNearbyStations(stations);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    }

    loadNearby();
  }, []);

  if (loading) return <div>Loading nearby brigades...</div>;

  return (
    <div>
      <h2>Fire Brigades Near You</h2>
      {nearbyStations.length === 0 ? (
        <p>No brigades found nearby. Enable location to see results.</p>
      ) : (
        <ul>
          {nearbyStations.map((station) => (
            <li key={station.id}>
              <h3>{station.name}</h3>
              <p>{station.suburb}, {station.state} {station.postcode}</p>
              <a href={`/brigade/${station.id}`}>View Santa runs</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## Example 4: Brigade Verification

Verify a user's brigade claim against the official dataset:

```typescript
import { searchStationsByName } from '@/utils/rfsData';

export async function verifyBrigadeName(userInput: string): Promise<{
  isValid: boolean;
  suggestion?: string;
  exactMatch?: boolean;
}> {
  // Search for stations matching the input
  const stations = await searchStationsByName(userInput, 5);

  if (stations.length === 0) {
    return { isValid: false };
  }

  // Check for exact match (case-insensitive)
  const exactMatch = stations.find(
    s => s.name.toLowerCase() === userInput.toLowerCase()
  );

  if (exactMatch) {
    return { isValid: true, exactMatch: true, suggestion: exactMatch.name };
  }

  // Suggest closest match
  return {
    isValid: false,
    exactMatch: false,
    suggestion: stations[0].name,
  };
}

// Usage in form validation
async function handleBrigadeSubmit(name: string) {
  const verification = await verifyBrigadeName(name);

  if (!verification.isValid) {
    alert(`Brigade not found. Did you mean "${verification.suggestion}"?`);
    return;
  }

  // Proceed with brigade creation
  console.log('Brigade verified:', name);
}
```

## Example 5: Filter Stations by State

Show a state selector and filter stations:

```typescript
import { useState } from 'react';
import { getStationsByState } from '@/utils/rfsData';
import type { RFSStation } from '@/types/rfs';

export function StateBrigadeList() {
  const [selectedState, setSelectedState] = useState('NSW');
  const [stations, setStations] = useState<RFSStation[]>([]);

  const states = [
    { code: 'NSW', name: 'New South Wales' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'SA', name: 'South Australia' },
    { code: 'WA', name: 'Western Australia' },
    { code: 'TAS', name: 'Tasmania' },
    { code: 'NT', name: 'Northern Territory' },
    { code: 'ACT', name: 'Australian Capital Territory' },
  ];

  const handleStateChange = async (stateCode: string) => {
    setSelectedState(stateCode);
    const results = await getStationsByState(stateCode);
    setStations(results);
  };

  return (
    <div>
      <h2>Browse Brigades by State</h2>

      <select value={selectedState} onChange={(e) => handleStateChange(e.target.value)}>
        {states.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>

      <div className="brigade-list">
        <p>{stations.length} brigades found in {selectedState}</p>
        {stations.map((station) => (
          <div key={station.id} className="brigade-card">
            <h3>{station.name}</h3>
            <p>{station.suburb || 'Unknown suburb'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Example 6: Preload Data on App Initialization

Preload the RFS dataset in the background when the app starts:

```typescript
// src/main.tsx or App.tsx
import { useEffect } from 'react';
import { getAllStations } from '@/utils/rfsData';

export function App() {
  useEffect(() => {
    // Start loading RFS data in background
    // This ensures it's cached for later use
    getAllStations()
      .then((stations) => {
        console.log(`Preloaded ${stations.length} RFS stations`);
      })
      .catch((error) => {
        console.warn('Failed to preload RFS stations:', error);
        // Non-critical, continue app initialization
      });
  }, []);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}
```

## Example 7: Show Distance to Nearest Station

Calculate and display distance from user's location to nearest station:

```typescript
import { findNearestStation } from '@/utils/rfsData';

function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function showNearestStationWithDistance() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async (position) => {
    const userCoords: [number, number] = [
      position.coords.longitude,
      position.coords.latitude
    ];

    const station = await findNearestStation(userCoords, 100);

    if (station) {
      const distance = calculateDistance(userCoords, station.coordinates);
      console.log(`Nearest station: ${station.name}`);
      console.log(`Distance: ${distance.toFixed(1)} km`);
    }
  });
}
```

## Testing Notes

All examples can be tested in development mode without needing production Azure resources:

1. The RFS data utilities work with `VITE_DEV_MODE=true`
2. Data is cached in localStorage for fast subsequent loads
3. No authentication required for testing

## See Also

- [RFS_DATASET.md](./RFS_DATASET.md) - Complete API reference
- [MASTER_PLAN.md](../MASTER_PLAN.md) - Section 12a for data model
- [DEV_MODE.md](./DEV_MODE.md) - Development mode guide
