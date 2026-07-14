/**
 * ThankYouOverlay component
 * Post-event summary and thank-you screen displayed after a Santa run completes.
 * Renders as a floating overlay on top of the frozen archive map.
 */

import { Link } from 'react-router-dom';
import type { Route } from '../types';
import { formatDistance, formatDuration } from '../utils/mapbox';

export interface ThankYouOverlayProps {
  route: Route;
}

export function ThankYouOverlay({ route }: ThankYouOverlayProps) {
  const completedStops = route.waypoints.filter((w) => w.isCompleted).length;
  const totalStops = route.waypoints.length;

  // Actual duration: prefer explicit field, fall back to startedAt/completedAt timestamps
  let durationSeconds: number | undefined = route.actualDuration;
  if (!durationSeconds && route.startedAt && route.completedAt) {
    const start = new Date(route.startedAt).getTime();
    const end = new Date(route.completedAt).getTime();
    if (end > start) {
      durationSeconds = Math.round((end - start) / 1000);
    }
  }
  // Last resort: use estimated duration
  if (!durationSeconds) {
    durationSeconds = route.estimatedDuration;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        // Semi-transparent festive backdrop so the frozen map peeks through
        background: 'linear-gradient(160deg, rgba(214,40,40,0.82) 0%, rgba(27,94,32,0.82) 100%)',
        zIndex: 1500,
        fontFamily: 'var(--font-body)',
        overflowY: 'auto',
      }}
    >
      {/* Festive card */}
      <div
        style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '24px',
          padding: 'clamp(1.5rem, 5vw, 2.5rem)',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          border: '3px solid var(--summer-gold)',
          textAlign: 'center',
        }}
      >
        {/* Hero emoji */}
        <div
          style={{
            fontSize: 'clamp(3rem, 10vw, 5rem)',
            lineHeight: 1,
            marginBottom: '0.75rem',
            // Gentle sway animation defined in index.css (.santa-marker-icon)
          }}
        >
          🎅
        </div>

        {/* Main heading */}
        <h1
          style={{
            fontFamily: 'var(--font-fun)',
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            color: 'var(--santa-red)',
            margin: '0 0 0.5rem',
            lineHeight: 1.2,
          }}
        >
          Thanks for tracking Santa!
        </h1>

        <p
          style={{
            fontSize: '1rem',
            color: 'var(--neutral-700)',
            margin: '0 0 1.5rem',
          }}
        >
          Santa has finished delivering Christmas joy — see you next year! 🎄
        </p>

        {/* Divider */}
        <div
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, var(--santa-red), var(--summer-gold), var(--christmas-green))',
            borderRadius: '2px',
            marginBottom: '1.5rem',
          }}
        />

        {/* Route summary stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Stops */}
          <div
            style={{
              padding: '0.875rem 0.5rem',
              backgroundColor: 'rgba(214,40,40,0.07)',
              borderRadius: '12px',
              border: '1px solid rgba(214,40,40,0.15)',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2rem)',
                fontWeight: 700,
                color: 'var(--santa-red)',
                lineHeight: 1,
                marginBottom: '0.375rem',
              }}
            >
              {completedStops}/{totalStops}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--neutral-700)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Stops
            </div>
          </div>

          {/* Distance */}
          <div
            style={{
              padding: '0.875rem 0.5rem',
              backgroundColor: 'rgba(255,167,38,0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(255,167,38,0.2)',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                fontWeight: 700,
                color: 'var(--summer-gold-dark)',
                lineHeight: 1,
                marginBottom: '0.375rem',
              }}
            >
              {route.distance ? formatDistance(route.distance) : '—'}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--neutral-700)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Distance
            </div>
          </div>

          {/* Time */}
          <div
            style={{
              padding: '0.875rem 0.5rem',
              backgroundColor: 'rgba(67,160,71,0.08)',
              borderRadius: '12px',
              border: '1px solid rgba(67,160,71,0.2)',
            }}
          >
            <div
              style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                fontWeight: 700,
                color: 'var(--christmas-green)',
                lineHeight: 1,
                marginBottom: '0.375rem',
              }}
            >
              {durationSeconds ? formatDuration(durationSeconds) : '—'}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--neutral-700)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Duration
            </div>
          </div>
        </div>

        {/* Route name and date */}
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--neutral-100)',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--neutral-900)', fontSize: '0.9rem' }}>
            🗺️ {route.name}
          </p>
          {route.date && (
            <p style={{ margin: '0.25rem 0 0', color: 'var(--neutral-700)', fontSize: '0.8rem' }}>
              📅 {route.date}{route.startTime ? ` • ⏰ ${route.startTime}` : ''}
            </p>
          )}
        </div>

        {/* Archive mode notice */}
        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--neutral-700)',
            margin: '0 0 1.5rem',
            fontStyle: 'italic',
          }}
        >
          🗺️ The map is frozen at Santa's final position for this route.
        </p>

        {/* CTA button */}
        <Link
          to="/"
          style={{
            display: 'inline-block',
            padding: '0.875rem 2rem',
            background: 'linear-gradient(135deg, var(--santa-red) 0%, #B21E1E 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '14px',
            fontWeight: 700,
            fontSize: '1rem',
            fontFamily: 'var(--font-fun)',
            boxShadow: '0 4px 14px rgba(214,40,40,0.35)',
            transition: 'all 0.2s ease',
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(214,40,40,0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(214,40,40,0.35)';
          }}
        >
          🎁 View Other Routes
        </Link>
      </div>
    </div>
  );
}
