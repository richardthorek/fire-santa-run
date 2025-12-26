/**
 * RFS Station Search Component (Example)
 * 
 * Demo component showing how to use the RFS dataset utilities.
 * Can be integrated into brigade onboarding or route planning flows.
 */

import { useState, useEffect } from 'react';
import {
  searchStationsByName,
  findNearestStation,
  getStationsByState,
  getCacheInfo,
  clearCache,
} from '../utils/rfsData';
import type { RFSStation } from '../types/rfs';

export function RFSStationSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [stations, setStations] = useState<RFSStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(getCacheInfo());
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Australian states
  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.warn('Failed to get location:', error);
        }
      );
    }
  }, []);

  // Search by name
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const results = await searchStationsByName(searchQuery, 20);
      setStations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search stations');
    } finally {
      setLoading(false);
    }
  };

  // Filter by state
  const handleStateFilter = async (state: string) => {
    setSelectedState(state);
    setLoading(true);
    setError(null);

    try {
      const results = await getStationsByState(state);
      setStations(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stations');
    } finally {
      setLoading(false);
    }
  };

  // Find nearest station
  const handleFindNearest = async () => {
    if (!userLocation) {
      setError('Location permission required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nearest = await findNearestStation(userLocation, 100);
      setStations(nearest ? [nearest] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find nearest station');
    } finally {
      setLoading(false);
    }
  };

  // Clear cache
  const handleClearCache = () => {
    clearCache();
    setCacheInfo(getCacheInfo());
    setStations([]);
  };

  return (
    <div className="rfs-station-search">
      <h2>RFS Station Search</h2>

      {/* Cache Info */}
      <div className="cache-info">
        <p>
          Cache Status: {cacheInfo.isCached ? 'Cached' : 'Not cached'}
          {cacheInfo.isCached && (
            <>
              {' '}
              ({cacheInfo.stationCount} stations)
              <br />
              Last fetched: {cacheInfo.lastFetched?.toLocaleString()}
            </>
          )}
        </p>
        <button onClick={handleClearCache}>Clear Cache</button>
      </div>

      {/* Search by Name */}
      <div className="search-section">
        <h3>Search by Name</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter station name (e.g., Griffith)"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={loading}>
          Search
        </button>
      </div>

      {/* Filter by State */}
      <div className="state-filter">
        <h3>Filter by State</h3>
        <select 
          value={selectedState} 
          onChange={(e) => handleStateFilter(e.target.value)}
          disabled={loading}
        >
          <option value="">Select a state...</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      {/* Find Nearest */}
      <div className="nearest-section">
        <h3>Find Nearest Station</h3>
        <button onClick={handleFindNearest} disabled={loading || !userLocation}>
          {userLocation ? 'Find Nearest' : 'Location permission required'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && <div className="loading">Loading...</div>}

      {/* Results */}
      {stations.length > 0 && (
        <div className="results">
          <h3>Results ({stations.length})</h3>
          <ul>
            {stations.map((station) => (
              <li key={station.id}>
                <strong>{station.name}</strong>
                <br />
                {station.address && (
                  <>
                    {station.address}
                    <br />
                  </>
                )}
                {station.suburb && `${station.suburb}, `}
                {station.state} {station.postcode}
                <br />
                Coordinates: {station.coordinates[1].toFixed(4)}, {station.coordinates[0].toFixed(4)}
                {station.operationalStatus && (
                  <>
                    <br />
                    Status: {station.operationalStatus}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && stations.length === 0 && searchQuery && (
        <div className="no-results">No stations found</div>
      )}

      <style>{`
        .rfs-station-search {
          max-width: 800px;
          margin: 2rem auto;
          padding: 2rem;
          font-family: system-ui, sans-serif;
        }

        .cache-info {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .search-section,
        .state-filter,
        .nearest-section {
          margin-bottom: 2rem;
        }

        h2 {
          color: #D32F2F;
          margin-bottom: 1rem;
        }

        h3 {
          color: #616161;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        input[type="text"],
        select {
          width: 100%;
          max-width: 400px;
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          margin-right: 0.5rem;
        }

        button {
          background: #D32F2F;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        button:hover:not(:disabled) {
          background: #B71C1C;
        }

        button:disabled {
          background: #e0e0e0;
          cursor: not-allowed;
        }

        .error {
          background: #ffebee;
          color: #c62828;
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: #616161;
        }

        .results ul {
          list-style: none;
          padding: 0;
        }

        .results li {
          background: white;
          border: 2px solid #e0e0e0;
          padding: 1rem;
          margin-bottom: 0.5rem;
          border-radius: 8px;
          line-height: 1.6;
        }

        .no-results {
          text-align: center;
          padding: 2rem;
          color: #616161;
        }
      `}</style>
    </div>
  );
}
