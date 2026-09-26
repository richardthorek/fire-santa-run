/**
 * ShareModal component
 * Modal wrapper for SharePanel
 * Can be triggered from Dashboard or other route views
 */

import { useEffect, useRef } from 'react';
import { SharePanel } from './SharePanel';
import { COLORS, Z_INDEX } from '../utils/constants';
import type { Route } from '../types';

export interface ShareModalProps {
  route: Route;
  isOpen: boolean;
  onClose: () => void;
}

const TITLE_ID = 'share-modal-title';
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ShareModal({ route, isOpen, onClose }: ShareModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Escape closes; Tab is trapped within the dialog; focus moves in on open
  // and returns to whatever triggered the modal on close.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        style={{
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Visually-hidden title so the dialog has an accessible name — the
            visible heading lives inside SharePanel itself. */}
        <h2 id={TITLE_ID} className="sr-only">
          Share {route.name}
        </h2>

        {/* Close button — ≥44px hit target */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            width: '44px',
            height: '44px',
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
