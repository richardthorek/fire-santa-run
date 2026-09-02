/**
 * Cross-app usage telemetry for the StationKit suite's weekly platform-admin
 * consumption summary (owned by Station Manager, which pulls user actions +
 * Azure cost across every app via a cross-resource Azure Log Analytics
 * query). This repo's only responsibility is to emit its key user actions in
 * the agreed shape — the same one Fire Break Calculator already uses:
 *
 *   METRIC {"metric":"<snake_case_name>", ...fields}
 *
 * as a single structured log line, queryable in Application Insights'
 * `traces` table via `message startswith "METRIC "`. See
 * server/src/utils/appInsights.ts for how this reaches Application Insights
 * for this repo specifically (Azure Container Apps, not Functions/App
 * Service, so nothing forwards console output there automatically — the
 * `applicationinsights` SDK is initialized explicitly at server bootstrap).
 *
 * Keep `fields` free of PII: no names, emails, or phone numbers. Opaque
 * identifiers (routeId, brigadeId) are fine — this repo already partitions
 * all data by brigadeId per its multi-brigade isolation rule.
 */

export type UsageMetricName =
  | 'route_created'
  | 'tracking_session_started'
  | 'tracking_viewer_joined'
  | 'route_analytics_viewed';

export function emitMetric(metric: UsageMetricName, fields: Record<string, unknown> = {}): void {
  try {
    console.log(`METRIC ${JSON.stringify({ metric, ...fields })}`);
  } catch {
    // Telemetry must never break the request path.
  }
}
