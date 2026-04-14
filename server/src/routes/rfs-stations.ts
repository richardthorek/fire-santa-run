/* eslint-disable @typescript-eslint/no-explicit-any */
import { Hono } from 'hono';

const RFS_API_BASE = 'https://services.ga.gov.au/gis/rest/services/Emergency_Management_Facilities/MapServer/4';

// Allowlist patterns for parameters passed into the ArcGIS WHERE clause
const VALID_STATE_RE = /^[A-Za-z]{2,3}$/;    // e.g. NSW, VIC, QLD
const VALID_POSTCODE_RE = /^\d{4}$/;          // 4-digit Australian postcode

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
  distance?: number;
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

  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const rfsStationsRouter = new Hono();

rfsStationsRouter.get('/rfs-stations', async (c) => {
  try {
    const state = c.req.query('state');
    const name = c.req.query('name');
    const suburb = c.req.query('suburb');
    const postcode = c.req.query('postcode');
    const lat = c.req.query('lat');
    const lng = c.req.query('lng');
    const radiusStr = c.req.query('radius');
    const limitStr = c.req.query('limit');

    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    const radius = radiusStr ? parseFloat(radiusStr) : 50;

    const whereConditions: string[] = [];

    if (state) {
      if (!VALID_STATE_RE.test(state)) {
        return c.json({ error: 'Invalid state parameter' }, 400);
      }
      whereConditions.push(`facility_state = '${state.toUpperCase()}'`);
    }

    if (postcode) {
      if (!VALID_POSTCODE_RE.test(postcode)) {
        return c.json({ error: 'Invalid postcode parameter' }, 400);
      }
      whereConditions.push(`abs_postcode = '${postcode}'`);
    }

    const whereClause = whereConditions.length > 0 ? whereConditions.join(' AND ') : '1=1';

    const params = new URLSearchParams({
      where: whereClause,
      outFields: 'objectid,facility_name,facility_address,facility_state,facility_lat,facility_long,facility_operationalstatus,abs_suburb,abs_postcode,facility_date',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
      resultRecordCount: Math.min(limit * 2, 1000).toString(),
    });

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (!isNaN(latitude) && !isNaN(longitude)) {
        const radiusMeters = radius * 1000;
        params.set('geometry', `${longitude},${latitude}`);
        params.set('geometryType', 'esriGeometryPoint');
        params.set('distance', radiusMeters.toString());
        params.set('units', 'esriSRUnit_Meter');
        params.set('spatialRel', 'esriSpatialRelIntersects');
      }
    }

    const url = `${RFS_API_BASE}/query?${params.toString()}`;
    console.log('Fetching RFS stations:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json() as any;

    if (!data.features || !Array.isArray(data.features)) {
      throw new Error('Invalid response from RFS API');
    }

    let stations: RFSStation[] = data.features.map(convertFeatureToStation);

    if (name) {
      const nameLower = name.toLowerCase();
      stations = stations.filter(s => s.name.toLowerCase().includes(nameLower));
    }

    if (suburb) {
      const suburbLower = suburb.toLowerCase();
      stations = stations.filter(s => s.suburb?.toLowerCase().includes(suburbLower));
    }

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

    stations = stations.slice(0, limit);

    console.log(`Returning ${stations.length} RFS stations`);

    return new Response(JSON.stringify({ stations, count: stations.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error fetching RFS stations:', error);
    return c.json({ error: 'Failed to fetch RFS stations', message: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
