# Font Loading Fix - CSP Compliance

## Issue
The application was experiencing a Content Security Policy (CSP) violation error:
```
Executing inline script violates the following Content Security Policy directive 'script-src 'self' 'unsafe-eval' blob:'. 
Either the 'unsafe-inline' keyword, a hash ('sha256-/6E9+lsJONkQ6SzmlAlCEF8vT24As0EkARral0byW+U='), 
or a nonce ('nonce-...') is required to enable inline execution.
```

This error was caused by an inline `onload` event handler in the `<link>` tag for Google Fonts:
```html
<link ... onload="this.media='all'; this.onload=null;" />
```

## Solution
Replaced the inline event handler with a CSP-compliant JavaScript module that handles font loading asynchronously.

### Implementation

**1. Removed Inline Handler (index.html)**
```html
<!-- Before (CSP violation) -->
<link 
  rel="stylesheet" 
  href="https://fonts.googleapis.com/css2?family=..."
  media="print"
  onload="this.media='all'; this.onload=null;"
>

<!-- After (CSP compliant) -->
<link 
  id="google-fonts-link"
  rel="stylesheet" 
  href="https://fonts.googleapis.com/css2?family=..."
  media="print"
>
```

**2. Created Font Loader Module (src/utils/fontLoader.ts)**
```typescript
export function loadGoogleFonts(): void {
  const fontLink = document.getElementById('google-fonts-link');
  
  if (!fontLink) return;
  
  if (fontLink.media === 'all') return; // Already loaded
  
  // Use modern Font Loading API if available
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      fontLink.media = 'all';
    }).catch(() => {
      fontLink.media = 'all'; // Fallback
    });
  } else {
    fontLink.media = 'all'; // Older browsers
  }
}

// Auto-initialize
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGoogleFonts);
  } else {
    loadGoogleFonts();
  }
}
```

**3. Imported in Main Entry Point (src/main.tsx)**
```typescript
import './utils/fontLoader'; // Initialize async font loading
```

## Benefits

1. **CSP Compliant**: No inline event handlers
2. **Better Performance**: Uses Font Loading API when available
3. **Graceful Degradation**: Falls back for older browsers
4. **Testable**: Pure JavaScript module with unit tests
5. **Maintainable**: Clear separation of concerns

## Testing

Comprehensive unit tests cover:
- Basic media attribute switching
- Missing element handling
- Already loaded check
- Font Loading API integration
- Error handling and fallbacks

Run tests:
```bash
npm test -- src/utils/__tests__/fontLoader.test.ts
```

## CSP Configuration

The application's CSP policy (staticwebapp.config.json):
```json
{
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-eval' blob:; ..."
}
```

Note: `script-src` does NOT include `'unsafe-inline'`, which is intentional for security.

## Related Files

- `index.html` - HTML structure with font link
- `src/utils/fontLoader.ts` - Font loading utility
- `src/utils/__tests__/fontLoader.test.ts` - Unit tests
- `src/main.tsx` - Application entry point
- `staticwebapp.config.json` - CSP configuration

## References

- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)
- [Async CSS Loading](https://www.filamentgroup.com/lab/load-css-simpler/)
