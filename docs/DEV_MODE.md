# Development Mode Guide

## Overview

Fire Santa Run supports **Development Mode** to accelerate feature development and enable testing without authentication barriers. This guide explains how to use dev mode effectively.

## Why Development Mode?

### The Problem
In the original implementation plan, authentication (Microsoft Entra External ID) was scheduled for Phase 2, immediately after infrastructure setup. This would create barriers during development:

- ❌ Can't test route planning without setting up authentication first
- ❌ Can't preview tracking features without Azure Entra tenant
- ❌ Can't demonstrate features to stakeholders without user accounts
- ❌ Harder to write automated tests that require authentication mocking
- ❌ Slower iteration due to auth complexity

### The Solution
**Move authentication to Phase 7** and implement a development mode bypass:

- ✅ Build and test all core features immediately (Phases 2-6)
- ✅ No authentication setup required for local development
- ✅ Easy demos and previews without account management
- ✅ Simpler test setup (no auth mocking needed)
- ✅ Production-ready authentication added when features are stable

## Security Rationale

**Why is this safe for Fire Santa Run?**

1. **No sensitive data:** Application doesn't handle personal information, payments, or private data
2. **Public tracking:** Route tracking is intentionally public - anyone can view Santa's location
3. **Development only:** Dev mode is disabled in production deployments
4. **Mock data:** Dev mode uses test/mock brigade data, not real credentials
5. **Clear separation:** Production mode enforces full authentication before accessing real data

## Configuration

### Environment Variable

Control authentication mode with a single environment variable:

```bash
# Development Mode (default for local development)
VITE_DEV_MODE=true

# Production Mode (for deployed environments)
VITE_DEV_MODE=false
```

### Local Development Setup

#### Option A: Local-Only (Default - No Azure Required)

Create `.env.local` file:

```bash
# Enable development mode
VITE_DEV_MODE=true

# Mock brigade for testing
VITE_MOCK_BRIGADE_ID=dev-brigade-1
VITE_MOCK_BRIGADE_NAME="Development Fire Brigade"

# Only required variable for dev mode
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

Data will be stored in browser localStorage only.

#### Option B: Shared Dev Environment with Azure (NEW!)

If you want to test with real Azure Table Storage or collaborate with team members, add your Azure credentials:

```bash
# Enable development mode
VITE_DEV_MODE=true

# Mock brigade for testing
VITE_MOCK_BRIGADE_ID=dev-brigade-1
VITE_MOCK_BRIGADE_NAME="Development Fire Brigade"

# Mapbox token
VITE_MAPBOX_TOKEN=pk.your_mapbox_token_here

# Azure Storage for shared dev environment
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourdevaccount;AccountKey=yourdevkey;EndpointSuffix=core.windows.net
```

With this configuration:
- ✅ Data stored in Azure Table Storage (syncs across team)
- ✅ Tables automatically prefixed with 'dev' (e.g., `devroutes`, `devbrigades`)
- ✅ Dev data kept separate from production
- ✅ Test real Azure integration early
- ✅ No authentication still required in dev mode

That's it! No Azure, no authentication setup, no additional services required for Option A. For Option B, just add the Azure connection string.

### Production Deployment Setup

Create `.env.production` file:

```bash
# Disable development mode (REQUIRED for production)
VITE_DEV_MODE=false

# Mapbox token
VITE_MAPBOX_TOKEN=pk.your_production_token

# Azure Storage
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
VITE_AZURE_STORAGE_ACCOUNT_NAME=your_account

# Microsoft Entra External ID
VITE_ENTRA_CLIENT_ID=your_client_id
VITE_ENTRA_TENANT_ID=your_tenant_id

# Azure Web PubSub (real-time tracking)
AZURE_WEBPUBSUB_CONNECTION_STRING=your_connection_string
AZURE_WEBPUBSUB_HUB_NAME=santa-tracking
```

## Implementation Patterns

### 1. Authentication Context

```typescript
// src/context/AuthContext.tsx
import { createContext, useContext } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  brigadeId: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // Development Mode: Mock authenticated user
  if (isDevMode) {
    const mockUser = {
      email: 'dev@example.com',
      name: 'Dev User',
      role: 'admin',
    };

    const mockAuth: AuthContextType = {
      isAuthenticated: true,
      user: mockUser,
      brigadeId: import.meta.env.VITE_MOCK_BRIGADE_ID || 'dev-brigade-1',
      login: async () => console.log('Dev mode: Login bypassed'),
      logout: async () => console.log('Dev mode: Logout bypassed'),
    };

    return (
      <AuthContext.Provider value={mockAuth}>
        {children}
      </AuthContext.Provider>
    );
  }

  // Production Mode: Real authentication with Entra ID
  return <MSALAuthProvider>{children}</MSALAuthProvider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 2. Protected Routes

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // In dev mode, bypass authentication
  if (isDevMode) {
    return <>{children}</>;
  }

  // In production mode, require authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

