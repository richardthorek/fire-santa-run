/**
 * ErrorBoundary component
 *
 * Catches render/lifecycle errors in its subtree and shows a friendly,
 * on-brand fallback instead of a blank white screen. Errors are routed
 * through `logClientError` so they can be wired to monitoring (#340).
 *
 * Usage:
 *   <ErrorBoundary fullScreen>           // top-level, app-wide
 *   <ErrorBoundary label="navigation">   // around a heavy route/page
 *
 * React error boundaries must be class components.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logClientError } from '../utils/errorLogger';
import './ErrorBoundary.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Render the fallback at full viewport height (top-level boundary). */
  fullScreen?: boolean;
  /** Human-readable name of the area, used in logs and the reset hint. */
  label?: string;
  /**
   * Custom fallback. Receives the error and a reset callback that clears the
   * boundary so the subtree can attempt to re-render.
   */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional extra hook for callers that want to react to the error. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logClientError(error, {
      source: 'react-error-boundary',
      componentStack: info.componentStack ?? undefined,
      extra: { label: this.props.label },
    });
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback, fullScreen, label } = this.props;

    if (error === null) return children;

    if (fallback) return fallback(error, this.reset);

    const isDev = import.meta.env.DEV;

    return (
      <div
        className={`error-boundary${fullScreen ? ' error-boundary--fullscreen' : ''}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="error-boundary__card">
          <div className="error-boundary__emoji" role="img" aria-label="Surprised Santa">
            🎅
          </div>
          <h1 className="error-boundary__title">Ho ho — something went wrong</h1>
          <p className="error-boundary__message">
            {label
              ? `The ${label} ran into a problem.`
              : 'Santa hit an unexpected snag.'}{' '}
            You can try again, or head back to safety.
          </p>
          <div className="error-boundary__actions">
            <button
              type="button"
              className="error-boundary__button error-boundary__button--primary"
              onClick={this.reset}
            >
              Try again
            </button>
            <a
              className="error-boundary__button error-boundary__button--secondary"
              href="/"
            >
              Back to home
            </a>
          </div>
          {isDev && (
            <details className="error-boundary__details">
              <summary>Error details (dev only)</summary>
              <pre>{error.stack ?? error.message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
