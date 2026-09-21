# 01 — Tracer bullet: one reference, end to end

**What to build:** The collector double-clicks `index.html` and the library opens with no server
running. One real design reference is shown as a tile with its screenshot, name and category.
Clicking the tile opens that reference's detail view at its own URL, showing everything needed to
use the reference: hero screenshot (openable full size), name linking to the live site, category
badge with its one-line definition, summary, keyword chips, colour swatches that copy their hex
when clicked, type notes, and the image prompt and brief each behind a copy button that visibly
confirms the copy. The browser back button returns to the grid.

This slice cuts through every layer, so it is what pins down the record and category schema —
against a real captured reference rather than in the abstract — and establishes the data-access
seam that is the only code aware of where entries come from. Visual styling is minimal and dark;
the designed appearance is ticket 05.

The reference is captured by the agent, not entered by hand: given a URL, the agent takes the
screenshot and writes the summary, keywords, palette, type notes, image prompt and brief to the
content contracts in the spec.

**Blocked by:** None — can start immediately.

_Requires at least one reference URL from the user before work can begin._

**Status:** done

- [x] `index.html` opens by double-click from the filesystem with no server running, and renders — confirmed by the collector
- [x] One real reference is captured: screenshot stored locally, all schema fields written
- [x] The record carries every field in the spec's schema, including a stable `id`, `createdAt`, and the reserved `ownerId`
- [x] Data is loaded from a classic script assigning a global — no `fetch`, no ES modules
- [x] A data-access module exposes `getEntries()` and `getEntry(id)` and is the only code that knows the data's origin
- [x] The grid renders a tile showing screenshot, name and category
- [x] Clicking a tile routes to `#/entry/<id>`; the back button returns to the grid
- [x] An unknown or malformed entry id shows something sensible rather than a blank page
- [x] The detail view shows all eight sections in the spec's order
- [x] The hero screenshot can be opened full size
- [x] The site name links to `sourceUrl`, and degrades gracefully when there is no `sourceUrl`
- [x] Clicking a palette swatch copies its hex code
- [x] The image prompt and brief are both readable on the page and each has a working copy button
- [x] Copy actions give visible confirmation
- [x] The image prompt follows its contract: ~60 words, dense visual description, no interface or instruction language
- [x] The brief follows its contract: 200–350 words, structured prose, opening with a `[YOUR SUBJECT]` placeholder so it is a reusable style template

## Comments

Built end to end and verified over `localhost` in Chrome: grid, detail view, routing, hero
lightbox, palette-copy, and both prompt copy buttons all work. One fix made during verification —
`navigator.clipboard.writeText` can hang indefinitely waiting on a permission prompt with no UI to
answer it under automation; copy now tries the synchronous `execCommand` path first and only
races the async Clipboard API as a fallback (see `js/render.js`, `copyText`/`legacyCopy`).

Captured reference: [Lando Norris — Official Site](https://landonorris.com/), filed under a new
`kinetic-editorial` category (data/categories.js, data/library.js).

Remaining: the collector must double-click `index.html` with no server running and confirm it
loads. This is the one check the agent structurally cannot perform (see ticket 06).
