---
name: Pool
description: A personal, midnight-gallery catalog of web/app design references.
colors:
  obsidian: "#0f1011"
  abyss: "#090a0b"
  graphite: "#2e2e2e"
  steel: "#3f4041"
  hairline: "rgba(255,255,255,0.08)"
  hairline-strong: "rgba(255,255,255,0.16)"
  cloud: "#f5f5f7"
  ash: "#9f9fa0"
  fog: "#6a6b6b"
  pure: "#ffffff"
  void: "#000000"
  draft-amber: "#f5a623"
  draft-amber-ink: "#1a1206"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "30px"
    fontWeight: 500
    fontStyle: "italic"
    lineHeight: 1.25
    letterSpacing: "0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.14em"
rounded:
  xs: "4px"
  sm: "7px"
  md: "9px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.cloud}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary:
    backgroundColor: "{colors.pure}"
    textColor: "{colors.void}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  pill-active:
    backgroundColor: "{colors.pure}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  tile:
    backgroundColor: "{colors.graphite}"
    rounded: "{rounded.lg}"
---

# Design System: Pool

## Overview

**Creative North Star: "The Midnight Gallery"**

Near-black gallery walls hold rows of references at rest, hung like plates in a contact sheet.
Where the previous system used a single saturated accent to mark the moment of decision, this one
marks it in light instead: the *only* accent left in the interface is white-on-black itself — a
filled pill, a bright focus halo, a lit status dot — arriving out of a graphite-and-steel ground
the way a lamp does in a dark room. Nothing else on screen carries color; every reference's own
extracted palette supplies the room's actual chroma, tile by tile, so the catalog's chrome never
competes with what it's cataloging. Density stays high (a filterable grid of many small tiles) but
never cramped: generous internal padding and a consistent 8px-stepped rhythm keep it scannable.

Depth steps through tone — `obsidian` → `graphite` → `steel` — rather than through shadow; shadow
is reserved for the moment something lifts off the page (a tile on hover, a modal arriving over
the scrim). Type carries the split Origin-style voice: an editorial serif italic for the two or
three titles that need presence, a plain grotesque for everything read at length, and — new in
this pass — a tracked uppercase monospace for every label, count, and badge, so metadata always
reads as data rather than as prose. Motion stays subtle and fast (120–400ms, one consistent ease
curve), never showy.

**Key Characteristics:**
- Near-black, near-monochrome base; the only "accent" is white itself, reserved for the thing
  being decided on (focus, active, primary action)
- Flat by default; shadow only on hover/lift and floating surfaces (modals, lightbox, drawer)
- Serif italic display face (Fraunces) for titles only; body in Inter; every label/count/badge in
  a tracked uppercase monospace
- Hairline borders (now translucent white rather than a fixed dark gray) as the primary structural
  device, not shadow or heavy fills
- Full-pill radius for anything filterable/tag-like; 16px for cards and containers, matching the
  reference's card/feature-tile radius

## Colors

A near-monochrome dark palette (obsidian through cloud-white) with exactly one non-color accent —
white itself — reserved for the moment something is active, focused, or chosen. Chromatic color
never appears in Pool's own chrome; it only ever belongs to the captured references shown inside
it, which is the whole point of a catalog that shouldn't upstage its subjects.

### Primary
- **Pure White** (`#ffffff`): the interface's only accent. Used for active filter pills, focus
  rings, the primary action button (Save), the active tab underline, and a connected status dot.
  Never tinted, never used decoratively — only at the point of decision or emphasis.

### Secondary
- **Draft Amber** (`#f5a623`): unchanged from the previous system, and deliberately so — it's a
  semantic warning color, not a brand accent, so it survives the restyle untouched. Reserved
  exclusively for the draft/parked state: dashed tile borders, the draft badge, draft-reason copy.

### Neutral
- **Obsidian** (`#0f1011`): the page background — Origin's canvas tone.
- **Abyss** (`#090a0b`): a further step down, for sunken surfaces like log/code blocks.
- **Graphite** (`#2e2e2e`): one step up — tiles, inputs, chips, prompt blocks, modals.
- **Steel** (`#3f4041`): a second raise, used for hover states on already-raised surfaces.
- **Hairline** (`rgba(255,255,255,0.08)`): default border color on nearly every bordered element —
  now a translucent white wash rather than a fixed hex, so it reads correctly against any of the
  three background steps.
- **Hairline Strong** (`rgba(255,255,255,0.16)`): border hover state.
- **Cloud** (`#f5f5f7`): primary text and headings — a soft white, not pure `#fff`, per the
  reference's own "cream feels sterile" note.
