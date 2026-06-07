# Pre-Launch Security Review

Tracking issue: #342 (Week 4 quality gate). This document records the
pre-launch security review of the public-facing Fire Santa Run app and the
remediations applied in the launch branch.

> Scope: the v1.0 public launch surface — public brigade pages, brigade
> discovery, brigade settings/branding, the two backends (`server/` Hono and
> `api/` Functions), and the dependency/secret posture.

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Dependency audit | ✅ Pass | `npm audit` clean across root / `api/` / `server/` |
| Client-side XSS (public pages) | ✅ Fixed | URL sanitisers + CodeQL clean (6 alerts resolved) |
| Auth on brigade writes | ✅ Fixed | POST/PUT/DELETE now require auth + admin permission |
| Cross-brigade isolation | ✅ Verified | Writes gated by `checkBrigadePermission(..., 'edit_settings')` |
| Public data leakage | ✅ Fixed | Discovery uses sanitised `/brigades/public` projection |
| Security headers | ✅ Added | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| CORS | ✅ Tightened | Prod allowlists a single origin (`CORS_ORIGIN`), not `*` |
| Upload validation (logo) | ✅ Pass | Type + size validated client-side; raster-only, SVG excluded |
| Secret hygiene | ✅ Pass | No secrets in repo; tokens via env/GitHub secrets |
| Rate limiting (negotiate/broadcast) | ⚠️ Follow-up | Recommend App Service / front-door throttling — see below |

## Findings & remediations

### 1. Unauthenticated brigade write endpoints — FIXED
**Before:** `POST/PUT/DELETE /api/brigades[/:id]` had no auth in `server/`, so
anyone could create, modify, or delete any brigade.

**After:** all three verbs call `validateToken()` and, for PUT/DELETE, require
the caller to hold the `edit_settings` permission on that specific brigade via
`checkBrigadePermission()`. This enforces brigade-scoped isolation — an admin of
brigade A cannot modify brigade B. Mirrored in both backends.

### 2. PII leakage on the public discovery list — FIXED
The discovery page lists every brigade. The full brigade record includes
`allowedDomains`, `allowedEmails`, and `adminUserIds`. A new
`GET /api/brigades/public` returns the same sanitised projection already used by
`/brigades/by-slug/:slug` (id, slug, name, location, logo, themeColor, contact,
isClaimed). The HTTP storage adapter's `getBrigades()` now calls `/public`.

### 3. Missing security headers — FIXED
Added a global middleware in `server/src/app.ts` setting `X-Content-Type-Options:
nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
and `X-Permitted-Cross-Domain-Policies: none` on every response.

### 4. Permissive CORS — TIGHTENED
In production the server now reflects only the configured `CORS_ORIGIN`
(defaulting to the production domain) instead of allowing any origin. Dev mode
relies on the Vite proxy and is unaffected.

### 5. Client-side XSS on public brigade page — FIXED (earlier in branch)
`safeHttpUrl` / `safeImageSrc` parse user-provided URLs via `new URL()` (no base)
and return the normalised `href`, which percent-encodes HTML meta-characters and
restricts schemes to http(s) (plus raster `data:image/*`, SVG excluded). All 6
CodeQL `js/xss` + `xss-through-dom` alerts are resolved.

### 6. OData injection — VERIFIED
Slug/RFS-id lookups escape single quotes via `escapeODataValue()` before building
table filters (pattern established in #287). Swept the new `/public` and
membership queries; all user-supplied filter values are escaped.

### 7. Logo upload validation — VERIFIED
Client validates MIME type (`image/png|jpeg|webp`) and a 2 MB cap before
canvas-resizing to a data URL. `safeImageSrc` additionally blocks `data:image/svg`
(can embed script) at render time on the public page.

## Residual / post-launch follow-ups

- **Rate limiting** on `/api/negotiate` and `/api/broadcast`: recommend enforcing
  at the Azure App Service / Front Door layer (per-IP throttling) before scaling
  marketing. Tracked as a fast-follow.
- **HSTS / CSP**: HTTPS + HSTS are terminated/served by Azure App Service; a
  full `Content-Security-Policy` for the SPA (with the Mapbox allowlist) is a
  recommended hardening step post-launch.
- **`GET /api/brigades` (full record)** remains unauthenticated for now but is no
  longer used by the client (discovery uses `/public`). Consider requiring auth
  on it in a follow-up.

## Sign-off checklist

- [x] No high/critical dependency findings (`npm audit` clean ×3)
- [x] Cross-brigade write attempts denied (auth + permission gate)
- [x] Public projections contain no member PII
- [x] Security headers present; CORS not `*` in prod
- [x] CodeQL JavaScript/TypeScript analysis clean on the launch branch
- [x] No secrets committed to the repository
