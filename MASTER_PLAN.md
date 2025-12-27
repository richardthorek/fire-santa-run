# Fire Santa Run - Comprehensive Master Plan

## Executive Summary
A web application for Australian Rural Fire Service (RFS) brigades to plan, publish, and track Santa runs. Each brigade gets authenticated access via Microsoft Entra External ID to create multiple routes over time, generate shareable links with QR codes, and enable real-time public tracking. The application runs on Azure Static Web Apps with Azure Table Storage for persistence and Azure Web PubSub for real-time communication. Brigade operators receive turn-by-turn navigation powered by Mapbox Directions API while broadcasting their location as "Santa" to the public.

---

## Visual Design & Brand Identity

### Design Philosophy
The Fire Santa Run application embodies a **fun, magical, whimsical Christmas experience** with an **Australian summer twist**. The design balances festive joy with professional firefighting heritage, creating a modern, sleek interface that delights users while maintaining credibility and ease of use.

### Australian Summer Christmas Theme
Unlike traditional northern hemisphere Christmas imagery (snow, winter), this app celebrates **Australian summer Christmas**:
- 🌞 **Bright, sunny atmosphere** - vibrant colors reflecting summer heat
- 🏖️ **Beach-inspired elements** - sand, surf, sunshine
- 🌺 **Native flora** - Christmas bush, bottlebrush, eucalyptus
- 🎄 **Aussie twist on traditions** - Santa in shorts, BBQ celebrations, outdoor gatherings
- 🚒 **Fire service heritage** - rural fire service pride, community service

### Color Palette

#### Primary Colors
```css
/* Fire Brigade Red - Primary brand color */
--fire-red: #D32F2F;           /* Main CTA buttons, important alerts */
--fire-red-dark: #B71C1C;      /* Hover states, active elements */
--fire-red-light: #EF5350;     /* Backgrounds, lighter accents */

/* Summer Gold - Warmth and sunshine */
--summer-gold: #FFA726;        /* Secondary CTAs, highlights */
--summer-gold-light: #FFB74D;  /* Accents, decorative elements */

/* Christmas Green - Festive touch */
--christmas-green: #43A047;    /* Success states, completed markers */
--eucalyptus-green: #66BB6A;   /* Lighter accents */
```

#### Supporting Colors
```css
/* Sky Blue - Australian summer sky */
--sky-blue: #29B6F6;          /* Links, info states */
--ocean-blue: #0288D1;        /* Deep water, backgrounds */

/* Sandy Beige - Beach and outback */
--sand-beige: #FFECB3;        /* Neutral backgrounds */
--sand-light: #FFF9E6;        /* Card backgrounds */

/* Sunset Orange - Summer evening */
--sunset-orange: #FF7043;     /* Warm accents */
--sunset-pink: #FF8A80;       /* Decorative highlights */
```

#### Neutral Colors
```css
/* Modern grays for contrast and readability */
--neutral-50: #FAFAFA;
--neutral-100: #F5F5F5;
--neutral-200: #EEEEEE;
--neutral-300: #E0E0E0;
--neutral-700: #616161;
--neutral-800: #424242;
--neutral-900: #212121;
```

### Typography

#### Font Families
```css
/* Headings - Modern, bold, attention-grabbing */
--font-heading: 'Nunito', 'Montserrat', 'Poppins', system-ui, sans-serif;
font-weight: 700-900;

/* Body Text - Clean, readable, professional */
--font-body: 'Inter', 'Open Sans', system-ui, -apple-system, sans-serif;
font-weight: 400-600;

/* Monospace - Technical elements, coordinates */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

#### Typography Scale
```css
/* Mobile-first responsive typography */
--text-xs: 0.75rem;    /* 12px - Small labels, captions */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Emphasized text */
--text-xl: 1.25rem;    /* 20px - Small headings */
--text-2xl: 1.5rem;    /* 24px - Section headings */
--text-3xl: 1.875rem;  /* 30px - Page titles */
--text-4xl: 2.25rem;   /* 36px - Hero headings */
--text-5xl: 3rem;      /* 48px - Large displays */
```

### Visual Elements & Decorations

#### Christmas Decorations (Whimsical Touches)
- **Subtle sparkles** - Animated twinkle effects on success states
- **Christmas lights** - String of lights as divider elements
- **Festive icons** - Santa hat, gift box, candy cane as decorative elements
- **Snow(?) consideration** - Falling snow animation toggle (respectful of Australian context)
- **Star trails** - Following Santa's route with star/sparkle effects

#### Australian Elements
- **Native flowers** - Stylized Christmas bush, bottlebrush illustrations
- **Sun motifs** - Sunshine rays, warm glows
- **Wave patterns** - Subtle wave textures in backgrounds
- **Gum leaf silhouettes** - Header/footer decorative elements
- **Outback textures** - Subtle sand/earth patterns in neutral areas

#### Fire Service Elements
- **Badge/Emblem styling** - Brigade logos prominently displayed
- **Chevron patterns** - Inspired by fire truck safety markings
- **Alert indicators** - Emergency-style flashing for critical actions
- **Service ribbons** - Decorative ribbon/banner elements for announcements

### Iconography

#### Icon System
Use **rounded, friendly icons** with consistent 2px stroke weight:
- Material Symbols Rounded (Google)
- Phosphor Icons (rounded variant)
- Custom SVG icons for specific fire/Christmas elements

#### Key Icons
```typescript
interface IconSet {
  // Navigation
  dashboard: '🏠',
  map: '🗺️',
  routes: '🛣️',
  settings: '⚙️',
  
  // Actions
  add: '➕',
  edit: '✏️',
  delete: '🗑️',
  share: '🔗',
  save: '💾',
  
  // Santa & Christmas
  santa: '🎅',
  gift: '🎁',
  tree: '🎄',
  bell: '🔔',
  star: '⭐',
  
  // Fire Service
  fire_truck: '🚒',
  badge: '🛡️',
  siren: '🚨',
  
