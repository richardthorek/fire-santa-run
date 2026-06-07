/**
 * Accessibility tests for the launch static pages (privacy, terms, help).
 * These pages are public-facing and self-contained (no storage/auth), so they
 * render cleanly under axe. Tests WCAG 2.1 AA compliance using axe-core.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { PrivacyPolicyPage } from '../pages/PrivacyPolicyPage';
import { TermsPage } from '../pages/TermsPage';
import { HelpPage } from '../pages/HelpPage';

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe('Launch static pages accessibility', () => {
  it('PrivacyPolicyPage has no accessibility violations', async () => {
    const { container } = renderWithRouter(<PrivacyPolicyPage />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('TermsPage has no accessibility violations', async () => {
    const { container } = renderWithRouter(<TermsPage />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('HelpPage has no accessibility violations', async () => {
    const { container } = renderWithRouter(<HelpPage />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it('each page has exactly one h1 heading', () => {
    for (const ui of [<PrivacyPolicyPage key="p" />, <TermsPage key="t" />, <HelpPage key="h" />]) {
      const { container, unmount } = renderWithRouter(ui);
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      unmount();
    }
  });
});
