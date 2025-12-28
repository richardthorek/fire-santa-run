# GitHub Copilot Agent Instructions for Fire Santa Run

## 📋 Master Plan Document (CRITICAL)

**⚠️ SINGLE SOURCE OF TRUTH: The `MASTER_PLAN.md` file is the ONLY planning document for this project.**

### Master Plan Rules:
- **ALWAYS** refer to `MASTER_PLAN.md` for comprehensive project documentation
- **UPDATE** the master plan when adding features, changing architecture, or modifying workflows
- **NEVER** create separate planning documents (no `plan.md`, `architecture.md`, `roadmap.md`, etc.)
- **MAINTAIN** the master plan as development progresses with current status and decisions
- **REFERENCE** specific sections of the master plan in commits and PRs

All architectural decisions, feature specifications, implementation sequences, design guidelines, and technical details live in `MASTER_PLAN.md`. This includes:
- Visual design & brand identity (Section 2)
- Core features & architecture (Sections 3-12)
- Implementation phases (Section 16)
- Data models and API contracts (Sections 12-13)
- Deployment and infrastructure (Sections 7, 15)
- Testing strategies (Section 26)

## Project Overview
React + TypeScript web application for Australian Rural Fire Service brigades to plan and track Santa runs with real-time GPS tracking.

## Key Technologies
- React 19 + TypeScript
- Vite build system
- Mapbox GL JS for mapping and navigation (Directions API)
- Azure Static Web Apps (hosting + serverless API)
- Azure Table Storage (data persistence)
- Azure Web PubSub (real-time tracking)
- Microsoft Entra External ID (authentication)

## 🏗️ Project Structure & Organization

### Core Directory Structure
```
fire-santa-run/
├── src/
│   ├── components/       # React components (UI building blocks)
│   ├── pages/           # Page-level components (routes)
│   ├── context/         # React Context providers (state management)
│   ├── hooks/           # Custom React hooks (reusable logic)
│   ├── utils/           # Utility functions (helpers)
│   ├── storage/         # Storage adapters (localStorage, Azure)
│   ├── types/           # TypeScript interfaces and types
│   └── styles/          # Global styles and CSS
├── api/                 # Azure Functions (serverless API)
├── public/              # Static assets
├── docs/                # ALL Additional documentation
├── MASTER_PLAN.md      # 📋 SINGLE SOURCE OF TRUTH
└── .github/
    └── copilot-instructions.md  # This file
```

### Architecture Principles

**1. Storage Adapter Pattern**
- **Intent:** Support both local development and Azure production seamlessly
- **Method:** Use interface-based adapters (`IStorageAdapter`) that switch based on environment
- **Never:** Directly access `localStorage` or Azure APIs - always use `storageAdapter`
- **Location:** `src/storage/` directory with `LocalStorageAdapter` and `AzureTableStorageAdapter`

**2. Development Mode Strategy**
- **Intent:** Rapid development without authentication barriers until production-ready
- **Method:** Environment variable `VITE_DEV_MODE=true` bypasses auth and uses localStorage
- **Production:** `VITE_DEV_MODE=false` enables full Azure + Entra ID authentication
- **See:** MASTER_PLAN.md Section 15b for complete strategy

**3. Multi-Brigade Isolation**
- **Intent:** Each fire brigade has isolated data and configuration
- **Method:** Brigade ID used as partition key in Azure Table Storage
- **Design:** All routes/data scoped to `brigadeId` for data isolation
- **Auth:** Domain whitelisting validates brigade membership (production mode)

## 🎯 Development Intent & Methodology

### Primary Goals
1. **Public-First Experience:** Real-time Santa tracking accessible to anyone with a link (no login required)
2. **Brigade-Friendly:** Simple route planning interface for fire service volunteers
3. **Mobile-Optimized:** Navigation for drivers, tracking for families on mobile devices
4. **Reliable:** Graceful degradation when network/services unavailable

### Development Workflow

**Phase-Based Implementation:**
- Follow the 8-phase plan in MASTER_PLAN.md Section 16
- Each phase builds on previous work with clear deliverables
- Authentication deferred to Phase 7 (rapid prototyping first)

**Feature Development Process:**
1. Check MASTER_PLAN.md for feature specification
2. Update master plan if feature scope changes
3. Implement with storage adapter pattern (dev mode first)
4. Test in development mode (`VITE_DEV_MODE=true`)
5. Validate production mode compatibility
6. Update MASTER_PLAN.md with implementation notes

**Code Change Methodology:**
- Make minimal, surgical changes to achieve the goal
- Use existing patterns and conventions from codebase
- Implement features mobile-first (primary use case)
- Support offline-first where possible
- Test across browsers (Chrome, Safari, Firefox, Edge)

