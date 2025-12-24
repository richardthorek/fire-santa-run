# Fire Santa Run - Comprehensive Master Plan

## Executive Summary
A web application for Australian Rural Fire Service (RFS) brigades to plan, publish, and track Santa runs. Each brigade gets authenticated access to create multiple routes over time, generate shareable links with QR codes, and enable real-time public tracking.

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
- Simple password-based authentication per brigade
- No complex user management (keep it simple)
- Session persistence
- Logout functionality

**Technical Approach:**
- Basic auth: brigade slug + password
- Stored as hashed credentials in local config
- Session token in sessionStorage
- Protected routes using React Router
- Public routes don't require auth (tracking pages)

**Security Considerations:**
- Client-side only (static hosting)
- Brigade passwords hashed with crypto API
- Clear instructions about security limitations
- Recommendation for strong passwords

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
- Mapbox GL JS with Draw plugin
- Click-to-add waypoints on map
- Geocoding API for address lookup (optional)
- Route polyline rendering between waypoints
- Route list with status (draft/published/completed)
- Edit mode for existing routes

**UI Components:**
- Map canvas (full screen or split view)
- Sidebar with route details form
- Waypoint list with drag-to-reorder
- Action buttons (Save, Publish, Delete)

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
- WebSocket connection for real-time updates
- Brigade device broadcasts GPS location
- Public page receives location updates
- Smooth marker animation between updates
- Fallback to polling if WebSocket unavailable
- Mock WebSocket server for demo/testing

**Location Broadcasting:**
- Brigade operator keeps tracking page open
- Geolocation API for GPS position
- Manual "Start Route" button to begin broadcasting
- Auto-broadcast every 5-10 seconds
- "Pause" functionality for breaks

**UI Components:**
- Full-screen map with Santa marker
- Route polyline and waypoints
- Progress bar or waypoint checklist
- ETA display
- "Where's Santa?" header
- Mobile-optimized controls

---

### 7. WebSocket Architecture (Simplified)
**Requirements:**
- Real-time bidirectional communication
- Scalable to multiple concurrent routes
- Graceful degradation if connection fails

**Technical Approach:**
- **For Demo/Development:** Mock WebSocket using broadcast channels or local state
- **For Production:** Recommend integration with services like:
  - Pusher (managed WebSocket service)
  - Ably
  - Socket.io with backend server
  - Firebase Realtime Database
  - Supabase Realtime

**Initial Implementation:**
- Simulated WebSocket using React Context + localStorage
- Same browser tabs can communicate via BroadcastChannel API
- Instructions for production WebSocket setup

---

### 8. Brigade Dashboard Features

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

### 9. Public Tracking Page Features

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

### 10. Mobile Optimization
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

### 11. Data Model

```typescript
interface Brigade {
  id: string;
  slug: string; // URL-friendly identifier
  name: string; // "Griffith Rural Fire Service"
  location: string; // "Griffith, NSW"
  passwordHash: string;
  logo?: string; // URL or base64
  themeColor?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  createdAt: string;
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
  estimatedDuration?: number; // minutes
  actualDuration?: number; // minutes
  createdAt: string;
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

interface LiveLocation {
  routeId: string;
  coordinates: [number, number];
  timestamp: number;
  heading?: number; // degrees
  speed?: number; // km/h
  accuracy?: number; // meters
  currentWaypointIndex: number;
}

interface TrackingSession {
  routeId: string;
  brigadeId: string;
  startedAt: number;
  isActive: boolean;
  lastUpdate: number;
}
```

---

### 12. Application Routes (URL Structure)

```
Public Routes:
/                           - Landing page (brigade selection or single brigade info)
/track/:routeId            - Public tracking page
/brigade/:brigadeSlug      - Brigade public page (all published routes)

Protected Routes (Auth Required):
/dashboard                  - Brigade dashboard (route list)
/dashboard/routes/new       - Create new route
/dashboard/routes/:id/edit  - Edit route
/dashboard/routes/:id       - View route details + controls
/dashboard/settings         - Brigade settings
/login                      - Login page
/logout                     - Logout

Admin/Setup Routes:
/setup                      - Initial brigade setup (first time)
```

---

### 13. Technology Stack

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- React Router v6 for routing
- Mapbox GL JS for mapping
- @mapbox/mapbox-gl-draw for route drawing
- qrcode.react for QR generation
- socket.io-client for WebSocket (or equivalent)
- React Helmet Async for meta tags
- Tailwind CSS or styled-components for styling
- date-fns for date handling

**State Management:**
- React Context API for global state
- Custom hooks for route management
- localStorage for persistence

**Optional Enhancements:**
- React Query for data fetching
- Zustand for state management
- Framer Motion for animations

---

### 14. Deployment & Hosting

**Static Hosting Options:**
- Vercel (recommended - supports serverless functions for meta tags)
- Netlify
- GitHub Pages
- Cloudflare Pages
- AWS S3 + CloudFront

**Real-time Backend Options:**
- Vercel Serverless Functions + Pusher
- Netlify Functions + Ably
- Firebase (Hosting + Realtime Database)
- Supabase (Hosting + Realtime + Auth)
- Custom Node.js server (Socket.io)

