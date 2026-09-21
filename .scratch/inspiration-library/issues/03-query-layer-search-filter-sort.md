# 03 — Query layer: search, category filter, keyword filter, sorting

**What to build:** The collector can find a reference from whatever fragment they happen to
remember. A single search box matches, case-insensitively, against name, summary, keywords and
category, and results update as they type. A row of category pills narrows to one style at a
time, and combines with the search box so they can search within a style. Clicking any keyword
chip anywhere in the app filters the library to that keyword, so they can find every reference
sharing a specific visual move. The current filter is reflected in the URL, so a filtered view
survives a refresh and can be linked; the back button steps back through filter states. There is
an obvious way to clear all filters, and a search matching nothing says so rather than showing an
empty page that looks broken.

This is the one seam in the project with automated tests. The filtering, sorting and
hidden-entry logic are pure functions over arrays with no DOM access, exercised by Node's built-in
test runner with no dependencies and no build step. Tests assert external behaviour only — entries
in, entries out, in a given order — never how filtering is implemented.

**Blocked by:** 01 — needs the schema, the data-access seam and the render layer to filter
against. Not blocked by 02: the query functions are tested against fixtures, though the result
will feel thin to demo until 02 has populated the library.

**Status:** done

- [x] Search matches case-insensitively across name, summary, keywords and category
- [x] Results update live as the collector types
- [x] Category pills filter to one category
- [x] Category and search criteria combine with AND
- [x] Clicking a keyword chip anywhere filters the library to that keyword
- [x] Filter state is encoded in the URL and survives a refresh
- [x] The back button steps back through filter states
- [x] A clear-filters action returns to the whole library in one action
- [x] A query matching nothing shows an explicit empty-state message
- [x] Query functions are pure, take and return arrays, and touch no DOM
- [x] Query functions are loadable both as a browser script and by the Node test runner, with no bundler or dependency
- [x] Tests cover substring matching independently across name, summary, keywords and category
- [x] Tests cover case insensitivity
- [x] Tests cover category and search combining with AND
- [x] Tests cover keyword filtering
- [x] Tests cover empty, absent and whitespace-only criteria being ignored rather than matching nothing
- [x] Tests cover newest-first ordering, including entries sharing a `createdAt`
- [x] Tests cover an empty library and a zero-match query returning an empty array rather than throwing
- [x] The whole suite runs with a single command and passes

## Comments

Implemented in `js/query.js` (filterEntries/sortEntries/visibleEntries) with a CommonJS footer,
covered by 19 tests in `test/query.test.js`, run via `npm test` (`node --test test/`). Keyword
filtering matches an entry's `keywords[]` exactly (case-insensitive) rather than substring — that's
what "click a keyword chip" needs; free-text search still does substring matching across all four
fields. URL state lives in the grid hash (`#/?q=&category=&keyword=`); typing uses
`history.replaceState` (no history spam per keystroke) while pill/chip clicks push a real hash
change so back-button stepping through discrete filter states works.
