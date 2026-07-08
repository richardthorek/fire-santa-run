/**
 * In-process realtime hub — the native-WebSocket replacement for Azure Web
 * PubSub fan-out.
 *
 * Holds the live WebSocket connections for each route and fans out messages to
 * them in-process. This removes the managed Web PubSub dependency (and its
 * per-connection + per-message billing): fan-out to N sockets is a cheap loop,
 * and there is no per-message charge.
 *
 * Connection roles per route:
 * - viewers      — anonymous public tracking pages; counted for "N watching".
 * - broadcasters — the navigator device's read side (receives viewer counts);
 *                  it SENDS location via HTTP POST /api/broadcast, not the socket.
 * - editors      — route-editor presence; kept on a separate set so editor
 *                  identities never reach public viewers.
 *
 * Scale note: this is per-process. Run a single replica (Container Apps
 * maxReplicas=1) so every viewer of a route shares one process; add a Redis /
 * pub-sub backplane only when one process is no longer enough.
 */

import type { WebSocket } from 'ws';
import type { RealtimeRole } from './wsToken.js';

interface RouteConnections {
  viewers: Set<WebSocket>;
  broadcasters: Set<WebSocket>;
  editors: Set<WebSocket>;
}

const routes = new Map<string, RouteConnections>();
let totalConnections = 0;

/** Hard cap across all routes — a safety brake against connection floods. */
export const MAX_TOTAL_CONNECTIONS = 5000;

function getRoute(routeId: string): RouteConnections {
  let conns = routes.get(routeId);
  if (!conns) {
    conns = { viewers: new Set(), broadcasters: new Set(), editors: new Set() };
    routes.set(routeId, conns);
  }
  return conns;
}

function setFor(conns: RouteConnections, role: RealtimeRole): Set<WebSocket> {
  if (role === 'editor') return conns.editors;
  if (role === 'broadcaster') return conns.broadcasters;
  return conns.viewers;
}

function safeSend(ws: WebSocket, data: string): void {
  // 1 === WebSocket.OPEN
  if (ws.readyState === 1) {
    try {
      ws.send(data);
    } catch {
      // Broken socket — the close handler will clean it up.
    }
  }
}

export const hub = {
  totalConnections(): number {
    return totalConnections;
  },

  add(routeId: string, role: RealtimeRole, ws: WebSocket): void {
    setFor(getRoute(routeId), role).add(ws);
    totalConnections++;
  },

  remove(routeId: string, role: RealtimeRole, ws: WebSocket): void {
    const conns = routes.get(routeId);
    if (!conns) return;
    if (setFor(conns, role).delete(ws)) {
      totalConnections = Math.max(0, totalConnections - 1);
    }
    if (conns.viewers.size === 0 && conns.broadcasters.size === 0 && conns.editors.size === 0) {
      routes.delete(routeId);
    }
  },

  viewerCount(routeId: string): number {
    return routes.get(routeId)?.viewers.size ?? 0;
  },

  /** Fan out a Santa location / status message to viewers and the broadcaster's read side. */
  broadcastLocation(routeId: string, message: unknown): void {
    const conns = routes.get(routeId);
    if (!conns) return;
    const data = JSON.stringify(message);
    for (const ws of conns.viewers) safeSend(ws, data);
    for (const ws of conns.broadcasters) safeSend(ws, data);
  },

  /** Relay an editor-presence message to the private editors set only. */
  broadcastEditorPresence(routeId: string, message: unknown): void {
    const conns = routes.get(routeId);
    if (!conns) return;
    const data = JSON.stringify(message);
    for (const ws of conns.editors) safeSend(ws, data);
  },

  /** Push the authoritative live viewer count to everyone watching the route. */
  pushViewerCount(routeId: string): void {
    const conns = routes.get(routeId);
    if (!conns) return;
    const data = JSON.stringify({ type: 'viewer-count', routeId, count: conns.viewers.size, timestamp: Date.now() });
    for (const ws of conns.viewers) safeSend(ws, data);
    for (const ws of conns.broadcasters) safeSend(ws, data);
  },
};