- **Ash** (`#9f9fa0`): secondary text — metadata, labels, category names.
- **Fog** (`#6a6b6b`): tertiary text — placeholders, section eyebrows, underline rules.

### Named Rules
**The Lamplight Rule.** White marks the thing currently being decided on — an active filter, a
focused field, a hovered link, a primary action — never a resting state. If nothing is being
chosen, no highlight exists on the screen; the catalog's chrome supplies structure, never color.

## Typography

**Display Font:** Fraunces (with Georgia, Times New Roman fallback)
**Body Font:** Inter (with system sans-serif fallback)
**Label Font:** system monospace stack (`ui-monospace, 'SF Mono', Menlo, Consolas`) — new in this
pass, standing in for the reference's Roboto Mono without adding a third bundled font file.

**Character:** three voices instead of two — an editorial serif italic for titles, a clean
grotesque for everything read at length, and a tracked uppercase mono for anything that's a label,
count, or badge rather than prose. The mono voice is what most visibly carries this pass: it turns
every `SECTION_LABEL`, tile badge, and eyebrow into something that reads as data, echoing the
reference's "precision" register against the serif's "considered, personal library" register.

### Hierarchy
- **Display** (500 weight, italic, 28–30px, 1.25 line-height): page title and entry-detail
  name only. Always Fraunces italic; never used for anything else.
- **Title** (500 weight, 20–22px, italic): modal and drawer titles, same Fraunces treatment
  scaled down.
- **Body** (400–600 weight, 14–17px, 1.65 line-height, max 66ch): entry summaries, type notes,
  category descriptions, prompt text.
- **Label** (500 weight, 10–11px, 0.08–0.14em letter-spacing, uppercase, monospace): section
  eyebrows, tile/draft/hidden badges, AI card tags, filter-token kind.
- **Meta** (400–600 weight, 12–13px, Inter): tile names, category tags, filter pill text,
  timestamps.

### Named Rules
**The One Serif Rule.** Fraunces italic appears only on titles (library title, entry name, modal
and drawer titles). Every other piece of type, however large, is Inter — except the mono labels,
which are explicitly never prose.

## Layout

Unchanged from the previous system: a single centered column, `max-width: 1400px`, padding
`48px 32px 120px` (28px 18px 72px on mobile ≤640px). The library view is an auto-filling grid,
`repeat(auto-fill, minmax(268px, 1fr))` with `20px 24px` gutters, collapsing to a single column on
mobile. Detail views narrow to `max-width: 880px` for readability, with body copy capped at `66ch`.

Spacing follows the same 8px-rooted rhythm (8, 14, 16, 24, 32, 40, 48, 56, 96px). This pass changed
color and type, not rhythm or structure — the library's information architecture was already
correct for its job.

## Elevation & Depth

Flat by default: tiles, chips, pills, and inputs are distinguished by fill tone (`obsidian` →
`graphite` → `steel`) and a 1px translucent hairline, not shadow — closer to Origin's "surface
color steps over shadow" philosophy than the previous system already was. Shadow exists only as a
response to state — a tile lifting 2px on hover, or a surface arriving above the page (modal,
lightbox, drawer, prompt copy button when copied).

### Shadow Vocabulary
- **Tile hover lift** (`0 12px 28px -12px rgba(0,0,0,0.55)`): paired with a 2px translateY on
  hover, signals "this is interactive and about to open."
- **Floating surface** (`0 24px 64px -16px rgba(0,0,0,0.6)`): modals, drawer, and the lightbox
  image — a deeper shadow for content genuinely above the page plane.

### Named Rules
**The Flat-At-Rest Rule.** No shadow exists until the user does something. A resting tile, chip,
or input is shadow-free; hover, focus, or a floating layer is the only trigger.

## Shapes

Corners scale with a surface's size: small interactive chrome (buttons, inputs, small chips) sits
at 7–9px; containers (tiles, hero image, modals) at 16px, matching the reference's card/
feature-tile radius rather than the previous system's softer 12–14px; anything filterable or
tag-like (pills, badges, chips) stays fully rounded at 999px. Borders are uniformly 1px hairlines;
the only exception is the dashed border marking a draft tile. The circular hide button on a tile
is the one fully circular (50%) affordance in the system, reserved for a single icon-only control.

## Components

### Buttons
One set, used by every button in the app (`.btn` plus a variant). Build new UI from these; don't
add a bespoke button style.
- **Shape:** 8px radius (`rounded.sm`), 9px 16px padding, 13px text. Link elements styled as
  buttons (`<a class="btn">`) never underline. Icon-only buttons are 30px squares at 7px radius.
