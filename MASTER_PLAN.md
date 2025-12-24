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

