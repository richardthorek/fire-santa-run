import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

/** Child that throws on first render, then succeeds after reset. */
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom');
  }
  return <div>recovered content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors to console.error; silence to keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>,
    );
    // getByText throws if absent, so reaching the assertion means it rendered.
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('renders the fallback UI instead of crashing when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('mentions the provided label in the fallback message', () => {
    render(
      <ErrorBoundary label="Santa tracker">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Santa tracker/i)).toBeTruthy();
  });

  it('recovers when reset is clicked and the child no longer throws', () => {
    function Wrapper() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <ErrorBoundary
          fallback={(_error, reset) => (
            <button
              type="button"
              onClick={() => {
                setShouldThrow(false);
                reset();
              }}
            >
              retry
            </button>
          )}
        >
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByText('recovered content')).toBeTruthy();
  });

  it('invokes onError and the global error sink', () => {
    const onError = vi.fn();
    const sink = vi.fn();
    window.__onClientError = sink;

    render(
      <ErrorBoundary onError={onError}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledTimes(1);
    const [reportedError, context] = sink.mock.calls[0];
    expect(reportedError).toBeInstanceOf(Error);
    expect(context.source).toBe('react-error-boundary');

    delete window.__onClientError;
  });
});
