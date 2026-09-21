# 0003 — Scheduling via launchd, not agent-native cron tooling

## Status

Accepted.

## Context

Ticket 14 (a nightly drain) needs something to invoke the agent on a schedule without the
collector asking each time. Two agent-native scheduling mechanisms exist and both were
considered before reaching for the operating system:

- **`CronCreate`** schedules a recurring job, but only for the lifetime of the current session —
  it is session-scoped and in-memory. It cannot outlive the session that created it, so it cannot
  produce a drain that still runs after the collector closes their laptop.
- **Scheduled cloud routines** run reliably on a server-side schedule independent of any local
  session, but they act on a repository reachable from the cloud — typically via a remote. This
  repo has no remote (see `CLAUDE.md`: "This repo has no remote and nothing is published to
  GitHub") and is local-only by design. A cloud routine has no repository to reach.

Both fail for the same underlying reason: this project's data lives in one place, a folder on one
machine, with no server and no remote. Anything that runs the drain unattended has to run on that
machine, against that folder, on its own clock.

## Decision

Scheduling is `launchd`, macOS's own facility for exactly this: a job description
(`scripts/com.inspiration-library.nightly-drain.plist`) invoking a script
(`scripts/nightly-drain.sh`) that checks whether the inbox actually has anything to drain and, if
so, invokes `claude` headlessly in the repo folder to run the same procedure documented in
`docs/agents/drain.md`. See `docs/agents/nightly-drain.md` for the setup steps.

This is not a preference among equivalent options — it is the only mechanism of the three that can
reach a local-only repository on a schedule independent of any interactive session.

## Consequences

**Opt-in and inert by default.** The plist is a template, not installed anywhere launchd reads
until the collector copies it into `~/Library/LaunchAgents` and loads it. Nothing about the rest
of the feature depends on this existing; the manual drain (ticket 09) is the product this is
convenience on top of.

**Unattended runs inherit the same hard constraints as manual ones.** In particular, the
parking rule from ticket 12 — a drain may assign an existing category but never invent one — is
what makes running this without anyone watching acceptable at all. `nightly-drain.sh` doesn't
enforce this itself; it's a rule in `docs/agents/drain.md` that a headless agent invocation
follows exactly as a manual one does, because both are the same documented procedure.

**No news is no news.** The script checks the inbox for actual captures before invoking `claude`
at all, and exits silently if there are none. The record at
`.scratch/curation-loop/nightly-drain.log` only grows on a night the drain did something, so it
stays worth reading.

## Alternatives considered

**`CronCreate`.** Rejected: session-scoped, cannot survive the collector closing their session.

**A scheduled cloud routine.** Rejected: this repo has no remote, so a cloud-side job has nothing
to check out or push to.

**A third-party scheduler (e.g. a `cron` entry, `pm2`, a menu-bar app).** Not considered further —
`launchd` is the platform-native mechanism on macOS, already handles both `cron`'s job and
survives reboots without extra software, and needs no dependency beyond what the machine already
has.
