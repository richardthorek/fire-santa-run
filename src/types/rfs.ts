/**
 * RFS Station Data Types
 * 
 * Types for Rural & Country Fire Service Facilities dataset
 * from Digital Atlas of Australia
 */

/**
 * RFS Station Feature from ArcGIS REST API
 * Represents a single fire service facility
 */
export interface RFSStationFeature {
  attributes: {
    OBJECTID: number;
    FACILITY_NAME: string;
    FACILITY_ADDRESS?: string;
    FACILITY_STATE: string;
    FACILITY_LAT: number;
    FACILITY_LONG: number;
    CLASS?: string;
    FEATURETYPE?: string;
    DESCRIPTION?: string;
    FACILITY_OPERATIONALSTATUS?: string;
    ABS_SUBURB?: string;
    ABS_POSTCODE?: string;
    FACILITY_ATTRIBUTE_SOURCE?: string;
    FACILITY_ATTRIBUTE_DATE?: number;
    FACILITY_SOURCE?: string;
    FACILITY_DATE?: number;
    FACILITY_SPATIAL_CONFIDENCE?: number;
    FACILITY_REVISED?: number;
  };
  geometry: {
    x: number; // Longitude
    y: number; // Latitude
  };
}

/**
 * Simplified RFS Station for internal use
 */
export interface RFSStation {
  id: number;
  name: string;
  address?: string;
  state: string;
  suburb?: string;
  postcode?: string;
  coordinates: [number, number]; // [lng, lat] - Mapbox format
  operationalStatus?: string;
  lastUpdated?: Date;
}

/**
 * Response from ArcGIS Feature Service query
 */
export interface RFSFeatureServiceResponse {
  features: RFSStationFeature[];
  exceededTransferLimit?: boolean;
  fieldAliases?: Record<string, string>;
  fields?: Array<{
    name: string;
    type: string;
    alias?: string;
  }>;
}

/**
 * Query options for RFS station lookups
 */
export interface RFSStationQuery {
  state?: string;
  suburb?: string;
  postcode?: string;
  name?: string;
  nearLocation?: {
    coordinates: [number, number]; // [lng, lat]
    radiusKm?: number; // Default: 50km
  };
  limit?: number; // Max results to return
}

/**
 * Cached RFS dataset metadata
 */
export interface RFSDatasetCache {
  stations: RFSStation[];
  lastFetched: number; // Timestamp
  version: string; // Cache version for invalidation
}
