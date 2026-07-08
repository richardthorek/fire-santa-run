/**
 * Native WebSocket endpoint for realtime tracking — attached to the same Node
 * HTTP server that serves the API + SPA. Path: /api/ws.
 *
 * Query params:
 * - routeId (required)
 * - role: viewer (default, anonymous) | broadcaster | editor
 * - token: required for broadcaster/editor — the signed token minted by the
 *          authenticated negotiate endpoint (browsers can't set WS auth headers).
 *
 * Viewers connect read-only and anonymously. Broadcasters receive viewer-count
 * updates here but SEND location via POST /api/broadcast. Editors exchange
 * presence on a private set.
 */

import type { Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { hub, MAX_TOTAL_CONNECTIONS } from './hub.js';
import { verifyWsToken, type RealtimeRole } from './wsToken.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface TaggedSocket extends WebSocket {
  isAlive?: boolean;
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url ?? '', 'http://localhost');
    } catch {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }

    if (url.pathname !== '/api/ws') {
      // Not our endpoint — close cleanly rather than leaving it hanging.
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    const routeId = url.searchParams.get('routeId');
    const roleParam = url.searchParams.get('role') || 'viewer';
    if (!routeId || (roleParam !== 'viewer' && roleParam !== 'broadcaster' && roleParam !== 'editor')) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }
    const role = roleParam as RealtimeRole;

    // Privileged roles must present the signed token from negotiate.
    if (role === 'broadcaster' || role === 'editor') {
      const claims = verifyWsToken(url.searchParams.get('token'));
      if (!claims || claims.routeId !== routeId || claims.role !== role) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
    }

    if (hub.totalConnections() >= MAX_TOTAL_CONNECTIONS) {
      rejectUpgrade(socket, 503, 'Service Unavailable');
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
      const tagged = ws as TaggedSocket;
      tagged.isAlive = true;

      hub.add(routeId, role, ws);
      // Viewers/broadcasters get the current count immediately; a viewer joining
      // also bumps the count everyone else sees.
      if (role !== 'editor') hub.pushViewerCount(routeId);

      ws.on('pong', () => {
        tagged.isAlive = true;
      });

      // Clients are receive-only here (broadcasters send via HTTP). Ignore any
      // inbound frames rather than trusting them.
      ws.on('message', () => {
        /* no-op: this endpoint is push-only */
      });

      const cleanup = () => {
        hub.remove(routeId, role, ws);
        if (role !== 'editor') hub.pushViewerCount(routeId);
      };
      ws.on('close', cleanup);
      ws.on('error', () => {
        try {
          ws.terminate();
        } catch {
          /* ignore */
        }
        cleanup();
      });
    });
  });

  // Heartbeat: drop sockets that stop answering pings (dead tabs, dropped
  // rural coverage) so counts stay accurate and memory doesn't leak.
  const interval = setInterval(() => {
    for (const client of wss.clients) {
      const tagged = client as TaggedSocket;
      if (tagged.isAlive === false) {
        tagged.terminate();
        continue;
      }
      tagged.isAlive = false;
      try {
        tagged.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(interval));

  console.log('✅ Realtime WebSocket endpoint attached at /api/ws');
}
