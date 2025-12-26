/**
 * NavigationPanel component
 * Bottom panel showing waypoint info, ETA, and controls
 */

import type { Waypoint } from '../types';
import { formatDistance } from '../utils/mapbox';
import { ProgressBar } from './ProgressBar';
import { TOUCH_TARGET } from '../utils/constants';

export interface NavigationPanelProps {
  nextWaypoint: Waypoint | null;
  distanceToWaypoint: number;
  eta: string | null;
  routeProgress: number;
  canCompleteWaypoint: boolean;
  onCompleteWaypoint: () => void;
  onStopNavigation: () => void;
  completedWaypoints: number;
  totalWaypoints: number;
}

export function NavigationPanel({
  nextWaypoint,
  distanceToWaypoint,
  eta,
  routeProgress,
  canCompleteWaypoint,
  onCompleteWaypoint,
  onStopNavigation,
  completedWaypoints,
  totalWaypoints,
}: NavigationPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        right: '1rem',
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '1rem',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
        borderRadius: '16px',
      }}
    >
      {/* Progress Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#616161' }}>
            Route Progress
          </span>
          <span style={{ fontSize: '0.875rem', color: '#616161' }}>
            {completedWaypoints} / {totalWaypoints} waypoints
          </span>
        </div>
        <ProgressBar progress={routeProgress} height={8} />
      </div>

      {/* Next Waypoint Info */}
      {nextWaypoint ? (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#616161', marginBottom: '0.25rem' }}>
            Next Stop
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#212121', marginBottom: '0.5rem' }}>
            {nextWaypoint.name || nextWaypoint.address || 'Unnamed Waypoint'}
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#616161' }}>
            <div>
              <span style={{ fontWeight: 600 }}>Distance:</span> {formatDistance(distanceToWaypoint)}
            </div>
            {eta && (
              <div>
                <span style={{ fontWeight: 600 }}>ETA:</span> {eta}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1rem', textAlign: 'center', color: '#616161' }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🎉</div>
          <div>All waypoints completed!</div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {nextWaypoint && (
          <button
            onClick={onCompleteWaypoint}
            disabled={!canCompleteWaypoint}
            style={{
              flex: 1,
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '12px',
              cursor: canCompleteWaypoint ? 'pointer' : 'not-allowed',
              background: canCompleteWaypoint
                ? 'linear-gradient(135deg, #43A047 0%, #66BB6A 100%)'
                : '#E0E0E0',
              color: canCompleteWaypoint ? 'white' : '#9E9E9E',
              boxShadow: canCompleteWaypoint ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
              minHeight: TOUCH_TARGET.minimum,
            }}
          >
            ✓ Mark Complete
          </button>
        )}
        <button
          onClick={onStopNavigation}
          style={{
            flex: nextWaypoint ? 0 : 1,
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            border: '2px solid #D32F2F',
            borderRadius: '12px',
            cursor: 'pointer',
            backgroundColor: 'white',
            color: '#D32F2F',
            minWidth: nextWaypoint ? '120px' : 'auto',
            minHeight: TOUCH_TARGET.minimum,
            transition: 'all 0.2s',
          }}
        >
          {nextWaypoint ? 'Stop' : 'Exit Navigation'}
        </button>
      </div>
    </div>
  );
}
