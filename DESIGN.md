---
name: Inspiration Library
description: A personal, dark-room catalog of web/app design references.
colors:
  void-black: "#0a0a0b"
  raised-panel: "#141416"
  raised-panel-deep: "#1a1a1d"
  hairline: "#26262a"
  hairline-strong: "#38383d"
  paper-white: "#ece9e2"
  dim-text: "#a3a099"
  faint-text: "#6b6965"
  acid-lime: "#d8fb3c"
  acid-lime-ink: "#14150e"
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
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.1em"
rounded:
  xs: "4px"
  sm: "7px"
  md: "9px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.dim-text}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-ghost-hover:
    backgroundColor: "transparent"
    textColor: "{colors.acid-lime}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.acid-lime-ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  pill-active:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.acid-lime-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  tile:
    backgroundColor: "{colors.raised-panel}"
    rounded: "{rounded.lg}"
---

# Design System: Inspiration Library

## Overview

**Creative North Star: "The Dark Room Contact Sheet"**

Near-black gallery walls hold rows of references at rest, waiting to be reviewed. One acid-lime
accent stands in for the loupe: it appears only at the moment of decision — an active filter, a
focused input, a link about to be followed — and stays absent everywhere else. The system is
restrained by default and precise under interaction; it never performs for an audience, because
there is only ever one collector looking. Density is high (a filterable grid of many small tiles)
but never cramped: generous internal padding and a consistent 8px-stepped rhythm keep the catalog
scannable at a glance.

Depth is almost entirely absent at rest — surfaces are flat, distinguished by tone (`void-black`
vs `raised-panel`) and hairline borders rather than shadow. Shadow appears only as a response to
interaction (a tile lifting on hover, a modal arriving over the page), never as ambient
decoration. Motion is subtle and fast (120–400ms, a single consistent ease curve), never
showy.

**Key Characteristics:**
- Near-black, low-chroma base with a single loud accent reserved for interaction
- Flat by default; shadow only on hover/lift and floating surfaces (modals, lightbox)
- Serif italic display face (Fraunces) for titles only; everything else is Inter
- Hairline 1px borders as the primary structural device, not shadow or heavy fills
- Full-pill radius for anything filterable/tag-like; softer 9–14px radius for containers

## Colors

A near-monochrome dark palette (void black through warm off-white) with exactly one saturated
color, reserved for the moment something is active, focused, or chosen.

### Primary
- **Acid Lime** (`#d8fb3c`): the single accent. Used for active filter pills, focus rings,
  hover states on interactive text/borders, primary action buttons (Save), and the "resolve"
  affordance on drafts. Never used decoratively or at rest.

### Secondary
- **Draft Amber** (`#f5a623`): reserved exclusively for the draft/parked state — dashed tile
  borders, the draft badge, draft-reason copy. A second warning-toned accent, deliberately
  distinct from the primary so a draft is never mistaken for an active selection.

