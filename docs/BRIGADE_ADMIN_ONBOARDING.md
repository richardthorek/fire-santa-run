# Brigade Admin Onboarding Guide

Welcome! This guide walks a brigade volunteer through getting their brigade set
up on Fire Santa Run, from claiming the brigade to going live on Christmas Eve.

Tracking issue: #344. Complements the in-app onboarding checklist (#154) shown on
the dashboard.

> **Time needed:** ~15 minutes for setup. You can do it on a phone or computer.

---

## 1. Sign in

> **Updated 2026-07-19:** Fire Santa Run's own sign-in (Entra CIAM) and its
> local brigade-claiming/member-verification system have been retired.
> Identity, brigades, and roles are now managed entirely by **Station
> Manager**, the StationKit suite's identity provider — see
> [`MASTER_PLAN.md`](../MASTER_PLAN.md) ("StationKit suite identity") and
> [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for the full picture.

1. Go to the Fire Santa Run home page and tap **Sign In**.
2. If you're already signed into Station Manager or Fire Break Calculator on
   `.stationkit.com.au`, you land signed in automatically (silent SSO) — no
   extra step.
3. Otherwise, sign in (password or passkey) or create a brand-new brigade
   account directly from the Fire Santa Run login page — this creates a new
   Station Manager organization for you, so you don't need to touch Station
   Manager first if you're only using Fire Santa Run.

---

## 2. Your brigade is provisioned automatically

There's no separate "claim your brigade" step any more. A brigade's ID is
literally your Station Manager organization ID: the first time you sign in
with an account whose organization has no Fire Santa Run brigade yet, one is
created for you automatically. You're the admin because you're the owner/admin
of that Station Manager organization.

You can browse all brigades at **/brigades** to see how your public page will
appear to the community.

---

## 3. Invite your members

Members, roles, and invitations are managed in **Station Manager**, not here
— see Station Manager's own administrator guide (`Admin → Organization`,
or the in-app help button). Roles map onto Fire Santa Run as:

- **Owner / Admin** — full control: plan routes, drive/broadcast runs, edit
  brigade settings.
- **Viewer** — read-only.

(Fire Santa Run's old standalone "Operator" role has folded into Admin.)

---

## 4. Set up your brigade profile

A complete profile makes your public page look great and helps families find you.

1. User menu → **Brigade Settings**.
2. **Upload a logo** (PNG/JPEG/WebP, up to 2 MB — it's auto-resized).
3. Pick a **theme colour** for your page accent.
4. Add **contact details** (email, phone, website) — these show on your public
   page so the community can reach you.
5. Tap **Save settings**.

---

## 5. Create and publish your first route

1. From the **Dashboard**, tap **Create Route** (or **New Route**).
2. Give it a name and date (e.g. "Christmas Eve — North Route").
3. Add **waypoints** by searching addresses or tapping the map — these are the
   stops Santa will visit.
4. Use **Optimise** to order the stops efficiently (optional).
5. Review the estimated route, then set the status to **Published** so it appears
   on your public page and can be tracked.

> Drafts are private. Only **published**, **active**, and **completed** routes
> appear publicly.

---

## 6. Share your run

1. Open the route and use **Share** to get a link and QR code.
2. Post the link (or your brigade page, `/brigade/your-slug`) to your community —
   Facebook, flyers, the local school newsletter, etc.
3. Families can follow with no app and no sign-in. Point them at the
   [How to Track Santa](/help) page.

---

## 7. Go live on the night

1. On the truck, open the route and start **Navigation**.
2. Allow location access and keep the screen on (lock-screen tracking is
   supported).
3. Your live position broadcasts to everyone watching. The public tracker shows
   Santa moving and an ETA to the next stop, including an
   **ahead/behind schedule** indicator.
4. Mark stops complete as you go. When finished, end navigation — the route moves
   to **completed** and shows a thank-you screen to late viewers.

---

## Tips & troubleshooting

- **No GPS / location blocked?** Check the browser/site location permission on
  the operator's phone.
- **Tracking looks frozen?** Live tracking depends on mobile coverage; it resumes
  when signal returns.
- **Need to fix a stop mid-run?** Admins can skip to the next stop from the
  navigation panel.
- **Privacy questions?** See the [Privacy Policy](/privacy). Live location is
  shared only while a run is active and isn't kept as a location history.

Happy Santa running! 🎅🚒🎄
