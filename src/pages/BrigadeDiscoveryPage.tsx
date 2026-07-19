/**
 * Brigade Discovery Page — public search and browse for all brigades.
 *
 * Accessible at /brigades (no auth required). Lets members of the public find
 * their local brigade and follow their Santa run. Filters are client-side
 * over the brigade list returned by the existing GET /api/brigades endpoint.
 */

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { storageAdapter } from '../storage';
import { safeImageSrc } from '../utils/publicBrigade';
import { calculateDistance } from '../utils/navigation';
// Direct import: the components barrel drags mapbox-gl into this public page's chunk.
import { SEO } from '../components/SEO';
import { PublicHeader } from '../components/PublicHeader';
import type { Brigade } from '../storage/types';
import './BrigadeDiscoveryPage.css';

/** Extract the state abbreviation from "City, NSW" → "NSW". */
function extractState(location: string | undefined): string {
  if (!location) return '';
  const parts = location.split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : '';
}

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

/** "850 m away" / "12 km away" for the card distance chip. */
function formatDistanceAway(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m away`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km away`;
  return `${Math.round(meters / 1000)} km away`;
}

function BrigadeCard({ brigade, distanceMeters }: { brigade: Brigade; distanceMeters?: number }) {
  const logoSrc = safeImageSrc(brigade.logo);
  const state = extractState(brigade.location);

  return (
    <Link
      to={`/brigade/${brigade.slug}`}
      className="bdp__card"
      aria-label={`View ${brigade.name} brigade profile`}
    >
      <div className="bdp__card-logo" aria-hidden="true">
        {logoSrc ? (
          <img src={logoSrc} alt="" />
        ) : (
          <span>🚒</span>
        )}
      </div>
      <div className="bdp__card-body">
        <p className="bdp__card-name">{brigade.name}</p>
        <p className="bdp__card-location">
          <span aria-hidden="true">📍</span> {brigade.location}
        </p>
        {distanceMeters !== undefined && (
          <span className="bdp__distance-badge">{formatDistanceAway(distanceMeters)}</span>
        )}
        {state && <span className="bdp__state-badge">{state}</span>}
      </div>
    </Link>
  );
}

export function BrigadeDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  // "Near me": browser geolocation → sort by distance to each brigade station.
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Defer the query used for filtering so typing stays responsive even when the
  // brigade list is large — the input updates instantly, the grid catches up.
  const deferredQuery = useDeferredValue(query);

  const hasActiveFilters = query.trim() !== '' || stateFilter !== '';

  function clearFilters() {
    setQuery('');
    setStateFilter('');
  }

  function locateMe() {
    if (!('geolocation' in navigator)) {
      setLocationError('Location is not available on this device.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.longitude, pos.coords.latitude]);
        setLocating(false);
      },
      () => {
        setLocationError('We couldn’t get your location. You can still search by name or town.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  // Landing-page CTA ("Find a Santa run near me") links here with ?near=1 —
  // start locating immediately so the visitor lands on a sorted list.
  useEffect(() => {
    if (searchParams.get('near') === '1') locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const all = await storageAdapter.getBrigades();
        // Sort alphabetically by name for a stable display order
        all.sort((a, b) => a.name.localeCompare(b.name));
        setBrigades(all);
      } catch (err) {
        console.error('Failed to load brigades:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Distance to each brigade's station when the visitor has shared a location.
  const distances = useMemo(() => {
    if (!userLocation) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const b of brigades) {
      if (b.stationCoordinates) {
        map.set(b.id, calculateDistance(userLocation, b.stationCoordinates));
      }
    }
    return map;
  }, [brigades, userLocation]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = brigades.filter((b) => {
      if (stateFilter && extractState(b.location) !== stateFilter) return false;
      if (q && !b.name.toLowerCase().includes(q) && !(b.location ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (userLocation) {
      // Nearest first; brigades without a station location keep alphabetical
      // order after the located ones.
      return [...list].sort((a, b) => {
        const da = distances.get(a.id);
        const db = distances.get(b.id);
        if (da === undefined && db === undefined) return a.name.localeCompare(b.name);
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return da - db;
      });
    }
    return list;
  }, [brigades, deferredQuery, stateFilter, userLocation, distances]);

  const statesWithBrigades = useMemo(() => {
    const present = new Set(brigades.map((b) => extractState(b.location)).filter(Boolean));
    return AU_STATES.filter((s) => present.has(s));
  }, [brigades]);

  return (
    <div className="bdp">
      <PublicHeader />
      <SEO
        title="Find Your Local Brigade"
        description="Browse participating brigades and community groups. Find your local Santa run and follow along live."
      />

      <header className="bdp__hero">
        <div className="bdp__hero-inner">
          <div className="bdp__hero-emoji" aria-hidden="true">🚒</div>
          <h1 className="bdp__hero-title">Find Your Brigade</h1>
          <p className="bdp__hero-desc">
            Browse participating brigades and community groups and follow their Santa runs live.
          </p>

          {/* Search + near-me */}
          <div className="bdp__search-wrap">
            <label htmlFor="bdp-search" className="sr-only">Search brigades</label>
            <input
              id="bdp-search"
              type="search"
              className="bdp__search"
              placeholder="Search by name or location…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="bdp__near-btn"
              onClick={locateMe}
              disabled={locating}
              aria-pressed={userLocation !== null}
            >
              {locating ? '📍 Locating…' : userLocation ? '📍 Sorted by distance' : '📍 Near me'}
            </button>
          </div>
          {locationError && (
            <p className="bdp__location-error" role="alert">{locationError}</p>
          )}
        </div>
      </header>

      <div className="bdp__content">
        {/* Filters */}
        <div className="bdp__filters" role="group" aria-label="Filter brigades">
          <div className="bdp__filter-group">
            <label htmlFor="bdp-state" className="bdp__filter-label">State</label>
            <select
              id="bdp-state"
              className="bdp__select"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">All states</option>
              {statesWithBrigades.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="bdp__state" role="status" aria-live="polite">
            <div className="bdp__state-emoji">🎅</div>
            <p>Loading brigades…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bdp__state">
            <div className="bdp__state-emoji">⚠️</div>
            <p>We had trouble loading brigades. Please try again.</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="bdp__result-count" aria-live="polite">
              {filtered.length === 0
                ? 'No brigades match your search.'
                : `${filtered.length} brigade${filtered.length === 1 ? '' : 's'} found`}
            </p>
            {filtered.length === 0 ? (
              <div className="bdp__state">
                <div className="bdp__state-emoji">🔍</div>
                <p>
                  No brigades found{hasActiveFilters ? ' for that search' : ''}. Try a
                  different name or state.
                </p>
                <div className="bdp__state-actions">
                  {hasActiveFilters && (
                    <button type="button" className="bdp__state-btn" onClick={clearFilters}>
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bdp__grid">
                {filtered.map((b) => (
                  <BrigadeCard key={b.id} brigade={b} distanceMeters={distances.get(b.id)} />
                ))}
              </div>
            )}
          </>
        )}

        <div className="bdp__claim-cta">
          <p>Can&apos;t find your brigade?</p>
          <Link to="/login" className="bdp__claim-link">
            🎅 Sign up to get started
          </Link>
        </div>
      </div>
    </div>
  );
}
