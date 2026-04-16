/**
 * OfflineBanner component
 *
 * Displays a non-intrusive banner at the top of the page when the device
 * has lost its network connection. The banner disappears automatically
 * once the connection is restored.
 */

import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Offline mode indicator"
      style={{
        backgroundColor: '#424242',
        color: '#ffffff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
      }}
    >
      <span role="img" aria-hidden="true">📵</span>
      <span>You&apos;re offline — viewing cached data</span>
    </div>
  );
}
