// Pure helpers behind the drain's command-line scripts (scripts/inbox.js,
// scripts/capture.js, scripts/commit.js). No file or network access here —
// the scripts do the I/O, this file does the deciding, so the rules are
// testable and no agent has to re-derive them. See
// AGENTS.md for why the mechanical half of a
// drain lives in scripts rather than in the agent's hands.

var curation = require('../js/curation.js');

// Annotates every capture with whether its URL is already a sourceUrl in the
// library — the drain's dedupe step, same non-normalising string equality
// docs/agents/drain.md specifies.
function listInbox(inboxText, library) {
  var parsed = curation.parseInboxLines(inboxText);
  var known = {};
  (library || []).forEach(function (entry) {
    known[entry.sourceUrl] = true;
  });
  return {
    captures: parsed.captures.map(function (capture) {
      return {
        url: capture.url,
        note: capture.note,
        line: capture.line,
        duplicate: known[capture.url] === true,
      };
    }),
    malformed: parsed.malformed,
  };
}

// Rewrites a capture line in place with a fetch-failure reason appended to
// its note, leaving it in the inbox for a later retry (drain.md step 2). A
// line that isn't found leaves the text unchanged.
function markFetchFailed(inboxText, line, reason) {
  var target = String(line || '').trim();
  var parsed = curation.parseInboxLines(target);
  if (parsed.captures.length !== 1) return inboxText;
  var capture = parsed.captures[0];
  var failure = 'fetch failed: ' + String(reason || 'unknown reason').trim();
  var note = capture.note ? capture.note + '; ' + failure : failure;
  var replacement = curation.formatCaptureLine(capture.url, note);
  var lines = String(inboxText || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) {
      lines[i] = replacement;
      break;
    }
  }
  return lines.join('\n');
}

// A filesystem-safe working-directory name for one capture's frames and
// harvest, derived from the URL so re-running a capture reuses its folder.
function captureSlug(url) {
  var parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return 'capture';
  }
  var raw = (parsed.hostname.replace(/^www\./, '') + parsed.pathname).toLowerCase();
  var slug = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.slice(0, 80) || 'capture';
}

// Picks scroll offsets for the four-to-five shots drain.md asks for: top,
// quarters of the way down, and the end — dropping any that sit within half
// a viewport of the previous one, so a short page yields fewer, genuinely
// distinct frames rather than near-duplicates. The end of the page always
// survives, since that's where a page's closing section lives.
function shotPositions(scrollHeight, viewportHeight) {
  var range = Math.max(0, Math.round(scrollHeight - viewportHeight));
  var minGap = viewportHeight / 2;
  var positions = [0];
  [0.25, 0.5, 0.75].forEach(function (fraction) {
    var y = Math.round(range * fraction);
    if (y - positions[positions.length - 1] >= minGap && range - y >= minGap) positions.push(y);
  });
  if (range >= minGap) positions.push(range);
  return positions;
}

var REFERENCE_TEXT_FIELDS = ['id', 'name', 'sourceUrl', 'category', 'summary', 'typeNotes', 'imagePrompt', 'brief'];
var CATEGORY_TEXT_FIELDS = ['id', 'name', 'definition', 'description'];
var DESIGN_SYSTEM_SECTIONS_REQUIRED = ['overview'];
var HEX = /^#[0-9a-fA-F]{6}$/;
var CSS_COLOR = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]*\))$/;
var KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FRAME_PATH = /^\.scratch\/captures\/[^/]+\/[^/]+\.png$/i;
var PLACEHOLDER = /^(todo|tbd|n\/a|none|placeholder|\.\.\.|lorem ipsum.*)$/i;

function isFilled(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value.trim());
}

function isFilledList(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isFilled);
}

