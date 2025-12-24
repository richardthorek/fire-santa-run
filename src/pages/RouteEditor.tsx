import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context';
import { useRoutes, useRouteEditor } from '../hooks';
import { MapView, WaypointList, AddressSearch } from '../components';
import { createNewRoute, generateShareableLink, canPublishRoute } from '../utils/routeHelpers';
import { reverseGeocode, type GeocodingResult } from '../utils/mapbox';
import { formatDistance, formatDuration } from '../utils/mapbox';
import type { Route, Waypoint } from '../types';

export interface RouteEditorProps {
  routeId?: string;
  mode: 'new' | 'edit';
}

export function RouteEditor({ routeId, mode }: RouteEditorProps) {
  const { user } = useAuth();
  const { saveRoute, getRoute } = useRoutes();
  const [initialRoute, setInitialRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(routeId ? true : false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showWaypointModal, setShowWaypointModal] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [waypointForm, setWaypointForm] = useState({ name: '', notes: '' });

  // Load existing route for edit mode
  useEffect(() => {
    if (mode === 'edit' && routeId) {
      setIsLoading(true);
      getRoute(routeId).then(route => {
        if (route) {
          setInitialRoute(route);
        } else {
          window.location.href = '/dashboard';
        }
        setIsLoading(false);
      });
    } else if (mode === 'new' && user) {
      setInitialRoute(createNewRoute(user.brigadeId, user.email));
    }
  }, [mode, routeId, getRoute, user]);

  const {
    route,
    updateMetadata,
    addWaypoint,
    updateWaypoint,
    deleteWaypoint,
    moveWaypoint,
    optimizeRoute,
    validate,
    isOptimizing,
    optimizationError,
  } = useRouteEditor(initialRoute || createNewRoute(user?.brigadeId || '', user?.email));

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
      const routeToSave: Route = {
        ...route,
        status: shouldPublish ? 'published' : route.status,
        publishedAt: shouldPublish && !route.publishedAt ? new Date().toISOString() : route.publishedAt,
        shareableLink: shouldPublish ? generateShareableLink(route.id) : route.shareableLink,
      };

      await saveRoute(routeToSave);
      
      if (shouldPublish) {
        alert('Route published successfully! Share link generated.');
      }
      
      window.location.href = '/dashboard';
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save route');
    } finally {
      setIsSaving(false);
    }
  }, [route, validate, saveRoute]);

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading route...</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1400px', margin: '0 auto' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#D32F2F' }}>
              {mode === 'new' ? '➕ Create New Route' : '✏️ Edit Route'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#FFA726',
                color: '#212121',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
              }}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving || !canPublishRoute(route)}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: canPublishRoute(route) ? '#43A047' : '#e0e0e0',
                color: 'white',
                cursor: isSaving || !canPublishRoute(route) ? 'not-allowed' : 'pointer',
                fontWeight: 600,
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
          padding: '1rem 2rem',
          backgroundColor: '#ffebee',
          color: '#d32f2f',
          textAlign: 'center',
        }}>
          {saveError}
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map Section */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView
            waypoints={route.waypoints}
            routeGeometry={route.geometry}
            onMapClick={handleMapClick}
            height="100%"
          />
          
          {/* Optimize Button Overlay */}
          {route.waypoints.length >= 2 && !route.geometry && (
            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}>
              <button
                onClick={optimizeRoute}
                disabled={isOptimizing}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: isOptimizing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(211, 47, 47, 0.4)',
                }}
              >
                {isOptimizing ? '🔄 Optimizing...' : '🗺️ Optimize Route'}
              </button>
            </div>
          )}

          {optimizationError && (
            <div style={{
              position: 'absolute',
              top: '5rem',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '1rem',
              backgroundColor: '#ffebee',
              color: '#d32f2f',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              zIndex: 1000,
            }}>
              {optimizationError}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{
          width: '400px',
          backgroundColor: '#f5f5f5',
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          {/* Route Metadata Form */}
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Route Details</h3>
            
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
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Route Stats */}
          {route.geometry && (
            <div style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Route Statistics</h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#616161' }}>Distance:</span>
                  <strong>{route.distance ? formatDistance(route.distance) : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#616161' }}>Duration:</span>
                  <strong>{route.estimatedDuration ? formatDuration(route.estimatedDuration) : '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#616161' }}>Waypoints:</span>
                  <strong>{route.waypoints.length}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Address Search */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>Add Waypoint</h3>
            <AddressSearch
              onSelect={handleAddressSelect}
              proximity={route.waypoints.length > 0 ? route.waypoints[route.waypoints.length - 1].coordinates : undefined}
              placeholder="Search for an address..."
            />
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#9e9e9e' }}>
              Or click on the map to add a waypoint
            </p>
          </div>

          {/* Waypoints List */}
          <div>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
              Waypoints ({route.waypoints.length})
            </h3>
            <WaypointList
              waypoints={route.waypoints}
              onReorder={moveWaypoint}
              onEdit={handleEditWaypoint}
              onDelete={deleteWaypoint}
              editable={true}
            />
          </div>
        </div>
      </div>

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
            borderRadius: '12px',
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
                  backgroundColor: 'white',
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
                  backgroundColor: '#D32F2F',
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
    </div>
  );
}