### Neutral
- **Void Black** (`#0a0a0b`): the page background.
- **Raised Panel** (`#141416`): one step up — tiles, inputs, chips, prompt blocks, modals.
- **Raised Panel Deep** (`#1a1a1d`): a second raise, used for hover states on already-raised
  surfaces (e.g. a resolve button's hover fill).
- **Hairline** (`#26262a`): default border color on nearly every bordered element.
- **Hairline Strong** (`#38383d`): border hover state, one step brighter than the default hairline.
- **Paper White** (`#ece9e2`): primary text, warm rather than pure white.
- **Dim Text** (`#a3a099`): secondary text — metadata, labels, category names.
- **Faint Text** (`#6b6965`): tertiary text — placeholders, section eyebrows, underline rules.

### Named Rules
**The Loupe Rule.** Acid lime marks the thing currently being decided on — an active filter, a
focused field, a hovered link — never a resting state. If nothing is being chosen, the lime is
absent from the screen.

## Typography

**Display Font:** Fraunces (with Georgia, Times New Roman fallback)
**Body Font:** Inter (with system sans-serif fallback)

**Character:** An editorial serif italic for titles against a clean, quiet grotesque for
everything else — the tension between a considered, personal library and a fast, functional
tool for managing it.

### Hierarchy
- **Display** (500 weight, italic, 28–30px, 1.25 line-height): page title and entry-detail
  name only. Always Fraunces italic; never used for anything else.
- **Title** (500 weight, 20px, italic): modal titles (e.g. "Add reference"), same Fraunces
  treatment scaled down.
- **Body** (400–600 weight, 14–17px, 1.65 line-height, max 66ch): entry summaries, type notes,
  category descriptions, prompt text.
- **Label** (600 weight, 11–12px, 0.1em letter-spacing, uppercase where used): section eyebrows
  (`SECTION_LABEL`), draft badge text.
- **Meta** (400–600 weight, 12–13px): tile names, category tags, filter pills, timestamps.

### Named Rules
**The One Serif Rule.** Fraunces italic appears only on titles (library title, entry name, modal
title). Every other piece of type, however large, is Inter.

## Layout

A single centered column, `max-width: 1400px`, padding `48px 32px 120px` (28px 18px 72px on
mobile ≤640px). The library view is an auto-filling grid, `repeat(auto-fill, minmax(268px, 1fr))`
with `20px 24px` gutters, collapsing to a single column on mobile. Detail views narrow to
`max-width: 880px` for readability, with body copy further capped at `66ch`.

Spacing follows an 8px-rooted rhythm (8, 14, 16, 24, 32, 40, 48, 56, 96px) rather than a strict
geometric scale — values are chosen per-component for visual balance, always landing on that
grid. Section breaks inside a detail view step up to 40px; page-level sections step up to 48–56px.

## Elevation & Depth

Flat by default: tiles, chips, pills, and inputs are distinguished by fill tone and a 1px
hairline border, not shadow. Shadow exists only as a response to state — a tile lifting 2px on
hover, or a surface arriving above the page (modal, lightbox, prompt copy button when copied).

### Shadow Vocabulary
- **Tile hover lift** (`0 12px 28px -12px rgba(0,0,0,0.55)`): paired with a 2px translateY on
  hover, signals "this is interactive and about to open."
- **Floating surface** (`0 24px 64px -16px rgba(0,0,0,0.6)`): modals and the lightbox image, a
  deeper shadow for content genuinely above the page plane.

### Named Rules
**The Flat-At-Rest Rule.** No shadow exists until the user does something. A resting tile,
chip, or input is shadow-free; hover, focus, or a floating layer is the only trigger.

## Shapes

Corners scale with a surface's size: small interactive chrome (buttons, inputs, small chips) sits
at 7–9px; containers (tiles, prompt blocks, hero image) at 12–14px; anything filterable or
tag-like (pills, badges, chips) is fully rounded at 999px. Borders are uniformly 1px hairlines;
the only exception is the dashed border marking a draft tile. The circular hide button on a tile
is the one fully circular (50%) affordance in the system, reserved for a single icon-only control.

## Components

### Buttons
- **Shape:** 7–8px radius (`rounded.sm`).
- **Ghost / default** (`.btn-ghost`, copy-btn, add-modal-cancel): transparent background,
  1px hairline border, dim text; hover shifts border and text to acid lime (destructive actions
  like purge shift to a soft red instead, `#ff8a8a`).
- **Primary** (add-modal-save): filled acid lime, ink-dark text, `brightness(1.08)` on hover,
  0.6 opacity when disabled.
- **Transition:** border-color, color, background all animate on the shared 0.15s ease curve
  (`cubic-bezier(0.22, 1, 0.36, 1)`).

- **Danger** (`.btn-danger`): filled soft red (`#ff8a8a`), used only on the button that
  deletes for good (the purge confirmation, the disconnect confirmation). Never lime.

### Header controls
- **AI pill:** full-pill ghost button — a lit lime dot and the AI's name when connected, a
  hollow dot and "Connect AI" when not. Opens a small popover (switch, disconnect with an inline
  confirm) rather than the full Connect dialog.
- **Inbox button:** ghost button with a paper-white count badge (not lime — a count is not a
  decision). While a drain runs it becomes a spinner and "Draining 2/5".

### Inbox drawer
- A right-hand sheet (440px, raised-panel, hairline-strong left edge, floating-surface shadow)
  holding the whole capture → drain loop: the add field at the top, the waiting captures as a
  list, and the drain action or its live progress pinned at the bottom.
- The capture being analysed gets a 2px lime inset edge; a thin 4px lime bar shows progress.

### Search and filter tokens
- The search field carries a leading search icon and a `/` key hint; typing opens a suggestions
  list (raised-panel, floating-surface shadow) of matching categories and keywords.
- Every active filter renders as a removable token (raised-panel-deep, hairline-strong, pill
  radius) next to the "n of m" count. Tokens are neutral, not lime — the lime stays on the
  active category pill.
- All / Drafts / Hidden is a segmented control beside search, shown only when there are drafts
  or hidden references to switch to. The Drafts count is amber.

### Toasts
- Bottom-centre, raised-panel-deep, hairline-strong, with at most one lime text action (Undo,
  Show new references). Used to confirm reversible actions instead of blocking dialogs.

### Pills / Chips
- **Style:** raised-panel background, hairline border, fully rounded (999px), dim text.
- **State:** active/selected fills solid acid lime with ink-dark text and bumps to 600 weight;
  inactive hover only shifts the border to hairline-strong and brightens text — never introduces
  color on hover, only on true selection.
- **Static chip variant** (category vocabulary chips) suppresses hover entirely — it is
  informational, not actionable.

### Cards / Tiles
- **Corner style:** 12px radius, overflow hidden so the cover image clips to the same radius.
- **Background:** raised-panel, hairline border.
- **Shadow strategy:** flat at rest; on hover, border brightens to hairline-strong, lifts 2px,
  and gains the tile-hover shadow; the cover image simultaneously scales to 1.035.
- **Draft state:** border switches to dashed draft-amber; a pill-shaped amber badge sits
  top-left, an amber resolve action bar sits along the tile's bottom edge.
- **Hidden state:** shown only in the Hidden view — dashed hairline border, the image and
  meta at 0.45 opacity, a "Hidden" badge, and a two-button action bar (Restore / Delete…) at full
  strength, so the ways out stay legible.

### Inputs / Fields
- **Style:** raised-panel background, hairline border, 9px radius, 11px/15px padding.
- **Focus:** border shifts to acid lime plus a soft 3px acid-lime halo
  (`rgba(216,251,60,0.15)`); the app-wide focus-visible ring elsewhere is a two-layer ring
  (`0 0 0 2px bg, 0 0 0 4px accent`) rather than a glow, reserved for non-input focusable
  elements.

### Navigation / Back link
- **Style:** small (13px) dim text with a leading glyph, no underline at rest; hover brightens
  to full text color. No persistent nav chrome elsewhere — the filter bar and grid are the
  primary navigation surface.

### Modals (Add / Purge / Resolve)
- **Style:** raised-panel background, hairline-strong border, 14px radius, floating-surface
  shadow, centered over a dark scrim (`rgba(5,5,5,0.72)`) with a 0.15s fade-in.
- **Title:** Fraunces italic, matching the page-level display treatment at a smaller size.

## Do's and Don'ts

### Do:
- **Do** keep acid lime reserved for active/focused/selected states (the Loupe Rule); everywhere
  else, dim or faint text carries the hierarchy.
- **Do** use Fraunces italic only for the library title, entry name, and modal titles; every
  other string is Inter.
- **Do** express interactive state through border-color and text-color shifts on hairline
  borders before reaching for fills or shadow.
- **Do** keep drafts visually distinct with amber, never lime — a parked reference must never
  read as an active selection.
- **Do** keep hidden tiles present at reduced opacity rather than removing them from the grid;
  hiding is reversible and should look reversible.

### Don't:
- **Don't** add ambient shadow to resting surfaces (tiles, chips, inputs) — shadow only responds
  to hover, focus, or floating-layer state (the Flat-At-Rest Rule).
- **Don't** introduce a second saturated accent color; amber is reserved for drafts and a soft
  red is reserved for destructive hover only.
- **Don't** round anything filterable/tag-like to less than a full pill, or a structural
  container to more than 14px — the radius scale signals what kind of thing an element is.
