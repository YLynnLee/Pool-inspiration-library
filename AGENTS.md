# Pool

A personal library of web/app design references. Static site, no build step, no backend.

This file is the instructions every coding agent reads — Claude Code (via `CLAUDE.md`), Codex,
OpenCode, Gemini CLI (via `GEMINI.md`), Cursor, Pi and anything else that honours `AGENTS.md`.
Nothing in this repo depends on a particular agent.

## Draining the inbox

"Drain the inbox" means running the procedure at `docs/agents/drain.md`: for each captured line
in `inbox.md`, dedupe, capture (screenshots + harvest), analyse, write every field of a reference,
assign it an existing category or create one when nothing genuinely fits, extract a design system
per `docs/agents/extract.md`, and commit it all to the library. A drain always resolves — it only
parks a capture as a draft when the site itself could not be captured usefully.

The mechanical half is three scripts; the agent's half is looking at the frames and writing one
JSON result per capture (`docs/agents/drain-result.md`):

```
node scripts/inbox.js                 # what's in the inbox, duplicates flagged
node scripts/capture.js <url>         # screenshots + harvest, headless browser
node scripts/commit.js <result.json>  # validate, lint, write in order, strike the line
```

Requirements: shell access, file read/write, and a model that can see images. No browser tools
needed. First run: `npm install` (plus `npx playwright install chromium` only if Google Chrome
isn't installed). Node is the only prerequisite.

Entry points, all thin wrappers around the same procedure:

- Claude Code: `/drain`, `/drain <url>`, `/extract <id|url>` (`.claude/commands/`)
- OpenCode: `/drain`, `/extract` (`.opencode/commands/`)
- Gemini CLI: `/drain`, `/extract` (`.gemini/commands/`)
- Anything else: paste `prompts/drain.md` or `prompts/extract.md`, or just say "drain the inbox".

### From the app

Double-clicking "Start Pool" (`.command` on macOS, `.bat` on Windows; both run
`scripts/start.sh`-style setup, then `scripts/server.js`) starts a local helper and opens the
library at `http://localhost:4747`. After that first start, **Connect AI** on the plain
`index.html` page starts the helper itself through an `pool://` link the launcher
registers (`scripts/register-url-handler.sh`). **Connect AI** detects installed agent apps and running local
model servers and offers API-key providers. Once one passes its connection test, **Drain** just
runs. It works with an agent app (the CLIs above, or any command) or a model API (Anthropic,
OpenAI, Gemini, OpenRouter, Ollama, LM Studio, any OpenAI-compatible server). The choice is saved to `.drain.config.json` (gitignored; API keys go
to the OS secret store, not this file — `scripts/ai/secrets.js`), and `node scripts/drain-run.js` runs the same drain from a terminal. See
`SECURITY.md`.

Every drain is started by hand — from `/drain`, the app's Drain button, or `node scripts/drain-run.js`.
There is no scheduled or unattended mode.
