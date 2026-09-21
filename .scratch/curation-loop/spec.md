# Spec: The Curation Loop

Status: ready-for-agent

## Problem Statement

The library only grows when I am already in a Claude session. In practice I find references while
browsing — late, mid-scroll, with something else half-done — and opening a session to save one is
more ceremony than the moment can carry. So the reference goes to a bookmark, and a bookmark
records *that* I liked something and nothing about *why*. That is the exact failure this whole
project exists to fix, reproduced one step earlier in the process.

The friction is entirely in **capture**. Analysis is not the problem: once I have decided a
reference is worth keeping, waiting hours or days for it to be written up costs me nothing. What
costs me is the gap between seeing something and recording it, and right now that gap is one
whole context switch wide.

Two smaller problems sit alongside it. Hiding a reference is only ever provisional — the data
file still contains it, and the divergence is deferred to a manual reconciliation I have to
remember to perform. And there is no way to add anything from inside the app itself, because the
app was designed on the assumption that a page opened from the filesystem cannot write to disk.
That assumption has since been tested and is false.

## Solution

A capture-and-drain loop with a deliberately dumb middle.

**Capture** costs one keystroke. A macOS Shortcut bound to a hotkey takes the frontmost Chrome
tab and appends a line to `inbox.md` — a URL, and optionally a note about what caught my eye. The
app grows an **Add** control that appends to the very same file, so there is one inbox with two
ways in. Nothing is analysed, nothing is validated, nothing is decided at capture time.

**Drain** is the agent's pass, run when I ask for it and eventually on a schedule. For each line:
capture the screenshot properly — past any loading phase — analyse the design, write every field
of a reference, add it to the library, and delete the line. Anything the drain cannot decide
confidently is **parked**: it enters the library as a **draft**, visible in the grid but plainly
marked, so I triage it looking at the screenshot rather than at a text file.

**Purge** closes the loop at the other end. Hiding stays instant and reversible, but a purge now
writes hidden references out of `data/library.js` for real and clears their tombstones. Recovery
becomes `git revert`, which is a stronger guarantee than the browser ever offered.

The enabling change underneath all three is that the app may now write to disk, via the File
System Access API, from a page opened by double-click with no server (see
`docs/adr/0002-app-writes-its-own-data.md`).

## User Stories

**Capturing**

1. As a collector, I want to capture a reference with a single keystroke while browsing, so that saving costs less than the moment of noticing.
2. As a collector, I want capture to take the URL of whatever Chrome tab is in front of me, so that I do not have to copy anything by hand.
3. As a collector, I want to optionally add a short note on what caught my eye, so that the analysis weights the thing I actually cared about.
4. As a collector, I want to capture without leaving the page I am on, so that capture never interrupts what I was doing.
5. As a collector, I want an Add control in the app itself, so that I can capture while I am already looking at the library.
6. As a collector, I want the Add control and the hotkey to write to the same place, so that there is one inbox and not two.
7. As a collector, I want captures to accumulate in a plain text file I can open and read, so that I can see my backlog without running anything.
8. As a collector, I want the inbox to be tracked in git, so that a capture cannot be lost by clearing browser data or moving the folder.
9. As a collector, I want to edit or delete an inbox line by hand before it is drained, so that I can change my mind cheaply.
10. As a collector, I want capture to never block, validate or reject, so that a malformed line is a problem for later rather than an interruption now.

**Draining**

11. As a collector, I want to ask the agent to drain the inbox and have every line handled in one pass, so that clearing a backlog costs me one message.
12. As a collector, I want each drained line to produce a complete reference with every field written, so that the result is indistinguishable from one saved by hand.
13. As a collector, I want my capture note to visibly influence the analysis, so that recording it was worth the effort.
14. As a collector, I want a line removed from the inbox once its reference is in the library, so that the inbox always shows exactly what is outstanding.
15. As a collector, I want an interrupted drain to leave the inbox consistent, so that re-running it neither duplicates nor loses references.
16. As a collector, I want a URL already in the library to be skipped and reported rather than added twice, so that re-capturing something is harmless.
17. As a collector, I want a line the agent cannot fetch at all to stay in the inbox with a note explaining why, so that a dead link is not silently swallowed.
18. As a collector, I want to drain a single line rather than the whole inbox, so that I can pull one reference through when I want it now.

**Capturing the right frame**

19. As a collector, I want the screenshot taken after any loading or preloader phase has finished, so that I get the design and not a spinner.
20. As a collector, I want the capture to settle scroll-driven heroes before shooting, so that sites whose design only resolves on interaction are represented fairly.
21. As a collector, I want the agent to look at the screenshot it took and re-capture if it shows a loading state, so that the check does not depend on timing alone.
22. As a collector, I want scroll-heavy sites to get two or three screenshots, so that one frame does not misrepresent the design.
23. As a collector, I want a reference whose screenshot could not be captured usefully to be parked rather than saved with a bad image, so that the grid stays trustworthy.

**Parking and drafts**

