const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 7071;

const brigades = {
  'dev-brigade-1': {
    id: 'dev-brigade-1',
    name: 'Development Fire Brigade',
    claimed: false,
    rfsStationId: 'RFS-DEV-001',
  },
};

const users = {};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true);
  const method = req.method || 'GET';
  const path = parsed.pathname || '/';

  // GET /api/brigades
  if (method === 'GET' && path === '/api/brigades') {
    return sendJson(res, 200, Object.values(brigades));
  }

  // GET /api/brigades/:id
  const brigadeMatch = path.match(/^\/api\/brigades\/([^/]+)$/);
  if (method === 'GET' && brigadeMatch) {
    const id = brigadeMatch[1];
    const b = brigades[id];
    if (!b) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, b);
  }

  // GET /api/brigades/rfs/:rfsId
  const rfsMatch = path.match(/^\/api\/brigades\/rfs\/([^/]+)$/);
  if (method === 'GET' && rfsMatch) {
    const rfsId = rfsMatch[1];
    const b = Object.values(brigades).find((x) => x.rfsStationId === rfsId);
    if (!b) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, b);
  }

  // PUT /api/users
  if (method === 'PUT' && path === '/api/users') {
    const body = await parseBody(req);
    if (!body || !body.id) return sendJson(res, 400, { error: 'Invalid user' });
    users[body.id] = body;
    return sendJson(res, 200, body);
  }

  // GET /api/users/by-email/:email
  const byEmailMatch = path.match(/^\/api\/users\/by-email\/(.+)$/);
  if (method === 'GET' && byEmailMatch) {
    const email = decodeURIComponent(byEmailMatch[1]);
    const user = Object.values(users).find((u) => u.email === email);
    if (!user) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, user);
  }

  // POST /api/brigades/:id/claim
  const claimMatch = path.match(/^\/api\/brigades\/([^/]+)\/claim$/);
  if (method === 'POST' && claimMatch) {
    const id = claimMatch[1];
    const brigade = brigades[id];
    if (!brigade) return sendJson(res, 404, { error: 'Brigade not found' });
    if (brigade.claimed) return sendJson(res, 400, { error: 'Brigade already claimed' });
    const body = await parseBody(req);
    brigade.claimed = true;
    brigade.claimedBy = body.userId || 'test-user';
    return sendJson(res, 200, { success: true, brigade });
  }

  // GET /api/users/:userId/memberships
  const memMatch = path.match(/^\/api\/users\/([^/]+)\/memberships$/);
  if (method === 'GET' && memMatch) {
    return sendJson(res, 200, []);
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});

module.exports = server;
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 7071;

// In-memory data store for testing
const brigades = {
  'dev-brigade-1': {
    id: 'dev-brigade-1',
    name: 'Development Fire Brigade',
    claimed: false,
    rfsStationId: 'RFS-DEV-001',
  },
};

const users = {};

app.get('/api/brigades', (req, res) => {
  res.json(Object.values(brigades));
});

app.get('/api/brigades/:id', (req, res) => {
  const b = brigades[req.params.id];
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(b);
});

app.get('/api/brigades/rfs/:rfsId', (req, res) => {
  const b = Object.values(brigades).find((x) => x.rfsStationId === req.params.rfsId);
  if (!b) return res.status(404).json({ error: 'Not found' });
  res.json(b);
});

app.put('/api/users', (req, res) => {
  const u = req.body;
  if (!u || !u.id) return res.status(400).json({ error: 'Invalid user' });
  users[u.id] = u;
  res.status(200).json(u);
});

app.get('/api/users/by-email/:email', (req, res) => {
  const user = Object.values(users).find((u) => u.email === req.params.email);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Simulate memberships
app.post('/api/brigades/:id/claim', (req, res) => {
  const id = req.params.id;
  const brigade = brigades[id];
  if (!brigade) return res.status(404).json({ error: 'Brigade not found' });
  if (brigade.claimed) return res.status(400).json({ error: 'Brigade already claimed' });
  brigade.claimed = true;
  brigade.claimedBy = req.body.userId || 'test-user';
  res.json({ success: true, brigade });
});

app.get('/api/users/:userId/memberships', (req, res) => {
  // return empty memberships for now
  res.json([]);
});

app.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});

module.exports = app;
