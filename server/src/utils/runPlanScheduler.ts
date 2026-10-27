/**
 * Automatic run-plan email: each published run's plan goes to its organiser once,
 * ahead of the start. A daily sweep (run by a scheduled workflow, see
 * .github/workflows/run-plan-daily.yml) covers the runs that start 24 to 48 hours
 * after it runs. Each run falls in exactly one daily window, so the organiser
 * always gets at least 24 hours' notice whatever the run's time zone. A sent run
 * is marked with `runPlanAutoSentAt` so it isn't sent again. The app scales to
 * zero, so nothing here runs in the background; the workflow calls it.
 */
import { getTableClient, isDevMode } from './storage.js';
import { fromChunkedProps } from './chunkedJson.js';
import { zonedDateTimeToEpoch } from './zonedTime.js';
import { buildPlan, isPlausibleEmail, sendPlan, type PlanNavigationStep, type PlanWaypoint, type RoutePlanSource } from './runPlanService.js';

const ROUTES_TABLE = isDevMode ? 'devroutes' : 'routes';
const HOUR_MS = 60 * 60_000;
/** A run is covered by the daily sweep that runs 24 to 48 hours before its start. */
const WINDOW_START_MS = 24 * HOUR_MS;
const WINDOW_END_MS = 48 * HOUR_MS;

/** True when a run starts 24 to 48 hours after `now` and hasn't had its automatic email yet. */
export function isDueForAutoEmail(entity: Record<string, unknown>, now: number): boolean {
  if (entity.runPlanAutoSentAt) return false;
  const date = typeof entity.date === 'string' ? entity.date : '';
  const startTime = typeof entity.startTime === 'string' && entity.startTime ? entity.startTime : '00:00';
  const timeZone = typeof entity.timeZone === 'string' && entity.timeZone ? entity.timeZone : 'Australia/Sydney';
  if (!date) return false;
  const start = zonedDateTimeToEpoch(date, startTime, timeZone);
  if (Number.isNaN(start)) return false;
  const untilStart = start - now;
  return untilStart >= WINDOW_START_MS && untilStart < WINDOW_END_MS;
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

/** The daily sweep, as the scheduled job calls it. */
export function runDailyRunPlanSweep(): Promise<number> {
  return sweepRunPlanEmails(Date.now());
}
