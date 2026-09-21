# 12 — Parking rules in the drain

**What to build:** The drain stops guessing. A reference that fits no existing category is
**parked** — it enters the library as a draft with a short reason recorded — rather than being
filed under the nearest category that almost works.

The hard constraint: **a drain may assign an existing category, and may never coin a new one.**
This holds for manual drains as much as scheduled ones, so that behaviour does not quietly differ
between a run the collector watches and a run they do not. It is the single rule that makes
unattended draining safe to turn on later.

The reasoning is in the original spec: the category essays are "the part of this idea least
available elsewhere, and worth more care than the application code", and the taxonomy is meant to
be re-cut deliberately as real references accumulate. A taxonomy that grows a new category
unsupervised is exactly how that care gets lost.

Parking is therefore not a failure mode — it is how the taxonomy stays honest. A cluster of
drafts parked for the same reason is the best available evidence of what the next category should
be, and is far more useful than an empty draft list bought by forcing bad fits.

**Blocked by:** 08 — drafts must render before parking into one is useful. 09 — this is a rule
applied by the drain procedure built there.

**Status:** done

- [x] A reference fitting no existing category is parked as a draft, not assigned a poor fit
- [x] A drain never coins a new category, whether run manually or unattended
- [x] The reason a reference was parked is recorded on the draft
- [x] Parked references enter the library rather than staying in the inbox
- [x] The inbox line is removed when its reference is parked, as it is for a finished one
- [x] Manual and unattended drains apply identical parking rules
- [x] The rules are documented alongside the rest of the drain procedure
- [x] Re-cutting the taxonomy stays a deliberate act by the collector, never a side effect of a drain
