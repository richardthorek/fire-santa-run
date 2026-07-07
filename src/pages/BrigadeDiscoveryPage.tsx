/**
 * Brigade Discovery Page — public search and browse for all RFS brigades.
 *
 * Accessible at /brigades (no auth required). Lets members of the public find
 * their local brigade, follow their Santa run, or prompt unclaimed brigades to
 * register. Filters are client-side over the brigade list returned by the
 * existing GET /api/brigades endpoint.
 */

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { storageAdapter } from '../storage';
import { safeImageSrc } from '../utils/publicBrigade';
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

function BrigadeCard({ brigade }: { brigade: Brigade }) {
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
        {state && <span className="bdp__state-badge">{state}</span>}
      </div>
      {!brigade.isClaimed && (
        <span className="bdp__unclaimed-badge">Unclaimed</span>
      )}
    </Link>
  );
}

export function BrigadeDiscoveryPage() {
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [showUnclaimed, setShowUnclaimed] = useState(false);
  // Defer the query used for filtering so typing stays responsive even when the
  // brigade list is large — the input updates instantly, the grid catches up.
  const deferredQuery = useDeferredValue(query);

  const hasActiveFilters = query.trim() !== '' || stateFilter !== '';

  function clearFilters() {
    setQuery('');
    setStateFilter('');
  }

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

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return brigades.filter((b) => {
      if (!showUnclaimed && !b.isClaimed) return false;
      if (stateFilter && extractState(b.location) !== stateFilter) return false;
      if (q && !b.name.toLowerCase().includes(q) && !(b.location ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [brigades, deferredQuery, stateFilter, showUnclaimed]);

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

          {/* Search */}
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
          </div>
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
          <label className="bdp__toggle">
            <input
              type="checkbox"
              checked={showUnclaimed}
              onChange={(e) => setShowUnclaimed(e.target.checked)}
            />
            <span>Show unclaimed brigades</span>
          </label>
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
                  different name or state{!showUnclaimed ? ', or show unclaimed brigades' : ''}.
                </p>
                <div className="bdp__state-actions">
                  {hasActiveFilters && (
                    <button type="button" className="bdp__state-btn" onClick={clearFilters}>
                      Clear search
                    </button>
                  )}
                  {!showUnclaimed && (
                    <button
                      type="button"
                      className="bdp__state-btn"
                      onClick={() => setShowUnclaimed(true)}
                    >
                      Show unclaimed brigades
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bdp__grid">
                {filtered.map((b) => (
                  <BrigadeCard key={b.id} brigade={b} />
                ))}
              </div>
            )}
          </>
        )}

        <div className="bdp__claim-cta">
          <p>Can&apos;t find your brigade, or is it unclaimed?</p>
          <Link to="/brigades/claim" className="bdp__claim-link">
            🔑 Claim your brigade
          </Link>
        </div>
      </div>
    </div>
  );
}
