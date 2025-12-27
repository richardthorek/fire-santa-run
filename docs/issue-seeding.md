# GitHub Issue Seeding (from ROADMAP.md)

This file stages all issue content for creation in GitHub. Release 1 items are individual issues. Releases 2–4 have a parent issue plus child issues with full details.

For each issue:
- **Title**: use as-is
- **Labels**: suggested set
- **Body**: copy verbatim when creating

---
## Release 1 (Quality Uplift) — Individual Issues

### Issue: Increase Unit Test Coverage to 40%+
**Labels:** enhancement
**Body:**
```
Goal
Raise test coverage to ≥40% (~50 tests) across utils, hooks, storage, navigation, route planning.

Key Tasks
- Add unit tests for utility functions (src/utils/)
- Add tests for custom hooks (src/hooks/)
- Test storage adapters (localStorage, Azure)
- Test navigation logic and GPS calculations
- Test route planning utilities
- Configure Vitest coverage reporting + CI gate
- Set up coverage gates in CI/CD

Success Criteria
- [ ] Test coverage ≥ 40%
- [ ] All critical paths tested
- [ ] Coverage report in CI/CD
- [ ] No untested critical functions

Refs
- ROADMAP Release 1 issue #95
- MASTER_PLAN Section 26 (testing)
```

### Issue: Run Lighthouse Performance Audit and Optimize
**Labels:** enhancement
**Body:**
```
Goal
Achieve Lighthouse > 90 (Performance/Best Practices/SEO) on production build.

Key Tasks
- Run Lighthouse audit on production build
- Identify performance bottlenecks
- Optimize bundle size (code-splitting/manualChunks)
- Optimize images and assets; lazy-load routes
- Add performance monitoring; test on mobile (3G/4G)

Success Criteria
- [ ] Performance score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size optimized (< 500KB main chunk) or documented exception

Refs
- ROADMAP #96
- MASTER_PLAN Section 16 (quality gates)
```

### Issue: Conduct WCAG AA Accessibility Audit and Remediation
**Labels:** enhancement
**Body:**
```
Goal
Formal WCAG AA compliance with automated + manual testing.

Key Tasks
- Run axe-core accessibility scan
- Run Lighthouse accessibility audit
- Test keyboard navigation (all interactive elements)
- Test screen reader compatibility (NVDA, JAWS, VoiceOver)
- Fix color contrast issues; add ARIA where missing
- Test with 200% zoom
- Integrate axe-core into CI/CD

Success Criteria
- [ ] Zero critical axe issues
- [ ] Lighthouse accessibility score 100
- [ ] Full keyboard navigation support
- [ ] Screen reader validation complete

Refs
- ROADMAP #97
- MASTER_PLAN Section 2 (Accessibility)
```

### Issue: Fix ESLint Errors and Code Quality Issues
**Labels:** bug
**Body:**
```
Goal
Zero ESLint errors; minimal justified warnings.

Key Tasks
- Fix unused variable warnings; remove unused imports/code
- Replace `any` types with proper types
- Fix React hook dependency warnings
- Fix setState-in-effect issues
- Enable/keep stricter ESLint rules
- Run Prettier for formatting

Success Criteria
- [ ] Zero ESLint errors
- [ ] < 5 ESLint warnings (justified)
- [ ] All `any` types replaced
- [ ] Clean TypeScript strict mode build

Refs
- ROADMAP #98
- MASTER_PLAN Section 26
```

### Issue: Add Integration Tests for Core User Flows
**Labels:** enhancement
**Body:**
```
Goal
Integration coverage for critical flows.

Key Tasks
- Set up React Testing Library
- Test route creation flow (end-to-end)
- Test navigation flow (mock GPS)
- Test public tracking page
- Test authentication flow (dev mode)
- Test real-time tracking (mock WebSocket)
- Add CI/CD integration test step

Success Criteria
- [ ] 5+ integration tests covering critical flows
- [ ] Tests run in CI/CD
- [ ] External dependencies mocked (Mapbox, Azure)
- [ ] Fast execution (< 30 seconds total)

Refs
- ROADMAP #99
```

