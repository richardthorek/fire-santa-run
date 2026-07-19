import { COLORS } from '../utils/constants';

/** StationKit suite role (Station Manager owner/admin/viewer). */
export type SuiteRole = 'owner' | 'admin' | 'viewer';

export interface RoleBadgeProps {
  role: SuiteRole;
  size?: 'small' | 'medium';
}

/**
 * RoleBadge Component
 *
 * Displays a styled badge for a member's StationKit role.
 * Each role has a distinct color matching the design system.
 */
export function RoleBadge({ role, size = 'medium' }: RoleBadgeProps) {
  const getBadgeStyle = (role: SuiteRole) => {
    const styles = {
      owner: {
        backgroundColor: COLORS.fireRed,
        color: 'white',
        label: 'Owner',
      },
      admin: {
        backgroundColor: COLORS.summerGold,
        color: 'white',
        label: 'Admin',
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
