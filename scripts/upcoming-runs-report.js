#!/usr/bin/env node

/**
 * Upcoming Runs Report
 *
 * Reads the routes/brigades tables directly (not the API — there is
 * deliberately no cross-brigade "list every run" endpoint; see the
 * December-readiness review in MASTER_PLAN.md) and prints every scheduled
 * run grouped by date, so the owner can see clustering as brigades register
 * and decide when to warm the Container App (infra/scale-season.sh) around
 * a specific window rather than blanket-provisioning for the whole month.
 *
 * This does NOT tell you real viewer counts — nothing does yet, this is
 * year 1 — only how many brigades/routes are scheduled on which nights,
 * which is the input the December-readiness review flagged as most useful
 * and currently missing.
 *
 * Usage:
 *   AZURE_STORAGE_CONNECTION_STRING=... node scripts/upcoming-runs-report.js
 *   AZURE_STORAGE_CONNECTION_STRING=... node scripts/upcoming-runs-report.js --dev
 *   AZURE_STORAGE_CONNECTION_STRING=... node scripts/upcoming-runs-report.js --all
 *
 * --dev   reads the dev-prefixed tables (dev-routes / dev-brigades) instead
 *         of production's.
 * --all   also lists draft/unpublished routes (default: published/active/
 *         completed only — what will actually go live).
 */

import { TableClient } from '@azure/data-tables';

const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const includeAll = args.includes('--all');

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!connectionString) {
  console.error('❌ Set AZURE_STORAGE_CONNECTION_STRING first (see infra/.env.<env> or the deployed Storage account).');
  process.exit(1);
}

const ROUTES_TABLE = isDev ? 'dev-routes' : 'routes';
const BRIGADES_TABLE = isDev ? 'dev-brigades' : 'brigades';
const RELEVANT_STATUSES = includeAll
  ? null
  : new Set(['published', 'active', 'completed']);

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
};

async function main() {
  const routesClient = TableClient.fromConnectionString(connectionString, ROUTES_TABLE);
  const brigadesClient = TableClient.fromConnectionString(connectionString, BRIGADES_TABLE);

  console.log(`${colors.bold}Fire Santa Run — Upcoming Runs Report${colors.reset} ${colors.dim}(${isDev ? 'dev' : 'production'} tables)${colors.reset}\n`);

  const brigadeNames = new Map();
  try {
    for await (const entity of brigadesClient.listEntities()) {
      brigadeNames.set(entity.partitionKey, entity.name || entity.partitionKey);
    }
  } catch (error) {
    console.error(`❌ Could not read the brigades table: ${error.message}`);
    process.exit(1);
  }

  /** @type {Map<string, Array<{brigade: string, name: string, startTime: string, status: string}>>} */
  const byDate = new Map();
  let total = 0;
  let futureCount = 0;
  const todayIso = new Date().toISOString().slice(0, 10);

  try {
    for await (const entity of routesClient.listEntities()) {
      if (RELEVANT_STATUSES && !RELEVANT_STATUSES.has(entity.status)) continue;
      const date = entity.date || 'unknown-date';
      total++;
      if (date >= todayIso) futureCount++;
      const list = byDate.get(date) ?? [];
      list.push({
        brigade: brigadeNames.get(entity.partitionKey) || entity.partitionKey,
        name: entity.name || '(unnamed route)',
        startTime: entity.startTime || '?',
        status: entity.status,
      });
      byDate.set(date, list);
    }
  } catch (error) {
    console.error(`❌ Could not read the routes table: ${error.message}`);
    process.exit(1);
  }

  const sortedDates = [...byDate.keys()].sort();
  const registeredBrigades = new Set();

  for (const date of sortedDates) {
    const runs = byDate.get(date).sort((a, b) => a.startTime.localeCompare(b.startTime));
    runs.forEach((r) => registeredBrigades.add(r.brigade));
    const isFuture = date >= todayIso;
    const isPast = !isFuture;
    const dateColor = isPast ? colors.dim : runs.length > 1 ? colors.yellow : colors.cyan;
    const clusterFlag = runs.length > 1 ? `  ${colors.yellow}⚠ ${runs.length} runs the same night${colors.reset}` : '';
    console.log(`${dateColor}${colors.bold}${date}${colors.reset}${clusterFlag}`);
    for (const r of runs) {
      console.log(`  ${r.startTime.padEnd(6)} ${r.brigade} — "${r.name}" ${colors.dim}[${r.status}]${colors.reset}`);
    }
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log(`${colors.bold}Summary${colors.reset}`);
  console.log(`  Registered brigades (with a scheduled run): ${colors.green}${registeredBrigades.size}${colors.reset}`);
  console.log(`  Total scheduled runs found: ${total} (${futureCount} today or later)`);
  const maxCluster = Math.max(0, ...sortedDates.filter((d) => d >= todayIso).map((d) => byDate.get(d).length));
  console.log(`  Largest same-night cluster (today or later): ${maxCluster}`);
  console.log('');
  console.log(
    `${colors.dim}Use this to decide when to run ./infra/scale-season.sh around a specific\n` +
      `window rather than blanket-warming the whole month — see MASTER_PLAN.md,\n` +
      `"December-readiness security/performance/UX review".${colors.reset}`,
  );
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
