/**
 * Platform-admin portal (`/admin`).
 *
 * Visible only to platform administrators (`useAuth().isPlatformAdmin`, backed
 * by Station Manager's `isPlatformAdmin` flag). Gives an operator a view across
 * every brigade: registrations, users, run stats, a content-moderation queue,
 * and the controls to take inappropriate content down or clear out test runs.
 *
 * Desktop-first — this is a lean-back operations task, not an in-truck one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context';
import { SEO } from '../../components/SEO';
import { adminApi, AdminApiError, type AdminOverview, type AdminBrigade, type AdminRoute, type AdminUser, type ModerationFlag } from './adminApi';
import './AdminPortalPage.css';

type TabId = 'overview' | 'brigades' | 'runs' | 'users' | 'moderation';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'brigades', label: 'Brigades' },
  { id: 'runs', label: 'Runs' },
  { id: 'users', label: 'Users' },
  { id: 'moderation', label: 'Moderation' },
];

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Load async data. Re-runs whenever `resetKey` changes (pass a filter value) or
 * `reload()` is called. `loader` is read through a ref so callers don't need to
 * memoise it.
 */
function useResource<T>(loader: () => Promise<T>, resetKey: string | number = ''): Resource<T> {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current()
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Failed to load' });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, resetKey]);

  return { ...state, reload };
}

