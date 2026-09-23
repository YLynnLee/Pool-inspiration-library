# Setting up Pool

Installing Pool and starting it for the first time. If you'd rather work in a terminal or code
editor, you only need `npm install` — see
[Option A](../README.md#option-a-terminal-or-code-editor).

## What you need

- **A computer running macOS, Windows or Linux.**
- **[Node.js](https://nodejs.org/en/download) 20 or newer.** It's free, and it's the only thing a
  terminal or code editor needs. If it's missing and you use `Start Pool` instead, that opens the
  download page for you — install it, then double-click `Start Pool` again.
- **A Chromium-based browser** such as Chrome, Edge, Arc or Brave — only if you'll use the app (the
  library page itself, or [Option B](../README.md#option-b-in-app-guide)). Pool writes to its own
  files through a browser feature that Safari and Firefox don't support yet. Not needed for
  [Option A](../README.md#option-a-terminal-or-code-editor).
- **An AI that can see images** (see [Connecting your AI](../README.md#connecting-your-ai)). You
  only need this to add references. Browsing works without one.

## 1. Get the files

Either:

- On GitHub, click **Code → Download ZIP**, then unzip it. **or**
- In a terminal: `git clone https://github.com/YLynnLee/Pool.git`

Put the folder somewhere it will stay. If you move it later and you use the app, double-click
`Start Pool` once more so your computer learns the new location.

**Using a terminal or code editor ([Option A](../README.md#option-a-terminal-or-code-editor))?**
That's it for setup — run `npm install` inside the folder once, then skip ahead to
[Connecting your AI](../README.md#connecting-your-ai). The rest of this page is only for the
point-and-click app.

## 2. Start Pool for the first time

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

## 3. After the first time

You don't need to double-click `Start Pool` again. The first run registered a `pool://` link on your
computer, so from then on:

1. Open **`index.html`** in the Pool folder. Bookmarking it is handy.
2. Click **Connect AI**. The page starts the helper by itself.
3. Your browser asks once whether to open **"Pool Helper"**. Tick **Always allow** and choose
   **Open**.

The helper then runs quietly in the background, with no window to keep open.

---

Back to the [README](../README.md).