// Checks one design-system entry against the shape data/design-systems.js
// and serializeDesignMd expect. Shared by the drain result and a standalone
// extract result.
function validateDesignSystem(ds, referenceId, errors) {
  if (!ds || typeof ds !== 'object') {
    errors.push('designSystem is missing');
    return;
  }
  if (ds.referenceId !== referenceId) {
    errors.push('designSystem.referenceId must equal "' + referenceId + '"');
  }
  if (!isFilled(ds.name)) errors.push('designSystem.name is empty');
  if (!isFilled(ds.description)) {
    errors.push('designSystem.description is empty — it must say what was measured and what was inferred');
  }
  var colors = ds.colors || {};
  var colorKeys = Object.keys(colors);
  if (colorKeys.length === 0) errors.push('designSystem.colors has no entries');
  colorKeys.forEach(function (key) {
    var c = colors[key] || {};
    if (!CSS_COLOR.test(c.value || '')) errors.push('designSystem.colors.' + key + '.value must be a hex or rgb()/rgba() colour');
    if (!isFilled(c.displayName)) errors.push('designSystem.colors.' + key + '.displayName is empty');
    if (!isFilled(c.role)) errors.push('designSystem.colors.' + key + '.role is empty');
  });
  if (!ds.typography || Object.keys(ds.typography).length === 0) {
    errors.push('designSystem.typography has no tokens');
  }
  var sections = ds.sections || {};
  DESIGN_SYSTEM_SECTIONS_REQUIRED.forEach(function (key) {
    if (!isFilled(sections[key])) errors.push('designSystem.sections.' + key + ' is empty');
  });
  var hasComponents = ds.components && Object.keys(ds.components).length > 0;
  var omitsComponents = (ds.omitted || []).some(function (o) {
    return o && o.section === 'components' && isFilled(o.reason);
  });
  if (!hasComponents && !omitsComponents) {
    errors.push('designSystem needs either components or an omitted entry for "components" with a checkable reason');
  }
}

