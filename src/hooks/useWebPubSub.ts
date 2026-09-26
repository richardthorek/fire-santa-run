/**
 * useWebPubSub hook
 * Manages the realtime tracking connection for a route.
 * - Production: a native WebSocket to the server's own /api/ws endpoint (the
 *   negotiate call returns the full wss:// URL, plus a signed token for
 *   broadcaster/editor roles). In-process fan-out — no Azure Web PubSub.
 * - Dev mode: BroadcastChannel API for cross-tab local testing.
 * The hook name is retained for churn; it no longer uses Azure Web PubSub.
 *
 * Reconnection (production WS path): exponential backoff with jitter, capped
 * at ~30s, with no hard attempt limit — a viewer's tab left open overnight
 * should keep trying quietly rather than giving up. A failed negotiate call
 * (not just a socket close) also schedules a retry. Bringing the tab back to
 * the foreground (`visibilitychange` → visible) or regaining connectivity
 * (`online`) resets the backoff and retries immediately, so a phone that was
 * asleep or briefly offline catches up fast instead of waiting out whatever
 * delay it had backed off to.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LocationBroadcast, ViewerCountMessage, ViewerPinsMessage, RunStatus, RunStatusMessage } from '../types';
import { getApiAuthHeaders } from '../auth/apiToken';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/** Result of a broadcaster send — lets callers (useLocationBroadcast) track health. */
export interface BroadcastSendResult {
  ok: boolean;
  /** HTTP status of the failed response, when the failure was a non-OK response rather than a network error. */
  status?: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface WebPubSubConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  /** Coarse connection lifecycle for UI — see {@link ConnectionStatus}. */
  connectionStatus: ConnectionStatus;
  error: string | null;
  viewerCount: number | null;
  /**
   * Aggregated waiting-spot pins from opt-in viewers — only ever populated for
   * the broadcaster (navigator) role; the server never sends this to viewers.
   */
  viewerPins: { cells: ViewerPinsMessage['cells']; total: number } | null;
  /** Live run status pushed from the navigator (null until one is received). */
  runStatus: RunStatus | null;
  /** Optional operator note attached to the current run status. */
  runStatusMessage: string | null;
}

interface UseWebPubSubOptions {
  routeId: string;
  role?: 'viewer' | 'broadcaster';
  onLocationUpdate?: (location: LocationBroadcast) => void;
  shareSource?: string; // Track how viewer found the route (e.g., 'qr', 'direct', 'social')
  /** Set false to skip connecting entirely (e.g. the simulated demo run). */
  enabled?: boolean;
}

// Generate a unique session ID for each viewer session using cryptographically secure randomness
function generateSessionId(): string {
  return crypto.randomUUID();
}

const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

/** Exponential backoff with jitter, capped at MAX_RECONNECT_DELAY_MS. */
function computeReconnectDelay(attempt: number): number {
  const exp = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** attempt);
  // Jitter within the top half of the window so retries from many tabs/devices spread out.
  return Math.round(exp * (0.5 + Math.random() * 0.5));
}

