/**
 * RFS Station Data Service
 * 
 * Provides access to Rural & Country Fire Service Facilities dataset
 * from Digital Atlas of Australia with caching for performance.
 */

import type {
  RFSStation,
  RFSStationQuery,
  RFSFeatureServiceResponse,
  RFSStationFeature,
  RFSDatasetCache,
} from '../types/rfs';

// ArcGIS REST API endpoint for RFS facilities
// Using Geoscience Australia's Emergency Management Facilities MapServer
const RFS_API_BASE = 'https://services.ga.gov.au/gis/rest/services/Emergency_Management_Facilities/MapServer/4';

// Cache configuration
const CACHE_KEY = 'rfs-stations-cache';
const CACHE_VERSION = '1.1.0'; // Updated for new API endpoint
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Convert ArcGIS feature to simplified RFS station format
 */
function convertFeatureToStation(feature: RFSStationFeature): RFSStation {
  const { attributes, geometry } = feature;
  const id = attributes.objectid ?? attributes.OBJECTID ?? 0;
  const name = attributes.facility_name ?? attributes.FACILITY_NAME ?? '';
  const state = attributes.facility_state ?? attributes.FACILITY_STATE ?? '';
  const dateValue = attributes.facility_date ?? attributes.FACILITY_DATE;
  
  return {
    id,
    name,
    address: attributes.facility_address ?? attributes.FACILITY_ADDRESS,
    state,
    suburb: attributes.abs_suburb ?? attributes.ABS_SUBURB,
    postcode: attributes.abs_postcode ?? attributes.ABS_POSTCODE,
    coordinates: [geometry.x, geometry.y], // [lng, lat]
    operationalStatus: attributes.facility_operationalstatus ?? attributes.FACILITY_OPERATIONALSTATUS,
    lastUpdated: dateValue ? new Date(dateValue) : undefined,
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
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

/**
 * Load cached RFS stations from localStorage
 */
function loadCache(): RFSDatasetCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data: RFSDatasetCache = JSON.parse(cached);
    
    // Check cache validity
    const now = Date.now();
    const isExpired = (now - data.lastFetched) > CACHE_DURATION_MS;
    const isWrongVersion = data.version !== CACHE_VERSION;
    
    if (isExpired || isWrongVersion) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to load RFS cache:', error);
    return null;
  }
}

/**
 * Save RFS stations to localStorage cache
 */
function saveCache(stations: RFSStation[]): void {
  try {
    const cache: RFSDatasetCache = {
      stations,
      lastFetched: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save RFS cache:', error);
  }
}

/**
 * Fetch all RFS stations from the API
 * This may require pagination if dataset is large
 */
async function fetchAllStations(): Promise<RFSStation[]> {
  const allStations: RFSStation[] = [];
  let offset = 0;
  const pageSize = 1000; // Max records per request
  let hasMore = true;
  
  while (hasMore) {
    const params = new URLSearchParams({
      where: '1=1', // Get all records
      outFields: 'objectid,facility_name,facility_address,facility_state,facility_lat,facility_long,facility_operationalstatus,abs_suburb,abs_postcode,facility_date',
      returnGeometry: 'true',
      outSR: '4326', // WGS84 coordinate system
      f: 'json',
      resultOffset: offset.toString(),
      resultRecordCount: pageSize.toString(),
    });
    
    const url = `${RFS_API_BASE}/query?${params.toString()}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data: RFSFeatureServiceResponse = await response.json();
      
      if (data.features && data.features.length > 0) {
        const stations = data.features.map(convertFeatureToStation);
        allStations.push(...stations);
        offset += pageSize;
        
        // Check if we've received all records
        if (data.features.length < pageSize || data.exceededTransferLimit === false) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error('Failed to fetch RFS stations:', error);
      throw error;
    }
  }
  
  return allStations;
}

/**
 * Get all RFS stations (with caching)
 * Returns cached data if available, otherwise fetches from API
 */
export async function getAllStations(): Promise<RFSStation[]> {
  // Try to load from cache first
  const cached = loadCache();
  if (cached) {
    console.log(`Loaded ${cached.stations.length} RFS stations from cache`);
    return cached.stations;
  }
  
  // Fetch from API
  console.log('Fetching RFS stations from API...');
  const stations = await fetchAllStations();
  
  // Save to cache
  saveCache(stations);
  console.log(`Fetched and cached ${stations.length} RFS stations`);
  
  return stations;
}

/**
 * Search RFS stations based on query criteria
 */
export async function searchStations(query: RFSStationQuery): Promise<RFSStation[]> {
  const allStations = await getAllStations();
  let results = allStations;
  
  // Filter by state
  if (query.state) {
    const stateUpper = query.state.toUpperCase();
    results = results.filter(s => s.state.toUpperCase() === stateUpper);
  }
  
  // Filter by suburb
  if (query.suburb) {
    const suburbLower = query.suburb.toLowerCase();
    results = results.filter(s => 
      s.suburb?.toLowerCase().includes(suburbLower)
    );
  }
  
  // Filter by postcode
  if (query.postcode) {
    results = results.filter(s => s.postcode === query.postcode);
  }
  
  // Filter by name (partial match)
  if (query.name) {
    const nameLower = query.name.toLowerCase();
    results = results.filter(s => 
      s.name.toLowerCase().includes(nameLower)
    );
  }
  
  // Filter by proximity
  if (query.nearLocation) {
    const { coordinates, radiusKm = 50 } = query.nearLocation;
    results = results.filter(s => {
      const distance = calculateDistance(coordinates, s.coordinates);
      return distance <= radiusKm;
    });
    
    // Sort by distance
    results.sort((a, b) => {
      const distA = calculateDistance(coordinates, a.coordinates);
      const distB = calculateDistance(coordinates, b.coordinates);
      return distA - distB;
    });
  }
  
  // Apply limit
  if (query.limit && query.limit > 0) {
    results = results.slice(0, query.limit);
  }
  
  return results;
}

/**
 * Find the nearest RFS station to a given location
 */
export async function findNearestStation(
  coordinates: [number, number],
  maxDistanceKm: number = 100
): Promise<RFSStation | null> {
  const results = await searchStations({
    nearLocation: { coordinates, radiusKm: maxDistanceKm },
    limit: 1,
  });
  
  return results.length > 0 ? results[0] : null;
}

/**
 * Get RFS stations by state
 */
export async function getStationsByState(state: string): Promise<RFSStation[]> {
  return searchStations({ state });
}

/**
 * Search stations by name
 */
export async function searchStationsByName(name: string, limit: number = 10): Promise<RFSStation[]> {
  return searchStations({ name, limit });
}

/**
 * Clear the RFS stations cache
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
  console.log('RFS stations cache cleared');
}

/**
 * Get cache information
 */
export function getCacheInfo(): { isCached: boolean; lastFetched?: Date; stationCount?: number } {
  const cached = loadCache();
  if (!cached) {
    return { isCached: false };
  }
  
  return {
    isCached: true,
    lastFetched: new Date(cached.lastFetched),
    stationCount: cached.stations.length,
  };
}
