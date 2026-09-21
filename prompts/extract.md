Extract a design system for one reference in this Inspiration Library repo by following the
procedure in `docs/agents/extract.md` exactly. Read it first; it is the single source of truth,
including the honesty declaration and the lint pass. Vocabulary (design system, DESIGN.md,
harvest, extract) is defined in `CONTEXT.md`.

- `node scripts/capture.js <sourceUrl> --harvest-only` visits the page and writes `harvest.json`.
  Read it against the reference's existing screenshots in `images/`.
- Write `{ "designSystem": { … } }` to a result file (`docs/agents/drain-result.md`, "Extract
  results") and run `node scripts/commit.js <file> --dry-run`, fix what it reports, then run it
  without `--dry-run`. Never hand-edit `data/design-systems.js`.

## Scope

Reference (an id from `data/library.js`, or its exact `sourceUrl`):

- An id that matches `LIBRARY[].id` selects that reference.
- Anything else is a URL matched against `LIBRARY[].sourceUrl` by exact string match, not
  normalised. If nothing matches, report the error and stop. Extraction never captures a new
  reference; that's the drain's job.
- If no reference is given, ask which one to extract.

## Finishing

Report per the procedure's "Reporting" section: which values were measured from the harvest and
which were inferred (and declared in `description:`), and which sections were omitted and why.
