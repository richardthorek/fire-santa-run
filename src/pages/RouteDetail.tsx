import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoutes } from '../hooks';
import { 
  MapView, 
  RouteStatusBadge, 
  ShareModal, 
  SEO, 
  LoadingSkeleton
} from '../components';
import type { Route } from '../types';
import { formatDistance, formatDuration } from '../utils/mapbox';
import { format } from 'date-fns';
import { COLORS, FLOATING_PANEL, Z_INDEX } from '../utils/constants';

export interface RouteDetailProps {
  routeId: string;
}

export function RouteDetail({ routeId }: RouteDetailProps) {
  const navigate = useNavigate();
  const { getRoute, deleteRoute } = useRoutes();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  useEffect(() => {
    const loadRoute = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const loadedRoute = await getRoute(routeId);
        setRoute(loadedRoute);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load route');
        setError(error);
        console.error('Error loading route:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRoute();
  }, [routeId, getRoute]);

  const handleDelete = async () => {
    if (!route) return;
    
    setIsDeleting(true);
    try {
      await deleteRoute(route.id);
      // Navigate back to dashboard after deletion
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to delete route:', err);
      alert('Failed to delete route. Please try again.');
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: Route['status']) => {
    if (!route) return;
    
    // Update route status
    const updatedRoute = { ...route, status: newStatus };
    
    // If publishing, set publishedAt timestamp
    if (newStatus === 'published' && !route.publishedAt) {
      updatedRoute.publishedAt = new Date().toISOString();
    }
    
    // If activating, set startedAt timestamp
    if (newStatus === 'active' && !route.startedAt) {
      updatedRoute.startedAt = new Date().toISOString();
    }
    
    // If completing, set completedAt timestamp
    if (newStatus === 'completed' && !route.completedAt) {
      updatedRoute.completedAt = new Date().toISOString();
    }
    
    setRoute(updatedRoute);
    
    // Save to storage (this would need to be implemented in useRoutes)
    // For now, just update local state
  };

  if (isLoading) {
    return (
      <>
        <SEO title="Loading Route..." description="Loading route details" />
        <LoadingSkeleton />
      </>
    );
  }

  if (error || !route) {
    return (
      <>
        <SEO title="Route Not Found" description="The requested route could not be found" />
        <div style={{ 
          padding: '4rem 2rem', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: COLORS.fireRed, marginBottom: '1rem' }}>Route Not Found</h2>
          <p style={{ color: COLORS.neutral700, maxWidth: '400px', marginBottom: '2rem' }}>
            {error?.message || 'The route you\'re looking for doesn\'t exist.'}
          </p>
          <a
            href="/dashboard"
            style={{
              padding: '0.75rem 1.5rem',
              background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
              color: 'white',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            ← Back to Dashboard
          </a>
        </div>
      </>
    );
  }

  const canNavigate = route.geometry && route.navigationSteps && route.navigationSteps.length > 0;
  const canShare = route.status === 'published' || route.status === 'active' || route.status === 'completed';

  return (
    <>
      <SEO 
        title={`${route.name} - Route Details`}
        description={route.description || `View details for ${route.name} Santa Run route`}
      />
      {/* Full-Screen Container */}
      <div style={{ 
        position: 'relative',
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
      }}>
        {/* Full-Screen Map */}
        <div style={{ width: '100%', height: '100%' }}>
          <MapView
            waypoints={route.waypoints}
            routeGeometry={route.geometry}
            center={route.waypoints.length > 0 ? route.waypoints[0].coordinates : undefined}
            zoom={12}
            showControls={true}
            interactive={true}
            height="100%"
          />
        </div>

        {/* Floating Header Panel */}
        <div style={{
          position: 'absolute',
          top: FLOATING_PANEL.spacing.edge,
          left: FLOATING_PANEL.spacing.edge,
          right: FLOATING_PANEL.spacing.edge,
          background: `rgba(255, 255, 255, ${FLOATING_PANEL.backdrop.opacity})`,
          backdropFilter: FLOATING_PANEL.backdrop.blur,
          WebkitBackdropFilter: FLOATING_PANEL.backdrop.blur,
          borderRadius: FLOATING_PANEL.borderRadius.standard,
          boxShadow: FLOATING_PANEL.shadow.standard,
          padding: FLOATING_PANEL.spacing.internal,
          zIndex: Z_INDEX.floatingPanel,
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Back Button */}
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: `2px solid ${COLORS.neutral300}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: COLORS.neutral900,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.fireRed;
                e.currentTarget.style.color = COLORS.fireRed;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.neutral300;
                e.currentTarget.style.color = COLORS.neutral900;
              }}
            >
              ← Back
            </button>

            {/* Route Title and Status */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: COLORS.neutral900 }}>
                  {route.name}
                </h1>
                <RouteStatusBadge status={route.status} />
              </div>
              {route.description && (
                <p style={{ margin: 0, color: COLORS.neutral700, fontSize: '0.875rem' }}>
                  {route.description}
                </p>
              )}
            </div>

            {/* Info Toggle Button */}
            <button
              onClick={() => setShowInfoPanel(!showInfoPanel)}
              style={{
                padding: '0.5rem 1rem',
                background: showInfoPanel 
                  ? `linear-gradient(135deg, ${COLORS.skyBlue} 0%, ${COLORS.oceanBlue} 100%)`
                  : 'transparent',
                border: `2px solid ${showInfoPanel ? COLORS.skyBlue : COLORS.neutral300}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: showInfoPanel ? 'white' : COLORS.neutral900,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {showInfoPanel ? '✕ Close Info' : 'ℹ️ Route Info'}
            </button>
          </div>

          {/* Quick Stats Bar */}
          <div style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            padding: '0.75rem',
            backgroundColor: 'rgba(245, 245, 245, 0.8)',
            borderRadius: '8px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: COLORS.fireRed, fontSize: '1.25rem' }}>
                {route.waypoints.length}
              </div>
              <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Stops</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: COLORS.summerGold, fontSize: '1.25rem' }}>
                {route.distance ? formatDistance(route.distance) : '—'}
              </div>
              <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Distance</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: COLORS.christmasGreen, fontSize: '1.25rem' }}>
                {route.estimatedDuration ? formatDuration(route.estimatedDuration) : '—'}
              </div>
              <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Duration</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: COLORS.neutral900, fontSize: '1.25rem' }}>
                {route.date ? format(new Date(route.date), 'MMM dd') : '—'}
              </div>
              <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Date</div>
            </div>
          </div>
        </div>

        {/* Floating Info Side Panel (Conditional) */}
        {showInfoPanel && (
          <div style={{
            position: 'absolute',
            top: '11rem',
            right: FLOATING_PANEL.spacing.edge,
            width: 'min(400px, calc(100vw - 2rem))',
            maxHeight: 'calc(100vh - 24rem)',
            background: `rgba(255, 255, 255, ${FLOATING_PANEL.backdrop.opacity})`,
            backdropFilter: FLOATING_PANEL.backdrop.blur,
            WebkitBackdropFilter: FLOATING_PANEL.backdrop.blur,
            borderRadius: FLOATING_PANEL.borderRadius.standard,
            boxShadow: FLOATING_PANEL.shadow.emphasis,
            padding: FLOATING_PANEL.spacing.internal,
            overflowY: 'auto',
            zIndex: Z_INDEX.floatingPanel,
          }}>
            {/* Waypoints List */}
            <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1rem', color: COLORS.neutral900 }}>
              📍 Waypoints ({route.waypoints.length})
            </h3>
            {route.waypoints.length === 0 ? (
              <p style={{ color: COLORS.neutral700, fontSize: '0.875rem' }}>
                No waypoints added yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {route.waypoints
                  .sort((a, b) => a.order - b.order)
                  .map((waypoint, index) => (
                    <div
                      key={waypoint.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '8px',
                        border: `1px solid ${COLORS.neutral200}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          backgroundColor: COLORS.christmasGreen,
                          color: 'white',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          flexShrink: 0,
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: COLORS.neutral900, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                            {waypoint.name || `Stop ${index + 1}`}
                          </div>
                          {waypoint.address && (
                            <div style={{ fontSize: '0.75rem', color: COLORS.neutral700 }}>
                              {waypoint.address}
                            </div>
                          )}
                          {waypoint.notes && (
                            <div style={{ fontSize: '0.75rem', color: COLORS.neutral700, marginTop: '0.25rem', fontStyle: 'italic' }}>
                              {waypoint.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Timestamps */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.neutral200}` }}>
              <h3 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '0.875rem', color: COLORS.neutral700 }}>
                Timeline
              </h3>
              <div style={{ fontSize: '0.75rem', color: COLORS.neutral700, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {route.createdAt && (
                  <div>📝 Created: {format(new Date(route.createdAt), 'MMM dd, h:mm a')}</div>
                )}
                {route.publishedAt && (
                  <div>📢 Published: {format(new Date(route.publishedAt), 'MMM dd, h:mm a')}</div>
                )}
                {route.startedAt && (
                  <div>🚀 Started: {format(new Date(route.startedAt), 'MMM dd, h:mm a')}</div>
                )}
                {route.completedAt && (
                  <div>✅ Completed: {format(new Date(route.completedAt), 'MMM dd, h:mm a')}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Floating Bottom Action Panel */}
        <div style={{
          position: 'absolute',
          bottom: FLOATING_PANEL.spacing.edge,
          left: FLOATING_PANEL.spacing.edge,
          right: FLOATING_PANEL.spacing.edge,
          background: `rgba(255, 255, 255, ${FLOATING_PANEL.backdrop.opacity})`,
          backdropFilter: FLOATING_PANEL.backdrop.blur,
          WebkitBackdropFilter: FLOATING_PANEL.backdrop.blur,
          borderRadius: FLOATING_PANEL.borderRadius.standard,
          boxShadow: FLOATING_PANEL.shadow.standard,
          padding: FLOATING_PANEL.spacing.internal,
          zIndex: Z_INDEX.floatingPanel,
        }}>
          {/* Primary Action Buttons */}
          <div style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}>
            {/* Navigate Button - Always shown */}
            <button
              onClick={() => canNavigate 
                ? navigate(`/routes/${route.id}/navigate`)
                : alert('Route must have waypoints and navigation data. Please edit the route to add stops.')
              }
              disabled={!canNavigate}
              style={{
                padding: '0.875rem 1rem',
                background: canNavigate
                  ? `linear-gradient(135deg, ${COLORS.skyBlue} 0%, ${COLORS.oceanBlue} 100%)`
                  : COLORS.neutral200,
                color: canNavigate ? 'white' : COLORS.neutral700,
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canNavigate ? 'pointer' : 'not-allowed',
                boxShadow: canNavigate ? '0 4px 12px rgba(41, 182, 246, 0.3)' : 'none',
                transition: 'transform 0.2s',
                opacity: canNavigate ? 1 : 0.6,
              }}
              onMouseEnter={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🧭 Navigate
            </button>

            {/* Preview Public Link Button */}
            <button
              onClick={() => {
                const trackingUrl = `/track/${route.id}`;
                window.open(trackingUrl, '_blank');
              }}
              style={{
                padding: '0.875rem 1rem',
                background: `linear-gradient(135deg, ${COLORS.summerGold} 0%, ${COLORS.summerGoldLight} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 167, 38, 0.3)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              👁️ Preview
            </button>

            {/* Edit Button */}
            <button
              onClick={() => navigate(`/routes/${route.id}/edit`)}
              style={{
                padding: '0.875rem 1rem',
                background: 'white',
                color: COLORS.neutral900,
                border: `2px solid ${COLORS.neutral300}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.fireRed;
                e.currentTarget.style.color = COLORS.fireRed;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.neutral300;
                e.currentTarget.style.color = COLORS.neutral900;
              }}
            >
              ✏️ Edit
            </button>

            {/* Share Button */}
            <button
              onClick={() => canShare ? setShareModalOpen(true) : alert('Route must be published before sharing')}
              disabled={!canShare}
              style={{
                padding: '0.875rem 1rem',
                background: canShare 
                  ? `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`
                  : COLORS.neutral200,
                color: canShare ? 'white' : COLORS.neutral700,
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canShare ? 'pointer' : 'not-allowed',
                opacity: canShare ? 1 : 0.6,
                boxShadow: canShare ? '0 4px 12px rgba(67, 160, 71, 0.3)' : 'none',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => canShare && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => canShare && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🔗 Share
            </button>
          </div>

          {/* Secondary Actions Row */}
          <div style={{
            marginTop: '0.75rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}>
            {/* Status Change Buttons */}
            {route.status === 'draft' && (
              <button
                onClick={() => handleStatusChange('published')}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.75rem 1rem',
                  background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: FLOATING_PANEL.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(67, 160, 71, 0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                📢 Publish Route
              </button>
            )}

            {route.status === 'published' && (
              <button
                onClick={() => handleStatusChange('active')}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.75rem 1rem',
                  background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: FLOATING_PANEL.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🎅 Start Tracking
              </button>
            )}

            {route.status === 'active' && (
              <button
                onClick={() => handleStatusChange('completed')}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.75rem 1rem',
                  background: `linear-gradient(135deg, ${COLORS.neutral700} 0%, ${COLORS.neutral800} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: FLOATING_PANEL.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                ✅ End Tracking
              </button>
            )}

            {/* Delete Button */}
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '0.75rem 1rem',
                background: 'white',
                color: COLORS.fireRed,
                border: `2px solid ${COLORS.fireRed}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = COLORS.fireRed;
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = COLORS.fireRed;
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <ShareModal
          route={route}
          isOpen={true}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirmOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ margin: 0, marginBottom: '0.5rem', textAlign: 'center', color: COLORS.neutral900 }}>
              Delete Route?
            </h3>
            <p style={{ margin: 0, marginBottom: '1.5rem', textAlign: 'center', color: COLORS.neutral700 }}>
              Are you sure you want to delete "{route.name}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'white',
                  color: COLORS.neutral900,
                  border: `2px solid ${COLORS.neutral300}`,
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: COLORS.fireRed,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