export function useWebPubSub({ routeId, role = 'viewer', onLocationUpdate, shareSource, enabled = true }: UseWebPubSubOptions) {
  const [state, setState] = useState<WebPubSubConnectionState>({
    isConnected: false,
    isConnecting: false,
    connectionStatus: 'connecting',
    error: null,
    viewerCount: null,
    viewerPins: null,
    runStatus: null,
    runStatusMessage: null,
  });

  const applyRunStatus = useCallback((msg: RunStatusMessage) => {
    setState(prev => ({ ...prev, runStatus: msg.status, runStatusMessage: msg.message ?? null }));
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  // The connection is established once per routeId/role, but callers typically
  // pass a fresh callback closure on every render. Route messages through a
  // ref so the latest closure always runs (avoids stale route/state bugs).
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // True once the consumer unmounts / disconnects, so a socket closing during
  // teardown does not trigger a reconnect.
  const disposedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // Mirrors "is there a live/pending connection" synchronously, so the
  // visibility/online handlers (and connect() itself) can guard against
  // opening a second socket without waiting on a state update.
  const connectionOpenRef = useRef(false);
  // Holds the latest `connect` closure so scheduleReconnect (defined before
  // connect, and with stable identity) never calls a stale one — same pattern
  // as onLocationUpdateRef above: assigned synchronously during render.
  const connectRef = useRef<() => void>(() => {});
  const sessionIdRef = useRef<string>(generateSessionId());
  const sessionStartTimeRef = useRef<number>(Date.now());
  const viewerCountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 30s keeps the badge feeling live while quartering the request volume of
  // the old 10s poll — every open tracking page runs this loop, and the free
  // App Service tiers pay for each request in shared CPU quota.
  const VIEWER_COUNT_POLL_INTERVAL_MS = 30000;

  /**
   * Fetch current viewer count from API. Skipped while the tab is hidden —
   * backgrounded phones on a tracking page shouldn't keep the server busy.
   */
  const fetchViewerCount = useCallback(async () => {
    if (role !== 'viewer') return;
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      if (isDevMode) {
        // Mock viewer count in dev mode (realistic demo data)
        const mockCount = Math.floor(Math.random() * 15) + 3;
        setState(prev => ({ ...prev, viewerCount: mockCount }));
      } else {
        const response = await fetch(`${API_BASE_URL}/analytics/routes/${routeId}/viewer-count`);
        if (response.ok) {
          const data = await response.json();
          setState(prev => ({ ...prev, viewerCount: data.count }));
        }
      }
    } catch (error) {
      console.error('[ViewerCount] Failed to fetch viewer count:', error);
    }
  }, [routeId, role]);

  /**
   * Log viewer session join event
   */
  const logViewerJoin = useCallback(async () => {
    if (role !== 'viewer') return;

    try {
      if (isDevMode) {
        // Mock log in dev mode
        console.log('[Analytics] Viewer session join (mock):', sessionIdRef.current);
      } else {
        await fetch(`${API_BASE_URL}/analytics/viewer-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId,
            sessionId: sessionIdRef.current,
            joinedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            shareSource: shareSource || 'direct',
          }),
        });
        console.log('[Analytics] Viewer session join logged:', sessionIdRef.current);
      }
    } catch (error) {
      console.error('[Analytics] Failed to log viewer join:', error);
    }
  }, [routeId, role, shareSource]);

  /**
   * Log viewer session leave event
   */
  const logViewerLeave = useCallback(async () => {
    if (role !== 'viewer') return;

    const viewDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

    try {
      if (isDevMode) {
        // Mock log in dev mode
        console.log('[Analytics] Viewer session leave (mock):', sessionIdRef.current, 'Duration:', viewDuration, 'seconds');
      } else {
        await fetch(`${API_BASE_URL}/analytics/viewer-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId,
            sessionId: sessionIdRef.current,
            leftAt: new Date().toISOString(),
            viewDuration,
          }),
        });
        console.log('[Analytics] Viewer session leave logged:', sessionIdRef.current, 'Duration:', viewDuration, 'seconds');
      }
    } catch (error) {
      console.error('[Analytics] Failed to log viewer leave:', error);
    }
  }, [routeId, role]);

  /**
   * Schedule a reconnect attempt with exponential backoff + jitter. No hard
   * attempt cap — a tab left open should keep quietly retrying. Safe to call
   * repeatedly; it always clears any previously-scheduled attempt first.
   */
  const scheduleReconnect = useCallback(() => {
    if (disposedRef.current || !enabledRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = computeReconnectDelay(reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    setState(prev => ({ ...prev, isConnected: false, isConnecting: false, connectionStatus: 'reconnecting' }));

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectRef.current();
    }, delay);
  }, []);

  /**
   * Connect to Web PubSub or BroadcastChannel
   */
  const connect = useCallback(async () => {
    // Guard against opening a second connection (e.g. a visibility/online
    // trigger racing with an in-flight connect or an already-open socket).
    if (connectionOpenRef.current) return;
    connectionOpenRef.current = true;

    setState(prev => ({ ...prev, isConnecting: true, connectionStatus: 'connecting', error: null }));

    try {
      if (isDevMode) {
        // Development mode: Use BroadcastChannel API for local testing
        const channelName = `santa-tracking-${routeId}`;
        const channel = new BroadcastChannel(channelName);

        channel.onmessage = (event) => {
          if (event.data) {
            const data = event.data;
            // Handle viewer count messages
            if (data.type === 'viewer-count') {
              const viewerCountMsg = data as ViewerCountMessage;
              setState(prev => ({ ...prev, viewerCount: viewerCountMsg.count }));
            }
            else if (data.type === 'viewer-pins') {
              const msg = data as ViewerPinsMessage;
              setState(prev => ({ ...prev, viewerPins: { cells: msg.cells, total: msg.total } }));
            }
            // Handle live run status (paused / aborted / completed / active)
            else if (data.type === 'run-status') {
              applyRunStatus(data as RunStatusMessage);
            }
            // Handle location updates
            else if (onLocationUpdateRef.current) {
              onLocationUpdateRef.current(data as LocationBroadcast);
            }
          }
        };

        broadcastChannelRef.current = channel;
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, connectionStatus: 'connected', error: null }));
        console.log(`[Dev Mode] Connected to BroadcastChannel: ${channelName}`);

        // Log viewer join
        await logViewerJoin();

        // Start polling viewer count in dev mode
        if (role === 'viewer') {
          fetchViewerCount();
          viewerCountIntervalRef.current = setInterval(fetchViewerCount, VIEWER_COUNT_POLL_INTERVAL_MS);
        }
      } else {
        // Production mode: native WebSocket to our own /api/ws endpoint.
        // negotiate returns the full wss:// URL (with a signed token embedded for
        // broadcaster/editor roles); it must be authenticated for those roles.
        const negotiateUrl = `${API_BASE_URL}/negotiate?routeId=${encodeURIComponent(routeId)}&role=${role}`;
        const negotiateHeaders = role === 'broadcaster' ? await getApiAuthHeaders() : undefined;
        const response = await fetch(negotiateUrl, negotiateHeaders ? { headers: negotiateHeaders } : undefined);

        if (!response.ok) {
          throw new Error(`Failed to negotiate connection: ${response.statusText}`);
        }

        const { url } = await response.json();

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          setState(prev => ({ ...prev, isConnected: true, isConnecting: false, connectionStatus: 'connected', error: null }));
          reconnectAttemptsRef.current = 0;
          console.log(`[Realtime] Connected for route: ${routeId}`);
          // The server pushes authoritative viewer counts over the socket, so
          // there is no polling here anymore.
          logViewerJoin();
        };

        ws.onmessage = (event) => {
          let data: unknown;
          try {
            data = JSON.parse(event.data);
          } catch {
            return; // ignore non-JSON frames
          }
          const msgType = typeof data === 'object' && data !== null && 'type' in data
            ? (data as { type?: string }).type
            : undefined;
          if (msgType === 'viewer-count') {
            const viewerCountMsg = data as ViewerCountMessage;
            setState(prev => ({ ...prev, viewerCount: viewerCountMsg.count }));
          } else if (msgType === 'viewer-pins') {
            const msg = data as ViewerPinsMessage;
            setState(prev => ({ ...prev, viewerPins: { cells: msg.cells, total: msg.total } }));
          } else if (msgType === 'run-status') {
            applyRunStatus(data as RunStatusMessage);
          } else if (onLocationUpdateRef.current) {
            onLocationUpdateRef.current(data as LocationBroadcast);
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          connectionOpenRef.current = false;

          // Attempt to reconnect (unless we're tearing down on purpose).
          if (!disposedRef.current) {
            console.log('[Realtime] Connection lost, scheduling reconnect...');
            scheduleReconnect();
          } else {
            setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
          }
        };

        ws.onerror = () => {
          // onclose fires after onerror; reconnect is handled there.
          console.warn('[Realtime] WebSocket error for route:', routeId);
        };
      }
    } catch (error) {
      console.error('[WebPubSub] Connection error:', error);
      connectionOpenRef.current = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }));
      // A failed negotiate (or any other connect-time throw) should retry
      // just like a socket close does — previously only onclose scheduled one.
      if (!disposedRef.current) {
        scheduleReconnect();
      }
    }
  }, [routeId, role, logViewerJoin, fetchViewerCount, applyRunStatus, scheduleReconnect]);
  connectRef.current = connect;

  /**
   * Disconnect from Web PubSub or BroadcastChannel
   */
  const disconnect = useCallback(() => {
    // Mark disposed so a socket close during teardown doesn't trigger reconnect.
    disposedRef.current = true;
    connectionOpenRef.current = false;

    // Log viewer leave before disconnecting
    logViewerLeave();

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear viewer count polling interval (dev mode only)
    if (viewerCountIntervalRef.current) {
      clearInterval(viewerCountIntervalRef.current);
      viewerCountIntervalRef.current = null;
    }

    // Close the WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    // Close BroadcastChannel
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }

    setState({ isConnected: false, isConnecting: false, connectionStatus: 'connecting', error: null, viewerCount: null, viewerPins: null, runStatus: null, runStatusMessage: null });
  }, [logViewerLeave]);

  /**
   * Send location update (broadcaster only). Returns whether the send
   * succeeded (and the HTTP status on a non-OK response) so callers such as
   * useLocationBroadcast can track broadcast health — this hook no longer
   * just swallows failures into a console.error.
   */
  const sendLocation = useCallback(async (location: LocationBroadcast): Promise<BroadcastSendResult> => {
    if (role !== 'broadcaster') {
      console.warn('[WebPubSub] Only broadcasters can send location updates');
      return { ok: false };
    }

    try {
      if (isDevMode) {
        // Development mode: Broadcast via BroadcastChannel
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage(location);
          console.log('[Dev Mode] Broadcasted location:', location);
        }
        return { ok: true };
      } else {
        // Production mode: Send via API. Broadcasting Santa's position is an
        // authenticated action — attach the signed-in user's bearer token.
        const response = await fetch(`${API_BASE_URL}/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getApiAuthHeaders()),
          },
          body: JSON.stringify(location),
        });

        if (!response.ok) {
          console.error(`[WebPubSub] Failed to broadcast location: ${response.statusText}`);
          return { ok: false, status: response.status };
        }

        console.log('[Production] Broadcasted location:', location);
        return { ok: true };
      }
    } catch (error) {
      console.error('[WebPubSub] Failed to send location:', error);
      return { ok: false };
    }
  }, [role]);

  /**
   * Set the live run status (broadcaster only): paused / aborted / resumed
   * (active) / completed. Fans out to every viewer via the hub.
   */
  const sendRunStatus = useCallback(async (status: RunStatus, message?: string): Promise<BroadcastSendResult> => {
    if (role !== 'broadcaster') {
      console.warn('[WebPubSub] Only broadcasters can set run status');
      return { ok: false };
    }
    const payload: RunStatusMessage = { type: 'run-status', routeId, status, message, timestamp: Date.now() };
    try {
      if (isDevMode) {
        broadcastChannelRef.current?.postMessage(payload);
        applyRunStatus(payload); // reflect locally for the operator's own view
        return { ok: true };
      } else {
        const response = await fetch(`${API_BASE_URL}/broadcast/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()) },
          body: JSON.stringify({ routeId, status, message }),
        });
        if (!response.ok) {
          console.error(`[WebPubSub] Failed to set run status: ${response.statusText}`);
          return { ok: false, status: response.status };
        }
        return { ok: true };
      }
    } catch (error) {
      console.error('[WebPubSub] Failed to set run status:', error);
      return { ok: false };
    }
  }, [role, routeId, applyRunStatus]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (!enabled) return;

    // Fresh connection lifecycle — allow reconnects again after a prior teardown.
    disposedRef.current = false;
    reconnectAttemptsRef.current = 0;
    connect();

    // Handle page unload to log viewer leave
    const handleBeforeUnload = () => {
      logViewerLeave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, role, enabled]);

  /**
   * Reconnect immediately (resetting backoff) when the tab regains focus or
   * the device comes back online. Only meaningful for the production WS path
   * — dev mode's BroadcastChannel doesn't have a "connection" to lose.
   */
  useEffect(() => {
    if (isDevMode || !enabled) return;

    const reconnectNow = () => {
      if (disposedRef.current || connectionOpenRef.current) return;
      // Cancel any pending backoff timer and retry immediately with a clean slate.
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      connect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnectNow();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', reconnectNow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', reconnectNow);
    };
  }, [enabled, connect]);

  return {
    ...state,
    connect,
    disconnect,
    sendLocation,
    sendRunStatus,
  };
}
