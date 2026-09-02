/**
 * Azure AI Content Safety — text and image moderation.
 *
 * Fire Santa Run lets brigades publish free-text run names and upload brigade
 * logos. Both surface on public, unauthenticated pages (the discovery page,
 * every brigade's public page, the live tracker, OG images), so both need a
 * check for inappropriate material before they go live.
 *
 * This wraps the Content Safety REST API (no SDK dependency — Node's global
 * fetch, same as utils/auth.ts). Configuration:
 *
 *   CONTENT_SAFETY_ENDPOINT   https://<resource>.cognitiveservices.azure.com
 *   CONTENT_SAFETY_KEY        resource key (seeded as a Container Apps secret)
 *   CONTENT_SAFETY_BLOCK_SEVERITY   min category severity that blocks (default 4 = "Medium")
 *   CONTENT_SAFETY_BLOCKLIST  comma-separated Content Safety blocklist names to
 *                             apply to text (custom "dirty words" — managed in
 *                             the Azure portal / via the blocklist REST API)
 *
 * Fail-open: if the service is unreachable or errors, moderation returns
 * `decision: 'skipped'` rather than blocking a brigade's legitimate work on an
 * outage. Callers record a `pending` moderation flag in that case so a
 * platform admin can review after the fact.
 */

const API_VERSION = '2024-09-01';

const ENDPOINT = (process.env.CONTENT_SAFETY_ENDPOINT || '').trim().replace(/\/+$/, '');
const KEY = (process.env.CONTENT_SAFETY_KEY || '').trim();

/** Severity is 0 (safe) / 2 (low) / 4 (medium) / 6 (high). Block at this or above. */
const BLOCK_SEVERITY = (() => {
  const raw = Number.parseInt(process.env.CONTENT_SAFETY_BLOCK_SEVERITY || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 4;
})();

const BLOCKLIST_NAMES = (process.env.CONTENT_SAFETY_BLOCKLIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const REQUEST_TIMEOUT_MS = 8_000;

export interface CategoryResult {
  category: string;
  severity: number;
}

export type ModerationDecision = 'allow' | 'block' | 'skipped';

export interface ModerationResult {
  decision: ModerationDecision;
  /** Per-category severities returned by the service (empty when skipped). */
  categories: CategoryResult[];
  /** Names of custom blocklist terms that matched (text only). */
  blocklistHits: string[];
  /** Human-readable reason when `decision` is 'block'. */
  reason?: string;
  /** Set when `decision` is 'skipped' — why the check did not run. */
  error?: string;
}

/** Whether a real Content Safety resource is wired up. */
export function isContentSafetyConfigured(): boolean {
  return ENDPOINT !== '' && KEY !== '';
}

function skipped(error: string): ModerationResult {
  return { decision: 'skipped', categories: [], blocklistHits: [], error };
}

/** Highest-severity category at or above the block threshold, if any. */
function firstBlocking(categories: CategoryResult[]): CategoryResult | undefined {
  return categories
    .filter((c) => typeof c.severity === 'number' && c.severity >= BLOCK_SEVERITY)
    .sort((a, b) => b.severity - a.severity)[0];
}

async function callContentSafety(path: string, payload: unknown): Promise<Response> {
  return fetch(`${ENDPOINT}/contentsafety/${path}?api-version=${API_VERSION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': KEY,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * Moderate a short piece of user text (a run name, a brigade name). Returns
 * `decision: 'skipped'` when Content Safety is not configured or errors.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) return { decision: 'allow', categories: [], blocklistHits: [] };
  if (!isContentSafetyConfigured()) return skipped('Content Safety not configured');

  let res: Response;
  try {
    res = await callContentSafety('text:analyze', {
      text: trimmed.slice(0, 1000),
      blocklistNames: BLOCKLIST_NAMES,
      haltOnBlocklistHit: false,
      outputType: 'FourSeverityLevels',
    });
  } catch (err) {
    return skipped(err instanceof Error ? err.message : 'Content Safety request failed');
  }
  if (!res.ok) {
    return skipped(`Content Safety returned ${res.status}`);
  }

  let body: {
    categoriesAnalysis?: CategoryResult[];
    blocklistsMatch?: { blocklistName?: string; blocklistItemText?: string }[];
  };
  try {
    body = await res.json();
  } catch {
    return skipped('Content Safety returned an invalid response');
  }

  const categories = Array.isArray(body.categoriesAnalysis) ? body.categoriesAnalysis : [];
  const blocklistHits = (body.blocklistsMatch ?? [])
    .map((m) => m.blocklistItemText || m.blocklistName || '')
    .filter(Boolean);

  const blocking = firstBlocking(categories);
  if (blocklistHits.length > 0) {
    return { decision: 'block', categories, blocklistHits, reason: 'Matched a prohibited-terms blocklist.' };
  }
  if (blocking) {
    return {
      decision: 'block',
      categories,
      blocklistHits,
      reason: `Flagged as ${blocking.category.toLowerCase()} content (severity ${blocking.severity}).`,
    };
  }
  return { decision: 'allow', categories, blocklistHits };
}

/**
 * Moderate an image supplied as a data URL (`data:image/png;base64,...`) or a
 * bare base64 string — the shape brigade logos are stored in. Returns
 * `decision: 'skipped'` when Content Safety is not configured or errors.
 */
export async function moderateImage(image: string): Promise<ModerationResult> {
  if (!image) return { decision: 'allow', categories: [], blocklistHits: [] };
  if (!isContentSafetyConfigured()) return skipped('Content Safety not configured');

  const base64 = image.startsWith('data:') ? image.slice(image.indexOf(',') + 1) : image;
  if (!base64) return skipped('Image had no decodable content');

  let res: Response;
  try {
    res = await callContentSafety('image:analyze', {
      image: { content: base64 },
      outputType: 'FourSeverityLevels',
    });
  } catch (err) {
    return skipped(err instanceof Error ? err.message : 'Content Safety request failed');
  }
  if (!res.ok) {
    return skipped(`Content Safety returned ${res.status}`);
  }

  let body: { categoriesAnalysis?: CategoryResult[] };
  try {
    body = await res.json();
  } catch {
    return skipped('Content Safety returned an invalid response');
  }

  const categories = Array.isArray(body.categoriesAnalysis) ? body.categoriesAnalysis : [];
  const blocking = firstBlocking(categories);
  if (blocking) {
    return {
      decision: 'block',
      categories,
      blocklistHits: [],
      reason: `Image flagged as ${blocking.category.toLowerCase()} content (severity ${blocking.severity}).`,
    };
  }
  return { decision: 'allow', categories, blocklistHits: [] };
}

/** Test seam / diagnostics. */
export const _config = { ENDPOINT, BLOCK_SEVERITY, BLOCKLIST_NAMES };
