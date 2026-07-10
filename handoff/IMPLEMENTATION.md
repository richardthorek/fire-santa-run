# Fire Santa Run — Design System v2.0 · Implementation Handoff

Everything Claude Code needs to roll the new design system into the
`richardthorek/fire-santa-run` repo. It maps onto the **existing** token names
in `src/index.css` (`:root`) so the change is mostly a values + assets swap,
not a rewrite.

**Goal:** make Fire Santa Run recognisably part of the **Station Manager /
Bushie Tools** family (shared neutrals, spacing, flat components, Lucide icons,
Public Sans + JetBrains Mono) while staying **warmer, brighter and more
festive** — most of the app is public-facing (parents on phones on a summer
night). Keep dark mode. Keep WCAG 2.1 AA.

Visual reference: `Fire Santa Run Design System.dc.html` in this folder (the
showcase this was signed off from). Drop-in tokens: `tokens.css`.

---

## 0. Summary of what changes

| Area | Before | After |
|---|---|---|
| Brand red | `#D32F2F` / `#D62828` (two reds) | **`#D8232A` Signal Red** (one, aligned to Station Manager) |
| Secondary accent | `#FFA726` gold + `#FFE600` neon RFS-yellow | **`#F6A609` Summer Gold** (sun/beach); neon yellow retired |
| Festive accent | ad-hoc `#43A047` green | **`#1E9E62` Christmas Green** (doubles as success) |
| Neutrals | warm `#212121…#FAFAFA` grey ramp | **cool-slate ramp** (`#0C1220` → `#FFFFFF`) shared with Station Manager |
| Headings | Baloo 2 (+ Fredoka One / Quicksand) | **Baloo 2** kept (the "fun sibling" face); Fredoka + Quicksand dropped |
| Body | Nunito | **Public Sans** (the thread shared with Station Manager) |
| Codes/slugs/IDs | Nunito | **JetBrains Mono** |
| Icons | emoji everywhere (🎅🚒👤📊⚙️🎁) | **Lucide** line icons in all functional UI; emoji marketing-only |
| Buttons | red→dark **gradients**, `translateY(-2px)` lift | **flat** fills, radius 12px, shadow-only hover |
| Favicon/app icon | orange flame + floating pom + corner stars | **signal flame + integrated Santa hat** in a Signal-Red rounded tile |
| Dark mode | present but secondary | **hero theme for the public tracker** ("night tracking") |
| Terminology | mixed | festive-but-confident, consistent nouns (see §4) |

---

## 1. Fonts

In `index.html`, replace the current Google Fonts `<link>` (the one loading
`Fredoka One`, `Baloo 2`, `Nunito`, `Quicksand`) with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Public+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Keep the existing async-load pattern (`media="print"` swap + `<noscript>`
fallback) that `index.html` already uses — just swap the family list.
`src/utils/fontLoader.ts` references the font names; update them there too.

---

## 2. Design tokens — `src/index.css`

Replace the brand + neutral + semantic vars in `:root` with the contents of
`tokens.css` (in this folder). Notes:

- **Legacy names are preserved** as aliases (`--fire-red`, `--gold-accent`,
  `--neutral-*`, `--border-radius*`, `--ui-shadow*`, `--font-heading`,
  `--font-fun`, `--candy-white`, `--rfs-yellow`) — existing components keep
  working; you can migrate call sites to the new names opportunistically.
- `--font-heading` / `--font-fun` both now alias `--font-display` (Baloo 2), so
  the many components already using those keep the festive look.
- The dark block goes in `[data-theme="dark"]` (the repo already uses this
  attribute).

### Button treatment — remove the gradients (`src/index.css` button system)

The current `.btn-primary/.btn-success/.btn-warning` use
`linear-gradient(135deg, …)` backgrounds. Replace each with the **flat** token:

```css
.btn { border-radius: var(--radius-md); font-family: var(--font-display); font-weight: 700; }
.btn-primary { background: var(--santa-red);      color: var(--snow); box-shadow: 0 2px 6px -2px rgba(216,35,42,.4); }
.btn-primary:not(:disabled):hover { background: var(--santa-red-dark); box-shadow: var(--shadow-md); } /* no translateY lift */
.btn-success { background: var(--christmas-green); color: var(--snow); }
.btn-warning { background: var(--summer-gold);     color: var(--summer-gold-ink); } /* ink on gold, not white */
.btn-danger  { background: var(--santa-red-dark);  color: var(--snow); }
.btn-secondary { background: transparent; color: var(--santa-red); border: 2px solid var(--santa-red); }
```

