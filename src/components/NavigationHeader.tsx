/**
 * NavigationHeader component
 * Top banner showing next turn instruction and distance
 */

import { ManeuverIcon } from './ManeuverIcon';
import { formatDistance } from '../utils/mapbox';

export interface NavigationHeaderProps {
  instruction: string;
  distance: number;
  maneuverType: string;
  maneuverModifier?: string;
  isOffRoute: boolean;
  isRerouting: boolean;
}

export function NavigationHeader({
  instruction,
  distance,
  maneuverType,
  maneuverModifier,
  isOffRoute,
  isRerouting,
}: NavigationHeaderProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 1000,
        backgroundColor: isOffRoute ? 'rgba(255, 112, 67, 0.95)' : 'rgba(211, 47, 47, 0.95)',
        backdropFilter: 'blur(10px)',
        color: 'white',
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        borderRadius: '16px',
        minHeight: '80px',
      }}
    >
      {/* Maneuver Icon */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '0.5rem',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ManeuverIcon type={maneuverType} modifier={maneuverModifier} size={40} />
      </div>

      {/* Instruction Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRerouting ? (
          <>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
              Recalculating route...
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Please wait
            </div>
          </>
        ) : isOffRoute ? (
          <>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
              Off Route
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              Calculating new route...
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
              {formatDistance(distance)}
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {instruction || 'Continue on route'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
