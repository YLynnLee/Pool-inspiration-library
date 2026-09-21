# Spec: Inspiration Library

Status: ready-for-agent

## Problem Statement

I collect web and app design references constantly — a site with a voxel-rendered landscape, a
landing page with a serif headline and green emphasis — and they scatter across bookmarks,
screenshots and browser tabs. Bookmarks record *that* I liked something but nothing about *why*,
and by the time I want the reference again I have lost the thing that made it worth keeping.

Two failures compound this:

1. **I lack the vocabulary.** I can see that a design works but often cannot name the style or
   its associated terms, so I cannot search for more of it, brief anyone on it, or describe it to
   an image or code generator.
2. **The gap between reference and output.** Even with a reference in hand, going from "I like
   this" to a generated image or a generated page means writing a prompt from scratch every time,
   badly, from memory.

## Solution

A personal, local, static web app that is a curated library of design references. Each reference
is a tile with a screenshot; clicking it opens a detail view carrying everything I would need to
*use* that reference:

- what the site is and what its design is doing
- the named design category it belongs to, with a written explanation of that style and its
  associated vocabulary
- keyword chips describing the specific visual moves
- the colour palette and type character
- **two copy-to-clipboard prompts**: an *image prompt* for generating artwork in that visual
  world, and a *brief* for generating an entire page with that character

I do not fill the library in by hand. I send Claude a URL, a batch of URLs, or a screenshot;
Claude captures the screenshot, analyses the design, writes every field, and appends the record
to the data file. The app itself is a reader.

## User Stories

**Browsing**

1. As a collector, I want to open the library by double-clicking a file on my Desktop, so that using it never requires a terminal.
2. As a collector, I want my saved references to still be there after I close the app and reopen it, so that the library accumulates over time.
3. As a collector, I want to see all my references as a grid of screenshot tiles, so that I can scan visually rather than reading.
4. As a collector, I want the most recently added reference to appear first, so that the thing I just saved is the thing I see.
5. As a collector, I want each tile to show the site name and its category, so that I can identify a reference even when the screenshot is ambiguous.
6. As a collector, I want the app's own interface to be dark and visually quiet, so that its colours do not compete with the screenshots I am trying to judge.
7. As a collector, I want the grid to reflow sensibly on a narrow window, so that I can use it on a laptop or a phone.

**Finding**

8. As a collector, I want a single search box that matches against name, summary, keywords and category, so that I can find a reference from whatever fragment I happen to remember.
9. As a collector, I want search results to update as I type, so that I can narrow down without pressing anything.
10. As a collector, I want a row of category pills, so that I can browse one style at a time.
11. As a collector, I want the category filter and the search box to combine, so that I can search within a style.
12. As a collector, I want to click any keyword chip anywhere in the app and have the library filter to that keyword, so that I can find every reference that shares a specific visual move.
13. As a collector, I want the current filter reflected in the URL, so that a filtered view survives a refresh and can be bookmarked.
14. As a collector, I want an obvious way to clear all filters, so that I can get back to the whole library in one action.
15. As a collector, I want to be told when a search matches nothing, so that I do not mistake an empty result for a broken app.

**The detail view**

16. As a collector, I want to click a tile and see its full detail, so that I can get from browsing to using in one action.
17. As a collector, I want the detail view to open at a URL of its own, so that I can link to a specific reference and the browser back button returns me to the grid.
18. As a collector, I want a large hero screenshot at the top of the detail view, so that I can actually see the design.
19. As a collector, I want to open the screenshot full size, so that I can inspect fine detail.
20. As a collector, I want extra screenshots shown for scroll-heavy or animated sites, so that one frame does not misrepresent the design.
21. As a collector, I want a link to the original live site, so that I can go and experience it directly.
22. As a collector, I want the category shown with a one-line definition of that style, so that I am reminded what the category means.
23. As a collector, I want a two-to-three sentence summary of what the site is and what its design is doing, so that I can recall the reference without opening it.
24. As a collector, I want keyword chips for the specific visual moves, so that I have precise language for what I am looking at.
25. As a collector, I want the colour palette as swatches with hex codes, so that I can steal the colours.
26. As a collector, I want to click a swatch and have the hex code copied, so that I can paste it straight into a tool.
27. As a collector, I want notes on the typefaces or type character, so that I can reproduce the most reusable part of a design.

**The prompts**

28. As a collector, I want an image prompt written for image generators, so that I can make artwork in this visual world without writing the prompt myself.
29. As a collector, I want the image prompt to be dense visual description with no interface or instruction language, so that the generator produces art rather than a picture of a website.
30. As a collector, I want a brief written for code and page generators, so that I can build a page with this character.
31. As a collector, I want the brief to be a reusable template with a placeholder for my own subject, so that I get *my* thing in this style rather than a clone of the reference.
32. As a collector, I want to read both prompts before copying them, so that I can judge whether they fit what I am doing.
33. As a collector, I want a one-click copy button for each prompt, so that I do not have to select text.
34. As a collector, I want visible confirmation that a copy succeeded, so that I am not left wondering.