### Issue: Production Deployment Validation and Smoke Tests
**Labels:** enhancement
**Body:**
```
Goal
Verify production readiness in staging/prod-like environment.

Key Tasks
- Deploy to staging environment (Azure)
- Run smoke tests on all core features
- Test with real Mapbox API
- Test with real Azure services (Table Storage, Web PubSub)
- Load test with multiple concurrent users
- Test on real mobile devices (iOS, Android)
- Document deployment issues and fixes
- Create production deployment checklist

Success Criteria
- [ ] All core features work in staging
- [ ] Real Azure services functional
- [ ] Mobile devices tested (iOS, Android)
- [ ] Load test passed (50+ concurrent users)
- [ ] Deployment checklist created

Refs
- ROADMAP #100
```

---
## Release 2.1 - UX Polish & Social (Parent + Sub-Issues)

### Parent Issue: Release 2.1 - UX Polish & Social Features (Q1 2025)
**Labels:** enhancement
**Body:**
```
Goal
Improve user engagement and virality via UX polish and social sharing.

Sub-Issues
- [ ] #101 Implement Dynamic Open Graph Social Preview Images (15h, HIGH, dep #100)
- [ ] #102 Add Duplicate Route Functionality (8h, HIGH)
- [ ] #103 Create Route Templates Library (5h, HIGH, dep #102)
- [ ] #104 Add Countdown Timer to Public Tracking Page (8h, MEDIUM)
- [ ] #105 Build Post-Event Thank You Screen with Route Summary (8h, MEDIUM)
- [ ] #106 Implement Route Archive System (8h, MEDIUM)

Refs
- ROADMAP Release 2.1; MASTER_PLAN Sections 3, 5, 9, 10
```

#### Issue #101: Implement Dynamic Open Graph Social Preview Images
**Labels:** enhancement
**Body:**
```
Goal
Dynamic OG images per route with festive branding.

Key Tasks
- Generate route-specific preview cards with route name, date, brigade name
- Render map snapshot with route + Santa icon
- Add festive overlay (snowflakes, trees)
- Text overlay: "[Brigade] Santa Run - [Date]"
- Use Puppeteer/Playwright for server-side map rendering
- Cache generated images in Azure Blob Storage (1200x630)
- Add meta tags in PublicTracking head
- Test with Facebook Debugger & Twitter Card Validator

Success Criteria
- [ ] Dynamic OG meta tags per route
- [ ] Server-side image rendering operational
- [ ] Images cached in Azure Blob Storage
- [ ] Previews validate in social debuggers
- [ ] Route map thumbnail displays as og:image

Deps
- #100 (production deployment functional)

Refs
- ROADMAP #101; MASTER_PLAN Section 5
```

#### Issue #102: Add Duplicate Route Functionality
**Labels:** enhancement
**Body:**
```
Goal
Allow one-click duplication of routes for reuse.

Key Tasks
- Add "Duplicate" button on route detail page
- Copy waypoints, name (append " - Copy"), metadata
- Set status to draft automatically
- Allow editing before saving
- Test duplication with all route field types

Success Criteria
- [ ] Duplicate button visible on route detail page
- [ ] Route duplication creates exact copy with modified name
- [ ] Duplicated route set to draft
- [ ] All waypoints and metadata copied correctly

Refs
- ROADMAP #102; MASTER_PLAN Section 9
```

#### Issue #103: Create Route Templates Library
**Labels:** enhancement
**Body:**
```
Goal
Enable reusable route templates.

Key Tasks
- Add "Save as Template" option to route editor
- Create template library page
- Apply template to new route creation
- Include common templates: "Suburban Loop", "Rural Circuit"
- Store templates in Azure Table Storage

Success Criteria
- [ ] "Save as Template" button functional
- [ ] Template library page displays all saved templates
- [ ] Templates can be applied to create new routes
- [ ] Pre-built templates available for common patterns

Deps
- #102

Refs
- ROADMAP #103; MASTER_PLAN Section 9
```

