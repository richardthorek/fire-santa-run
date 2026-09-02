/**
 * Typed client for the platform-admin API (`/api/admin/*`).
 *
 * Every call carries the Station Manager bearer token; the server gates the
 * whole surface on `isPlatformAdmin`. A non-admin gets 403 here — the portal
 * page also guards on `useAuth().isPlatformAdmin` so this is defence in depth.
 */

import { getApiAuthHeaders } from '../../auth/apiToken';

const BASE = '/api/admin';

export class AdminApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(await getApiAuthHeaders()), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.message || body?.error || message;
    } catch {
      /* non-JSON */
    }
    throw new AdminApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  brigades: number;
  users: number;
  routes: { total: number; byStatus: Record<string, number> };
  viewerSessions: number;
  moderation: { total: number; byStatus: Record<string, number>; openForReview: number };
  generatedAt: string;
}

export interface AdminBrigade {
  id: string;
  slug: string;
  name: string;
  location: string;
  fireStationId: string;
  contactEmail: string;
  contactPhone: string;
  hasLogo: boolean;
  themeColor: string;
  publicListing: 'auto' | 'shown' | 'hidden';
  createdAt: string;
  updatedAt: string;
  routeCount: number;
}

export interface AdminBrigadeDetail extends Omit<AdminBrigade, 'hasLogo' | 'routeCount'> {
  contact: Record<string, string>;
  logo: string;
}

export interface AdminRoute {
  id: string;
  brigadeId: string;
  brigadeName: string;
  name: string;
  status: string;
  date: string;
  createdAt: string;
  createdBy: string;
  publishedAt: string;
  viewCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface ModerationFlag {
  id: string;
  subjectType: 'brigade' | 'route';
  subjectId: string;
  brigadeId: string;
  field: 'name' | 'description' | 'logo';
  value: string;
  status: 'blocked' | 'pending' | 'approved' | 'removed' | 'dismissed';
  decision: 'allow' | 'block' | 'skipped';
  reason: string;
  categories: { category: string; severity: number }[];
  blocklistHits: string[];
  createdAt: string;
  createdBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

// ── Calls ────────────────────────────────────────────────────────────────────

export const adminApi = {
  overview: () => request<AdminOverview>('/overview'),

  brigades: () => request<AdminBrigade[]>('/brigades'),
  brigade: (id: string) => request<AdminBrigadeDetail>(`/brigades/${encodeURIComponent(id)}`),
  editBrigade: (
    id: string,
    patch: Partial<Pick<AdminBrigadeDetail, 'name' | 'location' | 'logo' | 'themeColor' | 'contactEmail' | 'contactPhone'>> & { publicListing?: 'auto' | 'shown' | 'hidden' },
  ) => request<{ ok: true }>(`/brigades/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteBrigade: (id: string) =>
    request<{ ok: true; removed: Record<string, number> }>(`/brigades/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  routes: (params?: { status?: string; brigadeId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.brigadeId) q.set('brigadeId', params.brigadeId);
    const qs = q.toString();
    return request<AdminRoute[]>(`/routes${qs ? `?${qs}` : ''}`);
  },
  unpublishRoute: (id: string, brigadeId: string) =>
    request<{ ok: true }>(`/routes/${encodeURIComponent(id)}/unpublish?brigadeId=${encodeURIComponent(brigadeId)}`, { method: 'POST' }),
  deleteRoute: (id: string, brigadeId: string) =>
    request<{ ok: true; removed: Record<string, number> }>(`/routes/${encodeURIComponent(id)}?brigadeId=${encodeURIComponent(brigadeId)}`, { method: 'DELETE' }),

  users: () => request<AdminUser[]>('/users'),

  moderation: (status?: ModerationFlag['status']) =>
    request<ModerationFlag[]>(`/moderation${status ? `?status=${status}` : ''}`),
  resolveFlag: (subjectType: 'brigade' | 'route', id: string, action: 'approve' | 'remove' | 'dismiss', note?: string) =>
    request<ModerationFlag>(`/moderation/${subjectType}/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    }),
};
