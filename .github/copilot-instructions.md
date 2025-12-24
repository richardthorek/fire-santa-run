# GitHub Copilot Agent Instructions for Fire Santa Run

## Project Overview
React + TypeScript web application for Australian Rural Fire Service brigades to plan and track Santa runs with real-time GPS tracking.

## Key Technologies
- React 19 + TypeScript
- Vite build system
- Mapbox GL JS for mapping
- Azure Table Storage for data persistence
- Socket.io / Pusher for real-time tracking
- React Router for navigation

## 🚀 Development Mode Strategy (IMPORTANT)

**Authentication has been moved to Phase 7** to enable rapid development and testing. The application supports two modes:

### Development Mode (VITE_DEV_MODE=true)
- **No authentication required** - All features accessible without login
- Mock brigade context automatically provided
- LocalStorage for data persistence (no Azure required)
- All routes and features publicly accessible
- Fast iteration and testing without auth barriers
- **Use this mode for all development until Phase 7**

### Production Mode (VITE_DEV_MODE=false)
- Microsoft Entra External ID authentication required
- Brigade isolation enforced
- Azure Table Storage for persistence
- Domain whitelist validation
- Full security controls

### When to Use Each Mode
- **Local Development:** Always use dev mode (VITE_DEV_MODE=true)
- **Preview Deployments:** Use dev mode for feature previews
- **Testing:** Use dev mode for easier test setup
- **Production:** Use production mode (VITE_DEV_MODE=false)

## Development Environment Setup

### Prerequisites Check
**Minimal Setup (Dev Mode):**
- `VITE_MAPBOX_TOKEN` - Required for all map functionality
- `VITE_DEV_MODE=true` - Enable dev mode bypass

**Optional (Production Mode):**
- `AZURE_STORAGE_CONNECTION_STRING` - Required for production data persistence
- Real-time service credentials (Pusher, Firebase, or Supabase)
- `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID` - For authentication

### Local Development
1. Clone repository
2. Copy `.env.example` to `.env.local`
3. Set `VITE_DEV_MODE=true` in `.env.local`
4. Add `VITE_MAPBOX_TOKEN` (only required variable for dev mode)
5. Run `npm install`
6. Run `npm run dev`
7. Access at `http://localhost:5173`

## Architecture Guidelines

### Authentication (Updated Strategy)
**Development Mode (Phase 1-6):**
- Mock authentication context that always returns "authenticated"
- Automatic brigade context without login
- No auth guards on protected routes in dev mode
- All features accessible for testing

**Production Mode (Phase 7+):**
- Microsoft Entra External ID (enterprise OAuth 2.0)
- Domain whitelist validation for brigade membership
- Protected route guards enforced
- Role-based access control (admin, operator, viewer)
- Session management with JWT tokens

**Implementation Pattern:**
```typescript
// Use environment variable to toggle auth mode
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

// Auth context returns mock data in dev mode
if (isDevMode) {
  return { isAuthenticated: true, user: mockUser };
}

// Real auth in production
return useMSALAuth();
```

### Storage Layer
- Always use `storageAdapter` interface, never directly access localStorage or Azure
- Support both localStorage (dev) and Azure Table Storage (prod)
- Implement offline-first with sync when online

### Route Management
- Routes belong to brigades (multi-tenancy)
- Route IDs must be globally unique
- Support draft, published, active, completed, archived states
- Generate QR codes using qrcode.react library

### Real-time Tracking
- Use WebSocket for production (Pusher/Firebase/Supabase)
- BroadcastChannel API for local multi-tab testing
- Graceful degradation if WebSocket unavailable
- Throttle location updates (max 1 per 5 seconds)

## Code Style
- Use TypeScript strict mode
- Functional components with hooks (no class components)
- Named exports for components
- Comprehensive JSDoc comments for utilities
- Mobile-first responsive design

## Testing Approach
- Test with mock Mapbox token for CI
- Use in-memory storage adapter for tests
- Mock WebSocket connections
- Test across mobile and desktop viewports

## Common Tasks

### Adding New Route Fields
1. Update `Route` interface in `src/types/index.ts`
2. Update both storage adapters (localStorage and Azure)
3. Update route form components
4. Update route display components
5. Run type check: `npm run build`

### Adding New Brigade Settings
1. Update `Brigade` interface in `src/types/index.ts`
2. Update brigade setup flow
3. Update storage adapters
4. Test with fresh localStorage and Azure table

### Deploying Changes
1. Ensure all tests pass: `npm test`
2. Ensure lint passes: `npm run lint`
3. Build successfully: `npm run build`
4. Commit changes to feature branch
5. Create PR (preview deployment automatic)
6. Merge to main (production deployment automatic)

## Troubleshooting

### Mapbox Not Loading
- Check `VITE_MAPBOX_TOKEN` is set correctly
- Verify token has correct scopes in Mapbox dashboard
- Check browser console for CORS errors

