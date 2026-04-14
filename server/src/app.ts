import { Hono } from 'hono';
import { brigadesRouter } from './routes/brigades.js';
import { routesRouter } from './routes/routes.js';
import { usersRouter } from './routes/users.js';
import { membersRouter } from './routes/members.js';
import { invitationsRouter } from './routes/invitations.js';
import { negotiateRouter } from './routes/negotiate.js';
import { broadcastRouter } from './routes/broadcast.js';
import { rfsStationsRouter } from './routes/rfs-stations.js';
import { verificationRouter } from './routes/verification.js';
import { adminVerificationRouter } from './routes/admin-verification.js';
import { claimRouter } from './routes/claim.js';

export function createApp() {
  const app = new Hono();

  // Health check
  app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  app.route('/api/brigades', brigadesRouter);
  app.route('/api/routes', routesRouter);
  app.route('/api/users', usersRouter);

  // Members are scoped under brigade — clone brigadeId from the mount path
  const brigadeScoped = new Hono();
  brigadeScoped.route('/:brigadeId/members', membersRouter);
  brigadeScoped.route('/:brigadeId', claimRouter);
  app.route('/api/brigades', brigadeScoped);

  app.route('/api/invitations', invitationsRouter);
  app.route('/api', negotiateRouter);
  app.route('/api', broadcastRouter);
  app.route('/api', rfsStationsRouter);
  app.route('/api/verification', verificationRouter);
  app.route('/api/site-admin/verification', adminVerificationRouter);

  return app;
}
