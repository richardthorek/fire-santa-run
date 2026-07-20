# Fire Santa Run 🎅🚒

A real-time Santa tracking web application for Australian fire brigades and community groups to plan, publish, and track Santa runs through their communities.

> Deployment model: production hosting is **Azure Container Apps** (Consumption, scale-to-zero) running a single container image, with Bicep IaC in `infra/`. Both the earlier Azure Static Web Apps and Azure App Service deployment models are retired — see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`infra/README.md`](./infra/README.md).

## Overview

This application enables fire brigades to:
- 📍 **Plan routes** on interactive maps with waypoint management
- 🔗 **Generate shareable links** with QR codes for community distribution
- 📱 **Broadcast live GPS location** for public real-time tracking
- 🎨 **Customize brigade branding** with logos and colors
- 🔒 **Secure brigade access** with Microsoft Entra External ID authentication
- 👥 **Manage brigade members** with role-based permissions
- 🌐 **Rich social previews** when sharing on Facebook, Twitter, etc.

## Features

### For Brigade Operators
- Interactive map-based route planning (Mapbox GL JS)
- Drag-and-drop waypoint management
- Turn-by-turn navigation with voice guidance during Santa runs
- Multiple routes over time with unique tracking links
- QR code generation for flyers and posters
- Real-time GPS broadcasting from mobile devices
- Route status management (draft, published, active, completed)
- Historical route archive

### For Brigade Administrators
- Brigade claiming with .gov.au email or admin verification
- Member management with role-based access control
- Team invitations with email-based acceptance
- Brigade customization (name, logo, theme colors)
- Microsoft Entra External ID authentication

### For the Public
- Live Santa tracking on mobile-optimized map
- Progress indicators and ETAs
- Route overview before event starts
- Social media sharing with rich previews
- No login required for tracking

## Quick Start