### Azure Storage Connection Fails
- Verify connection string format is correct
- Check CORS settings allow your domain
- Ensure tables exist in storage account
- Check Azure Storage firewall rules

### Real-time Tracking Not Working
- Verify WebSocket service credentials
- Check network tab for WebSocket connection
- Ensure location permissions granted in browser
- Check firewall/proxy doesn't block WebSocket

## Security Checklist
- [ ] No secrets in code or git history
- [ ] All user inputs sanitized
- [ ] Passwords properly hashed
- [ ] HTTPS enforced in production
- [ ] CORS properly configured
- [ ] CSP headers configured
- [ ] Dependencies regularly updated

## Performance Targets
- First Contentful Paint < 1.5s
- Time to Interactive < 3.5s
- Lighthouse Performance Score > 90
- Bundle size < 500KB (gzipped)

## Accessibility Requirements
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Touch targets minimum 44x44px

## Visual Design Guidelines

### Design Theme
This is a **fun, magical, whimsical Christmas app** with an **Australian summer Christmas style**. The design should be **modern, sleek, and impressive** while supporting fire brigade Santa run events.

### Australian Summer Christmas Aesthetic
- 🌞 Bright, sunny atmosphere with vibrant colors
- 🏖️ Beach-inspired elements (sand, surf, sunshine)
- 🌺 Native Australian flora (Christmas bush, bottlebrush, eucalyptus)
- 🎄 Australian twist on traditions (Santa in summer setting)
- 🚒 Fire service heritage and community pride

### Color Palette
```css
/* Primary Colors */
--fire-red: #D32F2F;           /* Fire brigade primary */
--fire-red-dark: #B71C1C;      /* Hover/active states */
--summer-gold: #FFA726;        /* Secondary highlights */
--christmas-green: #43A047;    /* Success states */

/* Supporting Colors */
--sky-blue: #29B6F6;          /* Info states */
--sand-beige: #FFECB3;        /* Neutral backgrounds */
--sunset-orange: #FF7043;     /* Warm accents */

/* Neutrals */
--neutral-50 to --neutral-900  /* Modern gray scale */
```

### Typography
- **Headings**: Nunito, Montserrat, or Poppins (bold, modern)
- **Body**: Inter or Open Sans (clean, readable)
- **Monospace**: JetBrains Mono for technical elements
- Mobile-first responsive scale (0.75rem to 3rem)

### Component Styling Approach

#### Cards
- Rounded corners (16px border-radius)
- Subtle gradient backgrounds
- Soft shadows with hover lift effects
- Optional festive decorative elements (sparkles, icons)

#### Buttons
- Gradient backgrounds for primary actions
- Generous padding (0.75rem 1.5rem)
- 12px border-radius
- Smooth transitions and hover effects
- Fire red for primary, summer gold for secondary

#### Navigation
- Sticky header with fire red gradient
- White text with semi-transparent hover states
- Mobile-friendly hamburger menu
- Clear active state indicators

#### Map Elements
- **Santa marker**: Pulsing red circle with animation
- **Waypoints**: Numbered circles, green when completed
- Custom styled popups matching color scheme
- Smooth marker animations

### Decorative Elements
- Subtle sparkle effects on success states
- Christmas lights as dividers (tasteful)
- Native flower illustrations in empty states
- Sun motifs and warm glows
- Fire service badge/emblem styling

### Animations
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for smooth transitions
- Gentle bounce for attention (`translateY(-8px)`)
- Pulse animation for live tracking
- Sparkle effects for celebrations
- Respect `prefers-reduced-motion`

### Accessibility
- WCAG 2.1 AA compliance minimum
- 4.5:1 contrast ratio for text
- 3px outline on focus states (summer gold)
- Touch targets minimum 44x44px
- Keyboard navigation support
- Screen reader friendly labels

### Responsive Design
- Mobile-first approach
- Breakpoints: 640px, 768px, 1024px, 1280px, 1536px
- Full-screen map on tracking pages
- Card-based layouts for dashboards
- Bottom sheets for mobile waypoint lists

### Dark Mode
- Optional dark mode support
- Adjust colors for dark backgrounds
- Use --neutral-900 base with lighter accents
- Maintain festive feel with adjusted saturation

### Implementation Best Practices
1. Use CSS custom properties for all colors and spacing
2. Create utility classes for common patterns
3. Build consistent component library
4. Optimize animations (use transforms, not layout properties)
5. Lazy load images, use WebP format
6. Progressive enhancement approach
7. Allow brigade-specific color customization

### Design System Resources
- Icons: Material Symbols Rounded or Phosphor Icons (rounded)
- Illustrations: undraw.co for empty states
- Color testing: WebAIM Contrast Checker
- Inspiration: NORAD Santa Tracker, modern SaaS dashboards

## Resources
- Mapbox GL JS Docs: https://docs.mapbox.com/mapbox-gl-js/
- Azure Table Storage SDK: https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/
- React Router v6 Docs: https://reactrouter.com/
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Visual Design: See MASTER_PLAN.md "Visual Design & Brand Identity" section
