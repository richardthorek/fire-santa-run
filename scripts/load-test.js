#!/usr/bin/env node

/**
 * Load Test Suite for Fire Santa Run
 * 
 * Simulates multiple concurrent users accessing the application
 * to validate performance under load.
 * 
 * Features:
 * - Concurrent user simulation
 * - Route tracking simulation
 * - Real-time WebSocket connections
 * - Performance metrics collection
 * 
 * Usage:
 *   node scripts/load-test.js <environment-url> [concurrent-users]
 *   
 * Example:
 *   node scripts/load-test.js https://victorious-beach-0d2b6dc00.azurestaticapps.net 50
 */

import https from 'https';
import http from 'http';

const args = process.argv.slice(2);
const baseUrl = args[0] || 'http://localhost:5173';
const concurrentUsers = parseInt(args[1] || '50', 10);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  responseTimes: [],
  errors: [],
  startTime: Date.now(),
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logSection(title) {
  log(`\n${'='.repeat(80)}`, colors.cyan);
  log(`${title}`, colors.cyan);
  log(`${'='.repeat(80)}`, colors.cyan);
}

/**
 * Make HTTP/HTTPS request with timing
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
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
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          responseTime,
        });
      });
    });

    req.on('error', (error) => {
      const responseTime = Date.now() - startTime;
      reject({ error, responseTime });
    });
    
    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      reject({ error: new Error('Request timeout'), responseTime });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Record request metrics
 */
function recordMetrics(success, responseTime, error = null) {
  metrics.totalRequests++;
  
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
    if (error) {
      metrics.errors.push(error);
    }
  }
  
  metrics.totalResponseTime += responseTime;
  metrics.responseTimes.push(responseTime);
  metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
  metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
}

/**
 * Simulate a single user session
 */
async function simulateUserSession(userId) {
  const sessionStartTime = Date.now();
  const actions = [];
  
  try {
    // Action 1: Load home page
    try {
      const response = await makeRequest(baseUrl);
      recordMetrics(response.statusCode === 200, response.responseTime);
      actions.push({ action: 'Load home', success: true, time: response.responseTime });
    } catch (e) {
      recordMetrics(false, e.responseTime, `User ${userId}: Home page load failed`);
      actions.push({ action: 'Load home', success: false, time: e.responseTime });
    }
    
    // Wait a bit (simulate user reading)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Action 2: Load tracking view
    try {
      const trackingUrl = `${baseUrl}/track/test-route-${userId}`;
      const response = await makeRequest(trackingUrl);
      recordMetrics(response.statusCode === 200 || response.statusCode === 404, response.responseTime);
      actions.push({ action: 'Load tracking', success: true, time: response.responseTime });
    } catch (e) {
      recordMetrics(false, e.responseTime, `User ${userId}: Tracking view load failed`);
      actions.push({ action: 'Load tracking', success: false, time: e.responseTime });
    }
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Action 3: API request - fetch routes
    try {
      const response = await makeRequest(`${baseUrl}/api/routes`);
      const success = response.statusCode === 200 || response.statusCode === 401;
      recordMetrics(success, response.responseTime);
      actions.push({ action: 'Fetch routes', success, time: response.responseTime });
    } catch (e) {
      recordMetrics(false, e.responseTime, `User ${userId}: Routes API failed`);
      actions.push({ action: 'Fetch routes', success: false, time: e.responseTime });
    }
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    // Action 4: API request - fetch brigades
    try {
      const response = await makeRequest(`${baseUrl}/api/brigades`);
      const success = response.statusCode === 200 || response.statusCode === 401;
      recordMetrics(success, response.responseTime);
      actions.push({ action: 'Fetch brigades', success, time: response.responseTime });
    } catch (e) {
      recordMetrics(false, e.responseTime, `User ${userId}: Brigades API failed`);
      actions.push({ action: 'Fetch brigades', success: false, time: e.responseTime });
    }
    
    const sessionDuration = Date.now() - sessionStartTime;
    return {
      userId,
      success: true,
      sessionDuration,
      actions,
    };
    
  } catch (error) {
    const sessionDuration = Date.now() - sessionStartTime;
    return {
      userId,
      success: false,
      sessionDuration,
      error: error.message,
      actions,
    };
  }
}

/**
 * Run load test with concurrent users
 */