### 3. Storage Adapter

```typescript
// src/storage/index.ts
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { AzureTableStorageAdapter } from './AzureTableStorageAdapter';

export const createStorageAdapter = () => {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const hasAzureCredentials = !!import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  
  // Dev mode WITH Azure credentials: Use Azure with 'dev' prefix
  if (isDevMode && hasAzureCredentials) {
    const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
    console.info('[Storage] Dev mode with Azure. Using dev-prefixed tables.');
    return new AzureTableStorageAdapter(connectionString, 'dev');
  }
  
  // Dev mode WITHOUT Azure credentials: Use localStorage
  if (isDevMode) {
    console.info('[Storage] Dev mode with localStorage.');
    return new LocalStorageAdapter();
  }
  
  // Production mode: Use Azure without prefix
  const connectionString = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Azure Storage connection string required for production');
  }
  
  return new AzureTableStorageAdapter(connectionString);
};

export const storageAdapter = createStorageAdapter();
```

### 3a. Storage Modes Explained

Fire Santa Run now supports **three storage modes** to provide flexibility during development:

#### Mode 1: Local-Only Development (Default)
**When to use:** Starting out, no Azure account yet, or offline development

```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
# No Azure credentials
```

**Behavior:**
- ✅ Data stored in browser localStorage
- ✅ Works completely offline (except maps)
- ✅ No Azure account required
- ✅ Fast and simple
- ⚠️ Data doesn't sync across devices/browsers
- ⚠️ Data lost if browser storage cleared

#### Mode 2: Shared Dev Environment (NEW!)
**When to use:** Team collaboration, testing Azure integration, or multi-device dev

```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=devaccount;...
```

