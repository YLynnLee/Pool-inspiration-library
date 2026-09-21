Drain the inbox of this Pool repo by following the procedure in
`docs/agents/drain.md` exactly. Read it first; it is the single source of truth. Vocabulary
(capture, inbox, drain, park, draft, resolve) is defined in `CONTEXT.md`.

You do the looking and the writing; scripts do the mechanics. Never hand-edit `inbox.md` or
anything in `data/` during a drain:

- `node scripts/inbox.js` lists the captures. `skip`/`fail` handle duplicates and fetch failures.
- `node scripts/capture.js <url>` takes the screenshots and the harvest. Look at every frame it
  lists before using it.
- `node scripts/commit.js <result.json>` writes the finished capture. Run it with `--dry-run`
  first. The result shape is in `docs/agents/drain-result.md`.

A drain always resolves: every capture gets an existing or newly created category, never a
category-shaped park. The only reason to park a capture as a draft is that the site could not be
captured usefully within the shot budget.

## Scope

Drain the whole inbox, one capture at a time, each finished (committed) before the next starts,
unless a URL is given here, in which case drain only that line:

URL (optional):

## Finishing

Report as the procedure's "After the pass" section requires: how many references were added, how
many were skipped as duplicates, how many were parked as drafts and why (capture failure only),
and what is left in `inbox.md` and why it is still there. List any categories created, each with
the nearest rejected category and why, and finish with taxonomy health (total categories, how many
are singletons). Report how many design systems were written and, for each, which values were
measured versus inferred. Report any malformed lines too, and leave them untouched.
