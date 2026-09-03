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
  /**
   * Last public messages seen for this route, replayed to any socket the
   * moment it connects. Without this, a viewer joining mid-run — or every
   * viewer reconnecting after a redeploy — stares at a blank/frozen map until
   * the broadcaster's next update (up to 5s later). Serialized once, reused.
   */
  lastLocation?: string;
  lastRunStatus?: string;
  /** Parsed run-status value, kept for cheap server-side checks (push gating). */
  runStatusValue?: string;
  /**
   * Opt-in "families waiting here" pins from public viewers, keyed by an opaque
   * client-generated pin id. Ephemeral (memory only, never persisted), pruned by
   * TTL, and only ever fanned out to the navigator in coarsened aggregate form —
   * never echoed to other viewers. See ViewerPinsMessage in src/types.
   */
  viewerPins?: Map<string, { lng: number; lat: number; at: number }>;
}

const routes = new Map<string, RouteConnections>();
let totalConnections = 0;

/** Hard cap across all routes — a safety brake against connection floods. */
export const MAX_TOTAL_CONNECTIONS = 5000;

/** Viewer pins older than this are dropped (viewer left without telling us). */
const VIEWER_PIN_TTL_MS = 15 * 60 * 1000;
/** Per-route cap so a misbehaving client can't inflate the waiting count. */
const MAX_VIEWER_PINS_PER_ROUTE = 2000;
/** Grid snap for aggregation: 3 dp ≈ 110m. Coordinates are already coarsened client-side. */
const roundGrid = (n: number): number => Math.round(n * 1000) / 1000;

function getRoute(routeId: string): RouteConnections {
  let conns = routes.get(routeId);
  if (!conns) {
    conns = { viewers: new Set(), broadcasters: new Set(), editors: new Set() };
    routes.set(routeId, conns);
  }
  return conns;
}

/** Terminal run states clear the cached position so a redeploy can't resurrect Santa. */
function isTerminalStatus(status: string | undefined): boolean {
  return status === 'completed' || status === 'aborted';
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

/**
 * Fan out the coarsened, aggregated waiting-spot pins to the navigator's read
 * side ONLY. Viewers never receive this — they must not be able to see each
 * other. Prunes stale pins as a side effect.
 */
function pushViewerPins(routeId: string): void {
  const conns = routes.get(routeId);
  if (!conns) return;

  const pins = conns.viewerPins;
  if (pins) {
    const now = Date.now();
    for (const [id, pin] of pins) {
      if (now - pin.at > VIEWER_PIN_TTL_MS) pins.delete(id);
    }
  }

  const cellMap = new Map<string, { lng: number; lat: number; count: number }>();
  if (pins) {
    for (const pin of pins.values()) {
      const lng = roundGrid(pin.lng);
      const lat = roundGrid(pin.lat);
      const key = `${lng},${lat}`;
      const cell = cellMap.get(key);
      if (cell) cell.count += 1;
      else cellMap.set(key, { lng, lat, count: 1 });
    }
  }

  const data = JSON.stringify({
    type: 'viewer-pins',
    routeId,
    cells: [...cellMap.values()],
    total: pins?.size ?? 0,
    timestamp: Date.now(),
  });
  for (const ws of conns.broadcasters) safeSend(ws, data);
}

export const hub = {
  totalConnections(): number {
    return totalConnections;
  },

  add(routeId: string, role: RealtimeRole, ws: WebSocket): void {
    const conns = getRoute(routeId);
    setFor(conns, role).add(ws);
    totalConnections++;
    // Replay the last known state to just-connected viewers/broadcasters so the
    // map is never blank on join or after a reconnect. Editors get neither.
    if (role !== 'editor') {
      if (conns.lastLocation) safeSend(ws, conns.lastLocation);
      if (conns.lastRunStatus) safeSend(ws, conns.lastRunStatus);
    }
    // The navigator's read side gets the current waiting-spot aggregate on join.
    if (role === 'broadcaster') pushViewerPins(routeId);
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
    const conns = getRoute(routeId);
    const data = JSON.stringify(message);
    // Cache as the position replayed to future joiners (unless the run is over).
    if (!isTerminalStatus(conns.runStatusValue)) conns.lastLocation = data;
    for (const ws of conns.viewers) safeSend(ws, data);
    for (const ws of conns.broadcasters) safeSend(ws, data);
  },

  /**
   * Set and fan out the live run status (active/paused/aborted/completed).
   * Cached and replayed to new joiners so a viewer arriving after Santa is
   * paused or has been called away sees that state immediately.
   */
  setRunStatus(routeId: string, message: { type: 'run-status'; routeId: string; status: string; message?: string; timestamp: number }): void {
    const conns = getRoute(routeId);
    conns.runStatusValue = message.status;
    conns.lastRunStatus = JSON.stringify(message);
    // Once the run is over, drop the cached position and every waiting-spot pin.
    if (isTerminalStatus(message.status)) {
      conns.lastLocation = undefined;
      conns.viewerPins?.clear();
      pushViewerPins(routeId);
    }
    for (const ws of conns.viewers) safeSend(ws, conns.lastRunStatus);
    for (const ws of conns.broadcasters) safeSend(ws, conns.lastRunStatus);
  },

  /** Current run status for a route, if one has been set (used to gate pushes). */
  getRunStatus(routeId: string): string | undefined {
    return routes.get(routeId)?.runStatusValue;
  },

  /** Relay an editor-presence message to the private editors set only. */
  broadcastEditorPresence(routeId: string, message: unknown): void {
    const conns = routes.get(routeId);
    if (!conns) return;
    const data = JSON.stringify(message);
    for (const ws of conns.editors) safeSend(ws, data);
  },

  /**
   * Record (or move) one opt-in viewer's waiting-spot pin and re-push the
   * aggregate to the navigator. `lng`/`lat` are expected already coarsened by
   * the route handler; they're snapped again during aggregation.
   */
  setViewerPin(routeId: string, pinId: string, lng: number, lat: number): void {
    const conns = getRoute(routeId);
    if (!conns.viewerPins) conns.viewerPins = new Map();
    if (!conns.viewerPins.has(pinId) && conns.viewerPins.size >= MAX_VIEWER_PINS_PER_ROUTE) {
      return; // at cap — ignore new pins, existing ones can still move
    }
    conns.viewerPins.set(pinId, { lng, lat, at: Date.now() });
    pushViewerPins(routeId);
  },

  /** Remove one viewer's waiting-spot pin (they turned sharing off / left). */
  removeViewerPin(routeId: string, pinId: string): void {
    const conns = routes.get(routeId);
    if (conns?.viewerPins?.delete(pinId)) {
      pushViewerPins(routeId);
    }
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
