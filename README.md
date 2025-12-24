# Fire Santa Run 🎅🚒

A real-time Santa tracking web application for Australian Rural Fire Service (RFS) brigades to plan, publish, and track Santa runs through their communities.

## Overview

This application enables RFS brigades to:
- 📍 **Plan routes** on interactive maps with waypoint management
- 🔗 **Generate shareable links** with QR codes for community distribution
- 📱 **Broadcast live GPS location** for public real-time tracking
- 🎨 **Customize brigade branding** with logos and colors
- 🔒 **Secure brigade data** with password-protected access
- 🌐 **Rich social previews** when sharing on Facebook, Twitter, etc.

## Features

### For Brigade Operators
- Interactive map-based route planning (Mapbox GL JS)
- Drag-and-drop waypoint management
- Multiple routes over time with unique tracking links
- QR code generation for flyers and posters
- Real-time GPS broadcasting from mobile devices
- Route status management (draft, published, active, completed)
- Historical route archive

### For the Public
- Live Santa tracking on mobile-optimized map
- Progress indicators and ETAs
- Route overview before event starts
- Social media sharing with rich previews
- No login required for tracking

## Quick Start

### Prerequisites
- Node.js 20+ and npm
- Mapbox account (free tier available)
- Azure account (optional, for production data persistence)

### Installation

```bash
# Clone the repository
git clone https://github.com/richardthorek/fire-santa-run.git
cd fire-santa-run

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the application.

## Configuration

### Required Environment Variables

```bash
# Mapbox API Token (Required)
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

### Optional Environment Variables

```bash
# Azure Storage (Production)
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
VITE_AZURE_STORAGE_ACCOUNT_NAME=your_account_name

# Real-time Service (Choose one: Pusher, Firebase, or Supabase)
VITE_PUSHER_KEY=your_key
VITE_PUSHER_CLUSTER=ap4
```

See [Secrets Management Guide](./docs/SECRETS_MANAGEMENT.md) for detailed setup instructions.

## Documentation

### Setup Guides
- 📘 **[Master Plan](./MASTER_PLAN.md)** - Comprehensive architecture and feature roadmap
- 🔐 **[Secrets Management](./docs/SECRETS_MANAGEMENT.md)** - API keys and environment variables setup
- ☁️ **[Azure Storage Setup](./docs/AZURE_SETUP.md)** - Step-by-step Azure Table Storage configuration
- 🤖 **[GitHub Copilot Instructions](./.github/copilot-instructions.md)** - Guidelines for AI-assisted development

### For Developers
- Architecture overview and data models in [MASTER_PLAN.md](./MASTER_PLAN.md)
- TypeScript interfaces in `src/types/`
- Storage adapter pattern in `src/storage/` (supports localStorage and Azure)

### For Brigades
- User guide: Coming soon
- Best practices for GPS tracking: Coming soon
- Social media sharing tips: Coming soon

## Architecture

### Technology Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Mapping:** Mapbox GL JS with Draw plugin
- **Routing:** React Router v6
- **Real-time:** WebSocket (Pusher/Firebase/Supabase)
- **Storage:** LocalStorage (dev) or Azure Table Storage (production)
- **QR Codes:** qrcode.react
- **Meta Tags:** React Helmet Async

### Data Models

```typescript
interface Brigade {
  id: string;
  slug: string;
  name: string;
  location: string;
  passwordHash: string;
  themeColor?: string;
}

interface Route {
  id: string;
  brigadeId: string;
  name: string;
  status: 'draft' | 'published' | 'active' | 'completed';
  waypoints: Waypoint[];
  shareableLink: string;
  qrCodeUrl?: string;
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
│   ├── workflows/          # CI/CD pipelines
│   └── copilot-instructions.md
├── docs/                   # Documentation
│   ├── AZURE_SETUP.md
│   └── SECRETS_MANAGEMENT.md
├── scripts/                # Setup and utility scripts
│   └── setup-azure-storage.sh
├── src/
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route pages (dashboard, tracking)
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Helper functions
│   ├── config/             # Configuration files
│   └── storage/            # Storage adapters
├── MASTER_PLAN.md          # Complete architecture plan
└── README.md               # This file
```

## Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/richardthorek/fire-santa-run)

Set environment variables in Vercel dashboard after deployment.

### Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to:
   - Vercel (recommended)
   - Netlify
   - GitHub Pages
   - Any static hosting service

3. Configure environment variables in hosting platform

See deployment documentation in [MASTER_PLAN.md](./MASTER_PLAN.md#deployment--hosting) for detailed instructions.

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

See [Azure Setup Guide](./docs/AZURE_SETUP.md) for detailed instructions.

## GitHub Actions Setup

The repository includes three workflows:

1. **`deploy.yml`** - Builds, tests, and deploys to production
2. **`preview.yml`** - Creates preview deployments for pull requests
3. **`security.yml`** - Runs security scans on dependencies

### Required GitHub Secrets

Configure in Repository Settings > Secrets > Actions:
- `VITE_MAPBOX_TOKEN` - Mapbox API token
- `AZURE_STORAGE_CONNECTION_STRING` - Azure connection string
- `PUSHER_KEY` / `FIREBASE_API_KEY` / `SUPABASE_URL` - Real-time service credentials
- `VERCEL_TOKEN` / `NETLIFY_AUTH_TOKEN` - Deployment tokens

See [Secrets Management Guide](./docs/SECRETS_MANAGEMENT.md) for complete setup.

## Cost Estimates

### Free Tier Setup (Development)
- **Hosting:** Vercel/Netlify Free Tier
- **Mapbox:** 50k map loads/month free
- **Firebase:** 50k connections, 10GB/month free
- **Azure Storage:** $0.05 AUD/month
- **Total:** ~$0.05 AUD/month

### Production Setup (100 brigades)
- **Hosting:** $20 USD/month (Vercel Pro)
- **Mapbox:** $0-50 USD/month (depending on usage)
- **Firebase:** Free tier sufficient or $25 USD/month
- **Azure Storage:** ~$0.50 AUD/month
- **Total:** ~$45-95 USD/month

See cost breakdown in [MASTER_PLAN.md](./MASTER_PLAN.md#cost-management--resource-planning).

## Security

- Passwords hashed using Web Crypto API (SHA-256)
- HTTPS required for production
- CORS properly configured
- No secrets in repository
- Environment variables for all sensitive data
- Secret rotation every 90 days recommended

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

- Australian Rural Fire Service brigades for inspiration
- Mapbox for mapping platform
- React team for the framework
- All contributors and supporters

---

**Built with ❤️ for Australian Rural Fire Service brigades**

🎅 *Bringing Christmas joy to communities across Australia* 🚒
