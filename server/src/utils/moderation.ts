/**
 * Moderation flags — the record + review queue behind content safety.
 *
 * When a brigade tries to publish a run name / brigade name / logo that
 * Content Safety flags, the write is rejected (see routes/routes.ts and
 * routes/brigades.ts) and a flag is written here so a platform admin can see
 * what happened in the admin portal. Flags are also written when the check
 * has to be skipped (service outage) so nothing slips through unreviewed.
 *
 * An admin can then, per flag:
 *  - `approved`  — false positive; the exact value is allowed through on the
 *                  brigade's next save (see `hasApproval`).
 *  - `removed`   — admin cleared/edited the offending content directly.
 *  - `dismissed` — no action needed (e.g. the brigade already changed it).
 *
 * Low volume (one row per flagged attempt) — the queue is a full table scan,
 * same pattern as the rest of this codebase's small tables.
 */

import { getTableClient, isDevMode } from './storage.js';
import { moderateText, moderateImage, type CategoryResult, type ModerationDecision } from './contentSafety.js';

const FLAGS_TABLE = isDevMode ? 'devmoderationflags' : 'moderationflags';

export type ModerationSubjectType = 'brigade' | 'route';
export type ModerationField = 'name' | 'description' | 'logo';
export type ModerationFlagStatus = 'blocked' | 'pending' | 'approved' | 'removed' | 'dismissed';

export interface ModerationFlag {
  id: string;
  subjectType: ModerationSubjectType;
  subjectId: string;
  /** Owning brigade — equal to subjectId for brigade flags. */
  brigadeId: string;
  field: ModerationField;
  /** The offending text, truncated. Empty for `logo` (we never store the image). */
  value: string;
  status: ModerationFlagStatus;
  decision: ModerationDecision;
  reason: string;
  categories: CategoryResult[];
  blocklistHits: string[];
  createdAt: string;
  /** Email of the brigade member whose save triggered the flag. */
  createdBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

/** Normalise a value for equality checks (approval matching). */
export function normaliseValue(value: string): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 500);
}

interface FlagEntity {
  partitionKey: string;
  rowKey: string;
  subjectType: string;
  subjectId: string;
  brigadeId: string;
  field: string;
  value: string;
  valueKey: string;
  status: string;
  decision: string;
  reason: string;
  categories: string;
  blocklistHits: string;
  createdAt: string;
  createdBy: string;
  resolvedAt: string;
  resolvedBy: string;
  resolutionNote: string;
}

function entityToFlag(e: Record<string, unknown>): ModerationFlag {
  const s = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '');
  const json = <T,>(k: string, fallback: T): T => {
    try {
      return e[k] ? (JSON.parse(e[k] as string) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    id: s('rowKey'),
    subjectType: s('subjectType') as ModerationSubjectType,
    subjectId: s('subjectId'),
    brigadeId: s('brigadeId'),
    field: s('field') as ModerationField,
    value: s('value'),
    status: s('status') as ModerationFlagStatus,
    decision: s('decision') as ModerationDecision,
    reason: s('reason'),
    categories: json<CategoryResult[]>('categories', []),
    blocklistHits: json<string[]>('blocklistHits', []),
    createdAt: s('createdAt'),
    createdBy: s('createdBy'),
    resolvedAt: s('resolvedAt') || undefined,
    resolvedBy: s('resolvedBy') || undefined,
    resolutionNote: s('resolutionNote') || undefined,
  };
}

export interface RecordFlagInput {
  subjectType: ModerationSubjectType;
  subjectId: string;
  brigadeId: string;
  field: ModerationField;
  value: string;
  status: Extract<ModerationFlagStatus, 'blocked' | 'pending'>;
  decision: ModerationDecision;
  reason: string;
  categories: CategoryResult[];
  blocklistHits: string[];
  createdBy: string;
}

/** Write a new flag. Never throws — a moderation-logging failure must not break the caller. */
export async function recordFlag(input: RecordFlagInput): Promise<void> {
  try {
    const client = await getTableClient(FLAGS_TABLE);
    const now = new Date().toISOString();
    const id = `flag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entity: FlagEntity = {
      partitionKey: input.subjectType,
      rowKey: id,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      brigadeId: input.brigadeId,
      field: input.field,
      value: input.field === 'logo' ? '' : input.value.slice(0, 500),
      valueKey: normaliseValue(input.field === 'logo' ? input.subjectId : input.value),
      status: input.status,
      decision: input.decision,
      reason: input.reason,
      categories: JSON.stringify(input.categories ?? []),
      blocklistHits: JSON.stringify(input.blocklistHits ?? []),
      createdAt: now,
      createdBy: input.createdBy,
      resolvedAt: '',
      resolvedBy: '',
      resolutionNote: '',
    };
    await client.createEntity(entity);
    console.log(`[moderation] flag ${id}: ${input.subjectType}/${input.subjectId} ${input.field} ${input.status} — ${input.reason}`);
  } catch (err) {
    console.error('[moderation] failed to record flag:', err);
  }
}

/**
 * Whether a platform admin has already approved this exact value for this
 * subject/field (a false positive). For `logo`, the key is the subject id —
 * i.e. "this brigade's current logo is approved" until they change it.
 */
export async function hasApproval(
  subjectType: ModerationSubjectType,
  subjectId: string,
  field: ModerationField,
  value: string,
): Promise<boolean> {
  try {
    const client = await getTableClient(FLAGS_TABLE);
    const valueKey = normaliseValue(field === 'logo' ? subjectId : value);
    const entities = client.listEntities({
      queryOptions: {
        filter: `PartitionKey eq '${subjectType}' and status eq 'approved' and subjectId eq '${subjectId.replace(/'/g, "''")}' and field eq '${field}'`,
      },
    });
    for await (const e of entities) {
      if ((e as Record<string, unknown>).valueKey === valueKey) return true;
    }
    return false;
  } catch (err) {
    console.error('[moderation] approval lookup failed:', err);
    return false;
  }
}

