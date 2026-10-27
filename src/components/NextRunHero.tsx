import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import type { Route } from '../types';
import { CountdownTimer } from './CountdownTimer';
import { getRunReadiness } from '../utils/routeHelpers';
import { getApiAuthHeaders } from '../auth/apiToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type PlanEmailState = { status: 'idle' | 'sending' | 'sent' | 'error'; message?: string };

/** Sends the run plan: to the signed-in organiser by default, or to `to` when given. */
async function requestRunPlanEmail(route: Route, to?: string): Promise<PlanEmailState> {
  try {
    const response = await fetch(`${API_BASE_URL}/routes/${encodeURIComponent(route.id)}/run-plan-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
      body: JSON.stringify({ brigadeId: route.brigadeId, ...(to ? { to } : {}) }),
    });
    const body = await response.json().catch(() => ({})) as { to?: string; message?: string };
    if (!response.ok) return { status: 'error', message: body.message || 'The plan could not be sent.' };
    return { status: 'sent', message: `Sent to ${body.to}.` };
  } catch {
    return { status: 'error', message: 'The plan could not be sent. Check your connection and try again.' };
  }
}

/** Downloads the run plan PDF through the browser, with the sign-in header. */
async function downloadRunPlanPdf(route: Route): Promise<PlanEmailState> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/routes/${encodeURIComponent(route.id)}/run-plan.pdf?brigadeId=${encodeURIComponent(route.brigadeId)}`,
      { headers: await getApiAuthHeaders() },
    );
    if (!response.ok) return { status: 'error', message: 'The PDF could not be made. Try again.' };
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${route.name || 'run'}-run-plan.pdf`.replace(/[^A-Za-z0-9 ._-]+/g, '');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { status: 'sent', message: 'PDF downloaded. Print it for the truck.' };
  } catch {
    return { status: 'error', message: 'The PDF could not be made. Check your connection and try again.' };
  }
}

const planButtonStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: '10px',
  border: '2px solid',
  fontWeight: 700,
  cursor: 'pointer',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NextRunHeroProps {
  route: Route;
}

/**
 * The first thing an organiser sees: the next run, how long until it starts,
 * and what is still missing before it can go ahead.
 */
export function NextRunHero({ route }: NextRunHeroProps) {
  const readiness = getRunReadiness(route);
  const [planEmail, setPlanEmail] = useState<PlanEmailState>({ status: 'idle' });
  const [otherAddress, setOtherAddress] = useState('');
  const otherAddressValid = EMAIL_PATTERN.test(otherAddress.trim());
  const busy = planEmail.status === 'sending';
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

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setPlanEmail({ status: 'sending' });
              setPlanEmail(await requestRunPlanEmail(route));
            }}
            style={{ ...planButtonStyle, backgroundColor: 'var(--santa-red)', color: 'white', borderColor: 'var(--santa-red)' }}
          >
            {busy ? 'Sending…' : 'Email me the plan'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setPlanEmail({ status: 'sending' });
              setPlanEmail(await downloadRunPlanPdf(route));
            }}
            style={{ ...planButtonStyle, backgroundColor: 'transparent', color: 'var(--santa-red)', borderColor: 'var(--santa-red)' }}
          >
            Download PDF
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!otherAddressValid || busy) return;
            setPlanEmail({ status: 'sending' });
            setPlanEmail(await requestRunPlanEmail(route, otherAddress.trim()));
          }}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <label htmlFor="plan-other-address" style={{ fontSize: '0.875rem', fontWeight: 600 }}>Or send to</label>
          <input
            id="plan-other-address"
            type="email"
            value={otherAddress}
            onChange={(event) => setOtherAddress(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            style={{ flex: '1 1 220px', minWidth: 0, padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--neutral-300)', fontSize: '0.9375rem' }}
          />
          <button
            type="submit"
            disabled={!otherAddressValid || busy}
            style={{ ...planButtonStyle, backgroundColor: 'transparent', color: 'var(--santa-red)', borderColor: 'var(--santa-red)', opacity: !otherAddressValid || busy ? 0.5 : 1 }}
          >
            Send
          </button>
        </form>

        <p role="status" aria-live="polite" style={{ margin: 0, fontSize: '0.875rem', color: planEmail.status === 'error' ? 'var(--text-error-strong, #B01620)' : 'var(--neutral-700)' }}>
          {planEmail.message ?? ''}
        </p>
      </div>

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
