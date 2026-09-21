# 04 — Deletion via tombstones

**What to build:** The collector can remove a reference they no longer want, so the library stays
curated rather than accumulating noise. A control on the tile hides it immediately, and the
removal is still in effect after closing and reopening the app. Because a misclick should not
destroy anything, hiding is reversible: a "show hidden" toggle reveals hidden references and lets
them be restored.

A page opened from the filesystem cannot write to disk, so hiding is recorded in the browser's
local storage as a list of hidden reference ids, applied when the library renders. The stored
data file is never modified by the app. True deletion — removing the record and its screenshot —
is done by the agent on request, which also clears the corresponding hidden-id entries. This
divergence between what is hidden and what is stored is invisible in normal use, but must be
reconciled before the library is ever published, or the published copy will show references the
collector has hidden.

**Blocked by:** 03 — hidden-entry exclusion belongs in the pure query layer built there, and is
covered by its tests.

**Status:** done

- [x] Each tile carries a hide control
- [x] Hiding a reference removes it from the grid immediately
- [x] Hidden references stay hidden after the app is closed and reopened
- [x] A "show hidden" toggle reveals hidden references
- [x] A hidden reference can be restored from that view
- [x] The data file is never modified by the app
- [x] Hidden-entry exclusion is implemented as a pure function in the query layer and covered by its tests
- [x] Hidden ids referring to references that no longer exist are ignored without error
- [x] The reconcile-before-publish requirement is documented where a future session will find it

## Comments

Tombstones live in `localStorage` under `inspiration-library:hidden-ids`
(`js/render.js`: `getHiddenIds`/`setHiddenIds`/`hideEntry`/`restoreEntry`), applied via the query
layer's `visibleEntries`. Verified over localhost: hide removes a tile immediately, "Show hidden"
reveals it dimmed with a restore control, and the hidden state survives a full page reload.
Reconcile-before-publish requirement documented in `docs/adr/0001-tombstone-deletion.md`.