**Categories**

35. As a collector, I want each design category to carry a written explanation of the style, so that I learn the vocabulary rather than just tagging things.
36. As a collector, I want each category to list the words associated with that style, so that I can use that language when briefing tools or people.
37. As a collector, I want to see how many references sit in each category, so that I can tell which styles I actually gravitate towards.
38. As a collector, I want a reference to have exactly one primary category but many free keywords, so that navigation stays clean while cross-cutting detail is still captured.

**Curation**

39. As a collector, I want to hand Claude a URL and have every field written for me, so that saving a reference costs me one message.
40. As a collector, I want to hand Claude several URLs at once, so that I can clear a backlog of tabs in one pass.
41. As a collector, I want to hand Claude a screenshot with no URL, so that I can save references from Dribbble, a design newsletter, or an app I cannot link to.
42. As a collector, I want to add a note about what specifically caught my eye, so that the analysis weights the thing I actually cared about.
43. As a collector, I want to remove a reference I no longer want, so that the library stays curated rather than accumulating noise.
44. As a collector, I want a removal to persist after restarting the app, so that I do not have to remove it again.
45. As a collector, I want removals to be recoverable, so that a misclick does not destroy something permanently.
46. As a collector, I want to open the data file in a text editor and fix a word myself, so that I am not dependent on Claude for a typo.

## Implementation Decisions

**Architecture**

- Static site, no build step, no framework, no runtime dependencies. Plain HTML, CSS and
  vanilla JavaScript.
- Opened directly from the filesystem by double-clicking `index.html`. This is the primary use
  case and constrains everything below.
- **Data is a classic script, not JSON.** Browsers block both `fetch()` and
  `<script type="module">` on `file://`. Data therefore lives in a script that assigns a global
  (`const LIBRARY = [...]`), loaded with a plain `<script>` tag. The file remains plain,
  hand-editable data — the format change is purely to satisfy the `file://` constraint.
- **Logic files carry a CommonJS footer** — `if (typeof module !== 'undefined') module.exports = {...}`
  — so the same file works as a classic browser script *and* can be `require()`d by Node's
  built-in test runner. This is what makes the query layer testable without introducing a
  bundler, a module system, or any dependency.

**Modules and seams**

- **Data access module** — exposes `getEntries()` and `getEntry(id)`. This is the *only* code
  that knows data comes from the in-memory `LIBRARY` global. It is the migration seam: moving to
  a hosted multi-user backend later means rewriting this module and nothing else.
- **Query module** — pure functions over arrays, no DOM access:
  - `filterEntries(entries, { query, category, keyword })` — case-insensitive substring matching
    across name, summary, keywords and category; criteria combine with AND; absent or empty
    criteria are ignored.
  - `sortEntries(entries)` — descending by `createdAt`.
  - `visibleEntries(entries, hiddenIds)` — removes tombstoned entries.
- **Render module** — builds DOM, owns the hash router. Depends on the two modules above; nothing
  depends on it.

**Record schema**

Every entry carries: `id` (stable slug), `name`, `sourceUrl` (optional — screenshot-only entries
have none), `category` (exactly one), `summary`, `keywords[]`, `palette[]` (hex strings),
`typeNotes`, `imagePrompt`, `brief`, `screenshots[]` (first is the hero), `createdAt` (ISO 8601),
`ownerId` (present and unused, reserved for the multi-user future).

Categories are a separate collection: `id`, `name`, `definition` (one line, shown on the detail
view), `description` (the full written explanation of the style), `vocabulary[]`.

**Prompt content contracts**

- `imagePrompt` — approximately 60 words. Dense comma-separated visual description. No interface
  vocabulary, no instructions, no mention of websites or layout.
- `brief` — 200–350 words of structured prose covering layout, type system, palette with hex
  values, motion, tone of voice, and what makes the design distinctive. Opens with a
  `[YOUR SUBJECT]` placeholder so it is a reusable style template, not a description of the
  reference site.

**Routing and state**

- Hash-based routing on a single page. `#/` is the grid; `#/entry/<id>` is the detail view.
  Filter state is encoded in the grid hash so filtered views are linkable and survive refresh.
- Browser back navigates from detail to grid, and backwards through filter states.

**Deletion**

- A static page cannot write to disk, so deletion is a **tombstone in `localStorage`**: a list of
  hidden entry ids, applied at render time. Hiding is instant and persists across restarts; a
  "show hidden" toggle makes it reversible.
- True deletion — removing the record and its image file — is done by Claude on request, which
  also clears the corresponding tombstones. The divergence between the tombstone list and the data
  file is invisible during normal use and is reconciled before any publish.