#### Issue #104: Add Countdown Timer to Public Tracking Page
**Labels:** enhancement
**Body:**
```
Goal
Show pre-start countdown on public tracking page.

Key Tasks
- Create countdown timer component (HH:MM:SS)
- Display "Santa starts in..." message with date/time
- Add "Check back soon!" CTA
- Ensure share buttons visible pre-start
- Update UI when countdown reaches zero

Success Criteria
- [ ] Countdown timer displays before route starts
- [ ] Timer updates in real-time (seconds)
- [ ] Clear messaging about start time
- [ ] Share functionality available pre-start

Refs
- ROADMAP #104; MASTER_PLAN Section 10
```

#### Issue #105: Build Post-Event Thank You Screen with Route Summary
**Labels:** enhancement
**Body:**
```
Goal
Provide post-event summary and thank-you experience.

Key Tasks
- Design "Thanks for tracking Santa!" festive message
- Create route summary card (distance, time, stops)
- Add "View other routes" link
- Implement archive mode (map frozen at final position)

Success Criteria
- [ ] Thank you screen displays after route completion
- [ ] Route summary shows accurate statistics
- [ ] Map frozen at final position
- [ ] Links to other brigade routes functional

Refs
- ROADMAP #105; MASTER_PLAN Section 10
```

#### Issue #106: Implement Route Archive System
**Labels:** enhancement
**Body:**
```
Goal
Archive completed routes with restore and auto-archive.

Key Tasks
- Add "Archive" button on completed routes
- Create "Archived" tab on dashboard
- Hide archived routes from main dashboard by default
- Add "Restore from archive" option
- Implement auto-archive for routes older than 90 days
- Add configurable archive threshold in brigade settings
- Send email notification before auto-archive

Success Criteria
- [ ] Archive button available on completed routes
- [ ] Archived tab shows all archived routes
- [ ] Restore functionality works correctly
- [ ] Auto-archive runs on schedule
- [ ] Notifications sent before auto-archiving

Refs
- ROADMAP #106; MASTER_PLAN Section 9
```

---
## Release 2.2 - Analytics & Optimization (Parent + Sub-Issues)

### Parent Issue: Release 2.2 - Analytics & Optimization (Q1 2025)
**Labels:** enhancement
**Body:**
```
Goal
Deliver viewer analytics and route optimization features.

Sub-Issues
- [ ] #107 Build Viewer Analytics Dashboard (18h, HIGH, dep #100)
- [ ] #108 Add Live Viewer Count on Tracking Page (5h, HIGH)
- [ ] #109 Implement Route Optimization Engine (TSP Solver) (15h, HIGH)
- [ ] #110 Add ETA Calculation and Display Per Waypoint (8h, HIGH, dep #109)
- [ ] #111 Build Advanced Search and Filtering on Dashboard (12h, MEDIUM)
- [ ] #112 Integrate Reverse Geocoding for Street Name Display (8h, MEDIUM)
- [ ] #113 Add Route Preview Mode (Turn-by-Turn List) (6h, LOW)

Refs
- ROADMAP Release 2.2; MASTER_PLAN Sections 3, 6, 9
```

#### Issue #107: Build Viewer Analytics Dashboard
**Labels:** enhancement
**Body:**
```
Goal
Provide admins with viewer analytics per route.

Key Tasks
- Track viewer connections in Web PubSub groups
- Log viewer sessions to Azure Table Storage
- Create `/routes/:id/analytics` page
- Display total views per route; peak concurrent viewers
- Generate geographic distribution heatmap
- Calculate session duration average; track share source
- Use Chart.js or Recharts for visualizations

Success Criteria
- [ ] Analytics dashboard accessible to brigade admins
- [ ] All key metrics displayed accurately
- [ ] Geographic heatmap renders correctly
- [ ] Chart visualizations load within 2 seconds

Deps
- #100 (Azure services configured)

Refs
- ROADMAP #107; MASTER_PLAN Section 9
```

#### Issue #108: Add Live Viewer Count on Tracking Page
**Labels:** enhancement
**Body:**
```
Goal
Show real-time viewer count on tracking page.

Key Tasks
- Display real-time viewer count badge: "🔴 LIVE - N watching"
- Update every 10 seconds via Web PubSub
- Handle connection/disconnection gracefully

Success Criteria
- [ ] Live viewer count displays on public tracking page
- [ ] Count updates in real-time (10s intervals)
- [ ] Badge shows correct viewer numbers
- [ ] No performance degradation with high viewer counts

Refs
- ROADMAP #108; MASTER_PLAN Section 9
```

