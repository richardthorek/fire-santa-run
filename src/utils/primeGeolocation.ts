/**
 * Fires a throwaway geolocation request synchronously inside a click handler.
 *
 * iOS Safari requires the geolocation permission prompt to be triggered from
 * a direct user gesture — a request made afterwards (e.g. from a mount
 * effect once a route has changed) is silently denied with no prompt shown,
 * even if permission was granted previously. Calling this from the onClick
 * of a "Navigate" button keeps the request inside that gesture so the
 * prompt (or an already-granted permission) resolves before NavigationView
 * starts watching position itself.
 */
export function primeGeolocationPermission(): void {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    () => {},
    () => {},
    { maximumAge: 60_000, timeout: 5_000 }
  );
}
