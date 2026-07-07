import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useBrigade } from '../context';
import { useRoutes, useRouteEditor } from '../hooks';
import { useTemplates } from '../hooks/useTemplates';
import { MapView, WaypointList, AddressSearch, ShareModal } from '../components';
import { createNewRoute, generateShareableLink, canPublishRoute, generateWaypointId, generateTemplateId, DEFAULT_NAVIGATION_SETTINGS } from '../utils/routeHelpers';
import { reverseGeocode, type GeocodingResult } from '../utils/mapbox';
import { formatDistance, formatDuration } from '../utils/mapbox';
import { BREAKPOINTS, COLORS, Z_INDEX, MAP_LAYOUT } from '../utils/constants';
import { getDefaultMapCenter } from '../utils/mapCenter';
import { DEFAULT_CENTER } from '../config/mapbox';
import type { Route, RouteTemplate, Waypoint } from '../types';

export interface RouteEditorProps {
  routeId?: string;
  mode: 'new' | 'edit';
}

export function RouteEditor({ routeId, mode }: RouteEditorProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { brigade } = useBrigade();
  const { saveRoute, getRoute } = useRoutes();
  const { saveTemplate } = useTemplates();
  const [initialRoute, setInitialRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(routeId ? true : false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showWaypointModal, setShowWaypointModal] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [waypointForm, setWaypointForm] = useState({ name: '', notes: '' });
  const [autoZoom, setAutoZoom] = useState(true);
  // Set after a successful publish; shows the share modal before leaving.
  const [publishedRoute, setPublishedRoute] = useState<Route | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(5); // Default Australia-wide zoom

  // Determine default map center and zoom level
  useEffect(() => {
    let mounted = true;
    getDefaultMapCenter(brigade).then(center => {
      if (mounted) {
        setMapCenter(center);
        
        // Set appropriate zoom based on which center is being used
        if (brigade?.stationCoordinates) {
          // Brigade station - close zoom
          setMapZoom(13);
        } else if (center[0] !== DEFAULT_CENTER[0] || center[1] !== DEFAULT_CENTER[1]) {
          // User location was used - medium zoom for local area
          setMapZoom(12);
        } else {
          // Australia fallback - wide zoom
          setMapZoom(5);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [brigade]);

  // Memoize brigade station info to avoid recreating object on every render
  const brigadeStation = useMemo(() => {
    if (!brigade?.stationCoordinates) return undefined;
    return {
      coordinates: brigade.stationCoordinates,
      name: brigade.name,
    };
  }, [brigade?.stationCoordinates, brigade?.name]);

  const {
    route,
    updateMetadata,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    moveWaypoint,
    optimizeRoute,
    tspOptimizeRoute,
    acceptOptimization,
    rejectOptimization,
    resetRoute,
    validate,
    isOptimizing,
    optimizationError,
    optimizationComparison,
  } = useRouteEditor(initialRoute || createNewRoute(user?.brigadeId || '', user?.email));

  // Tracks which route id has been pushed into the editor, so re-runs of the
  // load effect (e.g. auth context identity changes) never clobber edits.
  const loadedRouteIdRef = useRef<string | null>(null);

  // Load existing route for edit mode. The editor hook only reads its initial
  // route on first render, so the loaded route must be pushed in explicitly
  // via resetRoute once it arrives.
  useEffect(() => {
    if (mode === 'edit' && routeId) {
      if (loadedRouteIdRef.current === routeId) return;
      setIsLoading(true);
      getRoute(routeId).then(route => {
        if (route) {
          loadedRouteIdRef.current = routeId;
          setInitialRoute(route);
          resetRoute(route);
        } else {
          navigate('/dashboard');
        }
        setIsLoading(false);
      });
    } else if (mode === 'new' && user?.brigadeId && !initialRoute) {
      const fresh = createNewRoute(user.brigadeId, user.email);
      setInitialRoute(fresh);
      resetRoute(fresh);
    }
  }, [mode, routeId, getRoute, user, navigate, resetRoute, initialRoute]);

  const handleMapClick = useCallback(async (coordinates: [number, number]) => {
    try {
      const address = await reverseGeocode(coordinates);
      addWaypoint(coordinates, address);
    } catch (error) {
      console.error('Failed to geocode:', error);
      addWaypoint(coordinates);
    }
  }, [addWaypoint]);

  const handleAddressSelect = useCallback((result: GeocodingResult) => {
    addWaypoint(
      result.center,
      result.place_name,
      result.place_name.split(',')[0]
    );
  }, [addWaypoint]);

  const handleEditWaypoint = useCallback((waypoint: Waypoint) => {
    setEditingWaypoint(waypoint);
    setWaypointForm({
      name: waypoint.name || '',
      notes: waypoint.notes || '',
    });
    setShowWaypointModal(true);
  }, []);

  const handleSaveWaypointEdit = useCallback(() => {
    if (editingWaypoint) {
      updateWaypoint(editingWaypoint.id, waypointForm);
      setShowWaypointModal(false);
      setEditingWaypoint(null);
      setWaypointForm({ name: '', notes: '' });
    }
  }, [editingWaypoint, waypointForm, updateWaypoint]);

  const handleSave = useCallback(async (shouldPublish = false) => {
    const validation = validate();
    if (!validation.valid) {
      setSaveError(validation.errors.join(', '));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Multi-operator conflict detection: warn if someone else saved this
      // route since we loaded it (last-edit-wins after confirmation).
      try {
        const stored = await getRoute(route.id);
        if (stored?.updatedAt && stored.updatedAt !== route.updatedAt) {
          const who = stored.lastEditedBy?.userName || 'Another member';
          const overwrite = confirm(
            `${who} saved changes to this route while you were editing. ` +
            'Saving now will overwrite their changes. Continue?'
          );
          if (!overwrite) {
            setIsSaving(false);
            return;
          }
        }
      } catch {
        // Conflict check is best-effort; never block saving on it
      }

      const routeToSave: Route = {
        ...route,
        status: shouldPublish ? 'published' : route.status,
        publishedAt: shouldPublish && !route.publishedAt ? new Date().toISOString() : route.publishedAt,
        shareableLink: shouldPublish ? generateShareableLink(route.id) : route.shareableLink,
      };

      await saveRoute(routeToSave);

      if (shouldPublish) {
        // Publishing is the moment of highest sharing intent — surface the
        // share link + QR right here instead of a blocking alert().
        setPublishedRoute(routeToSave);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save route');
    } finally {
      setIsSaving(false);
    }
  }, [route, validate, saveRoute, getRoute, navigate]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!route.name.trim()) {
      setSaveError('Please enter a route name before saving as a template.');
      return;
    }
    if (!user?.brigadeId) return;

    setIsSavingTemplate(true);
    setSaveError(null);

    try {
      const template: RouteTemplate = {
        id: generateTemplateId(),
        brigadeId: user.brigadeId,
        name: route.name,
        description: route.description,
        category: 'My Templates',
        isBuiltIn: false,
        waypoints: route.waypoints.map(wp => ({
          id: generateWaypointId(),
          coordinates: wp.coordinates,
          address: wp.address,
          name: wp.name,
          order: wp.order,
          notes: wp.notes,
        })),
        createdAt: new Date().toISOString(),
        createdBy: user.email,
      };
      await saveTemplate(template);
      navigate('/templates');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [route, user, saveTemplate, navigate]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading route...</p>
      </div>
    );
  }

  return (
    <div 
      className="route-editor-container"
      style={{ 
      position: 'relative',
      width: '100vw', 
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Full-screen Map */}
      <div className="route-editor-map" style={{ position: 'absolute', inset: 0 }}>
        <MapView
          waypoints={route.waypoints}
          routeGeometry={route.geometry}
          onMapClick={handleMapClick}
          center={mapCenter}
          zoom={mapZoom}
          height="100%"
          autoZoom={autoZoom}
          fitBoundsPadding={MAP_LAYOUT.fitBoundsPadding.withSidebar}
          brigadeStation={brigadeStation}
        />
      </div>

      {/* Floating Header Panel */}
      <div 
        className="route-editor-header"
        style={{
        position: 'absolute',
        top: '1rem',
        left: '1rem',
        right: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1rem 1.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '2px solid var(--rfs-yellow)',
        zIndex: 1000,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '200px' }}>
            <h1 style={{ 
              margin: 0, 
              fontSize: '1.25rem', 
              color: 'var(--fire-red)', 
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-heading)',
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
            }}>
              {mode === 'new' ? '➕ Create Route' : '✏️ Edit Route'}
            </h1>
            {route.geometry && (
              <div style={{ 
                display: 'flex', 
                gap: '1rem', 
                fontSize: '0.875rem',
                color: '#616161',
                marginLeft: '1rem',
              }}>
                <span><span aria-hidden="true">📍</span> {route.waypoints.length} stops</span>
                {route.distance && <span><span aria-hidden="true">🛣️</span> {formatDistance(route.distance)}</span>}
                {route.estimatedDuration && <span><span aria-hidden="true">⏱️</span> {formatDuration(route.estimatedDuration)}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {route.geometry && route.navigationSteps && route.navigationSteps.length > 0 && (
              <button
                onClick={() => navigate(`/routes/${route.id}/navigate`)}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #29B6F6 0%, #0288D1 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                }}
              >
                🧭 Navigate
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                background: 'white',
                color: 'var(--neutral-900)',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAsTemplate}
              disabled={isSavingTemplate || !route.name.trim()}
              title={route.name.trim() ? 'Save as a reusable template' : 'Enter a route name first'}
              style={{
                padding: '0.5rem 1rem',
                border: `1px solid ${COLORS.skyBlue}`,
                borderRadius: '8px',
                background: 'white',
                color: COLORS.skyBlue,
                cursor: (isSavingTemplate || !route.name.trim()) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                opacity: !route.name.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {isSavingTemplate ? 'Saving...' : '📋 Save as Template'}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: COLORS.summerGold,
                color: COLORS.neutral900,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving || !canPublishRoute(route)}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: canPublishRoute(route) ? COLORS.christmasGreen : COLORS.neutral300,
                color: 'white',
                cursor: isSaving || !canPublishRoute(route) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
              title={canPublishRoute(route) ? 'Publish route' : 'Complete all fields and add at least 2 waypoints'}
            >
              Publish
            </button>
          </div>
        </div>
      </div>

      {saveError && (
        <div style={{
          position: 'absolute',
          top: '6rem',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '1rem 1.5rem',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          zIndex: 1001,
          maxWidth: '90%',
        }}>
          {saveError}
        </div>
      )}

      {optimizationError && (
        <div style={{
          position: 'absolute',
          top: MAP_LAYOUT.headerTop,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '1rem 1.5rem',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          zIndex: Z_INDEX.errorMessage,
          maxWidth: '90%',
        }}>
          {optimizationError}
        </div>
      )}

      {/* Floating Right Sidebar Panel */}
      <div 
        className="route-editor-sidebar"
        style={{
        position: 'absolute',
        top: '6rem',
        right: '1rem',
        bottom: '1rem',
        width: 'min(400px, calc(100vw - 2rem))',
        maxWidth: 'calc(100vw - 5rem)', // Leave room for map controls on the right
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '2px solid var(--christmas-green)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        zIndex: 900, // Lower than map controls (which are typically 1000)
      }}>
        {/* Route Metadata Form */}
        <div>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.125rem', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>🎄</span> Route Details
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Route Name *
              </label>
              <input
                type="text"
                value={route.name}
                onChange={(e) => updateMetadata({ name: e.target.value })}
                placeholder="e.g., Christmas Eve 2024 - North Route"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Description
              </label>
              <textarea
                value={route.description || ''}
                onChange={(e) => updateMetadata({ description: e.target.value })}
                placeholder="Brief description of the route..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={route.date}
                  onChange={(e) => updateMetadata({ date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                  Start Time *
                </label>
                <input
                  type="time"
                  value={route.startTime}
                  onChange={(e) => updateMetadata({ startTime: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Settings */}
        <details style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '1rem',
          backgroundColor: '#fafafa',
        }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem',
            color: '#616161',
            userSelect: 'none',
          }}>
            ⚙️ Advanced Navigation Settings
          </summary>
          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#616161' }}>
                Walking Speed (km/h)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={route.navigationSettings?.walkingSpeedKmh ?? DEFAULT_NAVIGATION_SETTINGS.walkingSpeedKmh}
                onChange={(e) => updateMetadata({
                  navigationSettings: {
                    ...DEFAULT_NAVIGATION_SETTINGS,
                    ...route.navigationSettings,
                    walkingSpeedKmh: parseFloat(e.target.value) || DEFAULT_NAVIGATION_SETTINGS.walkingSpeedKmh,
                  }
                })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#9e9e9e' }}>
                Average speed for Santa's slow-moving route (default: {DEFAULT_NAVIGATION_SETTINGS.walkingSpeedKmh} km/h)
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#616161' }}>
                Stop Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="1"
                value={route.navigationSettings?.stopDurationMinutes ?? DEFAULT_NAVIGATION_SETTINGS.stopDurationMinutes}
                onChange={(e) => updateMetadata({
                  navigationSettings: {
                    ...DEFAULT_NAVIGATION_SETTINGS,
                    ...route.navigationSettings,
                    stopDurationMinutes: parseInt(e.target.value) || DEFAULT_NAVIGATION_SETTINGS.stopDurationMinutes,
                  }
                })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#9e9e9e' }}>
                Time spent at each waypoint (default: {DEFAULT_NAVIGATION_SETTINGS.stopDurationMinutes} min)
              </p>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#616161' }}>
                Transit Speed (km/h)
              </label>
              <input
                type="number"
                min="40"
                max="100"
                step="5"
                value={route.navigationSettings?.transitSpeedKmh ?? DEFAULT_NAVIGATION_SETTINGS.transitSpeedKmh}
                onChange={(e) => updateMetadata({
                  navigationSettings: {
                    ...DEFAULT_NAVIGATION_SETTINGS,
                    ...route.navigationSettings,
                    transitSpeedKmh: parseInt(e.target.value) || DEFAULT_NAVIGATION_SETTINGS.transitSpeedKmh,
                  }
                })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#9e9e9e' }}>
                Speed for high-speed road segments (≥60 km/h, default: {DEFAULT_NAVIGATION_SETTINGS.transitSpeedKmh} km/h)
              </p>
            </div>
          </div>
        </details>

        {/* Address Search */}
        <div>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.125rem', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>📍</span> Add Waypoint
          </h3>
          <AddressSearch
            onSelect={handleAddressSelect}
            proximity={route.waypoints.length > 0 ? route.waypoints[route.waypoints.length - 1].coordinates : undefined}
            placeholder="Search for an address..."
          />
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#9e9e9e' }}>
            Or click on the map to add a waypoint
          </p>
        </div>

        {/* Map Controls Section */}
        <div>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.125rem', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>🗺️</span> Map Controls
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Plan Route Button — only shown when no geometry yet */}
            {route.waypoints.length >= 2 && !route.geometry && !optimizationComparison && (
              <button
                onClick={optimizeRoute}
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  background: isOptimizing 
                    ? 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)' 
                    : 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: isOptimizing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isOptimizing ? '🔄 Planning...' : '🗺️ Plan Route'}
              </button>
            )}

            {/* Optimize Route Order Button — shown when 3+ waypoints */}
            {route.waypoints.length >= 3 && !optimizationComparison && (
              <button
                onClick={tspOptimizeRoute}
                disabled={isOptimizing}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  background: isOptimizing
                    ? 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)'
                    : 'linear-gradient(135deg, #FFA726 0%, #E65100 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: isOptimizing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 167, 38, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isOptimizing ? '🔄 Optimising...' : '✨ Optimise Route Order'}
              </button>
            )}

            {/* Before/after comparison panel */}
            {optimizationComparison && (
              <div style={{
                backgroundColor: '#fffde7',
                border: '2px solid #FFA726',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#E65100', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✨ Route Order Optimisation
                </div>

                {/* Comparison rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <div style={{
                    padding: '0.625rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0',
                  }}>
                    <div style={{ color: '#616161', marginBottom: '0.25rem', fontWeight: 600 }}>Current order</div>
                    {optimizationComparison.originalDistance !== undefined ? (
                      <>
                        <div>🛣️ {formatDistance(optimizationComparison.originalDistance)}</div>
                        {optimizationComparison.originalDuration !== undefined && (
                          <div>⏱️ {formatDuration(optimizationComparison.originalDuration)}</div>
                        )}
                      </>
                    ) : (
                      <div style={{ color: '#9e9e9e', fontStyle: 'italic' }}>Not yet planned</div>
                    )}
                  </div>

                  <div style={{
                    padding: '0.625rem',
                    backgroundColor: '#e8f5e9',
                    borderRadius: '8px',
                    border: '1px solid #a5d6a7',
                  }}>
                    <div style={{ color: '#2e7d32', marginBottom: '0.25rem', fontWeight: 600 }}>Optimised order</div>
                    <div>🛣️ {formatDistance(optimizationComparison.optimizedDistance)}</div>
                    <div>⏱️ {formatDuration(optimizationComparison.optimizedDuration)}</div>
                  </div>
                </div>

                {/* Savings callout */}
                {optimizationComparison.originalDistance !== undefined &&
                  optimizationComparison.optimizedDistance < optimizationComparison.originalDistance && (() => {
                    const { originalDuration, optimizedDuration } = optimizationComparison;
                    const durationSaving =
                      originalDuration !== undefined && originalDuration > optimizedDuration
                        ? ` / ~${formatDuration(originalDuration - optimizedDuration)}`
                        : '';
                    return (
                      <div style={{ fontSize: '0.875rem', color: '#2e7d32', fontWeight: 600, textAlign: 'center' }}>
                        🎉 Save ~{formatDistance(optimizationComparison.originalDistance - optimizationComparison.optimizedDistance)}
                        {durationSaving}
                      </div>
                    );
                  })()
                }

                {/* New waypoint order preview */}
                <div style={{ fontSize: '0.8125rem', color: '#616161' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>New stop order:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {optimizationComparison.optimizedWaypoints.map((wp, idx) => (
                      <span
                        key={wp.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '999px',
                          backgroundColor: idx === 0 || idx === optimizationComparison.optimizedWaypoints.length - 1
                            ? '#D32F2F' : '#FFA726',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {/* Truncated to ~18 chars to fit pill badges in the sidebar */}
                        {idx + 1}. {(wp.name || wp.address?.split(',')[0] || `Stop ${idx + 1}`).slice(0, 18)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Accept / Reject */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    onClick={rejectOptimization}
                    style={{
                      padding: '0.625rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      background: 'white',
                      color: '#424242',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    ✖ Keep Current
                  </button>
                  <button
                    onClick={acceptOptimization}
                    style={{
                      padding: '0.625rem',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #43A047 0%, #2e7d32 100%)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      boxShadow: '0 2px 8px rgba(67, 160, 71, 0.4)',
                    }}
                  >
                    ✔ Apply Optimised
                  </button>
                </div>
              </div>
            )}
            
            {/* Auto-Zoom Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}>
              <label 
                htmlFor="auto-zoom-toggle" 
                style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 500,
                  color: '#424242',
                  cursor: 'pointer',
                }}
              >
                Auto-zoom to fit markers
              </label>
              <input
                id="auto-zoom-toggle"
                type="checkbox"
                checked={autoZoom}
                onChange={(e) => setAutoZoom(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        </div>

        {/* Waypoints List */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            fontSize: '1.125rem', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>🎁</span> Waypoints ({route.waypoints.length})
          </h3>
          <WaypointList
            waypoints={route.waypoints}
            onReorder={moveWaypoint}
            onEdit={handleEditWaypoint}
            onDelete={deleteWaypoint}
            editable={true}
            showETA={!!route.geometry && !!route.navigationSteps}
          />
        </div>
      </div>

      {/* Mobile: Vertical Layout on Small Screens, Floating Panels on Larger Screens */}
      <style>
        {`
          @media (max-width: ${BREAKPOINTS.mobile - 1}px) {
            .route-editor-container {
              display: flex;
              flex-direction: column;
              overflow-y: auto;
              overflow-x: hidden;
            }
            
            .route-editor-map {
              position: relative !important;
              inset: auto !important;
              height: 400px;
              flex-shrink: 0;
              order: 2;
            }
            
            .route-editor-header {
              position: relative !important;
              top: auto !important;
              left: auto !important;
              right: auto !important;
              margin: 0;
              border-radius: 0;
              order: 1;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            
            .route-editor-sidebar {
              position: relative !important;
              top: auto !important;
              right: auto !important;
              bottom: auto !important;
              width: 100% !important;
              max-height: none !important;
              border-radius: 0;
              order: 3;
              box-shadow: none;
              border-top: 1px solid #e0e0e0;
            }
          }
        `}
      </style>

      {/* Waypoint Edit Modal */}
      {showWaypointModal && editingWaypoint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0' }}>Edit Waypoint</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                  Name
                </label>
                <input
                  type="text"
                  value={waypointForm.name}
                  onChange={(e) => setWaypointForm({ ...waypointForm, name: e.target.value })}
                  placeholder="e.g., Town Square"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
                  Notes
                </label>
                <textarea
                  value={waypointForm.notes}
                  onChange={(e) => setWaypointForm({ ...waypointForm, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowWaypointModal(false);
                  setEditingWaypoint(null);
                  setWaypointForm({ name: '', notes: '' });
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  background: 'white',
                  color: 'var(--neutral-900)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWaypointEdit}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: COLORS.fireRed,
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-publish share moment: link + QR while sharing intent is highest */}
      {publishedRoute && (
        <ShareModal
          route={publishedRoute}
          isOpen={true}
          onClose={() => {
            setPublishedRoute(null);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}
