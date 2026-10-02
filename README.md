# SynRG '26 schedule

The phone schedule for SynRG '26 at Overdevest Nurseries, October 6–8, 2026:
live "Right now" panel, all three days, ride labels (🚌 provided / 🚗 on your
own), the Wednesday working-group rooms, a map of Overdevest, and English /
Español.

**Live:** https://carynamichel-hue.github.io/synrg/

## Editing

Everything on the page lives in the `CONFIG` block at the top of
`index.html` — times, places, rides, groups, "Good to know". Edit it here on
GitHub (pencil icon) or locally; a push publishes in about a minute.

- Text comes in pairs: `{ en: "…", es: "…" }`.
- `EDIT_MODE = true` shows orange ADD chips for anything still blank. Set it
  to `false` before the QR code goes up.
- **This page is public.** No Wi-Fi passwords or private numbers.

`tools/check.mjs` checks the page at a phone width at chosen moments (before
the event, Wednesday morning, overnight, after) — see the top of the file.
