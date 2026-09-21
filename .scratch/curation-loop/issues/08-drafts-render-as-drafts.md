# 08 — Drafts render as drafts

**What to build:** A reference the agent could not finish confidently appears in the library as a
**draft** — visible in the grid, plainly distinct from a finished reference, and carrying a short
reason explaining what decision is being asked of the collector.

The point of showing drafts in the grid rather than listing them in a text file is that the
collector triages design references by looking at them. A category decision made without the
screenshot in front of you is the wrong decision made comfortably.

Drafts stay out of the way by default: the grid shows finished references unless the collector
asks to see drafts, and a count tells them how many are waiting. That count is a signal, not a
chore — a pile of drafts parked for the same reason is the clearest evidence that the taxonomy
needs re-cutting.

Nothing writes to disk in this ticket. Verify against a draft record added to the data file by
hand.

Draft state extends the existing query layer rather than earning a seam of its own — it is a
filtering concern and belongs beside the existing visibility filtering. **A reference with no
`status` field must be treated as live**, so that all six existing references, and any the
collector writes by hand, keep working untouched.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A reference marked as a draft renders visually distinct from a finished one
- [x] The reason it was parked is shown on the draft
- [x] Drafts are excluded from the grid by default
- [x] A control includes drafts in the view
- [x] The number of waiting drafts is visible
- [x] Draft filtering combines correctly with the search box and category pills
- [x] A reference with no `status` field is treated as live
- [x] Draft filtering is a pure function in the query layer, covered by tests
- [x] A library containing only drafts, and one containing none, both render sensibly
- [x] A draft opens to its detail view like any other reference
- [x] Verified by looking, at desktop and narrow widths
