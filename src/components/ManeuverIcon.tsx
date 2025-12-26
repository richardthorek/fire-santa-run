/**
 * ManeuverIcon component
 * Visual icons for turn-by-turn navigation maneuvers
 */

export interface ManeuverIconProps {
  type: string;
  modifier?: string;
  size?: number;
}

export function ManeuverIcon({ type, modifier, size = 48 }: ManeuverIconProps) {
  const getIcon = () => {
    // Combine type and modifier to determine icon
    const key = `${type}-${modifier || 'none'}`;

    switch (key) {
      case 'turn-left':
      case 'turn-slight left':
        return '↰';
      case 'turn-sharp left':
        return '⮜';
      case 'turn-right':
      case 'turn-slight right':
        return '↱';
      case 'turn-sharp right':
        return '⮞';
      case 'turn-straight':
      case 'continue-none':
        return '↑';
      case 'depart-none':
        return '🚗';
      case 'arrive-none':
        return '🏁';
      case 'merge-left':
        return '⮜';
      case 'merge-right':
        return '⮞';
      case 'merge-slight left':
        return '↰';
      case 'merge-slight right':
        return '↱';
      case 'fork-left':
      case 'fork-slight left':
        return '↖';
      case 'fork-right':
      case 'fork-slight right':
        return '↗';
      case 'roundabout-none':
      case 'rotary-none':
        return '⭮';
      case 'roundabout-left':
        return '⮜';
      case 'roundabout-right':
        return '⮞';
      case 'exit roundabout-none':
        return '↗';
      case 'new name-none':
      case 'notification-none':
        return 'ℹ️';
      default:
        return '➜';
    }
  };

  return (
    <div
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
      }}
      aria-label={`${modifier ? `${modifier} ` : ''}${type}`}
    >
      {getIcon()}
    </div>
  );
}
