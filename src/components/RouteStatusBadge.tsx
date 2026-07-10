import type { RouteStatus } from '../types';
import { getStatusLabel } from '../utils/routeHelpers';
import { CircleCheckBig, CalendarCheck, Archive, FileEdit } from 'lucide-react';

export interface RouteStatusBadgeProps {
  status: RouteStatus;
  className?: string;
}

interface StatusPillStyle {
  background: string;
  color: string;
  border: string;
}

// draft -> slate, published -> info, active -> success + pulsing dot,
// completed -> success (no dot), archived -> slate on paper.
const PILL_STYLES: Record<RouteStatus, StatusPillStyle> = {
  draft: { background: 'var(--hairline)', color: 'var(--slate-500)', border: 'var(--hairline)' },
  published: { background: 'var(--surface-info)', color: 'var(--text-info-strong)', border: 'var(--surface-info)' },
  active: { background: 'var(--surface-success)', color: 'var(--text-success-strong)', border: 'var(--surface-success)' },
  completed: { background: 'var(--surface-success)', color: 'var(--text-success-strong)', border: 'var(--surface-success)' },
  archived: { background: 'var(--paper)', color: 'var(--slate-500)', border: 'var(--hairline)' },
};

/**
 * Badge component to display route status with appropriate styling
 */
export function RouteStatusBadge({ status, className = '' }: RouteStatusBadgeProps) {
  const label = getStatusLabel(status);
  const style = PILL_STYLES[status];

  return (
    <span
      className={`route-status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.25rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.875rem',
        fontWeight: 600,
        backgroundColor: style.background,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      <StatusIcon status={status} />
      <span>{label}</span>
    </span>
  );
}

function StatusIcon({ status }: { status: RouteStatus }) {
  switch (status) {
    case 'draft':
      return <FileEdit size={14} aria-hidden="true" />;
    case 'published':
      return <CalendarCheck size={14} aria-hidden="true" />;
    case 'active':
      return (
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'var(--christmas-green)',
            animation: 'status-dot-pulse 2s infinite',
          }}
        />
      );
    case 'completed':
      return <CircleCheckBig size={14} aria-hidden="true" />;
    case 'archived':
      return <Archive size={14} aria-hidden="true" />;
  }
}
