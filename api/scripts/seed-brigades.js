const fs = require('fs');
const path = require('path');
const { TableClient, TableServiceClient } = require('@azure/data-tables');

const DEFAULT_DATA_FILE = path.resolve(__dirname, '../../Rural_Country_Fire_Service_Facilities.geojson');
const SEED_LIMIT = Number(process.env.SEED_LIMIT || '100');

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    env[key] = raw.replace(/^"|"$/g, '');
  }
  return env;
}

function loadConnectionString() {
  if (process.env.VITE_AZURE_STORAGE_CONNECTION_STRING) {
    return { connectionString: process.env.VITE_AZURE_STORAGE_CONNECTION_STRING, source: 'env:VITE_AZURE_STORAGE_CONNECTION_STRING' };
  }
  if (process.env.AzureWebJobsStorage) {
    return { connectionString: process.env.AzureWebJobsStorage, source: 'env:AzureWebJobsStorage' };
  }

  const localEnvPath = path.resolve(__dirname, '../../.env.local');
  const parsedEnv = parseEnvFile(localEnvPath);
  if (parsedEnv.VITE_AZURE_STORAGE_CONNECTION_STRING) {
    return { connectionString: parsedEnv.VITE_AZURE_STORAGE_CONNECTION_STRING, source: '.env.local' };
  }
  if (parsedEnv.AzureWebJobsStorage) {
    return { connectionString: parsedEnv.AzureWebJobsStorage, source: '.env.local' };
  }

  throw new Error('Azure Storage connection string not found in environment or .env.local');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'brigade';
}

function buildLocation(props) {
  const parts = [props.gnaf_formatted_address, props.abs_suburb, props.facility_state, props.abs_postcode]
    .map((p) => (p || '').toString().trim())
    .filter(Boolean);
  return parts.join(', ') || props.facility_name || 'Unknown location';
}

function buildContact(props) {
  const contact = {};
  if (props.gnaf_formatted_address) contact.address = props.gnaf_formatted_address;
  if (props.facility_source) contact.website = props.facility_source;
  if (props.facility_lat && props.facility_long) {
    contact.coordinates = {
      lat: Number(props.facility_lat),
      lon: Number(props.facility_long),
    };
  }
  return contact;
}

function brigadeToEntity(brigade) {
  return {
    partitionKey: brigade.id,
    rowKey: brigade.id,
    slug: brigade.slug,
    name: brigade.name,
    location: brigade.location,
    rfsStationId: brigade.rfsStationId,
    contact: JSON.stringify(brigade.contact || {}),
    contactEmail: brigade.contact?.email || '',
    contactPhone: brigade.contact?.phone || '',
    allowedDomains: JSON.stringify(brigade.allowedDomains || []),
    allowedEmails: JSON.stringify(brigade.allowedEmails || []),
    requireManualApproval: brigade.requireManualApproval,
    adminUserIds: JSON.stringify(brigade.adminUserIds || []),
    isClaimed: brigade.isClaimed,
    claimedAt: brigade.claimedAt,
    claimedBy: brigade.claimedBy,
    logo: brigade.logo,
    themeColor: brigade.themeColor,
    createdAt: brigade.createdAt,
    updatedAt: brigade.updatedAt,
  };
}

function mapFeatureToBrigade(feature) {
  const props = feature?.properties || {};
  const rawId = props.objectid ?? feature.id ?? `temp-${Math.random().toString(36).slice(2, 8)}`;
  const id = String(rawId);
  const name = props.facility_name || `Brigade ${id}`;
  const now = new Date().toISOString();

  return {
    id,
    slug: slugify(name),
    name,
    location: buildLocation(props),
    rfsStationId: String(props.objectid ?? id),
    contact: buildContact(props),
    allowedDomains: [],
    allowedEmails: [],
    requireManualApproval: false,
    adminUserIds: [],
    isClaimed: false,
    claimedAt: '',
    claimedBy: '',
    logo: '',
    themeColor: '',
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureTable(connectionString, tableName) {
  const serviceClient = TableServiceClient.fromConnectionString(connectionString);
  try {
    await serviceClient.createTable(tableName);
  } catch (error) {
    if (error.statusCode !== 409 && error.code !== 'TableAlreadyExists') {
      throw error;
    }
  }
  return TableClient.fromConnectionString(connectionString, tableName);
}

async function main() {
  const dataFile = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DATA_FILE;
  const isDevMode = process.env.VITE_DEV_MODE === 'true';
  const tableName = isDevMode ? 'devbrigades' : 'brigades';
  const { connectionString, source } = loadConnectionString();

  if (!fs.existsSync(dataFile)) {
    throw new Error(`Data file not found: ${dataFile}`);
  }

  const raw = fs.readFileSync(dataFile, 'utf8');
  const geojson = JSON.parse(raw);
  const features = Array.isArray(geojson.features) ? geojson.features.slice(0, SEED_LIMIT) : [];
  if (!features.length) {
    throw new Error('No features found in GeoJSON');
  }

  const client = await ensureTable(connectionString, tableName);
  let seeded = 0;

  for (const feature of features) {
    const brigade = mapFeatureToBrigade(feature);
    const entity = brigadeToEntity(brigade);
    await client.upsertEntity(entity, 'Replace');
    seeded += 1;
    if (seeded % 20 === 0) {
      console.log(`Upserted ${seeded} brigades so far...`);
    }
  }

  console.log(`Seeded ${seeded} brigades into ${tableName} (source: ${path.basename(dataFile)}, limit: ${SEED_LIMIT}, connection: ${source}).`);
}

main().catch((error) => {
  console.error('Seeding failed:', error.message || error);
  process.exit(1);
});
