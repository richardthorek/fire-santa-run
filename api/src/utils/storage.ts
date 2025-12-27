// Storage helper to resolve an Azure Storage connection string in Functions host.
// Prefer VITE_AZURE_STORAGE_CONNECTION_STRING, then AzureWebJobsStorage (set by Functions),
// then an empty string.
export const STORAGE_CONNECTION_STRING: string = (
  process.env.VITE_AZURE_STORAGE_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage ||
  ''
);

export const isDevMode = process.env.VITE_DEV_MODE === 'true';
