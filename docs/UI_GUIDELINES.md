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

- `--fire-red` `#D32F2F` (primary), `--fire-red-dark` `#B71C1C`
- `--summer-gold` `#FFA726`; for **text** use the AA-safe
  `--summer-gold-dark` `#F57C00` / `--summer-gold-darker` `#E65100`
- `--christmas-green` `#43A047`, `--eucalyptus-green` `#66BB6A`
- `--santa-red` `#D62828`, `--summer-gold` `#FFE600` (high-vis accent),
  `--candy-white` `#FFFFFF`
- Neutrals `--neutral-50 … --neutral-900`

Radii `--border-radius` (20) / `-md` / `-sm` / `-xs`; shadows `--ui-shadow*`.

## Typography

- Headings: `--font-heading` (Baloo 2, with Fredoka One / Nunito fallbacks)
- Body: `--font-body` (Nunito)
- Playful accents: `--font-fun` (Fredoka One)

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
