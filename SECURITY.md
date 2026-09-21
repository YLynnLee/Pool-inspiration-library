# Security & privacy

Inspiration Library runs entirely on your machine. There is no server, no account, no telemetry.

## What stays local

- **Your library** — `data/`, `images/` and `inbox.md` are plain files in this folder.
- **The helper** (`npm start`) listens on `127.0.0.1` only, so nothing else on your network can
  reach it. Every API request must carry the helper's own `Host` header (blocks DNS rebinding),
  and every write must come from the helper's own `Origin` with a JSON content type (blocks other
  websites posting to it). It serves only `index.html`, `css/`, `js/`, `data/`, `images/` and
  `fonts/` — never dotfiles or config.
- **API keys** go to your OS secret store (macOS Keychain, Windows DPAPI, Linux Secret Service),
  passed on stdin so they never appear in a process list. `.drain.config.json` records only
  *which* AI you chose and is gitignored. See `scripts/ai/secrets.js`.
- **Fonts** are bundled in `fonts/`; opening the library makes no third-party requests.

## What leaves your machine, and only when you ask

- **Capturing** a reference loads that website in a headless browser, like visiting it.
- **Draining** sends screenshots and page text to the AI you connected. Choose a local model
  (Ollama, LM Studio) if you want nothing to leave the machine.

## The one real risk: agents with permission prompts off

The agent presets (`claude --dangerously-skip-permissions`, `codex --dangerously-bypass-…`,
`gemini --yolo`, …) run unattended, so they can't stop to ask before running a command. During a
drain the agent reads text from websites you captured, and a hostile page could try to instruct it
(prompt injection). Mitigations:

- Only capture sites you'd be comfortable visiting.
- Prefer an **API provider** over an agent app: API drains only return JSON that
  `scripts/commit.js` validates — the model can't run commands.
- Or edit the agent command in **Connect AI** to drop the skip-permissions flag and drain
  interactively instead.

## Reporting a vulnerability

Please open a [private security advisory](../../security/advisories/new) on this repository rather
than a public issue.
