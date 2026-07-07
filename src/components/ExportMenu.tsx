/**
 * ExportMenu — modal offering JSON / CSV / KML downloads (and a print-friendly
 * summary for a single route). Used from RouteDetail (single route) and the
 * Dashboard (bulk export of all brigade routes).
 */

import { useEffect, useRef } from 'react';
import type { Route } from '../types';
import type { Brigade } from '../storage/types';
import { exportRoute, exportRoutes, openPrintableRouteSummary } from '../utils/routeExport';
import { COLORS, Z_INDEX } from '../utils/constants';

export interface ExportMenuProps {
  /** When set, exports just this route (and enables the print summary) */
  route?: Route;
  /** All routes — used for bulk export when `route` is not set */
  routes?: Route[];
  brigade?: Brigade | null;
  onClose: () => void;
}

const FORMATS: Array<{ format: 'json' | 'csv' | 'kml'; icon: string; label: string; hint: string }> = [
  { format: 'json', icon: '🗂️', label: 'JSON backup', hint: 'Full data — re-importable into Fire Santa Run' },
  { format: 'csv', icon: '📊', label: 'CSV spreadsheet', hint: 'One row per stop — opens in Excel' },
  { format: 'kml', icon: '🌏', label: 'KML', hint: 'Opens in Google Earth / Google My Maps' },
];

export function ExportMenu({ route, routes, brigade, onClose }: ExportMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isBulk = !route;
  const count = isBulk ? (routes?.length ?? 0) : 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    dialogRef.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleExport = (format: 'json' | 'csv' | 'kml') => {
    if (route) {
      exportRoute(route, format, brigade);
    } else if (routes) {
      exportRoutes(routes, format, brigade);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export routes"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.modal,
        padding: '1rem',
      }}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          padding: '1.5rem',
          width: 'min(420px, 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: COLORS.fireRed }}>
            📤 Export {isBulk ? `${count} route${count === 1 ? '' : 's'}` : `"${route!.name}"`}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close export menu"
            style={{
              background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer',
              color: COLORS.neutral700, minWidth: '44px', minHeight: '44px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {FORMATS.map(({ format, icon, label, hint }) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={count === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem', textAlign: 'left',
                background: 'white', border: `2px solid ${COLORS.neutral300}`,
                borderRadius: '12px', cursor: count === 0 ? 'not-allowed' : 'pointer',
                opacity: count === 0 ? 0.5 : 1, transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.fireRed; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.neutral300; }}
            >
              <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{icon}</span>
              <span>
                <span style={{ display: 'block', fontWeight: 600, color: COLORS.neutral900 }}>{label}</span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: COLORS.neutral700 }}>{hint}</span>
              </span>
            </button>
          ))}

          {route && (
            <button
              onClick={() => { openPrintableRouteSummary(route, brigade); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem', textAlign: 'left',
                background: `linear-gradient(135deg, ${COLORS.christmasGreen} 0%, ${COLORS.eucalyptusGreen} 100%)`,
                color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: '1.5rem' }} aria-hidden="true">🖨️</span>
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>Print / save as PDF</span>
                <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.9 }}>
                  Route summary with map, stops and instructions
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
