/**
 * SkipLink component
 * 
 * Provides a skip navigation link for keyboard users to bypass
 * repetitive navigation and jump straight to main content.
 * 
 * WCAG 2.1 AA Requirement: Bypass Blocks (2.4.1)
 */

import './SkipLink.css';

export function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
