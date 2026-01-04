# Landing Page CSP Compliance Fix

## Issue
The static landing page (`/public/landing-static.html`) contained an inline `<script type="module">` block that violated the Content Security Policy (CSP) directive:

```
Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'unsafe-eval' blob:'. 
Either the 'unsafe-inline' keyword, a hash ('sha256-/6E9+lsJONkQ6SzmlAlCEF8vT24As0EkARral0byW+U='), 
or a nonce ('nonce-...') is required to enable inline execution.
```

This CSP violation was preventing the sign-in button from functioning correctly.

## Root Cause
The landing page had an inline script (lines 264-297) that handled the sign-in button click event. The CSP policy correctly does **not** include `'unsafe-inline'` for security reasons, so this inline script was blocked by the browser.

## Solution
Extracted the inline script to an external JavaScript file (`/public/landing-signin.js`) and updated the HTML to reference it via a `<script src="">` tag.

### Implementation Details

**1. Created External Script File**
- **File:** `/public/landing-signin.js`
- **Purpose:** Handles sign-in button click event
- **Features:**
  - Progressive enhancement
  - Navigates to `/dashboard` when sign-in is clicked
  - Dev mode detection for UI updates
  - Loading state management
  - Error handling

**2. Updated HTML**
- **File:** `/public/landing-static.html`
- **Changed:**
  ```html
  <!-- Before: Inline script (CSP violation) -->
  <script type="module">
    // 30+ lines of inline JavaScript
  </script>
  
  <!-- After: External script (CSP compliant) -->
  <script src="/landing-signin.js"></script>
  ```

## Benefits

1. **Security:** Maintains strict CSP without `'unsafe-inline'`
2. **Compliance:** No CSP violations in browser console
3. **Functionality:** Sign-in button works correctly
4. **Maintainability:** Easier to test and modify JavaScript separately
5. **Performance:** Same performance characteristics (both are non-blocking)
6. **Build:** Vite automatically copies public files to dist/

## Testing

### Manual Testing
1. Navigate to `http://localhost:5173/landing-static.html`
2. Open browser console (no CSP errors should appear)
3. Click "Sign In" button
4. Verify navigation to `/dashboard` works
5. Verify no CSP violations in console

### Browser Console Validation
- ✅ No CSP violations for inline scripts
- ✅ External script loads successfully
- ✅ Sign-in button functionality works
- ✅ Navigation to dashboard succeeds

### Build Verification
```bash
npm run build
ls -lh dist/landing-signin.js  # Verify file copied
grep "landing-signin.js" dist/landing-static.html  # Verify reference
```

## CSP Configuration

The application's CSP policy remains strict and secure:

```json
{
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-eval' blob:; ..."
}
```

**Note:** `'unsafe-inline'` is intentionally **not** included in `script-src` for security.

## Related Documentation

- **Previous Fix:** `docs/FONT_LOADING_FIX.md` - Fixed Google Fonts inline script CSP violation
- **CSP Config:** `staticwebapp.config.json` - Global security headers
- **External Script:** `public/landing-signin.js` - Sign-in handler implementation

## Alternative Approaches Considered

1. **Adding CSP hash:** Would require updating hash on every script change
2. **Using nonce:** Would require server-side rendering to generate nonces
3. **Adding 'unsafe-inline':** Weakens security posture (rejected)
4. **Removing Google Fonts:** Not necessary; fonts issue was already fixed

## References

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [MDN: CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
- [Azure Static Web Apps CSP](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
