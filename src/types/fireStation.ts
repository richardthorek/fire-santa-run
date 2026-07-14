/**
 * Fire Station Data Types
 * 
 * Types for national fire station facilities dataset
 * from the Digital Atlas of Australia
 */

/**
 * Fire Station Feature from ArcGIS REST API
 * Represents a single fire service facility
 * Supports both uppercase (old API) and lowercase (new API) field names
 */
export interface FireStationFeature {
  attributes: {
    // Support both field name conventions
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
    class?: string;
    CLASS?: string;
    featuretype?: string;
    FEATURETYPE?: string;
    description?: string;
    DESCRIPTION?: string;
    facility_operationalstatus?: string;
    FACILITY_OPERATIONALSTATUS?: string;
    abs_suburb?: string;
    ABS_SUBURB?: string;
    abs_postcode?: string;
    ABS_POSTCODE?: string;
    facility_attribute_source?: string;
    FACILITY_ATTRIBUTE_SOURCE?: string;
    facility_attribute_date?: number;
    FACILITY_ATTRIBUTE_DATE?: number;
    facility_source?: string;
    FACILITY_SOURCE?: string;
    facility_date?: number;
    FACILITY_DATE?: number;
    facility_spatial_confidence?: number;
    FACILITY_SPATIAL_CONFIDENCE?: number;
    facility_revised?: number;
    FACILITY_REVISED?: number;
  };
  geometry: {
    x: number; // Longitude
    y: number; // Latitude
  };
}

/**
 * Simplified Fire Station for internal use
 */
export interface FireStation {
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
export interface FireStationFeatureServiceResponse {
  features: FireStationFeature[];
  exceededTransferLimit?: boolean;
  fieldAliases?: Record<string, string>;
  fields?: Array<{
    name: string;
    type: string;
    alias?: string;
  }>;
}

/**
 * Query options for fire station lookups
 */
export interface FireStationQuery {
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
 * Cached fire station dataset metadata
 */
export interface FireStationDatasetCache {
  stations: FireStation[];
  lastFetched: number; // Timestamp
  version: string; // Cache version for invalidation
}
