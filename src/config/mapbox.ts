export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example';

// Default center for Australia (central Australia for fallback when no other location available)
export const DEFAULT_CENTER: [number, number] = [133.7751, -25.2744]; // Central Australia

// Zoom levels for different map contexts
export const DEFAULT_ZOOM = 13; // General default zoom for typical map views (street level)
export const AUSTRALIA_FALLBACK_ZOOM = 5; // Wider zoom to show more of Australia when using national fallback

// Mapbox configuration options
// Note: collectResourceTiming is set to false in all map initializations
// to prevent ERR_BLOCKED_BY_CLIENT errors when browser extensions block
// requests to events.mapbox.com (Mapbox's telemetry endpoint)
export const MAPBOX_CONFIG = {
  collectResourceTiming: false, // Disable telemetry/analytics
};

// Australian bounds for map restrictions
export const AUSTRALIA_BOUNDS: [[number, number], [number, number]] = [
  [112.9, -44.0], // Southwest coordinates
  [154.0, -10.0]  // Northeast coordinates
];

export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};
