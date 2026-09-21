# The Drain Procedure

A drain is a pass over `inbox.md`, run by the agent when the collector asks for it (see
`CONTEXT.md` for the vocabulary — capture, inbox, drain, park, draft). Any agent can run it: the
mechanical half (browser capture, dedupe, file writes, write order) is done by three scripts, and
the agent's half is looking at screenshots and writing one JSON file per capture. See
`docs/adr/0006-agent-agnostic-drain.md`.

**What the agent needs:** a shell to run `node`, file read/write, and the ability to look at PNG
images. No browser tools. First run on a machine: `npm install` (and, only if Google Chrome isn't
installed, `npx playwright install chromium`). Double-clicking "Start Inspiration Library" does the
install itself.

| Script | Does |
| --- | --- |
| `node scripts/inbox.js` | Lists captures as JSON, each flagged `duplicate` or not, plus malformed lines. `skip "<line>"` strikes a duplicate; `fail "<line>" "<reason>"` records a fetch failure. |
| `node scripts/capture.js <url>` | The capture recipe below, in a headless browser. Writes frames, `harvest.json` and `capture.json` to `.scratch/captures/<slug>/`. |
| `node scripts/commit.js <result.json>` | Validates a result (`docs/agents/drain-result.md`), lints its DESIGN.md, then writes everything in the required order. `--dry-run` validates only. |

## Before starting

1. Run `node scripts/inbox.js` to get `{ captures, malformed }`.
2. Report any `malformed` entries to the collector in your reply. Leave those lines in
   `inbox.md` untouched — do not delete or "fix" them.
3. If `captures` is empty, say so and stop. Nothing else in this procedure runs.

## Per capture

Work through `captures` one at a time, in order. Process each one fully — capture through commit —
before starting the next, so an interruption at any point leaves `inbox.md`, `data/categories.js`,
`data/library.js` and `data/design-systems.js` mutually consistent: a capture is never in both the
library and the inbox, and never in neither, a reference never points at a category that doesn't
exist on disk yet, and a design system never exists for a reference that doesn't. `commit.js`
enforces this; the agent's part is to never edit those four files by hand during a drain.

For a single capture `{ url, note, line, duplicate }`:

1. **Dedupe.** If `duplicate` is true, the URL is already a `sourceUrl` in `data/library.js`
   (string equality; trailing slashes and query strings count as different URLs, since the library
   data does not normalise them either). Run `node scripts/inbox.js skip "<line>"`, report the URL
   as skipped (already in the library), and move on.
