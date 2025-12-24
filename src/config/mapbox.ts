export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example';

// Default center for Australia (roughly central NSW)
export const DEFAULT_CENTER: [number, number] = [146.9161, -33.8688]; // Griffith, NSW
export const DEFAULT_ZOOM = 10;

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
