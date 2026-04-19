/**
 * SyncStatusBanner component
 *
 * Displays a non-intrusive banner that communicates the sync queue state:
 *
 * - Offline with queued changes → amber "X change(s) queued" banner
 * - Actively syncing           → blue "Syncing…" banner with spinner
 * - Sync complete              → green "All changes synced ✓" (auto-dismisses)
 * - Sync error                 → red error banner with retry button
 *
 * The banner sits directly below the OfflineBanner in AppLayout so users
 * always have a clear picture of outstanding work.
 */

import { useSyncQueue } from '../hooks/useSyncQueue';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function SyncStatusBanner() {
  const { pendingCount, isSyncing, lastSyncError, syncComplete, processQueue, clearError } =
    useSyncQueue();
  const { isOnline } = useNetworkStatus();

  // Syncing in progress.
  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Syncing queued changes"
        style={bannerStyle('#1565C0', '#E3F2FD', '#1565C0')}
      >
        <span style={spinnerStyle} aria-hidden="true" />
        <span>Syncing {pendingCount} change{pendingCount !== 1 ? 's' : ''}…</span>
      </div>
    );
  }

  // Sync completed successfully.
  if (syncComplete) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="All changes synced"
        style={bannerStyle('#2E7D32', '#E8F5E9', '#2E7D32')}
      >
        <span role="img" aria-hidden="true">✅</span>
        <span>All changes synced</span>
      </div>
    );
  }

  // Sync error with retry.
  if (lastSyncError) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-label="Sync error"
        style={bannerStyle('#B71C1C', '#FFEBEE', '#B71C1C')}
      >
        <span role="img" aria-hidden="true">⚠️</span>
        <span>Sync failed: {lastSyncError}</span>
        <button
          onClick={() => { clearError(); processQueue(); }}
          style={retryButtonStyle}
          aria-label="Retry sync"
        >
          Retry
        </button>
        <button
          onClick={clearError}
          style={dismissButtonStyle}
          aria-label="Dismiss sync error"
        >
          ✕
        </button>
      </div>
    );
  }

  // Offline with pending changes.
  if (!isOnline && pendingCount > 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={`${pendingCount} change${pendingCount !== 1 ? 's' : ''} queued for sync`}
        style={bannerStyle('#E65100', '#FFF3E0', '#E65100')}
      >
        <span role="img" aria-hidden="true">📋</span>
        <span>
          {pendingCount} change{pendingCount !== 1 ? 's' : ''} queued — will sync when back online
        </span>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function bannerStyle(
  color: string,
  backgroundColor: string,
  borderColor: string
): React.CSSProperties {
  return {
    backgroundColor,
    color,
    borderBottom: `1px solid ${borderColor}`,
    textAlign: 'center',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  };
}

const retryButtonStyle: React.CSSProperties = {
  padding: '0.2rem 0.6rem',
  background: 'transparent',
  color: '#B71C1C',
  border: '1px solid #B71C1C',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.8rem',
};

const dismissButtonStyle: React.CSSProperties = {
  padding: '0.2rem 0.4rem',
  background: 'transparent',
  color: '#B71C1C',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
  lineHeight: 1,
};

// Inline CSS spinner (no external deps required).
const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '0.9em',
  height: '0.9em',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