#### Issue #109: Implement Route Optimization Engine (TSP Solver)
**Labels:** enhancement
**Body:**
```
Goal
Optimize route order to minimize distance/time.

Key Tasks
- Add "Optimize Route" button on route editor
- Implement TSP solver (Mapbox Optimization API or local library)
- Preserve start/end waypoints
- Show before/after distance comparison
- Allow manual override; calculate cumulative travel times

Success Criteria
- [ ] Optimize button functional in route editor
- [ ] Route optimization reduces total distance
- [ ] Start and end waypoints preserved
- [ ] Before/after comparison displayed
- [ ] Manual override option available

Refs
- ROADMAP #109; MASTER_PLAN Section 3
```

#### Issue #110: Add ETA Calculation and Display Per Waypoint
**Labels:** enhancement
**Body:**
```
Goal
Surface ETAs per waypoint based on optimized route.

Key Tasks
- Calculate arrival times using distance, speed (default 30 km/h), stop duration (5 min)
- Display ETAs in waypoint list
- Update ETAs during navigation in real-time
- Account for varying speeds and actual stop times

Success Criteria
- [ ] ETAs calculated for each waypoint
- [ ] ETAs display in route planning interface
- [ ] Real-time ETA updates during navigation
- [ ] Configurable speed and stop duration settings

Deps
- #109 (optimized route geometry)

Refs
- ROADMAP #110; MASTER_PLAN Section 3
```

#### Issue #111: Build Advanced Search and Filtering on Dashboard
**Labels:** enhancement
**Body:**
```
Goal
Improve dashboard discoverability with search/filter/sort.

Key Tasks
- Add search bar (name, description, waypoint address)
- Real-time filtering as user types
- Filters: date range, status, distance, number of stops
- Sort options (date, name, distance, views)
- Highlight matching text in search results

Success Criteria
- [ ] Search bar functional with real-time results
- [ ] All filter options working correctly
- [ ] Sort options apply correctly
- [ ] Search highlights matching text
- [ ] Fast performance (<100ms per keystroke)

Refs
- ROADMAP #111; MASTER_PLAN Section 9
```

#### Issue #112: Integrate Reverse Geocoding for Street Name Display
**Labels:** enhancement
**Body:**
```
Goal
Show current street/location in tracking.

Key Tasks
- Use Mapbox Geocoding API reverse lookup
- Convert GPS coordinates to street address
- Update every 30 seconds; cache recent lookups
- Display banner: "🎅 Santa is currently on Main Street"
- Fallback: "🎅 Santa is 1.2 km from next stop"; include suburb/town

Success Criteria
- [ ] Street name displays on tracking page
- [ ] Updates every 30 seconds
- [ ] Caching reduces API calls
- [ ] Graceful fallback when address unavailable

Refs
- ROADMAP #112; MASTER_PLAN Section 6
```

#### Issue #113: Add Route Preview Mode (Turn-by-Turn List)
**Labels:** enhancement
**Body:**
```
Goal
Allow preview of turn-by-turn steps.

Key Tasks
- Add "Preview Instructions" button on route detail page
- Create modal showing all navigation steps
- Display scrollable list with distances
- Make format print-friendly

Success Criteria
- [ ] Preview button visible on route detail page
- [ ] Modal displays all turn-by-turn instructions
- [ ] Instructions include distances
- [ ] Print-friendly format available

Refs
- ROADMAP #113; MASTER_PLAN Section 3
```

---
## Release 3.1 - PWA Core (Parent + Sub-Issues)

