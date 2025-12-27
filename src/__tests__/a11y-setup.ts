/**
 * Accessibility testing setup and utilities
 * Configures axe-core for vitest integration
 */

import { configureAxe } from 'vitest-axe';

/**
 * Configure axe-core with project-specific rules
 * 
 * WCAG AA compliance requirements:
 * - Color contrast: 4.5:1 for text, 3:1 for UI components
 * - Keyboard navigation: All interactive elements accessible
 * - Screen reader support: Proper ARIA labels and semantic HTML
 * - Focus management: Visible focus indicators
 */
export const axe = configureAxe({
  rules: {
    // Enable all WCAG 2.1 AA rules
    'color-contrast': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'button-name': { enabled: true },
    'image-alt': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'document-title': { enabled: true },
    'html-has-lang': { enabled: true },
    'valid-lang': { enabled: true },
  },
  // Check against WCAG 2.1 AA standards
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
});

/**
 * Helper to get accessibility violation summary
 */
export function formatViolations(violations: Array<{ 
  impact: string; 
  help: string; 
  description: string; 
  tags: string[]; 
  nodes: Array<{ html: string; failureSummary: string }>; 
  helpUrl: string 
}>) {
  if (violations.length === 0) {
    return '✅ No accessibility violations found';
  }

  return violations.map((violation) => {
    const nodeInfo = violation.nodes.map((node) => {
      return `    - ${node.html}\n      ${node.failureSummary}`;
    }).join('\n');

    return `
❌ ${violation.impact.toUpperCase()}: ${violation.help}
  ${violation.description}
  WCAG: ${violation.tags.filter((t: string) => t.startsWith('wcag')).join(', ')}
  Affected elements (${violation.nodes.length}):
${nodeInfo}
  Fix: ${violation.helpUrl}
`;
  }).join('\n');
}