Keep the global rule that the default button `background` is a flat
`background-color` (never a gradient image) — that fix in the current file
prevented the "white button renders red-on-red" bug and must stay.
Retain focus outlines; drop the `translateY(-2px)` hover lift on kiosk/primary
CTAs (shadow change only). Disabled must look unmistakably non-clickable
(`--slate-300` fill, `--neutral-500` text).

---

## 3. Iconography — replace emoji in functional UI

```bash
npm i lucide-react
```

Import from `lucide-react`; size via the `size` prop, colour via `currentColor`
on the parent. Never below 18px on the kiosk/tracker.

### Module → Lucide map

| Module / route | Emoji (old) | Lucide icon |
|---|---|---|
| Brand mark (header 🎅) | 🎅 | the flame mark (SVG, §5) — not an icon |
| Plan a Route (`RouteEditor`) | — | `Route` |
| Live Tracking (`TrackingView`) | 📍 | `Radio` |
| Navigate / in-truck (`NavigationView`) | — | `Navigation` |
| Share & QR (`SharePanel`, `ShareModal`) | 🔗 | `QrCode` |
| Dashboard | 📊 | `LayoutDashboard` |
| Find a Brigade (`BrigadeDiscoveryPage`) | — | `Search` |
| Members (`MemberManagementPage`) | 👥 | `Users` |
| Claim Brigade (`BrigadeClaimingPage`) | 🚒 | `ShieldCheck` |
| Analytics (`AnalyticsDashboard`) | 📊 | `BarChart3` |
| Brigade Settings (`BrigadeSettingsPage`) | ⚙️ | `Settings2` |
| Your Profile (`AppHeader` menu) | 👤 | `User` |
| Logout (`AppHeader` menu) | 🚪 | `LogOut` |

Common UI: `MapPin, Navigation, Share2, Download, Bell, Clock, CalendarCheck,
Check, CircleCheckBig, TriangleAlert, CircleAlert, Info, ArrowRight,
ChevronRight, Plus, X, SlidersHorizontal, Play, Pause`.

Festive **line** glyphs (still Lucide, for tasteful festive UI touches):
`Gift, TreePine, Snowflake, Sparkles, PartyPopper`.

Start with `src/components/AppHeader.tsx` (🎅 brand → flame mark; menu
`👤/📊/👥/⚙️/🚒/🚪` → `User/LayoutDashboard/Users/Settings2/ShieldCheck/LogOut`),
then `src/App.tsx` (loading 🎅, 404 🎅/🏠/🚒, update-banner 🎁, dev-mode 🛠️).

### Emoji policy

🎅 🎄 🎁 ⭐ are **marketing / celebration only** — landing hero eyebrow,
empty-states, "thank you" overlays, poster/OG art, push copy. They must **never**
appear in functional UI: buttons, menus, nav, status, form labels. In those
places use the Lucide equivalent. (One sanctioned exception: the festive
Santa-marker glyph on the live map, which is decorative content, not chrome.)

---

## 4. Terminology & voice

Festive and fun, but **confident** — brigades pay for this. Consistent nouns
across every surface:

| Term | Means | Avoid |
|---|---|---|
| **Santa Run** | the event — the night Santa visits | "the trip", "the drive" |
| **Route** | the planned path Santa follows | — |
| **Stop** | a point on the route (public word for *waypoint*) | "waypoint" in user-facing copy |
| **Brigade** | the organisation; say "brigade or community group" on first public mention | fire-only / AU-only framing |
| **Live Tracking** | the public map experience | "broadcast", "GPS feed" in UI |
| **Member** | a person in a brigade; "Admin" only for elevated access | — |

**Say:** "Track Santa live tonight." · "Plan your route in minutes." · "Trusted
by volunteer brigades Australia-wide." · "No login needed — just tap and follow."

