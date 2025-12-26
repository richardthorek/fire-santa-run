/**
 * ShareModal component
 * Modal wrapper for SharePanel
 * Can be triggered from Dashboard or other route views
 */

import { SharePanel } from './SharePanel';
import { COLORS, Z_INDEX } from '../utils/constants';
import type { Route } from '../types';

export interface ShareModalProps {
  route: Route;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ route, isOpen, onClose }: ShareModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX.modal,
        padding: '1rem',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: COLORS.neutral200,
            color: COLORS.neutral900,
            cursor: 'pointer',
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.neutral300}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.neutral200}
          aria-label="Close share modal"
        >
          ✕
        </button>

        <SharePanel route={route} showPrintButton={true} />
      </div>
    </div>
  );
}
