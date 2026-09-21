# The Extraction Procedure

Extraction is the pass that turns a reference's rendered page into a design system: a measured
digest plus the agent's interpretation of it, written as one entry in `data/design-systems.js` and
serialisable to a lint-clean DESIGN.md (see `CONTEXT.md` for the vocabulary — design system,
DESIGN.md, harvest, extract — following Google's format, unextended). It is invoked standalone
(the `extract` command, or `prompts/extract.md` pasted into any agent),
or as a step inside a drain (`docs/agents/drain.md`). Like the drain, any
agent that can run a shell, read and write files, and look at images can run it — the browser work
and the file write are scripts.

## Locate

By reference id, or by `sourceUrl` for a URL:

- A bare id or a value that matches an existing `LIBRARY[].id` locates that entry directly.
- Anything else is treated as a URL and matched against `LIBRARY[].sourceUrl` by string equality
  (same non-normalising rule the drain's dedupe uses — trailing slashes and query strings count as
  different URLs).
- A URL not found in the library is an error, not an implicit capture. Report it and stop —
  capture is the drain's job, not extraction's.

## Visit

Run `node scripts/capture.js <sourceUrl> --harvest-only`. It loads the page at a **1440px-wide
viewport**, waits for the network to settle, and runs the same incremental step-scroll pass the
drain's capture uses (small steps rather than a jump to the bottom, so scroll-triggered reveals
resolve before anything is read), then harvests without taking screenshots.

Inside a drain this is the *same* visit that takes the reference's screenshots — extraction rides
along rather than opening the page twice. Run standalone, it is its own visit, and the reference's
existing `screenshots` on disk stand in for what a fresh capture would show if the site is
unchanged; look at those before deciding a re-visit is needed.

## Harvest

`scripts/capture.js` injects `scripts/harvest-design.js` into the settled page and writes its
return value to `harvest.json` in the capture's working directory — the digest
described in `CONTEXT.md`'s **Harvest** entry: colours ranked by painted area, font clusters, a
spacing histogram, the radius and shadow sets, container widths, and a `notes` array flagging
anything the harvest itself couldn't see (a thin DOM, a canvas-dominated viewport, skipped
cross-origin iframes). Record `notes` — they are the harvest's own account of its blind spots, and
belong in `description:` verbatim or paraphrased (see **Declare honesty** below).

## Interpret

Reason over the digest *against the screenshots*, not in place of them. Where they disagree, the
harvest wins on the number and the agent wins on the meaning: a harvest reporting `#0A0A0B` where
the screenshot reads black means the value is `#0A0A0B` and the role is "the ground", not that the
harvest is wrong. The screenshots are what tell a `primary` colour from a `surface` colour, or a
`display` typography token from a `label` — the harvest has no concept of role.

## Cluster

This is the actual design work; a harvest is not a design system, and transcribing it directly
would just relocate the noise. Turn the raw
observations into a named system:

- **Typography.** Roughly six to ten tokens in Google's naming convention (`display`, `headline`,
  `body`, `label`, `caption`, each optionally sized `-sm`/`-md`/`-lg`), not the thirty-odd distinct
  combinations the harvest returns. That list is the common case, not a closed one: where a site's
  type system genuinely carries a register none of those five names fit — a distinct monospace
  voice used only for a system-bulletin effect, say — name it for what it is (`mono`) rather than
  forcing it into a size-suffixed slot it doesn't occupy; the token name should tell a reader what
  the type is *for*, and a false `-sm`/`-md`/`-lg` reading would tell them the wrong thing. Merge
  clusters that differ only by incidental pixel noise
  (line-height rounding, a one-off letter-spacing on a single element) into the token they clearly
  belong to.
- **Spacing.** One base unit plus a named scale (`xs`, `sm`, `md`, `lg`, `xl`, …), not the raw
  histogram of forty observed gaps. The base unit is usually the histogram's mode.
- **Rounded.** A named radius scale, same treatment as spacing.
- **Colours.** Reduced to semantic keys — `primary`, `surface`, `on-surface`, `accent`, and
  whatever else the site's actual roles demand — never the harvest's raw ranked list. Each
  semantic key also gets a human display name and a role sentence (`colors[key].displayName` /
  `.role` in the data shape — see `js/curation.js`'s `serializeDesignMd`), which exist for the
  app's swatch labels and this document's own prose and are deliberately never written into the
  DESIGN.md YAML.

## Write the prose

Canonical sections, in the order `serializeDesignMd` emits them (Overview, Colors, Typography,
Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts):

- **Overview** carries the poetic character — the same register as a reference's `summary`, not a
  dry token list.
- **Colors** names each swatch humanly against its semantic key (`js/curation.js`'s
  `buildColorsYaml` only ever emits `.value` into YAML; the human name and role live here in
  prose).
- **Typography** names the families, the scale logic, and the substitute stacks (the `fonts` array
  on the entry — never written to YAML either, same rule as colour names).
- **Do's and Don'ts** must be specific enough to constrain a build: "lime accent at exactly
  40×40px", never "use colour sparingly".

Omit a section entirely, rather than writing a thin one, if the harvest and screenshots together
don't support it — that's what **Omit deliberately** below is for.

## Declare honesty

One line in `description:` stating what was measured and what was inferred. This is
non-negotiable: an inferred hex and a measured hex are typed identically in YAML, and six months
on nothing else records which is which. Where the harvest returned thin or degraded data (per its
`notes`), say so here too — "measured from the harvest; the hero's canvas-rendered type is
inferred from the screenshot, since a canvas paints nothing `getComputedStyle` can read."

## Omit deliberately

`components:` and the `## Components` section appear only where a real, repeated component
language exists on the site — buttons, cards, inputs that recur with a consistent visual treatment.
Otherwise, declare it:

```
omitted: [{ section: 'components', reason: '...' }]
```

The reason must be something a reader can check against the site, not a placeholder — "no repeated
interactive component language observed; the page is a single scroll-driven scene with no
buttons, cards, or form fields."

## Lint

`node scripts/commit.js <result.json> --dry-run` serialises the entry with `serializeDesignMd`
(from `js/curation.js`) to a **temporary file**, runs `npx @google/design.md lint` over it, and
reports what it flags alongside any shape problems. Fix whatever it flags — a missing required
section, a malformed token reference, an invalid `Dimension` — and re-run until it's clean. No
`.md` sidecars are kept in the repo; the temp file exists only to give the real linter something
to read (sidecars aren't the canonical store). Offline, `--skip-lint` bypasses the linter; say so
in the report.

## Write

Standalone, save `{ "designSystem": { … } }` as a result file (`docs/agents/drain-result.md`,
"Extract results") and run `node scripts/commit.js <file>`. It appends the entry to
`DESIGN_SYSTEMS` in `data/design-systems.js` via `serializeDesignSystems`, replacing any existing
entry for the same `referenceId` if this is a re-run. Inside a drain, the entry goes in the drain
result's `designSystem` instead and is written by the same commit.

Inside a drain, this write happens after the reference write and before the inbox line is struck,
in this order: category, then reference, then design system, then inbox line.

## A thin harvest still produces a file

A page that is mostly WebGL, or blocks scripting, still gets a DESIGN.md written from the
screenshots, with the shortfall named in `description:`. It is **never** parked as a `Draft` —
that term means screenshot failure and nothing else.
Extraction has no park state of its own: it either produces a file (usually a thinner one, with
more of its values declared inferred) or it errors out at **Locate** because the reference or URL
doesn't exist yet.

## Reporting

After a run, report for the reference: which values were measured (from the harvest) and which
were inferred (declared in `description:`), and which sections were omitted and why.