export function AdminPortalPage() {
  const { user, isPlatformAdmin, isLoading } = useAuth();
  const [tab, setTab] = useState<TabId>('overview');
  const overview = useResource<AdminOverview>(() => adminApi.overview());

  if (isLoading) {
    return <div className="ap"><div className="ap__state">Checking access…</div></div>;
  }

  if (!isPlatformAdmin) {
    return (
      <div className="ap">
        <SEO title="Admin" description="Platform administration" noIndex />
        <div className="ap__denied">
          <ShieldAlert size={40} aria-hidden="true" />
          <h1>Not available</h1>
          <p className="ap__muted">This area is for Fire Santa Run platform administrators only.</p>
          <p><Link to="/dashboard">Back to your dashboard</Link></p>
        </div>
      </div>
    );
  }

  const openFlags = overview.data?.moderation.openForReview ?? 0;

  return (
    <div className="ap">
      <SEO title="Admin portal" description="Platform administration" noIndex />
      <div className="ap__bar">
        <div className="ap__bar-inner">
          <h1 className="ap__title"><ShieldAlert size={22} aria-hidden="true" /> Admin portal</h1>
          <span className="ap__whoami">{user?.email}</span>
        </div>
      </div>

      <div className="ap__tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className="ap__tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'moderation' && openFlags > 0 && <span className="ap__tab-badge">{openFlags}</span>}
          </button>
        ))}
      </div>

      <div className="ap__content" role="tabpanel">
        {tab === 'overview' && <OverviewTab res={overview} />}
        {tab === 'brigades' && <BrigadesTab onChange={overview.reload} />}
        {tab === 'runs' && <RunsTab onChange={overview.reload} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'moderation' && <ModerationTab onChange={overview.reload} />}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ res }: { res: Resource<AdminOverview> }) {
  if (res.loading) return <div className="ap__state">Loading…</div>;
  if (res.error || !res.data) return <div className="ap__error">{res.error || 'No data.'}</div>;
  const o = res.data;

  return (
    <>
      <div className="ap__stat-grid">
        <Stat value={o.brigades} label="Brigades" />
        <Stat value={o.users} label="Users" />
        <Stat value={o.routes.total} label="Runs (all)" />
        <Stat value={o.routes.byStatus.published || 0} label="Published runs" />
        <Stat value={o.viewerSessions} label="Viewer sessions" />
        <Stat value={o.moderation.openForReview} label="Moderation to review" />
      </div>
      <div className="ap__card">
        <div className="ap__card-head">Runs by status</div>
        <div className="ap__table-wrap">
          <table className="ap__table">
            <tbody>
              {Object.entries(o.routes.byStatus).length === 0 && (
                <tr><td className="ap__muted">No runs yet.</td></tr>
              )}
              {Object.entries(o.routes.byStatus).map(([status, count]) => (
                <tr key={status}>
                  <td><span className={`ap__pill ap__pill--${status}`}>{status}</span></td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="ap__muted" style={{ marginTop: '1rem' }}>Snapshot generated {new Date(o.generatedAt).toLocaleString('en-AU')}.</p>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="ap__stat">
      <div className="ap__stat-value">{value.toLocaleString('en-AU')}</div>
      <div className="ap__stat-label">{label}</div>
    </div>
  );
}

// ── Brigades ─────────────────────────────────────────────────────────────────

function BrigadesTab({ onChange }: { onChange: () => void }) {
  const { data, loading, error, reload } = useResource<AdminBrigade[]>(() => adminApi.brigades());
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(b: AdminBrigade) {
    if (!window.confirm(
      `Delete "${b.name}" and everything scoped to it?\n\n` +
      `• ${b.routeCount} run(s) and their viewer sessions\n• all memberships\n\nThis cannot be undone.`,
    )) return;
    setBusy(b.id);
    setActionError(null);
    try {
      const r = await adminApi.deleteBrigade(b.id);
      reload();
      onChange();
      window.alert(`Deleted. Removed ${JSON.stringify(r.removed)}`);
    } catch (e) {
      setActionError(e instanceof AdminApiError ? e.message : 'Delete failed');
    } finally {
      setBusy(null);
    }
  }

  async function setListing(b: AdminBrigade, publicListing: AdminBrigade['publicListing']) {
    setBusy(b.id);
    setActionError(null);
    try {
      await adminApi.editBrigade(b.id, { publicListing });
      reload();
    } catch (e) {
      setActionError(e instanceof AdminApiError ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="ap__state">Loading brigades…</div>;
  if (error) return <div className="ap__error">{error}</div>;

  return (
    <div className="ap__card">
      <div className="ap__card-head">
        <span>Brigades ({data?.length ?? 0})</span>
        <button className="ap__btn" onClick={reload}>Refresh</button>
      </div>
      {actionError && <div className="ap__error" style={{ margin: '0.75rem 1.1rem' }}>{actionError}</div>}
      <div className="ap__table-wrap">
        <table className="ap__table">
          <thead>
            <tr><th>Name</th><th>Location</th><th>Contact</th><th>Runs</th><th>Directory</th><th>Registered</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((b) => (
              <tr key={b.id}>
                <td>
                  <Link to={`/brigade/${b.slug}`} target="_blank" rel="noreferrer">{b.name}</Link>
                  <div className="ap__flag-meta">{b.id}</div>
                </td>
                <td>{b.location || '—'}</td>
                <td>{b.contactEmail || b.contactPhone || <span className="ap__muted">none</span>}</td>
                <td>{b.routeCount}</td>
                <td>
                  <select
                    className="ap__select"
                    value={b.publicListing}
                    disabled={busy === b.id}
                    onChange={(e) => setListing(b, e.target.value as AdminBrigade['publicListing'])}
                    aria-label={`Public directory visibility for ${b.name}`}
                  >
                    <option value="auto">Auto</option>
                    <option value="shown">Always show</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </td>
                <td>{fmtDate(b.createdAt)}</td>
                <td>
                  <button className="ap__btn ap__btn--danger" disabled={busy === b.id} onClick={() => remove(b)}>
                    {busy === b.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={7} className="ap__muted">No brigades.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Runs ─────────────────────────────────────────────────────────────────────

const RUN_STATUSES = ['', 'draft', 'published', 'active', 'completed', 'archived'];

function RunsTab({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useResource<AdminRoute[]>(() => adminApi.routes(status ? { status } : undefined), status);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(kind: 'unpublish' | 'delete', r: AdminRoute) {
    const verb = kind === 'delete' ? 'Delete' : 'Unpublish';
    if (!window.confirm(`${verb} "${r.name}" (${r.brigadeName})?${kind === 'delete' ? '\n\nThis also removes its viewer sessions and cannot be undone.' : ''}`)) return;
    setBusy(r.id);
    setActionError(null);
    try {
      if (kind === 'delete') await adminApi.deleteRoute(r.id, r.brigadeId);
      else await adminApi.unpublishRoute(r.id, r.brigadeId);
      reload();
      onChange();
    } catch (e) {
      setActionError(e instanceof AdminApiError ? e.message : `${verb} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ap__card">
      <div className="ap__card-head">
        <span>Runs ({data?.length ?? 0})</span>
        <div className="ap__filters">
          <label htmlFor="ap-run-status" className="ap__muted">Status</label>
          <select id="ap-run-status" className="ap__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {RUN_STATUSES.map((s) => <option key={s} value={s}>{s || 'all'}</option>)}
          </select>
          <button className="ap__btn" onClick={reload}>Refresh</button>
        </div>
      </div>
      {actionError && <div className="ap__error" style={{ margin: '0.75rem 1.1rem' }}>{actionError}</div>}
      {loading ? (
        <div className="ap__state">Loading runs…</div>
      ) : error ? (
        <div className="ap__error">{error}</div>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead>
              <tr><th>Run</th><th>Brigade</th><th>Status</th><th>Date</th><th>Views</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.name || <span className="ap__muted">(untitled)</span>}</td>
                  <td>{r.brigadeName}</td>
                  <td><span className={`ap__pill ap__pill--${r.status}`}>{r.status}</span></td>
                  <td>{r.date || fmtDate(r.createdAt)}</td>
                  <td>{r.viewCount}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td>
                    {['published', 'active'].includes(r.status) && (
                      <button className="ap__btn" disabled={busy === r.id} onClick={() => act('unpublish', r)}>Unpublish</button>
                    )}
                    <button className="ap__btn ap__btn--danger" disabled={busy === r.id} onClick={() => act('delete', r)}>
                      {busy === r.id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={7} className="ap__muted">No runs match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data, loading, error, reload } = useResource<AdminUser[]>(() => adminApi.users());
  return (
    <div className="ap__card">
      <div className="ap__card-head">
        <span>Users ({data?.length ?? 0})</span>
        <button className="ap__btn" onClick={reload}>Refresh</button>
      </div>
      {loading ? (
        <div className="ap__state">Loading users…</div>
      ) : error ? (
        <div className="ap__error">{error}</div>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table">
            <thead><tr><th>Email</th><th>Name</th><th>User ID</th></tr></thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.email || <span className="ap__muted">—</span>}</td>
                  <td>{u.name || '—'}</td>
                  <td className="ap__flag-meta">{u.id}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && <tr><td colSpan={3} className="ap__muted">No users.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Moderation ───────────────────────────────────────────────────────────────

const FLAG_FILTERS: { value: '' | ModerationFlag['status']; label: string }[] = [
  { value: '', label: 'all' },
  { value: 'blocked', label: 'blocked' },
  { value: 'pending', label: 'pending review' },
  { value: 'approved', label: 'approved' },
  { value: 'removed', label: 'removed' },
  { value: 'dismissed', label: 'dismissed' },
];

function ModerationTab({ onChange }: { onChange: () => void }) {
  const [filter, setFilter] = useState<'' | ModerationFlag['status']>('');
  const { data, loading, error, reload } = useResource<ModerationFlag[]>(
    () => adminApi.moderation(filter || undefined),
    filter,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const open = useMemo(() => (data ?? []).filter((f) => f.status === 'blocked' || f.status === 'pending'), [data]);

  async function resolve(f: ModerationFlag, action: 'approve' | 'remove' | 'dismiss') {
    const note = action === 'approve'
      ? window.prompt('Optional note (why this is a false positive):') ?? undefined
      : action === 'remove'
        ? window.prompt('Confirm you have taken the content down (edit the brigade / unpublish or delete the run first). Optional note:') ?? undefined
        : window.prompt('Optional note:') ?? undefined;
    setBusy(f.id);
    setActionError(null);
    try {
      await adminApi.resolveFlag(f.subjectType, f.id, action, note);
      reload();
      onChange();
    } catch (e) {
      setActionError(e instanceof AdminApiError ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <p className="ap__muted" style={{ marginBottom: '0.75rem' }}>
        {open.length} item(s) awaiting review. <strong>Blocked</strong> = the write was refused. <strong>Pending</strong> = the
        safety check could not run and the content went live — review it. To take content down, fix it on the Brigades tab or
        unpublish/delete the run, then mark the flag <em>removed</em>.
      </p>
      <div className="ap__card">
        <div className="ap__card-head">
          <span>Moderation flags ({data?.length ?? 0})</span>
          <div className="ap__filters">
            <select className="ap__select" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              {FLAG_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <button className="ap__btn" onClick={reload}>Refresh</button>
          </div>
        </div>
        {actionError && <div className="ap__error" style={{ margin: '0.75rem 1.1rem' }}>{actionError}</div>}
        {loading ? (
          <div className="ap__state">Loading…</div>
        ) : error ? (
          <div className="ap__error">{error}</div>
        ) : (
          <div className="ap__table-wrap">
            <table className="ap__table">
              <thead>
                <tr><th>Status</th><th>What</th><th>Reason</th><th>When / who</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {(data ?? []).map((f) => (
                  <tr key={f.id}>
                    <td><span className={`ap__pill ap__pill--${f.status}`}>{f.status}</span></td>
                    <td>
                      {f.subjectType} · {f.field}
                      {f.field !== 'logo' && f.value && <div><span className="ap__flag-value">{f.value}</span></div>}
                      <div className="ap__flag-meta">{f.subjectType}:{f.subjectId}</div>
                    </td>
                    <td>
                      {f.reason}
                      {f.blocklistHits.length > 0 && <div className="ap__flag-meta">blocklist: {f.blocklistHits.join(', ')}</div>}
                      {f.categories.filter((c) => c.severity > 0).length > 0 && (
                        <div className="ap__flag-meta">
                          {f.categories.filter((c) => c.severity > 0).map((c) => `${c.category} ${c.severity}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      {fmtDate(f.createdAt)}
                      <div className="ap__flag-meta">{f.createdBy}</div>
                      {f.resolvedBy && <div className="ap__flag-meta">→ {f.status} by {f.resolvedBy}</div>}
                    </td>
                    <td>
                      {(f.status === 'blocked' || f.status === 'pending') ? (
                        <>
                          <button className="ap__btn" disabled={busy === f.id} onClick={() => resolve(f, 'approve')}>Approve</button>
                          <button className="ap__btn ap__btn--danger" disabled={busy === f.id} onClick={() => resolve(f, 'remove')}>Removed</button>
                          <button className="ap__btn" disabled={busy === f.id} onClick={() => resolve(f, 'dismiss')}>Dismiss</button>
                        </>
                      ) : (
                        <span className="ap__muted">{f.resolutionNote || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(data ?? []).length === 0 && <tr><td colSpan={5} className="ap__muted">No flags.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