**Behavior:**
- ✅ Data stored in Azure Table Storage
- ✅ Tables prefixed with 'dev' (e.g., `devroutes`, `devbrigades`)
- ✅ Data syncs across team members and devices
- ✅ Dev data isolated from production data
- ✅ Test real Azure integration
- ⚠️ Requires Azure Storage account
- ⚠️ Shared dev data (team can see each other's changes)

**Table names in this mode:**
- `devroutes` - Route data
- `devbrigades` - Brigade configuration

#### Mode 3: Production Environment
**When to use:** Live deployment serving real users

```bash
# .env.production
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.production_token
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=prodaccount;...
VITE_ENTRA_CLIENT_ID=...
VITE_ENTRA_TENANT_ID=...
```

**Behavior:**
- ✅ Data stored in Azure Table Storage
- ✅ Tables use production names (e.g., `routes`, `brigades`)
- ✅ Full authentication enforced
- ✅ Production-grade security
- ✅ Domain whitelist validation
- ⚠️ Requires all Azure services configured

**Table names in this mode:**
- `routes` - Production route data
- `brigades` - Production brigade configuration

### 3b. Switching Between Storage Modes

The storage adapter **automatically detects** which mode to use based on environment variables:

```typescript
// Decision tree (automatic)
if (VITE_DEV_MODE === 'true' && VITE_AZURE_STORAGE_CONNECTION_STRING exists) {
  → Mode 2: Azure with 'dev' prefix
} else if (VITE_DEV_MODE === 'true') {
  → Mode 1: localStorage
} else {
  → Mode 3: Azure production (requires connection string)
}
```

**No code changes needed!** Just update your `.env.local` file.

### 4. API Endpoints

```typescript
// src/api/client.ts
const getBaseURL = () => {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (isDevMode) {
    return 'http://localhost:5173'; // Local dev server
  }
  
  return import.meta.env.VITE_API_URL || 'https://api.firesantarun.com';
};

const getAuthHeaders = () => {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  
  if (isDevMode) {
    return {}; // No auth headers in dev mode
  }
  
  // Production: Include JWT token
  const token = sessionStorage.getItem('auth_token');
  return {
    Authorization: `Bearer ${token}`,
  };
};
```

## Testing

### Unit Tests

In dev mode, tests don't need authentication mocking:

```typescript
import { render, screen } from '@testing-library/react';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './pages/Dashboard';

describe('Dashboard', () => {
  it('renders without authentication in dev mode', () => {
    // Set dev mode for test
    import.meta.env.VITE_DEV_MODE = 'true';
    
    render(
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    );
    
    // Test passes without login mocking
    expect(screen.getByText('Create New Route')).toBeInTheDocument();
  });
});
```

### E2E Tests

Playwright tests run faster without authentication flows:

```typescript
test('create route flow', async ({ page }) => {
  // Dev mode: Go directly to dashboard
  await page.goto('http://localhost:5173/dashboard');
  
  // No login page, no authentication delays
  await page.click('text=Create New Route');
  
  // Test the actual feature
  await page.fill('[name="routeName"]', 'Test Route');
  await page.click('text=Save Route');
  
  await expect(page.locator('text=Route created')).toBeVisible();
});
```

## Development Workflow

### Phase 1-6: Core Features (Dev Mode)

1. **Set up environment:**
   ```bash
   cp .env.example .env.local
   echo "VITE_DEV_MODE=true" > .env.local
   echo "VITE_MAPBOX_TOKEN=pk.your_token" >> .env.local
   ```

2. **Start development:**
   ```bash
   npm run dev
   ```

3. **Access immediately:**
   - Dashboard: http://localhost:5173/dashboard
   - Route planning: http://localhost:5173/routes/new
   - No login required!

4. **Build features:**
   - Route planning (Phase 2)
   - Navigation (Phase 3)
   - Real-time tracking (Phase 4)
   - QR codes (Phase 5)
   - Social previews (Phase 6)

5. **Test and iterate:**
   - No auth barriers
   - Fast feedback loops
   - Easy stakeholder demos

### Phase 7: Add Authentication

1. **Set up Azure Entra External ID:**
   - Create tenant
   - Register application
   - Configure redirect URIs

2. **Implement MSAL integration:**
   - Install @azure/msal-browser
   - Create MSALAuthProvider component
   - Update AuthContext to use MSAL in production mode

3. **Test both modes:**
   - Dev mode: VITE_DEV_MODE=true
   - Production mode: VITE_DEV_MODE=false

4. **Deploy with authentication:**
   - Set VITE_DEV_MODE=false in production environment
   - Configure all Azure credentials
   - Test login flow

## Deployment Strategies

### Preview Deployments (Vercel/Netlify)

Use dev mode for feature previews:

```bash
# .env.preview
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
```

Benefits:
- Stakeholders can test features without accounts
- Faster deployment without Azure dependencies
- Easy to share preview links

### Production Deployment

Disable dev mode for production:

```bash
# .env.production
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.production_token
VITE_AZURE_STORAGE_CONNECTION_STRING=...
VITE_ENTRA_CLIENT_ID=...
AZURE_WEBPUBSUB_CONNECTION_STRING=...
```

### Staging Environment

Mix of both approaches:

```bash
# .env.staging
VITE_DEV_MODE=false  # Test production auth flow
# But use staging Azure resources
```

## Troubleshooting

### Issue: Features not accessible in production

**Cause:** VITE_DEV_MODE is still set to 'true'

**Solution:**
```bash
# Check production environment variables
echo $VITE_DEV_MODE

# Should be 'false' in production
# Update in hosting platform (Vercel, Netlify, Azure)
```

### Issue: Authentication not working locally

**Cause:** Dev mode is disabled but Azure credentials not configured

**Solution:**
```bash
# Either enable dev mode for local development:
VITE_DEV_MODE=true

# Or configure all required Azure credentials
```

### Issue: Tests failing with authentication errors

**Cause:** Tests running with VITE_DEV_MODE=false

**Solution:**
```typescript
// In test setup file (vitest.config.ts or jest.setup.ts)
process.env.VITE_DEV_MODE = 'true';
```

## Best Practices

### ✅ Do This

- Use dev mode for all local development
- Use dev mode for preview deployments and demos
- Use dev mode for automated testing
- Disable dev mode in production deployments
- Test both modes before releasing Phase 7
- Document which mode is active in UI (dev badge)

### ❌ Don't Do This

- Don't commit real credentials to dev mode configs
- Don't use dev mode for final production deployment
- Don't store real brigade data in localStorage
- Don't bypass security checks that matter (HTTPS, XSS protection)
- Don't forget to test production mode before launch

## Summary

Development mode enables rapid, friction-free development of Fire Santa Run's core features (Phases 1-6) without authentication complexity. Once features are stable and tested, authentication (Phase 7) adds enterprise-grade security for production deployment.

**Key Takeaway:** Build first, secure later. The public nature of Santa tracking makes this safe, and the architectural separation ensures production security isn't compromised.

## Resources

- [MASTER_PLAN.md](../MASTER_PLAN.md) - Full implementation phases
- [.env.example](../.env.example) - Environment variable reference
- [GitHub Copilot Instructions](../.github/copilot-instructions.md) - Development guidelines
- [Azure Setup Guide](./AZURE_SETUP.md) - Production deployment setup
