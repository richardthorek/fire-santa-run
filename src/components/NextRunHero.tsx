import { Link } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import type { Route } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { getRunReadiness } from '../utils/routeHelpers';

export interface NextRunHeroProps {
  route: Route;
}

/**
 * The first thing an organiser sees: the next run, how long until it starts,
 * and what is still missing before it can go ahead.
 */
export function NextRunHero({ route }: NextRunHeroProps) {
  const readiness = getRunReadiness(route);
  const ready = readiness.every(item => item.done);

  return (
    <section
      aria-labelledby="next-run-heading"
      style={{
        backgroundColor: 'var(--card-bg, #fff)',
        border: '1px solid var(--neutral-200)',
        borderLeft: '4px solid var(--summer-gold)',
        borderRadius: 'var(--border-radius-md, 12px)',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        boxShadow: 'var(--ui-shadow-soft)',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--summer-gold-dark)' }}>
            Your next run
          </p>
          <h2 id="next-run-heading" style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.5rem', overflowWrap: 'anywhere' }}>
            {route.name || 'Untitled run'}
          </h2>
        </div>
        <Link
          to={`/routes/${route.id}`}
          style={{
            padding: '0.7rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: 'var(--santa-red)',
            color: 'white',
            fontWeight: 700,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Open run
        </Link>
      </div>

      <CountdownTimer startDate={route.date} startTime={route.startTime} timeZone={route.timeZone} />

      <div>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, fontSize: '0.9375rem' }}>
          {ready ? 'Ready to go' : 'Still to do before the night'}
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.375rem' }}>
          {readiness.map(item => (
            <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9375rem' }}>
              {item.done
                ? <Check size={18} aria-hidden="true" style={{ color: 'var(--christmas-green)', flexShrink: 0 }} />
                : <Circle size={18} aria-hidden="true" style={{ color: 'var(--neutral-500)', flexShrink: 0 }} />}
              <span>
                {item.label}
                <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