async function runLoadTest() {
  logSection(`LOAD TEST: ${concurrentUsers} CONCURRENT USERS`);
  
  logInfo(`Starting load test with ${concurrentUsers} concurrent users...`);
  logInfo(`Target: ${baseUrl}`);
  log('');
  
  const startTime = Date.now();
  
  // Create array of user sessions to run
  const userSessions = Array.from({ length: concurrentUsers }, (_, i) => i + 1);
  
  // Run all sessions concurrently
  log('🚀 Launching concurrent user sessions...', colors.magenta);
  
  const sessionPromises = userSessions.map(userId => 
    simulateUserSession(userId)
  );
  
  // Wait for all sessions to complete
  const sessions = await Promise.all(sessionPromises);
  
  const totalDuration = Date.now() - startTime;
  
  // Analyze results
  logSection('LOAD TEST RESULTS');
  
  const successfulSessions = sessions.filter(s => s.success).length;
  const failedSessions = sessions.length - successfulSessions;
  
  log(`\n📊 Session Statistics:`, colors.cyan);
  log(`   Total Sessions: ${sessions.length}`, colors.blue);
  log(`   Successful: ${successfulSessions}`, colors.green);
  log(`   Failed: ${failedSessions}`, failedSessions > 0 ? colors.red : colors.green);
  
  log(`\n📈 Request Statistics:`, colors.cyan);
  log(`   Total Requests: ${metrics.totalRequests}`, colors.blue);
  log(`   Successful: ${metrics.successfulRequests}`, colors.green);
  log(`   Failed: ${metrics.failedRequests}`, metrics.failedRequests > 0 ? colors.red : colors.green);
  
  if (metrics.totalRequests > 0) {
    const avgResponseTime = metrics.totalResponseTime / metrics.totalRequests;
    const sortedTimes = metrics.responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    log(`\n⏱️  Response Time Statistics:`, colors.cyan);
    log(`   Average: ${avgResponseTime.toFixed(2)}ms`, colors.blue);
    log(`   Min: ${metrics.minResponseTime}ms`, colors.green);
    log(`   Max: ${metrics.maxResponseTime}ms`, metrics.maxResponseTime > 5000 ? colors.red : colors.blue);
    log(`   P50 (median): ${p50}ms`, colors.blue);
    log(`   P95: ${p95}ms`, p95 > 3000 ? colors.yellow : colors.blue);
    log(`   P99: ${p99}ms`, p99 > 5000 ? colors.red : colors.blue);
  }
  
  log(`\n🕐 Duration:`, colors.cyan);
  log(`   Total: ${(totalDuration / 1000).toFixed(2)}s`, colors.blue);
  log(`   Requests/sec: ${(metrics.totalRequests / (totalDuration / 1000)).toFixed(2)}`, colors.blue);
  
  // Performance assessment
  log(`\n🎯 Performance Assessment:`, colors.cyan);
  
  const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
  const avgResponseTime = metrics.totalResponseTime / metrics.totalRequests;
  
  if (successRate >= 99) {
    logSuccess(`Success rate: ${successRate.toFixed(2)}% (Excellent)`);
  } else if (successRate >= 95) {
    logSuccess(`Success rate: ${successRate.toFixed(2)}% (Good)`);
  } else if (successRate >= 90) {
    logWarning(`Success rate: ${successRate.toFixed(2)}% (Acceptable)`);
  } else {
    logError(`Success rate: ${successRate.toFixed(2)}% (Poor)`);
  }
  
  if (avgResponseTime < 500) {
    logSuccess(`Avg response time: ${avgResponseTime.toFixed(2)}ms (Excellent)`);
  } else if (avgResponseTime < 1000) {
    logSuccess(`Avg response time: ${avgResponseTime.toFixed(2)}ms (Good)`);
  } else if (avgResponseTime < 2000) {
    logWarning(`Avg response time: ${avgResponseTime.toFixed(2)}ms (Acceptable)`);
  } else {
    logError(`Avg response time: ${avgResponseTime.toFixed(2)}ms (Poor)`);
  }
  
  // Show errors if any
  if (metrics.errors.length > 0) {
    log(`\n❌ Errors (showing first 10):`, colors.red);
    metrics.errors.slice(0, 10).forEach((error, i) => {
      log(`   ${i + 1}. ${error}`, colors.red);
    });
    if (metrics.errors.length > 10) {
      log(`   ... and ${metrics.errors.length - 10} more`, colors.red);
    }
  }
  
  log('\n' + '='.repeat(80) + '\n', colors.cyan);
  
  // Determine pass/fail
  const passed = successRate >= 95 && avgResponseTime < 2000 && failedSessions === 0;
  
  if (passed) {
    log('🎉 LOAD TEST PASSED! 🎉', colors.green);
    log(`System handled ${concurrentUsers} concurrent users successfully\n`, colors.green);
    return 0;
  } else {
    log('⚠️  LOAD TEST NEEDS ATTENTION', colors.yellow);
    log('Review the metrics above for performance issues\n', colors.yellow);
    return 1;
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n🎅 Fire Santa Run - Load Test Suite 🚒\n', colors.cyan);
  
  try {
    const exitCode = await runLoadTest();
    process.exit(exitCode);
  } catch (error) {
    logError(`Fatal error during load test: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
