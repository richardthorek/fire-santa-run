import { COLORS } from '../utils/constants';
import type { MemberRole } from '../types/membership';

export interface RoleBadgeProps {
  role: MemberRole;
  size?: 'small' | 'medium';
}

/**
 * RoleBadge Component
 * 
 * Displays a styled badge for brigade member roles.
 * Each role has a distinct color matching the design system.
 */
export function RoleBadge({ role, size = 'medium' }: RoleBadgeProps) {
  const getBadgeStyle = (role: MemberRole) => {
    const styles = {
      admin: {
        backgroundColor: COLORS.fireRed,
        color: 'white',
        label: 'Admin',
      },
      operator: {
        backgroundColor: COLORS.summerGold,
        color: 'white',
        label: 'Operator',
      },
      viewer: {
        backgroundColor: COLORS.neutral700,
        color: 'white',
        label: 'Viewer',
      },
    };
    
    return styles[role] || styles.viewer;
  };

  const badge = getBadgeStyle(role);
  const padding = size === 'small' ? '0.25rem 0.5rem' : '0.375rem 0.75rem';
  const fontSize = size === 'small' ? '0.75rem' : '0.875rem';

  return (
    <span
      style={{
        display: 'inline-block',
        padding,
        fontSize,
        fontWeight: 600,
        color: badge.color,
        backgroundColor: badge.backgroundColor,
        borderRadius: '12px',
        textTransform: 'capitalize',
      }}
    >
      {badge.label}
    </span>
  );
}