### Parent Issue: Release 3.1 - Progressive Web App Core (Q2 2025)
**Labels:** enhancement
**Body:**
```
Goal
Make the app installable and offline-capable.

Sub-Issues
- [ ] #114 Set Up Service Worker with Workbox (12h, HIGH, dep #100)
- [ ] #115 Implement Offline Route Viewing (10h, HIGH, dep #114)
- [ ] #116 Enable Offline Navigation Mode (15h, HIGH, dep #114, #115)
- [ ] #117 Create PWA Manifest and App Icons (10h, HIGH)
- [ ] #118 Add "Add to Home Screen" Install Prompts (5h, HIGH, dep #117)
- [ ] #119 Implement Background Sync for Queued Data (15h, MEDIUM, dep #114)
- [ ] #120 Build Offline Map Tile Caching (18h, MEDIUM, dep #114)

Refs
- ROADMAP Release 3.1; MASTER_PLAN Section 11
```

#### Issue #114: Set Up Service Worker with Workbox
**Labels:** enhancement
**Body:**
```
Goal
Service worker foundation for offline support.

Key Tasks
- Install and configure Workbox for service worker generation
- Cache-first for static assets; network-first with fallback for APIs
- Set up background sync for location updates
- Configure precaching for app shell

Success Criteria
- [ ] Service worker registered and functional
- [ ] Static assets cached on first load
- [ ] Offline fallback works for API calls
- [ ] Background sync operational

Deps
- #100

Refs
- ROADMAP #114; MASTER_PLAN Section 11
```

#### Issue #115: Implement Offline Route Viewing
**Labels:** enhancement
**Body:**
```
Goal
View routes offline with cached data.

Key Tasks
- Cache active route data locally (IndexedDB)
- Enable viewing route map and waypoints offline
- Add "Offline Mode" indicator to UI
- Sync updates when reconnected

Success Criteria
- [ ] Routes viewable without internet
- [ ] Map and waypoints display offline
- [ ] Offline indicator visible when disconnected
- [ ] Data syncs when connection restored

Deps
- #114

Refs
- ROADMAP #115; MASTER_PLAN Section 11
```

#### Issue #116: Enable Offline Navigation Mode
**Labels:** enhancement
**Body:**
```
Goal
Continue turn-by-turn navigation offline.

Key Tasks
- Cache Mapbox map tiles for route area
- Continue navigation offline; queue location broadcasts
- Send queued updates when online
- Provide local-only mode for testing

Success Criteria
- [ ] Navigation continues without internet
- [ ] Map tiles load from cache
- [ ] Location updates queue offline
- [ ] Updates transmit when connection restored

Deps
- #114, #115

Refs
- ROADMAP #116; MASTER_PLAN Section 11
```

#### Issue #117: Create PWA Manifest and App Icons
**Labels:** enhancement
**Body:**
```
Goal
Define manifest and visual assets for installability.

Key Tasks
- Create manifest.json with app metadata
- Design Fire Santa Run icon; generate all sizes (48–512px)
- Create splash screens for iOS
- Set display mode to standalone; theme/background colors
- Configure start URL

Success Criteria
- [ ] manifest.json validates
- [ ] All icon sizes generated
- [ ] Splash screens display on iOS
- [ ] App displays in standalone mode when installed

Refs
- ROADMAP #117; MASTER_PLAN Section 11
```

#### Issue #118: Add "Add to Home Screen" Install Prompts
**Labels:** enhancement
**Body:**
```
Goal
Prompt users to install the PWA.

Key Tasks
- Detect installability (beforeinstallprompt)
- Show "Add to Home Screen" prompt at the right moment
- Create custom install banner for iOS Safari
- Track installation analytics
- Provide manual install instructions

Success Criteria
- [ ] Install prompt displays on supported browsers
- [ ] iOS custom banner shows installation instructions
- [ ] Installation analytics tracked
- [ ] Manual instructions available in help section

Deps
- #117

Refs
- ROADMAP #118; MASTER_PLAN Section 11
```

#### Issue #119: Implement Background Sync for Queued Data
**Labels:** enhancement
**Body:**
```
Goal
Reliably sync offline actions when back online.

Key Tasks
- Queue offline actions (location updates, route edits)
- Detect network reconnection; auto-sync
- Resolve conflicts via last-write-wins
- Show sync progress indicator to user

Success Criteria
- [ ] Offline actions queued in IndexedDB
- [ ] Auto-sync on reconnection
- [ ] Conflict resolution functional
- [ ] Sync progress visible to user

Deps
- #114

Refs
- ROADMAP #119; Background Sync API; MASTER_PLAN Section 11
```

