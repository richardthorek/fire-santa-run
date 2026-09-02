/**
 * Azure Blob Storage utility for caching generated assets (e.g. OG images).
 *
 * When AZURE_BLOB_STORAGE_CONNECTION_STRING is configured the helper reads/writes
 * blobs from/to the specified container.  When the variable is absent (local dev
 * or staging without blob storage) every operation is a no-op so callers can
 * always check the cache and fall-through gracefully.
 */

import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const BLOB_CONNECTION_STRING =
  process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING || '';

/**
 * Create a fresh ContainerClient for the given container name.
 * A new client is created per call to avoid shared state across concurrent
 * requests.
 */
function createContainerClient(containerName: string): ContainerClient | null {
  if (!BLOB_CONNECTION_STRING) {
    return null;
  }
  const serviceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION_STRING);
  return serviceClient.getContainerClient(containerName);
}

/**
 * Ensure the container exists (create if not).  Returns null when blob storage
 * is not configured.
 */
async function ensureContainer(containerName: string): Promise<ContainerClient | null> {
  const client = createContainerClient(containerName);
  if (!client) return null;
  // OG images are intentionally public: social-media crawlers (Facebook, Twitter, etc.)
  // must be able to fetch them without credentials. SAS-token access is not feasible
  // because crawlers receive a static og:image URL with no dynamic token.
  await client.createIfNotExists({ access: 'blob' });
  return client;
}

/**
 * Retrieve a cached blob as a Buffer.  Returns null when not found or when blob
 * storage is not configured.
 */
export async function getCachedBlob(
  containerName: string,
  blobName: string
): Promise<Buffer | null> {
  try {
    const client = await ensureContainer(containerName);
    if (!client) return null;

    const blobClient = client.getBlobClient(blobName);
    const exists = await blobClient.exists();
    if (!exists) return null;

    const downloadResponse = await blobClient.download();
    if (!downloadResponse.readableStreamBody) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk, 'binary'));
      } else {
        // Handles Uint8Array, ArrayBufferView, and other byte-array-like types
        // Node.js Buffer.from() accepts these natively without type assertions
        chunks.push(Buffer.from(chunk));
      }
    }
    return Buffer.concat(chunks);
  } catch {
    // Non-fatal – caller will regenerate the blob.
    return null;
  }
}

/**
 * Store a blob in cache.  No-op when blob storage is not configured.
 */
export async function setCachedBlob(
  containerName: string,
  blobName: string,
  content: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    const client = await ensureContainer(containerName);
    if (!client) return null;

    const blockBlobClient = client.getBlockBlobClient(blobName);
    await blockBlobClient.upload(content, content.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    return blockBlobClient.url;
  } catch {
    // Non-fatal – image will just be regenerated on next request.
    return null;
  }
}
