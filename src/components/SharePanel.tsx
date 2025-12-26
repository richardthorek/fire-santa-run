/**
 * SharePanel component
 * Displays shareable link, QR code, and social media share buttons
 * For published routes only
 */

import { useState, useRef, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { COLORS, FLOATING_PANEL } from '../utils/constants';
import type { Route } from '../types';

export interface SharePanelProps {
  route: Route;
  showPrintButton?: boolean;
  compact?: boolean;
}

export function SharePanel({ route, showPrintButton = true, compact = false }: SharePanelProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const shareableLink = route.shareableLink || `${window.location.origin}/track/${route.id}`;

  // Reset copy success message after 2 seconds
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a larger canvas with padding and branding
    const size = 400;
    const padding = 40;
    const brandingHeight = 80;
    const totalHeight = size + padding * 2 + brandingHeight;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = size + padding * 2;
    exportCanvas.height = totalHeight;
    const ctx = exportCanvas.getContext('2d');
    
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Add branding text at top
    ctx.fillStyle = COLORS.fireRed;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎅 Fire Santa Run', exportCanvas.width / 2, 40);

    ctx.fillStyle = COLORS.neutral700;
    ctx.font = '16px sans-serif';
    ctx.fillText(route.name, exportCanvas.width / 2, 65);

    // Draw QR code
    ctx.drawImage(canvas, padding, brandingHeight + padding, size, size);

    // Add link text at bottom (truncated if too long)
    ctx.fillStyle = COLORS.neutral700;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const linkText = shareableLink.length > 50 
      ? shareableLink.substring(0, 47) + '...' 
      : shareableLink;
    ctx.fillText(linkText, exportCanvas.width / 2, totalHeight - 15);

    // Download
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `santa-run-${route.id}-qr.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handlePrint = () => {
    setShowPrintView(true);
    // Wait for the print view to render, then trigger print
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 100);
  };

  const shareToTwitter = () => {
    const text = `🎅 Track Santa in real-time for ${route.name}! Join us on ${route.date}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareableLink)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableLink)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  const shareToWhatsApp = () => {
    const text = `🎅 Track Santa in real-time for ${route.name}! ${shareableLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  if (showPrintView) {
    return (
      <div className="print-view">
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-view, .print-view * {
              visibility: visible;
            }
            .print-view {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 2rem;
            }
          }
        `}</style>
        <div style={{
          textAlign: 'center',
          fontFamily: 'sans-serif',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '2rem',
        }}>
          <h1 style={{ color: COLORS.fireRed, marginBottom: '1rem' }}>
            🎅 Fire Santa Run
          </h1>
          <h2 style={{ color: COLORS.neutral900, marginBottom: '0.5rem' }}>
            {route.name}
          </h2>
          <p style={{ color: COLORS.neutral700, fontSize: '1.1rem', marginBottom: '2rem' }}>
            {route.date} at {route.startTime}
          </p>

          <div style={{ marginBottom: '2rem' }}>
            <QRCodeCanvas
              value={shareableLink}
              size={300}
              level="H"
              includeMargin={true}
            />
          </div>

          <div style={{
            backgroundColor: COLORS.neutral100,
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}>
            <p style={{ 
              color: COLORS.neutral900, 
              fontSize: '1rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
            }}>
              Track Santa in Real-Time!
            </p>
            <p style={{ 
              color: COLORS.neutral700, 
              fontSize: '0.9rem',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}>
              {shareableLink}
            </p>
          </div>

          {route.description && (
            <p style={{ 
              color: COLORS.neutral700, 
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}>
              {route.description}
            </p>
          )}

          <p style={{ 
            color: COLORS.neutral700, 
            fontSize: '0.85rem',
            fontStyle: 'italic',
          }}>
            Scan the QR code or visit the link above to track Santa's location live!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: FLOATING_PANEL.borderRadius.standard,
      padding: compact ? '1rem' : '1.5rem',
      boxShadow: FLOATING_PANEL.shadow.standard,
    }}>
      <h3 style={{ 
        margin: 0,
        marginBottom: '1rem',
        color: COLORS.neutral900,
        fontSize: compact ? '1rem' : '1.25rem',
      }}>
        🎁 Share Your Route
      </h3>

      {/* QR Code */}
      <div ref={qrRef} style={{
        textAlign: 'center',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '1rem',
          backgroundColor: 'white',
          borderRadius: '12px',
          border: `2px solid ${COLORS.neutral200}`,
        }}>
          <QRCodeCanvas
            value={shareableLink}
            size={compact ? 150 : 200}
            level="H"
            includeMargin={true}
          />
        </div>
      </div>

      {/* Link Display */}
      <div style={{
        backgroundColor: COLORS.neutral100,
        padding: '0.75rem',
        borderRadius: '8px',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <input
          type="text"
          value={shareableLink}
          readOnly
          style={{
            flex: 1,
            border: 'none',
            backgroundColor: 'transparent',
            color: COLORS.neutral900,
            fontSize: '0.875rem',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
        <button
          onClick={handleCopyLink}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: copySuccess ? COLORS.christmasGreen : COLORS.skyBlue,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          {copySuccess ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleDownloadQR}
          style={{
            flex: 1,
            minWidth: '140px',
            padding: '0.75rem 1rem',
            backgroundColor: COLORS.fireRed,
            color: 'white',
            border: 'none',
            borderRadius: FLOATING_PANEL.borderRadius.button,
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          ⬇️ Download QR
        </button>
        {showPrintButton && (
          <button
            onClick={handlePrint}
            style={{
              flex: 1,
              minWidth: '140px',
              padding: '0.75rem 1rem',
              backgroundColor: COLORS.summerGold,
              color: 'white',
              border: 'none',
              borderRadius: FLOATING_PANEL.borderRadius.button,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            🖨️ Print Flyer
          </button>
        )}
      </div>

      {/* Social Media Share Buttons */}
      <div style={{
        borderTop: `1px solid ${COLORS.neutral200}`,
        paddingTop: '1rem',
      }}>
        <p style={{
          margin: 0,
          marginBottom: '0.75rem',
          color: COLORS.neutral700,
          fontSize: '0.875rem',
          fontWeight: 600,
        }}>
          Share on social media:
        </p>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={shareToTwitter}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '0.65rem 1rem',
              backgroundColor: '#1DA1F2',
              color: 'white',
              border: 'none',
              borderRadius: FLOATING_PANEL.borderRadius.button,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            🐦 Twitter
          </button>
          <button
            onClick={shareToFacebook}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '0.65rem 1rem',
              backgroundColor: '#1877F2',
              color: 'white',
              border: 'none',
              borderRadius: FLOATING_PANEL.borderRadius.button,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            📘 Facebook
          </button>
          <button
            onClick={shareToWhatsApp}
            style={{
              flex: 1,
              minWidth: '90px',
              padding: '0.65rem 1rem',
              backgroundColor: '#25D366',
              color: 'white',
              border: 'none',
              borderRadius: FLOATING_PANEL.borderRadius.button,
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            💬 WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