- **Primary** (`.btn-primary`): filled white, black ink, `brightness(1.08)` on hover — the one
  main action of a surface.
- **Secondary** (`.btn-secondary`): graphite fill, hairline-strong border, white text; hover
  lifts the border and fill. The default for everything that isn't the main action — header
  buttons, modal Cancel/Close, Copy/Download, tile actions.
- **Danger** (`.btn-danger`): filled soft red (`#ff8a8a`), used only on the button that deletes
  for good. **Quiet danger** (`.btn-danger-quiet`, on a secondary): looks secondary, turns red
  on hover — for a destructive option that isn't the confirmation (Delete… on a tile).
- **Small** (`.btn-sm`) and **block** (`.btn-block`, full width) are modifiers on any variant.
- **Icon-only** (`.icon-btn`): borderless, faint icon, brightens on hover; always has an
  `aria-label`. **Link-button** (`.link-btn`): text-only, for a quiet in-flow action ("+ Add a
  note", back).
- **States:** hover as above; disabled is 0.5 opacity with no pointer events; focus-visible is
  the app-wide two-layer ring, clipped to the button's own radius.
- **Transition:** border-color, color, background animate on the shared 0.15s ease curve.

### Notice
The one box for every problem or outcome (`UI.notice(tone, { title, text, actions })`). Use it in
the drawer, the Connect AI flow and every modal instead of ad-hoc coloured text.
- **Tones:** info, success, warning (Draft Amber), error (danger red).
- **Layout:** an icon column (16px) then one column: the **title** says what happened, the
  optional **text** says how to fix it, and up to two **actions** (small secondary buttons) sit
  under the text, left-aligned.
- **Surface:** warning and error use a translucent tint of their colour with a full 1px border in
  it; info and success are steel with a hairline-strong border. No thick side stripe.
- **Semantics:** errors carry `role="alert"`; the other tones `role="status"`.
- **Toasts vs notices:** a toast only confirms something brief or undoable. Anything the
  collector needs to read or act on is a notice.

### Status label
`UI.status(kind)`: a small mono uppercase label saying where a link is — **Waiting** (grey dot),
**Analysing** (spinner), **Added** (check, white), **Failed** (alert icon, danger red).

### Icons
16px, 1.5 stroke, round caps, drawn in `currentColor` (`UI.icon`). The set includes alert, info,
external link, back and forward. Text glyphs (‹ ↗ → ←) never stand in for icons in the app's
chrome.

### Header controls
- **AI button:** a secondary button — a lit white dot and the AI's name when connected, a hollow
  dot and "Connect AI" when not. Opens a small popover (switch, disconnect with an inline
  confirm) rather than the full Connect dialog.
- **Add button:** the header's one primary button, with a count badge for waiting links (a count is
  not a decision, it stays on a dark-on-light chip). While analysing it becomes a spinner and
  "Analysing 2 of 5"; after a run it reads "2 added · 1 failed" until the drawer is opened.

### Add drawer
- A right-hand sheet (440px, graphite, hairline-strong left edge, floating-surface shadow) holding
  the whole add → analyse loop: the add field at the top, the added links as a list, and the
  Analyse action or its live progress pinned at the bottom.
- Above Analyse sits the AI · model line: a lit dot and the AI's name left, the current model and a
  chevron right, as inline text. It opens a full-width menu above itself (Model label, Switch AI…,
  models as a radio list, same floating-surface shadow); picking a model re-tests it, and the line
  and Analyse stay disabled meanwhile. While running, Stop is a full-width secondary button.
- The link being analysed shows the Analysing status; a thin 4px white bar shows progress.

### Reference page
- Order: "Library" back link, draft notice (warning, with **Resolve…**) if a draft, screenshots,
  caption block, Summary, Keywords, then the tabs.
- **Caption block:** the title in the display serif italic, the category name and its one-line
  definition as a single dim caption line beneath it; **Visit site** (secondary, small, external
  icon) and **Delete…** (quiet danger, small) on the right, stacking under the text at phone width.
- Summary and Keywords sit under the same mono section labels, 15px body and 66ch measure as
  Breakdown. Keywords are plain text separated by middots (the separator trails each item, so no
  line starts with one). Nothing here is a link except the two actions.
- Breakdown opens with **Character**, a 1–3 sentence description of the style; measurement notes
  live in a collapsed "How this was measured" section at the end.

