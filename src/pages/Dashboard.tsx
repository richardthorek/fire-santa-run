import { useState } from 'react';
import { useRoutes } from '../hooks';
import { RouteStatusBadge, ShareModal } from '../components';
import type { Route, RouteStatus } from '../types';
import { formatDistance, formatDuration } from '../utils/mapbox';
import { format } from 'date-fns';

export function Dashboard() {
  const { routes, isLoading, error } = useRoutes();
  const [filterStatus, setFilterStatus] = useState<RouteStatus | 'all'>('all');
  const [shareModalRoute, setShareModalRoute] = useState<Route | null>(null);

  const filteredRoutes = filterStatus === 'all' 
    ? routes 
    : routes.filter(r => r.status === filterStatus);

  const statusCounts = {
    all: routes.length,
    draft: routes.filter(r => r.status === 'draft').length,
    published: routes.filter(r => r.status === 'published').length,
    active: routes.filter(r => r.status === 'active').length,
    completed: routes.filter(r => r.status === 'completed').length,
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading routes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
        <p>Error loading routes: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      overflow: 'auto',
      backgroundColor: '#fafafa',
    }}>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h1 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '2rem', color: '#D32F2F' }}>
            🎅 Santa Run Routes
          </h1>
          <p style={{ margin: 0, color: '#616161' }}>
            Plan and manage your Christmas Eve routes
          </p>
        </div>
        <a
          href="/routes/new"
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ➕ Create New Route
        </a>
      </div>

      {/* Status Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        padding: '0.5rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '12px',
      }}>
        {(['all', 'draft', 'published', 'active', 'completed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: filterStatus === status ? 'white' : 'transparent',
              color: filterStatus === status ? '#D32F2F' : '#616161',
              fontWeight: filterStatus === status ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: filterStatus === status ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Routes List */}
      {filteredRoutes.length === 0 ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: '#FFF9E6',
          borderRadius: '12px',
          border: '2px dashed #FFA726',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎄</div>
          <h2 style={{ marginBottom: '0.5rem', color: '#D32F2F' }}>
            {filterStatus === 'all' ? 'No routes yet' : `No ${filterStatus} routes`}
          </h2>
          <p style={{ color: '#616161', marginBottom: '1.5rem' }}>
            Create your first Santa run route to get started!
          </p>
          <a
            href="/routes/new"
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #FFA726 0%, #FFB74D 100%)',
              color: '#212121',
              textDecoration: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              display: 'inline-block',
            }}
          >
            Create First Route
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {filteredRoutes.map(route => (
            <div
              key={route.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '1px solid #e0e0e0',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
              onClick={() => window.location.href = `/routes/${route.id}`}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#212121', flex: 1 }}>
                  {route.name}
                </h3>
                <RouteStatusBadge status={route.status} />
              </div>

              {/* Description */}
              {route.description && (
                <p style={{ margin: '0 0 1rem 0', color: '#616161', fontSize: '0.875rem' }}>
                  {route.description}
                </p>
              )}

              {/* Date & Time */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#616161' }}>
                <div>
                  📅 {route.date ? format(new Date(route.date), 'MMM dd, yyyy') : 'No date'}
                </div>
                <div>
                  🕐 {route.startTime || 'No time'}
                </div>
              </div>

              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#D32F2F' }}>
                    {route.waypoints.length}
                  </div>
                  <div style={{ color: '#9e9e9e', fontSize: '0.75rem' }}>Stops</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#FFA726' }}>
                    {route.distance ? formatDistance(route.distance) : '—'}
                  </div>
                  <div style={{ color: '#9e9e9e', fontSize: '0.75rem' }}>Distance</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#43A047' }}>
                    {route.estimatedDuration ? formatDuration(route.estimatedDuration) : '—'}
                  </div>
                  <div style={{ color: '#9e9e9e', fontSize: '0.75rem' }}>Duration</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                {/* Show navigation button if route has navigation data */}
                {route.geometry && route.navigationSteps && route.navigationSteps.length > 0 ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/routes/${route.id}/navigate`;
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #29B6F6 0%, #0288D1 100%)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                      }}
                    >
                      🧭 Navigate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/routes/${route.id}/edit`;
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/routes/${route.id}/edit`;
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Only allow sharing for published, active, or completed routes
                    if (route.status === 'published' || route.status === 'active' || route.status === 'completed') {
                      setShareModalRoute(route);
                    } else {
                      alert('Route must be published before sharing');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    opacity: (route.status === 'published' || route.status === 'active' || route.status === 'completed') ? 1 : 0.5,
                  }}
                  disabled={route.status === 'draft'}
                >
                  🔗 Share
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Modal */}
      {shareModalRoute && (
        <ShareModal
          route={shareModalRoute}
          isOpen={true}
          onClose={() => setShareModalRoute(null)}
        />
      )}
    </div>
    </div>
  );
}