24. As a collector, I want a reference that fits no existing category to be parked rather than filed under a wrong one, so that the taxonomy stays meaningful.
25. As a collector, I want an unattended drain to never invent a new category, so that my taxonomy cannot drift while I am not watching.
26. As a collector, I want parked references to appear in the grid as drafts rather than sitting in a text file, so that I judge them with the screenshot in front of me.
27. As a collector, I want a draft to be visually distinct from a finished reference, so that I never mistake one for the other.
28. As a collector, I want to see why a reference was parked, so that I know what decision is being asked of me.
29. As a collector, I want to resolve a draft by assigning it a category, so that triage is one action.
30. As a collector, I want resolving a draft to be written to the data file, so that the triage sticks.
31. As a collector, I want to see how many drafts are waiting, so that a pile-up tells me it is time to re-cut the taxonomy.
32. As a collector, I want drafts to be filterable and excludable, so that I can browse only finished references when I want to.

**Writing to disk**

33. As a collector, I want the app to write to real files while still being opened by double-clicking, so that I never need a terminal.
34. As a collector, I want to grant file permission once per session rather than per write, so that the permission is not a recurring interruption.
35. As a collector, I want to be told clearly when a write has succeeded, so that I am not left wondering whether something saved.
36. As a collector, I want a failed or denied write to say so and change nothing, so that a refused permission cannot corrupt my library.
37. As a collector, I want the generated data file to stay in the same readable shape it has now, so that I can still open it and fix a typo by hand.
38. As a collector, I want the generated data file to be a clean git diff, so that I can see exactly what changed in a commit.
39. As a collector, I want the app to never write unless I have asked it to, so that browsing is always safe.

**Purging**

40. As a collector, I want hiding to stay instant and reversible, so that a misclick still costs nothing.
41. As a collector, I want to purge hidden references so the data file actually loses them, so that hiding can be made permanent when I mean it.
42. As a collector, I want to see exactly what a purge will remove before it happens, so that I can confirm rather than trust.
43. As a collector, I want a purge to clear the tombstones it acted on, so that the hide list does not accumulate ids for references that no longer exist.
44. As a collector, I want a purged reference to be recoverable from git, so that permanence is not the same as irreversibility.
45. As a collector, I want to be told when hidden references exist that have not been purged, so that the divergence is visible rather than deferred.

**Scheduling**

46. As a collector, I want to trigger a drain manually whenever I like, so that the loop works before any automation exists.
47. As a collector, I want the option of a nightly drain on this machine, so that the inbox empties itself without me asking.
48. As a collector, I want a scheduled drain to obey the same parking rules as a manual one, so that unattended running cannot lower the quality bar.
49. As a collector, I want a scheduled drain over an empty inbox to do nothing quietly, so that automation is not noisy.
50. As a collector, I want to see what a scheduled drain did, so that I can trust it without watching it.

## Implementation Decisions

**The inbox is a dumb append-only markdown file.**
`inbox.md` at the repo root, one line per capture, in the form
`- <url> — <optional note>`. Deliberately the lowest-ceremony format that both a macOS Shortcut
and the app can append to correctly; a Shortcut appending one line of markdown is trivial where a
Shortcut emitting valid JavaScript into the data file is a parsing bug waiting to happen. Nothing
validates a line at capture time. Malformed lines are the drain's problem, and the drain reports
them rather than discarding them.

**Capture has two entry points, one destination.** The macOS Shortcut and the app's Add control
both append to `inbox.md`. The Shortcut is the collector's to build and is not part of this
implementation; the spec's obligation is that the file format is simple enough to make it a
five-minute job.

**The app becomes a writer, narrowly.** Per ADR-0002, the app may write `inbox.md` and
`data/library.js` through the File System Access API, always from a deliberate collector action,
never on load and never on a timer. It gains no other capability: it still does not fetch URLs,
call a language model, or generate prompts.

**One new seam: a pure curation module.** Every text↔data transformation lives in a single pure
module with no DOM and no file access, tested exactly as `js/query.js` is today:

- parsing `inbox.md` into a list of captures, tolerating blank lines, comments, missing notes and
  malformed entries
- formatting a capture back into an inbox line
- serialising the library array into `data/library.js` source text
- computing a purge: given references and tombstones, what the file should become and which
  tombstones to clear

Generating the data file's source text is the genuinely risky part of ADR-0002, and putting it
here is what makes it testable. The File System Access calls and the DOM stay a thin shell that
hands data to this module and writes back what it returns — untested by unit tests, consistent
with the existing convention for the render layer.

**Draft state extends the existing query seam, rather than adding one.** A reference gains an
optional `status` field, absent or `'live'` for finished references and `'draft'` for parked
ones, alongside a short human-readable reason for the parking. Draft filtering is a filtering
concern and belongs in `js/query.js` next to `visibleEntries`. Absent `status` must mean live, so
that every existing reference and every hand-written one continues to work untouched.

**The data file's shape is a contract.** Generated output keeps the current format — one readable
block per reference, same field order, same quoting style — because hand-editability is a
promised feature and because a generated file that reformats everything makes git diffs useless.
Round-tripping the existing file through serialisation must produce a file that differs only
where data actually changed.

