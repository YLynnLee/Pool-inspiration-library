# 0006 — The drain runs on any agent: scripts do the mechanics, the model does the looking

## Status

Accepted. Amends `docs/adr/0003-launchd-scheduling.md`'s invocation (the scheduled job no longer
hard-codes `claude`) and moves the capture recipe `docs/adr/0004-drains-always-resolve.md`
introduced from prose into `scripts/capture.js`, unchanged in intent.

## Context

The library is going public as a tool anyone can download, and people should be able to drain
with whichever agent they already use: Claude Code, Codex, OpenCode, Gemini CLI, Pi, Hermes, a
local model. The procedures in `docs/agents/` were already plain English any capable agent could
follow, but four things tied a drain to Claude Code in practice:

1. **Entry points.** `CLAUDE.md` and `.claude/commands/` are read only by Claude Code.
2. **A browser the agent drives itself.** Capture assumed the agent could navigate, inject CSS,
   wheel-scroll, screenshot and inject the harvest script, via Claude in Chrome or an MCP browser.
   Most other harnesses have no browser, and local-model setups almost never do.
3. **Hand-written data files.** The agent edited `data/*.js` through the serialisers and was
   trusted to keep the four-file write order. Strong models managed; weaker ones would corrupt the
   files the app loads.
4. **The nightly job** called `claude --print --dangerously-skip-permissions` directly. (Its
   prompt also still told the agent to park uncertain categories, contradicting 0004.)

## Decision

**Split a drain at the line between judgement and mechanics.** Everything that doesn't need a model
is a script; the agent's whole job is looking at frames and writing one JSON result per capture.

- `scripts/inbox.js` lists captures with duplicates flagged, and handles skip and fetch-failure
  bookkeeping.
- `scripts/capture.js` is the fixed capture recipe in headless Chromium via Playwright: overlay
  suppression, step-scroll pass, up to five content-framed shots, dead-space check, harvest. The
  recipe was already a fixed sequence, not exploration (0004), so it was always script-shaped.
  It uses Playwright's bundled Chromium if installed, else the collector's Chrome or Edge, so no
  browser download is needed on most machines.
- `scripts/commit.js` validates a result (`docs/agents/drain-result.md`), lints its DESIGN.md,
  and writes screenshots, category, reference, design system and inbox line in 0004/0005's order.
  The crash-consistency invariant is now enforced by code rather than by instruction.
- `AGENTS.md` is the canonical instructions file. `CLAUDE.md` and `GEMINI.md` import it.
  `prompts/drain.md` is the one drain prompt, and `.claude/`, `.opencode/` and `.gemini/` command
  files are thin wrappers around it. Anything else can have it pasted in.
- `scripts/nightly-drain.sh` runs `DRAIN_AGENT_CMD` (default Claude Code) with the prompt as its
  final argument.

**Agent-agnostic, not model-agnostic.** The drain still needs an agent harness with a shell and
file access. A bare model behind an API (no harness) is out of scope for now; a small runner that
talks to any OpenAI-compatible endpoint was considered and deferred.

## Consequences

**The model must be able to see images.** Analysis, the image prompt and colour roles all come
from reading the screenshots against the harvest; `harvest.json` has numbers but no meaning. A
text-only local model cannot run a drain properly. This is a real floor, stated in `AGENTS.md`.

**New runtime dependencies for draining.** Playwright (a devDependency) and Python + Pillow, which
the dead-space check already needed. The app itself still has no dependencies and no build step;
only draining needs them.

**Less adaptive capture.** An agent driving its own browser could improvise around a strange site.
The script can't, so it exposes knobs instead (`--hide`, `--click`, `--wait`, `--headed`) and the
agent still judges every frame, with a two-re-run budget before parking. Sites that defeat all of
that park as capture-failure drafts, which is what 0004 already specified.

**Validation catches weak-model output before it lands.** Placeholders, missing fields, a
`[YOUR SUBJECT]`-less brief, an unknown category, a new category with no rejected neighbour, or a
design system that neither declares nor omits components are all refused, with a message the agent
can act on. This is a floor on completeness, not on quality. The prose is still only as good as
the model writing it.
