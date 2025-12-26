/**
 * Loading skeleton components
 * Provides visual feedback during async operations
 */

import { COLORS } from '../utils/constants';

export function SkeletonBox({ width = '100%', height = '20px', borderRadius = '8px' }: {
  width?: string;
  height?: string;
  borderRadius?: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: COLORS.neutral200,
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

export function RouteCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <SkeletonBox width="60%" height="28px" />
        <SkeletonBox width="80px" height="28px" borderRadius="12px" />
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <SkeletonBox width="40%" height="18px" />
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <SkeletonBox width="30%" height="18px" />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <SkeletonBox width="100px" height="36px" borderRadius="12px" />
        <SkeletonBox width="100px" height="36px" borderRadius="12px" />
        <SkeletonBox width="100px" height="36px" borderRadius="12px" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '2rem' }}>
        <SkeletonBox width="300px" height="36px" />
        <div style={{ marginTop: '0.5rem' }}>
          <SkeletonBox width="400px" height="20px" />
        </div>
      </div>

      {/* Filter tabs skeleton */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <SkeletonBox width="80px" height="40px" borderRadius="12px" />
        <SkeletonBox width="80px" height="40px" borderRadius="12px" />
        <SkeletonBox width="80px" height="40px" borderRadius="12px" />
        <SkeletonBox width="80px" height="40px" borderRadius="12px" />
      </div>

      {/* Route cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        <RouteCardSkeleton />
        <RouteCardSkeleton />
        <RouteCardSkeleton />
      </div>

      {/* Inline CSS for animation */}
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.neutral100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🗺️</div>
        <p style={{ color: COLORS.neutral700 }}>Loading map...</p>
      </div>
      
      {/* Animated background */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(90deg, ${COLORS.neutral100} 0%, ${COLORS.neutral200} 50%, ${COLORS.neutral100} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'skeleton-shimmer 2s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes skeleton-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
