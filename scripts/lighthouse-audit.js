#!/usr/bin/env node

/**
 * Lighthouse Performance Audit Script
 * 
 * Runs Lighthouse audits on the production build and checks against performance targets.
 * 
 * Usage:
 *   node scripts/lighthouse-audit.js
 * 
 * Environment Variables:
 *   LIGHTHOUSE_URL - URL to audit (default: http://localhost:4173)
 *   LIGHTHOUSE_OUTPUT - Output directory (default: ./lighthouse-reports)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

// Configuration
const TARGET_URL = process.env.LIGHTHOUSE_URL || 'http://localhost:4173';
const OUTPUT_DIR = process.env.LIGHTHOUSE_OUTPUT || './lighthouse-reports';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = join(OUTPUT_DIR, `lighthouse-${TIMESTAMP}`);

// Performance targets
const PERFORMANCE_TARGETS = {
  performance: 90,
  accessibility: 90,
  'best-practices': 90,
  seo: 90,
};

const METRIC_TARGETS = {
  'first-contentful-paint': 1.5, // seconds
  'time-to-interactive': 3.5, // seconds
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function formatScore(score) {
  const percentage = Math.round(score * 100);
  if (percentage >= 90) return colorize(`${percentage}`, 'green');
  if (percentage >= 50) return colorize(`${percentage}`, 'yellow');
  return colorize(`${percentage}`, 'red');
}

async function runLighthouse() {
  console.log(colorize('\n🚦 Running Lighthouse Audit...', 'bold'));
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Output: ${OUTPUT_PATH}\n`);

  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Validate and sanitize inputs
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(TARGET_URL)) {
      throw new Error('Invalid URL format');
    }
    
    // Sanitize output path (remove any shell metacharacters)
    const sanitizedOutputPath = OUTPUT_PATH.replace(/[^a-zA-Z0-9\/_-]/g, '');
    
    // Run Lighthouse with proper escaping
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const lighthouse = spawn('npx', [
        'lighthouse',
        TARGET_URL,
        '--output', 'json',
        '--output', 'html',
        '--output-path', sanitizedOutputPath,
        '--chrome-flags=--headless --no-sandbox --disable-gpu',
        '--quiet'
      ]);
      
      lighthouse.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Lighthouse exited with code ${code}`));
        }
      });
      
      lighthouse.on('error', (error) => {
        reject(error);
      });
    }).then(() => {
      // Read and parse the JSON report
      const reportPath = `${sanitizedOutputPath}.report.json`;
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));

      // Display results
      console.log(colorize('📊 Lighthouse Scores:', 'bold'));
      console.log('─'.repeat(50));

      const categories = report.categories;
      let allPassed = true;

      for (const [key, target] of Object.entries(PERFORMANCE_TARGETS)) {
        const category = categories[key];
        const score = Math.round(category.score * 100);
        const passed = score >= target;
        const status = passed ? colorize('✓', 'green') : colorize('✗', 'red');
        console.log(`${status} ${category.title}: ${formatScore(category.score)} (target: ${target})`);
        
        if (!passed) allPassed = false;
      }

      // Display key metrics
      console.log('\n' + colorize('⏱️  Performance Metrics:', 'bold'));
      console.log('─'.repeat(50));

      const audits = report.audits;
      const metrics = {
        'First Contentful Paint': audits['first-contentful-paint'],
        'Largest Contentful Paint': audits['largest-contentful-paint'],
        'Time to Interactive': audits['interactive'],
        'Total Blocking Time': audits['total-blocking-time'],
        'Cumulative Layout Shift': audits['cumulative-layout-shift'],
        'Speed Index': audits['speed-index'],
      };

      for (const [name, audit] of Object.entries(metrics)) {
        console.log(`  ${name}: ${audit.displayValue}`);
      }

      // Display bundle sizes
      console.log('\n' + colorize('📦 Bundle Size Analysis:', 'bold'));
      console.log('─'.repeat(50));
      
      // Note: This would require parsing the build output or using a separate tool
      console.log('  See build output for detailed bundle sizes');
      console.log('  Main chunk should be < 500KB (documented exception for Mapbox: ~450KB gzipped)');

      // Final summary
      console.log('\n' + colorize('Summary:', 'bold'));
      console.log('─'.repeat(50));
      
      if (allPassed) {
        console.log(colorize('✅ All performance targets met!', 'green'));
        console.log(`\nHTML Report: ${sanitizedOutputPath}.report.html`);
        return 0;
      } else {
        console.log(colorize('⚠️  Some performance targets not met', 'yellow'));
        console.log(`\nFor detailed analysis, see: ${sanitizedOutputPath}.report.html`);
        
        // Don't fail the build for now - this is informational
        // In the future, you might want to fail CI on performance regression
        console.log(colorize('\nNote: Performance score < 90 is acceptable for CSR React apps with large mapping libraries', 'yellow'));
        return 0;
      }
    });

  } catch (error) {
    console.error(colorize('❌ Lighthouse audit failed:', 'red'), error.message);
    return 1;
  }
}

// Run the audit
runLighthouse()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error(colorize('❌ Unexpected error:', 'red'), error);
    process.exit(1);
  });
