/**
 * /api/rfs-stations - Fetch RFS station data
 * 
 * Provides access to Rural & Country Fire Service Facilities dataset.
 * Supports querying by state, name, location, etc.
 * 
 * Query Parameters:
 * - state (optional): Filter by Australian state (e.g., NSW, VIC, QLD)
 * - name (optional): Search by station name (partial match)
 * - suburb (optional): Filter by suburb
 * - postcode (optional): Filter by postcode
 * - lat, lng, radius (optional): Find stations near location (radius in km)
 * - limit (optional): Max number of results (default: 100)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// ArcGIS REST API endpoint for RFS facilities
// Using Geoscience Australia's Emergency Management Facilities MapServer
const RFS_API_BASE = 'https://services.ga.gov.au/gis/rest/services/Emergency_Management_Facilities/MapServer/4';

interface RFSStationFeature {
  attributes: {
    objectid?: number;
    OBJECTID?: number;
    facility_name?: string;
    FACILITY_NAME?: string;
    facility_address?: string;
    FACILITY_ADDRESS?: string;
    facility_state?: string;
    FACILITY_STATE?: string;
    facility_lat?: number;
    FACILITY_LAT?: number;
    facility_long?: number;
    FACILITY_LONG?: number;
    facility_operationalstatus?: string;
    FACILITY_OPERATIONALSTATUS?: string;
    abs_suburb?: string;
    ABS_SUBURB?: string;
    abs_postcode?: string;
    ABS_POSTCODE?: string;
    facility_date?: number;
    FACILITY_DATE?: number;
  };
  geometry: {
    x: number;
    y: number;
  };
}

interface RFSStation {
  id: number;
  name: string;
  address?: string;
  state: string;
  suburb?: string;
  postcode?: string;
  coordinates: [number, number];
  operationalStatus?: string;
  lastUpdated?: string;
}

function convertFeatureToStation(feature: RFSStationFeature): RFSStation {
  const { attributes, geometry } = feature;
  return {
    id: attributes.objectid || attributes.OBJECTID || 0,
    name: attributes.facility_name || attributes.FACILITY_NAME || '',
    address: attributes.facility_address || attributes.FACILITY_ADDRESS,
    state: attributes.facility_state || attributes.FACILITY_STATE || '',
    suburb: attributes.abs_suburb || attributes.ABS_SUBURB,
    postcode: attributes.abs_postcode || attributes.ABS_POSTCODE,
    coordinates: [geometry.x, geometry.y],
    operationalStatus: attributes.facility_operationalstatus || attributes.FACILITY_OPERATIONALSTATUS,
    lastUpdated: attributes.facility_date || attributes.FACILITY_DATE
      ? new Date((attributes.facility_date || attributes.FACILITY_DATE) as number).toISOString() 
      : undefined,
  };
}

function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
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

export async function rfsStations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Parse query parameters
    const state = request.query.get('state');
    const name = request.query.get('name');
    const suburb = request.query.get('suburb');
    const postcode = request.query.get('postcode');
    const lat = request.query.get('lat');
    const lng = request.query.get('lng');
    const radiusStr = request.query.get('radius');
    const limitStr = request.query.get('limit');
    
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const radius = radiusStr ? parseFloat(radiusStr) : 50; // Default 50km

    // Build WHERE clause for ArcGIS query
    const whereConditions: string[] = [];
    
    if (state) {
      // Use lowercase field names for the new API
      whereConditions.push(`facility_state = '${state.toUpperCase()}'`);
    }
    
    if (postcode) {
      whereConditions.push(`abs_postcode = '${postcode}'`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? whereConditions.join(' AND ') 
      : '1=1';

    // Build query parameters
    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'objectid,facility_name,facility_address,facility_state,facility_lat,facility_long,facility_operationalstatus,abs_suburb,abs_postcode,facility_date',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
      resultRecordCount: Math.min(limit * 2, 1000).toString(), // Fetch more for filtering
    });

    // Add spatial query if coordinates provided
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        // Convert radius to meters for API
        const radiusMeters = radius * 1000;
        params.set('geometry', `${longitude},${latitude}`);
        params.set('geometryType', 'esriGeometryPoint');
        params.set('distance', radiusMeters.toString());
        params.set('units', 'esriSRUnit_Meter');
        params.set('spatialRel', 'esriSpatialRelIntersects');
      }
    }

    // Fetch from ArcGIS API
    const url = `${RFS_API_BASE}/query?${params.toString()}`;
    context.log('Fetching RFS stations:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      throw new Error('Invalid response from RFS API');
    }

    // Convert features to simplified format
    let stations: RFSStation[] = data.features.map(convertFeatureToStation);

    // Apply client-side filters
    if (name) {
      const nameLower = name.toLowerCase();
      stations = stations.filter(s => 
        s.name.toLowerCase().includes(nameLower)
      );
    }
    
    if (suburb) {
      const suburbLower = suburb.toLowerCase();
      stations = stations.filter(s => 
        s.suburb?.toLowerCase().includes(suburbLower)
      );
    }

    // Sort by distance if coordinates provided
    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (!isNaN(latitude) && !isNaN(longitude)) {
        stations = stations.map(s => ({
          ...s,
          distance: calculateDistance([longitude, latitude], s.coordinates)
        })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }
    }

    // Apply limit
    stations = stations.slice(0, limit);

    context.log(`Returning ${stations.length} RFS stations`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
      jsonBody: {
        stations,
        count: stations.length,
      }
    };

  } catch (error) {
    context.error('Error fetching RFS stations:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to fetch RFS stations',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

app.http('rfs-stations', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: rfsStations
});
