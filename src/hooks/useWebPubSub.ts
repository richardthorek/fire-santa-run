/**
 * useWebPubSub hook
 * Manages Web PubSub connection for real-time tracking
 * Supports both Azure Web PubSub (production) and BroadcastChannel API (dev mode)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebPubSubClient } from '@azure/web-pubsub-client';
import type { LocationBroadcast } from '../types';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface WebPubSubConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

interface UseWebPubSubOptions {
  routeId: string;
  role?: 'viewer' | 'broadcaster';
  onLocationUpdate?: (location: LocationBroadcast) => void;
}

export function useWebPubSub({ routeId, role = 'viewer', onLocationUpdate }: UseWebPubSubOptions) {
  const [state, setState] = useState<WebPubSubConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const clientRef = useRef<WebPubSubClient | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 3000;

  /**
   * Connect to Web PubSub or BroadcastChannel
   */
  const connect = useCallback(async () => {
    if (state.isConnecting || state.isConnected) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (isDevMode) {
        // Development mode: Use BroadcastChannel API for local testing
        const channelName = `santa-tracking-${routeId}`;
        const channel = new BroadcastChannel(channelName);

        channel.onmessage = (event) => {
          if (onLocationUpdate && event.data) {
            onLocationUpdate(event.data as LocationBroadcast);
          }
        };

        broadcastChannelRef.current = channel;
        setState({ isConnected: true, isConnecting: false, error: null });
        console.log(`[Dev Mode] Connected to BroadcastChannel: ${channelName}`);
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
          if (onLocationUpdate && event.message.data) {
            onLocationUpdate(event.message.data as LocationBroadcast);
          }
        });

        // Handle connection lifecycle
        client.on('connected', () => {
          setState({ isConnected: true, isConnecting: false, error: null });
          reconnectAttemptsRef.current = 0;
          console.log(`[Production] Connected to Web PubSub for route: ${routeId}`);
        });

        client.on('disconnected', (event) => {
          setState({ isConnected: false, isConnecting: false, error: null });
          console.log('[Production] Disconnected from Web PubSub:', event.message);

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
      });
    }
  }, [routeId, role, onLocationUpdate, state.isConnecting, state.isConnected]);

  /**
   * Disconnect from Web PubSub or BroadcastChannel
   */
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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

    setState({ isConnected: false, isConnecting: false, error: null });
  }, []);

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

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendLocation,
  };
}
