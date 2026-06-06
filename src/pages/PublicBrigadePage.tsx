/**
 * PublicBrigadePage — public, unauthenticated brigade profile at /brigade/:slug.
 *
 * Shows brigade identity (name, location, logo, contact), splits the brigade's
 * public routes into upcoming vs past (each links to the live tracker), and
 * offers a "Claim this brigade" call-to-action when the brigade is unclaimed.
 *
 * Implements launch issue #147.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { storageAdapter } from '../storage';
import type { Brigade } from '../storage/types';
import type { Route } from '../types';
import { categorizeBrigadeRoutes, safeHttpUrl, safeImageSrc } from '../utils/publicBrigade';
import { RouteStatusBadge, SEO } from '../components';
import './PublicBrigadePage.css';

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

function formatRouteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function RouteCard({ route }: { route: Route }) {
  const waypointCount = route.waypoints?.length ?? 0;
  const distanceKm =
    typeof route.distance === 'number' ? (route.distance / 1000).toFixed(1) : null;

  return (
    <Link
      to={`/track/${route.id}`}
      className="pbp__route"
      aria-label={`Track ${route.name}`}
    >
      <p className="pbp__route-name">{route.name}</p>
      <RouteStatusBadge status={route.status} />
      <div className="pbp__route-meta">
        <span>📅 {formatRouteDate(route.date)}</span>
        {waypointCount > 0 && <span>📍 {waypointCount} stops</span>}
        {distanceKm && <span>🛣️ {distanceKm} km</span>}
      </div>
    </Link>
  );
}

export function PublicBrigadePage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>('loading');
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) {
        if (!cancelled) setState('not-found');
        return;
      }

      if (!cancelled) setState('loading');
      try {
        const found = await storageAdapter.getBrigadeBySlug(slug);
        if (cancelled) return;
        if (!found) {
          setState('not-found');
          return;
        }
        setBrigade(found);

        // Routes are a non-critical enhancement — a failure here should not
        // blank the whole profile.
        let brigadeRoutes: Route[] = [];
        try {
          brigadeRoutes = await storageAdapter.getRoutes(found.id);
        } catch (routeError) {
          console.error('Failed to load brigade routes:', routeError);
        }
        if (cancelled) return;
        setRoutes(brigadeRoutes);
        setState('ready');
      } catch (error) {
        console.error('Failed to load brigade:', error);
        if (!cancelled) setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { upcoming, past } = useMemo(
    () => categorizeBrigadeRoutes(routes),
    [routes],
  );

  if (state === 'loading') {
    return (
      <div className="pbp">
        <div className="pbp__container">
          <div className="pbp__state" role="status" aria-live="polite">
            <div className="pbp__state-emoji">🎅</div>
            <p>Loading brigade…</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'not-found') {
    return (
      <div className="pbp">
        <SEO title="Brigade not found" />
        <div className="pbp__container">
          <div className="pbp__state">
            <div className="pbp__state-emoji">🔍</div>
            <h1>Brigade not found</h1>
            <p>We couldn&apos;t find a brigade at this address.</p>
            <p>
              <Link to="/">← Back to home</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error' || !brigade) {
    return (
      <div className="pbp">
        <div className="pbp__container">
          <div className="pbp__state">
            <div className="pbp__state-emoji">⚠️</div>
            <h1>Something went wrong</h1>
            <p>We had trouble loading this brigade. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const accentStyle = brigade.themeColor
    ? ({ '--brigade-accent': brigade.themeColor } as CSSProperties)
    : undefined;
  const contact = brigade.contact ?? {};
  // Sanitise user-provided URLs before they reach href/src DOM sinks.
  const logoSrc = safeImageSrc(brigade.logo);
  const websiteUrl = safeHttpUrl(contact.website);

  return (
    <div className="pbp">
      <SEO
        title={brigade.name}
        description={`Follow ${brigade.name}'s Santa runs in ${brigade.location}. Live tracking, no login required.`}
        type="website"
      />
      <div className="pbp__container">
        <header className="pbp__header" style={accentStyle}>
          {logoSrc ? (
            <img className="pbp__logo" src={logoSrc} alt={`${brigade.name} logo`} />
          ) : (
            <div className="pbp__logo pbp__logo--placeholder" aria-hidden="true">
              🚒
            </div>
          )}
          <div className="pbp__heading">
            <h1 className="pbp__name">{brigade.name}</h1>
            {brigade.location && (
              <p className="pbp__location">
                <span aria-hidden="true">📍</span>
                {brigade.location}
              </p>
            )}
            <span
              className={`pbp__badge ${brigade.isClaimed ? 'pbp__badge--claimed' : 'pbp__badge--unclaimed'}`}
            >
              {brigade.isClaimed ? '✓ Verified brigade' : 'Unclaimed brigade'}
            </span>

            <div className="pbp__contact">
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                  🌐 Website
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${encodeURIComponent(contact.email)}`}>✉️ Email</a>
              )}
              {contact.phone && (
                <a href={`tel:${encodeURIComponent(contact.phone)}`}>📞 Call</a>
              )}
              {!brigade.isClaimed && (
                <Link className="pbp__claim" to="/brigades/claim">
                  🔑 Claim this brigade
                </Link>
              )}
            </div>
          </div>
        </header>

        <section className="pbp__section" aria-labelledby="pbp-upcoming">
          <h2 className="pbp__section-title" id="pbp-upcoming">
            Upcoming &amp; live runs
          </h2>
          {upcoming.length > 0 ? (
            <div className="pbp__routes">
              {upcoming.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          ) : (
            <p className="pbp__empty">No runs scheduled right now — check back soon! 🎄</p>
          )}
        </section>

        {past.length > 0 && (
          <section className="pbp__section" aria-labelledby="pbp-past">
            <h2 className="pbp__section-title" id="pbp-past">
              Past runs
            </h2>
            <div className="pbp__routes">
              {past.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
