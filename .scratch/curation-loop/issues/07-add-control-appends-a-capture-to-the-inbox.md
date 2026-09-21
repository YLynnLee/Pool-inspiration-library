# 07 — Add control appends a capture to the inbox

**What to build:** The collector can capture a reference from inside the app. An Add control takes
a URL and an optional note on what caught their eye, and appends it to `inbox.md` as one line.
Nothing is analysed, validated or rejected — capture is deliberately dumb, and a bad line is the
drain's problem later.

This is the tracer bullet for the whole feature: it cuts a complete path from a control in the UI,
through the pure formatting function, through the File System Access shell, to a real file on
disk. It proves ADR-0002 in the app rather than in the console, and it establishes the inbox line
format that every later ticket reads.

The write must never surprise the collector. It happens only when they ask for it, never on load
and never on a timer. A denied or failed permission says so plainly and changes nothing.

The inbox line format is `- <url> — <optional note>`. Keep it simple enough that a macOS Shortcut
can append to it correctly in five minutes; that Shortcut is the collector's to build and is not
part of this ticket.

While building this, **measure whether the permission grant survives a browser restart** — it is
the one unknown left in the spec, and this is the first place it can be observed. Record what you
find in the comments below.

**Blocked by:** None — can start immediately.

**Status:** ready-for-human

- [x] An Add control is reachable from the grid without leaving the app
- [x] It accepts a URL and an optional note
- [x] Capturing appends exactly one well-formed line to `inbox.md`
- [x] Appending preserves every line already in the file
- [x] Line formatting is a pure function in the curation module, covered by tests
- [x] A successful write is confirmed visibly
- [x] A denied or failed write says so and leaves the file unchanged
- [x] The app writes only in response to a deliberate collector action — never on load, never on a timer
- [x] The permission grant is requested at most once per session, not once per write
- [ ] Verified in the app opened by double-clicking `index.html`, with no server running
- [ ] Whether the permission survives a browser restart is measured and recorded in this file
- [x] `inbox.md` is tracked in git

## Comments

**Implementation.** `js/curation.js` is the pure module: `formatCaptureLine(url, note)` and
`appendCaptureLine(existingText, url, note)`, both covered by `test/curation.test.js` (9 cases —
empty note, whitespace trimming, missing trailing newline, existing blank lines/comments
untouched). `js/fs-write.js` is the thin FSA shell: caches the granted `FileSystemFileHandle` in
memory for the page's lifetime and persists it to IndexedDB so a later reload in the same browser
session can skip the picker, checks `queryPermission` silently before ever prompting, and only
calls `requestPermission` from inside the click handler that already has a user gesture. `Add` is
a header button in `js/render.js` that opens a small modal (URL + optional note); Save calls
`window.appendToInbox`, shows "Added to inbox." on success or the caught error's message on
failure, and never touches disk on its own.

**What I verified, and how.** The automation tooling available to me cannot navigate to `file://`
URLs or drive a native OS file picker (`showOpenFilePicker` opens outside the DOM), so I could not
run the exact double-click scenario end to end. Instead I served the app over a throwaway local
`http.server` — same code paths (FSA API, IndexedDB, DOM), different transport only — and:
- confirmed the Add button opens the modal and empty-URL submission is blocked with "Enter a URL
  first." without calling the picker
- stubbed `showOpenFilePicker` to reject (simulating a denied/cancelled grant): the modal showed
  the error text and `inbox.md` on disk was byte-for-byte unchanged afterward
- stubbed it to resolve with a fake handle backed by an in-memory string: `appendToInbox` produced
  exactly the expected text (existing content untouched, one new well-formed line appended), and
  the same flow through the real Save button showed "Added to inbox." and cleared the form
- confirmed `npm test` (28/28, including the 9 new curation tests) and `node -c` on all three new
  files pass

**What's left for you.** The last two checkboxes need a human at a real double-clicked
`index.html` with a real Chrome permission prompt, which I can't drive:
1. Double-click `index.html` (no server), click Add, fill in a URL, Save — the browser will show
   its native "select inbox.md" picker the first time; grant it and confirm the line lands in
   `inbox.md` correctly.
2. Add a second capture in the same session and confirm no picker/prompt reappears.
3. Fully quit Chrome (not just close the tab) and reopen `index.html`, then Add again — note here
   whether it silently reuses the grant or re-prompts, since that's the one unknown ADR-0002
   flagged as worth measuring in the app rather than guessing about.

**Post-review fixes.** `/code-review` (Standards + Spec, run in parallel) came back with one real
bug on the Spec axis: the note field is a `<textarea>`, but `formatCaptureLine` only trimmed outer
whitespace, so a note containing a line break would have split a single capture across more than
one line of `inbox.md`. Fixed by collapsing all internal whitespace (including newlines) to single
spaces before formatting; added `test/curation.test.js` cases for it (29/29 passing now). Also
extracted the repeated `status.textContent` / `is-error` toggling in `openAddModal` into one
`setStatus(text, isError)` helper, per a minor duplication smell the Standards review flagged.
Standards axis otherwise found no hard violations. Spec axis otherwise confirmed no scope creep
and no other implementation gaps beyond the restart-measurement item above.
