# 13 — Resolve a draft to a category

**What to build:** Triage costs one action. Looking at a draft in the grid — screenshot in front
of them, which is the entire reason drafts live here rather than in a text file — the collector
assigns it a category, and the change is written through to `data/library.js` so the decision
sticks.

This closes the loop that 12 opens. The drain parks what it will not decide; the collector decides
it, in the medium where the evidence is.

Resolving means assigning a category and nothing more. Editing the analysis prose is out of scope
for the app — that stays a job for a text editor or the agent. The one decision the drain deferred
is the one decision the collector makes here.

If a draft is parked because it fits no existing category, resolving it may require a new category
to exist first. Creating a category is a deliberate act the collector performs — it is exactly the
thing 12 forbids the drain from doing on its own — so at minimum, make it clear what is being
asked rather than silently offering only bad fits.

**Blocked by:** 08 — drafts must render before they can be resolved. 10 — the serialiser and the
data-file write path are established there.

**Status:** done

- [x] A draft can be assigned a category from the grid
- [x] Resolving a draft is written through to the data file
- [x] A resolved reference is no longer a draft and no longer carries a parking reason
- [x] A resolved reference behaves identically to one that was never parked
- [x] The waiting-draft count drops when a draft is resolved
- [x] A draft that fits no existing category makes that situation clear rather than forcing a bad fit
- [x] A failed or denied write leaves both the draft and the data file untouched
- [x] The write produces a clean, minimal git diff
- [x] Verified in the app opened by double-clicking `index.html`, with no server running
