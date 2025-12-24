import type { RouteStatus } from '../types';
import { getStatusColor, getStatusLabel } from '../utils/routeHelpers';

export interface RouteStatusBadgeProps {
  status: RouteStatus;
  className?: string;
}

/**
 * Badge component to display route status with appropriate styling
 */
export function RouteStatusBadge({ status, className = '' }: RouteStatusBadgeProps) {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);
  
  // Status icons
  const icons: Record<RouteStatus, string> = {
    draft: '📝',
    published: '📅',
    active: '🔴',
    completed: '✅',
    archived: '📦',
  };

  return (
    <span
      className={`route-status-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.25rem 0.75rem',
        borderRadius: '12px',
        fontSize: '0.875rem',
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color: color,
        border: `1.5px solid ${color}`,
      }}
    >
      <span>{icons[status]}</span>
      <span>{label}</span>
    </span>
  );
}
