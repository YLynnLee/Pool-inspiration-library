# Nightly drain via launchd (optional)

An opt-in scheduled drain, so captures made during the day are finished references by morning
without the collector asking for a drain. This is convenience on top of the manual drain
(`docs/agents/drain.md`) — nothing else in the library depends on it existing, and it is safe to
never set up.

## What it does

Every night at 3am (adjustable in the plist), `scripts/nightly-drain.sh` runs:

1. It checks `inbox.md` via `parseInboxLines` for anything to act on — captures to drain or
   malformed lines worth reporting. If there's nothing, it exits immediately: no agent
   invocation, nothing logged. A genuinely empty inbox produces no record.
2. Otherwise it runs the agent CLI named by `DRAIN_AGENT_CMD` (see **Choosing the agent** below;
   Claude Code by default) headlessly in the repo folder, passing `prompts/drain.md` plus an
   unattended-run addendum as the final argument, so it runs the exact procedure in
   `docs/agents/drain.md` — the same rules
   apply as a manual drain, including the harvest-and-extract step (`docs/agents/extract.md`) and
   the guards on creating a category, and malformed
   lines get reported the same way a manual drain would report them. An unattended drain harvests
   and extracts under exactly the same rules as an attended one — there is no lighter-weight mode.
3. The agent appends its own summary of the run — references added, duplicates skipped, drafts
   parked and why, design systems written and what in each was measured versus inferred, malformed
   lines found — to `.scratch/curation-loop/nightly-drain.log`, under a timestamped heading. That
   file is the readable record; check it after a run rather than trusting silence blindly.

Two other log pairs exist, both for debugging a run that didn't behave as expected rather than
for everyday reading:

- `launchd`'s own stdout/stderr for the job (mechanical failures — the agent CLI not on `PATH`, the
  script not executing) go to `.scratch/curation-loop/launchd.stdout.log` and
  `launchd.stderr.log`.
- The agent invocation's own raw stdout/stderr — its tool-call transcript, not the summary it
  writes — go to `.scratch/curation-loop/nightly-drain.log.stdout` and `.stderr`. Useful if a run
  produced no entry in `nightly-drain.log` at all and you need to see why.

## Choosing the agent

**Easiest:** choose an AI in the app's Drain panel (`npm start`, then **Drain**). With no
`DRAIN_AGENT_CMD` set, the nightly job runs `node scripts/drain-run.js`, which uses that same
choice, whether it's an agent app or a model API, and logs its summary. Everything below is only
for overriding that from the shell.

`DRAIN_AGENT_CMD` is a command plus its flags; the script appends the prompt as the last argument.
Set it in a `.drain.env` file at the repo root (gitignored), e.g.:

```sh
DRAIN_AGENT_CMD="codex exec --dangerously-bypass-approvals-and-sandbox"
```

Starting points for common agents. Flags change between releases, so check them against
`<cli> --help` before trusting a night to them:

| Agent | `DRAIN_AGENT_CMD` |
| --- | --- |
| Claude Code (default) | `claude --print --dangerously-skip-permissions` |
| Codex CLI | `codex exec --dangerously-bypass-approvals-and-sandbox` |
| Antigravity CLI | `agy --dangerously-skip-permissions --print-timeout 60m -p` |
| OpenCode | `opencode run` (grant shell/edit permissions in `opencode.json`) |

Whichever you pick, it needs to run without asking for approval (nobody is awake to click
"allow"), have network access (the capture script loads live sites), and use a model that can read
images. A sandbox that blocks network will turn every capture into a fetch failure.

## Setup (one time, per machine)

1. Choose the agent (above), and confirm its CLI is on `PATH` for non-interactive shells (check
   with `which <cli>` in a fresh terminal, since `launchd` does not source your shell profile).
2. Copy `scripts/com.pool.nightly-drain.plist` to `~/Library/LaunchAgents/`.
3. In the copy, replace both `REPO_PATH_HERE` placeholders with the absolute path to this
   checkout (e.g. `/Users/you/Desktop/Pool`).
4. Load it:
   ```
   launchctl load ~/Library/LaunchAgents/com.pool.nightly-drain.plist
   ```
5. To stop it, unload the same path and optionally delete the copied plist:
   ```
   launchctl unload ~/Library/LaunchAgents/com.pool.nightly-drain.plist
   ```

The plist in `scripts/` is a template and is never loaded from that path directly — edit the copy
in `~/Library/LaunchAgents`, not the one in the repo, so the placeholder stays a clean template
for reinstalling on another machine.

## Notes

- This is entirely opt-in. If it's never set up, the library and the manual drain work exactly as
  they do today.
- Because it runs the agent with approvals bypassed, treat it the same as any other unattended
  script with write access to this repo: only load it on a machine you trust, and review
  `nightly-drain.log` periodically the way you'd review any automation you don't watch run.
