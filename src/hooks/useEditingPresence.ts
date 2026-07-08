/**
 * useEditingPresence hook — shows who else is currently editing a route.
 *
 * Editors of the same route exchange lightweight presence heartbeats over a
 * dedicated channel (separate from the public tracking group so editor names
 * never reach anonymous viewers):
 * - Dev mode: BroadcastChannel `santa-editing-{routeId}` (cross-tab).
 * - Production: a native WebSocket to /api/ws?role=editor (URL + signed token
 *   from negotiate); heartbeats are sent via POST /api/broadcast/editor-presence
 *   and fanned out to the private editors set. Editor identities never reach
 *   public viewers.
 *
 * Peers that miss two heartbeats are considered gone.
 */

import { useEffect, useRef, useState } from 'react';
import { getApiAuthHeaders } from '../auth/apiToken';

const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const HEARTBEAT_INTERVAL_MS = 15000;
const STALE_AFTER_MS = 40000; // just over two missed heartbeats

export interface EditorPresence {
  userId: string;
  userName: string;
  /** Last heartbeat received (epoch ms, local clock) */
  lastSeen: number;
}

interface PresenceMessage {
  type: 'editor-presence';
  routeId: string;
  userId: string;
  userName: string;
  action: 'editing' | 'left';
}

interface UseEditingPresenceOptions {
  routeId: string;
  user: { id: string; name: string } | null;
  /** Disable for new/unsaved routes */
  enabled?: boolean;
}

export function useEditingPresence({ routeId, user, enabled = true }: UseEditingPresenceOptions) {
  const [peers, setPeers] = useState<EditorPresence[]>([]);
  const peersRef = useRef<Map<string, EditorPresence>>(new Map());

  useEffect(() => {
    if (!enabled || !routeId || !user) return;

    const self = { id: user.id, name: user.name };
    let disposed = false;
    let channel: BroadcastChannel | null = null;
    let ws: WebSocket | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let sweepTimer: ReturnType<typeof setInterval> | null = null;
    // Editor presence is an authenticated action. Resolve the bearer token once
    // at connect and reuse it for heartbeats and the teardown 'left' beacon, so
    // the keepalive request still carries auth after the page starts unloading.
    let authHeaders: Record<string, string> = {};

    const publishPeers = () => {
      setPeers([...peersRef.current.values()].sort((a, b) => a.userName.localeCompare(b.userName)));
    };

    const handleMessage = (data: unknown) => {
      const msg = data as PresenceMessage;
      if (!msg || msg.type !== 'editor-presence' || msg.routeId !== routeId) return;
      if (msg.userId === self.id) return;
      if (msg.action === 'left') {
        peersRef.current.delete(msg.userId);
      } else {
        peersRef.current.set(msg.userId, {
          userId: msg.userId,
          userName: msg.userName,
          lastSeen: Date.now(),
        });
      }
      publishPeers();
    };

    const buildMessage = (action: PresenceMessage['action']): PresenceMessage => ({
      type: 'editor-presence',
      routeId,
      userId: self.id,
      userName: self.name,
      action,
    });

    const sendPresence = (action: PresenceMessage['action']) => {
      if (isDevMode) {
        channel?.postMessage(buildMessage(action));
      } else {
        // keepalive lets the 'left' message survive page teardown
        fetch(`${API_BASE_URL}/broadcast/editor-presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(buildMessage(action)),
          keepalive: action === 'left',
        }).catch(() => {
          // Presence is best-effort; never surface errors to the editor
        });
      }
    };

    const startHeartbeat = () => {
      sendPresence('editing');
      heartbeatTimer = setInterval(() => sendPresence('editing'), HEARTBEAT_INTERVAL_MS);
      sweepTimer = setInterval(() => {
        const cutoff = Date.now() - STALE_AFTER_MS;
        let changed = false;
        for (const [id, peer] of peersRef.current) {
          if (peer.lastSeen < cutoff) {
            peersRef.current.delete(id);
            changed = true;
          }
        }
        if (changed) publishPeers();
      }, HEARTBEAT_INTERVAL_MS);
    };

    if (isDevMode) {
      channel = new BroadcastChannel(`santa-editing-${routeId}`);
      channel.onmessage = (event) => handleMessage(event.data);
      startHeartbeat();
    } else {
      (async () => {
        try {
          authHeaders = await getApiAuthHeaders();
          const response = await fetch(
            `${API_BASE_URL}/negotiate?routeId=${encodeURIComponent(routeId)}&role=editor`,
            { headers: authHeaders }
          );
          if (!response.ok) throw new Error(`negotiate failed: ${response.status}`);
          const { url } = await response.json();
          if (disposed) return;

          ws = new WebSocket(url);
          ws.onmessage = (event) => {
            try {
              handleMessage(JSON.parse(event.data));
            } catch {
              // ignore non-JSON frames
            }
          };
          ws.onopen = () => {
            if (disposed) {
              ws?.close();
              return;
            }
            startHeartbeat();
          };
        } catch (error) {
          console.error('[EditingPresence] Failed to connect:', error);
        }
      })();
    }

    return () => {
      disposed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (sweepTimer) clearInterval(sweepTimer);
      sendPresence('left');
      channel?.close();
      ws?.close();
      peersRef.current = new Map();
      setPeers([]);
    };
  }, [routeId, user?.id, user?.name, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeEditors: peers };
}
