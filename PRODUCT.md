# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The collector: the single person this library exists for. There is exactly one, and the app is
theirs alone — no accounts, no other people, no multi-user story. They use it in two roles with
roughly equal weight: browsing/rediscovering past references, and actively curating (draining
the inbox, assigning categories, purging hidden entries).

## Product Purpose

A personal library of web/app design references. Each reference captures a site or app whose
design is worth returning to: a screenshot, a written analysis, and prompts derived from it
(image prompts and reusable briefs). The library exists so the collector can rediscover and reuse
design thinking they've already done, rather than re-deriving it.

## Positioning

Unlike a generic bookmark manager or moodboard tool, the library performs analysis at capture
time: every reference carries a category (one of a hand-grown taxonomy with written style
essays), free-form keywords naming specific visual moves, derived generation prompts, and a
measured design system — a Google-format DESIGN.md built from a live harvest of the site's actual
colours, fonts, spacing and radii, not just a screenshot-derived impression. The taxonomy's essays
and the measured design system are the two least-available-elsewhere parts of the project.

## Operating Context

Static site, no build step, no backend, opened via `file://` (classic scripts only — no
`fetch()`, no ES modules). The app reads the library data files and writes its own data (inbox,
library, categories, design systems) via the File System Access API. Captures land in `inbox.md`
as cheap one-line entries; an agent-run "drain" empties the inbox by screenshotting each site,
harvesting its live styles, analysing it, writing every field, assigning or creating a category,
adding it to `data/library.js`, and extracting a measured design system into
`data/design-systems.js`. Deletion is reversible "hide" (localStorage tombstones) until an
explicit "purge" writes the removal into the library file for real.

## Capabilities and Constraints

- No accounts, no multi-user support — single collector only.
- No remote/backend; all persistence is local files the app itself writes.
- Must work under `file://` — rules out `fetch()` and ES module scripts.
- Vocabulary is canonical (see `CONTEXT.md`): Collector, Reference, Category, Keyword, Taxonomy,
  Image prompt, Brief, Capture, Inbox, Drain, Park, Draft, Resolve, Hide, Purge, Tombstone.
- A drain always resolves: it only parks a capture as a draft when the site itself couldn't be
  captured usefully; it never blocks on categorization (creates a new category when nothing
  genuinely fits).
- The taxonomy is grown by drains but pruned/consolidated only by the collector by hand.

## Brand Commitments

No binding commitments beyond what's implemented in code today (Fraunces + Inter font pairing,
current `css/style.css`). Treat the existing visual system as evidence, not yet a locked
identity.

## Evidence on Hand

Live library data in `data/library.js` and `data/categories.js`; category essays with written
vocabulary lists live alongside the taxonomy. No fabricated testimonials, pricing, or customers —
none apply to a single-user personal tool.

## Product Principles

1. Capture stays cheap; all cost lives in the drain, not the moment of finding something.
2. A drain always resolves — categorization friction or a bad screenshot never blocks the inbox
   from emptying.
3. The taxonomy grows automatically but is pruned only by deliberate human judgment.
4. The app never talks to the network or a model; all intelligence is the agent's, done offline
   between sessions.
5. Design for exactly one user, working solo, on their own machine.

## Accessibility & Inclusion

No product-specific requirement established beyond standard web accessibility practice.
