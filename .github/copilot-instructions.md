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

## Development Environment Setup

### Prerequisites Check
Before making changes, verify all required secrets are configured:
- `VITE_MAPBOX_TOKEN` - Required for all map functionality
- `AZURE_STORAGE_CONNECTION_STRING` - Required for production data persistence
- Real-time service credentials (Pusher, Firebase, or Supabase)

### Local Development
1. Clone repository
2. Copy `.env.example` to `.env.local`
3. Fill in required environment variables
4. Run `npm install`
5. Run `npm run dev`
6. Access at `http://localhost:5173`

## Architecture Guidelines

### Storage Layer
- Always use `storageAdapter` interface, never directly access localStorage or Azure
- Support both localStorage (dev) and Azure Table Storage (prod)
- Implement offline-first with sync when online

### Authentication
- Brigade-specific password-based auth (client-side only)
- Hash passwords using Web Crypto API (SHA-256)
- Store session tokens in sessionStorage (not localStorage)
- Never commit credentials or hardcode secrets

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

## Resources
- Mapbox GL JS Docs: https://docs.mapbox.com/mapbox-gl-js/
- Azure Table Storage SDK: https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/
- React Router v6 Docs: https://reactrouter.com/
- TypeScript Handbook: https://www.typescriptlang.org/docs/
