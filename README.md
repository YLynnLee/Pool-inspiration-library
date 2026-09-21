# Inspiration Library

[![Test](https://github.com/YLynnLee/Inspiration-Library/actions/workflows/test.yml/badge.svg)](https://github.com/YLynnLee/Inspiration-Library/actions/workflows/test.yml)

A personal library of web and app design references — a dark-room catalog for one collector.

Each reference captures a site or app whose design is worth returning to: a screenshot, a written analysis, keywords naming specific visual moves, and prompts derived from it (image prompts for generators, reusable briefs for code/page generators). The library exists so you can rediscover and reuse design thinking you've already done, rather than re-deriving it every time.

## What makes it different

Unlike a bookmark manager or moodboard tool, every reference is **analysed at capture time**. Each one carries:

- A **category** from a hand-grown taxonomy, with written style essays and vocabulary lists — the part of this project least available elsewhere.
- **Keywords** — free-form phrases naming specific visual moves (e.g. "scroll-scrubbed decrypt", "acid green accent").
- An **image prompt** — dense visual description written for image generators.
- A **brief** — a reusable style template for code/page generators, opening with a `[YOUR SUBJECT]` placeholder.
- A **design system**, where one was extracted — measured colour, type, spacing and radius tokens plus prose, serialisable to a downloadable `DESIGN.md`.

## How it works

### The curation loop

1. **Capture** — drop a URL (and optionally a note) into `inbox.md`. Capture is deliberately cheap.
2. **Drain** — an agent-run pass empties the inbox: screenshots and harvests each site, analyses the design, writes every field of a reference, assigns or creates a category, extracts a design system, and adds it all to the library.
3. **Browse** — open `index.html` to filter, search, and rediscover references in a dark, dense, scannable grid.
4. **Curate** — delete a reference with the × on its tile; after confirming, its library entry, design system and screenshots are removed for good. Prune and consolidate the taxonomy by hand.

### Architecture

- **Static site** — no build step, no backend, no accounts. An optional local helper (`npm start`) adds the Drain button; browsing never needs it.
- **Runs from `file://`** — classic `<script>` tags only (no `fetch()`, no ES modules).
- **Reads and writes its own data** via the File System Access API — the app writes directly to `data/library.js`, `data/categories.js`, and `inbox.md`.
- **All intelligence is offline** — the app never calls a network or a model. Analysis and prompt writing are done by an AI agent between sessions; screenshot capture and data writes are scripts that agent runs.
- **Bring your own agent** — the drain works with any coding agent that can run a shell, edit files, and see images: Claude Code, Codex, OpenCode, Gemini CLI, Cursor, Pi, or a local vision model behind one of those harnesses. See [Draining with your AI tool](#draining-with-your-ai-tool).

## Project structure

```
├── index.html              # Entry point
├── css/style.css           # Styles (dark-room aesthetic, Fraunces + Inter)
├── js/
│   ├── render.js           # UI rendering (incl. tabbed detail page)
│   ├── curation.js         # Hide, purge, resolve, and DESIGN.md serialisation
│   ├── query.js            # Filtering and search
│   ├── fs-write.js         # File System Access API writes
│   ├── ai-panel.js         # Drain panel (talks to the local helper)
│   └── data-access.js      # Data layer
├── data/
│   ├── library.js          # All references
│   ├── categories.js       # Taxonomy with style essays
│   └── design-systems.js   # Measured design systems, one per reference
├── images/                 # Reference screenshots (WebP)
├── fonts/                  # Fraunces + Inter, bundled (SIL OFL) — no third-party requests
├── scripts/
│   ├── inbox.js            # Drain: list captures, flag duplicates, record fetch failures
│   ├── capture.js          # Drain: headless screenshots + harvest (Playwright)
│   ├── commit.js           # Drain: validate a result and write it to the library, in order
│   ├── harvest-design.js   # In-page design token harvester (colour/type/spacing/radii)
│   ├── server.js           # Local helper: serves the app, runs drains for the Drain panel
│   ├── drain-run.js        # Run a drain from the terminal with the panel's chosen AI
│   ├── ai/                 # Helper internals: config, model API client, both drain modes
│   ├── nightly-drain.sh    # Automated drain script (any agent CLI or the panel's AI)
│   └── *.plist             # macOS launchd schedule
├── docs/
│   ├── adr/                # Architecture decision records
│   └── agents/             # Agent procedures (drain, extract, drain-result, ...)
├── prompts/                # Tool-neutral drain/extract prompts
├── AGENTS.md               # Agent instructions (CLAUDE.md / GEMINI.md import it)
├── .github/workflows/      # CI: runs the test suite on push/PR to main
├── Start Inspiration Library.command / .bat   # Double-click: set up, start helper, open app
├── inbox.md                # Captured URLs awaiting drain
├── CONTEXT.md              # Canonical glossary
├── PRODUCT.md              # Product spec
├── DESIGN.md               # This repo's own design system (colors, type, components)
└── SECURITY.md             # What stays local, what leaves, and how keys are stored
```

## Getting started

1. Double-click **Start Inspiration Library**, or just open `index.html` in a Chromium-based browser to browse (required for File System Access API).
2. Browse the grid, filter by category or keyword.
3. To add a reference, drop a URL into `inbox.md` and run a drain.

## Draining with your AI tool

A drain is split between scripts, which do the mechanics, and your AI, which does the looking and
writing. Your AI never needs browser tools of its own.

### From the app (easiest)

1. Double-click **Start Inspiration Library** in this folder (`.command` on Mac, `.bat` on
   Windows). The first time, it sets itself up (about a minute). If Node.js is missing, it opens
   the free download for you. Mac: if it's blocked as "from an unidentified developer",
   right-click it and choose **Open** once.
2. The library opens in your browser. Click **Connect AI** and pick yours by name: **Claude,
   ChatGPT, Gemini, OpenCode, Pi, Hermes, OpenRouter, Ollama, LM Studio**, or **Something
   else**. Each one opens its own short guide:
   - **Use your subscription** (Claude, ChatGPT, Gemini and the agent apps): **Install** the
     tool's free app, **Log in** with your account, **Connect**. The Install and Log in buttons
     open a small Terminal window running that tool's official command, and sign-in finishes in
     your browser. Steps already done on your computer are ticked off.
   - **Use an API key:** a **Get a key** link, a field to paste it into, then a list of that
     key's models to pick from.
   - **Run it on this computer** (Ollama, LM Studio): a download link, one-click download of a
     model that can see images, then pick it.

   Connecting checks the AI answers (and, for models, that it can see images), then shows it in
   the header.
3. Press **Drain**. Progress streams live, and new references appear when it's done.

**After the first time, you don't need step 1.** The first start also teaches your computer an
`inspiration-library://` link. From then on, opening `index.html` and clicking **Connect AI** starts
everything by itself. Your browser asks once whether to open "Inspiration Library Helper"; choose
**Open** and tick **Always allow**. The helper then keeps running in the background.

If you started it by double-clicking, keep that window open while you drain. Your choice is saved in
`.drain.config.json` (gitignored). An API key is never written there: it goes into your system's
secret store (the Keychain on a Mac), is never sent to the browser, and is only ever sent to the
provider it was saved for, over https. The helper only listens on `127.0.0.1`. From a terminal, `npm start` and `npm run drain` do the same things.

### From your agent

**Whatever AI you connect must be able to see images.** It reads screenshots to write the
analysis, so text-only models can't drain. For a local model, use a vision one (e.g. Qwen-VL,
Gemma 3, Llama 3.2 Vision).

**Run it:**

| Tool | How |
| --- | --- |
| Claude Code | `/drain` or `/drain <url>` |
| OpenCode | `/drain` |
| Gemini CLI | `/drain` |
| Codex, Cursor, Pi, anything reading `AGENTS.md` | "drain the inbox" |
| Anything else | paste [`prompts/drain.md`](prompts/drain.md) |

Under the hood every one of those runs the same three commands:

```bash
node scripts/inbox.js                  # what's waiting, duplicates flagged
node scripts/capture.js <url>          # screenshots + design-token harvest
node scripts/commit.js result.json     # validate, lint, write to the library
```

Setup for this route: Node 20+, then `npm install` (and `npx playwright install chromium` only if
Google Chrome isn't installed). The agent writes `result.json`
([format](docs/agents/drain-result.md)) between the last two.
`commit.js` refuses incomplete or inconsistent results, so a weaker model fails loudly instead of
corrupting the library. The full procedure is [`docs/agents/drain.md`](docs/agents/drain.md);
unattended nightly runs with any agent CLI are in
[`docs/agents/nightly-drain.md`](docs/agents/nightly-drain.md).

## Design

The visual system follows a **"Dark Room Contact Sheet"** metaphor: near-black gallery walls, high-density tiles, and a single acid-lime accent (`#d8fb3c`) that appears only at the moment of interaction — an active filter, a focused input, a hovered link — and stays absent everywhere else.

- **Fonts:** Fraunces (serif italic, titles only) + Inter (everything else)
- **Palette:** void black `#0a0a0b` → raised panel `#141416` → paper white `#ece9e2`
- **Accent:** acid lime for active states, draft amber `#f5a623` for parked references

See [DESIGN.md](DESIGN.md) for the full design system.

## Privacy & security

Everything runs on your machine: no server, no accounts, no telemetry. The helper listens on
`127.0.0.1` only, API keys live in your OS keychain, and nothing leaves the machine except the
sites you capture and the AI you connect. See [SECURITY.md](SECURITY.md), including the one real
risk: agent presets that run with permission prompts off.

## Tests

```bash
npm test
```

CI runs this automatically on every push and pull request to `main` (see `.github/workflows/test.yml`).

## License

Code is [MIT](LICENSE). Fonts in `fonts/` are under the SIL Open Font License (see the
`*-OFL.txt` files there). Screenshots in `images/` show third-party websites and are included
only as an example reference; they belong to their owners.
