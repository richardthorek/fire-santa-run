/**
 * useWebPubSub hook
 * Manages Web PubSub connection for real-time tracking
 * Supports both Azure Web PubSub (production) and BroadcastChannel API (dev mode)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebPubSubClient } from '@azure/web-pubsub-client';
import type { LocationBroadcast, ViewerCountMessage } from '../types';

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
}

// Generate a unique session ID for each viewer session using cryptographically secure randomness
function generateSessionId(): string {
  return crypto.randomUUID();
}

export function useWebPubSub({ routeId, role = 'viewer', onLocationUpdate, shareSource }: UseWebPubSubOptions) {
  const [state, setState] = useState<WebPubSubConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    viewerCount: null,
  });

  const clientRef = useRef<WebPubSubClient | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  // The connection is established once per routeId/role, but callers typically
  // pass a fresh callback closure on every render. Route messages through a
  // ref so the latest closure always runs (avoids stale route/state bugs).
  const onLocationUpdateRef = useRef(onLocationUpdate);
  onLocationUpdateRef.current = onLocationUpdate;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const sessionIdRef = useRef<string>(generateSessionId());
  const sessionStartTimeRef = useRef<number>(Date.now());
  const viewerCountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 3000;
  const VIEWER_COUNT_POLL_INTERVAL_MS = 10000; // 10 seconds

  /**
   * Fetch current viewer count from API
   */
  const fetchViewerCount = useCallback(async () => {
    if (role !== 'viewer') return;

    try {
      const response = await fetch(`${API_BASE_URL}/analytics/routes/${routeId}/viewer-count`);
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, viewerCount: data.count }));
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
        // Production mode: Use Azure Web PubSub
        const negotiateUrl = `${API_BASE_URL}/negotiate?routeId=${encodeURIComponent(routeId)}&role=${role}`;
        const response = await fetch(negotiateUrl);

        if (!response.ok) {
          throw new Error(`Failed to negotiate connection: ${response.statusText}`);
        }

        const { url } = await response.json();

        // Create Web PubSub client
        const client = new WebPubSubClient(url);

        // Handle incoming messages
        client.on('group-message', (event) => {
          if (event.message.data) {
            const data = event.message.data;
            // Handle viewer count messages
            if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'viewer-count') {
              const viewerCountMsg = data as ViewerCountMessage;
              setState(prev => ({ ...prev, viewerCount: viewerCountMsg.count }));
              console.log(`[Production] Received viewer count: ${viewerCountMsg.count}`);
            }
            // Handle location updates
            else if (onLocationUpdateRef.current) {
              onLocationUpdateRef.current(data as LocationBroadcast);
            }
          }
        });

        // Handle connection lifecycle
        client.on('connected', () => {
          setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }));
          reconnectAttemptsRef.current = 0;
          console.log(`[Production] Connected to Web PubSub for route: ${routeId}`);

          // Log viewer join
          logViewerJoin();

          // Start polling viewer count in production
          if (role === 'viewer') {
            fetchViewerCount();
            viewerCountIntervalRef.current = setInterval(fetchViewerCount, VIEWER_COUNT_POLL_INTERVAL_MS);
          }
        });

        client.on('disconnected', (event) => {
          setState(prev => ({ ...prev, isConnected: false, isConnecting: false }));
          console.log('[Production] Disconnected from Web PubSub:', event.message);

          // Clear viewer count polling on disconnect
          if (viewerCountIntervalRef.current) {
            clearInterval(viewerCountIntervalRef.current);
            viewerCountIntervalRef.current = null;
          }

          // Attempt to reconnect
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            console.log(`[Production] Reconnecting attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}...`);

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, RECONNECT_DELAY_MS);
          } else {
            setState(prev => ({ ...prev, error: 'Connection lost. Please refresh the page.' }));
          }
        });

        // Start connection
        await client.start();
        clientRef.current = client;
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
    // Log viewer leave before disconnecting
    logViewerLeave();

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear viewer count polling interval
    if (viewerCountIntervalRef.current) {
      clearInterval(viewerCountIntervalRef.current);
      viewerCountIntervalRef.current = null;
    }

    // Close Web PubSub client
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
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
        // Production mode: Send via API
        const response = await fetch(`${API_BASE_URL}/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
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
  }, [routeId, role]);

  return {
    ...state,
    connect,
    disconnect,
    sendLocation,
  };
}
