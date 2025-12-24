# Fire Santa Run - Comprehensive Master Plan

## Executive Summary
A web application for Australian Rural Fire Service (RFS) brigades to plan, publish, and track Santa runs. Each brigade gets authenticated access via Microsoft Entra External ID to create multiple routes over time, generate shareable links with QR codes, and enable real-time public tracking. The application runs on Azure Static Web Apps with Azure Table Storage for persistence and Azure Web PubSub for real-time communication. Brigade operators receive turn-by-turn navigation powered by Mapbox Directions API while broadcasting their location as "Santa" to the public.

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
- Dynamic meta tag injection using React Helmet or similar
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
interface Brigade {
  id: string;
  slug: string; // URL-friendly identifier
  name: string; // "Griffith Rural Fire Service"
  location: string; // "Griffith, NSW"
  logo?: string; // URL or base64
  themeColor?: string;
  allowedDomains: string[]; // ['@griffithrfs.org.au', '@rfs.nsw.gov.au']
  allowedEmails: string[]; // Specific approved emails
  requireApproval: boolean; // Manual approval for new members
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  createdAt: string;
}

interface BrigadeMember {
  id: string;
  brigadeId: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  entraUserId: string; // Microsoft Entra External ID user ID
  approvedAt?: string;
  approvedBy?: string;
}

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
  createdBy: string; // User email
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
- React Helmet Async for meta tags
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

### 16. Implementation Phases (Revised)

#### Phase 1: Azure Infrastructure Setup (Week 1)
- [ ] Create Azure Static Web App resource
- [ ] Create Azure Table Storage account
- [ ] Create Azure Web PubSub resource
- [ ] Set up Entra External ID tenant
- [ ] Configure GitHub Actions deployment
- [ ] Set up development environment
- [ ] Initialize React + TypeScript project
- [ ] Install dependencies
- [ ] Create project structure (frontend + API)
- [ ] Set up Static Web Apps CLI for local dev

#### Phase 2: Authentication with Entra External ID (Week 1-2)
- [ ] Configure Entra External ID application
- [ ] Implement MSAL authentication flow
- [ ] Create login/logout pages
- [ ] Protected route guards
- [ ] Brigade domain whitelist validation
- [ ] Member approval workflow
- [ ] Role-based access control
- [ ] Session management

#### Phase 3: Route Planning Interface (Week 2-3)
- [ ] Mapbox GL JS integration
- [ ] Route creation interface with map
- [ ] Waypoint management (add/edit/delete/reorder)
- [ ] Address search with Geocoding API
- [ ] **Mapbox Directions API integration**
- [ ] **Route optimization and navigation data generation**
- [ ] Route metadata form (name, date, time)
- [ ] Azure Table Storage persistence
- [ ] Brigade dashboard with route list
- [ ] Route editing and management

#### Phase 4: Turn-by-Turn Navigation (Week 3-4)
- [ ] **Navigation interface design**
- [ ] **Current location tracking**
- [ ] **Match location to route geometry**
- [ ] **Turn-by-turn instruction display**
- [ ] **Distance and ETA calculations**
- [ ] **Voice instruction system (text-to-speech)**
- [ ] **Rerouting when off course**
- [ ] **Waypoint completion tracking**
- [ ] **Mobile-optimized navigation UI**
- [ ] **Background location tracking**

#### Phase 5: Real-Time Tracking with Azure Web PubSub (Week 4-5)
- [ ] Azure Web PubSub integration
- [ ] Negotiate API function for token generation
- [ ] Broadcast API function for location updates
- [ ] WebSocket connection management
- [ ] Group-based messaging (route-specific)
- [ ] Public tracking page
- [ ] Live Santa marker with animations
- [ ] Progress indicators
- [ ] Connection status indicators
- [ ] Fallback to polling

#### Phase 6: Shareable Links & QR Codes (Week 5)
- [ ] Generate unique tracking URLs
- [ ] QR code generation with qrcode.react
- [ ] QR code download as PNG
- [ ] Copy-to-clipboard functionality
- [ ] Route publishing workflow
- [ ] Social media share buttons

#### Phase 7: Social Media Previews & UX Polish (Week 6)
- [ ] Dynamic meta tags with React Helmet
- [ ] Open Graph preview optimization
- [ ] Twitter Card implementation
- [ ] Mobile responsive design (mobile-first)
- [ ] Australian RFS theme and branding
- [ ] Loading states and error handling
- [ ] Smooth animations with Framer Motion
- [ ] Touch-friendly controls
- [ ] Accessibility improvements (WCAG AA)
- [ ] Performance optimization

