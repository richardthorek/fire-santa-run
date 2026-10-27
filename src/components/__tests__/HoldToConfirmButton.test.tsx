import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { HoldToConfirmButton } from '../HoldToConfirmButton';

/** Frames are queued by hand so each test controls time exactly. */
let frames: FrameRequestCallback[] = [];
let now = 0;

function advance(ms: number) {
  now += ms;
  const pending = frames;
  frames = [];
  pending.forEach(cb => cb(now));
}

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    frames = [];
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      frames = [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fires only after being held for the full hold time', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton label="Stop" holdMs={1000} onConfirm={onConfirm}>X</HoldToConfirmButton>);
    const button = screen.getByRole('button', { name: 'Stop' });

    fireEvent.pointerDown(button);
    advance(600);
    expect(onConfirm).not.toHaveBeenCalled();

    advance(500);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does nothing when released early', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton label="Stop" holdMs={1000} onConfirm={onConfirm}>X</HoldToConfirmButton>);
    const button = screen.getByRole('button', { name: 'Stop' });

    fireEvent.pointerDown(button);
    advance(400);
    fireEvent.pointerUp(button);
    advance(2000);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('accepts a held Enter key as well as a press', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton label="Stop" holdMs={1000} onConfirm={onConfirm}>X</HoldToConfirmButton>);
    const button = screen.getByRole('button', { name: 'Stop' });

    fireEvent.keyDown(button, { key: 'Enter' });
    advance(1000);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
