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
const RFS_API_BASE = 'https://services1.arcgis.com/vHnIGBHHqDR6y0CR/arcgis/rest/services/Rural_Country_Fire_Service_Facilities/FeatureServer/0';

interface RFSStationFeature {
  attributes: {
    OBJECTID: number;
    FACILITY_NAME: string;
    FACILITY_ADDRESS?: string;
    FACILITY_STATE: string;
    FACILITY_LAT: number;
    FACILITY_LONG: number;
    FACILITY_OPERATIONALSTATUS?: string;
    ABS_SUBURB?: string;
    ABS_POSTCODE?: string;
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
    id: attributes.OBJECTID,
    name: attributes.FACILITY_NAME,
    address: attributes.FACILITY_ADDRESS,
    state: attributes.FACILITY_STATE,
    suburb: attributes.ABS_SUBURB,
    postcode: attributes.ABS_POSTCODE,
    coordinates: [geometry.x, geometry.y],
    operationalStatus: attributes.FACILITY_OPERATIONALSTATUS,
    lastUpdated: attributes.FACILITY_DATE 
      ? new Date(attributes.FACILITY_DATE).toISOString() 
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
      whereConditions.push(`FACILITY_STATE = '${state.toUpperCase()}'`);
    }
    
    if (postcode) {
      whereConditions.push(`ABS_POSTCODE = '${postcode}'`);
    }
    
    const whereClause = whereConditions.length > 0 
      ? whereConditions.join(' AND ') 
      : '1=1';

    // Build query parameters
    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'OBJECTID,FACILITY_NAME,FACILITY_ADDRESS,FACILITY_STATE,FACILITY_LAT,FACILITY_LONG,FACILITY_OPERATIONALSTATUS,ABS_SUBURB,ABS_POSTCODE,FACILITY_DATE',
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
