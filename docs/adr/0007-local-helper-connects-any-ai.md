# 0007 — A local helper lets the app connect any AI, by agent CLI or model API

## Status

Accepted. Builds on `docs/adr/0006-agent-agnostic-drain.md`. Narrows two rules without reversing
them: the app still runs from `file://` for browsing, and the page itself still never calls a
model (`CONTEXT.md`, **The app**).

## Context

After 0006 a drain could run under any agent, but only from that agent's own terminal. The library
is going public as a tool, and the collector (and anyone who downloads it) wants to connect
whichever AI they prefer from the app itself and press Drain. That's a person with a Claude or
ChatGPT subscription and an agent CLI, or a person with only an API key, or a person running a
local model in Ollama or LM Studio.

A page opened from `file://` can't do this alone. It can't launch Playwright, run `node`, or start
an agent CLI, and it should not hold API keys.

## Decision

**A local helper, `scripts/server.js` (`npm start`).** It serves the app on `127.0.0.1` and gives
it a small API: read and save which AI to use, test the connection, start and stop a drain, and
stream its log (server-sent events). The Drain panel (`js/ai-panel.js`) is a thin client of that
API. Opened from `file://`, the panel explains how to start the helper and links to it once it's
running.

**Two modes, one config** (`scripts/ai/config.js`, saved to `.drain.config.json`, gitignored):

**API keys never touch the library folder.** The folder is often synced (iCloud Desktop, Dropbox)
or zipped and shared, so `.drain.config.json` records only which provider and server a key was
saved for. The key itself goes to the operating system's secret store (`scripts/ai/secrets.js`):
the macOS Keychain, a DPAPI-encrypted file on Windows, the Secret Service on Linux, else a 0600
file in the user's config directory. Keys reach those tools on stdin, never argv. A saved key is
only used with the server it was saved for (changing the base URL drops it), is never sent over
plain http except to this computer, and is masked if a provider quotes it back in an error. A key
written into the file by an older version is moved into the store on first load.

- **Agent app.** The helper runs a headless agent CLI with `prompts/drain.md` as its last
  argument. Presets cover Claude Code, Codex, Antigravity CLI, OpenCode, Pi and Hermes. The command is
  editable, and anything else can be typed in. The agent uses its own login, tools and model. This
  is the nightly job's mechanism (0003/0006), now reachable from the UI.
- **Model API.** The helper runs the drain itself (`scripts/ai/api-drain.js`): it lists the inbox,
  captures, sends the frames and harvest to the model with the procedure docs as instructions, and
  takes back one JSON result. It dry-run commits the result, returns any problems to the model for
  up to two repair rounds, then commits. Two wire protocols cover every provider: Anthropic
  Messages and OpenAI-compatible chat completions (OpenAI, Gemini's compatibility endpoint,
  OpenRouter, Ollama, LM Studio, any other compatible server). No SDKs are used.

Both modes write through the same `commit.js`, so the library can't tell which mode produced a
reference. `scripts/drain-run.js` runs either mode from a terminal, and the nightly job uses it
when an AI has been chosen in the panel.

**The helper is guarded as what it is:** a local process that can launch an agent with write
access to the repo.

- It listens on `127.0.0.1` only.
- Every API request must carry the helper's own `Host` (defeats DNS rebinding).
- Every POST must carry the helper's own `Origin` and a JSON content type (defeats another site
  posting to it).
- Static serving is an allowlist (`index.html`, `css/`, `js/`, `data/`, `images/`, no dotfiles),
  so `.drain.config.json` and `.git` are never served.
- API keys never reach the browser. The panel only learns whether a key is saved, taken from an
  environment variable, or missing.

**Test connection checks vision, not just reachability.** In API mode it sends a solid red image
and expects "red" back, because a drain is useless with a text-only model. In agent mode it runs
the agent once with a trivial prompt.

