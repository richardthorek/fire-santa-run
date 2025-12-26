# Storage Adapter Tests

## Overview

These tests verify that the storage adapter correctly switches between localStorage and Azure Table Storage based on environment configuration, and that table names are properly prefixed in dev mode.

## Test Scenarios

### 1. Dev Mode Without Azure Credentials
- **When:** `VITE_DEV_MODE=true` and no `VITE_AZURE_STORAGE_CONNECTION_STRING`
- **Expected:** Uses `LocalStorageAdapter`
- **Result:** Data stored in browser localStorage only

### 2. Dev Mode With Azure Credentials
- **When:** `VITE_DEV_MODE=true` and `VITE_AZURE_STORAGE_CONNECTION_STRING` is set
- **Expected:** Uses `AzureTableStorageAdapter` with 'dev' prefix
- **Result:** Data stored in Azure tables: `devroutes`, `devbrigades`
- **Benefit:** Dev data isolated from production, team can collaborate

### 3. Production Mode
- **When:** `VITE_DEV_MODE=false` and `VITE_AZURE_STORAGE_CONNECTION_STRING` is set
- **Expected:** Uses `AzureTableStorageAdapter` without prefix
- **Result:** Data stored in Azure tables: `routes`, `brigades`

### 4. Production Mode Without Credentials
- **When:** `VITE_DEV_MODE=false` and no `VITE_AZURE_STORAGE_CONNECTION_STRING`
- **Expected:** Throws error
- **Result:** Application fails to start (safe failure)

## Data Isolation Verification

The tests verify that:
- Dev tables: `devroutes`, `devbrigades`
- Production tables: `routes`, `brigades`
- **No overlap** between dev and production table names

This ensures that:
- Dev data cannot accidentally overwrite production data
- Production data is never exposed to dev environment
- Multiple developers can share a dev environment safely

## Running Tests

### Prerequisites
Tests require Vitest to be configured. To set up:

```bash
npm install -D vitest @vitest/ui
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run only storage tests
npm test -- src/storage
```

## Manual Testing

Until test infrastructure is set up, manually verify behavior:

### Test 1: Local-Only Dev Mode
```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
# No Azure credentials

# Run app
npm run dev

# Check browser console - should see:
# [Storage] Dev mode without Azure credentials. Using localStorage.
```

### Test 2: Dev Mode with Azure
```bash
# .env.local
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=devaccount;...

# Run app
npm run dev

# Check browser console - should see:
# [Storage] Dev mode with Azure credentials detected. Using Azure Table Storage with "dev" prefix.

# In Azure Portal, verify tables exist:
# - devroutes
# - devbrigades
```

### Test 3: Production Mode
```bash
# .env.production
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.prod_token
VITE_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=prodaccount;...

# Build and run
npm run build
npm run preview

# Check browser console - should see:
# [Storage] Production mode. Using Azure Table Storage.

# In Azure Portal, verify tables exist:
# - routes
# - brigades
```

## Integration with CI/CD

When test infrastructure is ready, add to GitHub Actions:

```yaml
- name: Run tests
  run: npm test
  env:
    VITE_DEV_MODE: true
    VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
```

## Future Enhancements

- [ ] Add integration tests with real Azure Table Storage emulator
- [ ] Test data migration between storage adapters
- [ ] Test error handling for network failures
- [ ] Test concurrent access patterns
- [ ] Performance benchmarks for localStorage vs Azure
