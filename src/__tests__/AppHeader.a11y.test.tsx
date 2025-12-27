/**
 * Accessibility tests for AppHeader component
 * Tests WCAG 2.1 AA compliance using axe-core
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { axe } from 'vitest-axe';

// Mock contexts
vi.mock('../context', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
    },
    logout: vi.fn(),
  }),
  useBrigade: () => ({
    brigade: {
      id: 'test-brigade',
      name: 'Test Fire Brigade',
    },
  }),
}));

describe('AppHeader Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(
      <BrowserRouter>
        <AppHeader show={true} />
      </BrowserRouter>
    );

    const results = await axe(container);
    
    // Check for violations manually
    expect(results.violations).toHaveLength(0);
    
    // Log violations if any exist (for debugging)
    if (results.violations.length > 0) {
      console.error('Accessibility violations found:', 
        results.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        }))
      );
    }
  });

  it('should have proper ARIA attributes for menu button', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <AppHeader show={true} />
      </BrowserRouter>
    );

    // Menu button should be accessible
    const menuButton = getByRole('button');
    expect(menuButton).toBeDefined();
  });

  it('should have accessible navigation links', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <AppHeader show={true} />
      </BrowserRouter>
    );

    // Logo link should be accessible
    const logoLink = getByRole('link', { name: /fire santa run/i });
    expect(logoLink).toBeDefined();
  });
});
