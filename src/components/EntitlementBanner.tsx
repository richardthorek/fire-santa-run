/**
 * EntitlementBanner — shown on the dashboard when the current organisation
 * does not have Fire Santa Run enabled. Links out to Station Manager to
 * enable it (bundled in Basic/AI Pro, or a standalone add-on) — Fire Santa
 * Run has no billing of its own.
 */

import { useBrigade } from '../context';
import { SUITE_AUTH_URL } from '../auth/suiteAuth';

export function EntitlementBanner() {
  const { isEntitled } = useBrigade();
  if (isEntitled) return null;

  return (
    <div
      role="region"
      aria-label="Fire Santa Run not enabled"
      style={{
        background: 'linear-gradient(135deg, var(--fire-red), var(--summer-gold))',
        color: '#ffffff',
        borderRadius: 'var(--border-radius-lg, 16px)',
        padding: '1rem 1.25rem',
        margin: '0 0 1rem',
        boxShadow: 'var(--ui-shadow, 0 4px 12px rgba(0,0,0,0.15))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
        <span role="img" aria-hidden="true" style={{ fontSize: '1.5rem' }}>
          🎅
        </span>
        <div>
          <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading, inherit)' }}>
            Enable Fire Santa Run for your organisation
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.95 }}>
            Included with Basic/AI Pro, or $10/year standalone. Ask your organisation owner.
          </div>
        </div>
      </div>
      <a
        href={`${SUITE_AUTH_URL}/admin/organization`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: '#ffffff',
          color: 'var(--fire-red, #D32F2F)',
          border: 'none',
          borderRadius: 'var(--border-radius, 12px)',
          padding: '0.6rem 1.1rem',
          fontWeight: 700,
          fontSize: '0.95rem',
          whiteSpace: 'nowrap',
          textDecoration: 'none',
        }}
      >
        Open Station Manager
      </a>
    </div>
  );
}
