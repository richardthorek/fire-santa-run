/**
 * Scheduled work the app can't run for itself: the app scales to zero, so a
 * scheduled workflow calls these endpoints. Each needs the shared job token,
 * compared in constant time. With no token configured the endpoints are off.
 */
import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { runDailyRunPlanSweep } from '../utils/runPlanScheduler.js';

export const jobsRouter = new Hono();

function jobTokenMatches(provided: string | undefined): boolean {
  const expected = process.env.RUN_PLAN_JOB_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

jobsRouter.post('/run-plan-daily', async (c) => {
  if (!process.env.RUN_PLAN_JOB_TOKEN) {
    return c.json({ error: 'Not configured', message: 'The run-plan job token is not set on the server.' }, 503);
  }
  if (!jobTokenMatches(c.req.header('x-job-token'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const sent = await runDailyRunPlanSweep();
    console.log(`[runPlan] daily sweep sent ${sent} plan(s)`);
    return c.json({ success: true, sent }, 200);
  } catch (error) {
    console.error('[runPlan] daily sweep failed:', error);
    return c.json({ error: 'Daily run-plan sweep failed' }, 500);
  }
});
