# UI & Design Guidelines

How Fire Santa Run should look and feel. The **source of truth for tokens is
`src/index.css` (`:root`)** — this doc explains intent; never hardcode hex when
a token exists.

## Design intent

Slick, modern, information-rich, and fun — an Australian summer-Christmas theme
that stays festive without becoming clip-art. Clean, uncluttered, confident.
Don't regress this.

## Who each surface is for

Design each surface for its real user and device:

- **Public tracking (`/track/:id`), the demo, the navigator (in-truck) view →
  mobile-first.** On the night, the overwhelming majority of users are parents
  on phones and one mounted phone in the truck. Design at 375px first; the map
  is the star, chrome is minimal, the bottom sheet caps at ~⅓ of the viewport.
- **Route editor / creation and the dashboard → tablet and desktop first.**
  Planning is a lean-back task done on a laptop or iPad. Use the space: map on
  one side, a working sidebar on the other, dense-but-legible lists. It must
  still function on a phone, but phone is not the design target here.

## Colour tokens (from `src/index.css`)

Key brand tokens — always reference the variable:

- `--santa-red` `#D8232A` (all primary actions), `--santa-red-dark` `#B01620`
  for hover and pressed. `--fire-red` is an alias of `--santa-red`.
- `--summer-gold` `#F6A609` is the accent. Put `--summer-gold-ink` `#241A00`
  text on a gold fill. For gold **text** on white use `--summer-gold-dark`
  `#B26A00` (AA, about 4.5:1).
- `--christmas-green` `#1E9E62` for festive accents and success;
  `--christmas-green-dark` `#0B5C3B` for text on light surfaces.
- `--snow` `#FFFFFF` (`--candy-white` aliases it), `--paper` `#F4F6F9` page
  background, `--ink` `#0C1220` primary text.
- Neutrals `--neutral-50 … --neutral-900`
- Dark mode is set by `[data-theme="dark"]` and redefines these tokens.
  Pages that need a night view opt in; the tracker does not yet.

Radii `--border-radius` (20) / `-md` / `-sm` / `-xs`; shadows `--ui-shadow*`.

## Typography

- Headings and buttons: `--font-display` (Baloo 2); `--font-heading` is an alias
- Body: `--font-body` (Public Sans)
- Codes, route IDs and ETAs: `--font-mono` (JetBrains Mono)
- Icons: Lucide (`lucide-react`). Keep emoji for decoration only, never for
  controls or status.

## Buttons

Gradient primaries, rounded corners, clear hover lift. **Never red-on-red** or
low-contrast text on a coloured fill. Enabled and disabled states must be
unmistakably different — a disabled action should never look clickable, and an
enabled one should never look disabled. See [`BUTTON_SYSTEM.md`](BUTTON_SYSTEM.md).

## Accessibility (target WCAG 2.1 AA)

- Verify contrast with the AA-safe token variants for text on colour.
- Every interactive control has an accessible name; icon-only buttons carry
  `aria-label`.
- Run `npm run test:a11y` after any UI change; keep keyboard navigation intact
  (see [`KEYBOARD_NAVIGATION.md`](KEYBOARD_NAVIGATION.md) and
  [`ACCESSIBILITY_README.md`](ACCESSIBILITY_README.md)).

## Copy

Write for volunteers and families, not engineers. Say "smart route
optimisation", "instant live updates", "secure sign-in" — never leak
implementation names (Mapbox, Azure Web PubSub, Entra) into user-facing copy.
Inclusive and worldwide: brigades, fire departments, and community groups
everywhere — not AU-only, not fire-only.
