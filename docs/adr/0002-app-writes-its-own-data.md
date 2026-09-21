# 0002 — The app writes its own data via the File System Access API

## Status

Accepted. Supersedes [0001 — Deletion via localStorage tombstones](./0001-tombstone-deletion.md)
in part: tombstones survive as the hiding mechanism, but the premise that the app can never write
to disk is withdrawn.

## Context

ADR-0001, and the original spec's entire read-only stance, rest on one premise:

> The app is a static page opened via `file://`; it has no write access to `data/library.js`.

That premise is false. The File System Access API is available and functional from a `file://`
document in the collector's Chrome. Verified directly in the console of the app opened by
double-click:

```js
typeof window.showSaveFilePicker            // → "function"

const h = await showSaveFilePicker({suggestedName: 'fsa-test.txt'});
const w = await h.createWritable(); await w.write('ok'); await w.close();
// → wrote successfully
```

A page opened with no server, from the filesystem, can therefore obtain a handle to a real file
and write it — given a user gesture and a permission grant.

This matters because three separate awkward things in the design existed only to work around the
withdrawn premise: deletion could not be made permanent, capture could not happen in the app at
all, and the hide list and the data file were allowed to diverge indefinitely with reconciliation
deferred to "before any publish".

## Decision

The app may write to disk, through the File System Access API, to exactly two files:

- **the inbox** — appending a captured reference, and
- **the library data file** — rewriting it whole, to purge hidden references or to resolve a
  draft.

Writes always originate from a deliberate collector action. The app never writes on load, never
writes on a timer, and never writes as a side effect of browsing.

Everything else about the app's boundary is unchanged and remains firmly out of scope: the app
does not fetch URLs, does not call a language model, and does not generate prompts. Analysis
stays entirely with the agent. The app gained the ability to *write*, not the ability to *think*.

## Consequences

**Hiding stays; deletion becomes real.** Hiding remains an instant, reversible, browser-only
tombstone — that is the right behaviour for a misclick. What changes is that a purge can now
write the removal through to the data file and clear the corresponding tombstones. ADR-0001's
reconcile-before-publish requirement is satisfied by running a purge, rather than by a manual
diff performed from memory at publish time.

**Recovery moves to git.** Because permanent deletion now edits a tracked file, `git revert`
restores a purged reference. The repository, not the browser, is the safety net — which is a
stronger guarantee than the tombstone list ever offered, since `localStorage` is not backed up
and is tied to the exact path the app is opened from.

**The data file must be generated, not hand-assembled.** `data/library.js` is JavaScript source,
and the app now produces it. Generating that source text is the genuinely risky part of this
decision, so it lives in a pure, tested module rather than in the render layer.

**Hand-editability is preserved and now load-bearing.** The collector can still open
`data/library.js` in a text editor. Generated output must therefore stay in the file's existing
shape — one readable block per reference — rather than collapsing to minified or
machine-formatted output.

**A permission cost per session.** The API requires a user gesture, and the grant is not assumed
to survive a restart. The collector will likely re-grant once per session, at the first write.
Browsing costs nothing; only writing does. Actual persistence behaviour is to be measured during
implementation rather than designed around.

## Alternatives considered

**Keep the app read-only, capture through a text file only.** Viable, and was the working plan
until the API was tested. Rejected because it leaves permanent deletion impossible from the app
and leaves the tombstone/data-file divergence unreconciled by anything the collector can run.

**Regenerate the data file and hand it over as a download.** Works everywhere with no permission
prompt, but costs a manual file move per edit. Retained as the fallback should the permission
grant prove unworkable in practice.

**Run a small local server with a write endpoint.** Rejected outright: it requires a terminal,
which breaks the one constraint the whole architecture was chosen for — that the library opens by
double-clicking a file.