#### Issue #120: Build Offline Map Tile Caching
**Labels:** enhancement
**Body:**
```
Goal
Cache route-area tiles for offline navigation.

Key Tasks
- Implement route area pre-caching
- Download map tiles for route bounding box (5–10 MB per route)
- Store in IndexedDB with quota management
- Add "Download for Offline Use" button
- Intercept Mapbox tile requests in service worker
- Serve from cache if available; fallback online
- Implement cache expiration (30 days)

Success Criteria
- [ ] Offline download button functional
- [ ] Map tiles cached successfully
- [ ] Tiles serve from cache offline
- [ ] Cache expiration works correctly
- [ ] Storage quota managed appropriately

Deps
- #114

Refs
- ROADMAP #120; MASTER_PLAN Section 11
```

---
## Release 3.2 - Advanced Mobile Features (Parent + Sub-Issues)

### Parent Issue: Release 3.2 - Advanced Mobile Features (Q2 2025)
**Labels:** enhancement
**Body:**
```
Goal
Enhance mobile navigation with native-like behaviors.

Sub-Issues
- [ ] #121 Implement Background Location Tracking (15h, HIGH, dep #116)
- [ ] #122 Integrate Lock Screen Media Controls (12h, MEDIUM)
- [ ] #123 Add Off-Route Detection and Rerouting (12h, MEDIUM)
- [ ] #124 Implement Real-Time ETA Recalculation (10h, MEDIUM, dep #110)
- [ ] #125 Add Predictive ETA Improvements (Optional) (8h, LOW, dep #124)

Refs
- ROADMAP Release 3.2; MASTER_PLAN Section 3a
```

#### Issue #121: Implement Background Location Tracking
**Labels:** enhancement
**Body:**
```
Goal
Maintain tracking when app is minimized.

Key Tasks
- Request background-geolocation permission
- Continue tracking when app minimized
- Use Web Background Sync for location updates
- Implement battery-efficient tracking (30s intervals)
- Use Wake Lock API; add "Keep Screen On" toggle; show indicator; release on nav end

Success Criteria
- [ ] Background location tracking permission requested
- [ ] Tracking continues when app minimized
- [ ] Battery-efficient implementation (30s intervals)
- [ ] Wake lock prevents screen sleep; toggle functional; released on end

Deps
- #116

Refs
- ROADMAP #121; MASTER_PLAN Section 3a
```

#### Issue #122: Integrate Lock Screen Media Controls
**Labels:** enhancement
**Body:**
```
Goal
Control voice instructions from lock screen.

Key Tasks
- Register app as media session for voice instructions
- Add lock screen controls: Play/Pause voice; Next/Previous waypoint
- Display route name and current instruction on lock screen
- Queue voice instructions; implement audio ducking; resume media; handle volume

Success Criteria
- [ ] Media Session API integrated
- [ ] Lock screen controls functional
- [ ] Route info displays on lock screen
- [ ] Voice instructions queue properly; audio ducking works

Refs
- ROADMAP #122; MASTER_PLAN Section 3a
```

#### Issue #123: Add Off-Route Detection and Rerouting
**Labels:** enhancement
**Body:**
```
Goal
Detect off-route and reroute seamlessly.

Key Tasks
- Detect when driver is >100m off planned route
- Show banner: "You're off route. Reroute?"
- Options: "Reroute Now" or "Dismiss"; auto-dismiss if back on route
- Call Mapbox Directions API from current location to next unvisited waypoint
- Update navigation steps; voice announcement "Rerouting..."
- Log rerouting events; display reroute count in route summary

Success Criteria
- [ ] Off-route detection functional (>100m threshold)
- [ ] Reroute banner displays appropriately
- [ ] Automatic rerouting calculates correct path
- [ ] Navigation updates seamlessly
- [ ] Rerouting events logged; counts shown in summary

Refs
- ROADMAP #123; MASTER_PLAN Section 3a
```

