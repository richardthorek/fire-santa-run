import { useState, useEffect } from 'react';
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
import { COLORS } from '../utils/constants';

export interface RouteDetailProps {
  routeId: string;
}

export function RouteDetail({ routeId }: RouteDetailProps) {
  const { getRoute, deleteRoute } = useRoutes();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      window.location.href = '/dashboard';
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

  const shareableLink = route.shareableLink || `${window.location.origin}/track/${route.id}`;
  const canNavigate = route.geometry && route.navigationSteps && route.navigationSteps.length > 0;
  const canShare = route.status === 'published' || route.status === 'active' || route.status === 'completed';

  return (
    <>
      <SEO 
        title={`${route.name} - Route Details`}
        description={route.description || `View details for ${route.name} Santa Run route`}
      />
      <div style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'auto',
        backgroundColor: COLORS.neutral50,
      }}>
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <a
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: COLORS.neutral700,
                textDecoration: 'none',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = COLORS.fireRed}
              onMouseLeave={(e) => e.currentTarget.style.color = COLORS.neutral700}
            >
              ← Back to Dashboard
            </a>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'start',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <h1 style={{ margin: 0, fontSize: '2rem', color: COLORS.neutral900 }}>
                    {route.name}
                  </h1>
                  <RouteStatusBadge status={route.status} />
                </div>
                {route.description && (
                  <p style={{ margin: 0, color: COLORS.neutral700, fontSize: '1rem' }}>
                    {route.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div style={{ 
            display: 'grid', 
            gap: '1.5rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          }}>
            {/* Map Preview Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              gridColumn: '1 / -1',
            }}>
              <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.25rem', color: COLORS.neutral900 }}>
                🗺️ Route Map
              </h2>
              <div style={{ 
                borderRadius: '8px', 
                overflow: 'hidden',
                border: `1px solid ${COLORS.neutral200}`,
              }}>
                <MapView
                  waypoints={route.waypoints}
                  routeGeometry={route.geometry}
                  center={route.waypoints.length > 0 ? route.waypoints[0].coordinates : undefined}
                  zoom={12}
                  showControls={true}
                  interactive={true}
                  height="400px"
                />
              </div>
            </div>

            {/* Route Information Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.25rem', color: COLORS.neutral900 }}>
                📋 Route Information
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Date & Time */}
                <div>
                  <div style={{ fontSize: '0.875rem', color: COLORS.neutral700, marginBottom: '0.25rem' }}>
                    Date & Time
                  </div>
                  <div style={{ fontSize: '1rem', color: COLORS.neutral900, fontWeight: 600 }}>
                    📅 {route.date ? format(new Date(route.date), 'MMMM dd, yyyy') : 'Not set'}
                  </div>
                  <div style={{ fontSize: '1rem', color: COLORS.neutral900 }}>
                    🕐 {route.startTime || 'Not set'}
                    {route.endTime && ` - ${route.endTime}`}
                  </div>
                </div>

                {/* Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: COLORS.neutral100,
                  borderRadius: '8px',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: COLORS.fireRed, fontSize: '1.5rem' }}>
                      {route.waypoints.length}
                    </div>
                    <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Stops</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: COLORS.summerGold, fontSize: '1.5rem' }}>
                      {route.distance ? formatDistance(route.distance) : '—'}
                    </div>
                    <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Distance</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: COLORS.christmasGreen, fontSize: '1.5rem' }}>
                      {route.estimatedDuration ? formatDuration(route.estimatedDuration) : '—'}
                    </div>
                    <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Duration</div>
                  </div>
                </div>

                {/* Timestamps */}
                <div style={{ fontSize: '0.875rem', color: COLORS.neutral700 }}>
                  {route.createdAt && (
                    <div>Created: {format(new Date(route.createdAt), 'MMM dd, yyyy h:mm a')}</div>
                  )}
                  {route.publishedAt && (
                    <div>Published: {format(new Date(route.publishedAt), 'MMM dd, yyyy h:mm a')}</div>
                  )}
                  {route.startedAt && (
                    <div>Started: {format(new Date(route.startedAt), 'MMM dd, yyyy h:mm a')}</div>
                  )}
                  {route.completedAt && (
                    <div>Completed: {format(new Date(route.completedAt), 'MMM dd, yyyy h:mm a')}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Waypoints Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}>
              <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.25rem', color: COLORS.neutral900 }}>
                📍 Waypoints ({route.waypoints.length})
              </h2>
              
              {route.waypoints.length === 0 ? (
                <p style={{ color: COLORS.neutral700, fontSize: '0.875rem' }}>
                  No waypoints added yet.
                </p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {route.waypoints
                    .sort((a, b) => a.order - b.order)
                    .map((waypoint, index) => (
                      <div
                        key={waypoint.id}
                        style={{
                          padding: '0.75rem',
                          marginBottom: '0.5rem',
                          backgroundColor: COLORS.neutral50,
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
                            <div style={{ fontWeight: 600, color: COLORS.neutral900, marginBottom: '0.25rem' }}>
                              {waypoint.name || `Stop ${index + 1}`}
                            </div>
                            {waypoint.address && (
                              <div style={{ fontSize: '0.875rem', color: COLORS.neutral700 }}>
                                {waypoint.address}
                              </div>
                            )}
                            {waypoint.notes && (
                              <div style={{ fontSize: '0.75rem', color: COLORS.neutral700, marginTop: '0.25rem' }}>
                                {waypoint.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{
            marginTop: '2rem',
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          }}>
            {/* Navigate Button */}
            {canNavigate && (
              <button
                onClick={() => window.location.href = `/routes/${route.id}/navigate`}
                style={{
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${COLORS.skyBlue} 0%, ${COLORS.oceanBlue} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(41, 182, 246, 0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                🧭 Start Navigation
              </button>
            )}

            {/* Edit Button */}
            <button
              onClick={() => window.location.href = `/routes/${route.id}/edit`}
              style={{
                padding: '1rem',
                background: 'white',
                color: COLORS.neutral900,
                border: `2px solid ${COLORS.neutral300}`,
                borderRadius: '12px',
                fontSize: '1rem',
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
              ✏️ Edit Route
            </button>

            {/* Share Button */}
            <button
              onClick={() => canShare ? setShareModalOpen(true) : alert('Route must be published before sharing')}
              disabled={!canShare}
              style={{
                padding: '1rem',
                background: canShare 
                  ? `linear-gradient(135deg, ${COLORS.summerGold} 0%, ${COLORS.summerGoldLight} 100%)`
                  : COLORS.neutral200,
                color: canShare ? 'white' : COLORS.neutral700,
                border: 'none',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: canShare ? 'pointer' : 'not-allowed',
                opacity: canShare ? 1 : 0.5,
                boxShadow: canShare ? '0 4px 12px rgba(255, 167, 38, 0.3)' : 'none',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => canShare && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => canShare && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              🔗 Share Route
            </button>

            {/* Status Change Buttons */}
            {route.status === 'draft' && (
              <button
                onClick={() => handleStatusChange('published')}
                style={{
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
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
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
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
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${COLORS.neutral700} 0%, ${COLORS.neutral800} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
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
                padding: '1rem',
                background: 'white',
                color: COLORS.fireRed,
                border: `2px solid ${COLORS.fireRed}`,
                borderRadius: '12px',
                fontSize: '1rem',
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
              🗑️ Delete Route
            </button>
          </div>

          {/* Public Tracking Link (if published) */}
          {canShare && (
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: COLORS.sandLight,
              borderRadius: '12px',
              border: `2px solid ${COLORS.summerGold}`,
            }}>
              <h3 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '1rem', color: COLORS.neutral900 }}>
                📡 Public Tracking Link
              </h3>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <input
                  type="text"
                  value={shareableLink}
                  readOnly
                  style={{
                    flex: 1,
                    minWidth: '300px',
                    padding: '0.75rem',
                    border: `1px solid ${COLORS.neutral300}`,
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareableLink);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: COLORS.skyBlue,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📋 Copy Link
                </button>
              </div>
            </div>
          )}
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
