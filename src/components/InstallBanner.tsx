/**
 * InstallBanner component
 *
 * Displays a "Add to Home Screen" install prompt banner at the bottom of the
 * viewport. Two variants are supported:
 *
 * - **Chrome / Android / Edge**: A button triggers the native browser install
 *   prompt captured via the `beforeinstallprompt` event.
 * - **iOS Safari**: Step-by-step instructions using the native Share sheet.
 *
 * The banner is hidden when the app is already installed (standalone mode) or
 * when the user has dismissed it (snoozed for 7 days).
 *
 * Usage:
 *   <InstallBanner />
 */

import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export function InstallBanner() {
  const { isInstallable, isIOS, isInstalled, isDismissed, promptInstall, dismiss } =
    useInstallPrompt();

  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Nothing to show if installed, dismissed, or not installable
  if (isInstalled || isDismissed || !isInstallable) return null;

  return (
    <div
      role="complementary"
      aria-label="Install Fire Santa Run"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 2rem)',
        maxWidth: '480px',
        backgroundColor: '#212121',
        color: '#fff',
        borderRadius: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        zIndex: 9998,
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Main banner row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
        }}
      >
        {/* App icon */}
        <img
          src="/icon-96x96.png"
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          style={{ borderRadius: '10px', flexShrink: 0 }}
        />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
            🎅 Add to Home Screen
          </div>
          <div style={{ fontSize: '0.775rem', color: '#bdbdbd', marginTop: '0.125rem' }}>
            Track Santa from your home screen!
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {isIOS ? (
            <button
              onClick={() => setShowIOSInstructions((v) => !v)}
              aria-expanded={showIOSInstructions}
              aria-controls="ios-install-instructions"
              style={installButtonStyle}
            >
              How to install
            </button>
          ) : (
            <button onClick={promptInstall} style={installButtonStyle}>
              Install
            </button>
          )}

          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            style={dismissButtonStyle}
          >
            ✕
          </button>
        </div>
      </div>

      {/* iOS instructions (expandable) */}
      {isIOS && showIOSInstructions && (
        <div
          id="ios-install-instructions"
          role="region"
          aria-label="iOS installation instructions"
          style={{
            borderTop: '1px solid #424242',
            padding: '0.875rem 1rem 1rem',
            fontSize: '0.825rem',
            lineHeight: 1.5,
            color: '#e0e0e0',
          }}
        >
          <p style={{ margin: '0 0 0.625rem', fontWeight: 600, color: '#fff' }}>
            Install on iPhone / iPad:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
            <li style={{ marginBottom: '0.375rem' }}>
              Tap the{' '}
              <span
                aria-label="Share button"
                style={{
                  display: 'inline-block',
                  background: '#424242',
                  borderRadius: '4px',
                  padding: '0 4px',
                  fontWeight: 600,
                }}
              >
                ⬆ Share
              </span>{' '}
              button in Safari&apos;s toolbar
            </li>
            <li style={{ marginBottom: '0.375rem' }}>
              Scroll down and tap{' '}
              <strong>&ldquo;Add to Home Screen&rdquo;</strong>
            </li>
            <li>
              Tap <strong>&ldquo;Add&rdquo;</strong> in the top-right corner
            </li>
          </ol>
          <p style={{ margin: '0.625rem 0 0', color: '#9e9e9e', fontSize: '0.75rem' }}>
            The app will appear on your home screen like a native app.
          </p>
        </div>
      )}
    </div>
  );
}

const installButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.85rem',
  background: 'linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.825rem',
  whiteSpace: 'nowrap',
};

const dismissButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  background: 'transparent',
  color: '#9e9e9e',
  border: '1px solid #424242',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '0.75rem',
  lineHeight: 1,
};
