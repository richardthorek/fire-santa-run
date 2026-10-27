#!/usr/bin/env node
/**
 * Exports every Azure Table to a JSON file, one per table, for the nightly backup
 * (infra/backup/backup-tables.sh). Reads entities through the Tables SDK rather
 * than `az storage entity query`, which fails on some tables in the CLI.
 *
 * Usage: ACCOUNT_KEY=<key> node scripts/backup/export-tables.mjs <outDir> <account>
 * Set TABLE_ENDPOINT to point at a local emulator (e.g. Azurite).
 * Writes <table>.json per table and _counts.json with each table's entity count.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AzureNamedKeyCredential, TableClient, TableServiceClient } from '@azure/data-tables';

const [outDir, account] = process.argv.slice(2);
const key = process.env.ACCOUNT_KEY;
if (!outDir || !account || !key) {
  console.error('usage: ACCOUNT_KEY=<key> node export-tables.mjs <outDir> <account>');
  process.exit(2);
}

const endpoint = process.env.TABLE_ENDPOINT || `https://${account}.table.core.windows.net`;
const credential = new AzureNamedKeyCredential(account, key);
// Plain HTTP is only for a local emulator; the real account is always HTTPS.
const options = endpoint.startsWith('http://') ? { allowInsecureConnection: true } : {};
const service = new TableServiceClient(endpoint, credential, options);

const counts = {};
for await (const table of service.listTables()) {
  const name = table.name;
  console.log(`  · exporting ${name}`);
  const client = new TableClient(endpoint, name, credential, options);
  const entities = [];
  for await (const page of client.listEntities().byPage({ maxPageSize: 1000 })) {
    entities.push(...page);
  }
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(entities));
  counts[name] = entities.length;
  console.log(`    ${entities.length} entities`);
}
writeFileSync(join(outDir, '_counts.json'), JSON.stringify(counts));
