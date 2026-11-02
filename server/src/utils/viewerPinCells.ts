/** A viewer's waiting-spot pin: a coarsened position and when it was last refreshed. */
export interface ViewerPin {
  lng: number;
  lat: number;
  at: number;
}

export interface PinCell {
  lng: number;
  lat: number;
  count: number;
}

/** 3 dp ≈ 110 m. Coordinates are already coarsened client-side. */
const roundGrid = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Group pins into grid cells and keep only cells with at least `minGroup`
 * viewers. A smaller cell would reveal one or two people's approximate
 * position to the navigator, so it is withheld (k-anonymity).
 */
export function aggregatePinCells(pins: Iterable<ViewerPin>, minGroup: number): PinCell[] {
  const cellMap = new Map<string, PinCell>();
  for (const pin of pins) {
    const lng = roundGrid(pin.lng);
    const lat = roundGrid(pin.lat);
    const key = `${lng},${lat}`;
    const cell = cellMap.get(key);
    if (cell) cell.count += 1;
    else cellMap.set(key, { lng, lat, count: 1 });
  }
  return [...cellMap.values()].filter((cell) => cell.count >= minGroup);
}