## 🎨 Design Patterns & Principles

### UI/UX Design Language
- **Theme:** Fun, magical, whimsical Australian summer Christmas
- **Colors:** Fire red (#D32F2F), summer gold (#FFA726), Christmas green (#43A047)
- **Typography:** Bold headings (Nunito/Montserrat), clean body (Inter/Open Sans)
- **Components:** Rounded corners, gradient buttons, festive decorations
- **Reference:** MASTER_PLAN.md Section 2 for complete design system

### Component Patterns

**Functional Components with Hooks:**
```typescript
// ✅ Correct pattern
export function RouteList() {
  const { routes } = useRoutes();
  const { brigade } = useBrigade();
  // ... implementation
}

// ❌ Avoid class components
```

**Named Exports:**
```typescript
// ✅ Correct
export function MapView() { }
export function WaypointList() { }

// ❌ Avoid default exports
export default MapView;
```

**Context-Based State Management:**
```typescript
// Use React Context for global state (auth, brigade, routes)
// See src/context/ for existing patterns
export const BrigadeContext = createContext<BrigadeContextType>(null);
export function useBrigade() { return useContext(BrigadeContext); }
```

### Data Flow Patterns

**Storage Abstraction:**
```typescript
// ✅ Always use storage adapter
import { storageAdapter } from '@/storage';
await storageAdapter.saveRoute(route);

// ❌ Never access directly
localStorage.setItem('route', JSON.stringify(route));
```

**Environment-Based Behavior:**
```typescript
// ✅ Check dev mode flag
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
if (isDevMode) {
  // Mock/bypass for development
} else {
  // Real implementation for production
}
```

### API & Data Contracts
- Follow data models in MASTER_PLAN.md Section 12
- Use TypeScript interfaces from `src/types/index.ts`
- Maintain backward compatibility when updating schemas
- Version API endpoints if breaking changes needed

## ⚙️ Development Methods & Workflows

### Local Development Setup
1. Clone repository
2. Copy `.env.example` to `.env.local`
3. Set `VITE_DEV_MODE=true` in `.env.local`
4. Add `VITE_MAPBOX_TOKEN` (only required variable for dev mode)
5. Run `npm install`
6. Run `npm run dev` (this now builds the Functions app before starting both servers)
7. Access at `http://localhost:5173`

**Important for Functions code:** The Azure Functions app runs from the compiled `api/dist` output. After backend code changes, a rebuild is required before `func start` picks them up. Use `npm run build:api` (or just `npm run dev`, which builds first) rather than only restarting `func start`.

### Common Development Tasks

**Adding New Route Fields:**
1. Update `Route` interface in `src/types/index.ts`
2. Update both storage adapters (`src/storage/localStorage.ts` and `azure.ts`)
3. Update route form components
4. Update route display components
5. Run type check: `npm run build`
6. Update MASTER_PLAN.md Section 12 (Data Model) with new field

**Adding New Features:**
1. Check MASTER_PLAN.md for existing specification
2. If not specified, document the feature in MASTER_PLAN.md first
3. Implement following existing patterns in codebase
4. Test in development mode
5. Verify production mode compatibility
6. Update MASTER_PLAN.md with implementation status

**Modifying Architecture:**
1. **FIRST:** Update MASTER_PLAN.md with architectural change and rationale
2. Implement the change following the updated plan
3. Update any affected documentation sections in MASTER_PLAN.md
4. Document migration path if breaking change

### Code Quality Standards
- **TypeScript:** Strict mode enabled, no `any` types without justification
- **Linting:** Must pass `npm run lint` before committing
- **Building:** Must pass `npm run build` (type checking)
- **Testing:** Write tests for new utilities and complex logic
- **Mobile-First:** Design and test on mobile viewports first (375px width)
- **Accessibility:** WCAG 2.1 AA compliance (see MASTER_PLAN.md Section 2)

### Git Workflow
- Feature branches from `main`
- Descriptive commit messages referencing MASTER_PLAN.md sections when relevant
- PR descriptions should reference master plan sections being implemented
- Preview deployments automatic for PRs
- Production deployment on merge to `main`

### GitHub Actions Workflow Guidelines

**Current Architecture:** Single unified CI/CD pipeline (`.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml`)

**Core Principle:** Maintain workflow efficiency by avoiding redundant builds and enforcing quality gates before deployment.

**When Adding New Checks/Tasks:**

1. **Should it block deployment?**
   - ✅ **YES** → Add to `quality_checks` job in main workflow
   - Examples: linting, testing, static analysis, security scans, type checking
   - These run FIRST and fail fast

2. **Is it triggered by push/PR events?**
   - ✅ **YES** → Add as new job in main workflow with appropriate dependencies
   - Examples: post-deployment smoke tests, notifications
   - Use `needs:` to establish job dependencies

3. **Is it independent/scheduled/manual?**
   - ✅ **YES** → Create separate workflow
   - Examples: scheduled dependency updates, security scans, manual rollback operations
   - Use `schedule:` or `workflow_dispatch:` triggers

**Never:**
- ❌ Create parallel workflows that duplicate builds
- ❌ Add redundant dependency installation steps
- ❌ Create workflows that should be part of deployment gate

**Decision Template:**
```
New task: [describe task]
├─ Blocks deployment? → Add to quality_checks job
├─ Runs on push/PR? → Add as dependent job in main workflow  
└─ Independent schedule/manual? → Create new workflow
```

**Reference:** See MASTER_PLAN.md Section 24 for complete workflow strategy and examples.

## 🔧 Key Technical Integrations

### Mapbox Integration
- **Maps:** Mapbox GL JS for interactive maps
- **Navigation:** Mapbox Directions API for turn-by-turn routing
- **Geocoding:** Address search and reverse geocoding
- **Setup:** Requires `VITE_MAPBOX_TOKEN` in environment
- **Reference:** MASTER_PLAN.md Sections 3, 3a for route planning and navigation

### Azure Services
- **Static Web Apps:** Hosting + serverless API functions
- **Table Storage:** NoSQL data persistence with partition/row key model
- **Web PubSub:** Real-time WebSocket communication for live tracking
- **Entra External ID:** OAuth 2.0 authentication (Phase 7)
- **Reference:** MASTER_PLAN.md Sections 7, 8, 15, 22 for complete setup

### Real-Time Architecture
- **Brigade Operator:** Broadcasts GPS location via Azure Web PubSub
- **Public Viewers:** Subscribe to route-specific groups, receive updates
- **Fallback:** BroadcastChannel API for local multi-tab testing
- **Throttling:** Max 1 location update per 5 seconds
- **Reference:** MASTER_PLAN.md Section 6 for tracking system details

## 🚨 Critical Rules

### Documentation
- ✅ **DO:** Update MASTER_PLAN.md when making architectural decisions
- ✅ **DO:** Reference master plan sections in commits and PRs
- ✅ **DO:** Keep implementation status current in master plan
- ❌ **DON'T:** Create separate planning documents (plan.md, roadmap.md, etc.)
- ❌ **DON'T:** Document features outside of MASTER_PLAN.md
- ❌ **DON'T:** Let master plan become outdated

### Storage & Data
- ✅ **DO:** Always use `storageAdapter` interface
- ✅ **DO:** Test both localStorage and Azure adapters
- ✅ **DO:** Implement offline-first with sync
- ❌ **DON'T:** Directly access localStorage or Azure APIs
- ❌ **DON'T:** Bypass storage adapter for "quick fixes"

### Security & Privacy
- ✅ **DO:** Hash passwords using Web Crypto API
- ✅ **DO:** Validate and sanitize all user inputs
- ✅ **DO:** Use HTTPS in production
- ✅ **DO:** Implement domain whitelisting for brigades (production)
- ❌ **DON'T:** Store secrets in code or git history
- ❌ **DON'T:** Commit API keys or connection strings
- ❌ **DON'T:** Trust client-side data without validation

## 📚 Quick Reference Links

### Within This Repository
- **MASTER_PLAN.md** - Complete project documentation (ALWAYS CHECK FIRST)
- **docs/DEV_MODE.md** - Development mode detailed guide
- **docs/AZURE_SETUP.md** - Azure infrastructure setup
- **docs/SECRETS_MANAGEMENT.md** - Environment variables and secrets

### External Documentation
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/
- Mapbox Directions API: https://docs.mapbox.com/api/navigation/directions/
- Azure Static Web Apps: https://learn.microsoft.com/en-us/azure/static-web-apps/
- Azure Table Storage SDK: https://learn.microsoft.com/en-us/javascript/api/@azure/data-tables/
- Azure Web PubSub: https://learn.microsoft.com/en-us/azure/azure-web-pubsub/
- React Router v6: https://reactrouter.com/
- TypeScript Handbook: https://www.typescriptlang.org/docs/

## 🎯 When in Doubt
1. Check MASTER_PLAN.md for the answer
2. Follow existing code patterns in the repository
3. Maintain consistency with the master plan
4. Update the master plan if something is unclear or missing
5. Ask for clarification rather than making assumptions that contradict the master plan
