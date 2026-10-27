/**
 * Automatic run-plan email: each published run's plan goes to its organiser once,
 * 24 hours before the start. A sweep runs every 15 minutes, and a sent run is
 * marked with `runPlanAutoSentAt` so it isn't sent again. The app runs as a
 * single replica (see docs/ARCHITECTURE.md), so one sweep runs at a time.
 */
import { getTableClient, isDevMode } from './storage.js';
import { fromChunkedProps } from './chunkedJson.js';
import { zonedDateTimeToEpoch } from './zonedTime.js';
import { buildPlan, isPlausibleEmail, sendPlan, type PlanNavigationStep, type PlanWaypoint, type RoutePlanSource } from './runPlanService.js';

const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';
const SWEEP_INTERVAL_MS = 15 * 60_000;
const LEAD_TIME_MS = 24 * 60 * 60_000;

/** True when a run starts within the next 24 hours and hasn't had its automatic email yet. */
export function isDueForAutoEmail(entity: Record<string, unknown>, now: number): boolean {
  if (entity.runPlanAutoSentAt) return false;
  const date = typeof entity.date === 'string' ? entity.date : '';
  const startTime = typeof entity.startTime === 'string' && entity.startTime ? entity.startTime : '00:00';
  const timeZone = typeof entity.timeZone === 'string' && entity.timeZone ? entity.timeZone : 'Australia/Sydney';
  if (!date) return false;
  const start = zonedDateTimeToEpoch(date, startTime, timeZone);
  if (Number.isNaN(start)) return false;
  const untilStart = start - now;
  return untilStart > 0 && untilStart <= LEAD_TIME_MS;
}

function entityToPlanSource(entity: Record<string, unknown>): RoutePlanSource {
  return {
    name: typeof entity.name === 'string' ? entity.name : undefined,
    date: String(entity.date ?? ''),
    startTime: String(entity.startTime ?? '00:00'),
    timeZone: typeof entity.timeZone === 'string' && entity.timeZone ? entity.timeZone : undefined,
    waypoints: fromChunkedProps<PlanWaypoint[]>(entity, 'waypoints') ?? [],
    navigationSteps: fromChunkedProps<PlanNavigationStep[]>(entity, 'navigationSteps'),
    geometry: fromChunkedProps<{ coordinates: [number, number][] }>(entity, 'geometry'),
    shareableLink: typeof entity.shareableLink === 'string' ? entity.shareableLink : undefined,
  };
}

/** One sweep: email each due run's plan to its organiser. Returns how many were sent. */
export async function sweepRunPlanEmails(now: number = Date.now()): Promise<number> {
  const client = await getTableClient(ROUTES_TABLE);
  const entities = client.listEntities({ queryOptions: { filter: "status eq 'published'" } });
  let sent = 0;
  for await (const entity of entities) {
    const row = entity as unknown as Record<string, unknown>;
    if (!isDueForAutoEmail(row, now)) continue;

    // The organiser is whoever created the run; the plan goes to their sign-in address.
    const organiser = typeof row.createdBy === 'string' ? row.createdBy : '';
    if (!isPlausibleEmail(organiser)) {
      console.warn(`[runPlan] run ${String(row.rowKey)} has no organiser email; automatic plan skipped`);
      continue;
    }

    const result = await sendPlan(await buildPlan(entityToPlanSource(row)), organiser);
    if (!result.sent) {
      console.warn(`[runPlan] automatic plan for run ${String(row.rowKey)} not sent: ${result.reason}`);
      continue;
    }
    await client.updateEntity(
      { partitionKey: String(row.partitionKey), rowKey: String(row.rowKey), runPlanAutoSentAt: new Date(now).toISOString() },
      'Merge',
    );
    sent += 1;
  }
  return sent;
}

/** Starts the 15-minute sweep. Set RUN_PLAN_AUTO_EMAIL=false to turn it off. */
export function startRunPlanScheduler(): void {
  if (process.env.RUN_PLAN_AUTO_EMAIL === 'false') return;
  const timer = setInterval(() => {
    sweepRunPlanEmails().catch(error => console.error('[runPlan] automatic sweep failed:', error));
  }, SWEEP_INTERVAL_MS);
  timer.unref();
}