  // Status
  live: '🔴',
  scheduled: '📅',
  completed: '✅',
  draft: '📝'
}
```

### Component Styling Patterns

#### Cards & Containers
```css
.card {
  background: linear-gradient(135deg, var(--sand-light) 0%, white 100%);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
  border: 1px solid var(--neutral-200);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.card--festive {
  border-top: 4px solid var(--fire-red);
  position: relative;
  overflow: hidden;
}

.card--festive::before {
  content: '✨';
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 1.5rem;
  opacity: 0.3;
}
```

#### Buttons
```css
/* Primary - Fire Brigade Red */
.btn-primary {
  background: linear-gradient(135deg, var(--fire-red) 0%, var(--fire-red-dark) 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(211, 47, 47, 0.4);
}

/* Secondary - Summer Gold */
.btn-secondary {
  background: linear-gradient(135deg, var(--summer-gold) 0%, var(--summer-gold-light) 100%);
  color: var(--neutral-900);
}

/* Success - Christmas Green */
.btn-success {
  background: linear-gradient(135deg, var(--christmas-green) 0%, var(--eucalyptus-green) 100%);
  color: white;
}
```

#### Navigation
```css
.navbar {
  background: linear-gradient(90deg, var(--fire-red) 0%, var(--fire-red-dark) 100%);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.nav-item {
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  transition: background 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: 600;
}
```

#### Map Markers
```css
/* Santa Marker - Animated, prominent */
.marker-santa {
  width: 48px;
  height: 48px;
  background: radial-gradient(circle, var(--fire-red) 0%, var(--fire-red-dark) 100%);
  border: 4px solid white;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(211, 47, 47, 0.5),
              0 0 0 8px rgba(211, 47, 47, 0.2);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(211, 47, 47, 0.5),
                0 0 0 8px rgba(211, 47, 47, 0.2);
  }
  50% {
    box-shadow: 0 4px 16px rgba(211, 47, 47, 0.7),
                0 0 0 12px rgba(211, 47, 47, 0.3);
  }
}

/* Waypoint Markers - Numbered, clean */
.marker-waypoint {
  width: 36px;
  height: 36px;
  background: white;
  border: 3px solid var(--christmas-green);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--christmas-green);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.marker-waypoint.completed {
  background: var(--christmas-green);
  color: white;
}
```

### Floating Panel Design System (iOS-Inspired)

#### Panel Container
```css
.floating-panel {
  position: absolute;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); /* Safari support */
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 1rem 1.5rem;
  z-index: 1000;
}

/* Header Panel - Top of screen */
.floating-panel--header {
  top: 1rem;
  left: 1rem;
  right: 1rem;
}

/* Sidebar Panel - Right side (desktop) */
.floating-panel--sidebar {
  top: 6rem;
  right: 1rem;
  bottom: 1rem;
  width: min(400px, calc(100vw - 2rem));
  overflow-y: auto;
}

/* Bottom Sheet - Mobile sidebar alternative */
@media (max-width: 768px) {
  .floating-panel--sidebar {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-height: 60vh;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
  }
}

/* Bottom Panel - Navigation/Actions */
.floating-panel--bottom {
  bottom: 1rem;
  left: 1rem;
  right: 1rem;
}
```

#### Floating Panel Variants
```css
/* Semi-transparent colored panels (e.g., navigation header) */
.floating-panel--colored {
  background: rgba(211, 47, 47, 0.95); /* Fire red */
  color: white;
}

/* High-contrast panel for important information */
.floating-panel--emphasis {
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
```

#### Floating Buttons
```css
.floating-button {
  position: absolute;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  transition: transform 0.2s;
}

.floating-button:hover {
  transform: scale(1.05);
}

.floating-button:active {
  transform: scale(0.95);
}
```

#### Accessibility for Floating Panels
```css
/* Ensure sufficient touch target size */
.floating-panel button,
.floating-panel a {
  min-height: 44px;
  min-width: 44px;
}

/* Focus states clearly visible */
.floating-panel *:focus-visible {
  outline: 3px solid var(--summer-gold);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Keyboard navigation support */
.floating-panel {
  /* Ensure panel is accessible via keyboard */
  position: absolute; /* Not fixed, to avoid z-index issues */
}
```


### Animations & Interactions

#### Micro-interactions
```css
/* Sparkle effect on success */
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}

/* Sleigh slide entrance */
@keyframes slide-in {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Bounce for attention */
@keyframes bounce-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* Glow effect for live tracking */
@keyframes glow {
  0%, 100% { box-shadow: 0 0 10px var(--fire-red); }
  50% { box-shadow: 0 0 20px var(--fire-red), 0 0 30px var(--fire-red); }
}
```

#### Transition Timings
```css
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;
--transition-slower: 500ms;

--easing-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

### Layout Patterns

#### Page Structure
```
┌─────────────────────────────────────┐
│ Header/Navbar (Festive red)        │
│ 🎅 Fire Santa Run | Nav Items      │
├─────────────────────────────────────┤
│ Hero Banner (Optional)              │
│ Seasonal greeting, key message      │
├─────────────────────────────────────┤
│                                     │
│ Main Content Area                   │
│ (Dashboard, Map, Forms, etc.)       │
│                                     │
├─────────────────────────────────────┤
│ Footer                              │
│ Brigade info, social, copyright     │
└─────────────────────────────────────┘
```

#### Responsive Breakpoints
```css
/* Mobile-first approach */
--breakpoint-sm: 640px;   /* Small tablets, large phones */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Desktops */
--breakpoint-xl: 1280px;  /* Large desktops */
--breakpoint-2xl: 1536px; /* Extra large screens */
```

### Accessibility Considerations

#### Color Contrast (WCAG AA Compliance)
- Fire red on white: ✅ 4.5:1 contrast ratio
- Text on colored backgrounds must meet 4.5:1 minimum
- Interactive elements: 3:1 minimum for non-text contrast

#### Focus States
```css
*:focus-visible {
  outline: 3px solid var(--summer-gold);
  outline-offset: 2px;
  border-radius: 4px;
}
```

#### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Dark Mode Considerations

While the primary theme is bright and festive (summer Christmas), provide optional dark mode:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--neutral-900);
    --bg-secondary: var(--neutral-800);
    --text-primary: var(--neutral-50);
    --text-secondary: var(--neutral-300);
    
    /* Adjust colors for dark backgrounds */
    --fire-red: #EF5350;
    --summer-gold: #FFB74D;
    --christmas-green: #66BB6A;
  }
  
  .card {
    background: linear-gradient(135deg, var(--neutral-800) 0%, var(--neutral-900) 100%);
    border-color: var(--neutral-700);
  }
}
```

### Loading States & Empty States

#### Loading Skeleton
```css
.skeleton {
  background: linear-gradient(90deg, 
    var(--neutral-200) 25%, 
    var(--neutral-100) 50%, 
    var(--neutral-200) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### Empty State Illustrations
- Friendly, whimsical illustrations for empty states
- "No routes yet - Create your first Santa run!" with Santa waving
- "Waiting for Santa..." with clock and present icons

### Page-Specific Design Guidelines

#### Public Tracking Page
- **Full-screen map** - Immersive experience
- **Floating info card** - Translucent overlay with Santa status
- **Progress bar** - Visual route completion indicator
- **Festive cursor trail** - Optional sparkles following cursor
- **Share button** - Prominent, easy to find

#### Brigade Dashboard
- **Card-based layout** - Each route as a festive card
- **Status badges** - Color-coded (draft, live, completed)
- **Quick actions** - Edit, share, start navigation
- **Stats overview** - Total routes, active routes, total viewers

#### Route Planning Interface
- **Full-screen map** - Map fills entire viewport (100vw x 100vh) as background
- **Floating header panel** (implemented):
  - Position: Absolute, 1rem from top/left/right edges
  - Style: Rounded 16px, backdrop-filter blur(10px), rgba(255,255,255,0.95)
  - Shadow: 0 4px 12px rgba(0,0,0,0.15)
  - Contains: Route title, stats, action buttons (Cancel, Save, Publish, Navigate)
  - Responsive: Wraps buttons on smaller screens
- **Floating sidebar panel** (implemented):
  - Desktop: Right side, 400px max width, 1rem from edges
  - Mobile (<768px): Bottom sheet style, full width, rounded top corners (20px)
  - Style: Same as header (backdrop blur, rounded, shadow)
  - Contains: Route details form, waypoint search, waypoint list
  - Scrollable: Internal overflow-y for long waypoint lists
- **Drag handles** - Clear visual indicators for reordering waypoints
- **Contextual tooltips** - Helpful hints without cluttering
- **Touch targets** - All buttons minimum 44x44px for accessibility

#### Navigation View (Brigade Operator)
- **Full-screen map** - Map fills entire viewport (100vw x 100vh) as background
- **Floating navigation header** (implemented):
  - Position: Absolute, 1rem from top/left/right edges
  - Style: Rounded 16px, backdrop-filter blur(10px), rgba(211,47,47,0.95)
  - Contains: Maneuver icon, distance, turn instruction
  - High contrast: White text on red background for sunlight readability
- **Floating bottom panel** (implemented):
  - Position: Absolute, 1rem from bottom/left/right edges
  - Style: White with backdrop blur, rounded 16px
  - Contains: Progress bar, next waypoint info, action buttons
  - Touch-friendly: Large buttons (44px min height)
- **Floating controls** (implemented):
  - Voice toggle: Circular button (48px) with backdrop blur, top-left
  - Wake lock indicator: Translucent badge, top-right when needed
- **Minimal distractions** - Clean, focused UI with all elements floating over map
- **Voice instruction preview** - Text of next instruction displayed prominently

### Brand Assets & Logo Guidelines

#### Fire Santa Run Logo
Concept: Combine fire service badge/shield with Santa hat and sleigh
- **Primary logo**: Full color with text
- **Icon only**: For mobile, favicons
- **Monochrome**: For print, single-color applications

#### Brigade Logo Integration
- Prominent display of brigade logo in header
- Respect brigade brand colors as accent where appropriate
- Clear attribution: "Powered by Fire Santa Run"

### Implementation Guidelines for Developers

1. **CSS Custom Properties**: Define all colors, spacing, and typography as CSS variables
2. **Utility Classes**: Create reusable classes for common patterns (.card-festive, .btn-christmas)
3. **Component Library**: Build a consistent component library (buttons, cards, modals)
4. **Responsive Images**: Use WebP format with fallbacks, lazy loading
5. **Performance**: Optimize animations, use CSS transforms over layout properties
6. **Progressive Enhancement**: Core functionality works without JavaScript, enhancements layer on
7. **Theme Switching**: Allow brigades to customize primary color to match their branding

### Design System Resources

#### Recommended Tools
- **Figma**: Design mockups and prototypes
- **Coolors.co**: Color palette generation and testing
- **WebAIM Contrast Checker**: Ensure accessibility compliance
- **undraw.co**: Free illustrations for empty states
- **Heroicons / Phosphor Icons**: Consistent icon library

#### Inspiration Sources
- Australian summer lifestyle imagery
- Fire service websites and marketing materials
- Christmas festival websites (Sydney Christmas, Carols by Candlelight)
- Modern SaaS dashboards (Linear, Notion, Vercel)
- Holiday tracking apps (NORAD Santa Tracker)

---

## Core Features & Architecture

### 1. Multi-Brigade System
**Requirements:**
- Support multiple independent RFS brigades
- Each brigade has isolated route management
- Brigade-specific branding (name, logo, colors)
- Historical route archive per brigade

**Technical Approach:**
- Brigade identification via unique slug/ID (e.g., `/brigade/griffith-rfs`)
- Local storage with brigade namespacing
- Brigade configuration object with metadata

---

### 2. Authentication & Authorization

**Requirements:**
- Enterprise-grade authentication using Microsoft Entra External ID
- Domain whitelisting for brigade member verification
- Support for multiple email domains per brigade
- Role-based access control (admin, operator, viewer)
- Session persistence across devices
- Secure logout functionality

**Technical Approach:**
- **Microsoft Entra External ID (Azure AD B2C successor)** for authentication
- Email domain validation against brigade whitelist
  - Example: Only users with `@griffithrfs.org.au` or `@rfs.nsw.gov.au` can access Griffith RFS brigade
- OAuth 2.0 / OpenID Connect flows
- JWT tokens for API authentication
- Role claims in tokens for authorization
- Brigade assignment based on email domain or manual approval

**Domain Whitelisting Strategy:**
```typescript
interface BrigadeAuth {
  brigadeId: string;
  allowedDomains: string[]; // ['@rfs.nsw.gov.au', '@griffithrfs.org.au']
  allowedEmails: string[];  // Specific email addresses if not domain-based
  requireApproval: boolean; // Manual admin approval for new users
}
```

**Authentication Flow:**
1. User clicks "Login" → Redirects to Entra External ID
2. User authenticates with social or email provider
3. Token returned with email claim
4. App checks email against brigade whitelists
5. If match found, grant access to that brigade
6. If no match, show "Request Access" form for admin approval
7. Session stored in browser with refresh token

**Login UX hardening (tenant-specific):**
- `VITE_ENTRA_AUTHORITY` must be tenant-specific (no `/common`, `/organizations`, or `/consumers`) so users stay within the brigade tenant during auth.
- All login requests force `prompt=login` and support an optional `domain_hint` via `VITE_ENTRA_DOMAIN_HINT` to bypass the Microsoft account picker and go straight to email entry.

**Security Considerations:**
- Enterprise-grade security with Entra External ID
- Multi-factor authentication support (MFA)
- Conditional access policies
- Token expiration and refresh
- Audit logging of authentication events
- HTTPS enforced
- CORS properly configured for Azure Static Web Apps

---

### 3. Route Planning Interface (Brigade Dashboard)
**Requirements:**
- Create new Santa routes on Mapbox
- Interactive map with drawing tools
- Add/edit/delete waypoints
- Drag waypoints to reorder
- Set route metadata:
  - Route name (e.g., "Christmas Eve 2024")
  - Date and start time
  - Estimated speed/duration
  - Notes/descriptions
- Save routes as drafts
- Publish routes to generate tracking link

**Technical Approach:**
- Mapbox GL JS with Draw plugin for manual waypoint placement
- **Mapbox Directions API** for route optimization and navigation
- Click-to-add waypoints on map, then optimize with Directions API
- Geocoding API for address lookup and search
- Store both waypoints and optimized route geometry
- Route polyline rendering between waypoints
- Route list with status (draft/published/active/completed)
- Edit mode for existing routes

**Route Creation Workflow:**
1. User clicks on map to add waypoints manually
2. User can search for addresses to add waypoints
3. System calls Mapbox Directions API to generate optimized route
4. Display optimized route polyline with turn-by-turn instructions
5. User can review/adjust waypoints
6. Save route with both waypoints and navigation data

**Data Storage:**
```typescript
interface Route {
  waypoints: Waypoint[];          // User-defined stops
  geometry: GeoJSON.LineString;   // Mapbox Directions route geometry
  steps: NavigationStep[];        // Turn-by-turn instructions
  distance: number;               // Total distance in meters
  duration: number;               // Estimated duration in seconds
}

interface NavigationStep {
  instruction: string;            // "Turn left onto Main St"
  distance: number;               // Distance to next step
  duration: number;               // Time to next step
  geometry: GeoJSON.LineString;   // Geometry for this step
  maneuver: {
    type: string;                 // "turn", "arrive", etc.
    modifier?: string;            // "left", "right", "straight"
    location: [number, number];   // [lng, lat]
  };
}
```

**UI Components:**
- Map canvas (full screen or split view)
- Sidebar with route details form
- Waypoint list with drag-to-reorder
- Route optimization button (calls Directions API)
- Preview navigation instructions
- Action buttons (Save, Publish, Delete)

---

### 3a. Turn-by-Turn Navigation for Brigade Operators

**Requirements:**
- Real-time navigation interface for drivers during Santa run
- Voice-guided turn-by-turn directions
- Current location tracking
- Next waypoint/stop information
- Rerouting if driver goes off course
- ETA updates to next stop and end of route
- Progress indicators
- Ability to mark waypoints as "completed"

**Technical Approach:**
- **Mapbox Navigation SDK for Web** or custom implementation using Directions API
- Geolocation API for continuous position tracking
- Match driver's location to route geometry
- Calculate bearing and distance to next maneuver
- Trigger instruction updates based on proximity
- Reroute using Directions API if significantly off course

**Navigation Interface Components:**

**Main Navigation View:**
```typescript
interface NavigationState {
  currentPosition: [number, number];
  currentStepIndex: number;
  distanceToNextManeuver: number;  // meters
  nextInstruction: string;         // "Turn left in 200m"
  nextWaypointIndex: number;
  distanceToNextWaypoint: number;
  etaToNextWaypoint: string;       // "Arrives at 7:45 PM"
  routeProgress: number;           // 0-100%
}
```

**UI Features:**
- **Top Banner:** Next instruction with distance ("Turn left in 200m onto Main St")
- **Map View:** 
  - Driver's location (animated Santa icon)
  - Upcoming route highlighted
  - Next waypoint emphasized
  - Completed waypoints grayed out
- **Bottom Panel:**
  - Next waypoint name and ETA
  - Distance remaining
  - Current speed
  - "Mark as Complete" button for current waypoint
- **Voice Instructions:**
  - Text-to-speech for turn warnings
  - "In 200 meters, turn left"
  - "Turn left now"
  - "Arriving at [waypoint name]"

**Navigation Logic:**
1. When brigade starts route, switch to navigation mode
2. Request location permissions
3. Load route geometry and navigation steps
4. Start location tracking (every 5 seconds or on movement)
5. Match current location to nearest point on route
6. Identify current navigation step
7. Calculate distance to next maneuver
8. Update UI with instructions
9. When within 50m of maneuver, show alert
10. When within 10m of maneuver, trigger voice instruction
11. Advance to next step when maneuver passed
12. When within 100m of waypoint, enable "Mark Complete" button
13. Update ETA based on current speed and remaining distance
14. Broadcast current location to public tracking page via Azure Web PubSub
15. If >100m off route, offer reroute option

**Rerouting:**
- Detect when driver is >100m off planned route
- Show banner: "You're off route. Reroute?"
- If user accepts, call Mapbox Directions API from current location to next unvisited waypoint
- Update route geometry and steps
- Continue navigation with new route

**Mobile Optimization:**
- Portrait mode optimized layout
- Large, touch-friendly buttons
- High contrast for outdoor visibility
- Prevent screen sleep during navigation
- Background location tracking
- Lock screen controls for audio instructions

---

### 4. Shareable Links & QR Codes
**Requirements:**
- Generate unique tracking URL per route
- QR code for physical distribution (flyers, posters)
- Copy-to-clipboard functionality
- Downloadable QR code image
- Link shows route even before it starts

**Technical Approach:**
- Route ID based URLs: `/track/{routeId}`
- QR code generation using library (qrcode.react or similar)
- QR code downloads as PNG
- Short, memorable URLs if possible

**Distribution Methods:**
- Print QR codes on flyers
- Share link via social media
- Email to community
- Brigade website embedding

---

### 5. Rich Social Media Previews
**Requirements:**
- Open Graph meta tags for Facebook, Twitter
- Dynamic preview generation per route
- Show route details in preview (name, date, brigade)
- Attractive preview image with Santa theme

**Technical Approach:**
- Dynamic meta tag injection using React 19 Native Metadata
  - React 19 automatically hoists `<title>`, `<meta>`, and `<link>` tags to document `<head>`
  - No external dependencies required (previously used React Helmet Async, removed Dec 2024)
- Meta tags per route:
  - og:title - Route name + Brigade name
  - og:description - Date, time, location details
  - og:image - Custom preview image (Santa + map)
  - og:url - Full tracking link
  - twitter:card - Summary with image
- Static fallback preview image
- Server-side rendering consideration (or static generation)

**Note:** For true dynamic previews, may need server-side rendering or static site generation. Alternative: Use a service like Cloudflare Workers or Vercel Functions to dynamically generate meta tags.

---

### 6. Real-Time Tracking System

**Requirements:**
- Public tracking page (no auth required)
- Live location updates from brigade device
- Santa icon moving on map
- Route polyline showing planned path
- Waypoints marked on map
- Current progress indicator
- ETA to next waypoint
- "Santa is on the way!" messaging

**Technical Approach:**
- **Azure Web PubSub** for real-time bidirectional communication
- Brigade device broadcasts GPS location to Web PubSub hub
- Public tracking pages subscribe to route-specific groups
- Smooth marker animation between updates
- Server-less architecture using Static Web Apps with API functions
- Connection string management via Azure Key Vault

**Azure Web PubSub Architecture:**
```
Brigade Operator (Navigator) 
    ↓ [Publishes GPS location]
Azure Web PubSub Hub (route_{routeId} group)
    ↓ [Broadcasts to subscribers]
Public Viewers (Tracking Page)
```

**Implementation:**
```typescript
// Web PubSub configuration
interface WebPubSubConfig {
  endpoint: string;  // From Azure Portal
  hubName: string;   // 'santa-tracking'
  group: string;     // 'route_{routeId}'
}

// Location broadcast message
interface LocationBroadcast {
  routeId: string;
  location: [number, number];
  timestamp: number;
  heading?: number;
  speed?: number;
  currentWaypointIndex: number;
  nextWaypointEta?: string;
}
```

**Connection Flow:**
1. Public viewer opens tracking page `/track/{routeId}`
2. Static Web App API function generates Web PubSub connection token
3. Client establishes WebSocket connection to Azure Web PubSub
4. Client joins group `route_{routeId}`
5. Brigade operator starts navigation, begins broadcasting
6. Operator's location sent to Web PubSub every 5 seconds
7. Web PubSub broadcasts to all group members
8. Viewers' maps update with new Santa position

**Location Broadcasting:**
- Brigade operator uses navigation interface
- Geolocation API for GPS position
- "Start Broadcast" button to begin location sharing
- Auto-broadcast every 5 seconds when active
- "Pause" functionality for breaks (stops broadcasting)
- "End Route" stops broadcasting and completes route

**API Functions (Serverless):**
```typescript
// /api/negotiate - Generate Web PubSub connection token
export async function negotiate(context: Context) {
  const routeId = context.req.query.routeId;
  const service = new WebPubSubServiceClient(
    process.env.WEBPUBSUB_CONNECTION_STRING,
    'santa-tracking'
  );
  
  const token = await service.getClientAccessToken({
    groups: [`route_${routeId}`],
    roles: ['webpubsub.sendToGroup', 'webpubsub.joinLeaveGroup']
  });
  
  return { url: token.url };
}

// /api/broadcast - Receive location from operator, broadcast to group
export async function broadcast(context: Context) {
  const { routeId, location, timestamp } = context.req.body;
  
  // Verify operator is authenticated
  // Store location in Azure Table Storage
  // Broadcast via Web PubSub
  
  const service = new WebPubSubServiceClient(
    process.env.WEBPUBSUB_CONNECTION_STRING,
    'santa-tracking'
  );
  
  await service.sendToGroup(`route_${routeId}`, {
    location,
    timestamp,
    // ... other data
  });
  
  return { status: 'success' };
}
```

**UI Components:**
- Full-screen map with animated Santa marker
- Route polyline and waypoints
- Progress bar showing completed waypoints
- ETA display to next waypoint
- "Santa is currently on [Street Name]" banner
- Viewer count (optional)
- Share buttons
- Mobile-optimized controls

---

### 7. Azure Static Web Apps Architecture

**Why Azure Static Web Apps?**
- Serverless hosting for static content (HTML, CSS, JS)
- Built-in API support using Azure Functions
- Automatic SSL certificates
- Global CDN distribution
- GitHub Actions integration for CI/CD
- Easy integration with Azure services
- Free tier available (100 GB bandwidth/month)
- Custom domain support
- Preview environments for pull requests

**Architecture Overview:**
```
┌─────────────────────────────────────────────┐
│     Azure Static Web App                    │
├─────────────────────────────────────────────┤
│  Frontend (React + TypeScript)              │
│  - Route planning interface                 │
│  - Navigation interface                     │
│  - Public tracking page                     │
│  - Authentication flows                     │
├─────────────────────────────────────────────┤
│  API Functions (Serverless)                 │
│  - /api/negotiate (Web PubSub tokens)       │
│  - /api/broadcast (Location updates)        │
│  - /api/routes/* (CRUD operations)          │
│  - /api/auth/* (Entra ID helpers)           │
└─────────────────────────────────────────────┘
           ↓                    ↓
    ┌──────────┐         ┌──────────────┐
    │  Azure   │         │    Azure     │
    │  Table   │         │  Web PubSub  │
    │ Storage  │         │              │
    └──────────┘         └──────────────┘
           ↓
    ┌──────────────┐
    │ Entra        │
    │ External ID  │
    └──────────────┘
```

**Project Structure:**
```
fire-santa-run/
├── src/                    # React frontend
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── utils/
├── api/                    # Azure Functions (API)
│   ├── negotiate.ts        # Web PubSub token generation
│   ├── broadcast.ts        # Location broadcasting
│   ├── routes/            # Route CRUD operations
│   │   ├── create.ts
│   │   ├── get.ts
│   │   ├── update.ts
│   │   └── delete.ts
│   └── auth/              # Authentication helpers
│       └── validate.ts
├── public/                 # Static assets
├── staticwebapp.config.json  # Azure SWA configuration
└── package.json
```

**Static Web App Configuration:**
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/dashboard/*",
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/track/*",
      "allowedRoles": ["anonymous"]
    }
  ],
  "mimeTypes": {
    ".json": "application/json"
  },
  "globalHeaders": {
    "content-security-policy": "default-src 'self' https:",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff"
  }
}
```

**Deployment:**
- Push to GitHub triggers Azure Static Web Apps deployment
- Automatic build and deployment via GitHub Actions
- Environment variables configured in Azure Portal
- Custom domain mapping via Azure DNS or external DNS
- SSL certificates automatically provisioned

---

### 8. WebSocket Architecture (Azure Web PubSub)
- "Where's Santa?" header
- Mobile-optimized controls

---

### 8. WebSocket Architecture (Azure Web PubSub)

**Requirements:**
- Real-time bidirectional communication
- Scalable to multiple concurrent routes (1000+ viewers per route)
- Graceful degradation if connection fails
- Azure-native solution for seamless integration

**Technical Approach: Azure Web PubSub**

**Why Azure Web PubSub?**
- Fully managed WebSocket service
- Native Azure integration with Static Web Apps
- Supports standard WebSocket protocol
- Built-in scaling (thousands of connections)
- Group messaging for route-specific broadcasts
- Connection lifecycle management
- Free tier: 20 concurrent connections, 20K messages/day
- Standard tier: 1,000 concurrent connections for $49/month

**Setup Steps:**
1. Create Azure Web PubSub resource in Azure Portal
2. Get connection string from Azure Portal
3. Configure in Static Web App settings
4. Implement negotiate API function
5. Client connects using generated token

**Connection Management:**
```typescript
// Client-side connection
import { WebPubSubClient } from '@azure/web-pubsub-client';

class TrackingConnection {
  private client: WebPubSubClient;
  
  async connect(routeId: string) {
    // Get token from API
    const response = await fetch(`/api/negotiate?routeId=${routeId}`);
    const { url } = await response.json();
    
    // Connect to Web PubSub
    this.client = new WebPubSubClient(url);
    
    // Join route-specific group
    await this.client.start();
    await this.client.joinGroup(`route_${routeId}`);
    
    // Listen for location updates
    this.client.on('group-message', (message) => {
      this.handleLocationUpdate(message.data);
    });
  }
  
  async broadcastLocation(location: LocationBroadcast) {
    await this.client.sendToGroup(`route_${this.routeId}`, location);
  }
  
  disconnect() {
    this.client.stop();
  }
}
```

**Fallback Strategy:**
- Primary: Azure Web PubSub WebSocket connection
- Fallback 1: Long polling via API if WebSocket fails
- Fallback 2: Client-side refresh every 10 seconds
- Show connection status indicator to users

**Cost Optimization:**
- Use free tier for development/testing
- Standard tier for production (1000 connections = $49/month)
- Implement connection pooling
- Auto-disconnect idle connections after 5 minutes
- Use groups to reduce broadcast overhead

---

### 9. Brigade Dashboard Features

#### Route Management:
- List all routes (past, present, future)
- Filter by status: Draft, Scheduled, Active, Completed
- Search routes by name/date
- Archive old routes

#### Route Actions:
- Create new route
- Edit route (before or during)
- Delete route (with confirmation)
- Duplicate route (for annual recurring routes)
- Publish/Unpublish route
- Start tracking (activate route)
- End tracking (complete route)

#### Route Details View:
- Map preview
- Waypoint list
- Shareable link + QR code
- View count/analytics (basic)
- Social media preview

---

### 10. Public Tracking Page Features

#### Before Route Starts:
- Show planned route and waypoints
- Display start time
- Countdown timer
- "Check back soon!" message
- Share buttons for social media

#### During Route (Active):
- Live Santa marker position
- Animated marker movement
- Route polyline
- Completed waypoints highlighted
- Current waypoint highlighted
- Progress percentage
- ETA to next waypoint
- Last updated timestamp
- "Santa is currently on [Street Name]"

#### After Route Ends:
- "Thanks for tracking Santa!" message
- Route summary
- Total distance/time
- Option to view other brigade routes
- Archive mode (map frozen at final position)

---

### 11. Mobile Optimization
**Requirements:**
- Responsive design for all screen sizes
- Touch-friendly map controls
- Optimized for viewing on phones (primary use case for public)
- Brigade planning interface works on tablets

**Technical Approach:**
- Mobile-first CSS design
- Mapbox touch handlers
- Bottom sheet UI for mobile waypoint list
- Hamburger menu for mobile navigation
- PWA considerations (installable app)

---

### 12. Data Model

```typescript
interface User {
  id: string;                        // Unique user identifier (UUID)
  email: string;                     // Primary email address
  name: string;                      // Display name
  entraUserId?: string;              // Microsoft Entra External ID user ID (when authenticated via Entra)
  emailVerified: boolean;            // Email verification status
  verifiedBrigades?: string[];       // Brigade IDs where user has approved admin verification (for non-.gov.au emails)
  createdAt: string;                 // ISO 8601 timestamp
  lastLoginAt?: string;              // Last login timestamp
  profilePicture?: string;           // URL or base64 encoded image
}

interface Brigade {
  id: string;                        // Unique brigade identifier (UUID)
  slug: string;                      // URL-friendly identifier (e.g., "griffith-rfs")
  name: string;                      // Official brigade name (e.g., "Griffith Rural Fire Service")
  location: string;                  // Location (e.g., "Griffith, NSW")
  rfsStationId?: number;             // Reference to RFS dataset station (for verification)
  logo?: string;                     // URL or base64 encoded logo
  themeColor?: string;               // Custom theme color (hex)
  
  // Membership Configuration
  allowedDomains: string[];          // Email domains for auto-approval (e.g., ['@griffithrfs.org.au'])
  allowedEmails: string[];           // Specific approved email addresses
  requireManualApproval: boolean;    // Require admin approval for new members
  
  // Admin Management
  adminUserIds: string[];            // Array of user IDs who are admins (min: 1, max: 2)
  
  // Status
  isClaimed: boolean;                // Whether brigade has been claimed by an admin
  claimedAt?: string;                // When brigade was first claimed
  claimedBy?: string;                // User ID of first admin who claimed it
  
  // Metadata
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  createdAt: string;                 // Brigade record creation date
  updatedAt: string;                 // Last updated timestamp
}

interface BrigadeMembership {
  id: string;                        // Unique membership identifier (UUID)
  brigadeId: string;                 // Foreign key to Brigade
  userId: string;                    // Foreign key to User
  role: 'admin' | 'operator' | 'viewer';  // User role within this brigade
  
  // Status
  status: 'pending' | 'active' | 'suspended' | 'removed';  // Membership status
  
  // Approval Tracking
  invitedBy?: string;                // User ID of member who invited this user
  invitedAt?: string;                // When invitation was sent
  approvedBy?: string;               // User ID of admin who approved membership
  approvedAt?: string;               // When membership was approved
  
  // Activity
  joinedAt?: string;                 // When user became active member
  removedAt?: string;                // When user was removed (if applicable)
  removedBy?: string;                // User ID of admin who removed this member
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface MemberInvitation {
  id: string;                        // Unique invitation identifier (UUID)
  brigadeId: string;                 // Brigade extending the invitation
  email: string;                     // Email address of invitee
  role: 'operator' | 'viewer';       // Proposed role (admin invitations handled separately)
  
  // Invitation Status
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  
  // Tracking
  invitedBy: string;                 // User ID of member who sent invitation
  invitedAt: string;                 // When invitation was sent
  expiresAt: string;                 // Invitation expiration (typically 7 days)
  acceptedAt?: string;               // When invitation was accepted
  declinedAt?: string;               // When invitation was declined
  
  // Invitation Token
  token: string;                     // Unique invitation token (for email link)
  
  // Message
  personalMessage?: string;          // Optional message from inviter
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

interface AdminVerificationRequest {
  id: string;                        // Unique verification request identifier (UUID)
  userId: string;                    // User requesting admin verification
  brigadeId: string;                 // Brigade they want to become admin of
  email: string;                     // User's email (non-.gov.au)
  
  // Evidence
  evidenceFiles: EvidenceFile[];     // Uploaded proof documents (ID, certificates, letters)
  explanation: string;               // User's explanation (50-500 characters)
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  
  // Review (Site Owner)
  reviewedBy?: string;               // Site owner user ID who reviewed
  reviewedAt?: string;               // Review timestamp
  reviewNotes?: string;              // Site owner's review notes/reason (private)
  
  // Metadata
  submittedAt: string;               // When user submitted request
  expiresAt: string;                 // Auto-expire after 30 days
  createdAt: string;
  updatedAt: string;
}

interface EvidenceFile {
  id: string;                        // Unique file identifier (UUID)
  filename: string;                  // Original filename
  contentType: string;               // MIME type: 'image/jpeg', 'image/png', 'image/heic', 'application/pdf'
  size: number;                      // File size in bytes
  url: string;                       // Azure Blob Storage URL (secured with SAS token)
  uploadedAt: string;                // Upload timestamp
}

interface SiteOwner {
  id: string;                        // Unique identifier (UUID)
  userId: string;                    // Reference to User record
  isSuperAdmin: boolean;             // Can access all system functions
  permissions: SiteOwnerPermission[]; // Granular permissions
  createdAt: string;
  createdBy: string;                 // Who granted site owner access
}

type SiteOwnerPermission = 
  | 'review_verifications'           // Review admin verification requests
  | 'manage_brigades'                // View/edit all brigades (oversight)
  | 'view_audit_logs'                // Access system audit logs
  | 'manage_site_owners'             // Add/remove other site owners
  | 'system_settings';               // Modify system-wide settings

interface Route {
  id: string;
  brigadeId: string;
  name: string; // "Christmas Eve Run 2024"
  description?: string;
  date: string; // ISO date
  startTime: string; // "18:00"
  endTime?: string;
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived';
  waypoints: Waypoint[];
  geometry: GeoJSON.LineString; // Mapbox Directions API route
  navigationSteps: NavigationStep[]; // Turn-by-turn instructions
  distance: number; // Total distance in meters
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  createdAt: string;
  createdBy: string; // User ID (references User.id)
  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;
  viewCount?: number;
  shareableLink: string;
  qrCodeUrl?: string;
}

interface Waypoint {
  id: string;
  routeId: string;
  order: number;
  coordinates: [number, number]; // [lng, lat]
  address?: string;
  name?: string; // "Town Square"
  estimatedArrival?: string;
  actualArrival?: string;
  notes?: string;
  isCompleted: boolean;
}

interface NavigationStep {
  instruction: string; // "Turn left onto Main St"
  distance: number; // Distance to next step (meters)
  duration: number; // Time to next step (seconds)
  geometry: GeoJSON.LineString; // Geometry for this step
  maneuver: {
    type: string; // "turn", "arrive", "depart", etc.
    modifier?: string; // "left", "right", "straight"
    location: [number, number]; // [lng, lat]
  };
}

interface LiveLocation {
  routeId: string;
  coordinates: [number, number];
  timestamp: number;
  heading?: number; // degrees
  speed?: number; // km/h
  accuracy?: number; // meters
  currentWaypointIndex: number;
  currentStepIndex?: number; // Current navigation step
  distanceToNextManeuver?: number; // meters
}

interface TrackingSession {
  routeId: string;
  brigadeId: string;
  operatorEmail: string;
  startedAt: number;
  isActive: boolean;
  lastUpdate: number;
  isPaused: boolean;
  pausedAt?: number;
}
```

---

### 12a. Authentication & Membership Business Rules

This section defines the comprehensive business logic for user authentication, brigade management, and membership administration in the Fire Santa Run application.

#### 1. User Registration & Email Validation

**Registration Requirements:**
- Users register with their email address and name
- Email verification required before account activation
- Passwords managed by Microsoft Entra External ID (OAuth 2.0)
- No local password storage

**Email Domain Rules:**
- **Regular members:** Can use any organizational email or personal email addresses
- **Brigade admins:** **EITHER** `.gov.au` email **OR** approved admin verification request
- **Brigade claiming:** `.gov.au` email **OR** approved admin verification request
- **Validation:** Email domain checked during registration and role promotion

**Admin Verification Pathways:**

**Pathway 1: Automatic (.gov.au email)**
- Users with `.gov.au` emails can immediately become admins
- No manual verification required
- Instant brigade claiming allowed

**Pathway 2: Manual Verification (Non-.gov.au email)**
- Users without `.gov.au` email upload evidence of brigade membership
- Evidence reviewed and approved by site owner (super admin)
- Once approved, user can claim brigade or be promoted to admin
- Required for states that don't issue government emails to volunteers

**Email Validation Logic:**
```typescript
function isGovernmentEmail(email: string): boolean {
  return email.toLowerCase().endsWith('.gov.au');
}

function hasApprovedVerification(userId: string, brigadeId: string): boolean {
  const request = getVerificationRequest(userId, brigadeId);
  return request?.status === 'approved';
}

function canBecomeAdmin(user: User, brigadeId: string): { eligible: boolean; method?: string } {
  // Method 1: Auto-verify with .gov.au email
  if (isGovernmentEmail(user.email)) {
    return { eligible: true, method: 'auto-verified' };
  }
  
  // Method 2: Check for approved verification request
  if (hasApprovedVerification(user.id, brigadeId)) {
    return { eligible: true, method: 'manually-verified' };
  }
  
  return { eligible: false };
}

function canClaimBrigade(user: User, brigadeId: string): boolean {
  const adminCheck = canBecomeAdmin(user, brigadeId);
  return adminCheck.eligible;
}
```

#### 2. Brigade Claiming Process

**Initial Brigade State:**
- Brigades can be pre-seeded from RFS dataset with `isClaimed: false`
- Unclaimed brigades exist in system but have no members
- Public can view routes from unclaimed brigades (historical data)

**Claiming Eligibility (Two Pathways):**
1. User has `.gov.au` email address (instant claiming)
2. User has approved AdminVerificationRequest for this brigade (after site owner review)

**Claiming Workflow:**
1. User with .gov.au email searches for their brigade
2. System shows unclaimed brigades from RFS dataset
3. User selects brigade and clicks "Claim Brigade"
4. System validates:
   ✅ User email ends with .gov.au
   ✅ Brigade is unclaimed (isClaimed: false)
   ✅ User is not already member of this brigade
5. If valid:
   - Set brigade.isClaimed = true
   - Set brigade.claimedAt = current timestamp
   - Set brigade.claimedBy = user.id
   - Add user.id to brigade.adminUserIds[]
   - Create BrigadeMembership with role: 'admin', status: 'active'
6. User becomes first admin of brigade
```

**Post-Claiming:**
- First admin can now invite additional members
- First admin can promote one other member to admin (brigade needs 2 admins)
- Brigade can customize settings (logo, theme, contact info)

#### 3. Brigade Admin Management

**Admin Requirements:**
- **Minimum admins:** 1 (always enforced)
- **Maximum admins:** 2 (hard limit)
- **Email requirement:** All admins MUST have .gov.au email addresses

**Admin Promotion:**
```typescript
async function promoteToAdmin(
  brigadeId: string,
  userId: string,
  promotedBy: string
): Promise<Result> {
  const brigade = await getBrigade(brigadeId);
  const user = await getUser(userId);
  const membership = await getMembership(brigadeId, userId);
  
  // Validation checks
  if (!canBecomeAdmin(user.email)) {
    return { error: 'Admin must have .gov.au email address' };
  }
  
  if (brigade.adminUserIds.length >= 2) {
    return { error: 'Brigade already has maximum 2 admins' };
  }
  
  if (membership.status !== 'active') {
    return { error: 'User must be active member' };
  }
  
  if (membership.role === 'admin') {
    return { error: 'User is already an admin' };
  }
  
  // Promote to admin
  brigade.adminUserIds.push(userId);
  membership.role = 'admin';
  
  await saveBrigade(brigade);
  await saveMembership(membership);
  
  return { success: true };
}
```

**Admin Demotion:**
```typescript
async function demoteFromAdmin(
  brigadeId: string,
  userId: string,
  demotedBy: string
): Promise<Result> {
  const brigade = await getBrigade(brigadeId);
  
  // Cannot demote if only 1 admin (would leave brigade with no admins)
  if (brigade.adminUserIds.length <= 1) {
    return { error: 'Cannot demote last admin. Brigade must have at least 1 admin.' };
  }
  
  // Cannot demote yourself if you're the last admin
  if (userId === demotedBy && brigade.adminUserIds.length === 1) {
    return { error: 'Cannot demote yourself as last admin' };
  }
  
  // Remove from admin list
  brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userId);
  
  // Update membership role
  const membership = await getMembership(brigadeId, userId);
  membership.role = 'operator'; // Demoted admins become operators
  
  await saveBrigade(brigade);
  await saveMembership(membership);
  
  return { success: true };
}
```

#### 4. Member Invitation System (Self-Service)

**Who Can Invite:**
- Any active member (admin, operator, or viewer) can invite new members
- Invitations create pending memberships that require acceptance

**Invitation Workflow:**
```
1. Existing member sends invitation to email address
2. System creates MemberInvitation record with:
   - Unique token for invitation link
   - Expiration date (7 days default)
   - Proposed role (operator or viewer)
   - Status: 'pending'
3. Email sent to invitee with invitation link
4. Invitee clicks link:
   a. If not registered: Redirect to registration, then accept invitation
   b. If registered: Show invitation details, accept/decline buttons
5. If accepted:
   - Create BrigadeMembership with status: 'pending' or 'active'
   - If brigade.requireManualApproval === true: status = 'pending' (awaits admin)
   - If brigade.requireManualApproval === false: status = 'active' (auto-approved)
6. If declined:
   - Update invitation.status = 'declined'
   - Send notification to inviter
```

**Invitation Rules:**
```typescript
interface InvitationRules {
  // General rules
  maxPendingInvitations: 10;        // Per brigade
  invitationValidityDays: 7;        // Expiration period
  
  // Role restrictions
  membersCanInvite: ['operator', 'viewer']; // Members can invite non-admins
  adminOnlyInvite: ['admin'];      // Only admins can promote to admin
  
  // Email validation
  allowDuplicateInvitations: false; // Can't invite same email twice
  allowExistingMembers: false;      // Can't invite current members
}
```

#### 5. Member Approval Workflow

**Manual Approval Process:**
- When `brigade.requireManualApproval === true`:
  1. New member joins (via invitation or self-signup)
  2. BrigadeMembership created with `status: 'pending'`
  3. All brigade admins notified of pending approval
  4. Admin reviews member details and approves/rejects
  5. If approved: `status: 'active'`, `approvedBy: adminUserId`, `approvedAt: timestamp`
  6. If rejected: Membership deleted, user notified

**Auto-Approval Rules:**
- When `brigade.requireManualApproval === false`:
  - Members matching `allowedDomains` are auto-approved
  - Members in `allowedEmails` are auto-approved
  - Others still require manual approval

**Approval Logic:**
```typescript
async function approveMembership(
  membershipId: string,
  approvedBy: string
): Promise<Result> {
  const membership = await getMembership(membershipId);
  const approver = await getUser(approvedBy);
  
  // Validate approver is admin
  const approverMembership = await getMembership(
    membership.brigadeId,
    approvedBy
  );
  
  if (approverMembership.role !== 'admin') {
    return { error: 'Only admins can approve members' };
  }
  
  // Approve membership
  membership.status = 'active';
  membership.approvedBy = approvedBy;
  membership.approvedAt = new Date().toISOString();
  membership.joinedAt = new Date().toISOString();
  
  await saveMembership(membership);
  
  // Send notification to new member
  await notifyMemberApproved(membership.userId);
  
  return { success: true };
}
```

#### 6. Member Removal

**Who Can Remove Members:**
- **Admins only** can remove members
- Admins cannot remove themselves (must have another admin demote them first)
- Removing a member does not delete their User account (they can join other brigades)

**Removal Workflow:**
```typescript
async function removeMember(
  brigadeId: string,
  userIdToRemove: string,
  removedBy: string
): Promise<Result> {
  const brigade = await getBrigade(brigadeId);
  const removerMembership = await getMembership(brigadeId, removedBy);
  const targetMembership = await getMembership(brigadeId, userIdToRemove);
  
  // Validate remover is admin
  if (removerMembership.role !== 'admin') {
    return { error: 'Only admins can remove members' };
  }
  
  // Cannot remove yourself as admin if you're the last admin
  if (userIdToRemove === removedBy) {
    if (targetMembership.role === 'admin' && brigade.adminUserIds.length === 1) {
      return { error: 'Cannot remove yourself as last admin' };
    }
  }
  
  // If removing an admin, ensure brigade still has at least 1 admin
  if (targetMembership.role === 'admin') {
    if (brigade.adminUserIds.length <= 1) {
      return { error: 'Cannot remove last admin' };
    }
    // Remove from admin list
    brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userIdToRemove);
    await saveBrigade(brigade);
  }
  
  // Update membership status
  targetMembership.status = 'removed';
  targetMembership.removedBy = removedBy;
  targetMembership.removedAt = new Date().toISOString();
  
  await saveMembership(targetMembership);
  
  // Notify removed member
  await notifyMemberRemoved(userIdToRemove, brigadeId);
  
  return { success: true };
}
```

#### 7. Member Self-Service: Leave Brigade

**Leave Workflow:**
```typescript
async function leaveBrigade(
  brigadeId: string,
  userId: string
): Promise<Result> {
  const brigade = await getBrigade(brigadeId);
  const membership = await getMembership(brigadeId, userId);
  
  // Validate membership is active
  if (membership.status !== 'active') {
    return { error: 'Membership is not active' };
  }
  
  // If user is admin, ensure brigade will still have at least 1 admin
  if (membership.role === 'admin') {
    if (brigade.adminUserIds.length <= 1) {
      return {
        error: 'Cannot leave as last admin. Promote another member to admin first.',
        requiresAdminTransfer: true
      };
    }
    
    // Remove from admin list
    brigade.adminUserIds = brigade.adminUserIds.filter(id => id !== userId);
    await saveBrigade(brigade);
  }
  
  // Update membership
  membership.status = 'removed';
  membership.removedBy = userId; // Self-removed
  membership.removedAt = new Date().toISOString();
  
  await saveMembership(membership);
  
  return { success: true };
}
```

**Admin Transfer Workflow (Before Leaving):**
- If last admin wants to leave, they must:
  1. Promote another member to admin first
  2. Then leave brigade
- UI prompts: "You're the last admin. Promote someone else to admin before leaving."

#### 8. Multi-Brigade Membership

**User Membership Rules:**
- Users can be members of **multiple brigades** simultaneously
- Each brigade membership has independent role and status
- User's role in Brigade A does not affect their role in Brigade B

**Data Model Support:**
```typescript
// User can have multiple memberships
interface UserContext {
  user: User;
  memberships: BrigadeMembership[];  // Array of memberships across brigades
  currentBrigade?: string;           // Currently active brigade context
}

// Example: User is admin in Brigade A, operator in Brigade B, viewer in Brigade C
const userMemberships = [
  { brigadeId: 'brigade-a', userId: 'user-1', role: 'admin', status: 'active' },
  { brigadeId: 'brigade-b', userId: 'user-1', role: 'operator', status: 'active' },
  { brigadeId: 'brigade-c', userId: 'user-1', role: 'viewer', status: 'active' }
];
```

**Brigade Switching:**
- User can switch between brigades via UI dropdown
- Current brigade context stored in session
- Routes, settings, and actions scoped to current brigade

#### 9. Role-Based Access Control (RBAC)

**Role Definitions:**

**Admin Role:**
- Full access to all brigade features
- Can manage routes (create, edit, delete, publish)
- Can manage members (invite, approve, remove, promote, demote)
- Can modify brigade settings (logo, theme, contact info)
- Can view analytics and statistics
- Can claim unclaimed brigades (if .gov.au email)

**Operator Role:**
- Can create and edit routes
- Can publish routes
- Can navigate routes (turn-by-turn navigation)
- Can broadcast location during Santa runs
- Can invite new members (operator or viewer roles only)
- Cannot manage brigade settings or other members

**Viewer Role:**
- Can view brigade routes
- Can view public tracking pages
- Can invite new members (viewer role only)
- Cannot create or edit routes
- Cannot navigate or broadcast
- Cannot manage settings or members

**Permission Matrix:**
| Action | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| View routes | ✅ | ✅ | ✅ |
| Create routes | ✅ | ✅ | ❌ |
| Edit routes | ✅ | ✅ | ❌ |
| Delete routes | ✅ | ✅ | ❌ |
| Publish routes | ✅ | ✅ | ❌ |
| Navigate routes | ✅ | ✅ | ❌ |
| Broadcast location | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ (non-admin) | ✅ (viewer only) |
| Approve members | ✅ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Promote to admin | ✅ | ❌ | ❌ |
| Demote from admin | ✅ | ❌ | ❌ |
| Edit brigade settings | ✅ | ❌ | ❌ |
| Claim brigade | ✅ (.gov.au only) | ❌ | ❌ |

#### 10. Additional Business Rules & Constraints

**Brigade Constraints:**
- Brigade slug must be globally unique
- Brigade name length: 3-100 characters
- Admin count: min 1, max 2 (enforced at all times)
- Cannot delete brigade if active routes exist (must archive first)

**Membership Constraints:**
- User can only have one membership per brigade
- Cannot invite yourself
- Cannot have duplicate pending invitations to same email
- Membership changes audited (who, when, why)

**Invitation Constraints:**
- Invitation expires after 7 days (configurable)
- Maximum 10 pending invitations per brigade at once
- Cancelled invitations can be resent after 24 hours

**Email Constraints:**
- Email must be valid format (RFC 5322)
- Email verification required before first login
- Government email verification: regex `/\.gov\.au$/i`

**Route Ownership:**
- All routes owned by brigade (not individual users)
- `createdBy` tracks user who created route (for audit)
- Any member with sufficient permissions can edit brigade's routes
- Deleting membership does not delete user's created routes

#### 11. Migration Considerations

**Migrating from Dev Mode:**
When transitioning from development mode (localStorage) to production (Azure + Auth):

1. **Brigade Data:**
   - Export brigade configuration from localStorage
   - Create brigade in Azure Table Storage
   - First real user with .gov.au email claims brigade
   - Existing routes migrated to claimed brigade

2. **User Data:**
   - Dev mode users (`dev@example.com`) are mock data
   - Real users register through Entra External ID
   - No migration of dev mode users to production

3. **Route Attribution:**
   - Dev mode routes have `createdBy: 'dev@example.com'`
   - Update to first admin's user ID post-migration
   - Maintain creation timestamp

**Data Validation:**
- Validate all .gov.au admin emails before production launch
- Verify brigade claiming workflow with test brigades
- Test multi-brigade membership scenarios
- Confirm admin count constraints enforced

---

### 12b. RFS Station Locations Dataset

**Integration**: The application integrates the national Rural & Country Fire Service Facilities dataset from Digital Atlas of Australia to provide comprehensive spatial reference data for brigade names, locations, and onboarding.

**Dataset Source:**
- **API**: [Digital Atlas - Rural & Country Fire Service Facilities](https://digital.atlas.gov.au/datasets/digitalatlas::rural-country-fire-service-facilities/api)
- **Type**: ArcGIS Feature Service (REST API)
- **Coverage**: All Australian states and territories (2000+ facilities)
- **License**: Open government data

**Data Model:**

```typescript
interface RFSStation {
  id: number;                      // Unique facility ID
  name: string;                    // Official facility name
  address?: string;                // Street address
  state: string;                   // AU state (NSW, VIC, QLD, etc.)
  suburb?: string;                 // Suburb/locality
  postcode?: string;               // Postcode
  coordinates: [number, number];   // [lng, lat] in WGS84
  operationalStatus?: string;      // Current status
  lastUpdated?: Date;              // Last data update
}
```

**Access Patterns:**

```typescript
// Frontend utilities (src/utils/rfsData.ts)
import { 
  getAllStations,          // Get all stations (cached)
  searchStations,          // Advanced search with filters
  findNearestStation,      // Find closest station to coordinates
  searchStationsByName,    // Search by station name
  getStationsByState,      // Filter by state
} from '@/utils/rfsData';

// Example: Find nearest station to user location
const nearest = await findNearestStation([143.5, -37.5], 50); // 50km radius

// Example: Search by name
const stations = await searchStationsByName('Griffith', 10);
```

**API Endpoint** (Production mode):

```
GET /api/rfs-stations

Query Parameters:
- state: Filter by state (NSW, VIC, etc.)
- name: Search by name (partial match)
- suburb: Filter by suburb
- postcode: Filter by postcode
- lat, lng, radius: Proximity search (radius in km)
- limit: Max results (default: 100)
```

**Caching Strategy:**

- **Development Mode**: localStorage cache (7 days)
- **Production Mode**: HTTP cache headers (24 hours)
- **Cache Size**: ~500KB-1MB for full dataset
- **Performance**: < 50ms for cached lookups, 2-5s for initial fetch

**Use Cases:**

1. **Brigade Onboarding:**
   - Suggest brigade names based on user's location
   - Pre-fill location data from official records
   - Validate brigade claims against known facilities

2. **Route Planning:**
   - Set default map center to brigade's station location
   - Show nearby stations for reference
   - Calculate distances from station to route start

3. **Brigade Discovery:**
   - Allow public to find nearby brigades
   - Display all brigades on map for region selection
   - Link to brigade's official details

4. **Data Quality:**
   - Cross-reference user input with authoritative data
   - Detect typos or incorrect brigade information
   - Maintain consistency with official records

**Implementation Status:**
- ✅ TypeScript types (`src/types/rfs.ts`)
- ✅ Frontend data utilities (`src/utils/rfsData.ts`)
- ✅ API endpoint (`api/src/rfs-stations.ts`)
- ✅ Developer documentation (`docs/RFS_DATASET.md`)
- ⏳ Integration with brigade onboarding flow (Phase 7)
- ⏳ Brigade verification workflow (Phase 7)

**Documentation:** See `docs/RFS_DATASET.md` for complete integration guide, API reference, and usage examples.

---

### 13. Application Routes (URL Structure)

```
Public Routes:
/                           - Landing page (brigade selection or info)
/track/:routeId            - Public tracking page
/brigade/:brigadeSlug      - Brigade public page (all published routes)

Protected Routes (Entra ID Auth Required):
/dashboard                  - Brigade dashboard (route list)
/dashboard/routes/new       - Create new route
/dashboard/routes/:id/edit  - Edit route (planning mode)
/dashboard/routes/:id/navigate - Navigation mode (turn-by-turn)
/dashboard/routes/:id       - View route details + controls
/dashboard/settings         - Brigade settings
/dashboard/members          - Manage brigade members
/login                      - Login redirect (Entra ID)
/logout                     - Logout and clear session
/access-request             - Request access to brigade

Admin Routes:
/admin/brigades             - Manage all brigades (super admin)
/admin/approve              - Approve pending member requests
```

---

### 14. Technology Stack

**Hosting & Infrastructure:**
- **Azure Static Web Apps** - Serverless hosting with built-in API support
- **Azure Functions** - Serverless API backend
- **Azure Table Storage** - NoSQL data persistence
- **Azure Web PubSub** - Real-time WebSocket communication
- **Azure CDN** - Global content delivery
- **Microsoft Entra External ID** - Enterprise authentication

**Frontend:**
- React 19 with TypeScript
- Vite for build tooling
- React Router v6 for routing
- **Mapbox GL JS** for mapping
- **@mapbox/mapbox-gl-draw** for route drawing
- **Mapbox Directions API** for turn-by-turn navigation
- **Mapbox Geocoding API** for address search
- **@azure/web-pubsub-client** for WebSocket connections
- **@azure/data-tables** for Azure Table Storage
- **@azure/msal-browser** for Entra ID authentication
- qrcode.react for QR code generation
- **React 19 Native Metadata** for SEO meta tags (title, Open Graph, Twitter Cards)
  - ⚠️ Previously used react-helmet-async (removed Dec 2024 due to React 19 incompatibility)
- Tailwind CSS for styling
- date-fns for date handling
- Framer Motion for animations (optional)

**Backend (Azure Functions):**
- TypeScript/Node.js runtime
- **@azure/web-pubsub** - Server SDK
- **@azure/data-tables** - Storage operations
- **@azure/identity** - Authentication

**Development Tools:**
- Azure Static Web Apps CLI for local development
- Azure Functions Core Tools
- ESLint + Prettier for code quality
- Vitest for unit testing
- Playwright for E2E testing

**State Management:**
- React Context API for global state
- Custom hooks for route management
- React Query for server state (API calls)
- Zustand for client state (optional)

---

### 15. Deployment & Hosting

**Azure Static Web Apps Architecture:**
```
┌──────────────────────────────────────────┐
│   Azure Static Web Apps                  │
│   ├── Static Files (CDN)                 │
│   ├── API Functions (Serverless)         │
│   ├── Authentication (Entra ID)          │
│   └── Custom Domains + SSL              │
└──────────────────────────────────────────┘
            ↓           ↓          ↓
    ┌───────────┐  ┌────────┐  ┌──────────┐
    │  Azure    │  │ Azure  │  │  Azure   │
    │   Table   │  │  Web   │  │ Entra    │
    │  Storage  │  │ PubSub │  │External│
    └───────────┘  └────────┘  └──────────┘
```

**Deployment Process:**
1. Push code to GitHub
2. GitHub Actions automatically triggers
3. Azure Static Web Apps builds and deploys
4. Frontend deployed to global CDN
5. API functions deployed to Azure Functions
6. Environment variables configured in Azure Portal
7. Custom domain configured (optional)

**Environment Configuration:**
- Development: `.env.local` for local testing
- Staging: Azure Static Web Apps preview environments
- Production: Azure Static Web Apps production environment

**Cost Estimate (Azure):**
- Static Web Apps Standard: $9 USD/month
- Table Storage: ~$0.50 AUD/month (100 brigades)
- Web PubSub Free tier: 20 connections, 20K messages/day
- Web PubSub Standard: $49 USD/month (1,000 connections)
- Entra External ID: Free for up to 50,000 MAU
- Total (with free Web PubSub): ~$10 USD/month
- Total (with standard Web PubSub): ~$59 USD/month

**Scaling:**
- Static Web Apps: Auto-scales globally
- Azure Functions: Auto-scales based on load
- Table Storage: Unlimited scalability
- Web PubSub: Scales to thousands of connections

---

### 15b. Development Mode vs Production Mode Strategy

#### Overview
To accelerate development and enable iterative testing of features, the application supports two distinct modes with flexible storage options:

**🛠️ Development Mode (Default during development):**
- No authentication required
- All features accessible without login
- Mock brigade context automatically provided
- **Flexible storage**: localStorage OR Azure Table Storage with 'dev' prefix
- No cloud resources required (unless using Azure option)
- Fast iteration and testing

**🔒 Production Mode (Enabled for deployment):**
- Microsoft Entra External ID authentication required
- Brigade isolation enforced
- Domain whitelist validation
- Azure Table Storage for persistence (no prefix)
- Azure Web PubSub for real-time features
- Full security controls

#### Storage Configuration Strategy (NEW!)

Development mode now supports **three storage configurations**:

##### 1. Local-Only Development (Default)
```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
# No Azure credentials
```

**Behavior:**
- Uses browser localStorage
- No Azure account required
- Data doesn't sync across devices
- Perfect for getting started quickly

##### 2. Shared Dev Environment with Azure
```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=devaccount;...
```

**Behavior:**
- Uses Azure Table Storage with 'dev' prefix
- Tables: `devroutes`, `devbrigades` (isolated from production)
- Data syncs across team members and devices
- Test real Azure integration during development
- No authentication required (still in dev mode)

**Table Naming:**
- Dev mode: `devroutes`, `devbrigades`
- Production: `routes`, `brigades`

##### 3. Production Environment
```bash
# .env.production
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.production_token
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=prodaccount;...
VITE_ENTRA_CLIENT_ID=...
```

**Behavior:**
- Uses Azure Table Storage without prefix
- Full authentication enforced
- Production-grade security
- Tables: `routes`, `brigades`

#### Storage Adapter Logic

The storage adapter automatically detects which mode to use:

```typescript
// src/storage/index.ts
// Vitest: retain direct Azure selection for adapter unit tests
// Runtime (browser): never expose Azure credentials; use HTTP API adapter
// Runtime (non-browser): prefer HTTP when no credentials, Azure when provided
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  const hasAzureCredentials = !!connectionString;
  const isVitest = Boolean(import.meta.env.VITEST);
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isVitest) {
    if (isDevMode && hasAzureCredentials) return new AzureTableStorageAdapter(connectionString, 'dev');
    if (isDevMode) return new LocalStorageAdapter();
    if (!hasAzureCredentials) throw new Error('Production mode requires Azure Storage connection string');
    return new AzureTableStorageAdapter(connectionString);
  }

  if (isBrowser) {
    if (isDevMode) return new LocalStorageAdapter();
    return new HttpStorageAdapter('/api');
  }

  if (isDevMode && hasAzureCredentials) return new AzureTableStorageAdapter(connectionString, 'dev');
  if (isDevMode) return new LocalStorageAdapter();
  if (!hasAzureCredentials) return new HttpStorageAdapter('/api');
  return new AzureTableStorageAdapter(connectionString);
}
```

#### Implementation Approach

**Environment Variable Configuration:**
```bash
# .env.local (Development)
VITE_DEV_MODE=true
VITE_MOCK_BRIGADE_ID=dev-brigade-1
VITE_MAPBOX_TOKEN=pk.your_token_here

# .env.production (Production)
VITE_DEV_MODE=false
VITE_AZURE_STORAGE_CONNECTION_STRING=...
VITE_ENTRA_CLIENT_ID=...
VITE_ENTRA_TENANT_ID=...
```

**Authentication Context Pattern:**
```typescript
// src/context/AuthContext.tsx
export const useAuth = () => {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (isDevMode) {
    // Mock authenticated user for development
    return {
      isAuthenticated: true,
      user: { email: 'dev@example.com', brigadeId: 'dev-brigade-1' },
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
    };
  }
  
  // Real authentication flow using MSAL
  return useMSALAuth();
};
```

**Route Guards Pattern:**
```typescript
// src/components/ProtectedRoute.tsx
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  // In dev mode, always allow access
  if (isDevMode) {
    return children;
  }
  
  // In production, require authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};
```

#### Benefits of This Approach

1. **Rapid Development:** Build and test features immediately without auth setup
2. **Demo-Friendly:** Showcase features to stakeholders without account setup
3. **Easier Testing:** Automated tests don't need auth mocking
4. **Progressive Enhancement:** Add security layer when features are stable
5. **No Sensitive Data:** Public tracking is inherently public, so dev mode is safe
6. **Flexible:** Easy to switch between modes for different deployment targets

#### Security Considerations

✅ **Safe for this application because:**
- No sensitive user data (names, addresses, payment info)
- Route tracking is intended to be publicly accessible
- Brigade data in dev mode is mock/test data only
- Production mode enforces full authentication before real data access

⚠️ **Important Notes:**
- Never commit real brigade credentials to dev mode
- Always verify VITE_DEV_MODE=false in production builds
- Run security audit before enabling production mode
- Test both modes thoroughly before launch

---

### 16. Implementation Phases (Revised - Authentication Moved to Phase 7)

> **🚀 Development Strategy:** Authentication has been moved to Phase 7 to enable rapid prototyping and testing of all core features without auth barriers. A development mode bypass allows full functionality during development, with production authentication added before launch.

#### Phase 1: Infrastructure & Dev Mode Setup (Week 1) - ✅ COMPLETE
- [x] Set up development environment
- [x] Initialize React + TypeScript project with Vite
- [x] Install dependencies (React Router, Mapbox, @azure/web-pubsub-client)
- [x] Create project structure (frontend + API)
- [x] **Set up development mode configuration (VITE_DEV_MODE=true)**
- [x] **Implement mock authentication context for dev mode**
- [x] Configure localStorage as primary storage adapter for development
- [x] Create mock brigade data for testing

**Deferred to Phase 7 (Production Deployment):**
- [ ] Configure GitHub Actions for CI/CD (requires Azure Static Web Apps deployment target)
- [ ] Set up Azure Static Web App resource (requires production readiness)
- [ ] Create Azure Table Storage account (requires production readiness)

#### Phase 2: Route Planning Interface (Week 1-2) - ✅ COMPLETE
- [x] Mapbox GL JS integration
- [x] Route creation interface with interactive map
- [x] Waypoint management (add/edit/delete/reorder with drag-and-drop)
- [x] Address search with Geocoding API
- [x] **Mapbox Directions API integration**
- [x] **Route optimization and navigation data generation**
- [x] Route metadata form (name, date, time, description)
- [x] LocalStorage persistence with storage adapter pattern
- [x] Brigade dashboard with route list (no auth required in dev mode)
- [x] Route editing and management UI
- [x] Route status management (draft, published, active, completed)

**Deferred to Phase 5 (Shareable Links & QR Codes):**
- [ ] QR code display in UI (generation logic complete, UI display pending)
- [ ] Route duplication feature
- [ ] Route deletion confirmation dialog (currently uses basic alert)

#### Phase 3: Turn-by-Turn Navigation (Week 2-3)
- [x] **Navigation interface design (mobile-first)**
- [x] **Geolocation API integration for current location tracking**
- [x] **Match user location to route geometry**
- [x] **Turn-by-turn instruction display with visual indicators**
- [x] **Distance and ETA calculations in real-time**
- [x] **Voice instruction system (Web Speech API text-to-speech)**
- [x] **Automatic rerouting when driver goes off course**
- [x] **Waypoint completion tracking with visual feedback**
- [x] **Mobile-optimized navigation UI (large buttons, high contrast)**
- [x] **Background location tracking with wake lock API**
- [x] **Progress indicators and route completion percentage**

#### Phase 4: Real-Time Tracking with Azure Web PubSub (Week 3-4) - ✅ COMPLETE (Dec 2024)
- [x] Create Azure Web PubSub hub resource (requires manual Azure setup)
- [x] Implement `/api/negotiate` function for connection token generation
- [x] Implement `/api/broadcast` function for location updates
- [x] Configure Web PubSub connection string in environment (.env.example updated)
- [x] Integrate @azure/web-pubsub-client in frontend
- [x] Implement route-specific group messaging (route_{routeId} groups)
- [x] Broadcast location updates from navigator device (5s throttle)
- [x] Public tracking page with WebSocket subscription (no auth required)
- [x] Live Santa marker with smooth animations
- [x] Route polyline rendering
- [x] Progress indicators showing completed waypoints
- [x] ETA display to next waypoint
- [x] Connection status indicators with reconnection logic
- [ ] Fallback to HTTP polling if WebSocket unavailable (optional enhancement)
- [x] Multi-viewer support (scalable to 1000+ concurrent viewers per route)
- [x] BroadcastChannel API for local development testing across tabs
- [x] Token scoping with appropriate permissions for viewers and broadcasters

**Implementation Summary:**
- **Backend:** Created `/api/negotiate` and `/api/broadcast` Azure Functions
- **Frontend:** Created `useWebPubSub` and `useLocationBroadcast` hooks
- **Navigation:** Integrated automatic location broadcasting in NavigationView
- **Tracking:** Created TrackingView page at `/track/:routeId` for public tracking
- **Dev Mode:** BroadcastChannel API enables local testing without Azure Web PubSub
- **Production:** Full Azure Web PubSub integration with auto-reconnection

#### Phase 5: Shareable Links & QR Codes (Week 4-5) - ✅ COMPLETE (Dec 2024)
- [x] Generate unique tracking URLs per route - ✅ COMPLETE (Already existed in routeHelpers.ts)
- [x] QR code generation with qrcode.react library - ✅ COMPLETE (Dec 2024)
- [x] QR code download as PNG image - ✅ COMPLETE (Dec 2024)
- [x] Copy-to-clipboard functionality with feedback - ✅ COMPLETE (Dec 2024)
- [x] Route publishing workflow (draft → published) - ✅ COMPLETE (Already existed)
- [x] Social media share buttons (Twitter, Facebook, WhatsApp) - ✅ COMPLETE (Dec 2024)
- [ ] Short URL generation (optional) - DEFERRED (Low priority)
- [x] Print-friendly QR code layouts for flyers - ✅ COMPLETE (Dec 2024)

**Implementation Summary:**
- **SharePanel Component**: Complete sharing interface with QR code display, link copying, and social media buttons
- **ShareModal Component**: Modal wrapper for SharePanel with backdrop and close functionality
- **Dashboard Integration**: Share button on route cards for published/active/completed routes
- **TrackingView Integration**: Share button in header for public viewers
- **QR Code Features**: 
  - High error correction level (H)
  - PNG download with branding (route name, Fire Santa Run logo)
  - Configurable sizes (150px compact, 200px standard)
  - Print-friendly layout with @media print styles
- **Copy to Clipboard**: Native Clipboard API with fallback for older browsers
- **Social Sharing**: Pre-formatted messages for Twitter, Facebook, WhatsApp with route details
- **Visual Design**: Festive Australian summer Christmas theme with Fire Red, Summer Gold colors

#### Phase 6: Social Media Previews & UX Polish (Week 5-6)
- [x] **Dynamic meta tags with React 19 Native Metadata** - ✅ COMPLETE (Dec 2024)
  - ⚠️ **MIGRATED**: Initially implemented with react-helmet-async, migrated to React 19 native metadata support (Dec 2024)
  - React 19 provides built-in document metadata hoisting without external dependencies
  - SEO component refactored to use native `<title>`, `<meta>`, and `<link>` tags
- [x] **Open Graph tags for Facebook/LinkedIn previews** - ✅ COMPLETE (Dec 2024)
- [x] **Twitter Card implementation** - ✅ COMPLETE (Dec 2024)
- [x] **Custom preview images for each route** - ✅ COMPLETE (Dec 2024)
  - [x] Default SVG social preview image created
  - [x] SEO component with dynamic meta tags per page
  - [x] TrackingView includes route-specific social meta tags
- [x] **Mobile responsive design (fully mobile-first)** - ✅ COMPLETE (Dec 2024)
- [x] **Full-screen map layouts with floating UI panels** - ✅ COMPLETE (Dec 2024)
  - [x] iOS-inspired floating panels with backdrop blur and shadows
  - [x] Route Editor: Full-screen map with floating header and sidebar
  - [x] Navigation View: Floating instruction header and bottom control panel
  - [x] Responsive bottom sheet design for mobile devices (<768px)
  - [x] Touch-friendly controls (44x44px minimum) - ✅ COMPLETE
  - [x] Screenshots and documentation in docs/current_state/
- [x] **Australian summer Christmas theme and RFS branding** - ✅ COMPLETE (existing theme)
- [x] **Loading states with skeleton screens** - ✅ COMPLETE (Dec 2024)
  - [x] Dashboard skeleton screen
  - [x] Map skeleton screen
  - [x] Route card skeletons
  - [x] Pulse animations for loading states
- [x] **Error handling with friendly messages** - ✅ COMPLETE (Dec 2024)
  - [x] Friendly error messages with retry buttons
  - [x] Emoji-enhanced error states
  - [x] Clear error descriptions
- [x] **Smooth animations with CSS transitions** - ✅ COMPLETE (Dec 2024)
  - [x] Global transition rules for interactive elements
  - [x] Hover effects on buttons and links
  - [x] Reduced motion media query support
  - [x] Focus state animations
- [x] **Accessibility improvements (WCAG 2.1 AA)** - ✅ COMPLETE (Dec 2024)
  - [x] Color contrast ratios verified (Fire Red on white: 4.5:1+)
  - [x] Keyboard navigation through floating panels
  - [x] Focus states with visible outlines (3px gold outline, 2px offset)
- [x] **Performance optimization (code splitting, lazy loading)** - ✅ COMPLETE (Dec 2024)
  - [x] React.lazy for route-based code splitting
  - [x] Suspense boundaries with loading fallbacks
  - [x] Bundle size reduced with chunking (split into 2 main chunks)
- [x] **PWA manifest and service worker (optional)** - ✅ PARTIAL (Dec 2024)
  - [x] PWA manifest.json created
  - [x] Theme color and icons configured
  - [ ] Service worker for offline support (deferred to future phase)

#### Phase 6a: Pre-Authentication Data Schema Updates (NEW - Week 6)
**🔧 Data Model Preparation for Authentication** ✅ **COMPLETED**

This phase updates all data schemas, storage adapters, and TypeScript interfaces to support the comprehensive authentication and membership management system defined in Section 12a before implementing Entra External ID authentication in Phase 7.

**Data Model Updates:** ✅
- [x] Create User interface and types (`src/types/user.ts`)
- [x] Update Brigade interface with admin management fields
  - [x] Add `adminUserIds: string[]` field
  - [x] Add `isClaimed`, `claimedAt`, `claimedBy` fields
  - [x] Rename `requireApproval` to `requireManualApproval`
  - [x] Add `rfsStationId` for RFS dataset integration
- [x] Create BrigadeMembership interface (`src/types/membership.ts`)
  - [x] Support multi-brigade membership (many-to-many)
  - [x] Add status tracking (pending, active, suspended, removed)
  - [x] Add approval workflow fields
  - [x] Add audit fields (invitedBy, approvedBy, removedBy)
- [x] Create MemberInvitation interface (`src/types/invitation.ts`)
  - [x] Invitation token generation
  - [x] Expiration tracking
  - [x] Status management
- [x] Create AdminVerificationRequest interface (`src/types/verification.ts`)
  - [x] Evidence file handling (photos, PDFs)
  - [x] Status tracking (pending, approved, rejected, expired)
  - [x] Site owner review fields
- [x] Create EvidenceFile interface for verification uploads
- [x] Create SiteOwner interface and permissions system
- [x] Update User interface
  - [x] Add `verifiedBrigades: string[]` field for tracking approved verifications
- [x] Update Route interface
  - [x] Change `createdBy` from email to user ID reference

**Storage Adapter Extensions:** ✅
- [x] Update `IStorageAdapter` interface in `src/storage/types.ts`
  - [x] Add user CRUD operations
  - [x] Add membership CRUD operations
  - [x] Add invitation CRUD operations
  - [x] Add query methods for memberships by user/brigade
- [x] Implement user operations in `LocalStorageAdapter`
  - [x] `saveUser()`, `getUser()`, `getUserByEmail()`
  - [x] `getUserMemberships()`, `getBrigadeMembers()`
- [x] Implement membership operations in `LocalStorageAdapter`
  - [x] `saveMembership()`, `getMembership()`, `deleteMembership()`
  - [x] `getMembershipsByUser()`, `getMembershipsByBrigade()`
  - [x] `getPendingMemberships()`
- [x] Implement invitation operations in `LocalStorageAdapter`
  - [x] `saveInvitation()`, `getInvitation()`, `getInvitationByToken()`
  - [x] `getPendingInvitations()`, `expireInvitations()`
- [x] Implement verification request operations in `LocalStorageAdapter`
  - [x] `saveVerificationRequest()`, `getVerificationRequest()`
  - [x] `getPendingVerifications()`, `getVerificationsByUser()`
  - [x] `approveVerification()`, `rejectVerification()`
- [x] Implement all new operations in `AzureTableStorageAdapter`
  - [x] Create `users` table schema
  - [x] Create `memberships` table schema (partition: brigadeId, row: userId)
  - [x] Create `invitations` table schema
  - [x] Create `verificationrequests` table schema
  - [x] Implement efficient queries for membership lookups
  - [ ] Set up Azure Blob Storage for evidence file uploads (deferred to Phase 7)

**Business Logic Implementation:** ✅
- [x] Create `src/utils/membershipRules.ts` with validation functions
  - [x] `canBecomeAdmin()` - Check .gov.au email OR approved verification
  - [x] `canClaimBrigade()` - Validate brigade claiming eligibility (both pathways)
  - [x] `validateAdminCount()` - Enforce 1-2 admin rule
  - [x] `canRemoveMember()` - Check admin removal constraints
  - [x] `canLeaveBrigade()` - Validate leave eligibility
  - [x] `isInvitationValid()` - Check invitation expiration and status
  - [x] `hasApprovedVerification()` - Check if user has approved verification for brigade
- [x] Create `src/utils/emailValidation.ts`
  - [x] `isGovernmentEmail()` - Regex for .gov.au validation
  - [x] `matchesAllowedDomains()` - Check domain whitelist
  - [x] `isAutoApproved()` - Check auto-approval eligibility
- [x] Create `src/utils/fileValidation.ts` for verification evidence
  - [x] `validateFileType()` - Check allowed MIME types
  - [x] `validateFileSize()` - Check size limits (5MB per file, 10MB total)
  - [x] `scanForMalware()` - Security scanning integration
- [x] Create `src/services/membershipService.ts` with core operations
  - [x] `claimBrigade()` - Brigade claiming workflow
  - [x] `inviteMember()` - Send member invitation
  - [x] `acceptInvitation()` - Process invitation acceptance
  - [x] `approveMembership()` - Admin approval workflow
  - [x] `promoteToAdmin()` - Admin promotion with validation (both pathways)
  - [x] `demoteFromAdmin()` - Admin demotion with safeguards
  - [x] `removeMember()` - Member removal with constraints
  - [x] `leaveBrigade()` - Self-service leave with admin checks
- [x] Create `src/services/verificationService.ts` for admin verification
  - [x] `submitVerificationRequest()` - User submits evidence
  - [ ] `uploadEvidenceFile()` - Upload to Azure Blob Storage (Phase 7)
  - [x] `getVerificationRequest()` - Retrieve request details
  - [ ] `reviewVerificationRequest()` - Site owner review (covered by approve/reject)
  - [x] `approveVerification()` - Site owner approval
  - [x] `rejectVerification()` - Site owner rejection
  - [ ] `expireOldRequests()` - Auto-expire after 30 days (Phase 7)

**API Endpoints (Azure Functions):** ✅
- [x] Create `/api/users/*` endpoints (`api/src/users.ts`)
  - [x] `POST /api/users/register` - User registration
  - [x] `GET /api/users/:userId` - Get user profile
  - [x] `PATCH /api/users/:userId` - Update user profile
  - [x] `GET /api/users/:userId/memberships` - Get user's brigade memberships
- [x] Create `/api/brigades/:brigadeId/members/*` endpoints (`api/src/members.ts`)
  - [x] `GET /api/brigades/:brigadeId/members` - List brigade members
  - [x] `POST /api/brigades/:brigadeId/members/invite` - Invite member
  - [x] `DELETE /api/brigades/:brigadeId/members/:userId` - Remove member
  - [x] `PATCH /api/brigades/:brigadeId/members/:userId/role` - Change role
  - [x] `GET /api/brigades/:brigadeId/members/pending` - Pending approvals
  - [x] `POST /api/brigades/:brigadeId/members/:userId/approve` - Approve member
- [x] Create `/api/brigades/:brigadeId/claim` endpoint (`api/src/claim.ts`)
  - [x] `POST /api/brigades/:brigadeId/claim` - Claim unclaimed brigade
- [x] Create `/api/invitations/*` endpoints (`api/src/invitations.ts`)
  - [x] `GET /api/invitations/:token` - Get invitation details
  - [x] `POST /api/invitations/:token/accept` - Accept invitation
  - [x] `POST /api/invitations/:token/decline` - Decline invitation
  - [x] `DELETE /api/invitations/:invitationId` - Cancel invitation
- [x] Create `/api/verification/*` endpoints for admin verification (`api/src/verification.ts`)
  - [x] `POST /api/verification/request` - Submit verification request with evidence
  - [ ] `POST /api/verification/upload` - Upload evidence file to Azure Blob Storage (Phase 7)
  - [x] `GET /api/verification/requests/:requestId` - Get request details
  - [x] `GET /api/verification/user/:userId` - Get user's verification requests
- [x] Create `/api/site-admin/verification/*` endpoints (site owner only) (`api/src/admin-verification.ts`)
  - [x] `GET /api/site-admin/verification/pending` - List pending verification requests
  - [x] `GET /api/site-admin/verification/requests/:requestId` - Get request with evidence
  - [x] `POST /api/site-admin/verification/requests/:requestId/approve` - Approve request
  - [x] `POST /api/site-admin/verification/requests/:requestId/reject` - Reject request
  - [ ] `GET /api/site-admin/verification/evidence/:fileId` - Get evidence file (SAS token) (Phase 7)

**Testing:**
- [x] Set up Vitest testing infrastructure (vitest.config.ts, test setup)
- [x] Unit tests for email validation functions (21 tests passing)
- [ ] Unit tests for file validation (types, sizes, security) (Phase 6b)
- [ ] Unit tests for membership validation rules (with verification pathway) (Phase 6b)
- [ ] Integration tests for membership service operations (Phase 6b)
- [ ] Integration tests for verification request workflow (Phase 6b)
- [ ] Test brigade claiming workflow end-to-end (both pathways) (Phase 6b)
- [ ] Test admin promotion/demotion with constraints (both pathways) (Phase 6b)
- [ ] Test member removal edge cases (Phase 6b)
- [ ] Test multi-brigade membership scenarios (Phase 6b)
- [ ] Test invitation expiration and cancellation (Phase 6b)
- [ ] Test verification request submission and file upload (Phase 7)
- [ ] Test site owner review and approval/rejection workflow (Phase 6b)
- [ ] Test verification expiration after 30 days (Phase 7)

**Documentation:** ✅
- [x] Update API documentation with new endpoints (`docs/API_PHASE_6A.md`)
- [x] Document migration path from current Brigade/Route model (`docs/MIGRATION_GUIDE.md`)
- [x] Create developer guide for membership system (`docs/MEMBERSHIP_SYSTEM.md`)
- [x] Add examples for common membership operations (included in developer guide)
- [x] Document Azure Table Storage schema design (included in API docs and migration guide)

**Dev Mode Updates:**
- [ ] Create mock user data generator for development (Phase 6b)
- [ ] Update AuthContext to provide mock user with memberships (Phase 7)
- [ ] Add dev mode UI for testing membership scenarios (Phase 7)
- [ ] Mock invitation flows for local testing (Phase 6b)

**Migration Scripts:**
- [ ] Create migration script for existing brigade data (Phase 6b)
  - [ ] Add `isClaimed: true` to existing brigades
  - [ ] Generate `adminUserIds` from current admin emails
  - [ ] Update `createdBy` references in routes
- [ ] Create seed script for RFS dataset integration (Phase 6b)
  - [ ] Import unclaimed brigades from RFS dataset
  - [ ] Set `isClaimed: false` for new brigades

**Success Criteria:**
- ✅ All TypeScript interfaces updated without breaking existing code
- ✅ Storage adapters support all new entities (users, memberships, invitations)
- ✅ All business rules documented and implemented with validation
- ✅ API endpoints created and building successfully
- ✅ Dev mode continues to work with mock data
- ✅ Migration path clearly documented
- ✅ Testing infrastructure set up with initial test suite
- 🔄 Ready for Phase 6b (additional testing, dev mode enhancements, migration scripts)
- 🔄 Ready for Phase 7 (Entra External ID integration)

#### Phase 6b: Testing & Migration Scripts (NEW - Week 6 continued)
**🧪 Complete Testing Suite & Data Migration**

This phase completes the remaining testing and migration tasks from Phase 6a.

**Testing (Deferred from 6a):**
- [ ] Unit tests for file validation
- [ ] Unit tests for membership validation rules
- [ ] Integration tests for membership service operations
- [ ] Integration tests for verification workflow
- [ ] End-to-end workflow tests

**Dev Mode Enhancements:**
- [ ] Mock user data generator
- [ ] Mock invitation flows for local testing
- [ ] Dev mode UI for membership scenarios

**Migration Scripts:**
- [ ] Brigade data migration script
- [ ] RFS dataset seeding script
- [ ] Data validation and rollback scripts

**Success Criteria:**
- All unit and integration tests passing
- Migration scripts tested and documented
- Dev mode fully functional for testing
- Ready for Phase 7 authentication integration

#### Phase 7: Authentication with Microsoft Entra External ID (Week 7-8) - 🔄 IN PROGRESS
**🔒 Production Security Implementation**

> **Prerequisites:** Phase 6a must be completed with all data models, storage adapters, and membership APIs implemented and tested.

**Phase 7A: Entra External ID Configuration Guide & MSAL Setup** ✅ **COMPLETED** (Dec 26, 2024)

**Entra External ID Setup:**
- [x] Create Azure Entra External ID tenant (Azure Portal) - **COMPLETED**
  - ✅ Tenant Name: Brigade Santa Run
  - ✅ Tenant ID: 50fcb752-2a4e-4efd-bdc2-e18a5042c5a8
  - ✅ Domain: brigadesantarun.onmicrosoft.com
- [x] Create comprehensive configuration guide (`docs/ENTRA_EXTERNAL_ID_SETUP.md`) - **COMPLETED**
  - ✅ Step-by-step app registration instructions
  - ✅ Redirect URI configuration for local dev and production
  - ✅ API permissions setup (User.Read, email, profile, openid)
  - ✅ Token configuration and optional claims
  - ✅ User flows for email authentication with OTP
  - ✅ Troubleshooting guide and security best practices
  - ✅ Authentication flow diagrams

**MSAL Integration:**
- [x] Install `@azure/msal-browser` and `@azure/msal-react` - **COMPLETED**
- [x] Create MSAL configuration (`src/auth/msalConfig.ts`) - **COMPLETED**
  - [x] Client ID from Entra app registration
  - [x] Authority URL (tenant-specific)
  - [x] Redirect URIs with fallback
  - [x] Scopes (User.Read, email, profile, openid)
  - [x] Token request configuration
  - [x] Protected resources definition
  - [x] Logging configuration (dev/prod modes)
  - [x] Configuration validation helpers
  - [x] User-friendly error message handling
- [x] Update environment variables template (`.env.example`) - **COMPLETED**
  - [x] Added Entra External ID configuration section
  - [x] Pre-filled tenant ID and authority URL
  - [x] Documentation references

**Phase 7B: Authentication Integration & Protected Routes** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Implement `MsalProvider` wrapper in `src/main.tsx` - **COMPLETED**
  - [x] Initialize MSAL instance with configuration
  - [x] Handle redirect promise for auth callbacks
  - [x] Set active account after login
  - [x] Listen to authentication events
- [x] Update `AuthContext` to use MSAL for production mode - **COMPLETED**
  - [x] `useMsal()` hook for authentication state
  - [x] `loginRedirect()` for login flow
  - [x] `logoutRedirect()` for logout flow
  - [x] Token acquisition ready for `acquireTokenSilent()`
  - [x] Handle authentication loading states
  - [x] Extract user information from Entra tokens

**Authentication UI:**
- [x] Create `/login` page with Entra sign-in button - **COMPLETED**
  - [x] Hero section with app branding
  - [x] Login card with Microsoft sign-in button
  - [x] Dev mode indicator and automatic authentication
  - [x] Error handling with user-friendly messages
  - [x] Info section highlighting features
- [x] Create `/logout` page with confirmation - **COMPLETED**
  - [x] Logout confirmation dialog
  - [x] Cancel and confirm actions
  - [x] Redirect after logout
  - [x] Dev mode simulation
- [x] Create `/auth/callback` page for OAuth redirect handling - **COMPLETED**
  - [x] Loading state during auth processing
  - [x] Error handling for auth failures
  - [x] Automatic redirect to dashboard
  - [x] Return URL support
- [x] Update routes in App.tsx - **COMPLETED**
  - [x] Added /login, /logout, /auth/callback routes
  - [x] Organized routes by authentication requirement
  - [x] Lazy load authentication pages
- [x] Implement loading states during authentication - **COMPLETED**

**Phase 7C: User Management & Brigade Claiming** 🔄 **IN PROGRESS**

**Protected Routes:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Create `ProtectedRoute` component with real authentication
  - [x] Keep dev mode bypass (`VITE_DEV_MODE=true`)
  - [x] Redirect to `/login` in production if not authenticated
  - [x] Support return URL from location state
- [x] Protect brigade dashboard routes (`/dashboard/*`)
- [x] Protect route creation/editing routes
- [x] Protect navigation view (only for brigade members)
- [x] Keep tracking view public (no auth required: `/track/:routeId`)

**User Registration & Profile:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Implement post-authentication profile creation
  - [x] Extract user info from Entra ID token (email, name)
  - [x] Create User record in database if first login
  - [x] Update `lastLoginAt` on each login
- [x] Create user profile page (`/profile`)
  - [x] Display user information
  - [x] List brigade memberships
  - [x] Link to brigade dashboards
  - [x] Allow profile updates (name)
- [x] Create `useUserProfile()` hook for profile management
  - [x] Automatic profile creation on first login
  - [x] Membership loading
  - [x] Profile updates

**Brigade Claiming Workflow (Using Phase 6a foundation):** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Create brigade claiming page (`/brigades/claim`)
  - [x] Search for unclaimed brigades from RFS dataset
  - [x] Filter brigades by state (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
  - [x] Show brigade details (name, location, station)
  - [x] "Claim Brigade" button with .gov.au email validation
  - [x] Validation and error handling
- [x] Implement `claimBrigade()` service call
  - [x] Validate user has .gov.au email OR verification approved
  - [x] Check brigade is unclaimed
  - [x] Create first admin membership
  - [x] Update brigade status to claimed
- [x] Redirect to brigade dashboard after successful claim
- [x] Show confirmation message with email validation status
- [x] Add `getBrigadeByRFSId()` to storage adapters (local and Azure)

**Member Invitation UI (Using Phase 6a APIs):** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Create member management page (`/dashboard/:brigadeId/members`)
  - [x] List current members with roles
  - [x] "Invite Member" button
  - [x] Pending invitations list
  - [x] Pending approval list (for admins)
- [x] Create invitation modal
  - [x] Email input with validation
  - [x] Role selection (operator/viewer for non-admins, admin for admins)
  - [x] Optional personal message
  - [x] Send invitation
- [x] Create invitation acceptance page (`/invitations/:token`)
  - [x] Show invitation details (brigade, inviter, role)
  - [x] Accept/Decline buttons
  - [x] Redirect to brigade dashboard on acceptance
  - [x] Handle expired invitations

**Member Approval Workflow (Using Phase 6a APIs):** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Add pending approvals section to admin dashboard
  - [x] List pending memberships with user details
  - [x] Approve/Reject buttons
  - [ ] Batch approval option (future enhancement)
- [ ] Implement approval notifications (future enhancement)
  - [ ] Email notification on approval
  - [ ] Email notification on rejection with reason
- [ ] Auto-approval based on domain whitelist (API implementation pending)
  - [ ] Check `allowedDomains` and `allowedEmails`
  - [ ] Skip manual approval if match found

**Admin Management UI (Using Phase 6a APIs):** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Add admin management section to brigade settings
  - [x] "Promote to Admin" button for members with .gov.au email
  - [x] "Demote from Admin" button (with constraints)
  - [x] Visual indicators for admin requirements (role badges)
- [x] Implement promotion validation
  - [x] Check .gov.au email requirement
  - [x] Check max 2 admins constraint
  - [x] Confirm promotion action via dialog
- [x] Implement demotion safeguards
  - [x] Prevent demoting last admin
  - [x] Confirm demotion action via dialog
  - [x] Auto-assign operator role after demotion

**Member Removal (Using Phase 6a APIs):** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Add "Remove Member" action to member list (admins only)
  - [x] Confirmation modal
  - [x] Validate admin constraints (can't remove last admin)
  - [x] Update UI after removal
- [x] Implement self-service leave
  - [x] "Leave Brigade" button in user profile
  - [x] Warning if user is last admin (must transfer first)
  - [x] Confirmation modal
  - [x] Page refresh after leaving
- [x] Cancel pending invitations functionality

**Role-Based Access Control Implementation:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Create permission checking utilities (`src/utils/permissions.ts`)
  - [x] `canManageRoutes()` - Route creation/editing permissions
  - [x] `canInviteMembers()` - Member invitation permissions
  - [x] `canManageMembers()` - Member management permissions
  - [x] `canEditBrigadeSettings()` - Brigade settings permissions
  - [x] `canPromoteToAdmin()` - Admin promotion permissions
  - [x] `canDemoteFromAdmin()` - Admin demotion permissions
  - [x] `canRemoveMember()` - Member removal permissions
  - [x] `canViewMembers()` - Member list view permissions
  - [x] `canCancelInvitation()` - Invitation cancellation permissions
  - [x] `canStartNavigation()` - Navigation start permissions
  - [x] `canApproveMembership()` - Membership approval permissions
- [x] Apply permission checks to all actions ✅ **COMPLETED** (Dec 26, 2024)
  - [x] Hide/disable UI elements based on permissions
  - [ ] Validate permissions on API endpoints (backend implementation)
  - [x] Show appropriate UI based on role
- [x] Implement role badges in UI
  - [x] Admin badge (fire red)
  - [x] Operator badge (summer gold)
  - [x] Viewer badge (neutral gray)
  - [x] Small and medium sizes
  - [x] RoleBadge component created

**API Security:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Update API functions to validate JWT tokens
  - [x] Extract user ID from token claims (oid, sub)
  - [x] Verify token signature with Entra public key (JWKS)
  - [x] Check token expiration
  - [x] JWT validation utilities (`api/src/utils/auth.ts`)
  - [x] Install required packages (jsonwebtoken, jwks-rsa)
- [x] Implement authorization checks in API endpoints
  - [x] Validate user has membership in brigade
  - [x] Check role permissions for action
  - [x] Return 403 Forbidden if unauthorized
  - [x] Routes API protected (create, update, delete)
  - [x] Members API protected (list, invite, remove, change role, approve)
- [x] Add audit logging ✅ **COMPLETED** (Dec 26, 2024)
  - [x] Comprehensive audit system (`src/utils/auditLog.ts`)
  - [x] 30+ event types covering auth, user, brigade, membership, role, route, security events
  - [x] Log authentication events (login, logout, failures)
  - [x] Log user profile events (created, updated)
  - [x] Log brigade claiming events
  - [x] Log membership changes (invite, approve, remove) - helpers ready
  - [x] Log admin actions (promote, demote, settings changes) - helpers ready
  - [x] Batch logging with queue (10 logs or 30 seconds)
  - [x] Console logging in dev mode, API endpoint for production
  - [x] Integrated in AuthContext, useUserProfile, BrigadeClaimingPage
  - [x] Authenticated user actions logged in API endpoints

**Domain Whitelist Validation:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Implement email domain checking in API
  - [x] Email validation utilities (`api/src/utils/emailValidation.ts`)
  - [x] Check against `brigade.allowedDomains`
  - [x] Check against `brigade.allowedEmails`
  - [x] Support .gov.au domain validation
- [x] Auto-approve members matching whitelist
  - [x] Auto-approve flag returned in invitation response
  - [x] Domain whitelist checked during invitation
  - [x] Client-side can implement automatic approval flow

**Session Management:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Implement token refresh logic
  - [x] Token management utilities (`src/auth/tokenManager.ts`)
  - [x] `refreshToken()` - Use `acquireTokenSilent()` for automatic refresh
  - [x] `forceRefreshToken()` - Force token refresh bypass cache
  - [x] `getAccessToken()` - Get current access token
  - [x] `isSessionValid()` - Check session validity
  - [x] Handle refresh failures (InteractionRequiredAuthError)
  - [x] Auto-refresh tokens every 30 minutes in AuthContext
  - [ ] Show session expiration warnings (optional enhancement)
- [x] Persist authentication state
  - [x] MSAL cache uses session storage automatically
  - [x] Session restored on page reload (MSAL handles)
  - [x] Clear session on logout
- [ ] Implement inactivity timeout (optional)
  - [ ] Detect user inactivity (30 min default)
  - [ ] Show timeout warning modal
  - [ ] Auto-logout after timeout

**Dev Mode Preservation:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Keep `VITE_DEV_MODE=true` bypass functional
- [x] Console audit logging in dev mode
- [x] Mock user provided automatically in dev mode
- [ ] Provide dev mode UI to simulate different roles (future enhancement)
- [ ] Allow switching between users/brigades in dev mode (future enhancement)
- [ ] Document dev mode authentication testing

**Testing:** ⏳ **DEFERRED TO PHASE 8**
- [ ] Test complete authentication flow
  - [ ] Login → Profile creation → Dashboard
  - [ ] Token refresh
  - [ ] Logout
- [ ] Test brigade claiming with .gov.au validation
- [ ] Test member invitation and acceptance flows
- [ ] Test admin promotion/demotion workflows
- [ ] Test member removal and self-service leave
- [ ] Test role-based access control
  - [ ] Verify permissions for each role
  - [ ] Test unauthorized access attempts
- [ ] Test multi-brigade switching
- [ ] Test both dev mode and production mode

**Documentation:** ✅ **COMPLETED** (Dec 26, 2024)
- [x] Update deployment guide with Entra setup instructions
  - [x] Comprehensive deployment guide (`docs/DEPLOYMENT_GUIDE.md`)
  - [x] Azure services configuration
  - [x] Environment variables reference
  - [x] CORS configuration
  - [x] Staging environment setup
- [x] Document authentication architecture
  - [x] API authentication documentation (`docs/API_AUTHENTICATION.md`)
  - [x] JWT validation flow
  - [x] Role-based access control details
  - [x] Domain whitelist explanation
  - [x] Token lifecycle management
- [x] Create admin user guide for membership management
  - [x] Comprehensive admin guide (`docs/ADMIN_USER_GUIDE.md`)
  - [x] Member invitation workflow
  - [x] Approval process
  - [x] Role management
  - [x] Admin promotion/demotion
  - [x] Domain whitelist configuration
- [x] Update API documentation with authentication requirements
  - [x] Authentication flow documented
  - [x] Authorization requirements per endpoint
  - [x] Error responses and troubleshooting
- [x] Document common authentication troubleshooting
  - [x] Troubleshooting guide (`docs/AUTHENTICATION_TROUBLESHOOTING.md`)
  - [x] Quick diagnostics
  - [x] Common authentication errors
  - [x] Authorization errors
  - [x] Token issues
  - [x] Browser issues
  - [x] Production deployment issues

**Deployment Configuration:** ⏳ **READY FOR PRODUCTION**
- [x] Set `VITE_DEV_MODE=false` for production build (documented)
- [x] Configure Entra environment variables in Azure Static Web App (documented)
  - [x] `VITE_ENTRA_CLIENT_ID` (documented)
  - [x] `VITE_ENTRA_TENANT_ID` (documented)
  - [x] `VITE_ENTRA_AUTHORITY` (documented)
  - [x] `VITE_ENTRA_REDIRECT_URI` (documented)
- [x] Update CORS configuration for Entra callbacks (documented)
- [x] Configure custom domain for production (documented, optional)
- [ ] Test authentication in staging environment (manual step)
- [ ] Enable production authentication (manual step)

**Success Criteria:**
- ✅ Users can register and login via Entra External ID
- ✅ Brigade claiming works with .gov.au validation  
- ✅ Member invitation system fully functional (UI complete, email notifications deferred)
- ✅ Admin management enforces 1-2 admin rule
- ✅ Role-based permissions enforced throughout UI
- ✅ API endpoints protected with JWT validation and authorization
- ✅ Domain whitelist for auto-approval implemented
- ✅ Multi-brigade membership works seamlessly
- ✅ Dev mode bypass still functional for development
- ✅ Member removal and self-service leave implemented
- ✅ Comprehensive documentation completed
- ⏳ All authentication flows tested (deferred to Phase 8)
- ⏳ Production deployment with authentication (manual deployment step)

#### Phase 8: Testing & Production Deployment (Week 7-8)
- [ ] Unit tests with Vitest
- [ ] Integration tests for storage adapters
- [ ] E2E tests with Playwright
- [ ] Test authentication flow (both dev and production modes)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Load testing with 1000+ concurrent viewers
- [ ] Security audit and vulnerability scan
- [ ] Performance testing (Lighthouse scores)
- [ ] User documentation (brigade operator guide)
- [ ] Technical documentation (developer guide)
- [ ] Deployment guide (Azure setup instructions)
- [ ] Production deployment with authentication enabled
- [ ] Post-launch monitoring and bug fixes

---

### 17. User Flows (Updated with Dev Mode)

#### Brigade Operator Flow - Development Mode:
1. **First time access (dev mode):**
   - Navigate to application
   - **Automatically logged in as mock user**
   - **Access dashboard immediately (no login required)**
   - **Mock brigade context provided automatically**

2. **Create route (dev mode - no auth barrier):**
   - Navigate directly to dashboard
   - Click "New Route"
   - Add route name, date, start time
   - Click on map or search addresses to add waypoints
   - Click "Optimize Route" to generate navigation
   - Review turn-by-turn instructions
   - Adjust waypoints if needed
   - Save as draft (persisted to localStorage)

3. **Publish route (dev mode):**
   - Review route details
   - Click "Publish"
   - Get shareable link + QR code
   - Download QR code for testing
   - Test sharing functionality

4. **On event day - Navigation (dev mode):**
   - Navigate to dashboard
   - Open route
   - Click "Start Navigation"
   - Grant location permissions (browser prompt)
   - **Turn-by-turn navigation begins:**
     - See next instruction ("Turn left in 200m")
     - Hear voice instructions (text-to-speech)
     - View current location on map
     - Monitor ETA to next waypoint
     - Mark waypoints as "Complete" when visited
   - **Location broadcasts via Azure Web PubSub (BroadcastChannel for dev mode)**
   - Test rerouting functionality
   - Test pause/resume navigation
   - End navigation when complete

5. **After event:**
   - Click "End Navigation"
   - Route marked as completed
   - View statistics (distance, time, viewers)
   - Test archive functionality

#### Brigade Operator Flow - Production Mode:
1. **First time access (production with auth):**
   - Navigate to application
   - Click "Login with Microsoft"
   - Authenticate via Entra External ID
   - System checks email against brigade whitelists
   - If match: Grant access to brigade
   - If no match: Show "Request Access" form
   - Admin approves access request

2. **Create route (production):**
   - Login to dashboard (authentication required)
   - Click "New Route"
   - Add route name, date, start time
   - Click on map or search addresses to add waypoints
   - Click "Optimize Route" to generate navigation
   - Review turn-by-turn instructions
   - Adjust waypoints if needed
   - Save as draft (persisted to Azure Table Storage)

3. **Publish route (production):**
   - Review route details
   - Click "Publish"
   - Get shareable link + QR code
   - Download QR code for flyers
   - Share link on social media

4. **On event day - Navigation (production):**
   - Login to dashboard
   - Open route
   - Click "Start Navigation"
   - Grant location permissions
   - **Turn-by-turn navigation begins:**
     - See next instruction ("Turn left in 200m")
     - Hear voice instructions
     - View current location on map
     - Monitor ETA to next waypoint
     - Mark waypoints as "Complete" when visited
   - **Location automatically broadcasts to public via Azure Web PubSub (group: route_{routeId})**
   - If off route: Option to reroute
   - Pause navigation for breaks
   - End navigation when complete

5. **After event:**
   - Click "End Navigation"
   - Route marked as completed
   - View statistics (distance, time, viewers)
   - Archive route

#### Public User Flow (Same for both modes):
1. Receive link or scan QR code
2. View tracking page (no auth required)
3. See planned route and start time
4. When tracking starts:
   - See Santa moving on map in real-time
   - See progress through waypoints
   - See ETA to next location
5. Share link with others
6. After event: See thank you message

---

### 18. Key Technical Decisions (Updated)

**Why Azure Static Web Apps?**
- Serverless hosting - no infrastructure management
- Built-in API support with Azure Functions
- Native Azure service integration
- Global CDN distribution
- Automatic SSL certificates
- GitHub Actions integration for CI/CD
- Preview environments for pull requests
- Cost-effective ($9/month for standard tier)
- Scales automatically based on demand

**Why Azure Table Storage?**
- NoSQL storage perfect for route and brigade data
- Extremely low cost (~$0.50/month for 100 brigades)
- Unlimited scalability
- Native Azure integration
- No schema management required
- Simple partition/row key model fits our use case
- Built-in redundancy and durability
- Easy to query and filter data

**Why Microsoft Entra External ID?**
- Enterprise-grade authentication
- Email domain validation built-in
- No password management required
- Multi-factor authentication support
- Social login providers
- OAuth 2.0 / OpenID Connect standard
- Audit logging and compliance
- Free for up to 50,000 monthly active users
- Better security than client-side password hashing

**Why Azure Web PubSub?**
- Native Azure WebSocket service
- Scales to thousands of concurrent connections
- Standard WebSocket protocol (no vendor lock-in)
- Group messaging perfect for route-specific broadcasts
- Connection lifecycle management
- Free tier for development (20 connections)
- Seamless integration with Static Web Apps
- No server to manage

**Why Mapbox Directions API for navigation?**
- Industry-leading routing algorithms
- Turn-by-turn navigation instructions
- Accurate ETAs based on real traffic data
- Rerouting capabilities
- Multiple routing profiles (driving, walking)
- Global coverage including Australia
- Well-documented API
- Generous free tier (100,000 requests/month)
- Native integration with Mapbox GL JS

---

### 19. Future Enhancements (V2+)

- **Multi-device sync:** Sync routes across devices (requires backend)
- **Route analytics:** View count, geographic distribution of viewers
- **SMS notifications:** Alert subscribers when Santa is nearby
- **Route optimization:** Suggest optimal waypoint order
- **Weather integration:** Show current weather conditions
- **Historical heatmap:** Show where Santa has visited over years
- **Sponsorship features:** Allow local businesses to sponsor waypoints
- **Community features:** Comments, photos from public
- **Brigade collaboration:** Multiple operators managing same route
- **Offline mode:** PWA with offline functionality
- **Route templates:** Pre-built route templates for common areas
- **Accessibility features:** Screen reader support, high contrast mode

---

### 20. Documentation Requirements

**For Brigades:**
- Getting started guide
- How to create a route
- How to start tracking
- Best practices for GPS accuracy
- Social media sharing tips
- Troubleshooting common issues

**For Developers:**
- Setup instructions
- Architecture overview
- Contributing guidelines
- Deployment guide
- Azure Web PubSub integration guide
- Mapbox API setup
- API function development (negotiate, broadcast)

**For Public:**
- FAQ about tracking
- Browser compatibility
- Mobile app vs web
- Privacy information

---

### 21. Security ### 20. Security & Privacy Considerations Privacy Considerations

**Brigade Data:**
- Passwords hashed (never stored plain text)
- No sensitive data in URLs
- Brigade data isolated in localStorage
- Optional: Export encrypted backups

**Public Tracking:**
- Only active route location shared
- No personal information collected
- No tracking cookies (unless analytics added)
- Clear privacy policy

**Best Practices:**
- HTTPS required for production
- Content Security Policy headers
- No inline scripts
- Regular dependency updates
- Input validation and sanitization

---

## Success Metrics

**For Brigades:**
- Easy to set up (< 10 minutes)
- Easy to create routes (< 5 minutes)
- Reliable tracking (99%+ uptime)
- Mobile-friendly admin interface

**For Public:**
- Fast page load (< 2 seconds)
- Smooth tracking updates (< 5 second latency)
- Mobile-optimized viewing
- Easy to share

**Technical:**
- Lighthouse score > 90
- Accessible (WCAG AA)
- Works on 95%+ of browsers
- Handles 1000+ concurrent viewers per route

---

## Next Steps

1. Review this plan with stakeholders
2. Prioritize features for MVP
3. Set up development environment
4. Begin Phase 1 implementation
5. Create prototype for user testing
6. Iterate based on feedback
7. Launch pilot with 1-2 brigades
8. Scale to more brigades

---

## Questions to Resolve

1. **Multiple brigades on same domain or separate?**
   - Option A: example.com/brigade/griffith-rfs
   - Option B: griffith-rfs.example.com (subdomains)
   - Recommendation: Option A (simpler)

2. **Real-time for MVP or Phase 2?**
   - Recommendation: Use Azure Web PubSub for production; BroadcastChannel API for local development

3. **Server-side rendering for meta tags?**
   - Recommendation: Use Vercel/Netlify functions for dynamic OG tags

4. **Route persistence: localStorage or database?**
   - Recommendation: localStorage for MVP, add cloud backup option later

5. **Single brigade vs multi-brigade first?**
   - Recommendation: Build multi-brigade from start (easier than retrofitting)

---

## 21. GitHub Copilot Agent Integration & Development Setup

### Overview
This section provides comprehensive instructions for GitHub Copilot development agents to fully test, develop, and deploy the application with all required cloud resources and secrets properly configured.

### Required GitHub Secrets

The following secrets must be configured in the GitHub repository Settings > Secrets and variables > Actions:

#### Mapbox Configuration
- **`VITE_MAPBOX_TOKEN`** (Required)
  - **Description:** Mapbox GL JS public access token for map rendering
  - **How to obtain:**
    1. Sign up at https://account.mapbox.com/
    2. Navigate to Access Tokens
    3. Create a new token with `styles:read` and `fonts:read` scopes
    4. Copy the token (starts with `pk.`)
  - **Example value:** `pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNsZXhhbXBsZSJ9.example_token`
  - **Note:** Mapbox telemetry is disabled (`collectResourceTiming: false`) to prevent `ERR_BLOCKED_BY_CLIENT` errors when browser extensions block analytics requests to `events.mapbox.com`. This does not affect map functionality.

#### Azure Storage Configuration
- **`AZURE_STORAGE_CONNECTION_STRING`** (Required for production)
  - **Description:** Connection string for Azure Table Storage to persist routes and brigade data
  - **Format:** `DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net`

- **`AZURE_STORAGE_ACCOUNT_NAME`** (Required for production)
  - **Description:** Azure Storage account name
  - **Example:** `santaruns` or `firesantarun`

- **`AZURE_STORAGE_ACCOUNT_KEY`** (Required for production)
  - **Description:** Azure Storage account access key (Primary or Secondary)
  - **How to obtain:** See Azure Storage setup instructions below

#### Azure Web PubSub Configuration (Required for Production)
- **`AZURE_WEBPUBSUB_CONNECTION_STRING`** (Required for production)
  - **Description:** Connection string for Azure Web PubSub service for real-time location broadcasting
  - **Format:** `Endpoint=https://<name>.webpubsub.azure.com;AccessKey=<key>;Version=1.0;`
  - **How to obtain:** 
    1. Create Azure Web PubSub resource in Azure Portal
    2. Navigate to "Keys" under Settings
    3. Copy "Connection String" from Primary or Secondary key
  - **Example:** `Endpoint=https://santa-tracking.webpubsub.azure.com;AccessKey=<key>;Version=1.0;`

- **`AZURE_WEBPUBSUB_HUB_NAME`** (Optional, defaults to 'santa-tracking')
  - **Description:** Hub name for Web PubSub service
  - **Default:** `santa-tracking`
  - **Example:** `santa-tracking` or `santa-runs-prod`

#### Deployment Configuration
- **`VERCEL_TOKEN`** (If using Vercel deployment)
  - **Description:** Vercel deployment token for CI/CD
  - **How to obtain:** Vercel Account Settings > Tokens

- **`NETLIFY_AUTH_TOKEN`** (If using Netlify deployment)
  - **Description:** Netlify deployment token for CI/CD
  - **How to obtain:** Netlify User Settings > Applications > Personal Access Tokens

### Environment Variables File Structure

Create a `.env.example` file in the repository root:

```bash
# Mapbox Configuration (Required)
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Azure Storage Configuration (Production)
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string_here
VITE_AZURE_STORAGE_ACCOUNT_NAME=your_account_name

# Azure Web PubSub Configuration (Production Real-time)
AZURE_WEBPUBSUB_CONNECTION_STRING=Endpoint=https://your-hub.webpubsub.azure.com;AccessKey=your_key;Version=1.0;
AZURE_WEBPUBSUB_HUB_NAME=santa-tracking

# Development Mode Configuration
VITE_DEV_MODE=true

# Application Configuration
VITE_APP_NAME="Fire Santa Run"
VITE_APP_URL=https://your-domain.com
```

Create a `.env.local` file for local development (add to `.gitignore`):
```bash
# Copy .env.example to .env.local and fill in your actual values
# This file should NEVER be committed to git
```

---

## 22. Azure Storage Setup Instructions

### Prerequisites
- Azure account (free tier available: https://azure.microsoft.com/free/)
- Azure CLI installed (optional but recommended)

### Step 1: Create Azure Storage Account

#### Option A: Using Azure Portal (Web UI)

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com/
   - Sign in with your Microsoft account

2. **Create Storage Account**
   - Click "Create a resource"
   - Search for "Storage account"
   - Click "Create"

3. **Configure Storage Account**
   - **Subscription:** Select your subscription
   - **Resource Group:** Create new or select existing (e.g., `rg-santa-run`)
   - **Storage account name:** Enter unique name (e.g., `santarunsstorage`)
     - Must be 3-24 characters, lowercase letters and numbers only
     - Must be globally unique across all Azure
   - **Region:** Select closest to your users (e.g., `Australia East`, `Australia Southeast`)
   - **Performance:** Standard (sufficient for this application)
   - **Redundancy:** LRS (Locally-redundant storage) for development, GRS for production
   - Click "Review + Create" then "Create"

4. **Get Connection String**
   - Navigate to your storage account
   - Go to "Access keys" under Security + networking
   - Copy "Connection string" from Key1 or Key2
   - This is your `AZURE_STORAGE_CONNECTION_STRING`

#### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="rg-santa-run"
STORAGE_ACCOUNT="santarunsstorage"
LOCATION="australiaeast"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv

# Get account key
az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "[0].value" \
  --output tsv
```

### Step 2: Create Required Tables

The application requires the following Azure Table Storage tables:

1. **`brigades`** - Stores brigade information and credentials
   - Partition Key: `brigade_id`
   - Row Key: `metadata`
   - Columns: name, slug, passwordHash, location, logo, themeColor, contact, createdAt

2. **`routes`** - Stores all Santa run routes
   - Partition Key: `brigade_id`
   - Row Key: `route_id`
   - Columns: name, description, date, startTime, status, waypoints (JSON), shareableLink, qrCodeUrl, createdAt, publishedAt, startedAt, completedAt

3. **`waypoints`** - Stores individual waypoints (optional, can be embedded in routes)
   - Partition Key: `route_id`
   - Row Key: `waypoint_id`
   - Columns: order, coordinates (JSON), address, name, estimatedArrival, actualArrival, isCompleted

4. **`tracking_sessions`** - Stores active tracking sessions
   - Partition Key: `route_id`
   - Row Key: `session_id`
   - Columns: brigadeId, startedAt, isActive, lastUpdate, currentLocation (JSON)

#### Create Tables via Azure Portal
1. Navigate to your Storage Account
2. Go to "Storage browser" > "Tables"
3. Click "+ Table"
4. Enter table name (e.g., `brigades`)
5. Repeat for all required tables

#### Create Tables via Azure CLI
```bash
STORAGE_ACCOUNT="santarunsstorage"
CONNECTION_STRING="your_connection_string_here"

# Create tables
az storage table create --name brigades --connection-string "$CONNECTION_STRING"
az storage table create --name routes --connection-string "$CONNECTION_STRING"
az storage table create --name waypoints --connection-string "$CONNECTION_STRING"
az storage table create --name trackingsessions --connection-string "$CONNECTION_STRING"
```

### Step 3: Configure CORS for Azure Storage

To allow the web application to access Azure Storage from the browser:

#### Via Azure Portal
1. Navigate to Storage Account > Settings > Resource sharing (CORS)
2. Select "Table service"
3. Add CORS rule:
   - **Allowed origins:** `https://your-domain.com` (or `*` for development)
   - **Allowed methods:** GET, POST, PUT, DELETE, OPTIONS
   - **Allowed headers:** `*`
   - **Exposed headers:** `*`
   - **Max age:** 3600
4. Click "Save"

#### Via Azure CLI
```bash
az storage cors add \
  --services t \
  --methods GET POST PUT DELETE OPTIONS \
  --origins "https://your-domain.com" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name $STORAGE_ACCOUNT
```

### Step 4: Set Up Shared Access Signature (SAS) (Optional)

For enhanced security, use SAS tokens instead of connection strings:

```bash
# Generate SAS token for table service
az storage account generate-sas \
  --account-name $STORAGE_ACCOUNT \
  --services t \
  --resource-types sco \
  --permissions rwdlacu \
  --expiry 2025-12-31T23:59:59Z \
  --https-only \
  --output tsv
```

### Step 5: Verify Setup

Test connection using Azure Storage Explorer or code:

```typescript
// Test connection in TypeScript
import { TableClient } from "@azure/data-tables";

const connectionString = process.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
const tableName = "brigades";

const tableClient = TableClient.fromConnectionString(connectionString, tableName);

// Test: List all brigades
const entities = tableClient.listEntities();
for await (const entity of entities) {
  console.log(entity);
}
```

---

## 22a. Azure Web PubSub Setup Instructions

### Prerequisites
- Azure account (same as used for Azure Storage and Static Web Apps)
- Azure CLI installed (optional but recommended)

### Step 1: Create Azure Web PubSub Resource

#### Option A: Using Azure Portal (Web UI)

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com/
   - Sign in with your Microsoft account

2. **Create Web PubSub Service**
   - Click "Create a resource"
   - Search for "Web PubSub Service"
   - Click "Create"

3. **Configure Web PubSub Service**
   - **Subscription:** Select your subscription
   - **Resource Group:** Use existing `rg-santa-run` (same as Storage)
   - **Resource name:** Enter unique name (e.g., `santa-tracking-pubsub`)
     - Must be 3-63 characters, alphanumeric and hyphens
     - Must be globally unique across Azure
   - **Region:** Select same region as storage (e.g., `Australia East`)
   - **Pricing tier:** 
     - **Free** for development (20 concurrent connections, 20K messages/day)
     - **Standard** for production (1000 connections per unit)
   - **Unit count:** 1 (for Standard tier)
   - Click "Review + Create" then "Create"

4. **Get Connection String**
   - Navigate to your Web PubSub resource
   - Go to "Keys" under Settings
   - Copy "Connection String" from Primary or Secondary
   - This is your `AZURE_WEBPUBSUB_CONNECTION_STRING`

#### Option B: Using Azure CLI

```bash
# Use existing variables from Azure Storage setup
RESOURCE_GROUP="rg-santa-run"
WEBPUBSUB_NAME="santa-tracking-pubsub"
LOCATION="australiaeast"

# Create Web PubSub service (Free tier for dev)
az webpubsub create \
  --name $WEBPUBSUB_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Free_F1

# For production, use Standard tier:
# az webpubsub create \
#   --name $WEBPUBSUB_NAME \
#   --resource-group $RESOURCE_GROUP \
#   --location $LOCATION \
#   --sku Standard_S1 \
#   --unit-count 1

# Get connection string
az webpubsub key show \
  --name $WEBPUBSUB_NAME \
  --resource-group $RESOURCE_GROUP \
  --query primaryConnectionString \
  --output tsv
```

### Step 2: Create Hub

Azure Web PubSub uses "hubs" to organize connections. Create a hub named `santa-tracking`:

#### Via Azure Portal
1. Navigate to your Web PubSub resource
2. Go to "Hubs" under Settings
3. Click "+ Hub"
4. Enter hub name: `santa-tracking`
5. Configure event handlers (optional for now)
6. Click "Save"

#### Via Azure CLI
```bash
# Hub is created automatically when first connection is made
# No explicit creation needed, but you can configure event handlers:

az webpubsub hub create \
  --name $WEBPUBSUB_NAME \
  --resource-group $RESOURCE_GROUP \
  --hub-name santa-tracking
```

### Step 3: Verify Setup and Test Connection

Test connection using the Web PubSub client SDK:

```typescript
// Test connection in TypeScript (frontend)
import { WebPubSubClient } from '@azure/web-pubsub-client';

// Get connection URL from negotiate endpoint
const response = await fetch('/api/negotiate?routeId=test-route');
const { url } = await response.json();

// Connect to Web PubSub
const client = new WebPubSubClient(url);

await client.start();
console.log('Connected to Azure Web PubSub ✓');

// Join a group
await client.joinGroup('route_test-route');
console.log('Joined group successfully ✓');

// Test sending a message
await client.sendToGroup('route_test-route', { type: 'test', message: 'Hello' });

// Listen for messages
client.on('group-message', (message) => {
  console.log('Received:', message.data);
});

// Cleanup
await client.stop();
```

### Step 4: Implement API Functions

Create Azure Functions for token negotiation and broadcasting:

#### `/api/negotiate` Function

```typescript
// api/negotiate.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { WebPubSubServiceClient } from "@azure/web-pubsub";

const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING!;
const hubName = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa-tracking';

export async function negotiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const routeId = request.query.get('routeId');
  
  if (!routeId) {
    return { status: 400, body: 'routeId query parameter required' };
  }
  
  const serviceClient = new WebPubSubServiceClient(connectionString, hubName);
  
  // Generate token with permissions to join specific route group
  const token = await serviceClient.getClientAccessToken({
    userId: `viewer-${Date.now()}`, // Unique viewer ID
    roles: [`webpubsub.joinLeaveGroup.route_${routeId}`],
    groups: [`route_${routeId}`],
    expirationTimeInMinutes: 60, // Token valid for 1 hour
  });
  
  return {
    status: 200,
    jsonBody: {
      url: token.url,
    },
  };
}

app.http('negotiate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: negotiate,
});
```

#### `/api/broadcast` Function

```typescript
// api/broadcast.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { WebPubSubServiceClient } from "@azure/web-pubsub";

const connectionString = process.env.AZURE_WEBPUBSUB_CONNECTION_STRING!;
const hubName = process.env.AZURE_WEBPUBSUB_HUB_NAME || 'santa-tracking';

export async function broadcast(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const body = await request.json() as any;
  const { routeId, location, timestamp, heading, speed, currentWaypointIndex } = body;
  
  if (!routeId || !location) {
    return { status: 400, body: 'routeId and location required' };
  }
  
  // TODO: Verify operator is authenticated and owns this route
  
  const serviceClient = new WebPubSubServiceClient(connectionString, hubName);
  
  // Broadcast to all viewers in the route group
  await serviceClient.sendToGroup(`route_${routeId}`, {
    type: 'location-update',
    routeId,
    location,
    timestamp,
    heading,
    speed,
    currentWaypointIndex,
  });
  
  // Optionally: Store in Azure Table Storage for history
  
  return {
    status: 200,
    jsonBody: { success: true },
  };
}

app.http('broadcast', {
  methods: ['POST'],
  authLevel: 'anonymous', // TODO: Change to 'function' with authentication
  handler: broadcast,
});
```

### Acceptance Criteria for Production

**Real-time Tracking Requirements:**
1. ✅ Live tracking MUST use Azure Web PubSub with standard WebSocket protocol
2. ✅ Location broadcast throttled to maximum 5 seconds between updates
3. ✅ Token scoping to route-specific groups (route_{routeId})
4. ✅ Connection status UI with visual indicators (connected/disconnected/reconnecting)
5. ✅ Automatic reconnection logic with exponential backoff
6. ✅ Fallback to HTTP long-polling if WebSocket fails after 3 retry attempts
7. ✅ BroadcastChannel API for local development mode only
8. ✅ Support for 1000+ concurrent viewers per route (Standard tier)
9. ✅ Zero message loss during normal operation
10. ✅ Graceful degradation: show last known position if connection lost

**Development Mode Fallbacks:**
- Use BroadcastChannel API for cross-tab testing without Azure resources
- Mock location updates for testing tracking page
- Local storage for session persistence

**Security Requirements:**
- No authentication required for public viewers (read-only group access)
- Token-based authorization via /api/negotiate endpoint
- Brigade operators require authentication before broadcasting
- Group isolation prevents cross-route message leakage
- Rate limiting on broadcast endpoint (max 1 update per 5 seconds)

---

## 23. Storage Layer Architecture

### Data Persistence Strategy

The application supports a **hybrid storage approach**:

#### Development Mode (Default)
- **LocalStorage** for all data persistence
- No Azure Storage required
- Perfect for testing, demos, and development
- Data isolated to browser
- Easy to reset and test

#### Production Mode
- **Azure Table Storage** for persistent, multi-device data
- **LocalStorage** as cache/offline fallback
- Automatic sync when online
- Brigade data persists across devices
- Routes accessible from multiple operator devices

### Storage Adapter Pattern

Implement a storage adapter to switch between localStorage and Azure:

```typescript
// src/storage/StorageAdapter.ts
export interface IStorageAdapter {
  saveBrigade(brigade: Brigade): Promise<void>;
  getBrigade(brigadeId: string): Promise<Brigade | null>;
  saveRoute(route: Route): Promise<void>;
  getRoute(routeId: string): Promise<Route | null>;
  getRoutesByBrigade(brigadeId: string): Promise<Route[]>;
  deleteRoute(routeId: string): Promise<void>;
  saveTrackingSession(session: TrackingSession): Promise<void>;
  getActiveTrackingSessions(): Promise<TrackingSession[]>;
}

// src/storage/LocalStorageAdapter.ts
export class LocalStorageAdapter implements IStorageAdapter {
  // Implementation using localStorage
}

// src/storage/AzureTableStorageAdapter.ts
export class AzureTableStorageAdapter implements IStorageAdapter {
  // Implementation using @azure/data-tables
}

// src/storage/index.ts
export const storageAdapter: IStorageAdapter = 
  import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING
    ? new AzureTableStorageAdapter()
    : new LocalStorageAdapter();
```

### Azure Table Storage Schema Design

#### Brigades Table
```typescript
interface BrigadeEntity {
  partitionKey: string;  // brigade_id
  rowKey: string;        // "metadata"
  name: string;
  slug: string;
  passwordHash: string;
  location: string;
  logo?: string;
  themeColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWebsite?: string;
  createdAt: string;
  timestamp: Date;       // Azure-managed
  etag: string;          // Azure-managed for optimistic concurrency
}
```

#### Routes Table
```typescript
interface RouteEntity {
  partitionKey: string;  // brigade_id (enables efficient brigade queries)
  rowKey: string;        // route_id
  name: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;        // 'draft' | 'published' | 'active' | 'completed'
  waypoints: string;     // JSON serialized Waypoint[]
  estimatedDuration?: number;
  actualDuration?: number;
  shareableLink: string;
  qrCodeUrl?: string;
  viewCount: number;
  createdAt: string;
  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;
  timestamp: Date;
  etag: string;
}
```

### Migration from localStorage to Azure

Provide an export/import utility for brigades to migrate data:

```typescript
// src/utils/migration.ts
export async function migrateToAzure() {
  const localRoutes = getLocalStorageRoutes();
  const azureAdapter = new AzureTableStorageAdapter();
  
  for (const route of localRoutes) {
    await azureAdapter.saveRoute(route);
  }
  
  console.log(`Migrated ${localRoutes.length} routes to Azure`);
}
```

---

## 24. GitHub Actions Workflows

### Required Workflows

Create `.github/workflows/` directory with the following workflow files:

#### 1. CI/CD Pipeline (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run build
      
      - name: Run tests
        run: npm test
        if: always()

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
          VITE_AZURE_STORAGE_CONNECTION_STRING: ${{ secrets.AZURE_STORAGE_CONNECTION_STRING }}
          VITE_AZURE_STORAGE_ACCOUNT_NAME: ${{ secrets.AZURE_STORAGE_ACCOUNT_NAME }}
          AZURE_WEBPUBSUB_CONNECTION_STRING: ${{ secrets.AZURE_WEBPUBSUB_CONNECTION_STRING }}
          AZURE_WEBPUBSUB_HUB_NAME: ${{ secrets.AZURE_WEBPUBSUB_HUB_NAME }}
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        if: success()
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

#### 2. Dependency Security Scan (`.github/workflows/security.yml`)

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
        continue-on-error: true
```

#### 3. Preview Deployments (`.github/workflows/preview.yml`)

```yaml
name: Deploy Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
        run: npm run build
      
      - name: Deploy Preview to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-comment: true
```

---

## 25. Copilot Agent Instructions

### Agent Setup File

Create `.github/copilot-instructions.md`:

```markdown
# GitHub Copilot Agent Instructions for Fire Santa Run

## Project Overview
React + TypeScript web application for Australian Rural Fire Service brigades to plan and track Santa runs with real-time GPS tracking.

## Key Technologies
- React 19 + TypeScript
- Vite build system
- Mapbox GL JS for mapping and navigation (Directions API)
- Azure Table Storage for data persistence
- Azure Web PubSub for real-time tracking
- React Router for navigation

## Development Environment Setup

### Prerequisites Check
Before making changes, verify all required secrets are configured:
- `VITE_MAPBOX_TOKEN` - Required for all map functionality
- `AZURE_STORAGE_CONNECTION_STRING` - Required for production data persistence
- `AZURE_WEBPUBSUB_CONNECTION_STRING` - Required for production real-time tracking
- `AZURE_WEBPUBSUB_HUB_NAME` - Optional (defaults to 'santa-tracking')

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
- Use Azure Web PubSub for production (standard WebSocket protocol)
- BroadcastChannel API for local development and multi-tab testing
- HTTP long-polling fallback if WebSocket unavailable
- Throttle location updates (max 1 per 5 seconds)
- Token-based authentication via /api/negotiate endpoint
- Route-specific groups for isolated broadcasts (route_{routeId})

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
- Verify `AZURE_WEBPUBSUB_CONNECTION_STRING` is configured correctly
- Check `/api/negotiate` endpoint returns valid connection URL
- Check network tab for WebSocket connection to *.webpubsub.azure.com
- Ensure location permissions granted in browser
- Check firewall/proxy doesn't block WebSocket connections (port 443)
- Verify route group membership (route_{routeId})
- Test fallback to HTTP polling if WebSocket fails
- Check Azure Web PubSub service status in Azure Portal

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
```

---

## 26. Testing Guide for GitHub Copilot Agents

### Automated Testing Setup

#### Install Testing Dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

#### Configure Vitest (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});
```

#### Test Setup File (`src/test/setup.ts`)
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Mapbox GL
vi.mock('mapbox-gl', () => ({
  Map: vi.fn(),
  NavigationControl: vi.fn(),
  Marker: vi.fn(),
  Popup: vi.fn(),
}));

// Mock environment variables
process.env.VITE_MAPBOX_TOKEN = 'pk.test.token';
```

### Test Categories

#### 1. Storage Adapter Tests (`src/storage/__tests__/`)
- Test localStorage adapter CRUD operations
- Test Azure adapter CRUD operations
- Test adapter switching logic
- Test error handling and retries

#### 2. Route Management Tests (`src/utils/__tests__/`)
- Test route creation
- Test waypoint management
- Test route status transitions
- Test link generation

#### 3. Authentication Tests (`src/utils/__tests__/`)
- Test password hashing
- Test login flow
- Test session management
- Test brigade isolation

#### 4. Component Tests (`src/components/__tests__/`)
- Test map rendering (mocked)
- Test route form validation
- Test QR code generation
- Test tracking display

### Manual Testing Checklist

#### For Copilot Agents - Pre-Commit Verification
1. [ ] App builds without errors (`npm run build`)
2. [ ] No TypeScript errors (`npm run build`)
3. [ ] Linter passes (`npm run lint`)
4. [ ] All tests pass (`npm test`)
5. [ ] App runs locally (`npm run dev`)
6. [ ] Can create a brigade
7. [ ] Can create a route with waypoints
8. [ ] Can generate QR code
9. [ ] Can view tracking page
10. [ ] Mobile responsive (test at 375px width)

#### Integration Testing with Real Services
1. [ ] Mapbox maps load correctly with real token
2. [ ] Azure Table Storage operations work
3. [ ] Azure Web PubSub connection establishes via /api/negotiate
4. [ ] Location updates transmit through Web PubSub and display on tracking page
5. [ ] Route-specific group isolation works (viewers only see their route)
6. [ ] Connection resilience: automatic reconnection after network interruption
7. [ ] HTTP polling fallback activates when WebSocket unavailable
8. [ ] QR codes scan correctly on mobile devices
9. [ ] Social media previews display correctly

### CI/CD Testing

The GitHub Actions workflows will automatically run:
- Linting on every PR
- Type checking on every PR
- Unit tests on every PR
- Build verification on every PR
- Security scanning weekly
- Preview deployments for PRs
- Production deployment on main branch merge

---

## 27. Secrets Management Best Practices

### Secret Storage Hierarchy

1. **Development (Local):**
   - `.env.local` file (gitignored)
   - Never committed to repository
   - Each developer maintains their own

2. **CI/CD (GitHub Actions):**
   - GitHub Repository Secrets
   - Encrypted at rest by GitHub
   - Only accessible during workflow runs
   - Masked in logs

3. **Production (Hosting):**
   - Vercel Environment Variables
   - Netlify Environment Variables
   - Azure App Configuration
   - Separate production/staging/preview environments

### Secret Rotation Policy

- **Mapbox Tokens:** Rotate annually or if compromised
- **Azure Storage Keys:** Rotate quarterly (use Azure Key Vault for automated rotation)
- **Azure Web PubSub Keys:** Rotate semi-annually (Primary/Secondary key rollover)
- **Deployment Tokens:** Rotate when team members leave
- **Entra External ID Secrets:** Rotate annually or per compliance requirements

### Emergency Secret Revocation

If a secret is accidentally committed:
1. Immediately rotate the secret in the source service
2. Update GitHub secrets
3. Update deployment environment variables
4. Use `git filter-repo` or BFG to remove from history
5. Force push to remote (document the incident)

### Secret Validation

Add a pre-deployment validation script:

```typescript
// scripts/validate-secrets.ts
const requiredSecrets = [
  'VITE_MAPBOX_TOKEN',
  'AZURE_STORAGE_CONNECTION_STRING',
  'AZURE_WEBPUBSUB_CONNECTION_STRING',
];

const optionalSecrets = [
  'AZURE_WEBPUBSUB_HUB_NAME', // Defaults to 'santa-tracking'
];

const missingSecrets = requiredSecrets.filter(
  key => !process.env[key]
);

if (missingSecrets.length > 0) {
  console.error('Missing required secrets:', missingSecrets);
  process.exit(1);
}

console.log('All required secrets are configured ✓');
console.log('Optional secrets:', optionalSecrets.filter(key => process.env[key]).join(', '));
```

Run in CI: `ts-node scripts/validate-secrets.ts`

---

## 28. Cost Management & Resource Planning

### Azure Storage Costs (Estimated)

**Table Storage Pricing (Australia East, as of 2024):**
- Storage: $0.07 AUD per GB/month
- Transactions: $0.005 AUD per 10,000 transactions

**Estimated Monthly Costs:**
- 10 brigades, 50 routes each, 20 waypoints per route
- Storage: ~10 MB = $0.001 AUD/month
- Transactions: ~100,000 = $0.05 AUD/month
- **Total: ~$0.05 AUD/month**

**At Scale (100 brigades):**
- Storage: ~100 MB = $0.007 AUD/month
- Transactions: ~1,000,000 = $0.50 AUD/month
- **Total: ~$0.51 AUD/month**

### Azure Web PubSub Costs

**Pricing Tiers (as of 2024):**
- **Free tier:** 
  - 20 concurrent connections
  - 20,000 messages per day
  - 1 unit included
  - **Best for:** Development and testing
  
- **Standard tier:** 
  - 1,000 concurrent connections per unit
  - Unlimited messages
  - $49 USD/month per unit
  - Additional units: $49 USD/month each
  - **Best for:** Production with multiple simultaneous routes

**Scaling Strategy:**
- Start with Free tier for development
- Use 1 Standard unit for production (supports multiple routes with 1000+ viewers)
- Scale horizontally by adding units as brigade count grows
- Each route typically needs 10-100 concurrent connections (public viewers)
- Monitor connection metrics in Azure Portal to optimize unit count

### Hosting Costs

**Vercel:**
- Hobby: Free (personal projects)
- Pro: $20 USD/month per member
- **Recommendation:** Start with Hobby tier

**Netlify:**
- Starter: Free (100 GB bandwidth)
- Pro: $19 USD/month (400 GB bandwidth)
- **Recommendation:** Start with Starter tier

### Total Monthly Cost Estimate (Updated for Azure Architecture)

**Development/Testing (Free/Minimal Tiers):**
- Azure Static Web Apps Standard: $9 USD/month
- Azure Table Storage: $0.05 AUD/month
- Azure Web PubSub Free: $0 (20 connections, 20K messages/day)
- Entra External ID: $0 (free up to 50K MAU)
- Mapbox: $0 (100K API calls/month free)
- **Total: ~$9 USD/month**

**Production Setup (100 brigades, high traffic):**
- Azure Static Web Apps Standard: $9 USD/month
- Azure Table Storage: $0.51 AUD/month
- Azure Web PubSub Standard: $49 USD/month (1,000 connections)
- Entra External ID: $0 (free up to 50K MAU)
- Mapbox: $0-50 USD/month (depending on usage beyond free tier)
- **Total: ~$58-108 USD/month**

**Cost Optimization Tips:**
- Use Web PubSub Free tier during development
- Monitor Mapbox API usage to stay within free tier
- Use Static Web Apps preview environments for testing
- Implement connection pooling in Web PubSub
- Use Azure Cost Management alerts

---

## Product Roadmap Reference

**📋 For comprehensive roadmap and release planning, see [ROADMAP.md](./ROADMAP.md)**

The ROADMAP.md document provides:
- **Release 1 Summary:** Consolidated implementation achievements (Phases 1-6A)
- **Known Gaps:** Feature analysis from MISSING_FEATURES_ANALYSIS.md
- **Forward Trajectory:** 6-month roadmap with Releases 2-4
- **Issue Schedule:** GitHub issue breakdown with estimates and priorities
- **Success Metrics:** Measurable goals for each release
- **Risk Assessment:** Identified risks and mitigation strategies

---

## Summary for GitHub Copilot Agents (Updated)

### Quick Start Checklist

To make this application fully testable and deployable with new Azure architecture:

1. **Set up Azure Resources**
   - Create Azure Static Web App (Section 7)
   - Create Azure Table Storage (Section 22)
   - Create Azure Web PubSub (Section 8)
   - Configure Entra External ID tenant (Section 2)

2. **Configure GitHub Secrets** (Section 21)
   - `VITE_MAPBOX_TOKEN` - For map rendering and navigation
   - `AZURE_STORAGE_CONNECTION_STRING` - Table Storage access
   - `AZURE_WEBPUBSUB_CONNECTION_STRING` - Real-time messaging
   - `ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` - Authentication

3. **Set up Local Development**
   - Install Azure Static Web Apps CLI
   - Install Azure Functions Core Tools
   - Copy `.env.example` to `.env.local`
   - Run `npm install`
   - Run `swa start` for local development

4. **Implement Core Features** (Section 16 - Implementation Phases)
   - Phase 1: Azure infrastructure and project setup
   - Phase 2: Entra ID authentication with domain whitelisting
   - Phase 3: Route planning with Mapbox Directions API
   - Phase 4: Turn-by-turn navigation interface
   - Phase 5: Real-time tracking with Azure Web PubSub
   - Phase 6: QR codes and sharing
   - Phase 7: Social previews and UX polish
   - Phase 8: Testing and deployment

5. **Key New Features**
   - ✅ **Turn-by-turn navigation** for brigade operators (Section 3a)
   - ✅ **Mapbox Directions API** integration for route optimization
   - ✅ **Azure Static Web Apps** for hosting and API functions (Section 7)
   - ✅ **Azure Web PubSub** for real-time WebSocket communication (Section 8)
   - ✅ **Microsoft Entra External ID** for enterprise authentication (Section 2)
   - ✅ **Domain whitelisting** for brigade member verification
   - ✅ **Voice-guided navigation** with text-to-speech
   - ✅ **Automatic rerouting** when driver goes off course
   - ✅ **Waypoint completion tracking** during navigation

6. **Run Tests** (Section 26)
   - Unit tests: `npm test`
   - E2E tests: `npm run test:e2e`
   - Lint: `npm run lint`
   - Build: `npm run build`

7. **Deploy** (Section 15)
   - Push to GitHub
   - GitHub Actions automatically deploys to Azure
   - Monitor deployment in Azure Portal
   - Test in production environment

### Architecture Highlights

**Azure-Native Stack:**
- Frontend: Azure Static Web Apps (CDN-distributed React app)
- API: Azure Functions (serverless API endpoints)
- Database: Azure Table Storage (NoSQL persistence)
- Real-time: Azure Web PubSub (WebSocket service)
- Auth: Microsoft Entra External ID (OAuth 2.0)
- Navigation: Mapbox Directions API (turn-by-turn)

**Benefits:**
- Fully serverless - no infrastructure to manage
- Auto-scaling to handle traffic spikes
- Pay-per-use pricing model
- Enterprise-grade security
- Global distribution
- Integrated monitoring and logging
- DevOps-ready with GitHub Actions

