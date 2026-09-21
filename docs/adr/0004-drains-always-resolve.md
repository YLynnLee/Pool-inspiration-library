# 0004 — Drains always resolve; a drain may grow the taxonomy

## Status

Accepted. Reverses the rule, stated and reasoned about in `CONTEXT.md`, `CLAUDE.md`,
`docs/agents/drain.md` and `.claude/commands/drain.md`, that a drain may assign an existing
category but must never invent one. Also touches on the parking rule referenced in
`docs/adr/0003-launchd-scheduling.md`'s Consequences section: unattended runs still inherit
exactly the same rules as manual ones, but those rules have changed — see below.

## Context

The taxonomy in `data/categories.js` is four categories cut from the collector's first six saved
references, all of which share a dark, kinetic, cinematic register. The original design bet that
categories invented ahead of real references would not survive contact with what actually got
saved, so it forbade a drain from ever growing the taxonomy — a reference that fit nothing
existing was parked as a draft instead, left for the collector to judge by hand.

That bet didn't hold. The collector's taste is wider than the first six references implied, and in
the most recent drain all three captures were parked for exactly this reason. Parking was designed
as the exception; it became the norm. Two things make that worse than it sounds:

1. Parked references were invisible by default — the grid hid drafts, so a drain that parked
   everything looked like it had produced nothing. (Fixed separately, ticket 01: drafts are now
   visible by default.)
2. The work didn't finish itself. Every parked reference was a decision handed back to the
   collector, in a library whose entire premise is that analysis happens offline without them
   (`CONTEXT.md`, "The app"). A drain that hands back a decision on every capture defeats the
   point of draining.

## Decision

**A drain always resolves.** Every capture leaves a drain as a real reference carrying a real
category — assigned to an existing one where the reference genuinely belongs, or to a category the
drain creates when nothing existing fits.

Two guards keep this from degrading the taxonomy into a tag cloud:

- **Existing categories are preferred.** A drain must genuinely attempt a fit first, and may only
  create a category when it can state what the existing categories fail to cover. That statement
  becomes the new category's `definition`, and the drain reports the nearest rejected category and
  why alongside the creation, so every new category is auditable after the fact rather than taken
  on faith.
- **Drains never merge.** Consolidating two categories that turn out to describe one style under
  two names rewrites references and discards an essay — that stays a manual act the collector
  performs, never something an agent does unattended. Every drain reports taxonomy health (total
  categories, how many hold a single reference) so the collector knows when consolidation is worth
  doing.

A created category carries the same depth as the four written by hand: `id` (a kebab-case slug of
the name), `name`, `definition`, `description` essay, `vocabulary` list. A stub would just be the
draft problem wearing a different hat.

**Parking survives, narrowed to one meaning: a site that could not be captured usefully.**
Category-parking no longer exists — see `docs/agents/drain.md` step 4. This also required fixing
the capture step, which previously retried by unstructured exploration and could burn eleven
screenshots to keep six references. Capture now follows a fixed recipe (settle, one
step-scroll pass, shots at two known positions, ~4-shot ceiling, 1440px viewport) and parks as a
capture failure — the one remaining park reason — when that budget is exhausted without a usable
frame.

**Write order extends to a third file.** Category, then reference, then inbox line. This keeps the
existing crash-consistency invariant (a capture is never in both the library and the inbox, and
never in neither) intact while adding a category file to the picture: the safe failure is an
orphan category with no references, visible in the filter row and harmless, rather than a
reference pointing at a category that was never written.

**The resolve control's copy changes; its action does not.** With drafts now meaning capture
failure exclusively, the category picker's copy no longer makes sense as-is — resolving assigns a
category, but every draft already has one by the time the collector sees it. The copy changes to
explain the capture failure instead of soliciting a category decision. The underlying action
(`resolveDraft`, still a category-assignment write) is knowingly left alone: it is a real gap —
assigning a category fixes nothing about a broken screenshot — but repurposing it to trigger a
re-capture is out of scope here and deferred to whoever next touches the resolve flow.

## Consequences

**Drains get more expensive, not less, net of the capture-side savings.** The capture recipe and
shot ceiling cut image tokens meaningfully, but every created category adds a full essay and
vocabulary list to the output. On the pass that prompted this change, that would have been three
essays. The collector chose finishing the job over minimising cost, explicitly.

**Fragmentation is the accepted risk.** Removing the merge step means the taxonomy can only grow.
The singleton count in the pass summary is the early-warning signal; manual consolidation by the
collector is the remedy. If singletons accumulate faster than the collector wants to consolidate,
the rejected-at-design alternative — create only when two or more references would share a new
style — is the next thing to try.

**`docs/adr/0003-launchd-scheduling.md`'s Consequences section describes the old parking rule as
what makes unattended runs safe.** That reasoning is superseded by this ADR: what makes an
unattended drain safe now is that it follows exactly the same category-creation guards (genuine
fit first, auditable creation, never merge) as a manual one, not that it's forbidden from creating
categories at all. `docs/agents/nightly-drain.md` is updated to match; 0003 itself is left as the
historical record of the launchd decision and is not rewritten.

**The curation-loop spec is left as written.** It documents what was decided when the taxonomy was
designed never to grow unattended. This ADR supersedes that decision; the spec stays as a
historical record rather than being edited to match.

## Alternatives considered

**Evidence-gated creation: only create a category when two or more references would share it.**
Would slow fragmentation directly, at the cost of parking single outliers again — reintroducing
the exact failure mode this change exists to fix, just with a higher bar. Rejected for now; noted
above as the next lever if singleton growth outpaces the collector's appetite for manual
consolidation.

**Repurpose the resolve control to trigger a re-capture.** Would make the control actually useful
again for what drafts now mean. Rejected as its own piece of work — it touches the capture flow
from inside the app, which the app currently has no access to (capture is agent-only, per
`CONTEXT.md`'s "The app" boundary) — and is recorded as deferred rather than designed here.
