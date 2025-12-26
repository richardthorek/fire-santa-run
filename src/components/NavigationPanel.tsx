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
  onSkipToNext: () => void;
  onStopNavigation: () => void;
  completedWaypoints: number;
  totalWaypoints: number;
  waypoints: Waypoint[];
}

export function NavigationPanel({
  nextWaypoint,
  distanceToWaypoint,
  eta,
  routeProgress,
  canCompleteWaypoint,
  onCompleteWaypoint,
  onSkipToNext,
  onStopNavigation,
  completedWaypoints,
  totalWaypoints,
  waypoints,
}: NavigationPanelProps) {
  // Find waypoint after next
  const waypointAfterNext = nextWaypoint 
    ? waypoints.find(wp => !wp.isCompleted && wp.order > nextWaypoint.order)
    : null;

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
            {completedWaypoints} / {totalWaypoints} stops
          </span>
        </div>
        <ProgressBar progress={routeProgress} height={8} />
      </div>

      {/* Waypoints Display */}
      {nextWaypoint ? (
        <div>
          {/* Current and Next Waypoint Row */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {/* Current Waypoint - 2/3 width */}
            <div
              style={{
                flex: '2',
                backgroundColor: '#F5F5F5',
                padding: '1rem',
                borderRadius: '12px',
                border: '2px solid #43A047',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#616161', marginBottom: '0.25rem', fontWeight: 600 }}>
                CURRENT STOP {nextWaypoint.order}/{totalWaypoints}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#212121', marginBottom: '0.5rem', lineHeight: '1.3' }}>
                {nextWaypoint.name || nextWaypoint.address || 'Unnamed Waypoint'}
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#616161' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>📍</span> {formatDistance(distanceToWaypoint)}
                </div>
                {eta && (
                  <div>
                    <span style={{ fontWeight: 600 }}>🕐</span> {eta}
                  </div>
                )}
              </div>
            </div>

            {/* Next Waypoint Preview - 1/3 width with NEXT button */}
            {waypointAfterNext && (
              <button
                onClick={onSkipToNext}
                style={{
                  flex: '1',
                  backgroundColor: '#FFA726',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(255, 167, 38, 0.3)',
                  transition: 'all 0.2s',
                  minHeight: TOUCH_TARGET.minimum,
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#424242', marginBottom: '0.25rem', fontWeight: 600 }}>
                  NEXT
                </div>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                  →
                </div>
                <div style={{ fontSize: '0.75rem', color: '#212121', fontWeight: 'bold', textAlign: 'center', lineHeight: '1.2' }}>
                  {waypointAfterNext.name || waypointAfterNext.address || `Stop ${waypointAfterNext.order}`}
                </div>
              </button>
            )}
          </div>

          {/* Action Buttons Row */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
              ✓ Arrived
            </button>
            <button
              onClick={onStopNavigation}
              style={{
                padding: '1rem',
                fontSize: '1rem',
                fontWeight: 'bold',
                border: '2px solid #D32F2F',
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: 'white',
                color: '#D32F2F',
                minWidth: '120px',
                minHeight: TOUCH_TARGET.minimum,
                transition: 'all 0.2s',
              }}
            >
              Stop
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem', textAlign: 'center', color: '#616161' }}>
            <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>🎉</div>
            <div>All stops completed!</div>
          </div>
          <button
            onClick={onStopNavigation}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              minHeight: TOUCH_TARGET.minimum,
            }}
          >
            Exit Navigation
          </button>
        </div>
      )}
    </div>
  );
}
