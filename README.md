# Pool

[![Test](https://github.com/YLynnLee/Pool/actions/workflows/test.yml/badge.svg)](https://github.com/YLynnLee/Pool/actions/workflows/test.yml)

**A personal library of web and app design references that runs entirely on your computer.**

Paste a link to a site whose design you like. Your AI screenshots it, studies it, and files it in
your library with a written analysis, keywords, a measured design system, and prompts you can reuse.
No account, no cloud, no subscription to Pool itself. It's just a folder of files.

---

## Contents

- [What you get](#what-you-get)
- [Quick start](#quick-start)
- [Setting up](#setting-up)
- [Using the library](#using-the-library)
- [Connecting your AI](#connecting-your-ai)
  - [Option A: in the app](#option-a-in-the-app-easiest)
  - [Option B: from a terminal](#option-b-from-a-terminal)
- [Draining the inbox](#draining-the-inbox)
- [Good to know](#good-to-know)
- [Troubleshooting](#troubleshooting)
- [For developers](#for-developers)

---

## What you get

A bookmark only saves a link. Every reference in Pool is **analysed when you add it**, so each one
comes with:

| | |
| --- | --- |
| **Screenshots** | Captured automatically in a headless browser. |
| **Category** | Picked from your own taxonomy, which grows as you add references. Each category has a written style essay and vocabulary. |
| **Keywords** | Short phrases naming specific visual moves, like "scroll-scrubbed decrypt" or "acid green accent". Searchable. |
| **Design system** | Colours, type, spacing and radii measured from the live site, plus notes on its character. Download or copy it as a `DESIGN.md`. |
| **Image prompt** | A dense visual description to paste into an image generator. |
| **Brief** | A reusable style template for page or code generators, starting with a `[YOUR SUBJECT]` placeholder. |

The point is to keep design thinking you've already done and reuse it, instead of starting from
scratch every time.

---

## Quick start

1. **Download** this repo and unzip it somewhere permanent, such as `Documents/Pool`.
2. **Double-click `Start Pool`** (`Start Pool.command` on Mac, `Start Pool.bat` on Windows). The
   first run sets itself up in about a minute, then opens the library in your browser.
3. Click **Connect AI** (top right), pick the AI you use, and follow its short guide.
4. Open **Inbox**, paste a link, then press **Drain**.

Details for each step are below.

---

## Setting up

### What you need

- **A computer running macOS, Windows or Linux.**
- **[Node.js](https://nodejs.org/en/download) 20 or newer.** It's free. If it's missing, `Start Pool`
  opens the download page for you. Install it, then double-click `Start Pool` again.
- **A Chromium-based browser** such as Chrome, Edge, Arc or Brave. Pool writes to its own files
  through a browser feature that Safari and Firefox don't support yet.
- **An AI that can see images** (see [Connecting your AI](#connecting-your-ai)). You only need this
  to add references. Browsing works without one.

### 1. Get the files

Either:

- On GitHub, click **Code → Download ZIP**, then unzip it. **or**
- In a terminal: `git clone https://github.com/YLynnLee/Pool.git`

Put the folder somewhere it will stay. If you move it later, double-click `Start Pool` once more so
your computer learns the new location.

### 2. Start Pool for the first time

Double-click **`Start Pool`** inside the folder.

- **Mac:** the first time, macOS may say it's "from an unidentified developer". Right-click the
  file and choose **Open**. On newer macOS, go to **System Settings → Privacy & Security** and
  click **Open Anyway**. You only need to do this once.
- **Windows:** double-click `Start Pool.bat`. If SmartScreen appears, click **More info → Run
  anyway**.
- **Linux:** there's no double-click launcher. Run `sh scripts/start.sh` from the folder.

A small window opens and prints `First run: setting up (about a minute)…`. It installs the one
dependency Pool needs (Playwright, used to take screenshots). After that your browser opens
**`http://localhost:4747`**, which is your library.

> **Keep that window open while you use Pool.** It's the local "helper" that lets the page talk to
> your AI. Closing it only turns off Connect AI and Drain. Browsing still works.

### 3. After the first time

You don't need to double-click `Start Pool` again. The first run registered a `pool://` link on your
computer, so from then on:

1. Open **`index.html`** in the Pool folder. Bookmarking it is handy.
2. Click **Connect AI**. The page starts the helper by itself.
3. Your browser asks once whether to open **"Pool Helper"**. Tick **Always allow** and choose
   **Open**.

The helper then runs quietly in the background, with no window to keep open.

---

## Using the library

### Browsing

- **Search** with the box at the top. Press **`/`** from anywhere to jump to it. Search covers
  names, keywords and categories.
- **Filter** with the category pills under the header. The row scrolls sideways when there are
  many categories.
- **Click a tile** to open a reference. It has three tabs:
  - **Breakdown:** keywords, palette, type, spacing, and the written character of the design.
  - **DESIGN.md:** the design system as a document, with **Download .md** and **Copy .md**
    buttons. Only shown when a design system was extracted.
  - **Prompts:** the image prompt and the brief, each with a **Copy** button.
- **All / Drafts / Hidden** switches appear above the grid when you have drafts or hidden
  references. A **draft** (amber, dashed border) is a capture the AI couldn't finish properly, for
  example a site that blocked the screenshot. Hover its tile and click **Resolve…** to give it a
  category and file it anyway.

### Adding a reference

Any of these adds a link to your inbox:

- Click **Inbox** in the header, paste a link (or several), optionally click **+ Add a note** with
  what caught your eye, then press **Add**.
- **Paste a link anywhere on the page.** It goes straight into the inbox.
- Add a line to **`inbox.md`** in the folder yourself: `- https://example.com — optional note`.

Adding is quick and free. Nothing is analysed until you **drain**.

> If you opened `index.html` directly instead of through the helper, the first time you add a link
> the browser asks you to choose a folder. Pick the **Pool folder**. That lets the page write to
> `inbox.md`, and it only asks once per session.

### Removing a reference

Hover a tile and click **×**. After you confirm, its library entry, design system and screenshots
are **deleted from the folder for good**. See [Good to know](#good-to-know) about backups.

---

## Connecting your AI

Pool doesn't include an AI. You connect the one you already use, and it does the looking and
writing. **There are two ways to do it, and they produce the same result.** Choose whichever suits
you.

| | **Option A: in the app** | **Option B: from a terminal** |
| --- | --- | --- |
| Best for | Most people | People who already use a coding agent |
| You click / type | **Connect AI**, then follow the guide | `/drain` in your agent, or `npm run drain` |
| Works with | Subscriptions, API keys, local models | Any agent that can run commands and see images |

### Which AI can I use?

**It must be able to see images**, because it reads screenshots to write the analysis. Text-only
models can't drain.

| You have… | Pick in Connect AI | How it connects |
| --- | --- | --- |
| A Claude Pro / Max / Team plan | **Claude** → *Use my Claude subscription* | Through Claude Code |
| A ChatGPT Plus / Pro / Business plan | **ChatGPT** → *Use my ChatGPT subscription* | Through Codex |
| A Google account | **Gemini** → *Use my Google account* | Through Antigravity CLI |
| An API key (Anthropic, OpenAI, Google) | **Claude / ChatGPT / Gemini** → *Use an API key* | Directly, pay per use |
| One key for many models | **OpenRouter** | API key |
| Nothing, and you want it free and private | **Ollama** or **LM Studio** | A model running on your own computer |
| OpenCode, Pi or Hermes | **OpenCode / Pi / Hermes** | Through that app |
| Anything else | **Something else** | Any command-line agent, or any OpenAI-compatible server |

### Option A: in the app (easiest)

1. Click **Connect AI** in the header.
   - If you see **"One-time setup: start Pool"**, the helper isn't running yet. Follow the three
     numbered steps: open the Pool folder, double-click `Start Pool`, and come back. The page
     notices when it's ready and continues by itself.
2. **Pick your AI** from the grid. Tags show what Pool already found on your computer:
   **Installed**, **Running**, **Key found** or **Connected**.
3. **Follow its guide.** Steps that are already done get a ✓. There are three kinds of guide:

   **Use your subscription** (Claude, ChatGPT, Gemini, OpenCode, Pi, Hermes)
   1. **Install**: click **Install *app*** and a Terminal window runs the tool's official
      installer. When it finishes, close it and click **Check again**. (The exact command is shown
      too, if you'd rather run it yourself.)
   2. **Log in**: click **Log in to *app***. A Terminal window opens and you sign in through your
      browser. Skip this step if you're already logged in.
   3. **Connect**: click **Connect**. Pool checks that the app answers, which can take up to a
      minute.

   **Use an API key**
   1. **Get an API key**: the **Get a key ↗** link opens the right page in your provider's
      account.
   2. **Paste it and pick a model**: paste the key, click **Continue**, choose a model from the
      list, then click **Connect**. Pool checks the model can see images.

   **Run it on this computer** (Ollama, LM Studio)
   1. **Install and open** the app using the download link, then **Check again**.
   2. **Get a model that can see images**. For Ollama, click one of the suggested models
      (`qwen2.5vl`, `gemma3`, `llama3.2-vision`, a few GB each). For LM Studio, download a vision
      model in the app, load it, and turn on the local server in the **Developer** tab.
   3. **Choose it and connect**.

4. You'll see **"Connected to …"**. If links are waiting, click **Drain N captures now**.

From now on the header shows your AI's name with a lit dot. Click it to **Switch AI…** or
**Disconnect**. Disconnecting never touches your library, inbox or saved keys.

### Option B: from a terminal

Use this if you already work in a terminal or a coding agent. Open the Pool folder in a terminal
first:

```bash
cd path/to/Pool      # e.g. cd ~/Documents/Pool
npm install          # first time only
```

(On a Mac you can also right-click the folder in Finder and choose **New Terminal at Folder**.)

#### B1. Let your coding agent drain it

Start your agent **inside the Pool folder**. It reads `AGENTS.md` (or `CLAUDE.md` / `GEMINI.md`) and
knows what to do.

| Agent | Run it, then type |
| --- | --- |
| Claude Code | `claude`, then `/drain` (or `/drain <url>` for one link) |
| OpenCode | `opencode`, then `/drain` |
| Gemini CLI | `gemini`, then `/drain` |
| Codex, Cursor, Pi, or anything that reads `AGENTS.md` | "drain the inbox" |
| Anything else | paste the contents of [`prompts/drain.md`](prompts/drain.md) |

You watch it work and can approve each step, so this is also the most cautious way to drain (see
[the one real risk](#the-one-real-risk)).

To extract or refresh the design system for one existing reference: `/extract <id or url>`.

#### B2. Use the AI you connected in the app

If you've already connected an AI through **Connect AI**, the terminal uses the same one:

```bash
npm start                    # start the helper and open the library (same as Start Pool)
npm run drain                # drain the whole inbox with your connected AI
npm run drain -- <url>       # drain just one link
npm run drain -- --test      # check your connected AI answers
```

---

## Draining the inbox

**Draining** turns the links in your inbox into finished references.

1. Open **Inbox** in the header. It lists what's waiting and marks links **Already in library**
   (these just get cleared) or **Last try failed**.
2. Press **Drain N captures**. The line underneath tells you which AI will be used and what to
   expect.
3. Progress streams live, and you can close the drawer because it keeps running. Open **Full log**
   to see every step.
4. When it's done, click **Show new references**.

For each link, Pool:

1. Opens the site in a hidden browser, takes screenshots, and measures its colours, fonts and
   spacing.
2. Sends the screenshots and page text to your AI, which writes the analysis, keywords, prompts
   and design system, and picks a category or creates a new one.
3. **Checks the result.** Incomplete or inconsistent answers are rejected rather than saved, so a
   weaker model fails visibly instead of filling your library with junk.
4. Saves it to the library and removes the line from the inbox.

**Timing and cost:** allow a few minutes per link. It uses your subscription allowance or API
credit, and local models cost nothing. You can **stop at any time**, and anything already finished
stays saved.

Every drain is started by you. Nothing runs on a schedule or in the background without you.

---

## Good to know

### Your library is just files

Everything lives in the folder: `data/` (library, categories, design systems), `images/`
(screenshots) and `inbox.md`. There's no database and no account. To back up, copy the folder or
commit it with git. **Deleting a reference is permanent** unless you have a backup or a git commit
to restore it from.

### Privacy

- Pool makes **no network requests of its own**, has no telemetry, and bundles its fonts.
- The helper only listens on your own computer (`127.0.0.1`).
- **What leaves your computer, and only when you drain:** the site you're capturing is visited,
  just as if you opened it, and the screenshots and page text go to the AI you connected. Choose
  **Ollama** or **LM Studio** if you want nothing to leave your computer.
- **API keys** are stored in your system's secret store (the Keychain on a Mac, DPAPI on Windows,
  Secret Service on Linux). They are never written into the folder, never sent to the browser, and
  only ever sent to their own provider over https. `.drain.config.json` only records *which* AI you
  picked, and it's gitignored.

Full details are in [SECURITY.md](SECURITY.md).

### The one real risk

When you connect an **agent app** (Claude Code, Codex, Antigravity…) in the app, it runs with its
permission prompts turned off so it can work unattended. During a drain it reads text from the
websites you captured, and a hostile page could try to give it instructions (prompt injection). To
stay safe:

- Only capture sites you'd be comfortable visiting.
- Prefer an **API key** connection. API drains can only return text, which Pool validates, so the
  model can't run commands.
- Or drain from a terminal ([Option B1](#b1-let-your-coding-agent-drain-it)) and approve each step
  yourself.

### Other things worth knowing

- **Screenshots belong to the sites' owners.** Pool is for private reference. Think before
  publishing a library full of other people's work.
- **Some sites won't cooperate.** Pages behind logins, bot walls or heavy consent pop-ups may
  capture badly. Those come back as **drafts** rather than being silently dropped.
- **You shape the taxonomy.** The AI reuses your categories when one fits and only creates a new
  one when nothing does. Rename, merge and prune them by hand whenever you like.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| **"One-time setup: start Pool"** keeps showing | The `pool://` link isn't registered yet. Double-click `Start Pool` once by hand. |
| Mac says `Start Pool` is from an unidentified developer | Right-click → **Open**, or **System Settings → Privacy & Security → Open Anyway**. |
| "Pool needs Node.js" | Install Node.js 20+ from [nodejs.org](https://nodejs.org/en/download), then start Pool again. |
| "Can't reach the library helper" | The helper stopped. Double-click `Start Pool`, or click **Connect AI** to start it in the background. |
| Adding a link says the browser can't write files | Use Chrome, Edge, Arc or Brave, not Safari or Firefox. |
| An agent app shows as not installed right after installing | Click **Check again**. If it still isn't found, quit and restart the helper. |
| Connecting a model fails the image check | That model can't see images. Pick a vision model. |
| A link shows **Last try failed** | The site couldn't be captured. Drain again later, or remove it from the inbox. |
| The helper's background log | `.helper/helper.log` in the Pool folder. |
| Screenshots fail and Chrome isn't installed | Run `npx playwright install chromium` once. |

Still stuck? [Open an issue](https://github.com/YLynnLee/Pool/issues).

---

## For developers

### How it's built

- **Static site, no build step, no framework.** Open `index.html` and it runs, even from
  `file://`. That's why it uses classic `<script>` tags, and no `fetch()` or ES modules in `js/`.
- **The page never calls a model.** All the intelligence lives in the drain, which is split
  between three scripts (the mechanics) and your AI (looking at screenshots and writing):

  ```bash
  node scripts/inbox.js                  # what's waiting, duplicates flagged
  node scripts/capture.js <url>          # screenshots + design-token harvest (Playwright)
  node scripts/commit.js result.json     # validate, lint, write to the library in order
  ```

  The AI writes `result.json` ([format](docs/agents/drain-result.md)) between the last two. The
  full procedure is [`docs/agents/drain.md`](docs/agents/drain.md). Because of this split, any
  agent that can run a shell, edit files and see images can drain. No browser tools are needed.
- **An optional local helper** (`scripts/server.js`) serves the app on `127.0.0.1:4747` and runs
  drains for the Drain button, with either an agent app or a model API.
- **Writes are safe to run concurrently.** Saves are atomic and the library is locked during a
  commit.

### Project structure

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
│   ├── harvest-design.js      # In-page colour/type/spacing/radius harvester
│   ├── server.js              # Local helper
│   ├── drain-run.js           # `npm run drain`
│   ├── start.sh               # What Start Pool runs: setup, register pool://, start helper
│   ├── register-url-handler.sh# Registers the pool:// link (macOS/Linux)
│   ├── atomic-write.js, lock.js
│   └── ai/                    # Provider catalog, config, secrets, agent + API drain modes
├── docs/agents/               # Agent procedures: drain, extract, result format
├── prompts/                   # Tool-neutral drain/extract prompts to paste
├── .claude/ .opencode/ .gemini/   # /drain and /extract commands per agent
├── AGENTS.md                  # Agent instructions (CLAUDE.md / GEMINI.md import it)
├── Start Pool.command / .bat  # Double-click launchers
├── inbox.md                   # Captured links awaiting a drain
├── CONTEXT.md                 # Glossary of the project's terms
├── DESIGN.md                  # Pool's own design system
└── SECURITY.md                # What stays local, what leaves, how keys are stored
```

### Design

Pool's own interface follows **"The Midnight Gallery"**: a near-black, near-monochrome room
(obsidian → graphite → steel) where the only accent is white itself, used for whatever you're
deciding on. Chrome carries no colour, so the colour on screen comes from the references. Titles are
set in Fraunces italic, body text in Inter, and every label, count and badge in tracked uppercase
monospace. Draft amber is reserved for parked references. See [DESIGN.md](DESIGN.md).

### Tests

```bash
npm test
```

The suite needs no browser. CI runs it on every push and pull request to `main`. See
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

---

## License

Code is [MIT](LICENSE). Fonts in `fonts/` are under the SIL Open Font License (see the
`*-OFL.txt` files there). Screenshots in `images/` show third-party websites, are included only as
an example reference, and belong to their owners.