#### Issue #124: Implement Real-Time ETA Recalculation
**Labels:** enhancement
**Body:**
```
Goal
Keep ETAs accurate with live speed/stop data.

Key Tasks
- Calculate current speed from GPS
- Update ETA every 10 seconds
- Account for stops (stationary > 2 minutes)
- Show "Ahead of Schedule" / "Behind Schedule" indicator
- Recalculate cumulative ETAs for remaining waypoints

Success Criteria
- [ ] Speed calculated from GPS data
- [ ] ETAs update every 10 seconds
- [ ] Stops detected and factored in
- [ ] Schedule indicators display correctly
- [ ] Cumulative ETAs accurate

Deps
- #110

Refs
- ROADMAP #124; MASTER_PLAN Section 3a
```

#### Issue #125: Add Predictive ETA Improvements (Optional)
**Labels:** enhancement
**Body:**
```
Goal
Improve ETAs with historical/traffic-based prediction.

Key Tasks
- Implement basic ML model (optional)
- Learn from historical route data; adjust for time of day
- Consider traffic patterns; display confidence level
- Store historical timing data

Success Criteria
- [ ] ML model functional (if implemented)
- [ ] Historical data collected
- [ ] Predictions more accurate over time
- [ ] Confidence level displayed

Deps
- #124

Refs
- ROADMAP #125; MASTER_PLAN Section 3a
```

---
## Release 4 - Multi-Brigade Platform (Parent + Sub-Issues)

### Parent Issue: Release 4 - Multi-Brigade Platform (May 2025)
**Labels:** enhancement
**Body:**
```
Goal
Evolve to multi-brigade platform with public visibility and collaboration.

Sub-Issues
- [ ] #126 Build Public Brigade Profile Pages (18h, HIGH, dep #100)
- [ ] #127 Create Brigade Discovery and Search (10h, HIGH, dep #126)
- [ ] #128 Implement Logo Upload and Custom Branding (12h, MEDIUM, dep #126)
- [ ] #129 Build Member Management UI (15h, MEDIUM)
- [ ] #130 Add Multi-Operator Route Collaboration (12h, LOW)
- [ ] #131 Implement Data Export (JSON, CSV, KML, PDF) (15h, LOW)
- [ ] #132 Add Data Import and Restore (8h, LOW, dep #131)
- [ ] #133 Create First-Time User Tutorial (10h, LOW)

Refs
- ROADMAP Release 4; MASTER_PLAN Sections 1, 9, 11
```

#### Issue #126: Build Public Brigade Profile Pages
**Labels:** enhancement
**Body:**
```
Goal
Public brigade pages with route listings.

Key Tasks
- Create public brigade profile page: /brigade/{slug}
- Display brigade info: name, location, logo, contact
- List public routes (upcoming/past)
- Add social media links
- Add "Claim This Brigade" button if unclaimed
- Responsive layout mobile/desktop

Success Criteria
- [ ] Public brigade pages accessible via /brigade/{slug}
- [ ] Brigade information displays correctly
- [ ] Route list shows upcoming and past routes
- [ ] Social media links functional
- [ ] Claim button works for unclaimed brigades

Deps
- #100

Refs
- ROADMAP #126; MASTER_PLAN Section 1
```

#### Issue #127: Create Brigade Discovery and Search
**Labels:** enhancement
**Body:**
```
Goal
Discover brigades across states/regions.

Key Tasks
- Create homepage featuring brigades
- Browse all brigades by state/region
- Search brigades by name/location
- Brigade map view with pins; filter by state/region
- Sort options (alphabetical, most active, newest)

Success Criteria
- [ ] Homepage features brigade discovery
- [ ] Browse by state/region works
- [ ] Search returns accurate results
- [ ] Map view displays all brigades
- [ ] Filters and sort options functional

Deps
- #126

Refs
- ROADMAP #127; MASTER_PLAN Section 1
```

#### Issue #128: Implement Logo Upload and Custom Branding
**Labels:** enhancement
**Body:**
```
Goal
Support brigade branding across the app.

Key Tasks
- Implement logo upload (PNG/JPG max 2 MB) to Azure Blob
- Display logo on dashboard, public pages, tracking pages
- Default to RFS logo if not uploaded
- Add custom theme color picker; preview; reset to default
- Implement contact info fields (email, phone, website, social)
- Public display toggle for privacy control

Success Criteria
- [ ] Logo upload functional; stored in Azure Blob Storage
- [ ] Logos display across pages
- [ ] Custom theme colors apply correctly
- [ ] Preview works; reset to default works
- [ ] Contact information saves and displays

Deps
- #126

Refs
- ROADMAP #128; MASTER_PLAN Section 1
```

