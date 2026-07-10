# Handoff: Fire Santa Run — Design System v2.0

## Overview
A refreshed, unified design system for the **Fire Santa Run** app
(`richardthorek/fire-santa-run`). It replaces the current mix of two reds, a
scattered festive palette, four font families and emoji-everywhere iconography
with one coherent system that is **recognisably part of the Station Manager /
Bushie Tools family** (shared cool-slate neutrals, spacing, flat components,
Public Sans + JetBrains Mono, Lucide icons) while staying **warmer, brighter and
more festive** for its mostly-public audience. Covers colour, typography, icons,
the brand mark/favicon, components, terminology and dark mode.

## About the design files
The `Fire Santa Run Design System.dc.html` file in this bundle is a **design
reference created in HTML** — a prototype showing the intended look, tokens and
components, **not production code to copy directly**. The task is to **apply
this system to the existing `fire-santa-run` codebase** (React 19 + TypeScript +
Vite) using its established patterns — chiefly a values + assets swap against
the existing token names in `src/index.css`. `tokens.css` is the one file meant
to be used almost verbatim (pasted into `:root` / `[data-theme="dark"]`).

## Fidelity
**High-fidelity.** Final colours (exact hex), typography, spacing, radii,
shadows, iconography and terminology are specified. Recreate faithfully using
the codebase's existing CSS-variable + `.btn-*` class system and `lucide-react`.

## Where to start
1. Read `IMPLEMENTATION.md` in full — it is self-sufficient and maps every
   change onto real repo files (`src/index.css`, `index.html`, `manifest.json`,
   `public/icon.svg`, `AppHeader.tsx`, `App.tsx`, page components).
2. Open `Fire Santa Run Design System.dc.html` for the visual reference.
3. Paste `tokens.css` into `src/index.css`.
4. Follow the ordered, commit-per-step plan in `IMPLEMENTATION.md §7`.

## Design tokens
Full token set (light + dark) is in `tokens.css`. Headlines:
- **Brand:** Signal Red `#D8232A` (primary/actions), Summer Gold `#F6A609`
  (accent), Christmas Green `#1E9E62` (festive + success), Snow `#FFFFFF`.
- **Neutrals (cool slate):** ink `#0C1220`, slate-700 `#1E2637`, slate-500
  `#55607A`, slate-300 `#D3DAE6`, hairline `#E6EAF1`, paper `#F4F6F9`.
- **Semantic:** success `#1E9E62`, warning `#F6A609`, info `#2563EB`, critical
  `#D8232A`, each with a `--surface-*` / `--text-*-strong` pair.
- **Type:** `--font-display` Baloo 2 (headings + buttons), `--font-body`
  Public Sans, `--font-mono` JetBrains Mono.
- **Radius:** 8 / 12 / 16 / 20. **Shadows:** soft, layered (`--shadow-sm/md/lg`).
- **Dark ("night tracking"):** bg `#0A0F1A`, card `#121A29`, red fill `#E5484D`,
  gold text `#FFC759`, green text `#8BE4B5`.

## Iconography
Adopt **Lucide** (`lucide-react`) for all functional UI; module → icon map in
`IMPLEMENTATION.md §3`. Emoji (🎅🎄🎁) are marketing/celebration only.

## Terminology
Festive-but-confident. Locked nouns: **Santa Run** (event), **Route** (path),
**Stop** (waypoint), **Brigade** (org, "or community group"), **Live Tracking**,
**Member**. Full say/don't-say guidance in `IMPLEMENTATION.md §4`.

## Assets
- `current-icon-reference.png` — today's app icon (from `public/icon-192x192.png`),
  for the before/after only.
- The new brand mark is described in `IMPLEMENTATION.md §5`; a reference SVG
  lives inside the showcase HTML, but produce clean production art for
  `public/icon.svg` and regenerate the raster/maskable/splash set from it.

## Files
- `README.md` — this file.
- `IMPLEMENTATION.md` — full implementation spec mapped to repo paths.
- `tokens.css` — drop-in `:root` + dark tokens.
- `Fire Santa Run Design System.dc.html` — visual showcase (design reference).
- `current-icon-reference.png` — current icon.