**Don't:** leak implementation names (Mapbox, Azure, Entra, WebPubSub) into
user-facing copy · expose data-model field names · go over-the-top ("lol Santa
go brrr 🎅🎅🎅").

Apply to UI strings, route titles, `manifest.json` copy, and OG/meta
descriptions. Leave data-model / API field names unchanged.

---

## 5. Brand mark, favicon & manifest

- New mark = **signal flame + integrated Santa hat** in a Signal-Red rounded
  tile (rounded-square, `rx≈22%`, iOS/Station-Manager squircle family). The
  showcase HTML contains a reference SVG (search `viewBox="0 0 512 512"`), but
  **have a designer or Claude Code redraw it cleanly** as the production
  `public/icon.svg` — the showcase version is a proposal, not final art.
  Requirements: flame in `--summer-gold`→`#FFD166`, hat in `--santa-red-light`
  + white fur brim + white pom; centre the flame within the middle 80% so the
  512 is **maskable-safe**; legible at 16px (drop the current corner stars).
- Regenerate the raster set from the final `icon.svg`:
  `icon-48/72/96/144/192/512`, `icon-maskable-192/512`, `apple-touch-icon`
  (180), and the `/splash/*` set — all currently in `public/`.
- `public/manifest.json`: `"theme_color": "#D8232A"`; change
  `"background_color"` from `#D32F2F` to **`#FFFFFF`** (snow).
- `index.html`: `<meta name="theme-color" content="#D8232A">` (currently
  `#D32F2F`); update the inlined critical-CSS `background-color`/`color` to the
  new paper/ink (`#F4F6F9` / `#0C1220`); swap the `#msal-loading` 🎅 emoji for
  the flame mark or keep it (loading screen counts as pre-app splash, emoji OK).
- `public/og-image.svg`: rebuild with the new mark + Signal Red + Summer Gold.

---

## 6. Component polish (from the showcase)

- **Cards** — `background: var(--bg-card, #fff)`, `1px solid var(--hairline)`,
  `--radius-lg`, `--shadow-md`. One **flat accent bar** (5px, top) per card,
  coloured by state, replacing any multi-colour gradient bars.
- **Route status** — use the real lifecycle from `src/types/index.ts`
  (`draft → published → active → completed → archived`) mapped to pills:
  - `draft` → slate: `--slate-500` on `--hairline`
  - `published` → info: `--text-info-strong` on `--surface-info`
  - `active` → success + a pulsing dot (`--christmas-green`)
  - `completed` → success (no dot)
  - `archived` → slate on paper, hairline border
  See `src/components/RouteStatusBadge.tsx`.
- **Status pills** generally — `--surface-*` / `--text-*-strong` pairs + the
  matching Lucide icon (`CircleCheckBig` / `TriangleAlert` / `CircleAlert` /
  `Info`).
- **Landing hero** (`src/pages/LandingPage.tsx`) — solid ink panel
  (`--ink #0C1220`) with a gold eyebrow, flat CTAs; retire heavy gradients /
  decorative circles.
- **Night tracker** (`TrackingView`) — dark theme is the hero: `--bg-primary`
  map surround, `--santa-red` (dark-variant) primary, warm gold route line, a
  soft pulsing glow on the Santa marker.

---

## 7. Paste this into Claude Code

> I'm applying the "Fire Santa Run Design System v2.0" (see
> `design_handoff_design_system_v2/README.md` and `IMPLEMENTATION.md`).
> Implement it across the repo in this order, keeping CI green (lint +
> typecheck + tests) and WCAG 2.1 AA:
>
> 1. Swap the Google Fonts link in `index.html` (Baloo 2 + Public Sans +
>    JetBrains Mono) and update font names in `src/utils/fontLoader.ts`.
> 2. Replace the tokens in `src/index.css :root` and `[data-theme="dark"]` with
>    `tokens.css`. Keep the legacy `--fire-red` / `--neutral-*` aliases.
> 3. Flatten the gradient buttons; set button + heading font to Baloo 2; drop
>    the hover translateY lift on primary CTAs.
> 4. `npm i lucide-react`; replace every emoji in functional UI with the mapped
>    Lucide icon (§3), starting with `AppHeader.tsx`, then `App.tsx`, then
>    tracking / route / dashboard / admin pages.
> 5. Apply the terminology & voice pass (§4) to UI strings, route titles and
>    `manifest.json` copy — leave data-model / API field names unchanged.
> 6. Produce a clean `public/icon.svg` for the new mark (§5), regenerate the
>    raster + maskable + splash set, and set `manifest.json` +
>    `index.html` theme-color to `#D8232A`, background_color to `#FFFFFF`.
> 7. Apply the card / status-pill / landing-hero / night-tracker polish (§6).
>
> Do it as a series of small, reviewable commits — one per numbered step — and
> run `npm run test:a11y` before opening the PR.

---

## Files in this bundle

- `README.md` — start here; what this is and how to use it.
- `IMPLEMENTATION.md` — this document.
- `tokens.css` — drop-in `:root` + dark tokens for `src/index.css`.
- `Fire Santa Run Design System.dc.html` — the visual showcase (design
  reference; it's an HTML prototype, not production code).
- `current-icon-reference.png` — today's app icon, for the before/after.