**Connect, then Drain — one guide per AI.** The collector never sees modes or commands unless
they want to. **Connect AI** lists AIs by the names people know (Claude, ChatGPT, Gemini,
OpenCode, Pi, Hermes, OpenRouter, Ollama, LM Studio, Something else), from
`scripts/ai/catalog.js`. Each opens a guide shaped by how it connects:

- An **agent app** gets install → log in → connect.
- An **API key** gets a link to create one, a key field, and that key's model list with a
  sensible default.
- A **local server** gets download → a model that can see images → connect.

Steps the helper can already see are done (an app on `PATH`, a server answering, a key in the
environment) are ticked off. The collector finishes the guide, and the helper runs the connection
test and saves the choice only if it passes (`connection` in `.drain.config.json`). After that the
header shows the connection and a **Drain** button that just runs.

**Install and log in happen in a visible Terminal window.** Agent apps sign in interactively (a
browser OAuth flow plus prompts), and no outside page may host another company's login. So
**Install** and **Log in** open a Terminal window (`scripts/ai/terminal.js`) running the tool's
own documented command, with a line of guidance above it. The browser can only name a catalog
entry and an action (`install`, `login`, or `pull` one of the listed Ollama models); the command
always comes from the catalog, so the endpoint can't be used to run anything else.

**No install step to type.** `Start Inspiration Library.command` (macOS) and `.bat` (Windows)
install dependencies on first run and open the app. If the helper is already running, they just
open it. If Node is missing, they open its download page. The screenshot crop and WebP encoding
moved from Python/Pillow into the capture browser's canvas, so Node is the only prerequisite
(Playwright drives the collector's installed Chrome).

**Connect AI starts the helper itself.** A page can't launch programs, but it can follow a link.
On every start, the launcher registers an `inspiration-library://` link with the operating system
(`scripts/register-url-handler.sh`: a tiny background applet in `.helper/` on macOS, a `.desktop`
handler on Linux, a registry key from the `.bat` on Windows). Clicked from a `file://` page,
Connect AI follows that link, which starts the helper with no window (`start.sh --background`,
logging to `.helper/helper.log`). It then polls until the helper answers and moves to
`http://localhost:4747/?connect=1` with Connect already open. The very first start still needs the
double-click, since nothing has registered the link yet; the waiting screen says so if nothing
answers.

## Consequences

**The file:// page and the localhost page are different origins.** Browser-stored state doesn't
carry across when Connect AI moves to `localhost`. The folder granted for File System Access
writes would be one such thing, so a page the helper serves saves through the helper instead
(`/api/files/*`: append to `inbox.md`, rewrite `data/library.js` or `data/design-systems.js`,
delete files directly under `images/`, nothing else) and never shows the folder picker. Hidden
references in `localStorage` still don't carry over. They show again on `localhost` until they
are hidden there too.

**Two ways to open the app.** Double-clicking `index.html` still works for browsing and adding.
Connect AI and Drain need the helper, started by the double-click launcher (or `npm start`), at
`http://localhost:4747`. Opened from `file://`, Connect AI explains this and links across when the
helper is already running. The helper's window has to stay open while draining. The File System
Access writes (Add, purge, resolve) keep working under the helper, since `localhost` is a secure
context.

**API mode is the helper doing an agent's job, less adaptively.** It can't improvise around a
strange site the way an agent with its own browser can. It gets one automatic re-capture with a
longer wait, then parks the capture as a draft, as 0004 specifies. It also can't read the repo
beyond what it's sent: the procedure docs, the categories, one exemplar reference and design
system, and the capture. Quality tracks the model, and a weak local model will produce weak prose
that still passes validation.

**Cost is visible to the collector, not to the helper.** API mode sends up to five full-size frames
plus about 35k characters of instructions per capture, and up to two repair rounds more. The panel
doesn't estimate this. Collectors on metered APIs should know a drain of many captures isn't free.

**Agent presets will drift.** CLI flags change between releases. Presets are starting points shown
in an editable field, and Test connection is how a collector finds out a flag has changed.
