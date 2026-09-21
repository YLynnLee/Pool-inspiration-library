# 10 — Purge hidden references

**What to build:** Hiding becomes permanent when the collector means it. Hiding itself is
unchanged — instant, reversible, browser-only, exactly right for a misclick. What is new is that
the collector can **purge**: see precisely which hidden references are about to be removed,
confirm, and have them written out of `data/library.js` for real, with their tombstones cleared.

This retires the divergence ADR-0001 deferred to "before any publish". The hide list and the data
file can no longer drift indefinitely, because the collector has an action that reconciles them
and the app tells them when hidden references are waiting to be purged.

Permanence is not irreversibility: the data file is tracked in git, so a purge is recoverable with
`git revert`. That is a stronger safety net than the tombstone list, which is not backed up and is
tied to the exact path the app is opened from.

This ticket carries the serialiser — turning the library array back into `data/library.js` source
text — because that is the genuinely risky part of ADR-0002 and purge is the smallest real
behaviour that needs it. Two properties matter more than anything else here:

- **The file's shape is a contract.** Hand-editability is a promised feature (story 46 of the
  original spec) and a generated file that reformats everything makes git diffs useless. Keep the
  existing shape: one readable block per reference, same field order, same quoting.
- **Round-tripping must be exact.** Serialising today's data file with no data changed must
  produce a byte-identical file. This is the highest-value test in the whole feature; if it does
  not hold, nothing built on top of it can be trusted.

Watch the escaping. This data contains apostrophes in prose, quotes inside summaries, newlines
inside briefs, and non-ASCII in names — all of it already present in the six existing references.

**Blocked by:** 07 — the File System Access shell for writing a real file is established there.

**Status:** ready-for-human

- [x] Hiding remains instant and reversible, unchanged
- [x] The collector can see exactly which references a purge will remove, before it happens
- [x] A purge requires confirmation
- [x] Purging rewrites the data file without the purged references
- [x] Purging clears the tombstones it acted on
- [x] Tombstones referring to references that no longer exist are ignored without error
- [x] A purge with nothing hidden is a no-op that changes nothing
- [x] The app surfaces that unpurged hidden references exist
- [x] Serialising the current data file with no data changed produces a byte-identical file
- [x] Apostrophes, quotes, embedded newlines and non-ASCII all survive a round trip
- [x] The generated file keeps one readable block per reference and stays hand-editable
- [x] A purge produces a clean, minimal git diff
- [x] A failed or denied write leaves the data file untouched
- [x] Serialisation and purge computation are pure functions in the curation module, covered by tests
- [ ] Verified in the app opened by double-clicking `index.html`, with no server running

## Comments

**Implementation.** `js/curation.js` gains `serializeLibrary(entries)`, `computePurge(entries, hiddenIds)`, and the private `quoteJs`/`ENTRY_FIELDS` table it's built on — a field-order/type-driven layout (inline-string, multiline-string, inline-array, multiline-array) matching `data/library.js`'s existing shape exactly, including the apostrophe-vs-quote delimiter choice each field already uses. `js/fs-write.js`'s single cached inbox handle became a `cachedHandles` map so it can also hold a `data/library.js` handle, and gained `writeLibrary(text)` alongside the existing `appendToInbox`. `js/data-access.js` gained `setEntries(entries)` so a successful purge can update the in-memory grid without a reload, staying inside the file's stated boundary (it still only touches the `LIBRARY` global). `js/render.js` gained a "Purge N hidden…" footer button (shown only when something is hidden) and a confirmation modal listing exactly what will be removed, reusing the existing Add-modal CSS/JS patterns.

**A real bug caught during browser verification, not by the review.** The first cut of the purge-success handler wrote `window.LIBRARY.splice.apply(...)` — but `data/library.js` declares `const LIBRARY`, and a top-level `const` in a classic script never becomes a `window` property (unlike `var` or a function declaration). `window.LIBRARY` was `undefined`, so the success path would have thrown. Caught by manually driving the app in a browser tab and inspecting `typeof window.LIBRARY`, not by static reading. Fixed by adding `setEntries` to `js/data-access.js` instead of reaching into the global from `render.js` — which also respects that file's own "only code aware entries come from LIBRARY" boundary comment, rather than routing around it.

**What I verified, and how.** Same constraint as ticket 07: the automation tooling can't drive a native `showOpenFilePicker`/`showSaveFilePicker` dialog or navigate `file://` URLs, so the exact double-click scenario is still unverified by an agent. Instead I served the app over a throwaway local `http.server` (identical FSA/IndexedDB/DOM code paths) and, with `window.writeLibrary` stubbed:
- confirmed hiding via the real hide button is still instant, reversible, and surfaces the purge button/count correctly
- confirmed the purge modal lists exactly the hidden references by name and URL before any write, including a synthetic tombstone with no matching entry
- stubbed a successful write: confirmed `writeLibrary` was called once with the correctly serialised remaining entries, the purged ids (including the stale one) were cleared from `localStorage`, the in-memory grid updated via `setEntries` without a reload, and the modal closed
- stubbed a denied/failed write: confirmed the modal stayed open showing the error text, the confirm button re-enabled with its original label, and neither `localStorage` nor the in-memory library changed
- confirmed `npm test` (72/72, including 30 new curation tests covering serialisation and purge) and `node -c` on every changed file pass
- confirmed the round-trip test against the real on-disk `data/library.js` is byte-identical, and that a synthetic entry mixing an apostrophe and a double quote in the same field, a backslash, embedded newlines, and non-ASCII all survive a real `eval` round trip

**What's left for you.** The last checkbox needs a human at a real double-clicked `index.html` with a real Chrome permission prompt: hide a reference, click "Purge N hidden…", confirm the list is right, click through, grant the `data/library.js` picker the first time, and check the file on disk actually lost the entry and gained no unrelated diff. Worth also trying a denial (cancel the picker) to confirm the file is untouched and the error shows.