**Assets**

- Screenshots stored as `images/<entry-id>.webp`, roughly 1600px wide.
- Images are referenced by relative path so the whole folder is portable and works offline.

**Capture workflow (performed by Claude, not the app)**

Three accepted inputs, one resulting record shape: a URL (Claude captures the screenshot itself),
a pasted screenshot (`sourceUrl` omitted), or a URL plus a note about what to focus on. Batches
of URLs are processed in a single pass. Scroll-heavy sites get two or three screenshots.

**Taxonomy**

The app ships with three or four obvious categories. The taxonomy is deliberately re-cut once
roughly ten real references exist, on the grounds that categories invented in the abstract do not
match what actually gets saved, and renaming is cheap at twelve entries and expensive at two
hundred.

**Visual direction**

Dark, near-black, generous spacing, near-invisible interface chrome, so that screenshots supply
all the colour. ~~There is no in-app editor and no add form — the app is read-only over a
Claude-maintained data file.~~ **Superseded** by `.scratch/curation-loop/spec.md`: the app gains
an Add control and a purge action. It remains read-only over the *analysis* — every field of a
reference is still written by Claude, never in the app.

## Testing Decisions

**What makes a good test here.** Tests assert external behaviour of the query layer: given an
array of entries and a set of criteria, which entries come back and in what order. No test
inspects how filtering is implemented, and no test touches the DOM.

**Automated tests — one seam only.** The query module, via Node's built-in test runner
(`node --test`). No dependencies, no `package.json` required beyond a trivial one, no install
step. Coverage:

- substring matching independently across name, summary, keywords and category
- case insensitivity
- category and search combining with AND
- keyword filtering
- empty, absent and whitespace-only criteria being ignored rather than matching nothing
- newest-first ordering, including entries sharing a `createdAt`
- tombstoned entries excluded, and restored when hidden entries are shown
- an empty library, and a query matching nothing, both returning an empty array rather than
  throwing

**Visual layer — verified by looking, in two passes.**

1. *Agent pass.* Claude serves the folder locally, drives Chrome, and screenshots the app at
   desktop and narrow widths, iterating on what it sees rather than shipping unviewed work. It
   checks: the grid renders and reflows, filtering and the hash router work end to end, copy
   buttons confirm, nothing overflows horizontally, and text remains legible against the dark
   ground.
2. *User pass.* The user checks whether it actually looks good — the one judgement the agent
   cannot make.

**One check only the user can perform.** Agent verification runs over `localhost`, because the
browser extension may not have `file://` access. Local HTTP proves everything except the single
property the architecture was chosen for. The user must therefore **double-click `index.html`
once** and confirm the app loads with no server running. This is called out explicitly at the
point it is needed rather than left implicit.

**No prior art.** This is the first code in the repo; these tests set the convention.

## Out of Scope

- Any backend, database, server, API key or authentication.
- Multi-user support, accounts, sharing, or other people having their own libraries. The schema
  reserves `ownerId` for it; nothing else anticipates it. Multi-user is a genuinely different
  product — signup, hosting, quotas — and is a future project, not a flag.
- ~~An in-app editor, add form, or any UI that writes data. Curation happens through Claude.~~
  **Superseded** by `.scratch/curation-loop/spec.md` and `docs/adr/0002-app-writes-its-own-data.md`.
  The app may now append to the inbox and rewrite the data file via the File System Access API.
  Still out of scope: any UI that edits the analysis prose.
- ~~True in-app deletion of records or image files.~~ **Superseded** by the same. Purging writes
  hidden references out of the data file for real; recovery is `git revert`.
- Automated capture: the app never fetches a URL, calls an LLM, or generates a prompt at runtime.
- Fuzzy search, search ranking, or pagination and list virtualisation. Substring matching over a
  library of this size is sufficient and more predictable.
- A build step, bundler, transpiler, framework or package manager beyond what the test runner
  needs.
- Automated DOM, snapshot or end-to-end tests.
- Publishing to GitHub or any remote. The repository is local-only.

## Further Notes

- **Publishing.** The user may later want the library readable on a phone, done by publishing the
  current state as an Artifact. Tombstones must be reconciled into the data file before any
  publish, or the published copy will show entries the user has hidden.
- **Scale.** Designed for roughly 100 entries. A single data file handles far more; the first
  thing that would need to change past several hundred is splitting the data file, and nothing
  else in this design assumes it stays whole.
- **Empty state.** The grid must not be built against an empty library — tile behaviour with real
  screenshots and realistic keyword counts is the thing being designed. Three to five real
  references should be captured before or during the build.
- **Category essays are the differentiator.** The written style explanation and vocabulary list
  are the part of this idea least available elsewhere, and are worth more care than the
  application code.