### Prerequisites
- Node.js 22+ and npm
- Mapbox account (free tier available) - [Sign up here](https://account.mapbox.com/)
- **No authentication setup required for development!**

### Minimal Setup (Development Mode)

```bash
# Clone the repository
git clone https://github.com/richardthorek/fire-santa-run.git
cd fire-santa-run

# Install dependencies
npm install

# Set up minimal environment variables
cp .env.example .env.local
# Edit .env.local and add only these two lines:
# VITE_DEV_MODE=true
# VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the application. **No login required in dev mode!**

## Development Mode 🚀

Fire Santa Run supports **Development Mode** for rapid prototyping:

✅ **Enabled by default** for local development  
✅ **No authentication required** - instant access to all features  
✅ **Flexible storage options:**
  - **localStorage** (default) - No setup required, local-only
  - **Azure Table Storage** (optional) - Team collaboration, uses 'dev' prefix for isolation
✅ **Fast iteration** - test features immediately  

### Storage Options in Dev Mode

**Option 1: Local-Only (Default)**
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
# No other config needed - uses localStorage
```

**Option 2: Shared Dev with Azure (NEW!)**
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
# Automatically uses Azure with 'dev' prefix (devroutes, devbrigades)
# Data syncs across team, isolated from production
```

See [Development Mode Guide](./docs/DEV_MODE.md) for details on the dev mode strategy.

## Configuration

### Development Mode (Default)

For local development, you only need:

```bash
# Enable development mode (default)
VITE_DEV_MODE=true

# Mapbox API Token (Required)
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Mock brigade for testing
VITE_MOCK_BRIGADE_ID=dev-brigade-1
```

### Production Mode

For production deployment, additional configuration required:

```bash
# Disable development mode
VITE_DEV_MODE=false

# Mapbox API Token
VITE_MAPBOX_TOKEN=pk.your_production_token

# Azure Storage
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
VITE_AZURE_STORAGE_ACCOUNT_NAME=your_account_name

# Microsoft Entra External ID (authentication)
VITE_ENTRA_CLIENT_ID=your_client_id
VITE_ENTRA_TENANT_ID=your_tenant_id

# Real-time tracking is served in-process by the Hono server (no separate
# service or connection string) — see docs/ARCHITECTURE.md#realtime-tracking.
# Optional: sign the broadcaster/editor WebSocket token explicitly instead of
# deriving it from the storage connection string.
REALTIME_WS_SECRET=your_random_secret
```

See [Secrets Management Guide](./docs/SECRETS_MANAGEMENT.md) for detailed setup instructions.

## Documentation

### Product Planning
- 📘 **[Master Plan](./MASTER_PLAN.md)** - The single forward-looking product plan: vision, current state, roadmap, decisions
- 🗂️ **[docs/INDEX.md](./docs/INDEX.md)** - Topic map for the rest of `docs/`

### Setup Guides
- 🚀 **[Development Mode Guide](./docs/DEV_MODE.md)** - Rapid development without auth barriers
- 🔐 **[Secrets Management](./docs/SECRETS_MANAGEMENT.md)** - API keys and environment variables setup
- ☁️ **[Infrastructure & deployment](./infra/README.md)** - Azure infra (Bicep), secrets seeding, Entra setup, seasonal scaling
- 🤖 **[GitHub Copilot Instructions](./.github/copilot-instructions.md)** - Guidelines for AI-assisted development

### For Developers
- **Current Status:** Preparing **v1.0 public launch** (target July 2026). Releases 1–3.2 shipped: route planning, turn-by-turn navigation, public real-time tracking, PWA/offline, analytics, route optimisation, templates, social previews, production Entra auth, brigade claiming/membership. Launch hardening in progress — public brigade pages & discovery, logo/branding, onboarding, ETA schedule indicator, E2E suite, security review (see launch epic #345).
- **Launch docs:** [Brigade Admin Onboarding](./docs/BRIGADE_ADMIN_ONBOARDING.md) · [Security Review](./docs/SECURITY_REVIEW_LAUNCH.md) · [Privacy](/privacy) · [Terms](/terms)
- Architecture overview and data models in [MASTER_PLAN.md](./MASTER_PLAN.md) and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- TypeScript interfaces in `src/types/`
- Storage adapter pattern in `src/storage/` (supports localStorage and Azure)

### For Brigades
- Onboarding & admin guide: [docs/BRIGADE_ADMIN_ONBOARDING.md](./docs/BRIGADE_ADMIN_ONBOARDING.md) (membership/roles are now managed in Station Manager — see that guide)
- Navigation quick reference: [docs/NAVIGATION_QUICK_REFERENCE.md](./docs/NAVIGATION_QUICK_REFERENCE.md)

## Architecture

### Technology Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Mapping:** Mapbox GL JS with Draw plugin and Directions API
- **Routing:** React Router v7
- **Real-time:** native WebSocket, fanned out in-process by the Hono server (no managed pub/sub service)
- **Storage:** LocalStorage (dev) or Azure Table Storage (production)
- **Authentication:** Microsoft Entra External ID (production)
- **Hosting:** Azure Container Apps (Consumption, scale-to-zero) + Hono server (`server/`)
- **QR Codes:** qrcode.react
- **Meta Tags:** React 19 Native Metadata (automatic hoisting to `<head>`)

### Data Models

Simplified overview (see `src/types/index.ts` for complete schemas, and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md#data-model--isolation) for the storage model):

```typescript
interface Brigade {
  id: string;
  slug: string;
  name: string;
  location: string;
  fireStationId?: number;
  logo?: string;
  themeColor?: string;
  allowedDomains: string[];
  adminUserIds: string[];
  isClaimed: boolean;
}

interface Route {
  id: string;
  brigadeId: string;
  name: string;
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived';
  waypoints: Waypoint[];
  geometry?: GeoJSON.LineString;      // Mapbox Directions route
  navigationSteps?: NavigationStep[]; // Turn-by-turn instructions
  shareableLink?: string;
  qrCodeUrl?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  entraUserId?: string;  // Microsoft Entra ID
}
```

See [MASTER_PLAN.md](./MASTER_PLAN.md) for complete data model documentation.

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type check
npm run build  # (builds and type checks)
```

### Project Structure

```
fire-santa-run/
├── .github/
│   ├── workflows/          # CI/CD pipelines (quality + Container Apps deploy)
│   └── copilot-instructions.md
├── api/                    # Azure Functions — local dev API (npm run dev) + legacy path
│   └── src/                # API function implementations
├── server/                 # Hono backend — PRODUCTION API on Azure Container Apps
│   └── src/
├── infra/                  # Bicep IaC and deployment script
│   ├── main.bicep
│   └── deploy.sh
├── docs/                   # Documentation (see docs/INDEX.md)
│   ├── ARCHITECTURE.md     # As-built architecture (canonical)
│   ├── UI_GUIDELINES.md    # Design tokens, brand, accessibility (canonical)
│   ├── DEV_MODE.md
│   └── SECRETS_MANAGEMENT.md
├── scripts/                # Setup and utility scripts
│   └── setup-azure-storage.sh
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route pages (dashboard, tracking, navigation)
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Helper functions
│   ├── config/             # Configuration files
│   ├── storage/            # Storage adapters (localStorage/Azure)
│   ├── context/            # React Context providers
│   ├── hooks/              # Custom React hooks
│   └── services/           # API service layer
├── staticwebapp.config.json # Legacy SWA config (retired; not a deploy target)
├── MASTER_PLAN.md          # Forward-looking product plan (concise)
└── README.md               # This file
```

## Deployment

The application is deployed to **Azure Container Apps** as a single container image (React SPA + Hono API server, built from the root `Dockerfile`), with infrastructure provisioned by **Bicep** (`infra/main.bicep`) and CI/CD via GitHub Actions.

### Automatic Deployment

Deployment happens automatically when code is pushed to the repository:
- **Production:** Merges to `main` branch build and push a new image, then update the Container App
- **Pull Requests:** Quality checks and test coverage run
- **Configuration:**
  - `.github/workflows/deploy-container-apps.yml` (build image → push to ghcr.io → deploy)
  - `.github/workflows/azure-static-web-apps-victorious-beach-0d2b6dc00.yml` (quality gate + failure reporting only — no deploy)

### Container Apps + IaC Setup

1. Provision infra with Bicep:
  - `./infra/deploy.sh --env dev --suffix <unique> --location <region>`
2. Configure GitHub environment (`copilot`) secrets and variables (OIDC — no long-lived Azure secret):
  - Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
  - Variables: `AZURE_CONTAINER_APP_NAME`, `AZURE_RESOURCE_GROUP`
  - Build secret: `VITE_MAPBOX_TOKEN`
3. Push to `main` (or manually run workflow dispatch) to deploy.
4. Optional: set Entra External ID values for production auth flows.

Full one-time OIDC setup steps are in [`infra/README.md`](./infra/README.md#after-deployment--configure-ci--secrets).

### Manual Build (for testing)

```bash
# Build the application
npm run build

# The dist/ folder contains the static SPA assets, served by server/ (Hono).
# For a full production-shaped build, see the root Dockerfile — it builds
# both the client and server into one container image.
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`infra/README.md`](./infra/README.md) for detailed deployment instructions.

## Azure Storage Setup

For production data persistence across devices:

1. Run the automated setup script:
   ```bash
   ./scripts/setup-azure-storage.sh
   ```

2. Follow the prompts to create:
   - Azure Storage Account
   - Required tables (brigades, routes, waypoints, trackingsessions)
   - CORS configuration

3. Copy the connection string to your environment variables

See [`infra/README.md`](./infra/README.md) for detailed instructions.

## GitHub Actions Setup

The repository includes automated CI/CD workflows:

1. **`deploy-container-apps.yml`** - Primary workflow: quality checks, E2E, build + push the container image, deploy to Azure Container Apps
2. **`azure-static-web-apps-victorious-beach-0d2b6dc00.yml`** - Legacy quality checks + failure-reporting workflow (no deploy)

### Required GitHub Secrets

Configure in Repository Settings > Secrets and variables > Actions > Environments > copilot:

**Build-time secrets (required):**
- `VITE_MAPBOX_TOKEN` - Mapbox API token for maps and geocoding
- `VITE_ENTRA_CLIENT_ID` - Microsoft Entra External ID client ID
- `VITE_ENTRA_TENANT_ID` - Microsoft Entra tenant ID
- `VITE_ENTRA_AUTHORITY` - Microsoft Entra authority URL
- `VITE_ENTRA_REDIRECT_URI` - OAuth redirect URI

**Container Apps deployment config (required for deploy step, OIDC — no stored Azure secret):**
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (environment secrets)
- `AZURE_CONTAINER_APP_NAME`, `AZURE_RESOURCE_GROUP` (environment variables)

**Runtime secrets (seeded onto the Container App via `infra/seed-secrets.sh`, not GitHub):**
- Azure Storage connection string
- Stripe keys, site-admin IDs, VAPID keys, realtime WS secret

See [Secrets Management Guide](./docs/SECRETS_MANAGEMENT.md) and [`infra/README.md`](./infra/README.md) for complete setup.

### CIAM (External ID) Resource Note

The External Configuration Tenant resource (`Microsoft.AzureActiveDirectory/ciamDirectories`) is lifecycle-sensitive and may be temporarily unavailable for move/rebind operations while in `Deleting` state.

- Deployments should not hard-depend on CIAM binding during this state.
- Use the optional IaC parameter only when the resource is healthy in the target RG.
- For current migration status, verify with:
  - `az resource list --query "[?type=='Microsoft.AzureActiveDirectory/ciamDirectories']" -o table`

## Cost Estimates

### Development / off-season (Container Apps `minReplicas=0`)
- **Hosting:** Azure Container Apps Consumption, scaled to zero — within the monthly free grant for light traffic
- **Mapbox:** 50k map loads/month free
- **Azure Table Storage:** $0.05 AUD/month
- **Entra External ID:** Free (up to 50K monthly active users)
- **Total: near $0/month**

### Production, December season (Container Apps `minReplicas=1`)
- **Hosting:** a few USD/month for one always-warm Consumption replica (0.25 vCPU / 0.5 GiB) — see `infra/scale-season.sh`
- **Mapbox:** $0-50 USD/month depending on public viewer volume (the main variable cost — see `infra/README.md` for the MapLibre migration trigger)
- **Azure Table Storage:** ~$0.50 AUD/month
- **Entra External ID:** Free (up to 50K MAU)
- **Total:** typically single-digit to low-double-digit USD/month, dominated by Mapbox at scale, not compute

See [`infra/README.md`](./infra/README.md#seasonal-scaling-read-before-december) and [`MASTER_PLAN.md`](./MASTER_PLAN.md#operational-readiness) for the seasonal cost model.

## Security

- **Authentication:** Microsoft Entra External ID (OAuth 2.0/OpenID Connect)
- **Multi-factor authentication** support through Entra ID
- **Domain whitelisting** for brigade member verification (.gov.au emails)
- HTTPS required for production
- CORS properly configured for Azure services
- No secrets in repository
- Environment variables for all sensitive data
- Secret rotation every 90 days recommended
- **Content Security Policy** headers configured in staticwebapp.config.json

See [Secrets Management Guide](./docs/SECRETS_MANAGEMENT.md#security-best-practices) for security best practices.

## Contributing

Contributions are welcome! Please read the contributing guidelines (coming soon) before submitting pull requests.

### Development Guidelines
- Use TypeScript strict mode
- Follow existing code style
- Write comprehensive JSDoc comments
- Mobile-first responsive design
- Accessibility (WCAG 2.1 AA)

## Support

- 📖 [Documentation](./docs/)
- 🐛 [Report a Bug](https://github.com/richardthorek/fire-santa-run/issues)
- 💡 [Request a Feature](https://github.com/richardthorek/fire-santa-run/issues)
- 📧 Contact: [Create an issue](https://github.com/richardthorek/fire-santa-run/issues)

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Australian fire brigades and community groups for inspiration
- Mapbox for mapping platform
- React team for the framework
- All contributors and supporters

---

**Built with ❤️ for Australian fire brigades and community groups**

🎅 *Bringing Christmas joy to communities across Australia* 🚒
