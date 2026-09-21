#!/bin/sh
# Invoked by launchd (see scripts/com.inspiration-library.nightly-drain.plist
# and docs/agents/nightly-drain.md) to run an unattended drain. Not meant to
# be run interactively, though it's harmless to do so by hand.
#
# The agent is whatever headless CLI DRAIN_AGENT_CMD names — set it in
# .drain.env at the repo root (gitignored) or in the plist's environment.
# The prompt is appended as the command's final argument. Without it, the AI
# chosen in the app's Drain panel (.drain.config.json) is used; with neither,
# Claude Code. See docs/agents/nightly-drain.md.
#
# Stays quiet over a genuinely empty inbox on purpose: the agent is only
# invoked, and .stdout/.stderr/nightly-drain.log only touched, on a night
# there's something in inbox.md — captures to drain or malformed lines to
# report — so a collector reading the log sees signal, not a nightly
# "nothing to report".
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="$REPO_DIR/.scratch/curation-loop/nightly-drain.log"
cd "$REPO_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

if [ -f .drain.env ]; then
  . ./.drain.env
fi

LINE_COUNT=$(node -e '
  const fs = require("fs");
  const { parseInboxLines } = require("./js/curation.js");
  const text = fs.existsSync("inbox.md") ? fs.readFileSync("inbox.md", "utf8") : "";
  const { captures, malformed } = parseInboxLines(text);
  process.stdout.write(String(captures.length + malformed.length));
')

if [ "$LINE_COUNT" -eq 0 ]; then
  exit 0
fi

TIMESTAMP=$(date "+%Y-%m-%d %H:%M %z")

# No DRAIN_AGENT_CMD but an AI chosen in the app's Drain panel: run the same
# drain the panel's button runs, in either of its modes, and log its summary.
if [ -z "${DRAIN_AGENT_CMD:-}" ] && [ -f .drain.config.json ]; then
  OUTPUT=$(node scripts/drain-run.js 2>&1 || true)
  printf '%s\n' "$OUTPUT" >> "$LOG_FILE.stdout"
  # API mode prints a "Summary" block; an agent's own closing report is the
  # tail of its output.
  SUMMARY=$(printf '%s\n' "$OUTPUT" | sed -n '/^Summary$/,$p')
  [ -n "$SUMMARY" ] || SUMMARY=$(printf '%s\n' "$OUTPUT" | tail -n 40)
  printf '## %s\n%s\n\n' "$TIMESTAMP" "$SUMMARY" >> "$LOG_FILE"
  exit 0
fi
DRAIN_AGENT_CMD="${DRAIN_AGENT_CMD:-claude --print --dangerously-skip-permissions}"

PROMPT="$(cat prompts/drain.md)

This is an unattended run: there is no one to ask, so follow docs/agents/drain.md's rules without \
pausing for confirmation. When the pass is done, append one entry to \
.scratch/curation-loop/nightly-drain.log: a '## $TIMESTAMP' heading followed by the same summary \
the Finishing section asks for. Append only; do not touch earlier entries in that file. This \
still applies if inbox.md turns out to hold only malformed lines and no real captures: report them \
and still append a log entry, rather than treating that as nothing to do."

# DRAIN_AGENT_CMD is deliberately word-split: it is a command plus its flags.
# shellcheck disable=SC2086
$DRAIN_AGENT_CMD "$PROMPT" >> "$LOG_FILE.stdout" 2>> "$LOG_FILE.stderr"
