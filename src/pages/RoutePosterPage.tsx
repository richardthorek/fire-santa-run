/**
 * RoutePosterPage — printable A4 promo poster for a published Santa run.
 *
 * Brigades promote runs with corflute signs, noticeboards, and Facebook posts;
 * this page gives them a ready-to-print poster (QR code + date/time + brigade
 * branding) in one click from the share flow. Uses the public route lookup so
 * the poster keeps working for anyone with the link — no login required.
 *
 * Print styling targets A4 portrait; the toolbar hides itself when printing.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { storageAdapter } from '../storage';
// Direct import: the components barrel drags mapbox-gl into this page's chunk.
import { SEO } from '../components/SEO';
import { safeImageSrc } from '../utils/publicBrigade';
import { generateShareableLink } from '../utils/routeHelpers';
import type { Route } from '../types';
import type { Brigade } from '../storage/types';

function formatPosterDate(date: string, startTime: string): { day: string; time: string } {
  const parsed = new Date(`${date}T${startTime || '00:00'}`);
  if (Number.isNaN(parsed.getTime())) return { day: date, time: startTime };
  return {
    day: parsed.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
    time: parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

export function RoutePosterPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [brigade, setBrigade] = useState<Brigade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await storageAdapter.getPublicRoute(id);
        if (cancelled) return;
        setRoute(r ?? null);
        if (r) {
          const b = await storageAdapter.getBrigade(r.brigadeId).catch(() => null);
          if (!cancelled) setBrigade(b ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>Loading poster…</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <SEO title="Poster not found" />
        <h1 style={{ color: 'var(--fire-red)' }}>We couldn&apos;t find that Santa run</h1>
        <p>The route may not be published yet.</p>
        <Link to="/dashboard">← Back to dashboard</Link>
      </div>
    );
  }

  const shareUrl = route.shareableLink || generateShareableLink(route.id);
  const { day, time } = formatPosterDate(route.date, route.startTime);
  const logoSrc = safeImageSrc(brigade?.logo);
  const accent = brigade?.themeColor || 'var(--fire-red)';

  return (
    <div style={{ background: 'var(--neutral-100)', minHeight: '100vh', padding: '1rem' }}>
      <SEO title={`Poster — ${route.name}`} />

      {/* Toolbar — hidden when printing */}
      <div
        className="poster-toolbar"
        style={{
          maxWidth: '210mm',
          margin: '0 auto 1rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Link to="/dashboard" style={{ color: 'var(--fire-red)', fontWeight: 600, textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'linear-gradient(135deg, var(--fire-red), var(--fire-red-dark, #B71C1C))',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.3)',
          }}
        >
          🖨️ Print poster
        </button>
      </div>

      {/* The A4 poster */}
      <div
        className="poster-sheet"
        style={{
          width: '210mm',
          minHeight: '285mm',
          maxWidth: '100%',
          margin: '0 auto',
          background: 'white',
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '14mm 12mm',
          boxSizing: 'border-box',
          borderTop: `10mm solid ${accent}`,
        }}
      >
        {/* Brigade identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4mm' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="" style={{ width: '22mm', height: '22mm', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '18mm', lineHeight: 1 }} aria-hidden="true">🚒</span>
          )}
          {brigade && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '7mm', color: 'var(--neutral-900)' }}>
                {brigade.name}
              </div>
              {brigade.location && (
                <div style={{ fontSize: '4mm', color: 'var(--neutral-700)' }}>{brigade.location}</div>
              )}
            </div>
          )}
        </div>

        <div style={{ fontSize: '26mm', lineHeight: 1, margin: '2mm 0' }} aria-hidden="true">🎅</div>

        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '15mm',
            lineHeight: 1.1,
            color: accent,
            margin: '2mm 0 1mm',
          }}
        >
          Santa is coming!
        </h1>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: '7mm', margin: '0 0 4mm', color: 'var(--neutral-900)' }}>
          {route.name}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '6mm',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            margin: '0 0 6mm',
            fontSize: '7mm',
            fontWeight: 700,
            color: 'var(--neutral-900)',
          }}
        >
          <span>📅 {day}</span>
          <span>⏰ from {time}</span>
        </div>

        {/* QR code */}
        <div
          style={{
            padding: '6mm',
            border: `2mm solid ${accent}`,
            borderRadius: '6mm',
            background: 'white',
          }}
        >
          <QRCodeCanvas value={shareUrl} size={420} includeMargin={false} style={{ width: '80mm', height: '80mm' }} />
        </div>

        <p style={{ fontSize: '6.5mm', fontWeight: 800, margin: '5mm 0 1mm', color: 'var(--neutral-900)' }}>
          📱 Scan to track Santa LIVE
        </p>
        <p style={{ fontSize: '4mm', color: 'var(--neutral-700)', margin: 0, wordBreak: 'break-all' }}>
          {shareUrl.replace(/^https?:\/\//, '')}
        </p>
        <p style={{ fontSize: '3.8mm', color: 'var(--neutral-600)', margin: '3mm 0 0' }}>
          Free on any phone — no app, no sign-up. Watch the truck move street by street.
        </p>

        <div style={{ marginTop: 'auto', paddingTop: '5mm', fontSize: '3.2mm', color: 'var(--neutral-500)' }}>
          🎄 Powered by Fire Santa Run
        </div>
      </div>

      {/* Print rules: only the sheet, at true A4 */}
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { background: white !important; }
            .poster-toolbar { display: none !important; }
            .poster-sheet {
              box-shadow: none !important;
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 !important;
            }
          }
        `}
      </style>
    </div>
  );
}
