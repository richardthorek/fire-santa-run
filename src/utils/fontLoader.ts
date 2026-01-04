/**
 * Font Loader Utility
 * 
 * Asynchronously loads Google Fonts without blocking page render.
 * This approach is CSP-compliant (no inline event handlers).
 * 
 * The font link starts with media="print" to prevent render-blocking,
 * then switches to media="all" once the stylesheet is loaded.
 */

export function loadGoogleFonts(): void {
  // Find the Google Fonts link element
  const fontLink = document.getElementById('google-fonts-link') as HTMLLinkElement;
  
  if (!fontLink) {
    console.warn('Google Fonts link element not found');
    return;
  }
  
  // Check if the stylesheet is already loaded
  if (fontLink.media === 'all') {
    return; // Already loaded
  }
  
  // Use modern font loading API if available (better performance)
  if ('fonts' in document) {
    // Wait for fonts to be loaded
    (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => {
      fontLink.media = 'all';
    }).catch((error: Error) => {
      console.warn('Font loading API error:', error);
      // Fallback: Just switch media attribute
      fontLink.media = 'all';
    });
  } else {
    // Fallback for older browsers: switch media attribute immediately
    // The browser will handle the actual loading
    fontLink.media = 'all';
  }
}

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGoogleFonts);
  } else {
    // DOM already loaded
    loadGoogleFonts();
  }
}
