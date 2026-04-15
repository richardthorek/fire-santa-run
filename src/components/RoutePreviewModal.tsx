/**
 * RoutePreviewModal component
 * Displays a scrollable, print-friendly list of turn-by-turn navigation steps
 * Accessible from the Route Detail page via "Preview Instructions" button
 */

import { ManeuverIcon } from './ManeuverIcon';
import { COLORS, Z_INDEX, FLOATING_PANEL } from '../utils/constants';
import { formatDistance } from '../utils/mapbox';
import type { Route, NavigationStep } from '../types';

export interface RoutePreviewModalProps {
  route: Route;
  isOpen: boolean;
  onClose: () => void;
}

function StepRow({ step, index }: { step: NavigationStep; index: number }) {
  return (
    <div
      className="preview-step-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 0',
        borderBottom: `1px solid ${COLORS.neutral200}`,
      }}
    >
      {/* Step number */}
      <div
        style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}
      >
        {index + 1}
      </div>

      {/* Maneuver icon */}
      <div style={{ flexShrink: 0, width: '32px', textAlign: 'center' }}>
        <ManeuverIcon
          type={step.maneuver.type}
          modifier={step.maneuver.modifier}
          size={22}
        />
      </div>

      {/* Instruction */}
      <div style={{ flex: 1, fontSize: '0.9rem', color: COLORS.neutral900 }}>
        {step.instruction}
      </div>

      {/* Distance */}
      <div
        style={{
          flexShrink: 0,
          fontSize: '0.85rem',
          fontWeight: 600,
          color: COLORS.neutral700,
          minWidth: '50px',
          textAlign: 'right',
        }}
      >
        {formatDistance(step.distance)}
      </div>
    </div>
  );
}

export function RoutePreviewModal({ route, isOpen, onClose }: RoutePreviewModalProps) {
  if (!isOpen) return null;

  const steps = route.navigationSteps ?? [];
  const totalDistance = steps.reduce((sum, s) => sum + s.distance, 0);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Consolidated print styles */}
      <style>{`
        @media print {
          body > *:not(.route-preview-modal-root) {
            display: none !important;
          }
          .route-preview-modal-root {
            display: block !important;
          }
          .preview-no-print {
            display: none !important;
          }
          .preview-print-only {
            display: block !important;
            padding: 1rem 1.5rem;
          }
          .preview-step-row {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="route-preview-modal-root"
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: Z_INDEX.modal,
          padding: '1rem',
        }}
      >
        {/* Modal panel */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: FLOATING_PANEL.borderRadius.standard,
            boxShadow: FLOATING_PANEL.shadow.emphasis,
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="preview-no-print"
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: `1px solid ${COLORS.neutral200}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '1.5rem' }}>🗺️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: COLORS.neutral900,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {route.name}
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: COLORS.neutral700 }}>
                Turn-by-Turn Instructions · {steps.length} step{steps.length !== 1 ? 's' : ''} · {formatDistance(totalDistance)}
              </p>
            </div>

            {/* Print button */}
            <button
              onClick={handlePrint}
              title="Print instructions"
              style={{
                padding: '0.5rem 1rem',
                background: `linear-gradient(135deg, ${COLORS.neutral700} 0%, ${COLORS.neutral800} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
              }}
            >
              🖨️ Print
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: COLORS.neutral200,
                color: COLORS.neutral900,
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.neutral300)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.neutral200)}
            >
              ✕
            </button>
          </div>

          {/* Print-only title (hidden on screen, visible when printing) */}
          <div
            style={{ display: 'none' }}
            className="preview-print-only"
          >
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem' }}>{route.name}</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: COLORS.neutral700 }}>
              Turn-by-Turn Instructions · {steps.length} step{steps.length !== 1 ? 's' : ''} · {formatDistance(totalDistance)}
            </p>
          </div>

          {/* Steps list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 1.5rem',
            }}
          >
            {steps.length === 0 ? (
              <div
                style={{
                  padding: '3rem 0',
                  textAlign: 'center',
                  color: COLORS.neutral700,
                  fontSize: '0.9rem',
                }}
              >
                No navigation steps available.<br />
                Edit the route and fetch directions to generate them.
              </div>
            ) : (
              steps.map((step, i) => (
                <StepRow key={i} step={step} index={i} />
              ))
            )}
          </div>

          {/* Footer */}
          <div
            className="preview-no-print"
            style={{
              padding: '1rem 1.5rem',
              borderTop: `1px solid ${COLORS.neutral200}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: COLORS.neutral700 }}>
              Total distance: <strong>{formatDistance(totalDistance)}</strong>
            </span>
            <button
              onClick={onClose}
              style={{
                padding: '0.6rem 1.25rem',
                background: `linear-gradient(135deg, ${COLORS.fireRed} 0%, ${COLORS.fireRedDark} 100%)`,
                color: 'white',
                border: 'none',
                borderRadius: FLOATING_PANEL.borderRadius.button,
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
