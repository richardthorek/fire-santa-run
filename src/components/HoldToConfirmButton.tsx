import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface HoldToConfirmButtonProps {
  /** Full accessible name, including the hold instruction. */
  label: string;
  /** How long the control must be held before it fires. */
  holdMs?: number;
  onConfirm: () => void;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A button that fires only after it has been held down for `holdMs`. Used for
 * actions that are hard to undo and easy to hit by accident, such as an
 * emergency stop on a phone mounted in a moving truck. Releasing early cancels
 * with no effect. Keyboard users hold Enter or Space the same way.
 */
export function HoldToConfirmButton({
  label,
  holdMs = 1500,
  onConfirm,
  style,
  children,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const cancel = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (frameRef.current !== null) return;
    startedAtRef.current = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(1, (now - startedAtRef.current) / holdMs);
      if (elapsed >= 1) {
        frameRef.current = null;
        setProgress(0);
        onConfirm();
        return;
      }
      setProgress(elapsed);
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
  }, [holdMs, onConfirm]);

  useEffect(() => cancel, [cancel]);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) begin();
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') cancel();
      }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ...style, position: 'relative', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: `${progress * 100}%`,
          background: 'rgba(255, 255, 255, 0.35)',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', display: 'flex' }}>{children}</span>
    </button>
  );
}
