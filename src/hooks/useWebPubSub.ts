/**
 * useWebPubSub hook
 * Manages the realtime tracking connection for a route.
 * - Production: a native WebSocket to the server's own /api/ws endpoint (the
 *   negotiate call returns the full wss:// URL, plus a signed token for
 *   broadcaster/editor roles). In-process fan-out — no Azure Web PubSub.
 * - Dev mode: BroadcastChannel API for cross-tab local testing.
 * The hook name is retained for churn; it no longer uses Azure Web PubSub.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { LocationBroadcast, ViewerCountMessage } from '../types';
import { getApiAuthHeaders } from '../auth/apiToken';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface WebPubSubConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  viewerCount: number | null;
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

export function useWebPubSub({ routeId, role = 'viewer', onLocationUpdate, shareSource, enabled = true }: UseWebPubSubOptions) {
  const [state, setState] = useState<WebPubSubConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    viewerCount: null,
  });

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
  const sessionIdRef = useRef<string>(generateSessionId());
  const sessionStartTimeRef = useRef<number>(Date.now());
  const viewerCountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 3000;
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
   * Connect to Web PubSub or BroadcastChannel
   */
  const connect = useCallback(async () => {
    setState(prev => {
      if (prev.isConnecting || prev.isConnected) {
        return prev;
      }
      return { ...prev, isConnecting: true, error: null };
    });

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
            // Handle location updates
            else if (onLocationUpdateRef.current) {
              onLocationUpdateRef.current(data as LocationBroadcast);
            }
          }
        };

        broadcastChannelRef.current = channel;
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
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
          setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
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
          if (typeof data === 'object' && data !== null && 'type' in data && (data as { type?: string }).type === 'viewer-count') {
            const viewerCountMsg = data as ViewerCountMessage;
            setState(prev => ({ ...prev, viewerCount: viewerCountMsg.count }));
          } else if (onLocationUpdateRef.current) {
            onLocationUpdateRef.current(data as LocationBroadcast);
          }
        };

        ws.onclose = () => {
          setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
          wsRef.current = null;

          // Attempt to reconnect (unless we're tearing down on purpose).
          if (!disposedRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`[Realtime] Reconnecting attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}...`);
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, RECONNECT_DELAY_MS);
          } else if (!disposedRef.current) {
            setState(prev => ({ ...prev, error: 'Connection lost. Please refresh the page.' }));
          }
        };

        ws.onerror = () => {
          // onclose fires after onerror; reconnect is handled there.
          console.warn('[Realtime] WebSocket error for route:', routeId);
        };
      }
    } catch (error) {
      console.error('[WebPubSub] Connection error:', error);
      setState({
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Failed to connect',
        viewerCount: null,
      });
    }
  }, [routeId, role, logViewerJoin, fetchViewerCount]);

  /**
   * Disconnect from Web PubSub or BroadcastChannel
   */
  const disconnect = useCallback(() => {
    // Mark disposed so a socket close during teardown doesn't trigger reconnect.
    disposedRef.current = true;

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

    setState({ isConnected: false, isConnecting: false, error: null, viewerCount: null });
  }, [logViewerLeave]);

  /**
   * Send location update (broadcaster only)
   */
  const sendLocation = useCallback(async (location: LocationBroadcast) => {
    if (role !== 'broadcaster') {
      console.warn('[WebPubSub] Only broadcasters can send location updates');
      return;
    }

    try {
      if (isDevMode) {
        // Development mode: Broadcast via BroadcastChannel
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage(location);
          console.log('[Dev Mode] Broadcasted location:', location);
        }
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
          throw new Error(`Failed to broadcast location: ${response.statusText}`);
        }

        console.log('[Production] Broadcasted location:', location);
      }
    } catch (error) {
      console.error('[WebPubSub] Failed to send location:', error);
    }
  }, [role]);

  /**
   * Auto-connect on mount
   */
  useEffect(() => {
    if (!enabled) return;

    // Fresh connection lifecycle — allow reconnects again after a prior teardown.
    disposedRef.current = false;
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

  return {
    ...state,
    connect,
    disconnect,
    sendLocation,
  };
}
