import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute component that wraps authenticated pages.
 * 
 * In dev mode (VITE_DEV_MODE=true):
 * - Automatically allows access with mock authentication
 * - No redirects, instant access
 * 
 * In production mode (VITE_DEV_MODE=false):
 * - Requires actual Microsoft Entra External ID authentication
 * - Redirects to /login if not authenticated
 * - Preserves return URL for post-login redirect
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // In dev mode, always allow access
  if (isDevMode) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎅</div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated, preserving the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
