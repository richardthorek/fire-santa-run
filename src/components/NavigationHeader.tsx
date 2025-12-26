/**
 * NavigationHeader component
 * Top banner showing next turn instruction and distance
 */

import { ManeuverIcon } from './ManeuverIcon';
import { formatDistance } from '../utils/mapbox';
import { FLOATING_PANEL, Z_INDEX } from '../utils/constants';

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
        top: FLOATING_PANEL.spacing.edge,
        left: FLOATING_PANEL.spacing.edge,
        right: FLOATING_PANEL.spacing.edge,
        zIndex: Z_INDEX.floatingPanel,
        backgroundColor: isOffRoute ? 'rgba(255, 112, 67, 0.95)' : 'rgba(211, 47, 47, 0.95)',
        backdropFilter: FLOATING_PANEL.backdrop.blur,
        color: 'white',
        padding: FLOATING_PANEL.spacing.edge,
        display: 'flex',
        alignItems: 'center',
        gap: FLOATING_PANEL.spacing.edge,
        boxShadow: FLOATING_PANEL.shadow.standard,
        borderRadius: FLOATING_PANEL.borderRadius.standard,
        minHeight: FLOATING_PANEL.dimensions.navigationHeaderHeight,
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
