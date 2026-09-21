# Contributing

Thanks for wanting to help. Pool is a small, opinionated project — a static library of design
references that runs entirely on your machine. The notes below are what you need to make a change
that fits.

## Requirements

- Node.js 20 or newer. That's it — there is no build step.
- A Chromium-based browser to browse the library (for the File System Access API).
- Optional: `npx playwright install chromium` only if Google Chrome isn't installed, for the
  capture scripts.

## Setup

```bash
npm install
npm test          # the whole suite, no browser needed
npm start         # opens the app at http://localhost:4747
```

You can also just open `index.html` directly to browse.

## Architecture rules

These are load-bearing; changes that break them won't be merged:

- **Static site, no backend, no build.** No bundlers, no frameworks, no build output.
- **Runs from `file://`.** Classic `<script>` tags only — no `fetch()`, no ES modules, no
  `import`/`export` in `js/`. Data lives in `data/*.js` as globals.
- **All intelligence is offline.** The app itself never calls a model or a network. Analysis is
  done by an AI agent between sessions, through the scripts in `scripts/`.
- **The app writes only its own data** — `data/library.js`, `data/design-systems.js` and
  `inbox.md`.
- **The helper stays local.** `scripts/server.js` must keep binding `127.0.0.1` and enforcing its
  Host / Origin / content-type guards.

When in doubt, read the surrounding code and its comments before changing the behaviour they
describe.

## Making a change

1. Match the style of the code around you. Most scripts are plain ES5-flavoured CommonJS with
   comments that explain *why*, not *what*.
2. Keep a pull request focused on one thing. If you're adding a reference to the library, keep it
   in its own PR.
3. Run `npm test` before opening the PR. CI runs the same suite on Node 20 for pushes and PRs to
   `main`.
4. Don't commit secrets, API keys, or `.drain.config.json`. Keys belong in the OS keychain, not
   the repo (see `SECURITY.md`).

## Adding a reference to the library

References are added by *draining* the inbox, not by hand-editing `data/`:

```bash
node scripts/inbox.js                 # what's waiting
node scripts/capture.js <url>         # screenshots + design-token harvest
node scripts/commit.js result.json    # validate, lint, write
```

The full procedure is `docs/agents/drain.md`, and the `result.json` format is
`docs/agents/drain-result.md`. If you're contributing a reference as an example, include the
screenshot and be mindful of the site owner's rights — screenshots of third-party sites belong to
their owners.

## Reporting bugs and security issues

Open a regular GitHub issue for bugs and feature requests. For anything security-related, follow
`SECURITY.md` and use a private advisory rather than a public issue.
