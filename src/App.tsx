import { type CSSProperties, useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, Link } from 'react-router-dom';
import { Gift, Wrench, Home, Search } from 'lucide-react';
import './App.css';
import { useAuth, useBrigade } from './context';
import { storageAdapter } from './storage';
import { initializeMockData } from './utils/mockData';
import { useRoutes, useServiceWorker } from './hooks';
// Imported from their own modules (not the components barrel) so the entry
// chunk doesn't pull map-heavy components — the barrel re-exports MapView and
// friends, which drag mapbox-gl (~1.7 MB) into the first paint of every page.
import { ProtectedRoute } from './components/ProtectedRoute';
import { InstallBanner } from './components/InstallBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Route as RouteType } from './types';

// Lazy load pages for code splitting. Each page is imported from its own
// module: lazy-importing the pages barrel would fuse all pages (and their
// dependencies, including mapbox-gl) into a single chunk, defeating splitting.
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const RouteEditor = lazy(() => import('./pages/RouteEditor').then(m => ({ default: m.RouteEditor })));
const NavigationView = lazy(() => import('./pages/NavigationView').then(m => ({ default: m.NavigationView })));
const TrackingView = lazy(() => import('./pages/TrackingView').then(m => ({ default: m.TrackingView })));
const PublicBrigadePage = lazy(() => import('./pages/PublicBrigadePage').then(m => ({ default: m.PublicBrigadePage })));
const RouteDetail = lazy(() => import('./pages/RouteDetail').then(m => ({ default: m.RouteDetail })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const BrigadeSettingsPage = lazy(() => import('./pages/BrigadeSettingsPage').then(m => ({ default: m.BrigadeSettingsPage })));
const BrigadeDiscoveryPage = lazy(() => import('./pages/BrigadeDiscoveryPage').then(m => ({ default: m.BrigadeDiscoveryPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const LogoutPage = lazy(() => import('./pages/auth/LogoutPage').then(m => ({ default: m.LogoutPage })));
const TemplateLibrary = lazy(() => import('./pages/TemplateLibrary').then(m => ({ default: m.TemplateLibrary })));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const RoutePosterPage = lazy(() => import('./pages/RoutePosterPage').then(m => ({ default: m.RoutePosterPage })));
const AdminPortalPage = lazy(() => import('./pages/admin').then(m => ({ default: m.AdminPortalPage })));

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

const updateBannerStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: 'var(--ink)',
  color: 'var(--snow)',
  padding: '0.75rem 1.25rem',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  zIndex: 10000,
  boxShadow: 'var(--shadow-lg)',
  fontSize: '0.875rem',
};

const updateButtonStyle: CSSProperties = {
  padding: '0.4rem 0.9rem',
  background: 'var(--santa-red)',
  color: 'var(--snow)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  fontSize: '0.875rem',
};

function App() {
  const [initialized, setInitialized] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { brigade, isLoading: brigadeLoading } = useBrigade();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const { isUpdateAvailable, applyUpdate } = useServiceWorker();

  // Initialize mock data in dev mode
  useEffect(() => {
    const init = async () => {
      if (isDevMode && !initialized) {
        try {
          await initializeMockData(
            storageAdapter.saveBrigade.bind(storageAdapter),
            storageAdapter.saveRoute.bind(storageAdapter)
          );
        } catch (err) {
          // Seeding failure must not brick the dev app on the loading screen.
          console.error('Failed to initialize mock data:', err);
        } finally {
          setInitialized(true);
        }
      }
    };
    init();
  }, [isDevMode, initialized]);

  // In dev mode, wait for mock data to be seeded before rendering any route so
  // pages that read storage on mount (dashboard, discovery) don't race the seed.
  if (authLoading || brigadeLoading || (isDevMode && !initialized)) {
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
      {/* Service Worker Update Banner */}
      {isUpdateAvailable && (
        <div style={updateBannerStyle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gift size={18} aria-hidden="true" />
            A new version is available!
          </span>
          <button onClick={applyUpdate} style={updateButtonStyle}>
            Update
          </button>
        </div>
      )}

      {/* PWA Install Banner */}
      <InstallBanner />

      {/* Dev Mode Indicator */}
      {isDevMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--summer-gold)',
          color: 'var(--summer-gold-ink)',
          padding: '0.5rem',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '0.875rem',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          <Wrench size={16} aria-hidden="true" />
          Development Mode • {user?.email} • {brigade?.name}
        </div>
      )}
      
      {/* Main Routes */}
      <div style={{ paddingTop: isDevMode ? '2.5rem' : 0, height: '100%', width: '100%' }}>
        <ErrorBoundary label="page">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/track/:id" element={<TrackingViewWrapper />} />
            <Route path="/demo" element={<TrackingViewWrapper demo />} />
            {/* Poster resolves only published routes (public lookup) — safe unauthenticated */}
            <Route path="/routes/:id/poster" element={<RoutePosterPage />} />
            <Route path="/brigade/:slug" element={
              <ErrorBoundary label="brigade page">
                <PublicBrigadePage />
              </ErrorBoundary>
            } />
            <Route path="/brigades" element={<BrigadeDiscoveryPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/help" element={<HelpPage />} />
            
            {/* Authentication Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* Protected Routes - Require authentication (except in dev mode) */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/:brigadeId/settings" element={
              <ProtectedRoute>
                <BrigadeSettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/:brigadeId" element={
              <Navigate to="/dashboard" replace />
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/templates" element={
              <ProtectedRoute>
                <TemplateLibrary />
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
            <Route path="/routes/:routeId/analytics" element={
              <ProtectedRoute>
                <AnalyticsDashboard />
              </ProtectedRoute>
            } />

            {/* Platform administration — the page itself also gates on isPlatformAdmin */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminPortalPage />
              </ProtectedRoute>
            } />

            {/* Public Routes - No authentication required */}
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

// Wrapper to extract route ID from URL params
function RouteEditorWrapper() {
  const { id = '' } = useParams<{ id: string }>();

  return <RouteEditor mode="edit" routeId={id} key={id} />;
}

// Wrapper for Navigation View
function NavigationViewWrapper() {
  const navigate = useNavigate();
  const { id: routeId = '' } = useParams<{ id: string }>();
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
        <Link to="/dashboard" style={{ color: 'var(--santa-red)' }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <ErrorBoundary label="navigation view">
      <NavigationView
        route={route}
        onExit={() => {
          navigate('/dashboard');
        }}
        onComplete={() => {
          navigate('/dashboard');
        }}
      />
    </ErrorBoundary>
  );
}

// Wrapper for Route Detail page
function RouteDetailWrapper() {
  const { id = '' } = useParams<{ id: string }>();

  return <RouteDetail routeId={id} key={id} />;
}

// Wrapper for Tracking View (public page - no auth required)
function TrackingViewWrapper({ demo = false }: { demo?: boolean }) {
  const { id = '' } = useParams<{ id: string }>();
  const routeId = demo ? 'demo' : id;

  return (
    <ErrorBoundary label="Santa tracker">
      {/* key resets per-route view state (live progress, camera) on navigation */}
      <TrackingView routeId={routeId} demo={demo} key={routeId} />
    </ErrorBoundary>
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
      <h1 style={{ marginBottom: '0.5rem', color: 'var(--santa-red)' }}>404 - Page Not Found</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--slate-500)' }}>
        Santa couldn't find this page!
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--santa-red)',
            color: 'var(--snow)',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
          }}
        >
          <Home size={18} aria-hidden="true" />
          Go Home
        </Link>
        <Link
          to="/brigades"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--snow)',
            color: 'var(--santa-red)',
            textDecoration: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            border: '2px solid var(--santa-red)',
          }}
        >
          <Search size={18} aria-hidden="true" />
          Find a Brigade
        </Link>
      </div>
    </div>
  );
}

export default App;
