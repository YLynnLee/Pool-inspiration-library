# 14 — Nightly drain via launchd

**What to build:** An opt-in scheduled drain, so the inbox empties itself without the collector
asking. Captures made during the day are finished references by morning.

The scheduling mechanism is `launchd` on this machine, invoking Claude headlessly in the repo
folder. This is not a preference — it is the only option that works. `CronCreate` is session-only
and in-memory, so it dies with the session; scheduled cloud routines cannot reach a repository
that is local-only with no remote. Neither can drain this inbox.

Nothing in the rest of the feature depends on this existing. The manual drain is the product; this
is convenience layered on top, and the collector should be able to ignore it indefinitely.

An unattended drain obeys exactly the same rules as a manual one — in particular the parking
constraint from 12, which is what makes running it unwatched acceptable at all. It stays quiet
over an empty inbox: automation that reports every night that it did nothing gets ignored within a
week, and then gets ignored on the night it mattered. When it does work, it leaves a record the
collector can read afterwards, so the loop can be trusted without being watched.

**Blocked by:** 09 — there must be a drain to schedule. 12 — the parking rules are what make
unattended running safe.

**Status:** done

- [x] The drain runs headlessly in the repo folder without an interactive session
- [x] A scheduled drain applies the same parking rules as a manual one
- [x] A scheduled drain over an empty inbox does nothing and says nothing
- [x] A scheduled drain leaves a readable record of what it did
- [x] Setting up the schedule is documented as an optional step the collector opts into
- [x] The library continues to work identically if the schedule is never set up
- [x] Why `CronCreate` and cloud routines cannot serve this is recorded, so it is not re-litigated
