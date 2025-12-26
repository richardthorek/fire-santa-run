# Dev Mode Storage Enhancement - Implementation Summary

## Date
December 26, 2024

## Overview
Enhanced the development mode to support real Azure Table Storage with automatic environment-based switching and table name prefixing for data isolation.

## Problem Statement
The original implementation had a binary switch:
- `VITE_DEV_MODE=true` → Always used localStorage
- `VITE_DEV_MODE=false` → Always used Azure Table Storage (not implemented)

This prevented developers from:
- Testing with real Azure integration during development
- Sharing dev data across team members
- Verifying Azure integration before production

## Solution Implemented

### Three Storage Modes

#### 1. Local-Only Development (Default)
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
# No Azure credentials
```
- Uses browser localStorage
- No Azure account required
- Data doesn't sync across devices
- Perfect for getting started quickly

#### 2. Shared Dev Environment with Azure (NEW!)
```bash
VITE_DEV_MODE=true
VITE_MAPBOX_TOKEN=pk.your_token
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
```
- Uses Azure Table Storage with 'dev' prefix
- Tables: `devroutes`, `devbrigades`
- Data syncs across team members
- Dev data isolated from production
- No authentication required (still dev mode)

#### 3. Production Environment
```bash
VITE_DEV_MODE=false
VITE_MAPBOX_TOKEN=pk.production_token
VITE_AZURE_STORAGE_CONNECTION_STRING=your_connection_string
VITE_ENTRA_CLIENT_ID=...
```
- Uses Azure Table Storage without prefix
- Tables: `routes`, `brigades`
- Full authentication enforced
- Production-grade security

## Technical Implementation

### Storage Adapter Factory Logic
```typescript
function createStorageAdapter(): IStorageAdapter {
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
  const hasAzureCredentials = hasAzureStorageCredentials();
  
  // Dev mode WITH Azure credentials
  if (isDevMode && hasAzureCredentials) {
    return new AzureTableStorageAdapter(connectionString, 'dev');
  }
  
  // Dev mode WITHOUT Azure credentials
  if (isDevMode) {
    return new LocalStorageAdapter();
  }
  
  // Production mode (requires Azure)
  return new AzureTableStorageAdapter(connectionString);
}
```

### Azure Table Storage Adapter
- Implemented full CRUD operations
- Table name prefixing support
- Automatic table creation
- Error handling for 404s and conflicts
- Proper TypeScript types

### Data Isolation
- Dev mode tables: `devroutes`, `devbrigades`
- Production tables: `routes`, `brigades`
- Zero overlap ensures no data contamination

## Files Modified

### Core Implementation
- `src/storage/index.ts` - Storage factory with credential detection
- `src/storage/azure.ts` - Full Azure Table Storage implementation
- `package.json` - Added @azure/data-tables dependency

### Documentation
- `.env.example` - Added dev mode with Azure examples
- `docs/DEV_MODE.md` - Comprehensive storage mode documentation
- `MASTER_PLAN.md` - Updated Section 15b with storage strategy
- `README.md` - Added storage options overview

### Testing
- `scripts/test-storage-adapter.js` - Manual verification script
- `src/storage/__tests__/storageAdapter.test.ts` - Unit tests for future
- `src/storage/__tests__/README.md` - Testing documentation
- `tsconfig.json`, `tsconfig.app.json` - Exclude test files

## Verification

### Manual Test Script
Created `scripts/test-storage-adapter.js` that verifies:
- ✅ Dev mode without credentials → LocalStorageAdapter
- ✅ Dev mode with credentials → AzureTableStorageAdapter + 'dev' prefix
- ✅ Production mode → AzureTableStorageAdapter (no prefix)
- ✅ Production without credentials → Error thrown
- ✅ Data isolation → No table name overlap

All tests pass successfully.

### Build & Lint
- ✅ TypeScript compilation successful
- ✅ ESLint passes with no errors
- ✅ Production build successful

## Benefits

### For Developers
1. **Flexibility**: Choose between local-only or Azure-backed development
2. **Team Collaboration**: Share dev data via Azure without risk
3. **Early Testing**: Test Azure integration during development
4. **Zero Risk**: Dev data completely isolated from production

### For Operations
1. **Data Safety**: 'dev' prefix prevents production data contamination
2. **Clear Separation**: Table names make environment obvious
3. **Easy Migration**: Same adapter interface for all modes
4. **Fail-Safe**: Production requires credentials (can't accidentally run without)

## Usage Examples

### Start with Local Storage
```bash
cp .env.example .env.local
# Edit: Set VITE_DEV_MODE=true and VITE_MAPBOX_TOKEN
npm run dev
```

### Switch to Azure Dev Storage
```bash
# Add to .env.local:
VITE_AZURE_STORAGE_CONNECTION_STRING=your_dev_connection_string
# Restart dev server
npm run dev
# Data now in Azure tables: devroutes, devbrigades
```

### Deploy to Production
```bash
# .env.production
VITE_DEV_MODE=false
VITE_AZURE_STORAGE_CONNECTION_STRING=your_prod_connection_string
VITE_ENTRA_CLIENT_ID=...
npm run build
# Data now in Azure tables: routes, brigades
```

## Future Enhancements

- [ ] Add Vitest configuration for running unit tests
- [ ] Create Azure Table Storage emulator integration tests
- [ ] Add data migration utilities between storage modes
- [ ] Implement storage adapter metrics/monitoring
- [ ] Add support for other storage backends (SQL, Cosmos DB)

## References

- Issue: #[issue-number] - Update dev mode to use real storage with environment-based connection strings
- Documentation: `docs/DEV_MODE.md`
- Tests: `src/storage/__tests__/`
- Manual verification: `scripts/test-storage-adapter.js`
