# 09 — Drain the inbox by hand

**What to build:** The loop closes. The collector puts lines in `inbox.md` over the course of a
week, says "drain the inbox" once, and gets finished references in the library — every field
written, indistinguishable from one saved by hand.

A drain is one pass over the whole inbox, not a per-item step. For each captured line: check the
URL against what the library already holds, capture the site, analyse the design, write the
reference, add it, and delete the line. The inbox always shows exactly what is outstanding, so a
line surviving a drain means something and should carry a note saying what.

The drain is a procedure the agent follows, not code the app runs — so write it down somewhere a
future session will find it, precisely enough that two different sessions would do the same thing.
What *is* code is the parsing: turning inbox text into captures, tolerantly, and reporting what it
could not read rather than silently dropping it. That belongs in the pure curation module beside
the formatting function from 07.

The collector's note is the whole reason capture allows one. If a line says "the way the nav
dissolves on scroll", that must be visible in the resulting analysis — otherwise writing notes was
wasted effort and they will stop.

Interruption is expected: a drain of ten sites is long enough to be cut short. Leave the inbox
consistent at every point, so re-running neither duplicates a reference nor loses a capture.

Screenshot quality on hard, scroll-driven sites is deliberately deferred to ticket 11. Simple
sites capturing correctly is enough here.

**Blocked by:** 07 — the inbox line format and its parsing counterpart are established there.

**Status:** done

- [x] Draining the inbox produces a complete reference for each captured line
- [x] Every field of a produced reference is written — nothing left blank or placeholder
- [x] A capture note demonstrably influences the resulting analysis
- [x] A line is removed from the inbox once its reference is in the library
- [x] A URL already in the library is skipped and reported, not added twice
- [x] A line that cannot be fetched stays in the inbox with a note explaining why
- [x] A malformed line is reported rather than dropped or thrown on
- [x] Blank lines, whitespace and comment lines are tolerated
- [x] An empty or absent inbox file yields no captures and no error
- [x] An interrupted drain leaves the inbox consistent; re-running neither duplicates nor loses
- [x] A single line can be drained on its own rather than the whole inbox
- [x] Parsing is a pure function in the curation module, covered by tests
- [x] The drain procedure is documented where a future session will find it
