# 02 — Capture the remaining seed references and write the taxonomy

**What to build:** The library stops being a demo and becomes a library. Four to five real design
references are captured and present, newest-first, each with its own screenshot, and the grid
reflows sensibly as the window narrows. Every category a reference belongs to carries its full
written style explanation and its list of associated vocabulary, so the collector can learn the
language of a style rather than only tagging things with it. Each category shows how many
references sit in it.

Capture accepts three inputs and produces one record shape: a URL (the agent captures the
screenshot itself), a pasted screenshot with no URL, or a URL plus a note about what specifically
caught the collector's eye, which weights the analysis. Multiple URLs are processed in a single
pass. A scroll-heavy or animated site gets two or three screenshots so one frame does not
misrepresent it.

Taxonomy is written by the agent for the collector to edit. Categories are derived from what was
actually captured rather than invented up front — the spec commits to re-cutting the taxonomy
once roughly ten references exist, and this ticket is the first cut, not the final one.

**Blocked by:** 01 — the schema must be proven against a real record before records are produced
in bulk against it.

**Status:** done

- [x] Four to five real references are captured in addition to the one from ticket 01 (five: Locomotive, Ciao Energy, Lacoste Polo Factory Experience, Lama Lama, 21 Hours on the Moon)
- [x] Every reference has at least one screenshot stored locally and referenced by relative path
- [x] Scroll-heavy or animated references carry additional screenshots, shown below the hero
- [x] The grid orders references newest-first
- [x] The grid reflows to a narrow viewport without horizontal overflow
- [x] Every category in use has a name, a one-line definition, a full written style explanation, and a vocabulary list
- [x] The full style explanation and vocabulary are readable somewhere in the app, not only stored in the data
- [x] Each category displays its reference count
- [x] Each reference has exactly one primary category and any number of free keywords
- [x] The data file remains readable and hand-editable, one clear block per entry
- [x] Prompt content contracts from ticket 01 hold for every new record

## Comments

Captured all five URLs the collector supplied. Taxonomy re-cut from the single `kinetic-editorial`
category to four: `kinetic-editorial` (Lando Norris), `terminal-noir` (Locomotive, Lama Lama —
pure-black grounds, monospace HUD micro-labels, glitch-decrypt or oversized condensed type, no
imagery), `cinematic-product-hud` (Ciao Energy, 21 Hours on the Moon — dark 3D scenes staged
inside sci-fi HUD corner-bracket framing), and `playful-pastel-3d` (Lacoste Polo Factory
Experience). Four categories for six entries felt like the right first cut rather than one
category per entry — grouping by genuinely shared visual technique, not just by having captured
them.

Found during verification that the category essay/vocabulary were written into the data but never
rendered anywhere in the app (only name + one-line definition showed on the detail view) — fixed
by adding a collapsible "About this style" `<details>` section to the detail view
(`js/render.js`: `buildCategorySection`) showing the full description and vocabulary chips. Each
category's reference count is shown on its grid pill.

Verified over localhost: all 6 tiles render newest-first, category pills show correct counts
(Kinetic Editorial 1, Terminal Noir 2, Cinematic Product HUD 2, Playful Pastel 3D 1), detail views
render correctly including the expandable category essay, and the query-layer test suite still
passes (19/19).
