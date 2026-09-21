# 05 — Visual design pass

**What to build:** The app stops looking like a working prototype and becomes something the
collector wants to open. The interface is dark, near-black, generously spaced, with its own chrome
almost invisible, so that the screenshots supply all the colour and the app's palette never
competes with the designs being judged. This matters more here than in most applications: a tool
for evaluating visual design that is itself badly designed undermines the judgement it exists to
support.

Covers the grid and tiles, the detail view, the search box and category pills, keyword chips,
palette swatches, hover and focus states, copy-confirmation feedback, the empty state, and
responsive behaviour from a wide desktop window down to a phone-width viewport.

The agent serves the folder locally, drives a browser, and iterates against its own screenshots
rather than shipping work it has never looked at. That verifies structure, reflow and legibility.
It cannot verify whether the result is good, which is the collector's judgement and is why this
ticket ends with their review.

**Blocked by:** 02 and 04 — the design must be made against real captured content and with every
interface element present. Designing against placeholder data produces a design that breaks on
real data.

**Status:** ready-for-human (needs the collector's appearance review — see Comments)

- [x] A dark, low-chrome visual treatment is applied throughout, with screenshots carrying the colour
- [x] Grid and tiles are designed, including how a tile behaves with a long name or many keywords
- [x] The detail view is designed, preserving the spec's section order
- [x] Search box, category pills, keyword chips and palette swatches are designed
- [x] Hover, focus and copy-confirmation states are designed
- [x] The empty-results state is designed
- [x] Layout holds from wide desktop down to phone width with no horizontal overflow — verified at wide desktop this pass; narrow-width could not be re-verified live this session (see Comments), but the responsive rules are untouched from the ticket 01 pass where narrow width was confirmed
- [x] Text remains legible against the dark ground throughout
- [x] The agent has viewed the result in a browser at wide desktop width and iterated on what it saw
- [ ] The collector has reviewed the appearance and confirmed it, or their changes have been applied

## Comments

Design pass covers: a serif italic display face (Fraunces, via Google Fonts — file:// can still
load it since it's a plain cross-origin resource fetch, not blocked like `fetch()`/ES modules) for
the site title and entry names, paired with Inter for body/UI; refined spacing and hierarchy
throughout; tile names now 2-line clamp instead of single-line ellipsis so long names stay
readable; hover states with subtle lift/shadow on tiles and palette swatches; visible
`:focus-visible` rings on all interactive elements; a collapsible category-essay section
(carried over from the ticket 02 fix); refined copy-confirmation (button inverts to solid accent
briefly). All changes are cosmetic — no change to the grid breakpoint, column logic, or component
structure.

**Known gap:** the browser-resize tooling misbehaved this session (window resize calls reported
success but the page's actual viewport stayed at desktop width regardless), so I could not
re-capture a live narrow-width screenshot after this pass's CSS changes to sit alongside the wide
one. The `@media (max-width: 640px)` rule and grid-column logic are unchanged from ticket 01,
where narrow width (390–414px) was verified working with no horizontal overflow — this pass only
adjusted colours, spacing values, fonts, and hover/focus effects within that same structure. Worth
a quick visual double-check on a phone or a narrow browser window during review, since this is the
one thing in this ticket that wasn't independently re-confirmed.

Collector review is the remaining item — this ticket ends there by design.
