import { useState } from 'react';
import { useRoutes } from '../hooks';
import { RouteStatusBadge, ShareModal, SEO, DashboardSkeleton } from '../components';
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
      <>
        <SEO title="Dashboard" description="Manage your Santa Run routes" />
        <DashboardSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <SEO title="Dashboard" description="Manage your Santa Run routes" />
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center', 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Unable to Load Routes</h2>
          <p style={{ color: '#616161', maxWidth: '400px' }}>
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            🔄 Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Dashboard" description="Manage your Santa Run routes - Plan and track Christmas Eve routes for your Rural Fire Service brigade" />
      <div style={{ 
      width: '100%', 
      height: '100%', 
      overflow: 'auto',
      backgroundColor: 'var(--neutral-50)',
      backgroundImage: `
        radial-gradient(circle at 20% 30%, rgba(255, 230, 0, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 80% 70%, rgba(214, 40, 40, 0.03) 0%, transparent 50%),
        radial-gradient(circle at 40% 80%, rgba(67, 160, 71, 0.03) 0%, transparent 50%)
      `,
    }}>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Christmas Lights Divider at top */}
        <div className="christmas-lights" style={{ marginBottom: '2rem' }} />
        
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
          <h1 style={{ 
            margin: 0, 
            marginBottom: '0.5rem', 
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
          }}>
            🎅 Santa Run Routes
          </h1>
          <p style={{ margin: 0, color: 'var(--neutral-700)', fontSize: '1rem' }}>
            Plan and manage your Christmas Eve routes ✨
          </p>
        </div>
        <a
          href="/routes/new"
          style={{
            padding: '0.875rem 1.75rem',
            background: 'linear-gradient(135deg, var(--fire-red) 0%, var(--fire-red-dark) 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 'var(--border-radius-sm)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
            transition: 'all 0.3s ease',
            display: 'inline-block',
            fontSize: '1rem',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(211, 47, 47, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(211, 47, 47, 0.3)';
          }}
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
        padding: '0.75rem',
        backgroundColor: 'var(--neutral-100)',
        borderRadius: 'var(--border-radius-sm)',
        border: '2px solid var(--neutral-200)',
      }}>
        {(['all', 'draft', 'published', 'active', 'completed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: 'var(--border-radius-xs)',
              background: filterStatus === status ? 'white' : 'transparent',
              color: filterStatus === status ? 'var(--fire-red)' : 'var(--neutral-700)',
              fontWeight: filterStatus === status ? 700 : 500,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: filterStatus === status ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
              fontSize: '0.875rem',
            }}
            onMouseEnter={(e) => {
              if (filterStatus !== status) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (filterStatus !== status) {
                e.currentTarget.style.background = 'transparent';
              }
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
          backgroundColor: 'var(--sand-light)',
          borderRadius: 'var(--border-radius)',
          border: '3px dashed var(--summer-gold)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative snowflakes/stars */}
          <div style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            fontSize: '24px',
            opacity: 0.3,
          }}>⭐</div>
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            fontSize: '24px',
            opacity: 0.3,
          }}>✨</div>
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            left: '2rem',
            fontSize: '20px',
            opacity: 0.3,
          }}>🎁</div>
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            right: '2rem',
            fontSize: '20px',
            opacity: 0.3,
          }}>🌟</div>
          
          <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎄</div>
          <h2 style={{ 
            marginBottom: '0.5rem', 
            color: 'var(--fire-red)',
            fontFamily: 'var(--font-heading)',
          }}>
            {filterStatus === 'all' ? 'No routes yet' : `No ${filterStatus} routes`}
          </h2>
          <p style={{ color: 'var(--neutral-700)', marginBottom: '1.5rem' }}>
            Create your first Santa run route to get started! 🎅
          </p>
          <a
            href="/routes/new"
            style={{
              padding: '0.875rem 1.75rem',
              background: 'linear-gradient(135deg, var(--summer-gold) 0%, var(--summer-gold-light) 100%)',
              color: 'var(--neutral-900)',
              textDecoration: 'none',
              borderRadius: 'var(--border-radius-sm)',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              display: 'inline-block',
              boxShadow: '0 4px 12px rgba(255, 167, 38, 0.3)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 167, 38, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 167, 38, 0.3)';
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
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: '2px solid var(--neutral-200)',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(214, 40, 40, 0.2)';
                e.currentTarget.style.borderColor = 'var(--fire-red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'var(--neutral-200)';
              }}
              onClick={() => window.location.href = `/routes/${route.id}`}
            >
              {/* Decorative corner accent */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                fontSize: '40px',
                opacity: 0.1,
                pointerEvents: 'none',
              }}>🎅</div>
              
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
                        border: '2px solid var(--fire-red)',
                        borderRadius: '8px',
                        background: 'white',
                        color: 'var(--fire-red)',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
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
                      border: '2px solid var(--fire-red)',
                      borderRadius: '8px',
                      background: 'white',
                      color: 'var(--fire-red)',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
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
                    border: '2px solid var(--summer-gold)',
                    borderRadius: '8px',
                    background: 'white',
                    color: 'var(--summer-gold)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
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
    </>
  );
}
