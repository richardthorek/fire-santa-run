/**
 * AppLayout component
 * 
 * Layout wrapper that includes the AppHeader for authenticated pages.
 * Some pages (like NavigationView and TrackingView) should not use this layout.
 */

import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { SkipLink } from './SkipLink';

export interface AppLayoutProps {
  /**
   * Child components to render in the layout
   */
  children: ReactNode;
  
  /**
   * Whether to show the header (can be hidden on specific pages)
   */
  showHeader?: boolean;
}

export function AppLayout({ children, showHeader = true }: AppLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <SkipLink />
      {showHeader && <AppHeader />}
      <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {children}
      </main>
    </div>
  );
}
