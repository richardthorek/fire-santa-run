/**
 * Application Insights bootstrap (StationKit suite consumption summary,
 * 2026-09).
 *
 * Fire Santa Run runs on Azure Container Apps + Hono, not Azure Functions
 * (unlike sibling repo Fire Break Calculator) or classic App Service (despite
 * telemetry.ts's older comment, which predates the Container Apps move).
 * Container Apps' managed-environment log destination forwards container
 * stdout to the `ContainerAppConsoleLogs_CL` table in the Log Analytics
 * workspace (see infra/modules/monitoring.bicep) — a different table to
 * Application Insights' `traces`, which is what the cross-app `METRIC `
 * contract (see telemetryMetrics.ts) is queried against. So plain
 * `console.log` alone does not reach Application Insights here; the
 * `applicationinsights` Node SDK must be initialized explicitly in-process.
 *
 * `infra/modules/containerapps.bicep` already wires the connection string
 * from monitoring.bicep into the container as `APPLICATIONINSIGHTS_CONNECTION_STRING`
 * — it was simply never read by anything. This is a safe no-op when that
 * env var is unset (local dev, or a deployment without monitoring wired up):
 * it just doesn't start, and `emitMetric`'s `console.log` still runs (visible
 * in `docker logs` / Container Apps console logs, just not in App Insights).
 */

import appInsights from 'applicationinsights';

let started = false;

export function initAppInsights(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString || started) return;

  try {
    appInsights
      .setup(connectionString)
      // Pipes console.log/console.error (including our `METRIC ...` lines)
      // into Application Insights as traces, matching the sibling apps'
      // ingestion path.
      .setAutoCollectConsole(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectPerformance(false)
      .setAutoCollectDependencies(false)
      .setSendLiveMetrics(false)
      .start();
    started = true;
    console.log('Application Insights telemetry initialized');
  } catch (error) {
    // Telemetry setup must never prevent the server from starting.
    console.error('Failed to initialize Application Insights (continuing without it):', error);
  }
}