#### Phase 8: Testing & Documentation (Week 7)
- [ ] Unit tests with Vitest
- [ ] E2E tests with Playwright
- [ ] Mobile device testing
- [ ] Cross-browser testing
- [ ] Load testing (1000+ concurrent viewers)
- [ ] Security audit
- [ ] User documentation (brigade guide)
- [ ] Technical documentation
- [ ] Deployment guide
- [ ] Production deployment

---

### 17. User Flows (Updated)

#### Brigade Operator Flow (Updated):
1. **First time access:**
   - Navigate to application
   - Click "Login with Microsoft"
   - Authenticate via Entra External ID
   - System checks email against brigade whitelists
   - If match: Grant access to brigade
   - If no match: Show "Request Access" form
   - Admin approves access request

2. **Create route:**
   - Login to dashboard
   - Click "New Route"
   - Add route name, date, start time
   - Click on map or search addresses to add waypoints
   - Click "Optimize Route" to generate navigation
   - Review turn-by-turn instructions
   - Adjust waypoints if needed
   - Save as draft

3. **Publish route:**
   - Review route details
   - Click "Publish"
   - Get shareable link + QR code
   - Download QR code for flyers
   - Share link on social media

4. **On event day (Navigation):**
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
   - **Location automatically broadcasts to public**
   - If off route: Option to reroute
   - Pause navigation for breaks
   - End navigation when complete

5. **After event:**
   - Click "End Navigation"
   - Route marked as completed
   - View statistics (distance, time, viewers)
   - Archive route

#### Public User Flow:
1. Receive link or scan QR code
2. View tracking page
3. See planned route and start time
4. When tracking starts:
   - See Santa moving on map
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
- WebSocket integration guide
- Mapbox API setup

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
   - Recommendation: Mock WebSocket in MVP, real implementation in Phase 2

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

#### Real-time Service Configuration (Choose One)
- **`PUSHER_APP_ID`**, **`PUSHER_KEY`**, **`PUSHER_SECRET`**, **`PUSHER_CLUSTER`**
  - **Description:** Pusher credentials for WebSocket real-time tracking
  - **How to obtain:** Sign up at https://pusher.com/ and create a new app

OR

- **`FIREBASE_API_KEY`**, **`FIREBASE_PROJECT_ID`**, **`FIREBASE_APP_ID`**
  - **Description:** Firebase credentials for Realtime Database
  - **How to obtain:** Create project at https://console.firebase.google.com/

OR

- **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`**
  - **Description:** Supabase credentials for real-time functionality
  - **How to obtain:** Create project at https://supabase.com/dashboard

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

# Real-time Service - Choose ONE of the following:

# Option 1: Pusher
VITE_PUSHER_KEY=your_pusher_key
VITE_PUSHER_CLUSTER=your_cluster

# Option 2: Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_app_id

# Option 3: Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

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
          VITE_PUSHER_KEY: ${{ secrets.PUSHER_KEY }}
          VITE_PUSHER_CLUSTER: ${{ secrets.PUSHER_CLUSTER }}
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
3. [ ] WebSocket connection establishes
4. [ ] Location updates transmit and display
5. [ ] QR codes scan correctly on mobile devices
6. [ ] Social media previews display correctly

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
- **WebSocket Service Keys:** Rotate semi-annually
- **Deployment Tokens:** Rotate when team members leave

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
  'VITE_AZURE_STORAGE_CONNECTION_STRING',
];

const missingSecrets = requiredSecrets.filter(
  key => !process.env[key]
);

if (missingSecrets.length > 0) {
  console.error('Missing required secrets:', missingSecrets);
  process.exit(1);
}

console.log('All required secrets are configured ✓');
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

### Real-time Service Costs

**Pusher:**
- Free tier: 200 max connections, 200k messages/day
- Pro: $49 USD/month for 500 connections
- **Recommendation:** Start with free tier

**Firebase:**
- Free tier: 50k simultaneous connections, 10 GB/month downloads
- Pay-as-you-go: Very generous free tier
- **Recommendation:** Firebase for better free tier

**Supabase:**
- Free tier: Unlimited API requests, 2 GB database, 50 MB file storage
- Pro: $25 USD/month
- **Recommendation:** Best value for open-source option

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

