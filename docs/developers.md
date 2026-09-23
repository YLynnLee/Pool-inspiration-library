# For developers

How Pool is built, and what lives where.

## How it's built

- **Static site, no build step, no framework.** Open `index.html` and it runs, even from
  `file://`. That's why it uses classic `<script>` tags, and no `fetch()` or ES modules in `js/`.
- **The page never calls a model.** All the intelligence lives in the drain, which is split
  between three scripts (the mechanics) and your AI (looking at screenshots and writing):

  ```bash
  node scripts/inbox.js                  # what's waiting, duplicates flagged
  node scripts/capture.js <url>          # screenshots + design-token harvest (Playwright)
  node scripts/commit.js result.json     # validate, lint, write to the library in order
  ```

  The AI writes `result.json` ([format](agents/drain-result.md)) between the last two. The
  full procedure is [`agents/drain.md`](agents/drain.md). Because of this split, any
  agent that can run a shell, edit files and see images can drain. No browser tools are needed.
- **An optional local helper** (`scripts/server.js`) serves the app on `127.0.0.1:4747` and runs
  drains for the Drain button, with either an agent app or a model API.
- **Writes are safe to run concurrently.** Saves are atomic and the library is locked during a
  commit.

## Project structure

```
├── index.html                 # Entry point
├── css/style.css              # Styles (see DESIGN.md)
├── js/
│   ├── render.js              # Grid, filters, detail page tabs
│   ├── ai-panel.js            # Connect AI + drain state (talks to the helper)
│   ├── inbox-panel.js         # Inbox drawer: add links, start and watch drains
│   ├── curation.js            # Hide, delete, resolve drafts, DESIGN.md serialisation
│   ├── query.js               # Filtering and search
│   ├── fs-write.js            # File System Access API writes (for file://)
│   ├── ui.js                  # Shared UI helpers: popovers, toasts, icons
│   └── data-access.js         # Data layer
├── data/
│   ├── library.js             # All references
│   ├── categories.js          # Taxonomy with style essays
│   └── design-systems.js      # Measured design systems, one per reference
├── images/                    # Reference screenshots (WebP)
├── fonts/                     # Fraunces + Inter, bundled (SIL OFL)
├── scripts/
│   ├── inbox.js / capture.js / commit.js   # The three drain steps
│   ├── drain-lib.js           # Pure helpers behind the three drain steps
│   ├── harvest-design.js      # In-page colour/type/spacing/radius harvester
│   ├── server.js              # Local helper
│   ├── drain-run.js           # `npm run drain`
│   ├── start.sh               # What Start Pool runs: setup, register pool://, start helper
│   ├── register-url-handler.sh # Registers the pool:// link (macOS/Linux)
│   ├── start-background.cmd   # What the pool:// link runs on Windows (no window)
│   ├── atomic-write.js, lock.js
│   └── ai/                    # Provider catalog, config, secrets, agent + API drain modes
├── docs/
│   ├── setup.md               # Install and first run
│   ├── troubleshooting.md     # When something doesn't work
│   ├── developers.md          # This file
│   └── agents/                # Agent procedures: drain, extract, result format
├── prompts/                   # Tool-neutral drain/extract prompts to paste
├── .claude/ .opencode/ .gemini/   # /drain and /extract commands per agent
├── AGENTS.md                  # Agent instructions (CLAUDE.md / GEMINI.md import it)
├── Start Pool.command / .bat  # Double-click launchers
├── inbox.md                   # Captured links awaiting a drain
├── CONTEXT.md                 # Glossary of the project's terms
├── DESIGN.md                  # Pool's own design system
└── SECURITY.md                # What stays local, what leaves, how keys are stored
```

## Design

Pool's own interface follows **"The Midnight Gallery"**: a near-black, near-monochrome room
(obsidian → graphite → steel) where the only accent is white itself, used for whatever you're
deciding on. Chrome carries no colour, so the colour on screen comes from the references. Titles are
set in Fraunces italic, body text in Inter, and every label, count and badge in tracked uppercase
monospace. Draft amber is reserved for parked references. See [DESIGN.md](../DESIGN.md).

## Tests

```bash
npm test
```

The suite needs no browser. CI runs it on every push and pull request to `main`. See
[CONTRIBUTING.md](../CONTRIBUTING.md) before opening a PR.

---

Back to the [README](../README.md).
