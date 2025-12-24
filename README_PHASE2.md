# Fire Santa Run - Phase 2 Complete! 🎅🚒

A web application for Australian Rural Fire Service brigades to plan and track Santa runs with real-time GPS tracking.

## ✅ Phase 2: Route Planning Interface - COMPLETE

Phase 2 implementation is now complete with the following features:

### Implemented Features

- ✅ **Interactive Map Integration**
  - Mapbox GL JS with custom markers
  - Click-to-add waypoints
  - Route polyline visualization
  - Automatic map bounds fitting

- ✅ **Waypoint Management**
  - Add waypoints via map click or address search
  - Drag-and-drop reordering
  - Edit waypoint names and notes
  - Delete waypoints
  - Visual waypoint numbering

- ✅ **Address Search**
  - Mapbox Geocoding API integration
  - Debounced search (500ms)
  - Australia-focused results
  - Proximity-based sorting

- ✅ **Route Optimization**
  - Mapbox Directions API integration
  - Turn-by-turn navigation generation
  - Distance and duration calculation
  - One-click route optimization

- ✅ **Route Management**
  - Dashboard with route list
  - Status filtering (draft, published, active, completed)
  - Route creation and editing
  - Save as draft or publish
  - Route validation

- ✅ **Data Persistence**
  - LocalStorage adapter for dev mode
  - Mock brigade and route data
  - Azure Table Storage adapter (ready for production)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm
- Mapbox account and API token (get one at https://account.mapbox.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/richardthorek/fire-santa-run.git
   cd fire-santa-run
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables:**
   
   Edit `.env.local` and set:
   ```bash
   VITE_DEV_MODE=true
   VITE_MAPBOX_TOKEN=pk.your_actual_mapbox_token_here
   ```
   
   **Important:** You MUST provide a real Mapbox token for the maps to work. Get one free at https://account.mapbox.com/

5. **Start development server:**
   ```bash
   npm run dev
   ```

6. **Open in browser:**
   ```
   http://localhost:5173
   ```

## 📱 Features & Usage

### Dashboard
- View all routes with status badges
- Filter routes by status (all, draft, published, active, completed)
- Quick stats: number of waypoints, distance, duration
- Click "Create New Route" to start planning

### Route Editor
1. **Add Route Details:**
   - Enter route name (required)
   - Add description
   - Set date and start time (required)

2. **Add Waypoints:**
   - Click on map to add waypoints
   - Or search for addresses using the search box
   - Drag waypoints to reorder
   - Click ✏️ to edit names/notes
   - Click 🗑️ to delete

3. **Optimize Route:**
   - Once you have 2+ waypoints, click "Optimize Route"
   - System calls Mapbox Directions API
   - Generates turn-by-turn navigation
   - Displays route polyline on map
   - Shows distance and duration

4. **Save:**
   - "Save Draft" - saves without publishing
   - "Publish" - generates shareable link (requires complete data)

## 🏗️ Project Structure

```
fire-santa-run/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── MapView.tsx      # Mapbox GL JS map component
│   │   ├── WaypointList.tsx # Drag-and-drop waypoint list
│   │   ├── AddressSearch.tsx # Geocoding search component
│   │   └── RouteStatusBadge.tsx # Status display badge
│   ├── pages/               # Page components
│   │   ├── Dashboard.tsx    # Route list and filtering
│   │   └── RouteEditor.tsx  # Create/edit route interface
│   ├── hooks/               # Custom React hooks
│   │   ├── useRoutes.ts     # Route CRUD operations
│   │   └── useRouteEditor.ts # Route editing state management
│   ├── utils/               # Utility functions
│   │   ├── mapbox.ts        # Mapbox API wrappers
│   │   ├── routeHelpers.ts  # Route manipulation utilities
│   │   └── mockData.ts      # Development mock data
│   ├── storage/             # Storage adapters
│   │   ├── localStorage.ts  # LocalStorage implementation
│   │   └── azure.ts         # Azure Table Storage (for production)
│   ├── types/               # TypeScript interfaces
│   └── context/             # React Context providers
└── MASTER_PLAN.md          # Complete project documentation
```

## 🔧 Technology Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Routing:** React Router v7
- **Maps:** Mapbox GL JS + Directions API + Geocoding API
- **Drag & Drop:** @dnd-kit/core
- **Date Handling:** date-fns
- **Styling:** Inline styles (Australian Christmas theme)

## 📋 Available Scripts

```bash
npm run dev      # Start development server (port 5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🧪 Testing the Application

### Test Route Creation Flow:

1. Open http://localhost:5173
2. You'll see the Dashboard with 2 mock routes
3. Click "Create New Route"
4. Enter route details:
   - Name: "Test Route"
   - Date: Today's date
   - Start Time: 18:00
5. Add waypoints:
   - Click on map, or
   - Search "Griffith NSW" and select results
6. Add at least 2 waypoints
7. Click "Optimize Route" button
8. Watch the route appear on map with stats
9. Click "Save Draft" or "Publish"
10. Return to Dashboard to see your route

### Test Waypoint Management:

- **Reorder:** Drag waypoints up/down using ⋮⋮ handle
- **Edit:** Click ✏️ to edit name and notes
- **Delete:** Click 🗑️ to remove waypoint

## 🎨 Design System

Colors match the Australian summer Christmas theme:
- **Fire Red:** `#D32F2F` (Primary - CTAs, active states)
- **Summer Gold:** `#FFA726` (Secondary - highlights)
- **Christmas Green:** `#43A047` (Success states)
- **Sky Blue:** `#29B6F6` (Info states)

## 📚 Key Concepts

### Development Mode
- Set `VITE_DEV_MODE=true` for local development
- Bypasses authentication
- Uses localStorage for data
- Provides mock brigade context
- Perfect for rapid prototyping

### Route Status Lifecycle
1. **Draft** - Being created/edited
2. **Published** - Shareable link generated
3. **Active** - Currently tracking (future phase)
4. **Completed** - Finished tracking
5. **Archived** - Historical record

### Storage Adapter Pattern
- Interface: `IStorageAdapter`
- Implementations:
  - `LocalStorageAdapter` (dev mode)
  - `AzureTableStorageAdapter` (production)
- Switch based on `VITE_DEV_MODE` flag

## 🚧 Known Limitations (Phase 2)

- QR code generation implemented but not yet displayed in UI
- Route duplication feature not yet implemented
- Route deletion requires confirmation dialog (basic alert currently)
- Route detail page is placeholder
- Mobile responsive design needs testing on real devices
- No skeleton loading states yet
- Limited error handling in some areas

## 🔮 Next Steps (Phase 3)

Phase 3 will focus on Turn-by-Turn Navigation:
- Navigation interface for brigade operators
- Real-time location tracking
- Voice instructions (text-to-speech)
- Automatic rerouting
- Waypoint completion tracking
- Background location updates

## 🐛 Troubleshooting

### Maps Not Loading?
- Check that `VITE_MAPBOX_TOKEN` is set correctly
- Verify token has correct scopes (styles:read, fonts:read, geocoding:read, directions:read)
- Check browser console for error messages

### Routes Not Saving?
- Check browser localStorage (F12 → Application → Local Storage)
- Verify mock data initialized (should see `santa_dev-brigade-1_*` keys)
- Check console for error messages

### Build Errors?
- Run `npm install` to ensure dependencies are up to date
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript version matches: `npm list typescript`

## 📝 Contributing

When working on this project:
1. **Read MASTER_PLAN.md first** - it's the single source of truth
2. Update MASTER_PLAN.md when making architectural changes
3. Follow existing code patterns and conventions
4. Test in both dev and production modes
5. Ensure `npm run build` succeeds before committing

## 📄 License

[To be determined]

## 👥 Team

Developed for Australian Rural Fire Service brigades.

---

**🎄 Merry Christmas and happy Santa tracking! 🎅**
