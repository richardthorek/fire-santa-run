import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { SEO, AppLayout } from '../components';
import { useBrigade } from '../context';
import type { RouteAnalytics } from '../types';
import { formatDuration } from '../utils/mapbox';
import { generateMockAnalytics } from '../utils/mockData';

const COLORS = ['#D32F2F', '#FFA726', '#43A047', '#1976D2', '#7B1FA2', '#00796B'];

export function AnalyticsDashboard() {
  const { routeId } = useParams<{ routeId: string }>();
  const { brigade } = useBrigade();
  const [analytics, setAnalytics] = useState<RouteAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) return;

    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

        if (isDevMode) {
          // Use mock analytics in dev mode
          const mockData = generateMockAnalytics(routeId);
          setAnalytics(mockData);
        } else {
          const response = await fetch(`/api/analytics/routes/${routeId}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch analytics: ${response.statusText}`);
          }

          const data = await response.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [routeId]);

  if (isLoading) {
    return (
      <>
        <SEO title="Route Analytics" description="View analytics for your Santa Run route" />
        <AppLayout>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
            <p>Loading analytics...</p>
          </div>
        </AppLayout>
      </>
    );
  }

  if (error || !analytics) {
    return (
      <>
        <SEO title="Route Analytics" description="View analytics for your Santa Run route" />
        <AppLayout>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Unable to Load Analytics</h2>
            <p style={{ color: '#616161', maxWidth: '400px', margin: '0 auto 2rem' }}>
              {error || 'No analytics data available'}
            </p>
            <Link to={`/dashboard/${brigade?.id}`} style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#D32F2F',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px'
            }}>
              Back to Dashboard
            </Link>
          </div>
        </AppLayout>
      </>
    );
  }

  // Prepare data for charts
  const sourceData = Object.entries(analytics.viewersBySource).map(([source, count]) => ({
    name: source.charAt(0).toUpperCase() + source.slice(1),
    value: count,
  }));

  const locationData = analytics.viewersByLocation
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(loc => ({
      name: loc.city ? `${loc.city}, ${loc.country}` : loc.country,
      viewers: loc.count,
    }));

  const timeSeriesData = analytics.viewsOverTime.map(item => ({
    time: new Date(item.timestamp).toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit'
    }),
    views: item.count,
  }));

  return (
    <>
      <SEO title="Route Analytics" description="View analytics for your Santa Run route" />
      <AppLayout>
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link
              to={`/dashboard/${brigade?.id}`}
              style={{
                color: '#D32F2F',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                marginBottom: '1rem'
              }}
            >
              ← Back to Dashboard
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '0.5rem' }}>
              Route Analytics
            </h1>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>
              Last updated: {new Date(analytics.lastUpdated).toLocaleString('en-AU')}
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <MetricCard
              title="Total Views"
              value={analytics.totalViews.toLocaleString()}
              icon="👀"
            />
            <MetricCard
              title="Unique Viewers"
              value={analytics.uniqueViewers.toLocaleString()}
              icon="👥"
            />
            <MetricCard
              title="Peak Concurrent"
              value={analytics.peakConcurrentViewers.toLocaleString()}
              icon="📈"
            />
            <MetricCard
              title="Avg. Session"
              value={formatDuration(analytics.averageViewDuration)}
              icon="⏱️"
            />
          </div>

          {/* Charts Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Views Over Time */}
            {timeSeriesData.length > 0 && (
              <ChartCard title="Views Over Time">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="views" stroke="#D32F2F" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Viewers by Source */}
            {sourceData.length > 0 && (
              <ChartCard title="Viewers by Source">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sourceData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Top Locations */}
            {locationData.length > 0 && (
              <ChartCard title="Top Viewer Locations">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={locationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} angle={-45} textAnchor="end" height={100} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="viewers" fill="#43A047" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Geographic Distribution Table */}
          {analytics.viewersByLocation.length > 0 && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1a1a1a' }}>
                Geographic Distribution
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>Location</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Viewers</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.viewersByLocation
                      .sort((a, b) => b.count - a.count)
                      .map((location, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '0.75rem' }}>
                            {location.city && `${location.city}, `}
                            {location.region && `${location.region}, `}
                            {location.country}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>
                            {location.count}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', color: '#666' }}>
                            {((location.count / analytics.totalViews) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    </>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div style={{ fontSize: '0.875rem', color: '#666', fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a1a' }}>{value}</div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1a1a1a' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
