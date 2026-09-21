# 0005 — References carry a design system, serialised as DESIGN.md

## Status

Accepted. Extends the reference model defined across `CONTEXT.md`, `PRODUCT.md` and
`docs/agents/drain.md`. Does not reverse any earlier ADR; `docs/adr/0002-app-writes-its-own-data.md`
governs the new data file the same as the existing ones, and `docs/adr/0004-drains-always-resolve.md`'s
parking rule is deliberately left untouched (see "A thin harvest is not a park").

## Context

A reference today records how a site *feels*: a category essay, free-form keywords, an image
prompt, a brief. Its two nearest-to-factual fields — `palette` (four hex values) and `typeNotes`
(a paragraph) — are written by looking at a screenshot. They are impressions with the grammar of
measurements. `palette` cannot tell you which of its four colours is the ground and which is the
accent used once per viewport; `typeNotes` names no font.

That was enough while the library's purpose was recall and prompting. The collector's purpose has
widened: they want to hand a reference's visual language to a coding agent and have it build from
real constraints. That requires numbers a screenshot cannot supply — the font stack that actually
rendered, the hex the browser actually painted, the radius scale, the base spacing unit.

Two prior-art products define the target. `google-labs-code/design.md` specifies a file format —
YAML token front matter plus prose sections in a canonical order — explicitly designed so that
"agents [have] a persistent, structured understanding of a design system", with a linter and
exporters. Refero Styles (`styles.refero.design`) ships the same idea as a browsable product: per
site, a swatch list with human colour names and roles, a type-scale ladder with font substitutes,
spacing and radius tables, do's and don'ts, and a copyable DESIGN.md. The collector wants both
halves: Refero's page, Google's file.

## Decision

**A reference may carry one design system, and the canonical artifact is a Google-format
DESIGN.md.** Where Google's specification and Refero's presentation disagree, Google wins.

**The YAML schema is Google's, unextended.** `name`, `description`, `omitted`, `colors`,
`typography`, `rounded`, `spacing`, `components`, with `{path.to.token}` references. Colour keys
are semantic (`primary`, `surface`, `on-surface`), not poetic. Prose sections appear in the
canonical order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
Do's and Don'ts.

**Refero's additions survive as prose, not as schema.** Human colour names ("Bioluminescent Lime")
sit in the `## Colors` prose against their semantic token key — the specification invites exactly
this: *"Prose may use descriptive color names (e.g., 'Midnight Forest Green') that correspond to
systematic token names (e.g., `primary`)."* Font substitutes go in `## Typography` prose. The
one-line poetic tagline becomes the `description:` field, which is a Google field. Nothing is
added to the YAML schema, so every file stays lintable by `npx @google/design.md`.

**Values are measured first.** `scripts/harvest-design.js` runs in the page during the same visit
that produces the screenshots and returns a ranked digest — colours by painted area, font clusters
by family/size/weight/line-height/tracking, a spacing histogram, the distinct radius and shadow
sets, container widths. The agent reasons over that digest against the screenshots; where they
disagree, the harvest wins on the number and the agent wins on the meaning.

**Clustering is the work.** A harvest returns thirty to fifty distinct type combinations and forty
observed gaps. The DESIGN.md records a named scale of roughly six to ten typography tokens and a
base spacing unit, not the raw observations. A dump is data; a scale is a design system.

**Inference is allowed and must be declared.** Where a value cannot be measured, the agent may
write a plausible one. The `description:` field states what was measured and what was inferred, in
one line, so a guessed hex never silently becomes a fact.

**One structured source, two views.** The design system lives as structured data in
`data/design-systems.js`, a classic script assigning a global, keyed by reference id — the same
pattern as `data/library.js` and `data/categories.js`. The app renders the Refero-style breakdown
directly from it, and serialises it to DESIGN.md text for download. No `.md` sidecar files are
kept in the repo.

**Foundations first; components are opt-in.** `components:` and `## Components` appear only when a
site genuinely has a repeated component language. Otherwise the file declares them in `omitted:`
with a reason, which is the mechanism the specification provides for exactly this.

**No export formats are generated.** No `tailwind.config.js`, no `design_tokens.json`, no CSS
custom property block. All four are one deterministic command away —
`npx @google/design.md export <file> --format css-tailwind|json-tailwind|dtcg|css-vars` — and
generating them ourselves would duplicate a maintained tool with a worse one.

**A thin harvest is not a park.** `Draft` means exactly one thing (`docs/adr/0004-drains-always-resolve.md`):
the site could not be screenshotted usefully. A harvest that returns little — a WebGL canvas with
no DOM to measure, a page that blocks scripting — still produces a DESIGN.md, written from the
screenshots with the shortfall named in `description:`. Stretching `Draft` to cover harvest
quality would blunt a term deliberately made precise.

## Consequences

**`palette` and `typeNotes` become legacy fields.** Where a design system exists the app prefers
it; where one does not, the old fields still render. Both states coexist indefinitely — no
migration, and a reference without a design system is a valid reference.

**Extraction is separately invocable.** `/extract <id-or-url>` runs the pass on its own; a drain
calls it. That gives a re-run when a site redesigns or a harvest came out thin, and makes
backfilling old references N invocations of one command rather than a special case.

**The library is reset to two references.** The collector chose a fresh start: Locomotive and Ciao
Energy survive as the pilot pair — an easy harvest and a hard one — and the other six references,
their screenshots, and the five categories thereby left empty are deleted. Those five category
essays are hand-written and will not be regenerated; they remain in git history. This is a
one-time act, not a policy: drains still never remove a category.

**Drains get more expensive again.** Each capture now also runs a harvest and writes a full design
system. The harvest itself is cheap — it aggregates in the page and returns one to two kilobytes —
but the written file is substantial. This is the second cost increase accepted in a row, after
0004's category essays.

**A third generated data file joins the write-order invariant.** `docs/agents/drain.md`'s order
becomes category, then reference, then design system, then inbox line. A design system orphaned by
an interruption points at a reference that exists; the reverse would leave the app rendering a
reference whose system is missing.

## Alternatives considered

**Our own design-system shape rather than Google's.** Would fit the existing data files more
naturally and avoid a `components:` section that half the library will omit. Rejected: the entire
value of the artifact is that a coding agent already knows how to read it. A bespoke format is a
private dialect, and it forfeits the linter and the four exporters for free.

**`.md` sidecar files at `references/<id>/DESIGN.md` as the canonical store.** Lintable in place
and directly handable to another tool without opening the app. Rejected because the app runs from
`file://`, where `fetch()` is blocked and the File System Access API demands a folder-permission
click — so every browse of the breakdown page would cost a permission prompt. Conformance is
recovered by linting a temporary file at extraction time and discarding it.

**Inlining the design system into `data/library.js`.** Rejected: that file is deliberately
hand-editable, one readable block per entry, so the collector can fix a typo without an agent. Two
hundred lines of tokens per entry destroys the only property it exists to protect.

**Eyeballing the design system from screenshots alone, with no harvest.** Cheapest by far, and no
new script to maintain. Rejected because approximate hexes and guessed font names are precisely
what the current `palette`/`typeNotes` already provide, and reproducing them in a more official
format would be motion without movement.

**Transcribing the harvest directly into tokens.** Rejected: real marketing sites yield two
hundred near-identical greys, third-party widget styles, and ad-iframe leakage. Unclustered output
would be an accurate record of noise.