export async function listFlags(status?: ModerationFlagStatus): Promise<ModerationFlag[]> {
  const client = await getTableClient(FLAGS_TABLE);
  const filter = status ? { queryOptions: { filter: `status eq '${status}'` } } : undefined;
  const flags: ModerationFlag[] = [];
  for await (const e of client.listEntities(filter)) {
    flags.push(entityToFlag(e as Record<string, unknown>));
  }
  flags.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return flags;
}

export async function getFlag(subjectType: ModerationSubjectType, id: string): Promise<ModerationFlag | null> {
  try {
    const client = await getTableClient(FLAGS_TABLE);
    const e = await client.getEntity(subjectType, id);
    return entityToFlag(e as Record<string, unknown>);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 404) return null;
    throw err;
  }
}

export async function resolveFlag(
  subjectType: ModerationSubjectType,
  id: string,
  resolution: { status: Extract<ModerationFlagStatus, 'approved' | 'removed' | 'dismissed'>; resolvedBy: string; note?: string },
): Promise<ModerationFlag | null> {
  const client = await getTableClient(FLAGS_TABLE);
  const existing = await getFlag(subjectType, id);
  if (!existing) return null;
  await client.updateEntity(
    {
      partitionKey: subjectType,
      rowKey: id,
      status: resolution.status,
      resolvedAt: new Date().toISOString(),
      resolvedBy: resolution.resolvedBy,
      resolutionNote: resolution.note || '',
    },
    'Merge',
  );
  return getFlag(subjectType, id);
}

// ── Enforcement ──────────────────────────────────────────────────────────────

export interface GuardInput {
  subjectType: ModerationSubjectType;
  subjectId: string;
  brigadeId: string;
  field: ModerationField;
  value: string;
  /** Email of the brigade member making the change — recorded on any flag. */
  actorEmail: string;
}

export interface GuardResult {
  /** True ⇒ caller must reject the write (HTTP 422). */
  blocked: boolean;
  reason?: string;
}

const ALLOWED: GuardResult = { blocked: false };

/**
 * Run a text field (a run name, a brigade name, a description) through Content
 * Safety before it is persisted. Blocks on a definite flag; fails open (allows,
 * but records a `pending` flag for admin review) when the service is skipped or
 * unreachable. An admin `approved` flag for the same exact value lets it pass.
 */
export async function guardTextContent(input: GuardInput): Promise<GuardResult> {
  if (!input.value || !input.value.trim()) return ALLOWED;
  if (await hasApproval(input.subjectType, input.subjectId, input.field, input.value)) return ALLOWED;

  const result = await moderateText(input.value);
  if (result.decision === 'allow') return ALLOWED;

  if (result.decision === 'block') {
    await recordFlag({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      brigadeId: input.brigadeId,
      field: input.field,
      value: input.value,
      status: 'blocked',
      decision: result.decision,
      reason: result.reason || 'Flagged by content safety.',
      categories: result.categories,
      blocklistHits: result.blocklistHits,
      createdBy: input.actorEmail,
    });
    return { blocked: true, reason: result.reason || 'This text was flagged as inappropriate.' };
  }

  // skipped — fail open, but leave a trail.
  await recordFlag({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    brigadeId: input.brigadeId,
    field: input.field,
    value: input.value,
    status: 'pending',
    decision: 'skipped',
    reason: result.error || 'Content safety check could not run.',
    categories: [],
    blocklistHits: [],
    createdBy: input.actorEmail,
  });
  return ALLOWED;
}

/** As `guardTextContent`, for an image supplied as a data URL / base64 string. */
export async function guardImageContent(input: GuardInput): Promise<GuardResult> {
  if (!input.value) return ALLOWED;
  if (await hasApproval(input.subjectType, input.subjectId, 'logo', input.value)) return ALLOWED;

  const result = await moderateImage(input.value);
  if (result.decision === 'allow') return ALLOWED;

  if (result.decision === 'block') {
    await recordFlag({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      brigadeId: input.brigadeId,
      field: 'logo',
      value: '',
      status: 'blocked',
      decision: result.decision,
      reason: result.reason || 'Image flagged by content safety.',
      categories: result.categories,
      blocklistHits: [],
      createdBy: input.actorEmail,
    });
    return { blocked: true, reason: result.reason || 'This image was flagged as inappropriate.' };
  }

  await recordFlag({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    brigadeId: input.brigadeId,
    field: 'logo',
    value: '',
    status: 'pending',
    decision: 'skipped',
    reason: result.error || 'Content safety check could not run.',
    categories: [],
    blocklistHits: [],
    createdBy: input.actorEmail,
  });
  return ALLOWED;
}
