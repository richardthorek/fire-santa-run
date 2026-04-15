/**
 * CountdownTimer component
 * Displays a live HH:MM:SS countdown until a route's scheduled start time.
 * Shown on the public tracking page before Santa's run begins.
 */

import { useEffect, useReducer, useRef } from 'react';
import { getCountdownTime, padCountdownUnit, formatRouteStartDateTime } from '../utils/countdown';

export interface CountdownTimerProps {
  /** Route date in YYYY-MM-DD format */
  startDate: string;
  /** Route start time in HH:MM (24-hour) format */
  startTime: string;
  /** Called once when the countdown reaches zero */
  onComplete?: () => void;
  /** Called when the user clicks the Share button */
  onShare?: () => void;
}

export function CountdownTimer({ startDate, startTime, onComplete, onShare }: CountdownTimerProps) {
  // Tick counter — incremented by setInterval to trigger re-renders.
  // Using useReducer so dispatch is stable and the interval only restarts
  // when startDate/startTime change, not on every render.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Keep a stable ref so the completion callback can be invoked without
  // restarting the interval whenever the prop changes.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Countdown is derived on every render — no stored state needed.
  const countdown = getCountdownTime(startDate, startTime);
  const isComplete = countdown.total === 0;

  useEffect(() => {
    if (isComplete) {
      onCompleteRef.current?.();
      return;
    }
    // Tick every second; forceUpdate is stable so this only restarts
    // when the route date/time or completion status changes.
    const id = setInterval(forceUpdate, 1000);
    return () => clearInterval(id);
  }, [isComplete, startDate, startTime, forceUpdate]);

  const formattedStart = formatRouteStartDateTime(startDate, startTime);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem 0.5rem',
        textAlign: 'center',
      }}
    >
      {/* Heading */}
      <p
        style={{
          margin: 0,
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--santa-red)',
          fontFamily: 'var(--font-heading)',
        }}
      >
        🎅 Santa starts in&hellip;
      </p>

      {/* HH:MM:SS display */}
      <div
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Countdown: ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        {[
          { value: countdown.hours, label: 'hrs' },
          { value: countdown.minutes, label: 'min' },
          { value: countdown.seconds, label: 'sec' },
        ].map(({ value, label }, index) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: 'clamp(1.75rem, 6vw, 2.5rem)',
                  color: 'var(--santa-red)',
                  lineHeight: 1,
                  minWidth: '2.5ch',
                  display: 'inline-block',
                  textAlign: 'center',
                  background: 'rgba(211, 47, 47, 0.08)',
                  borderRadius: 'var(--border-radius-xs)',
                  padding: '0.25rem 0.5rem',
                }}
              >
                {padCountdownUnit(value)}
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontFamily: 'var(--font-body)',
                  color: 'var(--neutral-600)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: '0.125rem',
                }}
              >
                {label}
              </span>
            </span>
            {index < 2 && (
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 900,
                  fontSize: 'clamp(1.75rem, 6vw, 2.5rem)',
                  color: 'var(--santa-red)',
                  lineHeight: 1,
                  opacity: 0.5,
                  alignSelf: 'flex-start',
                  paddingBottom: '1.25rem',
                }}
              >
                :
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Start date/time */}
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          color: 'var(--neutral-700)',
          fontFamily: 'var(--font-body)',
        }}
      >
        📅 {formattedStart}
      </p>

      {/* CTA message */}
      <div
        style={{
          padding: '0.625rem 1rem',
          background: 'linear-gradient(135deg, rgba(255, 230, 0, 0.15), rgba(255, 167, 38, 0.15))',
          borderRadius: 'var(--border-radius-xs)',
          border: '1px solid rgba(255, 167, 38, 0.4)',
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--neutral-800)',
            fontFamily: 'var(--font-body)',
          }}
        >
          🔔 Check back soon! Share this page so your family can follow along.
        </p>
      </div>

      {/* Share button */}
      {onShare && (
        <button
          onClick={onShare}
          aria-label="Share Santa's route"
          style={{
            padding: '0.625rem 1.5rem',
            background: 'linear-gradient(135deg, var(--santa-red), #B21E1E)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--border-radius-sm)',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 8px rgba(211, 47, 47, 0.35)',
            fontFamily: 'var(--font-body)',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.45)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(211, 47, 47, 0.35)';
          }}
        >
          🔗 Share Santa's Route
        </button>
      )}
    </div>
  );
}
