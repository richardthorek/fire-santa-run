/**
 * OffRouteBanner component
 * Shown when the driver is >100m off the planned route.
 * Provides "Reroute Now" and "Dismiss" options.
 * Auto-dismissed by the navigation hook when the driver returns to the route.
 */

import { TOUCH_TARGET, Z_INDEX } from '../utils/constants';

export interface OffRouteBannerProps {
  isVisible: boolean;
  isRerouting: boolean;
  onReroute: () => void;
  onDismiss: () => void;
}

export function OffRouteBanner({
  isVisible,
  isRerouting,
  onReroute,
  onDismiss,
}: OffRouteBannerProps) {
  if (!isVisible || isRerouting) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'absolute',
        top: '6rem',
        left: '1rem',
        right: '1rem',
        zIndex: Z_INDEX.errorMessage,
        backgroundColor: 'rgba(255, 112, 67, 0.97)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '0.875rem 1rem',
        borderRadius: '14px',
        boxShadow: '0 4px 16px rgba(255, 112, 67, 0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Icon + message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '160px' }}>
        <span aria-hidden="true" style={{ fontSize: '1.25rem', flexShrink: 0 }}>🧭</span>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
          You're off route. Reroute?
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={onReroute}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            backgroundColor: 'white',
            color: '#D32F2F',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            minHeight: TOUCH_TARGET.minimum,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          Reroute Now
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss off-route warning"
          style={{
            padding: '0.5rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: '2px solid rgba(255,255,255,0.6)',
            borderRadius: '10px',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'white',
            minHeight: TOUCH_TARGET.minimum,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'white'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)'; }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
