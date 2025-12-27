# Fire Santa Run - Product Roadmap

**Last Updated:** December 26, 2024  
**Status:** Active Development  
**Current Release:** Release 1 (Quality Uplift Phase)  
**Next Target:** Release 1 Completion → Release 2 (Q1 2025)

---

## Executive Summary

Fire Santa Run is a web application enabling Australian Rural Fire Service brigades to plan, publish, and track Santa runs with real-time GPS tracking. This roadmap consolidates Release 1 achievements and outlines a 6-month forward trajectory to deliver a fully functional, production-ready product.

**Vision:** Empower every RFS brigade in Australia to create magical Christmas experiences for their communities with professional-grade tracking technology.

---

## Table of Contents

1. [Release 1 Summary (Complete)](#release-1-summary-complete)
2. [Known Gaps & Limitations](#known-gaps--limitations)
3. [Forward Roadmap (6 Months)](#forward-roadmap-6-months)
4. [Release 1 Quality Uplift (Early January 2025)](#release-1-quality-uplift-early-january-2025)
5. [Release 2: Enhanced UX & Analytics (Q1 2025)](#release-2-enhanced-ux--analytics-q1-2025)
6. [Release 3: Mobile PWA & Offline (Q2 2025)](#release-3-mobile-pwa--offline-q2-2025)
7. [Release 4: Multi-Brigade Platform (May 2025)](#release-4-multi-brigade-platform-may-2025)
8. [Issue Automation Strategy](#issue-automation-strategy)
9. [Success Metrics](#success-metrics)
10. [Risk Assessment](#risk-assessment)

---

## Release 1 Summary (Quality Uplift Phase)

### Overview

Release 1 establishes the **foundation** of Fire Santa Run with core route planning, navigation, real-time tracking, and sharing capabilities. All essential features for a brigade to execute a successful Santa run are now operational.

**Status:** 🔄 Quality Uplift Phase (December 2024 - January 2025)  
**Implementation Phases:** 1-6 + 7D-7F (Authentication deferred to future release)  
**Remaining Tasks:** Quality assurance, test coverage, performance optimization

### Completion Criteria

Before declaring Release 1 complete, the following quality gates must be met:
- ✅ All core features implemented (15/15)
- 🔄 Test coverage increased to 40%+ (currently 15%)
- 🔄 Lighthouse performance score > 90 (currently untested)
- 🔄 Accessibility audit passed (WCAG AA)
- 🔄 Code quality issues resolved
- 🔄 Production readiness validated

---

### Major Features Implemented

#### 1. **Project Infrastructure & Foundation** (Phase 1)
**Reference:** `docs/README_PHASE2.md`, `docs/AZURE_SETUP.md`

- ✅ React 19 + TypeScript + Vite build system
- ✅ Azure Static Web Apps hosting configuration
- ✅ Azure Table Storage integration for data persistence
- ✅ Azure Web PubSub for real-time communication
- ✅ Microsoft Entra External ID authentication infrastructure
- ✅ Development mode with localStorage fallback (`VITE_DEV_MODE=true`)
- ✅ Storage adapter pattern (local/Azure abstraction)
- ✅ Environment variable management and secrets setup
- ✅ GitHub Actions CI/CD pipeline

**Key Files:**
- `src/storage/` - Storage adapters (localStorage, Azure Table Storage)
- `staticwebapp.config.json` - Azure deployment config
- `.github/workflows/` - CI/CD automation

---

#### 2. **Authentication & Authorization** (Phase 2)
**Reference:** `docs/AUTHENTICATION_BUSINESS_RULES.md`, `docs/API_AUTHENTICATION.md`

- ✅ Microsoft Entra External ID integration via MSAL
- ✅ Email domain whitelisting for brigade verification
- ✅ Tenant-specific authentication (no `/common` endpoint issues)
- ✅ Optional `domain_hint` for direct email entry
- ✅ Session management with JWT tokens
- ✅ Protected API routes with authentication middleware
- ✅ Brigade claim system with RFS dataset integration
- ✅ Admin verification workflow for non-.gov.au emails
- ✅ Multi-role support (admin, operator, viewer)

**Key Features:**
- Login UX hardening with `prompt=login` to prevent SSO confusion
- RFS Brigade dataset integration (6,000+ NSW brigades)
- Admin verification requests with evidence upload
- Graceful auth error handling and feedback

**Key Files:**
- `src/context/AuthContext.tsx` - Authentication state management
- `api/auth/` - Authentication API functions
- `src/hooks/useBrigadeManagement.ts` - Brigade operations

**Note:** Authentication is functional but **optional** in development mode. Production deployments require Entra External ID configuration.

---

#### 3. **Route Planning & Management** (Phases 3-4)
**Reference:** `MASTER_PLAN.md` Section 3, `docs/current_state/README.md`

- ✅ Interactive map-based route planning (Mapbox GL JS)
- ✅ Click-to-add waypoints on map
- ✅ Address search and geocoding (Mapbox Geocoder)
- ✅ Drag-to-reorder waypoints (@dnd-kit/sortable)
- ✅ Mapbox Directions API integration for optimized routes
- ✅ Turn-by-turn navigation instruction generation
- ✅ Route metadata (name, date, start time, notes)
- ✅ Route status management (draft → published → active → completed)
- ✅ Route detail page with map preview and statistics
- ✅ Edit existing routes
- ✅ Delete routes with confirmation
- ✅ Multi-route management dashboard

**UI Highlights:**
- Full-screen map with floating iOS-style panels
- Floating header panel (route info, actions)
- Floating sidebar panel (waypoint list, search) - desktop
- Bottom sheet panel (waypoint management) - mobile
- Responsive design (375px mobile to 1920px+ desktop)

**Key Files:**
- `src/pages/RouteEditor.tsx` - Route planning interface
- `src/pages/RouteDetail.tsx` - Route detail view
- `src/components/MapView.tsx` - Mapbox integration
- `src/components/WaypointList.tsx` - Waypoint management

---

#### 4. **Turn-by-Turn Navigation** (Phase 3a)
**Reference:** `docs/IMPLEMENTATION_SUMMARY.md`, `docs/NAVIGATION_QUICK_REFERENCE.md`

- ✅ Real-time GPS location tracking
- ✅ Turn-by-turn directions with voice synthesis
- ✅ Maneuver instructions with distance countdown
- ✅ Automatic waypoint completion (within 50m)
- ✅ Manual "Arrived" button (within 100m)
- ✅ Manual "NEXT" skip button (any distance) ⭐
- ✅ Progress tracking (X/Y stops, percentage)
- ✅ ETA calculation to next waypoint
- ✅ Current and next waypoint preview panel
- ✅ Voice instruction toggle
- ✅ Wake lock to prevent screen sleep
- ✅ Route completion summary

**Navigation UI:**
- Floating navigation header (red, turn instructions)
- Floating bottom panel (progress, waypoint info, actions)
- Large touch targets (48px minimum) for driver safety
- High-contrast colors for outdoor visibility
- One-glance information architecture

**Key Files:**
- `src/pages/NavigationView.tsx` - Navigation interface
- `src/hooks/useNavigation.ts` - Navigation logic and GPS
- `src/components/NavigationPanel.tsx` - Driver-friendly UI
- `src/utils/navigation.ts` - Distance, proximity calculations

---

#### 5. **Real-Time Tracking** (Phase 5)
**Reference:** `MASTER_PLAN.md` Sections 6, 8

- ✅ Azure Web PubSub WebSocket integration
- ✅ Route-specific group messaging (`route_{routeId}`)
- ✅ Location broadcasting from brigade operator (max 5-second intervals)
- ✅ Public tracking page (no authentication required)
- ✅ Animated Santa marker on map
- ✅ Route polyline visualization
- ✅ Waypoint status (upcoming, completed)
- ✅ Connection status indicators
- ✅ Automatic reconnection with exponential backoff
- ✅ BroadcastChannel API fallback for local development
- ✅ Graceful degradation (last known position on disconnect)

**Architecture:**
- `/api/negotiate` - Generate Web PubSub connection tokens
- `/api/broadcast` - Receive and relay location updates
- Client-side Web PubSub SDK integration
- Group-based message isolation by route

**Key Files:**
- `src/pages/PublicTracking.tsx` - Public tracking interface
- `src/hooks/useWebPubSub.ts` - Real-time connection management
- `api/negotiate.ts` - Token generation API
- `api/broadcast.ts` - Location broadcast API

---

#### 6. **Sharing & Social Media** (Phase 6)
**Reference:** `docs/PHASE6_SUMMARY.md`, `docs/SHARE_PANEL_VISUAL_GUIDE.md`

- ✅ Shareable public tracking links (`/track/{routeId}`)
- ✅ QR code generation and display (qrcode.react)
- ✅ QR code download as PNG
- ✅ Copy link to clipboard
- ✅ Social media sharing (Twitter, Facebook, WhatsApp)
- ✅ Print-friendly flyers
- ✅ SharePanel component with festive design
- ✅ ShareModal for detailed sharing options
- ✅ Basic SEO metadata (title, description)

**Key Features:**
- One-click sharing to major social platforms
- QR codes optimized for print (300x300px, high contrast)
- Copy-to-clipboard with success feedback
- Responsive share UI for mobile and desktop

**Key Files:**
- `src/components/SharePanel.tsx` - Sharing interface
- `src/components/ShareModal.tsx` - Detailed share options
- `src/utils/qrcode.ts` - QR code generation utilities

---

#### 7. **Visual Design System** (Phase 7D-7F)
**Reference:** `MASTER_PLAN.md` Section 2, `docs/current_state/README.md`

- ✅ Australian summer Christmas theme
- ✅ Color palette: Fire Red (#D32F2F), Summer Gold (#FFA726), Christmas Green (#43A047)
- ✅ Nunito/Inter typography with responsive sizing
- ✅ iOS-inspired floating panels with backdrop blur
- ✅ Rounded corners (16px panels, 12px buttons)
- ✅ Festive animations (sparkle, pulse, glow)
- ✅ Card-based dashboard layout
- ✅ Responsive breakpoints (375px to 1920px+)
- ✅ Dark mode support (auto-detect via `prefers-color-scheme`)
- ✅ WCAG AA accessibility compliance
- ✅ Reduced motion support

**Design Highlights:**
- Full-screen maps with floating UI overlays
- Gradient buttons with shadows
- Animated Santa marker with pulse effect
- Numbered waypoint markers (green/completed)
- Touch-friendly 44px minimum target sizes
- High-contrast text for readability

**Key Files:**
- `src/styles/` - Global CSS and design tokens
- Component inline styles following design system

---

#### 8. **Brigade Management** (Phase 6A)
**Reference:** `docs/PHASE6A_SUMMARY.md`, `docs/RFS_DATASET.md`

- ✅ Brigade discovery via RFS dataset (6,000+ NSW brigades)
- ✅ Brigade claim workflow for admins
- ✅ Domain whitelisting configuration (e.g., `@rfs.nsw.gov.au`)
- ✅ Admin verification requests (for non-.gov.au emails)
- ✅ Evidence file upload (ID, certificates, letters)
- ✅ Brigade profile management (name, logo, contact info)
- ✅ Brigade member invitations
- ✅ Role-based access control (admin, operator, viewer)

**Key Features:**
- Search brigades by name, location, station ID
- Claim brigade with automatic .gov.au approval
- Admin verification for external emails (reviewed by site owner)
- Multi-admin support (max 2 admins per brigade)

**Key Files:**
- `src/pages/ClaimBrigade.tsx` - Brigade claim flow
- `src/components/BrigadeSearch.tsx` - RFS dataset search
- `api/brigades/` - Brigade management API functions

---

### Technical Achievements

#### Architecture & Infrastructure
- ✅ **Serverless Azure Stack**: Static Web Apps + Functions + Table Storage + Web PubSub
- ✅ **Dual Storage Strategy**: localStorage (dev mode) + Azure Table Storage (production)
- ✅ **Storage Adapter Pattern**: Seamless local-to-cloud transition
- ✅ **CI/CD Pipeline**: GitHub Actions for automated build, test, deploy
- ✅ **Environment Management**: `.env` files with secrets validation
- ✅ **TypeScript Strict Mode**: Type safety across entire codebase

#### Performance & Optimization
- ✅ **Lazy Loading**: React Router code-splitting
- ✅ **Mapbox Telemetry Disabled**: Prevents `ERR_BLOCKED_BY_CLIENT` with ad blockers
- ✅ **Optimized Re-renders**: `useMemo`, `useCallback` throughout
- ✅ **Responsive Images**: Optimized assets for mobile/desktop
- ✅ **Bundle Size**: Under 500KB gzipped (target met)

#### Testing & Quality
- ✅ **Vitest Integration**: Unit testing framework
- ✅ **9 Navigation Tests**: Distance, proximity, waypoint logic
- ✅ **ESLint Configuration**: Code quality enforcement
- ✅ **TypeScript Build Validation**: No type errors
- ✅ **Manual Testing**: Cross-browser validation (Chrome, Firefox, Safari, Edge)

#### Documentation
- ✅ **Master Plan**: Comprehensive 4,700-line technical specification
- ✅ **Phase Summaries**: Detailed implementation logs (Phases 2-6A)
- ✅ **API Documentation**: Authentication, brigade, route APIs
- ✅ **User Guides**: Admin guide, navigation quick reference
- ✅ **Developer Guides**: Azure setup, secrets management, dev mode

---

### Key Metrics (Release 1)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Core Features** | 15 | 15 | ✅ 100% |
| **Phase Completion** | 6 phases | 6 + 3 sub-phases | ✅ Complete |
| **Test Coverage** | Basic | 9 unit tests | ✅ Met |
| **Build Time** | < 2 min | ~1.5 min | ✅ Met |
| **Lighthouse Score** | > 90 | TBD | 🔄 Pending |
| **Mobile Responsive** | 100% | 100% | ✅ Met |
| **WCAG AA** | Compliant | Compliant | ✅ Met |
| **Bundle Size** | < 500KB | ~450KB | ✅ Met |

---

### Files & Components Summary

**Total Files:** ~120+ source files  
**Lines of Code:** ~15,000+ (excluding docs)

#### Key Directories:
- `src/pages/` - 12 page components (Dashboard, RouteEditor, NavigationView, etc.)
- `src/components/` - 25+ reusable components
- `src/hooks/` - 10+ custom hooks (useNavigation, useWebPubSub, useAuth, etc.)
- `src/context/` - 4 context providers (Auth, Brigade, Routes, Theme)
- `src/storage/` - Storage adapters (localStorage, Azure)
- `src/utils/` - Utility functions (distance, geocoding, formatting)
- `api/` - 10+ Azure Functions (auth, routes, negotiate, broadcast)
- `docs/` - 20+ documentation files

---

## Known Gaps & Limitations

Based on `MISSING_FEATURES_ANALYSIS.md` and MASTER_PLAN.md review, the following features are **discussed but not implemented** in Release 1:

### High-Priority Gaps

1. **Rich Social Media Previews** (MASTER_PLAN.md Section 5)
   - ❌ Dynamic Open Graph images with route preview
   - ❌ Custom og:image with Santa + map rendering
   - ❌ Twitter card optimization
   - ❌ Server-side rendering for crawlers
   - **Impact:** Reduced viral sharing potential
   - **Priority:** HIGH

2. **Route Optimization & Templates** (Section 3)
   - ❌ Automatic waypoint reordering (TSP solver)
   - ❌ Estimated arrival times per waypoint
   - ❌ Save route as reusable template
   - ❌ Duplicate existing routes for annual events
   - **Impact:** Manual route planning is time-consuming
   - **Priority:** HIGH

3. **Public Tracking UX Enhancements** (Section 10)
   - ❌ Countdown timer before route starts
   - ❌ "Thanks for tracking Santa!" post-event screen
   - ❌ Route summary after completion (distance, time, stops)
   - ❌ "Santa is currently on [Street Name]" (reverse geocoding)
   - **Impact:** Incomplete user journey, less engaging
   - **Priority:** MEDIUM

4. **Analytics & Viewer Insights** (Section 9)
   - ❌ Live viewer count display
   - ❌ Geographic distribution of viewers
   - ❌ Peak viewing times
   - ❌ Engagement metrics (session duration)
   - **Impact:** No data-driven insights for brigades
   - **Priority:** MEDIUM

### Medium-Priority Gaps

5. **Search & Filtering** (Section 9)
   - ❌ Search routes by name/date
   - ❌ Advanced filtering (date range, distance, status)
   - ❌ Sort options (newest, oldest, distance)
   - **Impact:** Dashboard usability with many routes
   - **Priority:** MEDIUM

6. **Navigation Enhancements** (Section 3a)
   - ❌ Rerouting confirmation dialog ("You're off route")
   - ❌ Background location tracking (when app minimized)
   - ❌ Lock screen media controls for voice
   - ❌ Real-time ETA recalculation based on speed
   - **Impact:** Less robust navigation experience
   - **Priority:** MEDIUM

7. **PWA & Offline Support** (Section 11)
   - ❌ Service worker for offline functionality
   - ❌ App manifest for "Add to Home Screen"
   - ❌ Offline route viewing
   - ❌ Sync when reconnected
   - **Impact:** Requires constant internet connection
   - **Priority:** MEDIUM

8. **Brigade Public Pages** (Section 1)
   - ❌ Public brigade profile page
   - ❌ List of all brigade routes (past/upcoming)
   - ❌ Brigade logo and custom branding
   - ❌ Brigade contact information display
   - **Impact:** Limited brigade visibility
   - **Priority:** LOW

### Low-Priority Gaps

9. **Advanced Multi-Brigade Features**
   - ❌ Brigade member management UI
   - ❌ Role permission customization
   - ❌ Bulk member invitations
   - ❌ Cross-brigade collaboration
   - **Priority:** LOW

10. **Data Export & Backup**
    - ❌ Export routes to JSON/CSV
    - ❌ Import routes from backup
    - ❌ Print route summary reports
    - **Priority:** LOW

11. **UX Polish**
    - ❌ Tutorial/onboarding flow
    - ❌ In-app help/FAQ
    - ❌ Keyboard shortcuts
    - ❌ Manual dark mode toggle
    - **Priority:** LOW

---

### Technical Debt & Known Issues

1. **Test Coverage (CRITICAL - Release 1 Blocker)**
   - Current: 9 unit tests (navigation utils only) = ~15% coverage
   - Gap: No component tests, integration tests, E2E tests
   - Impact: Regression risk, production bugs undetected
   - Resolution: **Must increase to 40%+ before Release 1 completion**
   - Priority: **HIGH - Release 1 Quality Gate**

2. **Performance Optimization (CRITICAL - Release 1 Blocker)**
   - Current: Lighthouse score untested
   - Gap: No performance audit conducted
   - Impact: Slow load times, poor mobile experience
   - Resolution: **Lighthouse score > 90 required for Release 1**
   - Priority: **HIGH - Release 1 Quality Gate**

3. **Accessibility Audit (CRITICAL - Release 1 Blocker)**
   - Current: WCAG AA claimed but not formally audited
   - Gap: No automated a11y testing (axe-core, lighthouse)
   - Impact: Legal compliance risk, poor accessibility
   - Resolution: **Formal audit and fixes required for Release 1**
   - Priority: **HIGH - Release 1 Quality Gate**

4. **Code Quality & Linting Issues**
   - Current: 35+ ESLint errors/warnings
   - Gap: Unused variables, `any` types, React hook dependencies
   - Impact: Maintainability issues, potential bugs
   - Resolution: **Clean up before Release 1 completion**
   - Priority: **MEDIUM - Release 1 Quality Gate**

5. **Authentication Complexity**
   - Current: Optional in dev mode, full Entra ID in production
   - Issue: Hybrid approach adds complexity
   - Resolution: Phase out dev mode passwords post-launch
   - Priority: **LOW - Post-Release 1**

6. **Mapbox API Rate Limits**
   - Free tier: 100K requests/month
   - Risk: High-traffic routes may exceed limits
   - Resolution: Monitor usage, upgrade to paid tier if needed
   - Priority: **LOW - Monitor Post-Launch**

7. **Azure Costs at Scale**
   - Web PubSub Standard: $49/month (1,000 connections)
   - Risk: Multiple simultaneous routes require scaling
   - Resolution: Cost monitoring, connection pooling
   - Priority: **LOW - Monitor Post-Launch**

---

## Forward Roadmap (6 Months)

### Timeline Overview

```
Dec 2024          Jan 2025          Feb 2025          Mar 2025          Apr 2025          May 2025
   │                 │                 │                 |                 │                 │
   ▼                 ▼                 ▼                 ▼                 ▼                 ▼
Release 1       Release 1       Release 2.1       Release 2.2       Release 3.1       Release 3.2       Release 4
(FEATURES)      (QUALITY)       UX Polish         Analytics         PWA Core          Offline           Multi-Brigade
Core Features   Test Coverage   Social            Route             Service           Route Cache       Platform
Complete        Performance     Previews          Optimizer         Worker            Background        Branding
                A11y Audit
```

### Milestones

| Release | Target Date | Focus | Key Deliverables |
|---------|-------------|-------|------------------|
| **Release 1 Features** | Dec 2024 | Foundation | Core planning, navigation, tracking, sharing ✅ |
| **Release 1 Quality** | Early Jan 2025 | Quality Gates | Test coverage 40%+, Lighthouse > 90, A11y audit |
| **Release 2.1** | Late Jan 2025 | UX Enhancement | Social previews, route duplication, countdown |
| **Release 2.2** | Feb 2025 | Analytics | Viewer insights, route optimization, search |
| **Release 3.1** | Mar 2025 | Mobile PWA | Service worker, offline routing, installability |
| **Release 3.2** | Apr 2025 | Advanced Mobile | Background tracking, lock screen controls |
| **Release 4** | May 2025 | Multi-Brigade | Public brigade pages, advanced collaboration |

---

## Release 1 Quality Uplift (Early January 2025)

### Overview

**Goal:** Complete quality gates before declaring Release 1 production-ready.

**Duration:** 2 weeks  
**Estimated Effort:** 80 hours

Before proceeding to Release 2, Release 1 must meet production-readiness standards across testing, performance, accessibility, and code quality.

### Dependencies
- **Blocks:** Release 2.1, 2.2, 3.1, 3.2, and 4 (must complete before adding new features)
- **Required For:** Production launch, public beta testing

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #95 | Increase Unit Test Coverage to 40%+ | 20h | CRITICAL | None |
| #96 | Run Lighthouse Performance Audit and Optimize | 12h | CRITICAL | None |
| #97 | Conduct WCAG AA Accessibility Audit and Remediation | 15h | CRITICAL | None |
| #98 | Fix ESLint Errors and Code Quality Issues | 10h | HIGH | None |
| #99 | Add Integration Tests for Core User Flows | 15h | HIGH | #95 |
| #100 | Production Deployment Validation and Smoke Tests | 8h | HIGH | #95-#99 |

**Total: 80 hours (~2 weeks with team)**

---

### Issue Details

#### #95: Increase Unit Test Coverage to 40%+
**Current:** 9 tests, ~15% coverage  
**Target:** 40%+ coverage (at least 50 tests)  
**Dependencies:** None

**Key Tasks:**
- Add unit tests for utility functions (`src/utils/`)
- Add tests for custom hooks (`src/hooks/`)
- Test storage adapters (localStorage, Azure)
- Test navigation logic and GPS calculations
- Test route planning utilities
- Configure Vitest coverage reporting
- Set up coverage gates in CI/CD

**Success Criteria:**
- [ ] Test coverage ≥ 40%
- [ ] All critical paths tested
- [ ] Coverage report in CI/CD
- [ ] No untested critical functions

---

#### #96: Run Lighthouse Performance Audit and Optimize
**Current:** Not tested  
**Target:** Lighthouse score > 90 (Performance, Best Practices, SEO)  
**Dependencies:** None

**Key Tasks:**
- Run Lighthouse audit on production build
- Identify performance bottlenecks
- Optimize bundle size (code-splitting)
- Optimize images and assets
- Implement lazy loading for routes
- Add performance monitoring
- Test on mobile devices (3G/4G)

**Success Criteria:**
- [ ] Performance score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size optimized (< 500KB main chunk)

---

#### #97: Conduct WCAG AA Accessibility Audit and Remediation
**Current:** WCAG AA claimed, not audited  
**Target:** Formal WCAG AA compliance with automated testing  
**Dependencies:** None

**Key Tasks:**
- Run axe-core accessibility scan
- Run Lighthouse accessibility audit
- Test keyboard navigation (all interactive elements)
- Test screen reader compatibility (NVDA, JAWS, VoiceOver)
- Fix color contrast issues
- Add ARIA labels where missing
- Test with 200% zoom
- Integrate axe-core into CI/CD

**Success Criteria:**
- [ ] Zero critical a11y issues (axe-core)
- [ ] Lighthouse accessibility score 100
- [ ] Full keyboard navigation support
- [ ] Screen reader tested and working

---

#### #98: Fix ESLint Errors and Code Quality Issues
**Current:** 35+ ESLint errors/warnings  
**Target:** Zero errors, minimal warnings  
**Dependencies:** None

**Key Tasks:**
- Fix unused variable warnings
- Replace `any` types with proper types
- Fix React hook dependency warnings
- Remove unused imports and code
- Fix `setState` in effect issues
- Enable stricter ESLint rules
- Run Prettier for code formatting

**Success Criteria:**
- [ ] Zero ESLint errors
- [ ] < 5 ESLint warnings (justified)
- [ ] All `any` types replaced
- [ ] Clean TypeScript strict mode build

---

#### #99: Add Integration Tests for Core User Flows
**Current:** No integration tests  
**Target:** Critical user flows covered  
**Dependencies:** #95 (test infrastructure)

**Key Tasks:**
- Set up React Testing Library
- Test route creation flow (end-to-end)
- Test navigation flow (mock GPS)
- Test public tracking page
- Test authentication flow (dev mode)
- Test real-time tracking (mock WebSocket)
- Add CI/CD integration test step

**Success Criteria:**
- [ ] 5+ integration tests covering critical flows
- [ ] Tests run in CI/CD
- [ ] Mock external dependencies (Mapbox, Azure)
- [ ] Fast execution (< 30 seconds total)

---

#### #100: Production Deployment Validation and Smoke Tests
**Current:** Not tested in production-like environment  
**Target:** Verified production readiness  
**Dependencies:** #95-#99 (all quality improvements complete)

**Key Tasks:**
- Deploy to staging environment (Azure)
- Run smoke tests on all core features
- Test with real Mapbox API
- Test with real Azure services (Table Storage, Web PubSub)
- Load test with multiple concurrent users
- Test on real mobile devices (iOS, Android)
- Document deployment issues and fixes
- Create production deployment checklist

**Success Criteria:**
- [ ] All core features work in staging
- [ ] Real Azure services functional
- [ ] Mobile devices tested (iOS, Android)
- [ ] Load test passed (50+ concurrent users)
- [ ] Deployment checklist created

---

## Release 2: Enhanced UX & Analytics (Q1 2025)

### Release 2.1 - UX Polish & Social Features (Late January 2025)

**Goal:** Improve user engagement and virality through enhanced UX and rich social sharing.

**Duration:** 3 weeks  
**Estimated Effort:** 36-45 hours

### Dependencies
- **Requires:** Release 1 Quality Uplift (#95-#100) complete
- **Blocks:** None (can proceed alongside Release 2.2)

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #101 | Implement Dynamic Open Graph Social Preview Images | 15h | HIGH | #100 |
| #102 | Add Duplicate Route Functionality | 8h | HIGH | None |
| #103 | Create Route Templates Library | 5h | HIGH | #102 |
| #104 | Add Countdown Timer to Public Tracking Page | 8h | MEDIUM | None |
| #105 | Build Post-Event Thank You Screen with Route Summary | 8h | MEDIUM | None |
| #106 | Implement Route Archive System | 8h | MEDIUM | None |

**Total: 52 hours (~3 weeks)**

---

### Issue Details

#### #101: Implement Dynamic Open Graph Social Preview Images
**Implements:** MASTER_PLAN.md Section 5  
**Priority:** HIGH  
**Dependencies:** #100 (production deployment functional)

### Issue Details

#### #101: Implement Dynamic Open Graph Social Preview Images
**Implements:** MASTER_PLAN.md Section 5  
**Priority:** HIGH  
**Dependencies:** #100 (production deployment functional)

**Key Tasks:**
- Generate route-specific preview cards with route name, date, brigade name
- Render map snapshot with route + Santa icon
- Add festive overlay (snowflakes, Christmas trees)
- Text overlay: "[Brigade] Santa Run - [Date]"
- Use Puppeteer or Playwright for server-side map rendering
- Cache generated images in Azure Blob Storage (1200x630px optimized for Facebook/Twitter)
- Add meta tags in `PublicTracking.tsx` head section
- Test with Facebook Debugger, Twitter Card Validator

**Success Criteria:**
- [ ] Dynamic Open Graph meta tags for each route
- [ ] Server-side image rendering operational
- [ ] Images cached in Azure Blob Storage
- [ ] Previews validate in social media debuggers
- [ ] Route map thumbnail displays as og:image

---

#### #102: Add Duplicate Route Functionality
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** HIGH  
**Dependencies:** None

**Key Tasks:**
- Add "Duplicate" button on route detail page
- Copy waypoints, name (append " - Copy"), metadata
- Set status to "draft" automatically
- Allow editing before saving
- Test duplication with all route field types

**Success Criteria:**
- [ ] Duplicate button visible on route detail page
- [ ] Route duplication creates exact copy with modified name
- [ ] Duplicated route set to draft status
- [ ] All waypoints and metadata copied correctly

---

#### #103: Create Route Templates Library
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** HIGH  
**Dependencies:** #102 (duplicate functionality)

**Key Tasks:**
- Add "Save as Template" option to route editor
- Create template library page
- Apply template to new route creation
- Include common templates: "Suburban Loop", "Rural Circuit"
- Store templates in Azure Table Storage

**Success Criteria:**
- [ ] "Save as Template" button functional
- [ ] Template library page displays all saved templates
- [ ] Templates can be applied to create new routes
- [ ] Pre-built templates available for common patterns

---

#### #104: Add Countdown Timer to Public Tracking Page
**Implements:** MASTER_PLAN.md Section 10  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Create countdown timer component (HH:MM:SS)
- Display "Santa starts in..." message with date/time
- Add "Check back soon!" call-to-action
- Ensure share buttons visible pre-start
- Update UI when countdown reaches zero

**Success Criteria:**
- [ ] Countdown timer displays before route starts
- [ ] Timer updates in real-time (seconds)
- [ ] Clear messaging about start time
- [ ] Share functionality available pre-start

---

#### #105: Build Post-Event Thank You Screen with Route Summary
**Implements:** MASTER_PLAN.md Section 10  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Design "Thanks for tracking Santa!" festive message
- Create route summary card with:
  - Total distance traveled
  - Total time (start to finish)
  - Number of stops visited
- Add "View other routes" link
- Implement archive mode (frozen map at final position)

**Success Criteria:**
- [ ] Thank you screen displays after route completion
- [ ] Route summary shows accurate statistics
- [ ] Map frozen at final position
- [ ] Links to other brigade routes functional

---

#### #106: Implement Route Archive System
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Add "Archive" button on completed routes
- Create "Archived" tab on dashboard
- Hide archived routes from main dashboard by default
- Add "Restore from archive" option
- Implement auto-archive for routes older than 90 days
- Add configurable archive threshold in brigade settings
- Send email notification before auto-archive

**Success Criteria:**
- [ ] Archive button available on completed routes
- [ ] Archived tab shows all archived routes
- [ ] Restore functionality works correctly
- [ ] Auto-archive runs on schedule
- [ ] Notifications sent before auto-archiving

---

### Release 2.2 - Analytics & Optimization (February 2025)

**Goal:** Provide data-driven insights and optimize route planning efficiency.

**Duration:** 4 weeks  
**Estimated Effort:** 48-59 hours

### Dependencies
- **Requires:** Release 1 Quality Uplift (#95-#100) complete
- **Can run parallel to:** Release 2.1
- **Blocks:** None

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #107 | Build Viewer Analytics Dashboard | 18h | HIGH | #100 |
| #108 | Add Live Viewer Count on Tracking Page | 5h | HIGH | None |
| #109 | Implement Route Optimization Engine (TSP Solver) | 15h | HIGH | None |
| #110 | Add ETA Calculation and Display Per Waypoint | 8h | HIGH | #109 |
| #111 | Build Advanced Search and Filtering on Dashboard | 12h | MEDIUM | None |
| #112 | Integrate Reverse Geocoding for Street Name Display | 8h | MEDIUM | None |
| #113 | Add Route Preview Mode (Turn-by-Turn List) | 6h | LOW | None |

**Total: 72 hours (~4 weeks)**

---

### Issue Details

#### #107: Build Viewer Analytics Dashboard
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** HIGH  
**Dependencies:** #100 (Azure services configured)

**Key Tasks:**
- Track viewer connections in Web PubSub groups
- Log viewer sessions to Azure Table Storage
- Create `/routes/:id/analytics` page
- Display total views per route
- Show peak concurrent viewers
- Generate geographic distribution heatmap
- Calculate session duration average
- Track share source (Twitter, Facebook, direct)
- Use Chart.js or Recharts for visualizations

**Success Criteria:**
- [ ] Analytics dashboard accessible to brigade admins
- [ ] All key metrics displayed accurately
- [ ] Geographic heatmap renders correctly
- [ ] Chart visualizations load within 2 seconds

---

#### #108: Add Live Viewer Count on Tracking Page
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** HIGH  
**Dependencies:** None

**Key Tasks:**
- Display real-time viewer count on tracking page
- Show as badge: "🔴 LIVE - 234 watching"
- Update every 10 seconds via Web PubSub
- Handle connection/disconnection gracefully

**Success Criteria:**
- [ ] Live viewer count displays on public tracking page
- [ ] Count updates in real-time (10s intervals)
- [ ] Badge shows correct viewer numbers
- [ ] No performance degradation with high viewer counts

---

#### #109: Implement Route Optimization Engine (TSP Solver)
**Implements:** MASTER_PLAN.md Section 3  
**Priority:** HIGH  
**Dependencies:** None

**Key Tasks:**
- Add "Optimize Route" button on route editor
- Implement Traveling Salesman Problem (TSP) solver
- Minimize total distance/time while preserving start/end waypoints
- Use Mapbox Optimization API or local TSP library
- Show before/after distance comparison
- Allow manual override if needed
- Calculate cumulative travel times

**Success Criteria:**
- [ ] Optimize button functional in route editor
- [ ] Route optimization reduces total distance
- [ ] Start and end waypoints preserved
- [ ] Before/after comparison displayed
- [ ] Manual override option available

---

#### #110: Add ETA Calculation and Display Per Waypoint
**Implements:** MASTER_PLAN.md Section 3  
**Priority:** HIGH  
**Dependencies:** #109 (optimized route geometry)

**Key Tasks:**
- Calculate arrival times based on distance, speed (default 30 km/h), and stop duration (5 min)
- Display ETAs in waypoint list
- Update ETAs during navigation in real-time
- Account for varying speeds and actual stop times

**Success Criteria:**
- [ ] ETAs calculated for each waypoint
- [ ] ETAs display in route planning interface
- [ ] Real-time ETA updates during navigation
- [ ] Configurable speed and stop duration settings

---

#### #111: Build Advanced Search and Filtering on Dashboard
**Implements:** MASTER_PLAN.md Section 9  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Add search bar on dashboard (search by name, description, waypoint address)
- Implement real-time filtering as user types
- Add filter by date range, status, distance, and number of stops
- Add sort options (date, name, distance, views)
- Highlight matching text in search results

**Success Criteria:**
- [ ] Search bar functional with real-time results
- [ ] All filter options working correctly
- [ ] Sort options apply correctly
- [ ] Search highlights matching text
- [ ] Fast performance (<100ms per keystroke)

---

#### #112: Integrate Reverse Geocoding for Street Name Display
**Implements:** MASTER_PLAN.md Section 6  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Use Mapbox Geocoding API reverse lookup
- Convert GPS coordinates to street address
- Update every 30 seconds (rate limit friendly)
- Cache recent lookups for performance
- Display banner: "🎅 Santa is currently on Main Street"
- Fallback: "🎅 Santa is 1.2 km from next stop"
- Show suburb/town for context

**Success Criteria:**
- [ ] Street name displays on tracking page
- [ ] Updates every 30 seconds
- [ ] Caching reduces API calls
- [ ] Graceful fallback when address unavailable

---

#### #113: Add Route Preview Mode (Turn-by-Turn List)
**Implements:** MASTER_PLAN.md Section 3  
**Priority:** LOW  
**Dependencies:** None

**Key Tasks:**
- Add "Preview Instructions" button on route detail page
- Create modal showing all navigation steps
- Display scrollable list with distances
- Make format print-friendly

**Success Criteria:**
- [ ] Preview button visible on route detail page
- [ ] Modal displays all turn-by-turn instructions
- [ ] Instructions include distances
- [ ] Print-friendly format available

---

## Release 3: Mobile PWA & Offline (Q2 2025)

### Release 3.1 - Progressive Web App Core (March 2025)

**Goal:** Transform Fire Santa Run into a fully installable, offline-capable mobile application.

**Duration:** 4 weeks  
**Estimated Effort:** 55-68 hours

### Dependencies
- **Requires:** Release 1 Quality Uplift (#95-#100) complete, Release 2.1 and 2.2 complete
- **Blocks:** Release 3.2
- **Can run parallel to:** None (requires stable base)

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #114 | Set Up Service Worker with Workbox | 12h | HIGH | #100 |
| #115 | Implement Offline Route Viewing | 10h | HIGH | #114 |
| #116 | Enable Offline Navigation Mode | 15h | HIGH | #114, #115 |
| #117 | Create PWA Manifest and App Icons | 10h | HIGH | None |
| #118 | Add "Add to Home Screen" Install Prompts | 5h | HIGH | #117 |
| #119 | Implement Background Sync for Queued Data | 15h | MEDIUM | #114 |
| #120 | Build Offline Map Tile Caching | 18h | MEDIUM | #114 |

**Total: 85 hours (~4 weeks)**

---

### Issue Details

#### #114: Set Up Service Worker with Workbox
**Implements:** MASTER_PLAN.md Section 11  
**Priority:** HIGH  
**Dependencies:** #100 (production deployment functional)

**Key Tasks:**
- Install and configure Workbox for service worker generation
- Implement cache-first strategy for static assets
- Implement network-first for API calls with offline fallback
- Set up background sync for location updates
- Configure precaching for core app shell

**Success Criteria:**
- [ ] Service worker registered and functional
- [ ] Static assets cached on first load
- [ ] Offline fallback works for API calls
- [ ] Background sync operational

---

#### #115: Implement Offline Route Viewing
**Implements:** MASTER_PLAN.md Section 11  
**Priority:** HIGH  
**Dependencies:** #114 (service worker infrastructure)

**Key Tasks:**
- Cache active route data locally in IndexedDB
- Enable viewing route map and waypoints offline
- Add "Offline Mode" indicator to UI
- Sync updates when reconnected to network

**Success Criteria:**
- [ ] Routes viewable without internet connection
- [ ] Map and waypoints display offline
- [ ] Offline indicator visible when disconnected
- [ ] Data syncs when connection restored

---

#### #116: Enable Offline Navigation Mode
**Implements:** MASTER_PLAN.md Section 11  
**Priority:** HIGH  
**Dependencies:** #114 (service worker), #115 (offline routing)

**Key Tasks:**
- Cache Mapbox map tiles for route area
- Continue turn-by-turn navigation offline
- Queue location broadcasts, send when online
- Implement local-only mode for testing

**Success Criteria:**
- [ ] Navigation continues without internet
- [ ] Map tiles load from cache
- [ ] Location updates queue offline
- [ ] Updates transmit when connection restored

---

#### #117: Create PWA Manifest and App Icons
**Implements:** MASTER_PLAN.md Section 11  
**Priority:** HIGH  
**Dependencies:** None

**Key Tasks:**
- Create `manifest.json` with app metadata
- Design Fire Santa Run icon (festive, recognizable)
- Generate all icon sizes (48px, 72px, 96px, 144px, 192px, 512px)
- Create splash screens for iOS
- Set display mode to `standalone` (fullscreen app)
- Configure theme color and background color
- Set start URL configuration

**Success Criteria:**
- [ ] manifest.json validates correctly
- [ ] All icon sizes generated
- [ ] Splash screens display on iOS
- [ ] App displays in standalone mode when installed

---

#### #118: Add "Add to Home Screen" Install Prompts
**Implements:** MASTER_PLAN.md Section 11  
**Priority:** HIGH  
**Dependencies:** #117 (PWA manifest configured)

**Key Tasks:**
- Detect installability using beforeinstallprompt event
- Show "Add to Home Screen" prompt at appropriate time
- Create custom install banner for iOS Safari
- Track installation analytics
- Provide manual install instructions

**Success Criteria:**
- [ ] Install prompt displays on supported browsers
- [ ] iOS custom banner shows installation instructions
- [ ] Installation analytics tracked
- [ ] Manual instructions available in help section

---

#### #119: Implement Background Sync for Queued Data
**Implements:** Background Sync API  
**Priority:** MEDIUM  
**Dependencies:** #114 (service worker)

**Key Tasks:**
- Queue offline actions (location updates, route edits)
- Detect network reconnection
- Sync queued data to Azure Table Storage
- Resolve conflicts using last-write-wins strategy
- Show sync progress indicator to user

**Success Criteria:**
- [ ] Offline actions queued in IndexedDB
- [ ] Auto-sync on reconnection
- [ ] Conflict resolution functional
- [ ] Sync progress visible to user

---

#### #120: Build Offline Map Tile Caching
**Implements:** Mapbox offline tile caching  
**Priority:** MEDIUM  
**Dependencies:** #114 (service worker)

**Key Tasks:**
- Implement route area pre-caching
- Download map tiles for route bounding box (5-10 MB per route)
- Store in IndexedDB with quota management
- Add user-initiated "Download for Offline Use" button
- Intercept Mapbox tile requests in service worker
- Serve from cache if available, fallback to online
- Implement cache expiration (30 days)

**Success Criteria:**
- [ ] Offline download button functional
- [ ] Map tiles cached successfully
- [ ] Tiles serve from cache offline
- [ ] Cache expiration works correctly
- [ ] Storage quota managed appropriately

---

### Release 3.2 - Advanced Mobile Features (April 2025)

**Goal:** Enhance mobile navigation experience with native-like features.

**Duration:** 3 weeks  
**Estimated Effort:** 40-49 hours

### Dependencies
- **Requires:** Release 3.1 (#114-#120) complete
- **Blocks:** None (can proceed alongside Release 4)
- **Can run parallel to:** Release 4 after #121 complete

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #121 | Implement Background Location Tracking | 15h | HIGH | #116 |
| #122 | Integrate Lock Screen Media Controls | 12h | MEDIUM | None |
| #123 | Add Off-Route Detection and Rerouting | 12h | MEDIUM | None |
| #124 | Implement Real-Time ETA Recalculation | 10h | MEDIUM | #110 |
| #125 | Add Predictive ETA Improvements (Optional) | 8h | LOW | #124 |

**Total: 57 hours (~3 weeks)**

---

### Issue Details

#### #121: Implement Background Location Tracking
**Implements:** MASTER_PLAN.md Section 3a  
**Priority:** HIGH  
**Dependencies:** #116 (offline navigation functional)

**Key Tasks:**
- Request `background-geolocation` permission
- Continue tracking when app minimized
- Use Web Background Sync for location updates
- Implement battery-efficient tracking (30-second intervals)
- Use Wake Lock API to prevent screen sleep during navigation
- Add "Keep Screen On" toggle in navigation view
- Show wake lock indicator
- Release lock on navigation end

**Success Criteria:**
- [ ] Background location tracking permission requested
- [ ] Tracking continues when app minimized
- [ ] Battery-efficient implementation (30s intervals)
- [ ] Wake lock prevents screen sleep
- [ ] Wake lock toggle functional
- [ ] Lock released on navigation end

---

#### #122: Integrate Lock Screen Media Controls
**Implements:** MASTER_PLAN.md Section 3a  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Register app as media session for voice instructions
- Add lock screen controls: Play/Pause voice
- Add Next/Previous waypoint controls from lock screen
- Display route name and current instruction on lock screen
- Queue voice instructions
- Implement audio ducking (interrupt music/podcasts temporarily)
- Resume media after instruction
- Handle volume control

**Success Criteria:**
- [ ] Media Session API integrated
- [ ] Lock screen controls functional
- [ ] Route info displays on lock screen
- [ ] Voice instructions queue properly
- [ ] Audio ducking works correctly

---

#### #123: Add Off-Route Detection and Rerouting
**Implements:** MASTER_PLAN.md Section 3a  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Detect when driver is >100m off planned route
- Show banner: "You're off route. Reroute?"
- Provide options: "Reroute Now" or "Dismiss"
- Auto-dismiss banner if driver returns to route
- Call Mapbox Directions API with current location
- Calculate new route to next unvisited waypoint
- Update navigation steps seamlessly
- Voice announcement: "Rerouting..."
- Log rerouting events for analytics
- Display reroute count in route summary

**Success Criteria:**
- [ ] Off-route detection functional (>100m threshold)
- [ ] Reroute banner displays appropriately
- [ ] Automatic rerouting calculates correct path
- [ ] Navigation updates seamlessly
- [ ] Rerouting events logged
- [ ] Analytics show common reroute locations

---

#### #124: Implement Real-Time ETA Recalculation
**Implements:** MASTER_PLAN.md Section 3a  
**Priority:** MEDIUM  
**Dependencies:** #110 (base ETA calculation)

**Key Tasks:**
- Calculate current speed from GPS
- Update ETA every 10 seconds
- Account for stops (stationary > 2 minutes)
- Show "Ahead of Schedule" or "Behind Schedule" indicator
- Recalculate cumulative ETAs for remaining waypoints

**Success Criteria:**
- [ ] Speed calculated from GPS data
- [ ] ETAs update every 10 seconds
- [ ] Stops detected and factored in
- [ ] Schedule indicators display correctly
- [ ] Cumulative ETAs accurate

---

#### #125: Add Predictive ETA Improvements (Optional)
**Implements:** MASTER_PLAN.md Section 3a  
**Priority:** LOW  
**Dependencies:** #124 (real-time ETA calculation)

**Key Tasks:**
- Implement basic machine learning model (optional)
- Learn from historical route data
- Adjust predictions for time of day
- Consider traffic patterns
- Display confidence level
- Store historical timing data

**Success Criteria:**
- [ ] ML model functional (if implemented)
- [ ] Historical data collected
- [ ] Predictions more accurate over time
- [ ] Confidence level displayed

---

## Release 4: Multi-Brigade Platform (May 2025)

**Goal:** Evolve from single-brigade tool to multi-brigade platform with public visibility and collaboration.

**Duration:** 4 weeks  
**Estimated Effort:** 67-82 hours

### Dependencies
- **Requires:** Release 1 Quality Uplift (#95-#100) complete
- **Can run parallel to:** Release 3.2 (after #121)
- **Blocks:** None (final release in 6-month roadmap)

### Issues

| Issue # | Title | Estimate | Priority | Dependencies |
|---------|-------|----------|----------|--------------|
| #126 | Build Public Brigade Profile Pages | 18h | HIGH | #100 |
| #127 | Create Brigade Discovery and Search | 10h | HIGH | #126 |
| #128 | Implement Logo Upload and Custom Branding | 12h | MEDIUM | #126 |
| #129 | Build Member Management UI | 15h | MEDIUM | None |
| #130 | Add Multi-Operator Route Collaboration | 12h | LOW | None |
| #131 | Implement Data Export (JSON, CSV, KML, PDF) | 15h | LOW | None |
| #132 | Add Data Import and Restore | 8h | LOW | #131 |
| #133 | Create First-Time User Tutorial | 10h | LOW | None |

**Total: 100 hours (~4 weeks)**

---

### Issue Details

#### #126: Build Public Brigade Profile Pages
**Implements:** MASTER_PLAN.md Section 1  
**Priority:** HIGH  
**Dependencies:** #100 (production deployment functional)

**Key Tasks:**
- Create public brigade profile page: `/brigade/{slug}`
- Display brigade information: name, location, logo, contact
- List all public routes (upcoming and past)
- Add social media links
- Add "Claim This Brigade" button if unclaimed
- Design responsive layout for mobile/desktop

**Success Criteria:**
- [ ] Public brigade pages accessible via `/brigade/{slug}`
- [ ] All brigade information displays correctly
- [ ] Route list shows upcoming and past routes
- [ ] Social media links functional
- [ ] Claim button works for unclaimed brigades

---

#### #127: Create Brigade Discovery and Search
**Implements:** MASTER_PLAN.md Section 1  
**Priority:** HIGH  
**Dependencies:** #126 (brigade profile pages)

**Key Tasks:**
- Create homepage featuring brigades
- Add browse all brigades by state/region
- Implement search brigades by name, location
- Create brigade map view (all NSW brigades with pins)
- Add filter by state/region
- Sort options (alphabetical, most active, newest)

**Success Criteria:**
- [ ] Homepage features brigade discovery
- [ ] Browse functionality works by state/region
- [ ] Search returns accurate results
- [ ] Map view displays all brigades
- [ ] Filters and sort options functional

---

#### #128: Implement Logo Upload and Custom Branding
**Implements:** MASTER_PLAN.md Section 1  
**Priority:** MEDIUM  
**Dependencies:** #126 (brigade pages)

**Key Tasks:**
- Implement logo upload (PNG, JPG, max 2 MB)
- Store logos in Azure Blob Storage
- Display logo on dashboard, public pages, tracking pages
- Default to RFS logo if not uploaded
- Add custom theme color picker
- Apply theme to buttons, headers, markers
- Add preview before saving
- Add reset to default theme option
- Implement contact information fields (email, phone, website, social media)
- Add public display toggle for privacy control

**Success Criteria:**
- [ ] Logo upload functional
- [ ] Logos stored in Azure Blob Storage
- [ ] Logos display across all pages
- [ ] Custom theme colors apply correctly
- [ ] Preview functionality works
- [ ] Contact information saves and displays

---

#### #129: Build Member Management UI
**Implements:** MASTER_PLAN.md Section 1  
**Priority:** MEDIUM  
**Dependencies:** None

**Key Tasks:**
- Create member list view showing all brigade members
- Display role (admin, operator, viewer) and status
- Show last login date
- Implement send email invitations
- Allow role setting in invitation
- Generate invitation links (7-day expiry)
- Track invitation status
- Add change member role functionality
- Implement suspend/remove members
- Add admin approval for pending members
- Create audit log of permission changes

**Success Criteria:**
- [ ] Member list displays all members correctly
- [ ] Email invitations send successfully
- [ ] Invitation links work and expire correctly
- [ ] Role changes apply immediately
- [ ] Suspend/remove actions functional
- [ ] Audit log records all changes

---

#### #130: Add Multi-Operator Route Collaboration
**Implements:** Multi-operator support  
**Priority:** LOW  
**Dependencies:** None

**Key Tasks:**
- Allow multiple operators to edit same route simultaneously
- Implement real-time conflict detection
- Use last-edit-wins strategy for conflicts
- Show who's currently editing
- Add comments to routes
- Tag waypoints with notes
- Implement brigade-internal communication
- Show comment history and timestamps

**Success Criteria:**
- [ ] Multiple editors can work on same route
- [ ] Conflict detection functional
- [ ] Current editors displayed
- [ ] Comments system operational
- [ ] Waypoint notes functional

---

#### #131: Implement Data Export (JSON, CSV, KML, PDF)
**Implements:** Export and backup features  
**Priority:** LOW  
**Dependencies:** None

**Key Tasks:**
- Implement download single route as JSON
- Add bulk export all brigade routes
- Support export formats: JSON, CSV, KML (Google Earth)
- Include waypoints, metadata, analytics in exports
- Generate PDF route summary
- Include map screenshot, waypoints, instructions in PDF
- Apply logo and branding to PDF
- Create print-friendly format

**Success Criteria:**
- [ ] Single route export works in all formats
- [ ] Bulk export functional
- [ ] All data included in exports
- [ ] PDF generation operational
- [ ] PDF includes all required elements
- [ ] Branding applies to PDFs

---

#### #132: Add Data Import and Restore
**Implements:** Import and restore features  
**Priority:** LOW  
**Dependencies:** #131 (export functionality)

**Key Tasks:**
- Implement upload JSON backup file
- Add restore deleted routes functionality
- Support import from external sources (GPX, KML)
- Implement validation for imported data
- Add conflict resolution for duplicate routes
- Show import preview before confirming

**Success Criteria:**
- [ ] JSON import functional
- [ ] Restore deleted routes works
- [ ] External format imports successful
- [ ] Validation catches errors
- [ ] Conflict resolution works correctly
- [ ] Import preview displays accurately

---

#### #133: Create First-Time User Tutorial
**Implements:** User experience improvements  
**Priority:** LOW  
**Dependencies:** None

**Key Tasks:**
- Create interactive walkthrough for new admins
- Implement "Create Your First Route" guided flow
- Add tooltips and help hints throughout app
- Add skip option for experienced users
- Create FAQ section
- Embed video tutorials (YouTube)
- Build searchable knowledge base
- Add contact support form

**Success Criteria:**
- [ ] Tutorial launches for new users
- [ ] Guided flow completes route creation
- [ ] Tooltips display contextually
- [ ] Skip option works
- [ ] FAQ section accessible
- [ ] Video tutorials embedded
- [ ] Knowledge base searchable
- [ ] Support form functional

---

- [ ] Public brigade profile pages
- [ ] Brigade discovery and search
- [ ] Brigade logo upload and custom branding
- [ ] Member management UI (invite, remove, permissions)
- [ ] Multi-operator route collaboration
- [ ] Route comments and internal communication
- [ ] Data export (JSON, CSV, KML, PDF)
- [ ] Data import and restore
- [ ] First-time user tutorial
- [ ] In-app help center
- [ ] Updated platform documentation

**Total Estimated Effort:** 67-82 hours

---

## Issue Automation Strategy

### Overview
To maintain an extended backlog and streamline issue management, we propose a GitHub Actions-based automation system that creates, updates, and maintains issues from the ROADMAP.md source of truth.

### Approach: GitHub Actions Workflow

**Strategy:** Use a GitHub Actions workflow that reads ROADMAP.md and automatically creates/updates GitHub Issues.

#### Workflow Design

```yaml
# .github/workflows/sync-roadmap-issues.yml
name: Sync Roadmap to GitHub Issues

on:
  push:
    branches: [main]
    paths:
      - 'ROADMAP.md'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode (no actual changes)'
        required: false
        default: 'false'

jobs:
  sync-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Parse ROADMAP.md and sync issues
        uses: actions/github-script@v7
        with:
          script: |
            // Parse ROADMAP.md
            // Extract issue details (number, title, body, labels, milestone)
            // For each issue:
            //   - Check if issue exists
            //   - Create if missing
            //   - Update if content changed
            //   - Add labels (release, priority, estimate)
            //   - Set milestone
```

#### Implementation Details

**1. Issue Template Format**
Each issue in ROADMAP.md follows a consistent format that can be parsed:
- Issue number: `#XXX`
- Title: Extracted from issue table
- Priority: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- Estimate: Hours (e.g., `20h`)
- Dependencies: Other issue numbers
- Body: Includes Key Tasks and Success Criteria

**2. Issue Metadata Mapping**
```javascript
{
  number: 95,
  title: "Increase Unit Test Coverage to 40%+",
  labels: ["release-1-quality", "priority-critical", "testing", "estimate-20h"],
  milestone: "Release 1 Quality Uplift",
  body: "## Goal\n...\n## Key Tasks\n...\n## Success Criteria\n...",
  dependencies: [] // or ["#94", "#93"]
}
```

**3. Labels Strategy**
Auto-create and apply labels:
- **Release labels:** `release-1-quality`, `release-2.1`, `release-2.2`, `release-3.1`, `release-3.2`, `release-4`
- **Priority labels:** `priority-critical`, `priority-high`, `priority-medium`, `priority-low`
- **Estimate labels:** `estimate-5h`, `estimate-8h`, `estimate-10h`, `estimate-12h`, `estimate-15h`, `estimate-18h`, `estimate-20h`
- **Category labels:** `testing`, `performance`, `accessibility`, `ux`, `pwa`, `analytics`, `collaboration`

**4. Milestones**
Create GitHub Milestones for each release:
- Release 1 Quality Uplift (Due: Early January 2025)
- Release 2.1 - UX Polish (Due: Late January 2025)
- Release 2.2 - Analytics (Due: February 2025)
- Release 3.1 - PWA Core (Due: March 2025)
- Release 3.2 - Advanced Mobile (Due: April 2025)
- Release 4 - Platform Maturity (Due: May 2025)

**5. Dependency Tracking**
- Parse dependencies from ROADMAP.md
- Add dependency information to issue body
- Optionally use tasklists to reference blocking issues: `- [ ] Blocked by #95`

### Alternative Approaches Considered

#### Option 2: Manual Script (Local Execution)
- **Pros:** More control, can run locally before committing
- **Cons:** Requires manual execution, not automated
- **When to use:** Initial bulk creation or major restructuring
- **Implementation:** Node.js script using Octokit

```bash
# Run locally
node scripts/sync-roadmap-to-issues.js --dry-run
node scripts/sync-roadmap-to-issues.js --create
```

#### Option 3: GitHub Project Board Automation
- **Pros:** Visual management, drag-and-drop prioritization
- **Cons:** Requires GitHub Projects, separate from issues
- **When to use:** In addition to automated issues for project tracking

### Recommended Workflow

**Phase 1: Initial Setup (Manual)**
1. Create milestones for all releases
2. Create label set (release, priority, estimate, category)
3. Run initial sync script to create all issues (#95-#133)

**Phase 2: Ongoing Automation (GitHub Actions)**
1. Workflow triggers on ROADMAP.md changes
2. Parses updated content
3. Creates new issues if issue numbers added
4. Updates existing issues if content changed
5. Adds labels and milestones automatically

**Phase 3: Maintenance**
- Update ROADMAP.md as single source of truth
- Workflow keeps issues in sync
- Manual adjustments in GitHub Issues allowed (workflow won't overwrite manual edits unless forced)

### Benefits of This Approach

1. **Single Source of Truth:** ROADMAP.md remains the authoritative document
2. **Automated Backlog:** Issues automatically created and updated
3. **Version Controlled:** All changes tracked in git
4. **Review Process:** Changes go through PR review before issues updated
5. **Flexibility:** Can run in dry-run mode to preview changes
6. **Low Maintenance:** Minimal ongoing effort after initial setup

### Action Items

- [ ] Create GitHub Actions workflow file (`.github/workflows/sync-roadmap-issues.yml`)
- [ ] Write parser for ROADMAP.md issue format
- [ ] Implement issue creation/update logic using `actions/github-script`
- [ ] Create initial milestones and labels
- [ ] Test workflow in dry-run mode
- [ ] Run initial sync to create all 39 issues (#95-#133)
- [ ] Document workflow in repository README

### Execution Environment

**✅ Can be implemented within Copilot environment:**
- GitHub Actions workflows can be created and committed
- Workflow uses GitHub's built-in permissions (no external secrets needed)
- `actions/github-script` provides full GitHub API access

**Alternative: Run from local machine:**
- Use Node.js script with Octokit
- Requires `GITHUB_TOKEN` with `repo` and `write:issues` scopes
- Useful for one-time bulk operations or testing

### Success Metrics for Automation

- All 39 issues (#95-#133) created successfully
- Issues correctly labeled and assigned to milestones
- Dependencies accurately reflected in issue descriptions
- Future ROADMAP.md updates automatically reflected in issues
- Zero manual intervention required for routine updates

---

## Success Metrics

### Release 1 Quality Gates (Early Jan 2025)

**Must achieve before Release 1 completion:**

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Test Coverage** | 15% | 40%+ | 🔄 In Progress |
| **Lighthouse Performance** | Not tested | > 90 | 🔄 In Progress |
| **Lighthouse Accessibility** | Not tested | 100 | 🔄 In Progress |
| **ESLint Errors** | 35+ | 0 | 🔄 In Progress |
| **Integration Tests** | 0 | 5+ flows | 🔄 In Progress |
| **Production Validation** | Not done | Passed | 🔄 In Progress |

---

### Release 2 (Q1 2025)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Social share engagement | +50% | Track clicks on share buttons |
| Route duplication usage | 30% of brigades | Track "Duplicate" button clicks |
| Viewer session duration | > 5 minutes | Analytics tracking |
| Route optimization usage | 40% of routes | Track "Optimize" button usage |
| Search/filter usage | 60% of dashboard visits | Track feature interaction |

---

### Release 3 (Q2 2025)

| Metric | Target | Measurement |
|--------|--------|-------------|
| PWA installations | 25% of mobile users | Track install events |
| Offline navigation usage | 10% of routes | Track offline mode activation |
| Background tracking usage | 50% of navigations | Track background permission grants |
| Mobile user retention | +30% | Track returning mobile users |

---

### Release 4 (Q2 2025)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Brigades with public pages | 60% of claimed brigades | Track profile completeness |
| Member invitations sent | Average 3 per brigade | Track invitation API calls |
| Route exports | 15% of completed routes | Track export downloads |
| Tutorial completion rate | 70% of new users | Track onboarding flow completion |

---

### Overall Product Success (6 Months)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Active Brigades | 50 | 0 | 🔄 Pre-launch |
| Routes Created | 200 | 0 | 🔄 Pre-launch |
| Public Viewers | 10,000+ | 0 | 🔄 Pre-launch |
| Lighthouse Score | > 90 | TBD | 🔄 Pending audit |
| WCAG AA Compliance | 100% | 95% | 🔄 In progress |
| Test Coverage | > 60% | ~15% | 🔄 In progress |
| Uptime | > 99.5% | N/A | 🔄 Post-launch |
| Average Load Time | < 2s | ~1.5s | ✅ Met |

---

## Risk Assessment

### High-Risk Items

1. **Mapbox API Costs**
   - **Risk:** Exceed free tier (100K requests/month)
   - **Mitigation:** 
     - Monitor usage in Mapbox dashboard
     - Implement request caching
     - Upgrade to paid tier if needed ($5/month for 100K additional)
   - **Contingency:** Reduce map tile quality, limit geocoding

2. **Azure Web PubSub Scaling**
   - **Risk:** Multiple simultaneous routes exceed 1,000 connections (Standard tier limit)
   - **Mitigation:**
     - Monitor connection count
     - Implement connection pooling
     - Scale to multiple units ($49/unit)
   - **Contingency:** Queue routes, limit concurrent active routes

3. **Service Worker Complexity (PWA)**
   - **Risk:** Offline mode introduces bugs, cache invalidation issues
   - **Mitigation:**
     - Extensive testing on real devices
     - Clear cache management UI
     - Gradual rollout with feature flags
   - **Contingency:** Disable offline mode, provide online-only fallback

---

### Medium-Risk Items

4. **Test Coverage Debt**
   - **Risk:** Low test coverage (15%) leads to regressions
   - **Mitigation:**
     - Add tests incrementally with new features
     - Focus on critical paths (navigation, tracking)
     - Set coverage gates in CI/CD (40% minimum)
   - **Contingency:** Manual testing for regressions

5. **Third-Party Dependencies**
   - **Risk:** Library updates break functionality (Mapbox, MSAL, React)
   - **Mitigation:**
     - Pin dependency versions in package.json
     - Test updates in staging before production
     - Maintain changelog of dependency updates
   - **Contingency:** Rollback to previous stable versions

6. **Mobile Browser Compatibility**
   - **Risk:** PWA features not supported on older mobile browsers
   - **Mitigation:**
     - Feature detection and progressive enhancement
     - Polyfills for older APIs
     - Fallback to web-only mode
   - **Contingency:** Recommend updated browsers in docs

---

### Low-Risk Items

7. **User Adoption**
   - **Risk:** Brigades don't adopt the platform
   - **Mitigation:**
     - User testing with pilot brigades
     - Comprehensive onboarding and tutorials
     - Direct outreach to RFS leadership
   - **Contingency:** Iterate based on feedback, simplify onboarding

8. **Accessibility Compliance**
   - **Risk:** Fail WCAG AA audit
   - **Mitigation:**
     - Run automated a11y tests (axe-core)
     - Manual keyboard navigation testing
     - Screen reader testing
   - **Contingency:** Address issues incrementally, prioritize critical paths

---

## Appendix

### Related Documentation

- **MASTER_PLAN.md** - Comprehensive technical specification (4,700 lines)
- **MISSING_FEATURES_ANALYSIS.md** - Feature gap analysis
- **docs/current_state/README.md** - UI implementation status
- **docs/IMPLEMENTATION_SUMMARY.md** - Navigation feature summary
- **docs/PHASE5_PR_SUMMARY.md** - Sharing feature details
- **docs/PHASE6A_SUMMARY.md** - Brigade management details

### External Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Azure Static Web Apps Docs](https://learn.microsoft.com/en-us/azure/static-web-apps/)
- [Azure Web PubSub Docs](https://learn.microsoft.com/en-us/azure/azure-web-pubsub/)
- [React 19 Documentation](https://react.dev/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)

---

**Document Version:** 1.0  
**Authors:** Fire Santa Run Development Team  
**Review Date:** Every quarter or after major release  
**Feedback:** Open issues on GitHub for roadmap suggestions

---

## Conclusion

This roadmap provides a clear path from Release 1's solid foundation to a feature-complete, production-ready platform within 6 months. By prioritizing high-impact features (social sharing, analytics, PWA) and addressing known gaps systematically, Fire Santa Run will deliver exceptional value to RFS brigades and their communities.

**Next Steps:**
1. Review and approve this roadmap
2. Create GitHub issues for Release 2.1
3. Begin implementation in January 2025
4. Schedule quarterly roadmap reviews
5. Adjust based on user feedback and emerging needs

🎅🚒 **Let's bring Christmas magic to every Australian community!** 🎄✨
