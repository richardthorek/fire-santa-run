import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import './App.css';
import { useAuth, useBrigade } from './context';
import { storageAdapter } from './storage';
import { initializeMockData } from './utils/mockData';
import { useRoutes } from './hooks';
import { ProtectedRoute } from './components';
import type { Route as RouteType } from './types';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./pages').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./pages').then(m => ({ default: m.Dashboard })));
const RouteEditor = lazy(() => import('./pages').then(m => ({ default: m.RouteEditor })));
const NavigationView = lazy(() => import('./pages').then(m => ({ default: m.NavigationView })));
const TrackingView = lazy(() => import('./pages').then(m => ({ default: m.TrackingView })));
const RouteDetail = lazy(() => import('./pages').then(m => ({ default: m.RouteDetail })));
const ProfilePage = lazy(() => import('./pages').then(m => ({ default: m.ProfilePage })));
const BrigadeClaimingPage = lazy(() => import('./pages').then(m => ({ default: m.BrigadeClaimingPage })));
const MemberManagementPage = lazy(() => import('./pages').then(m => ({ default: m.MemberManagementPage })));
const InvitationAcceptancePage = lazy(() => import('./pages').then(m => ({ default: m.InvitationAcceptancePage })));
const LogoutPage = lazy(() => import('./pages').then(m => ({ default: m.LogoutPage })));
const CallbackPage = lazy(() => import('./pages').then(m => ({ default: m.CallbackPage })));

// Loading component
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

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
      <div style={{ paddingTop: isDevMode ? '2.5rem' : 0, height: '100%', width: '100%' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/track/:id" element={<TrackingViewWrapper />} />
            
            {/* Authentication Routes */}
            <Route path="/login" element={<Navigate to={`/${window.location.search}`} replace />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/auth/callback" element={<CallbackPage />} />
            
            {/* Protected Routes - Require authentication (except in dev mode) */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/brigades/claim" element={
              <ProtectedRoute>
                <BrigadeClaimingPage />
              </ProtectedRoute>
            } />
            <Route path="/invitations/:token" element={
              <ProtectedRoute>
                <InvitationAcceptancePage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/:brigadeId/members" element={
              <ProtectedRoute>
                <MemberManagementPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/routes/new" element={
              <ProtectedRoute>
                <RouteEditor mode="new" />
              </ProtectedRoute>
            } />
            <Route path="/routes/:id/edit" element={
              <ProtectedRoute>
                <RouteEditorWrapper />
              </ProtectedRoute>
            } />
            <Route path="/routes/:id/navigate" element={
              <ProtectedRoute>
                <NavigationViewWrapper />
              </ProtectedRoute>
            } />
            <Route path="/routes/:id" element={
              <ProtectedRoute>
                <RouteDetailWrapper />
              </ProtectedRoute>
            } />
            
            {/* Public Routes - No authentication required */}
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
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
  const navigate = useNavigate();
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
        <Link to="/dashboard" style={{ color: '#D32F2F' }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <NavigationView
      route={route}
      onExit={() => {
        navigate('/dashboard');
      }}
      onComplete={() => {
        navigate('/dashboard');
      }}
    />
  );
}

// Wrapper for Route Detail page
function RouteDetailWrapper() {
  const pathSegments = window.location.pathname.split('/');
  const routeId = pathSegments[pathSegments.length - 1]; // /routes/:id
  
  return <RouteDetail routeId={routeId} />;
}

// Wrapper for Tracking View (public page - no auth required)
function TrackingViewWrapper() {
  const pathSegments = window.location.pathname.split('/');
  const routeId = pathSegments[pathSegments.length - 1]; // /track/:id
  
  return <TrackingView routeId={routeId} />;
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
      <Link 
        to="/dashboard"
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
      </Link>
    </div>
  );
}

export default App;