### Search and filter tokens
- The search field carries a leading search icon and a `/` key hint; typing opens a suggestions
  list (graphite, floating-surface shadow) of matching categories and keywords, its section label
  in tracked mono.
- Every active filter renders as a removable token (steel, hairline-strong, pill radius, kind in
  tracked mono) next to the "n of m" count. Tokens are neutral, not white — white stays on the
  active category pill only.
- All / Drafts / Hidden is a segmented control beside search, shown only when there are drafts or
  hidden references to switch to. The Drafts count is amber.

### Toasts
- Bottom-centre, steel, hairline-strong, with at most one white text action (Undo, Show new
  references). Only for brief or undoable confirmations — problems go in a notice.

### Pills / Chips
- **Style:** graphite background, hairline border, fully rounded (999px), dim text.
- **State:** active/selected fills solid white with black ink text and bumps to 600 weight;
  inactive hover only shifts the border to hairline-strong and brightens text — never introduces
  color on hover, only on true selection.
- **Static chip variant** (category vocabulary chips) suppresses hover entirely — it is
  informational, not actionable. Reference-page keywords are not chips; they are plain text.

### Cards / Tiles
- **Corner style:** 16px radius, overflow hidden so the cover image clips to the same radius.
- **Background:** graphite, hairline border.
- **Shadow strategy:** flat at rest; on hover, border brightens to hairline-strong, lifts 2px, and
  gains the tile-hover shadow; the cover image simultaneously scales to 1.035.
- **Draft state:** border switches to dashed draft-amber; a pill-shaped amber badge (tracked mono)
  sits top-left, an amber resolve action bar sits along the tile's bottom edge.
- **Hidden state:** shown only in the Hidden view — dashed hairline border, the image and meta at
  0.45 opacity, a "Hidden" badge (tracked mono), and a two-button action bar (Restore / Delete…, secondary small buttons)
  at full strength, so the ways out stay legible.

### Inputs / Fields
- **Style:** graphite/steel background, hairline border, 9px radius, 11px/15px padding.
- **Focus:** border shifts to white plus a soft 3px white halo (`rgba(255,255,255,0.14)`, the
  `--accent-glow` token); the app-wide focus-visible ring elsewhere is a two-layer ring
  (`0 0 0 2px bg, 0 0 0 4px accent`) rather than a glow, reserved for non-input focusable elements.

### Navigation / Back link
- **Style:** small (13px) dim text with a leading back icon, no underline at rest; hover brightens to
  full text color. No persistent nav chrome elsewhere — the filter bar and grid are the primary
  navigation surface.

### Modals (Add / Purge / Resolve)
- **Style:** graphite background, hairline-strong border, 16px radius, floating-surface shadow,
  centered over a dark scrim (`rgba(5,5,5,0.72)`) with a 0.15s fade-in.
- **Title:** Fraunces italic, matching the page-level display treatment at a smaller size. Every
  title (library, drawer, modals, reference) uses it.
- **Actions:** Cancel/Close is secondary, the confirming action is primary (or danger when it
  deletes). Errors appear in a notice above the actions.

## Do's and Don'ts

### Do:
- **Do** keep white reserved for active/focused/selected/primary states (the Lamplight Rule);
  everywhere else, dim or faint text carries the hierarchy.
- **Do** use Fraunces italic only for the library title, entry name, and modal/drawer titles;
  body copy is Inter; every label, count, or badge is tracked uppercase monospace.
- **Do** express interactive state through border-color and text-color shifts on hairline borders
  before reaching for fills or shadow.
- **Do** keep drafts visually distinct with amber, never white — a parked reference must never
  read as an active selection.
- **Do** keep hidden tiles present at reduced opacity rather than removing them from the grid;
  hiding is reversible and should look reversible.
- **Do** let a captured reference's own extracted palette be the only saturated color on screen —
  Pool's own chrome stays monochrome so it never competes with what it's cataloging.

### Don't:
- **Don't** add ambient shadow to resting surfaces (tiles, chips, inputs) — shadow only responds
  to hover, focus, or floating-layer state (the Flat-At-Rest Rule).
- **Don't** introduce a saturated brand accent; amber is reserved for drafts and warnings, and a soft red for
  destructive actions and errors only — the interface's own accent is white, not a hue.
- **Don't** round anything filterable/tag-like to less than a full pill, or a structural container
  to more than 16px — the radius scale signals what kind of thing an element is.
- **Don't** set body-length copy in the mono label font, or a label/badge in Inter — the two
  voices mark "prose" vs. "data" and shouldn't cross.
