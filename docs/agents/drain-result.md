# The Drain Result

The one file an agent writes per capture. Everything else — screenshots into `images/`, the
category, the reference, the design system, striking the inbox line, and the order those happen
in — is done by `node scripts/commit.js <result.json>`, which validates the file first and refuses
to write anything if a field is missing, a placeholder, or inconsistent with the library.

Write it anywhere; `.scratch/captures/<slug>/result.json`, next to the frames, is the convention.
Run `node scripts/commit.js <file> --dry-run` first, fix everything it reports, then run it
without `--dry-run`.

## Shape

```jsonc
{
  // The capture's inbox line, copied exactly from `node scripts/inbox.js`.
  "line": "- https://example.com — loved the serif",

  // Kept frames from capture.json, in display order. The first is the grid thumbnail.
  // Leave out any frame you discarded (loading state, overlay).
  "frames": [
    ".scratch/captures/example-com/frame-1.png",
    ".scratch/captures/example-com/frame-3.png"
  ],

  "reference": {
    "id": "example",                  // kebab-case, unique in data/library.js
    "name": "Example — Studio Site",
    "sourceUrl": "https://example.com", // exactly the inbox line's URL
    "category": "terminal-noir",      // an existing id in data/categories.js, or newCategory.id
    "summary": "…",
    "keywords": ["…", "…"],           // specific visual moves, not adjectives
    "palette": ["#000000", "#F4F3EE"],// #RRGGBB only
    "typeNotes": "…",
    "imagePrompt": "…",               // per docs/agents/image-prompt.md
    "brief": "[YOUR SUBJECT] …",      // must open with [YOUR SUBJECT]
    // Only for a capture failure (drain.md step 2's shot budget ran out):
    // "status": "draft", "draftReason": "loading state persisted past the shot budget"
  },

  // Only when no existing category genuinely fits (drain.md step 4).
  "newCategory": {
    "id": "quiet-serif",
    "name": "Quiet Serif",
    "definition": "One sentence, stating what the existing categories fail to cover.",
    "description": "A full essay, same depth as the existing categories.",
    "vocabulary": ["…", "…"]
  },
  // Required with newCategory: the nearest existing category and why it was rejected.
  "rejectedCategory": "terminal-noir — its grounds are black; this site's is paper-white",

  // The extracted design system (docs/agents/extract.md). Same shape as an entry in
  // data/design-systems.js — open that file for complete examples.
  "designSystem": {
    "referenceId": "example",         // equals reference.id
    "name": "Example",
    "description": "What was measured from harvest.json and what was inferred from the frames.",
    "colors": {
      "surface": { "value": "#000000", "displayName": "Void Black", "role": "the ground" }
    },
    "typography": {
      "display": { "fontFamily": "…", "fontSize": "64px", "fontWeight": 400, "lineHeight": 1.1 }
    },
    "fonts": [{ "family": "…", "role": "…", "substitutes": ["…"] }],
    "spacing": { "unit": "8px", "md": "16px" },
    "rounded": { "sm": "4px" },
    // Either "components": { … } or an omission with a reason a reader can check:
    "omitted": [{ "section": "components", "reason": "…" }],
    "sections": {
      "overview": "…", "colors": "…", "typography": "…", "layout": "…",
      "elevation": "…", "shapes": "…", "components": "…", "dosAndDonts": "### Do:\n- …\n\n### Don't:\n- …"
    }
  }
}
```

You don't write `screenshots`, `createdAt` or `ownerId` — the commit script fills them.

## Extract results

A standalone extract (`docs/agents/extract.md`) writes a file with only `designSystem`, for a
reference already in the library. `commit.js` replaces that reference's existing design system or
appends a new one.
