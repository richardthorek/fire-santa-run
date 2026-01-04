/**
 * Landing Page Sign-In Handler
 * 
 * Handles progressive enhancement for the landing page.
 * Loads the full React application when user clicks sign in.
 * 
 * This file is served as an external script to comply with CSP
 * (Content Security Policy) requirements - no inline scripts allowed.
 */

// Only load full React app when user wants to sign in
const signinBtn = document.getElementById('signin-btn');
let appLoading = false;

if (signinBtn) {
  signinBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (appLoading) return;
    appLoading = true;
    
    // Update button state
    signinBtn.textContent = '⏳ Loading...';
    signinBtn.disabled = true;
    
    // Load the full React application
    try {
      // Intentional full page reload to transition from static HTML to React SPA
      // This is by design - static page has no React, so we navigate to trigger app load
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Failed to load app:', error);
      signinBtn.textContent = '❌ Error - Retry';
      signinBtn.disabled = false;
      appLoading = false;
    }
  });
  
  // Check if dev mode and update UI
  const isDevMode = window.location.search.includes('dev=true');
  if (isDevMode) {
    signinBtn.textContent = '🛠️ Dev Mode - Enter';
  }
}