**Recommended Setup:**
- Frontend: Vercel (static + functions)
- Real-time: Pusher or Ably (managed service)
- Database: None (localStorage) or Firebase/Supabase for persistence

---

### 15. Implementation Phases

#### Phase 1: Foundation (Week 1)
- [x] Initialize React + TypeScript + Vite
- [x] Install dependencies
- [ ] Create project structure
- [ ] Set up routing
- [ ] Create basic layout components
- [ ] Implement theme/styling system

#### Phase 2: Authentication & Brigade Setup (Week 1)
- [ ] Brigade setup flow
- [ ] Login/logout functionality
- [ ] Protected route guards
- [ ] Brigade context provider
- [ ] Password hashing utilities

#### Phase 3: Route Planning (Week 2)
- [ ] Mapbox integration
- [ ] Route creation interface
- [ ] Waypoint management (add/edit/delete/reorder)
- [ ] Route form (name, date, time)
- [ ] Save/load routes from localStorage
- [ ] Route list dashboard

#### Phase 4: Publishing & Sharing (Week 2)
- [ ] Generate shareable links
- [ ] QR code generation and download
- [ ] Copy-to-clipboard functionality
- [ ] Route status management (draft/published)
- [ ] Route preview page

#### Phase 5: Real-Time Tracking (Week 3)
- [ ] WebSocket/real-time implementation (mock first)
- [ ] Location broadcasting from brigade device
- [ ] Public tracking page
- [ ] Live marker updates
- [ ] Progress tracking
- [ ] ETA calculations

#### Phase 6: Social Media & UX Polish (Week 3)
- [ ] Dynamic meta tags with React Helmet
- [ ] Open Graph preview optimization
- [ ] Mobile responsive design
- [ ] Loading states and error handling
- [ ] Animations and transitions
- [ ] Australian theme (colors, imagery)

#### Phase 7: Testing & Documentation (Week 4)
- [ ] End-to-end testing
- [ ] Mobile device testing
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Documentation (README, user guide)
- [ ] Deployment guide

---

### 16. User Flows

#### Brigade Admin Flow:
1. First time setup: Create brigade profile + password
2. Login to dashboard
3. Create new route:
   - Click "New Route"
   - Add route name, date, start time
   - Click on map to add waypoints
   - Reorder waypoints as needed
   - Save as draft
4. Publish route:
   - Review route details
   - Click "Publish"
   - Get shareable link + QR code
   - Download QR code
   - Share on social media
5. On event day:
   - Login to dashboard
   - Open route
   - Click "Start Tracking"
   - Keep browser open on phone/tablet in vehicle
   - GPS location auto-broadcasts
   - Monitor progress on map
6. After event:
   - Click "End Tracking"
   - Route marked as completed
   - View statistics

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

### 17. Key Technical Decisions

**Why static/client-side only?**
- Simplicity: No server maintenance
- Cost: Free hosting options
- Scalability: CDN-distributed
- Speed: Fast loading times
- Trade-off: Limited auth security, requires creative solutions for dynamic meta tags

**Why localStorage for data?**
- No backend required
- Instant read/write
- Perfect for brigade-specific data
- Easy backup/export
- Trade-off: Data loss if browser storage cleared (add export/import feature)

**Why mock WebSocket initially?**
- Prove concept without backend
- Easy local development
- Clear upgrade path to real WebSocket service
- Can use BroadcastChannel API for same-device testing

**Production WebSocket options:**
- Pusher: $49/mo for production (free tier available)
- Ably: Similar pricing
- Firebase: Generous free tier
- Supabase: Open source, free tier
- Custom: More work, more control

---

### 18. Future Enhancements (V2+)

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

### 19. Documentation Requirements

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

### 20. Security & Privacy Considerations

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

### Total Monthly Cost Estimate

**Minimal Setup (Free Tier):**
- Hosting: $0 (Vercel/Netlify free tier)
- Azure Storage: $0.05 AUD
- Real-time: $0 (Firebase free tier)
- **Total: ~$0.05 AUD/month**

**Production Setup (Paid Tiers):**
- Hosting: $20 USD (Vercel Pro)
- Azure Storage: $0.51 AUD
- Real-time: $49 USD (Pusher Pro) or $0 (Firebase free tier)
- **Total: ~$69 USD/month with Pusher, or $20 USD/month with Firebase**

---

## Summary for GitHub Copilot Agents

To make this application fully testable and deployable:

1. **Set up GitHub Secrets** (Section 21) - Configure all required tokens and keys
2. **Create Azure Storage** (Section 22) - Follow step-by-step Azure setup
3. **Implement Storage Adapters** (Section 23) - Build abstraction layer for localStorage/Azure
4. **Configure GitHub Actions** (Section 24) - Set up CI/CD pipelines
5. **Follow Copilot Instructions** (Section 25) - Use as reference for all development
6. **Run Tests** (Section 26) - Validate all changes before committing
7. **Manage Secrets Properly** (Section 27) - Never commit secrets, rotate regularly
8. **Monitor Costs** (Section 28) - Stay within budget using free tiers initially