#### Issue #129: Build Member Management UI
**Labels:** enhancement
**Body:**
```
Goal
UI for member roles, invites, and audits.

Key Tasks
- Create member list view (role, status, last login)
- Send email invitations; set role in invitation; 7-day expiry links
- Track invitation status
- Change member role; suspend/remove members
- Admin approval for pending members
- Audit log of permission changes

Success Criteria
- [ ] Member list displays all members correctly
- [ ] Email invitations send successfully
- [ ] Invitation links work and expire correctly
- [ ] Role changes apply immediately
- [ ] Suspend/remove actions functional
- [ ] Audit log records all changes

Refs
- ROADMAP #129; MASTER_PLAN Section 1
```

#### Issue #130: Add Multi-Operator Route Collaboration
**Labels:** enhancement
**Body:**
```
Goal
Allow multiple operators to edit routes with conflict handling.

Key Tasks
- Multiple operators can edit same route simultaneously
- Real-time conflict detection; last-edit-wins strategy
- Show who is currently editing
- Add comments to routes; tag waypoints with notes
- Brigade-internal communication; comment history with timestamps

Success Criteria
- [ ] Multiple editors can work on same route
- [ ] Conflict detection functional
- [ ] Current editors displayed
- [ ] Comments system operational
- [ ] Waypoint notes functional

Refs
- ROADMAP #130; MASTER_PLAN Section 1
```

#### Issue #131: Implement Data Export (JSON, CSV, KML, PDF)
**Labels:** enhancement
**Body:**
```
Goal
Export routes and analytics in multiple formats.

Key Tasks
- Download single route as JSON
- Bulk export all brigade routes
- Formats: JSON, CSV, KML (Google Earth)
- Include waypoints, metadata, analytics in exports
- Generate PDF route summary (map screenshot, waypoints, instructions, branding)
- Print-friendly format

Success Criteria
- [ ] Single route export works in all formats
- [ ] Bulk export functional
- [ ] All data included in exports
- [ ] PDF generation operational; branding applied
- [ ] Print-friendly output available

Refs
- ROADMAP #131; MASTER_PLAN Section 1
```

#### Issue #132: Add Data Import and Restore
**Labels:** enhancement
**Body:**
```
Goal
Import/restore routes and backups.

Key Tasks
- Upload JSON backup file
- Restore deleted routes
- Import from external formats (GPX, KML)
- Validate imported data; resolve duplicates
- Show import preview before confirming

Success Criteria
- [ ] JSON import functional
- [ ] Restore deleted routes works
- [ ] External format imports successful
- [ ] Validation catches errors
- [ ] Conflict resolution works correctly
- [ ] Import preview displays accurately

Deps
- #131

Refs
- ROADMAP #132; MASTER_PLAN Section 1
```

#### Issue #133: Create First-Time User Tutorial
**Labels:** enhancement
**Body:**
```
Goal
Onboard new admins with guided flows and help.

Key Tasks
- Interactive walkthrough for new admins
- "Create Your First Route" guided flow
- Tooltips/help hints throughout app; skip option
- FAQ section; embed video tutorials (YouTube)
- Searchable knowledge base; support contact form

Success Criteria
- [ ] Tutorial launches for new users
- [ ] Guided flow completes route creation
- [ ] Tooltips display contextually; skip works
- [ ] FAQ accessible; videos embedded
- [ ] Knowledge base searchable; support form functional

Refs
- ROADMAP #133; MASTER_PLAN Section 1
```

---
## Creation Tips
- Use GitHub CLI: `gh issue create --title "..." --body-file path.md --label ...`
- Create parent issues first, then child issues; update parent tasklists with created issue numbers if desired.
- Apply milestones per release: Release 1 Quality Uplift, Release 2.1, Release 2.2, Release 3.1, Release 3.2, Release 4.
- Labels are suggestions; adjust to your repo conventions.
