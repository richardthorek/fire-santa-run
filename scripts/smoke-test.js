#!/usr/bin/env node

/**
 * Production Smoke Test Suite
 * 
 * Validates all core features in staging/production environment before deployment.
 * Tests real Azure services (Table Storage, Web PubSub) and Mapbox API integration.
 * 
 * Usage:
 *   node scripts/smoke-test.js <environment-url>
 *   
 * Example:
 *   node scripts/smoke-test.js https://victorious-beach-0d2b6dc00.azurestaticapps.net
 */

import https from 'https';
import http from 'http';

const args = process.argv.slice(2);
const baseUrl = args[0] || 'http://localhost:5173';

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
  startTime: Date.now(),
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

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test 1: Application Availability
 */
async function testApplicationAvailability() {
  logSection('1. APPLICATION AVAILABILITY');
  
  try {
    logInfo(`Testing: ${baseUrl}`);
    const response = await makeRequest(baseUrl);
    
    if (response.statusCode === 200) {
      logSuccess('Application is accessible');
      
      // Check for essential content
      if (response.body.includes('Fire Santa Run')) {
        logSuccess('Application title found in HTML');
      } else {
        logWarning('Application title not found in HTML');
      }
      
      // Check for React root element
      if (response.body.includes('id="root"')) {
        logSuccess('React root element present');
      } else {
        logError('React root element missing');
      }
      
      // Check for Vite build markers
      if (response.body.includes('type="module"')) {
        logSuccess('ES modules detected (Vite build)');
      }
      
    } else {
      logError(`Application returned status ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Failed to reach application: ${error.message}`);
  }
}

/**
 * Test 2: Static Assets
 */
async function testStaticAssets() {
  logSection('2. STATIC ASSETS');
  
  const assets = [
    '/vite.svg',
    '/manifest.json',
  ];
  
  for (const asset of assets) {
    try {
      const response = await makeRequest(`${baseUrl}${asset}`);
      if (response.statusCode === 200 || response.statusCode === 404) {
        if (response.statusCode === 200) {
          logSuccess(`Asset loaded: ${asset}`);
        } else {
          logInfo(`Asset not found (optional): ${asset}`);
        }
      } else {
        logWarning(`Asset returned status ${response.statusCode}: ${asset}`);
      }
    } catch (error) {
      logWarning(`Failed to load asset ${asset}: ${error.message}`);
    }
  }
}

/**
 * Test 3: API Endpoints
 */
async function testAPIEndpoints() {
  logSection('3. API ENDPOINTS');
  
  const endpoints = [
    { path: '/api/routes', name: 'Routes API' },
    { path: '/api/brigades', name: 'Brigades API' },
    { path: '/api/rfs-stations', name: 'RFS Stations API' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${baseUrl}${endpoint.path}`);
      
      if (response.statusCode === 200 || response.statusCode === 401) {
        if (response.statusCode === 200) {
          logSuccess(`${endpoint.name} accessible (${response.statusCode})`);
          
          // Try to parse JSON
          try {
            JSON.parse(response.body);
            logSuccess(`${endpoint.name} returns valid JSON`);
          } catch (e) {
            logWarning(`${endpoint.name} response is not valid JSON`);
          }
        } else if (response.statusCode === 401) {
          logSuccess(`${endpoint.name} requires authentication (expected in production)`);
        }
      } else {
        logWarning(`${endpoint.name} returned status ${response.statusCode}`);
      }
    } catch (error) {
      logError(`Failed to test ${endpoint.name}: ${error.message}`);
    }
  }
}

/**
 * Test 4: Azure Web PubSub Connectivity
 */
async function testWebPubSubConnectivity() {
  logSection('4. AZURE WEB PUBSUB CONNECTIVITY');
  
  try {
    const response = await makeRequest(`${baseUrl}/api/negotiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { routeId: 'smoke-test-route' },
    });
    
    if (response.statusCode === 200) {
      logSuccess('Web PubSub negotiate endpoint accessible');
      
      try {
        const data = JSON.parse(response.body);
        if (data.url) {
          logSuccess('Web PubSub connection URL returned');
        } else {
          logWarning('Web PubSub connection URL not found in response');
        }
      } catch (e) {
        logWarning('Failed to parse Web PubSub negotiate response');
      }
    } else if (response.statusCode === 401) {
      logSuccess('Web PubSub negotiate requires authentication (expected in production)');
    } else {
      logWarning(`Web PubSub negotiate returned status ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Failed to test Web PubSub: ${error.message}`);
  }
}

/**
 * Test 5: Environment Configuration
 */
async function testEnvironmentConfiguration() {
  logSection('5. ENVIRONMENT CONFIGURATION');
  
  try {
    const response = await makeRequest(baseUrl);
    const html = response.body;
    
    // Check for dev mode indicators (should NOT be present in production)
    if (html.includes('VITE_DEV_MODE=true')) {
      logError('Dev mode enabled in production build');
    } else {
      logSuccess('Dev mode disabled (production configuration)');
    }
    
    // Check for Mapbox token placeholder (should be replaced in production)
    if (html.includes('pk.your_mapbox_token') || html.includes('YOUR_MAPBOX_TOKEN')) {
      logError('Mapbox token placeholder found (not configured)');
    } else {
      logSuccess('Mapbox token appears to be configured');
    }
    
    // Check for source maps in production
    if (html.includes('.map"')) {
      logWarning('Source maps detected in production build');
    } else {
      logSuccess('No source maps in production build');
    }
    
  } catch (error) {
    logError(`Failed to test environment configuration: ${error.message}`);
  }
}

/**
 * Test 6: Security Headers
 */
async function testSecurityHeaders() {
  logSection('6. SECURITY HEADERS');
  
  try {
    const response = await makeRequest(baseUrl);
    const headers = response.headers;
    
    // Check for security headers
    const securityHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'strict-transport-security': 'max-age',
    };
    
    for (const [header, expectedValue] of Object.entries(securityHeaders)) {
      const actualValue = headers[header];
      
      if (actualValue) {
        if (Array.isArray(expectedValue)) {
          if (expectedValue.some(val => actualValue.includes(val))) {
            logSuccess(`Security header present: ${header}`);
          } else {
            logWarning(`Security header has unexpected value: ${header}`);
          }
        } else if (actualValue.includes(expectedValue)) {
          logSuccess(`Security header present: ${header}`);
        } else {
          logWarning(`Security header has unexpected value: ${header}`);
        }
      } else {
        logWarning(`Security header missing: ${header}`);
      }
    }
    
    // Check for HTTPS
    if (baseUrl.startsWith('https://')) {
      logSuccess('Application served over HTTPS');
    } else if (baseUrl.startsWith('http://localhost')) {
      logInfo('Local development (HTTP expected)');
    } else {
      logError('Application not served over HTTPS in production');
    }
    
  } catch (error) {
    logError(`Failed to test security headers: ${error.message}`);
  }
}