// Validates a drain result (see docs/agents/drain-result.md) against the
// current library state before anything is written. Returns a list of
// human-readable problems; an empty list means the result is safe to commit.
function validateDrainResult(result, state) {
  var errors = [];
  if (!result || typeof result !== 'object') return ['result is not a JSON object'];
  var library = state.library || [];
  var categories = state.categories || [];

  if (!isFilled(result.line)) errors.push('line is empty — copy the exact inbox line');
  if (!Array.isArray(result.frames) || result.frames.length === 0) {
    errors.push('frames is empty — list the kept frame paths in display order');
  } else {
    // commit.js copies each frame into images/, so a model-written path must
    // not be able to point at any other file on the machine.
    result.frames.forEach(function (frame) {
      if (!FRAME_PATH.test(String(frame)) || String(frame).split('/').indexOf('..') !== -1) {
        errors.push('frame must be a .png under .scratch/captures/: ' + frame);
      }
    });
  }

  var ref = result.reference;
  if (!ref || typeof ref !== 'object') {
    errors.push('reference is missing');
    return errors;
  }
  REFERENCE_TEXT_FIELDS.forEach(function (key) {
    if (!isFilled(ref[key])) errors.push('reference.' + key + ' is empty or a placeholder');
  });
  if (isFilled(ref.id) && !KEBAB.test(ref.id)) errors.push('reference.id must be kebab-case');
  if (!isFilledList(ref.keywords)) errors.push('reference.keywords must be a non-empty list of phrases');
  if (!Array.isArray(ref.palette) || ref.palette.length === 0 || !ref.palette.every(function (h) { return HEX.test(h); })) {
    errors.push('reference.palette must be a non-empty list of #RRGGBB hexes');
  }
  if (isFilled(ref.brief) && ref.brief.indexOf('[YOUR SUBJECT]') !== 0) {
    errors.push('reference.brief must open with "[YOUR SUBJECT]"');
  }
  if (ref.status !== undefined && ref.status !== 'draft') errors.push('reference.status may only be "draft"');
  if (ref.status === 'draft' && !isFilled(ref.draftReason)) {
    errors.push('a draft needs a draftReason describing the capture failure');
  }

  if (!/^https?:\/\//i.test(ref.sourceUrl || '')) errors.push('reference.sourceUrl must be an http(s) URL');

  library.forEach(function (entry) {
    if (entry.id === ref.id) errors.push('reference.id "' + ref.id + '" is already in the library');
    if (entry.sourceUrl === ref.sourceUrl) errors.push('sourceUrl is already in the library — this capture is a duplicate');
  });

  var line = curation.parseInboxLines(result.line || '').captures[0];
  if (line && line.url !== ref.sourceUrl) {
    errors.push('reference.sourceUrl must equal the inbox line\'s URL (' + line.url + ')');
  }

  var existingCategory = categories.some(function (c) { return c.id === ref.category; });
  if (result.newCategory) {
    var cat = result.newCategory;
    CATEGORY_TEXT_FIELDS.forEach(function (key) {
      if (!isFilled(cat[key])) errors.push('newCategory.' + key + ' is empty');
    });
    if (!isFilledList(cat.vocabulary)) errors.push('newCategory.vocabulary must be a non-empty list');
    if (isFilled(cat.id) && !KEBAB.test(cat.id)) errors.push('newCategory.id must be kebab-case');
    if (categories.some(function (c) { return c.id === cat.id; })) {
      errors.push('newCategory.id "' + cat.id + '" already exists — assign it instead of creating it');
    }
    if (cat.id !== ref.category) errors.push('reference.category must equal newCategory.id');
    if (!isFilled(result.rejectedCategory)) {
      errors.push('rejectedCategory is required with a newCategory: name the nearest existing category and why it was rejected');
    }
  } else if (isFilled(ref.category) && !existingCategory) {
    errors.push('reference.category "' + ref.category + '" does not exist — assign an existing id or supply newCategory');
  }

  validateDesignSystem(result.designSystem, ref.id, errors);
  return errors;
}

// Validates a standalone extract result: a design system for a reference
// that already exists in the library.
function validateExtractResult(result, state) {
  var errors = [];
  var ds = result && result.designSystem;
  var id = ds && ds.referenceId;
  if (!(state.library || []).some(function (e) { return e.id === id; })) {
    errors.push('designSystem.referenceId "' + id + '" is not a reference in the library');
  }
  validateDesignSystem(ds, id, errors);
  return errors;
}

// Screenshot paths a reference gets, following the existing naming:
// images/<id>.webp, images/<id>-2.webp, ...
function screenshotPaths(id, count) {
  var paths = [];
  for (var i = 0; i < count; i++) {
    paths.push('images/' + id + (i === 0 ? '' : '-' + (i + 1)) + '.webp');
  }
  return paths;
}

// Builds the library entry exactly as serializeLibrary expects it, filling
// the fields the scripts own (screenshots, createdAt, ownerId) so the agent
// never has to.
function buildReference(ref, screenshots, now) {
  var entry = {
    id: ref.id,
    name: ref.name,
    sourceUrl: ref.sourceUrl,
    category: ref.category,
  };
  if (ref.status === 'draft') {
    entry.status = 'draft';
    entry.draftReason = ref.draftReason;
  }
  entry.summary = ref.summary;
  entry.keywords = ref.keywords;
  entry.palette = ref.palette.map(function (h) { return h.toUpperCase(); });
  entry.typeNotes = ref.typeNotes;
  entry.imagePrompt = ref.imagePrompt;
  entry.brief = ref.brief;
  entry.screenshots = screenshots;
  entry.createdAt = now;
  entry.ownerId = 'local';
  return entry;
}

// Replaces the design system for the same referenceId, or appends it.
function upsertDesignSystem(entries, ds) {
  var next = entries.filter(function (e) { return e.referenceId !== ds.referenceId; });
  var index = entries.findIndex(function (e) { return e.referenceId === ds.referenceId; });
  if (index === -1) next.push(ds);
  else next.splice(index, 0, ds);
  return next;
}

module.exports = {
  listInbox: listInbox,
  markFetchFailed: markFetchFailed,
  captureSlug: captureSlug,
  shotPositions: shotPositions,
  validateDrainResult: validateDrainResult,
  validateExtractResult: validateExtractResult,
  screenshotPaths: screenshotPaths,
  buildReference: buildReference,
  upsertDesignSystem: upsertDesignSystem,
};
