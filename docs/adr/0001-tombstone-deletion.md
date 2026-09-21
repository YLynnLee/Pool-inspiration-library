# 0001 — Deletion via localStorage tombstones

## Status

Superseded in part by [0002 — The app writes its own data via the File System Access
API](./0002-app-writes-its-own-data.md).

Tombstones remain the mechanism behind hiding, exactly as described below. What is withdrawn is
the premise in the Context section — that the app has no write access to `data/library.js` — and
with it the conclusion that reconciliation must be a manual step performed before publishing.
A purge now writes hidden references out of the data file directly.

## Context

The app is a static page opened via `file://` or a local server; it has no write access to
`data/library.js`. The collector still needs to remove references without waiting on an agent
session, and misclicks must be recoverable.

## Decision

Hiding a reference writes its id to a `localStorage` list (`inspiration-library:hidden-ids`),
applied at render time via the query layer's `visibleEntries(entries, hiddenIds)`. The data file
itself is never modified by the app. True deletion — removing the record and its screenshot file
— remains a task performed by Claude on request, which also removes the id from the hidden list
(there is nothing left to tombstone once the record is gone).

## Consequence: reconcile before publish

Because hiding lives in the browser's `localStorage` and the data file lives on disk, the two can
diverge: a reference can be hidden in the browser while still present, untouched, in
`data/library.js`. This is invisible during normal local use.

**It stops being invisible the moment the library is published anywhere** (see the spec's
Further Notes on publishing as an Artifact). A published copy has no access to the collector's
`localStorage`, so any reference hidden-but-not-deleted will reappear in the published version.

**Before any publish:** diff the current hidden-ids list against `data/library.js` and either
delete the corresponding entries and screenshots outright, or confirm with the collector that
each hidden entry should stay in. Do this reconciliation as an explicit step of the publish
workflow, not as an assumption.