2. **Capture.** Run `node scripts/capture.js <url>`.
   - **Exit 2 means the site could not be fetched at all** (dead link, timeout, blocked,
     HTTP error). Run `node scripts/inbox.js fail "<line>" "<the reason capture.json gives>"` —
     the line stays in the inbox with the reason appended to its note — and move to the next
     capture.
   - Otherwise, **look at every frame** listed in `capture.json`. This is the check that actually
     works. A preloader screenshot is worse than no screenshot, since it is a plausible-looking
     record of the wrong thing that will sit in the grid looking fine until the collector clicks
     it. Discard any frame that reads as a loading state or still has an overlay (chat bubble,
     cookie banner, newsletter modal) sitting on the content.
   - If a frame is unusable, re-run with the knob that fixes it: `--hide "<selector>"` for an
     overlay the built-in list missed, `--click "<selector>"` for a consent button it didn't
     accept, `--wait <ms>` for a slow preloader, `--headed` for a site that blocks headless
     browsers. **Budget: two re-runs.** If usable frames still can't be had, stop and don't grind.
     Carry on through analysis with whatever frames exist and park it: `status: 'draft'` with a
     `draftReason` explaining the capture failure (e.g. "loading state persisted past the shot
     budget").
   - Keep `harvest.json`: it feeds step 5. A thin or failed harvest (see `notes` in the digest,
     or `harvest: null` in `capture.json`) is not a capture failure and never triggers a park on
     its own. Extraction just produces a thinner design system.
3. **Analyse.** Write every reference field (`docs/agents/drain-result.md`): `id`, `name`,
   `sourceUrl`, `category`, `summary`, `keywords`, `palette`, `typeNotes`, `imagePrompt`, `brief`.
   Nothing is left blank or a placeholder. If `note` is non-empty, let it visibly shape the
   analysis — the summary or keywords should reflect what the collector said caught their eye, not
   just what's independently visible in the screenshot.

   **Writing the `imagePrompt`.** Follow `docs/agents/image-prompt.md` (structure, camera and light
   terms, positive framing, no interface vocabulary). It is the distilled GPT Image / Nano Banana
   guidance, so do not re-fetch the source guides during a drain.
4. **Categorise.** Every capture that reaches this step gets a real category, because a drain
   never parks for category reasons. Attempt a genuine fit against the categories already in
   `data/categories.js` first: if one honestly fits, assign it. Never force a reference into the
   nearest existing category that only almost fits.

   If none genuinely fits, **create one** in the result's `newCategory`, with the same depth as
   the existing ones: an `id` (a kebab-case slug of the name), a `name`, a one-sentence
   `definition`, a full `description` essay, and a `vocabulary` list. The bar for creating is
   being able to state what the existing categories fail to cover. Write that statement into the
   new category's `definition`, and name the nearest existing category and why it was rejected in
   `rejectedCategory`, so the creation is auditable. Drains only ever append categories. They
   never merge, rename, or remove one, attended or not. Consolidating categories stays a manual act
   the collector performs later.

   Parking now means exactly one thing: the site could not be captured usefully within step 2's
   budget. A capture-failure draft still gets a category assigned like any other reference. Its
   `status: 'draft'` and `draftReason` record the capture problem, not a categorisation problem.
5. **Extract.** Follow `docs/agents/extract.md` from **Interpret** onward, reading `harvest.json`
   against the kept frames. The capture's visit stands in for a fresh one. Cluster, write the
   prose, declare what was measured versus inferred, and put the entry in the result's
   `designSystem`. This runs for every capture that reaches this step, including a
   capture-failure draft. A thin or missing harvest still produces a design system, per
   extraction's "A thin harvest still produces a file".
6. **Commit.** Save the result as `.scratch/captures/<slug>/result.json`, run
   `node scripts/commit.js <that file> --dry-run`, fix every problem it reports, and re-run until
   it is clean. Then run it without `--dry-run`. The commit script writes screenshots to `images/`,
   then the category, then the reference, then the design system, and strikes `line` from
   `inbox.md` last. That way a crash anywhere before the end leaves the line in the inbox for a
   retry rather than losing the capture.

**Write order** (enforced by `commit.js`): category, then reference, then design system, then inbox
line. Writing the category first means the worst an interruption can leave behind is an orphan
category with no references, which is visible in the app's filter row and harmless. Writing the
reference before the design system means the worst case is a reference with no design system yet,
which the app already renders fine via the legacy `palette`/`typeNotes` fields. The reverse order
would risk a design system pointing at a reference that doesn't exist on disk.

## What the capture script does

`scripts/capture.js` is the fixed capture recipe, run the same way every time rather than retried
by exploration. Changes to the recipe are changes to that script:

- Loads the page in a **1440×900 viewport** and waits for the network to settle.
- **Suppresses known overlays before the first shot.** Chat widgets, cookie-consent banners and
  newsletter modals are third-party chrome, not part of the site's design system. It hides common
  culprits with injected CSS (`--hide` adds more) and clicks an obvious "Accept" button if one is
  showing (`--click` adds more).
- Runs one **incremental step-scroll pass** with small wheel steps to the bottom. Jumping skips the
  scroll-triggered reveals many hero sections depend on, which is what produces loading-state
  frames. Wheel input rather than `scrollTo` means smooth-scroll libraries see real scrolling. A
  scroll-jacked page, where `window.scrollY` never moves, is shot by wheel-step count instead, and
  `capture.json` says so.
- Returns to the top and steps down again, shooting at **up to five positions**: the top, roughly
  a quarter, half and three-quarters of the way down, and the end. Positions closer than half a
  viewport apart are dropped, so a short page yields fewer, genuinely distinct frames.
- **Frames each shot to the page's rendered content**, not the raw viewport. A layout centred in
  a narrow column isn't kept as a mostly-empty 1440px frame. It then runs the dead-space check in
  the browser's canvas, cropping any remaining near-white band over 12% of the frame on the right
  or bottom edge, and writes each frame as a PNG (what the model is shown) plus a WebP twin (what
  `commit.js` copies into `images/`).
- **Harvests** by injecting `scripts/harvest-design.js` into the settled page (`docs/agents/
  extract.md`'s **Harvest** step), in the same visit, so extraction never needs a second one.

## Draining a single line

The same per-capture procedure applies to one line pulled out on its own, since the collector can
ask to drain just one URL rather than the whole inbox. Find its entry in `node scripts/inbox.js`'s
output and run the steps above for that capture only.

## After the pass

Summarise for the collector: how many references were added, how many were skipped as duplicates,
how many were parked as drafts and why (always a capture failure now), and what's left in
`inbox.md` and why it's still there.

Also report how many design systems were written, and for each one, which values were measured
from the harvest and which were declared inferred. If a commit ran with `--skip-lint`, say so.

If any category was created, list each one with the nearest existing category that was rejected
and why. Finish with taxonomy health: how many categories exist in total, and how many hold only
a single reference. That is the signal for whether a manual consolidation is worth doing (drains
never merge categories themselves).
