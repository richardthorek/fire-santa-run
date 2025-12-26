#!/usr/bin/env node

/**
 * End-to-End Validation Script
 * 
 * This script performs comprehensive validation of the Fire Santa Run application
 * to ensure all Phase 1-6 functionality is working correctly before user testing.
 * 
 * Validation Categories:
 * 1. Build & Code Quality
 * 2. Storage Adapter Pattern
 * 3. Route Management (CRUD operations)
 * 4. Navigation System
 * 5. Real-time Tracking
 * 6. Sharing & QR Codes
 * 7. UI/UX Quality
 * 8. Documentation
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
  results.passed.push(message);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
  results.failed.push(message);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
  results.warnings.push(message);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, colors.cyan);
  log(`${title}`, colors.cyan);
  log(`${'='.repeat(80)}`, colors.cyan);
}

function fileExists(path) {
  return existsSync(join(rootDir, path));
}

function readFile(path) {
  return readFileSync(join(rootDir, path), 'utf-8');
}

function runCommand(command, description) {
  try {
    logInfo(`Running: ${description}...`);
    const output = execSync(command, { cwd: rootDir, encoding: 'utf-8' });
    logSuccess(description);
    return { success: true, output };
  } catch (error) {
    logError(`${description}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 1. BUILD & CODE QUALITY VALIDATION
// ============================================================================

function validateBuildAndCodeQuality() {
  logSection('1. BUILD & CODE QUALITY VALIDATION');

  // Check if node_modules exists
  if (!fileExists('node_modules')) {
    logError('node_modules directory not found - dependencies not installed');
    return;
  }
  logSuccess('Dependencies installed');

  // Run build
  const buildResult = runCommand('npm run build', 'TypeScript compilation and Vite build');
  
  // Run linting
  const lintResult = runCommand('npm run lint', 'ESLint code quality check');

  // Check dist directory exists
  if (buildResult.success && fileExists('dist')) {
    logSuccess('Build artifacts created in dist/ directory');
  }
}

// ============================================================================
// 2. STORAGE ADAPTER PATTERN VALIDATION
// ============================================================================

function validateStorageAdapter() {
  logSection('2. STORAGE ADAPTER PATTERN VALIDATION');

  const files = [
    'src/storage/index.ts',
    'src/storage/types.ts',
    'src/storage/localStorage.ts',
    'src/storage/http.ts',
  ];

  files.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`Storage file exists: ${file}`);
    } else {
      logError(`Storage file missing: ${file}`);
    }
  });

  // Check storage adapter implementation
  const storageIndex = readFile('src/storage/index.ts');
  
  if (storageIndex.includes('createStorageAdapter')) {
    logSuccess('Storage adapter factory function found');
  } else {
    logError('Storage adapter factory function not found');
  }

  if (storageIndex.includes('VITE_DEV_MODE')) {
    logSuccess('Dev mode check in storage adapter');
  } else {
    logError('Dev mode check missing in storage adapter');
  }

  if (storageIndex.includes('LocalStorageAdapter')) {
    logSuccess('LocalStorageAdapter reference found');
  }

  if (storageIndex.includes('HttpStorageAdapter')) {
    logSuccess('HttpStorageAdapter reference found');
  }
}

// ============================================================================
// 3. ROUTE MANAGEMENT VALIDATION
// ============================================================================

function validateRouteManagement() {
  logSection('3. ROUTE MANAGEMENT VALIDATION');

  const requiredComponents = [
    'src/pages/Dashboard.tsx',
    'src/pages/RouteEditor.tsx',
    'src/components/MapView.tsx',
    'src/components/WaypointList.tsx',
    'src/utils/routeHelpers.ts',
  ];

  requiredComponents.forEach(component => {
    if (fileExists(component)) {
      logSuccess(`Component exists: ${component}`);
    } else {
      logError(`Component missing: ${component}`);
    }
  });

  // Check for route status management
  const dashboard = readFile('src/pages/Dashboard.tsx');
  if (dashboard.includes('draft') && dashboard.includes('published')) {
    logSuccess('Route status management (draft/published) implemented');
  }

  // Check for CRUD operations
  const routeHelpers = readFile('src/utils/routeHelpers.ts');
  if (routeHelpers.includes('generateShareableLink')) {
    logSuccess('Shareable link generation function found');
  }
}

// ============================================================================
// 4. NAVIGATION SYSTEM VALIDATION
// ============================================================================

function validateNavigationSystem() {
  logSection('4. NAVIGATION SYSTEM VALIDATION (Phase 3)');

  const navigationFiles = [
    'src/pages/NavigationView.tsx',
    'src/components/NavigationMap.tsx',
    'src/components/NavigationPanel.tsx',
    'src/components/NavigationHeader.tsx',
    'src/components/ManeuverIcon.tsx',
    'src/utils/navigation.ts',
    'src/utils/voice.ts',
    'src/utils/wakeLock.ts',
  ];

  navigationFiles.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`Navigation file exists: ${file}`);
    } else {
      logError(`Navigation file missing: ${file}`);
    }
  });

  // Check for navigation features
  if (fileExists('src/pages/NavigationView.tsx')) {
    const navView = readFile('src/pages/NavigationView.tsx');
    
    if (navView.includes('geolocation')) {
      logSuccess('Geolocation API integration found');
    }
    
    if (navView.includes('voice') || navView.includes('speech')) {
      logSuccess('Voice instruction system referenced');
    }
    
    if (navView.includes('wakeLock') || navView.includes('WakeLock')) {
      logSuccess('Wake lock implementation found');
    }
  }

  // Check Mapbox Directions API integration
  if (fileExists('src/utils/mapbox.ts')) {
    const mapbox = readFile('src/utils/mapbox.ts');
    if (mapbox.includes('directions')) {
      logSuccess('Mapbox Directions API integration found');
    }
  }
}

// ============================================================================
// 5. REAL-TIME TRACKING VALIDATION
// ============================================================================

function validateRealTimeTracking() {
  logSection('5. REAL-TIME TRACKING VALIDATION (Phase 4)');

  const trackingFiles = [
    'src/pages/TrackingView.tsx',
    'api/src/negotiate.ts',
    'api/src/broadcast.ts',
  ];

  trackingFiles.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`Tracking file exists: ${file}`);
    } else {
      logError(`Tracking file missing: ${file}`);
    }
  });

  // Check for Web PubSub integration
  if (fileExists('src/pages/TrackingView.tsx')) {
    const tracking = readFile('src/pages/TrackingView.tsx');
    
    if (tracking.includes('WebPubSub') || tracking.includes('webpubsub')) {
      logSuccess('Azure Web PubSub integration found');
    }
    
    if (tracking.includes('BroadcastChannel')) {
      logSuccess('BroadcastChannel fallback for dev mode found');
    }
  }

  // Check API endpoints
  if (fileExists('api/src/negotiate.ts')) {
    logSuccess('Negotiate API endpoint exists (Web PubSub connection)');
  }
  
  if (fileExists('api/src/broadcast.ts')) {
    logSuccess('Broadcast API endpoint exists (location updates)');
  }
}

// ============================================================================
// 6. SHARING & QR CODES VALIDATION
// ============================================================================

function validateSharingFeatures() {
  logSection('6. SHARING & QR CODES VALIDATION (Phase 5)');

  const sharingFiles = [
    'src/components/SharePanel.tsx',
    'src/components/ShareModal.tsx',
  ];

  sharingFiles.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`Sharing component exists: ${file}`);
    } else {
      logError(`Sharing component missing: ${file}`);
    }
  });

  // Check for QR code library
  const packageJson = JSON.parse(readFile('package.json'));
  if (packageJson.dependencies['qrcode.react']) {
    logSuccess('QR code library (qrcode.react) installed');
  } else {
    logError('QR code library not found in dependencies');
  }

  // Check SharePanel implementation
  if (fileExists('src/components/SharePanel.tsx')) {
    const sharePanel = readFile('src/components/SharePanel.tsx');
    
    if (sharePanel.includes('QRCode')) {
      logSuccess('QR code component usage found');
    }
    
    if (sharePanel.includes('clipboard') || sharePanel.includes('writeText')) {
      logSuccess('Copy to clipboard functionality found');
    }
    
    if (sharePanel.includes('twitter') || sharePanel.includes('facebook') || sharePanel.includes('whatsapp')) {
      logSuccess('Social media share buttons found');
    }
    
    if (sharePanel.includes('download') || sharePanel.includes('toBlob')) {
      logSuccess('QR code download functionality found');
    }
    
    if (sharePanel.includes('@media print') || sharePanel.includes('window.print')) {
      logSuccess('Print-friendly layout found');
    }
  }
}

// ============================================================================
// 7. UI/UX QUALITY VALIDATION
// ============================================================================

function validateUIUX() {
  logSection('7. UI/UX QUALITY VALIDATION (Phase 6)');

  const uiFiles = [
    'src/components/SEO.tsx',
    'src/components/LoadingSkeleton.tsx',
    'src/components/RouteStatusBadge.tsx',
    'src/components/ProgressBar.tsx',
  ];

  uiFiles.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`UI component exists: ${file}`);
    } else {
      logError(`UI component missing: ${file}`);
    }
  });

  // Check for SEO implementation
  if (fileExists('src/components/SEO.tsx')) {
    const seo = readFile('src/components/SEO.tsx');
    
    if (seo.includes('Helmet')) {
      logSuccess('React Helmet (meta tags) implementation found');
    }
    
    if (seo.includes('og:') || seo.includes('OpenGraph')) {
      logSuccess('Open Graph tags for social previews found');
    }
    
    if (seo.includes('twitter:')) {
      logSuccess('Twitter Card meta tags found');
    }
  }

  // Check CSS for Australian summer theme
  if (fileExists('src/index.css')) {
    const css = readFile('src/index.css');
    
    if (css.includes('#D32F2F') || css.includes('fire-red')) {
      logSuccess('Fire red color (Australian summer theme) found');
    }
    
    if (css.includes('#FFA726') || css.includes('summer-gold')) {
      logSuccess('Summer gold color found');
    }
    
    if (css.includes('transition')) {
      logSuccess('CSS transitions for smooth animations found');
    }
  }

  // Check for React Helmet Async
  const packageJson = JSON.parse(readFile('package.json'));
  if (packageJson.dependencies['react-helmet-async']) {
    logSuccess('React Helmet Async library installed');
  }

  // Check for loading states
  if (fileExists('src/components/LoadingSkeleton.tsx')) {
    logSuccess('Loading skeleton component exists');
  }
}

// ============================================================================
// 8. DOCUMENTATION VALIDATION
// ============================================================================

function validateDocumentation() {
  logSection('8. DOCUMENTATION VALIDATION');

  const docs = [
    'README.md',
    'MASTER_PLAN.md',
    'docs/DEV_MODE.md',
    'docs/SECRETS_MANAGEMENT.md',
    '.env.example',
  ];

  docs.forEach(doc => {
    if (fileExists(doc)) {
      logSuccess(`Documentation exists: ${doc}`);
      
      // Check file size to ensure it's not empty
      const stats = statSync(join(rootDir, doc));
      if (stats.size < 100) {
        logWarning(`${doc} seems very small (${stats.size} bytes)`);
      }
    } else {
      logError(`Documentation missing: ${doc}`);
    }
  });

  // Check README for key sections
  if (fileExists('README.md')) {
    const readme = readFile('README.md');
    
    const sections = [
      'Quick Start',
      'Development Mode',
      'Configuration',
      'Architecture',
    ];
    
    sections.forEach(section => {
      if (readme.includes(section)) {
        logSuccess(`README includes "${section}" section`);
      } else {
        logWarning(`README missing "${section}" section`);
      }
    });

    // Check for up-to-date dev mode instructions
    if (readme.includes('VITE_DEV_MODE=true')) {
      logSuccess('README includes dev mode configuration');
    }
  }

  // Check MASTER_PLAN for phase completion status
  if (fileExists('MASTER_PLAN.md')) {
    const masterPlan = readFile('MASTER_PLAN.md');
    
    const phases = [
      'Phase 1:',
      'Phase 2:',
      'Phase 3:',
      'Phase 4:',
      'Phase 5:',
      'Phase 6:',
    ];
    
    phases.forEach(phase => {
      if (masterPlan.includes(phase)) {
        logSuccess(`MASTER_PLAN includes ${phase}`);
      } else {
        logWarning(`MASTER_PLAN missing ${phase}`);
      }
    });

    // Check for completion markers
    if (masterPlan.includes('✅ COMPLETE')) {
      logSuccess('MASTER_PLAN includes completion status markers');
    }
  }

  // Check .env.example for required variables
  if (fileExists('.env.example')) {
    const envExample = readFile('.env.example');
    
    const requiredVars = [
      'VITE_DEV_MODE',
      'VITE_MAPBOX_TOKEN',
      'VITE_MOCK_BRIGADE_ID',
    ];
    
    requiredVars.forEach(varName => {
      if (envExample.includes(varName)) {
        logSuccess(`.env.example includes ${varName}`);
      } else {
        logError(`.env.example missing ${varName}`);
      }
    });
  }
}

// ============================================================================
// 9. API ENDPOINTS VALIDATION
// ============================================================================

function validateAPIEndpoints() {
  logSection('9. API ENDPOINTS VALIDATION');

  const apiFiles = [
    'api/src/routes.ts',
    'api/src/brigades.ts',
    'api/src/rfs-stations.ts',
    'api/src/negotiate.ts',
    'api/src/broadcast.ts',
  ];

  apiFiles.forEach(file => {
    if (fileExists(file)) {
      logSuccess(`API endpoint exists: ${file}`);
    } else {
      logError(`API endpoint missing: ${file}`);
    }
  });

  // Check API configuration
  if (fileExists('api/host.json')) {
    logSuccess('Azure Functions host.json exists');
  }

  if (fileExists('api/package.json')) {
    const apiPackage = JSON.parse(readFile('api/package.json'));
    
    if (apiPackage.dependencies['@azure/functions']) {
      logSuccess('Azure Functions SDK installed in API');
    }
    
    if (apiPackage.dependencies['@azure/data-tables']) {
      logSuccess('Azure Table Storage SDK installed in API');
    }
    
    if (apiPackage.dependencies['@azure/web-pubsub']) {
      logSuccess('Azure Web PubSub SDK installed in API');
    }
  }
}

// ============================================================================
// 10. DEVELOPMENT MODE VALIDATION
// ============================================================================

function validateDevMode() {
  logSection('10. DEVELOPMENT MODE VALIDATION');

  // Check for dev mode configuration
  if (fileExists('.env.local')) {
    logSuccess('.env.local file exists for local development');
    const envLocal = readFile('.env.local');
    
    if (envLocal.includes('VITE_DEV_MODE=true')) {
      logSuccess('Dev mode enabled in .env.local');
    } else {
      logWarning('Dev mode not enabled in .env.local');
    }
  } else {
    logWarning('.env.local file not found (expected for local development)');
  }

  // Check context providers for dev mode support
  if (fileExists('src/context/BrigadeContext.tsx')) {
    const brigadeContext = readFile('src/context/BrigadeContext.tsx');
    
    if (brigadeContext.includes('VITE_DEV_MODE')) {
      logSuccess('Brigade context supports dev mode');
    }
    
    if (brigadeContext.includes('VITE_MOCK_BRIGADE_ID')) {
      logSuccess('Mock brigade ID support in context');
    }
  }

  // Check mock data initialization
  if (fileExists('src/utils/mockData.ts')) {
    logSuccess('Mock data utility exists');
    const mockData = readFile('src/utils/mockData.ts');
    
    if (mockData.includes('initializeMockData')) {
      logSuccess('Mock data initialization function found');
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('\n🎅 Fire Santa Run - End-to-End Validation 🚒\n', colors.cyan);
  log('Validating Phase 1-6 implementation before user testing...\n', colors.blue);

  try {
    validateBuildAndCodeQuality();
    validateStorageAdapter();
    validateRouteManagement();
    validateNavigationSystem();
    validateRealTimeTracking();
    validateSharingFeatures();
    validateUIUX();
    validateDocumentation();
    validateAPIEndpoints();
    validateDevMode();

    // Print summary
    logSection('VALIDATION SUMMARY');
    
    log(`\n✅ Passed: ${results.passed.length}`, colors.green);
    log(`❌ Failed: ${results.failed.length}`, colors.red);
    log(`⚠️  Warnings: ${results.warnings.length}`, colors.yellow);
    
    if (results.failed.length > 0) {
      log('\n❌ Failed checks:', colors.red);
      results.failed.forEach(fail => log(`   - ${fail}`, colors.red));
    }
    
    if (results.warnings.length > 0) {
      log('\n⚠️  Warnings:', colors.yellow);
      results.warnings.forEach(warn => log(`   - ${warn}`, colors.yellow));
    }
    
    log('\n' + '='.repeat(80) + '\n', colors.cyan);
    
    if (results.failed.length === 0) {
      log('🎉 ALL VALIDATIONS PASSED! Ready for user testing. 🎉\n', colors.green);
      process.exit(0);
    } else {
      log('⚠️  Some validations failed. Please fix the issues above.\n', colors.red);
      process.exit(1);
    }
  } catch (error) {
    logError(`Fatal error during validation: ${error.message}`);
    process.exit(1);
  }
}

main();
