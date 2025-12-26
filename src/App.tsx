import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { useAuth, useBrigade } from './context';
import { storageAdapter } from './storage';
import { initializeMockData } from './utils/mockData';
import { Dashboard, RouteEditor, NavigationView } from './pages';
import { useRoutes } from './hooks';
import type { Route as RouteType } from './types';

function App() {
  const [initialized, setInitialized] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { brigade, isLoading: brigadeLoading } = useBrigade();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // Initialize mock data in dev mode
  useEffect(() => {
    const init = async () => {
      if (isDevMode && !initialized) {
        await initializeMockData(
          storageAdapter.saveBrigade.bind(storageAdapter),
          storageAdapter.saveRoute.bind(storageAdapter)
        );
        setInitialized(true);
      }
    };
    init();
  }, [isDevMode, initialized]);

  if (authLoading || brigadeLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
          <p>Loading Fire Santa Run...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        {/* Dev Mode Indicator */}
        {isDevMode && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFA726',
            color: '#212121',
            padding: '0.5rem',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '0.875rem',
            zIndex: 9999,
          }}>
            🛠️ Development Mode • {user?.email} • {brigade?.name}
          </div>
        )}
        
        {/* Main Routes */}
        <div style={{ paddingTop: isDevMode ? '2.5rem' : 0 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/routes/new" element={<RouteEditor mode="new" />} />
            <Route path="/routes/:id/edit" element={<RouteEditorWrapper />} />
            <Route path="/routes/:id/navigate" element={<NavigationViewWrapper />} />
            <Route path="/routes/:id" element={<RouteDetailPlaceholder />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

// Wrapper to extract route ID from URL params
function RouteEditorWrapper() {
  const pathSegments = window.location.pathname.split('/');
  const routeId = pathSegments[pathSegments.length - 2]; // /routes/:id/edit
  
  return <RouteEditor mode="edit" routeId={routeId} />;
}

// Wrapper for Navigation View
function NavigationViewWrapper() {
  const pathSegments = window.location.pathname.split('/');
  const routeId = pathSegments[pathSegments.length - 2]; // /routes/:id/navigate
  const { getRoute } = useRoutes();
  const [route, setRoute] = useState<RouteType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRoute(routeId).then(r => {
      setRoute(r);
      setLoading(false);
    });
  }, [routeId, getRoute]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
          <p>Loading route...</p>
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Route Not Found</h1>
        <a href="/dashboard" style={{ color: '#D32F2F' }}>← Back to Dashboard</a>
      </div>
    );
  }

  return (
    <NavigationView
      route={route}
      onExit={() => {
        window.location.href = '/dashboard';
      }}
      onComplete={() => {
        window.location.href = '/dashboard';
      }}
    />
  );
}

// Placeholder for route detail page
function RouteDetailPlaceholder() {
  const pathSegments = window.location.pathname.split('/');
  const routeId = pathSegments[pathSegments.length - 1];
  
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Route Detail Page</h1>
      <p>Route ID: {routeId}</p>
      <p>This page will be implemented in a future phase.</p>
      <a href="/dashboard" style={{ color: '#D32F2F' }}>← Back to Dashboard</a>
    </div>
  );
}

// 404 Page
function NotFound() {
  return (
    <div style={{ 
      padding: '4rem 2rem', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: '64px', marginBottom: '1rem' }}>🎅</div>
      <h1 style={{ marginBottom: '0.5rem', color: '#D32F2F' }}>404 - Page Not Found</h1>
      <p style={{ marginBottom: '2rem', color: '#616161' }}>
        Santa couldn't find this page!
      </p>
      <a 
        href="/dashboard"
        style={{
          padding: '0.75rem 1.5rem',
          background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '12px',
          fontWeight: 600,
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}

export default App;