**Deletion is now two-stage.** Hiding is unchanged: an instant, reversible tombstone in
`localStorage`. Purging is new: it rewrites the data file without the hidden references and
clears the tombstones it acted on. The collector sees what will be removed and confirms before
anything is written. Recovery is `git revert`, per ADR-0002.

**The drain is a documented agent procedure, not code.** It lives as a document the agent follows
— dedupe against existing `sourceUrl`, capture, analyse, append, delete the line — because it is
executed by Claude, not by the app. Its correctness is a matter of the procedure being followed,
which is why the parking rules below are stated as hard constraints rather than guidance.

**Capture quality has a mechanical guard and a visual one.** Wait for network idle, nudge the
scroll and return, then capture — and then *look* at the resulting image and re-capture if it
reads as a loading state. The mechanical waits are cheap insurance; the only reliable detector of
a preloader is looking at the picture, and the agent is already looking at it to write the
analysis. Sites in this library are disproportionately scroll-driven, so a fixed delay alone will
fail on exactly the references the collector likes most.

**Unattended runs may not grow the taxonomy.** A drain may assign an existing category. It may
never coin a new one. Anything that fits nothing is parked as a draft with the reason recorded.
This is the single hard constraint that makes scheduled draining safe, and it holds for manual
drains too so that behaviour does not differ between the two.

**Scheduling is `launchd`, not cron tooling.** `CronCreate` is session-only and in-memory, and
scheduled cloud routines cannot reach a local-only repo with no remote. A genuine nightly drain
means a `launchd` job on this machine invoking Claude headlessly in the repo folder. Documented
as an optional step the collector opts into; nothing in the design depends on it existing.

## Testing Decisions

**What makes a good test here.** Tests assert external behaviour of pure functions: given input
text or an array of references, what comes back. No test inspects how parsing or serialisation is
implemented, no test touches the DOM, and no test invokes the File System Access API.

**Prior art.** `test/query.test.js` sets the convention — Node's built-in test runner via
`node --test`, no dependencies, no install step, entries built by a `makeEntry` helper with
overrides. The curation module's tests follow it exactly.

**Curation module.** The new seam, covering:

- parsing a well-formed inbox line into URL and note
- parsing a line with no note
- tolerating blank lines, whitespace and comment lines
- reporting a malformed line rather than dropping it or throwing
- an empty or absent inbox file yielding an empty list, not an error
- serialising a library array to source text that re-parses to the same data
- round-tripping the existing `data/library.js` unchanged, character for character, when no data
  has changed — the highest-value test in this spec
- escaping correctly for the characters that actually appear in this data: apostrophes, quotes,
  newlines inside briefs, and non-ASCII in names and summaries
- purge computing the right remaining references and the right tombstones to clear
- purge with tombstones referring to references that no longer exist, ignored without error
- purge with no tombstones being a no-op that changes nothing

**Query module.** Extending the existing tests:

- references with absent `status` treated as live
- drafts excluded by default and included when asked for
- draft filtering combining with search and category criteria
- a library of only drafts, and a library of no drafts, both behaving sensibly

**Not unit-tested, verified by looking.** The File System Access shell, the Add control, the
purge confirmation and the draft tiles. Agent pass over localhost for layout and interaction;
collector pass for whether it looks right. Two properties can only be checked by the collector
opening `index.html` by double-click: that a write actually succeeds from `file://`, and whether
the permission grant survives a restart. That second one is unmeasured and is to be recorded when
it is first observed.

## Out of Scope

- Any backend, server, database, API key or authentication. Unchanged.
- The app fetching a URL, calling a language model, or generating a prompt at runtime. The app
  gained the ability to write, not the ability to think.
- Screenshot-only capture. The inbox is URLs for now; pasting an image directly into an agent
  session remains the way to save something that has no URL.
- An in-app editor for the analysis fields. Drafts are resolved by assigning a category, not by
  editing prose. Prose is fixed in a text editor or by asking the agent.
- Multi-user support, accounts and sharing. `ownerId` stays present and unused.
- The macOS Shortcut itself, and the `launchd` job itself. Both are documented for the collector
  to set up; neither is built here.
- Cloud-scheduled drains, which cannot reach this repo.
- Automated DOM, snapshot or end-to-end tests. Unchanged.
- Publishing to GitHub or any remote. The repository stays local-only.

## Further Notes

- **The permission unknown.** Whether the File System Access grant survives a browser restart is
  the one thing left unmeasured. It changes no decision in this spec — the fallback, regenerating
  the data file as a download, is already recorded in ADR-0002 — but it should be measured early,
  because it is the only remaining risk that could reshape the work.
- **Build the write layer first.** It blocks the Add control and the purge, and it carries that
  unknown. A surprise there is far cheaper while the dependent tickets are still unwritten.
- **The parked pile is a signal, not a backlog.** The taxonomy is meant to be re-cut as real
  references accumulate. A cluster of drafts parked for the same reason is the clearest evidence
  of what the next category should be, and is more useful than an empty draft list.
- **Scale.** The inbox is expected to hold a handful of lines at a time and the library a few
  hundred references. Serialising the whole data file on every write is fine at that size and is
  the first thing to revisit if it ever is not.