/**
 * Test 7: Performance Metrics
 */
async function testPerformanceMetrics() {
  logSection('7. PERFORMANCE METRICS');
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(baseUrl);
    const loadTime = Date.now() - startTime;
    
    logInfo(`Page load time: ${loadTime}ms`);
    
    if (loadTime < 1000) {
      logSuccess('Excellent load time (< 1 second)');
    } else if (loadTime < 3000) {
      logSuccess('Good load time (< 3 seconds)');
    } else if (loadTime < 5000) {
      logWarning('Moderate load time (< 5 seconds)');
    } else {
      logError('Slow load time (> 5 seconds)');
    }
    
    // Check response size
    const sizeKB = response.body.length / 1024;
    logInfo(`Page size: ${sizeKB.toFixed(2)} KB`);
    
    if (sizeKB < 100) {
      logSuccess('Compact page size (< 100 KB)');
    } else if (sizeKB < 500) {
      logSuccess('Reasonable page size (< 500 KB)');
    } else {
      logWarning(`Large page size (${sizeKB.toFixed(2)} KB)`);
    }
    
  } catch (error) {
    logError(`Failed to test performance: ${error.message}`);
  }
}

/**
 * Test 8: Mobile Responsiveness
 */
async function testMobileResponsiveness() {
  logSection('8. MOBILE RESPONSIVENESS');
  
  try {
    const response = await makeRequest(baseUrl);
    const html = response.body;
    
    // Check viewport meta tag
    if (html.includes('name="viewport"')) {
      logSuccess('Viewport meta tag present (mobile-responsive)');
    } else {
      logError('Viewport meta tag missing');
    }
    
    // Check for mobile-first CSS
    if (html.includes('@media') || html.includes('responsive')) {
      logInfo('Responsive CSS likely present');
    }
    
    // Check for touch events support
    if (html.includes('touch') || html.includes('pointer-events')) {
      logInfo('Touch events support likely present');
    }
    
    logInfo('Manual mobile device testing required (iOS/Android)');
    
  } catch (error) {
    logError(`Failed to test mobile responsiveness: ${error.message}`);
  }
}

/**
 * Test 9: Error Handling
 */
async function testErrorHandling() {
  logSection('9. ERROR HANDLING');
  
  // Test 404 page
  try {
    const response = await makeRequest(`${baseUrl}/non-existent-page-12345`);
    
    if (response.statusCode === 404 || response.statusCode === 200) {
      if (response.statusCode === 404) {
        logSuccess('404 error handling present');
      } else {
        logInfo('SPA routing (200 for all routes)');
      }
    } else {
      logWarning(`Unexpected status for 404 test: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Failed to test 404 handling: ${error.message}`);
  }
  
  // Test invalid API endpoint
  try {
    const response = await makeRequest(`${baseUrl}/api/invalid-endpoint-12345`);
    
    if (response.statusCode === 404) {
      logSuccess('Invalid API endpoint returns 404');
    } else {
      logInfo(`Invalid API endpoint returns ${response.statusCode}`);
    }
  } catch (error) {
    logWarning(`API error handling test inconclusive: ${error.message}`);
  }
}

/**
 * Print Summary
 */
function printSummary() {
  logSection('SMOKE TEST SUMMARY');
  
  const duration = ((Date.now() - results.startTime) / 1000).toFixed(2);
  
  log(`\n⏱️  Duration: ${duration}s`, colors.blue);
  log(`✅ Passed: ${results.passed.length}`, colors.green);
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
  
  // Exit code based on results
  if (results.failed.length === 0) {
    log('🎉 ALL SMOKE TESTS PASSED! 🎉\n', colors.green);
    if (results.warnings.length > 0) {
      log(`Note: ${results.warnings.length} warning(s) to review\n`, colors.yellow);
    }
    return 0;
  } else {
    log('⚠️  SMOKE TESTS FAILED - Review issues above\n', colors.red);
    return 1;
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n🎅 Fire Santa Run - Production Smoke Tests 🚒\n', colors.cyan);
  log(`Target: ${baseUrl}\n`, colors.blue);
  
  try {
    await testApplicationAvailability();
    await testStaticAssets();
    await testAPIEndpoints();
    await testWebPubSubConnectivity();
    await testEnvironmentConfiguration();
    await testSecurityHeaders();
    await testPerformanceMetrics();
    await testMobileResponsiveness();
    await testErrorHandling();
    
    const exitCode = printSummary();
    process.exit(exitCode);
  } catch (error) {
    logError(`Fatal error during smoke tests: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
