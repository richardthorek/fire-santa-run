import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoutes } from '../hooks';
import { useTileCache } from '../hooks/useTileCache';
import { useAuth } from '../context';
import {
  MapView,
  RouteStatusBadge,
  ShareModal,
  RoutePreviewModal,
  SEO,
  LoadingSkeleton,
  ExportMenu,
  RouteComments
} from '../components';
import type { Route, RouteStatus } from '../types';
import type { Brigade } from '../storage/types';
import { storageAdapter } from '../storage';
import { formatDistance, formatDuration } from '../utils/mapbox';
import { duplicateRoute, canEditRoute, canDeleteRoute, routeEditNeedsPublicWarning } from '../utils/routeHelpers';
import { primeGeolocationPermission } from '../utils/primeGeolocation';
import { predictRouteDuration, CONFIDENCE_LABELS } from '../utils/etaPrediction';
import { format } from 'date-fns';
import { COLORS, FLOATING_PANEL, Z_INDEX } from '../utils/constants';

export interface RouteDetailProps {
  routeId: string;
}

export function RouteDetail({ routeId }: RouteDetailProps) {
  const navigate = useNavigate();
  const { routes, getRoute, deleteRoute, saveRoute, archiveRoute, restoreRoute } = useRoutes();
  const { user } = useAuth();
  const [route, setRoute] = useState<Route | null>(null);
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const { isCached, isCaching, downloaded, total, error: tileError, downloadTiles, clearTileCache } =
    useTileCache(route);

  const canNavigate = !!(route?.geometry && route?.navigationSteps && route.navigationSteps.length > 0);

  useEffect(() => {
    const loadRoute = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const loadedRoute = await getRoute(routeId);
        setRoute(loadedRoute);
        if (loadedRoute?.brigadeId) {
          storageAdapter.getBrigade(loadedRoute.brigadeId).then(setBrigade).catch(() => setBrigade(null));
        }
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

  const handleDuplicate = async () => {
    if (!route) return;

    setIsDuplicating(true);
    try {
      const copy = duplicateRoute(route);
      await saveRoute(copy);
      navigate(`/routes/${copy.id}`);
    } catch (err) {
      console.error('Failed to duplicate route:', err);
      alert('Failed to duplicate route. Please try again.');
      setIsDuplicating(false);
    }
  };

  const handleArchive = async () => {
    if (!route) return;
    setIsArchiving(true);
    try {
      await archiveRoute(route.id);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to archive route:', err);
      alert('Failed to archive route. Please try again.');
      setIsArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!route) return;
    setIsRestoring(true);
    try {
      await restoreRoute(route.id);
      // Reload route to reflect updated status
      const updated = await getRoute(routeId);
      setRoute(updated);
    } catch (err) {
      console.error('Failed to restore route:', err);
      alert('Failed to restore route. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleEditClick = () => {
    if (!route) return;
    if (!canEditRoute(route.status)) return;
    if (routeEditNeedsPublicWarning(route.status)) {
      const confirmed = window.confirm(
        'This run is public — changes will show on the tracking page and poster. Continue editing?'
      );
      if (!confirmed) return;
    }
    navigate(`/routes/${route.id}/edit`);
  };

  const handleNavigateClick = () => {
    if (!route || !canNavigate) {
      alert('Route must have waypoints and navigation data. Please edit the route to add stops.');
      return;
    }
    if (route.status === 'published') {
      const confirmed = window.confirm(
        'Starting this run will make Santa live for the public — the tracking page will show real-time location. Start now?'
      );
      if (!confirmed) return;
    }
    primeGeolocationPermission();
    navigate(`/routes/${route.id}/navigate`);
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
    
    // If completing, set completedAt timestamp and record the actual duration
    // so the predictive ETA model (#145) learns from this run
    if (newStatus === 'completed' && !route.completedAt) {
      updatedRoute.completedAt = new Date().toISOString();
      if (!updatedRoute.actualDuration && route.startedAt) {
        updatedRoute.actualDuration = Math.round(
          (Date.now() - new Date(route.startedAt).getTime()) / 1000
        );
      }
    }
    
    setRoute(updatedRoute);
    
    try {
      await saveRoute(updatedRoute);
    } catch (err) {
      console.error('Failed to save route status change:', err);
      alert('Failed to update route status. Please try again.');
      // Revert local state on error
      setRoute(route);
    }
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

  const canShare = route.status === 'published' || route.status === 'active' || route.status === 'completed';
  // The Navigate button doubles as the single "go live" action for published
  // (Start Run) and active (Resume Run) routes — see handleNavigateClick.
  const isGoLiveAction = route.status === 'published' || route.status === 'active';
  const navigateLabel = route.status === 'active'
    ? '🔴 Resume Run'
    : route.status === 'published'
    ? '🚀 Start Run'
    : '🧭 Navigate';
  // Predictive ETA (#145): adjust the estimate using the brigade's completed-run history
  const etaPrediction = route.status !== 'completed' && route.status !== 'archived'
    ? predictRouteDuration(route, routes)
    : null;

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

          {/* Lifecycle Stepper — Draft → Published → Live → Done, with the
              next action called out so the run's status is never a mystery. */}
          <LifecycleStepper status={route.status} />

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
            {etaPrediction && (
              <div style={{ textAlign: 'center' }} title={CONFIDENCE_LABELS[etaPrediction.confidence]}>
                <div style={{ fontWeight: 600, color: COLORS.oceanBlue, fontSize: '1.25rem' }}>
                  {formatDuration(etaPrediction.duration)}
                  <span aria-hidden="true" style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                    {etaPrediction.confidence === 'high' ? '●●●' : etaPrediction.confidence === 'medium' ? '●●○' : '●○○'}
                  </span>
                </div>
                <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>
                  Predicted ({etaPrediction.sampleCount} past run{etaPrediction.sampleCount === 1 ? '' : 's'})
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, color: COLORS.neutral900, fontSize: '1.25rem' }}>
                {route.date ? format(new Date(route.date), 'MMM dd') : '—'}
              </div>
              <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Date</div>
            </div>
            {route.rerouteCount != null && route.rerouteCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#FF7043', fontSize: '1.25rem' }}>
                  {route.rerouteCount}
                </div>
                <div style={{ color: COLORS.neutral700, fontSize: '0.75rem' }}>Reroutes</div>
              </div>
            )}
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
                {route.archivedAt && (
                  <div>📦 Archived: {format(new Date(route.archivedAt), 'MMM dd, h:mm a')}</div>
                )}
                {route.lastEditedBy && (
                  <div>✏️ Last edited by {route.lastEditedBy.userName}: {format(new Date(route.lastEditedBy.at), 'MMM dd, h:mm a')}</div>
                )}
              </div>
            </div>

            {/* Comments (#151 — brigade collaboration) */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: `1px solid ${COLORS.neutral200}` }}>
              <RouteComments
                route={route}
                currentUser={user ? { id: user.id, name: user.name || user.email } : null}
                onSave={async (updated) => {
                  await saveRoute(updated);
                  setRoute(updated);
                }}
              />
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
            {/* Navigate Button — the single "go live" action for published/active
                routes (Start Run / Resume Run), sized and coloured to be the
                unmistakable primary action; a plain preview Navigate otherwise. */}
            <button
              onClick={handleNavigateClick}
              disabled={!canNavigate}
              title={!canNavigate ? 'Route must have waypoints and navigation data. Please edit the route to add stops.' : undefined}
              style={{
                padding: '0.875rem 1rem',
                gridColumn: isGoLiveAction ? '1 / -1' : undefined,
                background: canNavigate
                  ? isGoLiveAction
                    ? `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`
                    : `linear-gradient(135deg, ${COLORS.skyBlue} 0%, ${COLORS.oceanBlue} 100%)`
                  : COLORS.neutral200,
                color: canNavigate ? 'white' : COLORS.neutral700,
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: isGoLiveAction ? '1rem' : '0.875rem',
                fontWeight: 700,
                cursor: canNavigate ? 'pointer' : 'not-allowed',
                boxShadow: canNavigate
                  ? isGoLiveAction ? '0 6px 16px rgba(211, 47, 47, 0.4)' : '0 4px 12px rgba(41, 182, 246, 0.3)'
                  : 'none',
                transition: 'transform 0.2s',
                opacity: canNavigate ? 1 : 0.6,
              }}
              onMouseEnter={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {navigateLabel}
            </button>

            {/* Preview Instructions Button */}
            <button
              onClick={() => canNavigate
                ? setPreviewModalOpen(true)
                : alert('Route must have navigation data. Please edit the route to fetch directions.')
              }
              disabled={!canNavigate}
              style={{
                padding: '0.875rem 1rem',
                background: canNavigate
                  ? `linear-gradient(135deg, ${COLORS.neutral700} 0%, ${COLORS.neutral800} 100%)`
                  : COLORS.neutral200,
                color: canNavigate ? 'white' : COLORS.neutral700,
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canNavigate ? 'pointer' : 'not-allowed',
                boxShadow: canNavigate ? '0 4px 12px rgba(66, 66, 66, 0.25)' : 'none',
                transition: 'transform 0.2s',
                opacity: canNavigate ? 1 : 0.6,
              }}
              onMouseEnter={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => canNavigate && (e.currentTarget.style.transform = 'translateY(0)')}
            >
              📋 Preview Instructions
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

            {/* Edit Button — disabled for live (active) routes; published
                routes get a "this is public" confirm inside handleEditClick. */}
            <button
              onClick={handleEditClick}
              disabled={!canEditRoute(route.status)}
              title={
                !canEditRoute(route.status)
                  ? 'This run is currently live — end it before making changes.'
                  : routeEditNeedsPublicWarning(route.status)
                  ? 'This run is public — changes will show on the tracking page and poster.'
                  : undefined
              }
              style={{
                padding: '0.875rem 1rem',
                background: 'white',
                color: canEditRoute(route.status) ? COLORS.neutral900 : COLORS.neutral700,
                border: `2px solid ${canEditRoute(route.status) ? COLORS.neutral300 : COLORS.neutral200}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canEditRoute(route.status) ? 'pointer' : 'not-allowed',
                opacity: canEditRoute(route.status) ? 1 : 0.6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!canEditRoute(route.status)) return;
                e.currentTarget.style.borderColor = COLORS.fireRed;
                e.currentTarget.style.color = COLORS.fireRed;
              }}
              onMouseLeave={(e) => {
                if (!canEditRoute(route.status)) return;
                e.currentTarget.style.borderColor = COLORS.neutral300;
                e.currentTarget.style.color = COLORS.neutral900;
              }}
            >
              {canEditRoute(route.status) ? '✏️ Edit' : '🔒 Edit'}
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

            {/* Analytics Button */}
            <button
              onClick={() => navigate(`/routes/${route.id}/analytics`)}
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
                e.currentTarget.style.borderColor = COLORS.skyBlue;
                e.currentTarget.style.color = COLORS.skyBlue;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.neutral300;
                e.currentTarget.style.color = COLORS.neutral900;
              }}
            >
              📊 Analytics
            </button>

            {/* Export Button */}
            <button
              onClick={() => setExportMenuOpen(true)}
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
                e.currentTarget.style.borderColor = COLORS.christmasGreen;
                e.currentTarget.style.color = COLORS.christmasGreen;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.neutral300;
                e.currentTarget.style.color = COLORS.neutral900;
              }}
            >
              📤 Export
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

            {/* Going live is handled by the primary Navigate/Start Run button
                above (which opens the navigator, where tracking actually
                begins) — no separate "start" action here, so there's only
                ever one path to going live. */}

            {route.status === 'active' && (
              <button
                onClick={() => {
                  if (window.confirm('End this run now? The public tracking page will show the run as finished.')) {
                    handleStatusChange('completed');
                  }
                }}
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
                🏁 End Run
              </button>
            )}

            {/* Archive button for completed routes */}
            {route.status === 'completed' && (
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.75rem 1rem',
                  background: 'white',
                  color: COLORS.neutral700,
                  border: `2px solid #9E9E9E`,
                  borderRadius: FLOATING_PANEL.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isArchiving ? 'not-allowed' : 'pointer',
                  opacity: isArchiving ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isArchiving) {
                    e.currentTarget.style.background = COLORS.neutral200;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                {isArchiving ? 'Archiving...' : '📦 Archive'}
              </button>
            )}

            {/* Restore button for archived routes */}
            {route.status === 'archived' && (
              <button
                onClick={handleRestore}
                disabled={isRestoring}
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
                  cursor: isRestoring ? 'not-allowed' : 'pointer',
                  opacity: isRestoring ? 0.5 : 1,
                  boxShadow: '0 4px 12px rgba(67, 160, 71, 0.3)',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={(e) => !isRestoring && (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {isRestoring ? 'Restoring...' : '♻️ Restore from Archive'}
              </button>
            )}

            {/* Duplicate Button */}
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '0.75rem 1rem',
                background: 'white',
                color: COLORS.summerGold,
                border: `2px solid ${COLORS.summerGold}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isDuplicating ? 'not-allowed' : 'pointer',
                opacity: isDuplicating ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isDuplicating) {
                  e.currentTarget.style.background = COLORS.summerGold;
                  e.currentTarget.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = COLORS.summerGold;
              }}
            >
              {isDuplicating ? 'Duplicating...' : '📋 Duplicate'}
            </button>

            {/* Download for Offline Use Button — only shown when route has waypoints */}
            {route.waypoints.length > 0 && (
              <button
                onClick={isCached ? clearTileCache : downloadTiles}
                disabled={isCaching}
                aria-label={
                  isCaching
                    ? `Downloading map tiles: ${downloaded} of ${total}`
                    : isCached
                    ? 'Map tiles cached — tap to clear'
                    : 'Download map tiles for offline use'
                }
                style={{
                  flex: 1,
                  minWidth: '140px',
                  padding: '0.75rem 1rem',
                  background: isCached
                    ? 'white'
                    : `linear-gradient(135deg, ${COLORS.deepNavyBlue} 0%, ${COLORS.oceanBlue} 100%)`,
                  color: isCached ? COLORS.deepNavyBlue : 'white',
                  border: `2px solid ${isCached ? COLORS.deepNavyBlue : 'transparent'}`,
                  borderRadius: FLOATING_PANEL.borderRadius.button,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: isCaching ? 'not-allowed' : 'pointer',
                  opacity: isCaching ? 0.8 : 1,
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Progress bar fill */}
                {isCaching && total > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,255,255,0.25)',
                      width: `${Math.round((downloaded / total) * 100)}%`,
                      transition: 'width 0.2s',
                    }}
                  />
                )}
                <span style={{ position: 'relative' }}>
                  {isCaching
                    ? `⬇️ ${total > 0 ? Math.round((downloaded / total) * 100) : 0}%`
                    : isCached
                    ? '✅ Offline Ready'
                    : '⬇️ Save Offline'}
                </span>
              </button>
            )}

            {/* Offline tile error message */}
            {tileError && (
              <div
                role="alert"
                style={{
                  flexBasis: '100%',
                  fontSize: '0.75rem',
                  color: COLORS.fireRed,
                  padding: '0.25rem 0',
                }}
              >
                ⚠️ {tileError}
              </div>
            )}

            {/* Delete Button — disabled for live/published routes (see
                canDeleteRoute); those must be ended/unpublished first. */}
            <button
              onClick={() => canDeleteRoute(route.status) && setDeleteConfirmOpen(true)}
              disabled={!canDeleteRoute(route.status)}
              title={
                !canDeleteRoute(route.status)
                  ? route.status === 'active'
                    ? 'This run is currently live — end it before deleting.'
                    : 'This run is published and public — it can\'t be deleted while published.'
                  : undefined
              }
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '0.75rem 1rem',
                background: 'white',
                color: canDeleteRoute(route.status) ? COLORS.fireRed : COLORS.neutral700,
                border: `2px solid ${canDeleteRoute(route.status) ? COLORS.fireRed : COLORS.neutral300}`,
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: canDeleteRoute(route.status) ? 'pointer' : 'not-allowed',
                opacity: canDeleteRoute(route.status) ? 1 : 0.6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!canDeleteRoute(route.status)) return;
                e.currentTarget.style.background = COLORS.fireRed;
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                if (!canDeleteRoute(route.status)) return;
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

      {/* Export Menu Modal */}
      {exportMenuOpen && (
        <ExportMenu
          route={route}
          brigade={brigade}
          onClose={() => setExportMenuOpen(false)}
        />
      )}

      {/* Route Preview (Turn-by-Turn) Modal */}
      {previewModalOpen && (
        <RoutePreviewModal
          route={route}
          isOpen={true}
          onClose={() => setPreviewModalOpen(false)}
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

// ---------------------------------------------------------------------------
// Lifecycle stepper — Draft → Published → Live → Done
// ---------------------------------------------------------------------------

const LIFECYCLE_STEPS: { key: 'draft' | 'published' | 'active' | 'completed'; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'active', label: 'Live' },
  { key: 'completed', label: 'Done' },
];

const LIFECYCLE_NEXT_ACTION: Record<Route['status'], string> = {
  draft: 'Next: publish this run to make it public',
  published: 'Next: start the run to go live for the public',
  active: 'Run is live — end it when Santa\'s finished',
  completed: 'Run complete',
  archived: 'Run complete and archived',
};

/**
 * Compact "you are here" indicator for a route's status lifecycle, with the
 * next action called out underneath so it's never a mystery what to do next.
 * `archived` is shown as the same completed final step (it's a completed run
 * that's been tidied away, not a distinct stage).
 */
function LifecycleStepper({ status }: { status: RouteStatus }) {
  const effectiveStatus = status === 'archived' ? 'completed' : status;
  const currentIndex = LIFECYCLE_STEPS.findIndex(s => s.key === effectiveStatus);

  return (
    <div style={{ marginTop: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {LIFECYCLE_STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const dotColor = isDone || isCurrent
            ? (step.key === 'active' ? COLORS.fireRed : COLORS.christmasGreen)
            : COLORS.neutral300;
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: index < LIFECYCLE_STEPS.length - 1 ? 1 : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: isCurrent ? '14px' : '10px',
                    height: isCurrent ? '14px' : '10px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    boxShadow: isCurrent ? `0 0 0 3px ${dotColor}33` : 'none',
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? COLORS.neutral900 : COLORS.neutral700,
                  whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </span>
              </div>
              {index < LIFECYCLE_STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    height: '2px',
                    marginBottom: '1.1rem',
                    backgroundColor: index < currentIndex ? COLORS.christmasGreen : COLORS.neutral300,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: COLORS.neutral700, textAlign: 'center' }}>
        {LIFECYCLE_NEXT_ACTION[status]}
      </p>
    </div>
  );
}
