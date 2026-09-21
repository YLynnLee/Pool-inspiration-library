# Context: Inspiration Library

The vocabulary this project uses. Terms here are the canonical ones — code, issues, specs and
ADRs should use these words and avoid the synonyms noted against each.

This file is a glossary and nothing else. Decisions belong in `docs/adr/`; plans belong in
`.scratch/<feature-slug>/spec.md`.

## Core

**Collector** — the single person this library exists for. There is exactly one, and the app is
theirs alone. Not "user": there are no accounts, no other people, and no multi-user story.

**Reference** — one saved design example: a site or app whose design is worth returning to.
Carries a screenshot, an analysis, and the prompts derived from it. Not "entry", "item",
"bookmark" or "record" — those describe the storage, and a reference is a thing the collector
cares about whether or not it is stored.

**Category** — the single named design style a reference belongs to. A reference has exactly one.
Each category carries a written explanation of the style and a vocabulary list; those essays are
the part of this project least available elsewhere. Not "tag" — tags are many and cheap, a
category is one and considered.

**Keyword** — a free-form phrase naming one specific visual move in a reference ("scroll-scrubbed
decrypt", "acid green accent"). A reference has many. Keywords cross-cut categories; that is the
point of having both.

**Taxonomy** — the set of categories as a whole. Grown by drains, one category at a time, only
when an existing one genuinely fails to cover a reference; pruned and consolidated by the
collector by hand, never by a drain. See
`docs/adr/0004-drains-always-resolve.md`.

**Image prompt** — dense visual description written for an image generator. Contains no interface
vocabulary and never mentions websites or layout. Written to the GPT Image / Nano Banana
prompting guides; see `docs/agents/image-prompt.md`.

**Brief** — a reusable style template written for a code or page generator, opening with a
`[YOUR SUBJECT]` placeholder. Describes the reference's design character, not the reference.

**Design system** — the measured foundations of a reference's visual language: colour tokens with
roles, a named type scale, spacing and radius scales, elevation, and the prose that explains how
they are applied. A reference has at most one. Distinct from the **brief**, which transplants a
style onto a new subject; a design system records *this* site, in numbers. Not "tokens", "style
guide" or "theme".

**DESIGN.md** — the file a design system serialises to, in the format specified by
`google-labs-code/design.md`: YAML front matter carrying the tokens, then prose sections in the
canonical order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
Do's and Don'ts). The word always means that file for a reference. The repo's own root
`DESIGN.md` is simply the app's design system in the same format, not a different kind of thing.
See `docs/adr/0005-design-systems-follow-design-md.md`.

**Harvest** — the digest of a site's rendered CSS, gathered in the page by
`scripts/harvest-design.js` and aggregated there before it is read: colours ranked by painted
area, font clusters, a spacing histogram, the radius and shadow sets, container widths. Evidence
the agent reasons over, never output it transcribes. Not "scrape" — a harvest measures what the
browser actually painted, not what a stylesheet declares.

**Extract** — the pass that turns a screenshot and a harvest into a design system: cluster the
measurements into a named scale, name the colours and their roles, write the prose. Runs inside a
drain and on demand against a reference already in the library.

## The curation loop

**Capture** — the act of recording that a reference is worth keeping, at the moment the collector
finds it. Capture is deliberately cheap and carries almost no information: a URL and, optionally,
a note on what caught the eye. Distinct from **analysis**, which is everything that happens later.

**Inbox** — the append-only list of captured-but-unanalysed references. One line per capture.
Not "queue" or "backlog": the inbox is a place, and things sit in it without implying an order
they must be worked in.

**Drain** — the agent-run pass that empties the inbox: for each line, screenshot and harvest the
site, analyse the design, write every field of a reference, extract its design system, add both to
the library, and remove the line. Not "import", "sync" or "process" — a drain is the whole pass,
not a per-item step.

**Park** — what happens to a captured reference whose site could not be screenshotted usefully
within the drain's capture budget. A parked reference enters the library visible but marked,
rather than staying in the inbox, with every other field written in full — parking costs only the
capture, not the analysis or the category. A drain never parks for a categorisation reason: see
`docs/adr/0004-drains-always-resolve.md`.

**Draft** — the state a parked reference is in. A draft is a real reference in the library, shown
distinctly, carrying a `draftReason` that explains what went wrong with the capture.

**Resolve** — the action on a draft's tile, offered to the collector as a way to address a capture
failure. It still writes a category assignment through to the library file, but a drain has
already assigned every draft a category by the time the collector sees it, so resolving fixes
nothing about the underlying broken screenshot; the control is a known-deferred half-fit, recorded
in `docs/adr/0004-drains-always-resolve.md`.

**Hide** — removing a reference from view immediately and reversibly, recorded only in the
browser. Not deletion: a hidden reference is still in the library file, untouched. Hidden
references are listed in the grid's Hidden view, each with Restore and Delete….

**Purge** — deleting a reference for real: its entry in the library file, its design system, and
its screenshot files. Triggered by the × on a tile and a confirmation; there is no separate purge
button. Hide survives only for references hidden before this change (↺ restores them).

**Tombstone** — a single hide record. Retained as the mechanism behind hiding; see
`docs/adr/0002-app-writes-its-own-data.md` for why it is no longer the whole deletion story.

## Boundaries

**The app** — the static page the collector opens. It reads the library, the taxonomy and the
design systems, and it writes the inbox and the library file. It never fetches a URL, harvests a
site, calls a language model, or generates a prompt. It does serialise a design system it already
holds back to DESIGN.md text so the collector can download it — that is formatting, not analysis.
Every analysis is the agent's, performed offline. Its Drain panel only asks **the helper** to run a
drain; it never talks to a model itself.

**The helper** — `scripts/server.js`, a local process started by double-clicking "Start
Inspiration Library" (or `npm start`) that serves the app
on `localhost` and runs drains on the Drain panel's behalf, either by launching the collector's
agent CLI or by calling a model API directly. See `docs/adr/0007-local-helper-connects-any-ai.md`.

**The agent** — whichever AI coding agent the collector runs in this repo (Claude Code, Codex,
OpenCode, Gemini CLI, …) between sessions of the collector using the app. All analysis and all
prompt writing are the agent's work; screenshot capture and the data-file writes are scripts the
agent runs (`docs/adr/0006-agent-agnostic-drain.md`).
