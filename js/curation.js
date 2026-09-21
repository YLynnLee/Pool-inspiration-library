// Pure text<->capture transforms for the curation loop. No DOM, no file
// access — see CONTRIBUTING.md. Loadable both as a
// classic browser <script> and via Node's require() through the CommonJS
// footer below, same convention as js/query.js.

// Collapses internal whitespace (including line breaks a <textarea> note can
// contain) to a single space, so a capture can never split across more than
// the one inbox line the format promises.
function singleLine(value) {
  return (value || '').toString().trim().replace(/\s+/g, ' ');
}

function formatCaptureLine(url, note) {
  var cleanUrl = singleLine(url);
  var cleanNote = singleLine(note);
  return cleanNote ? '- ' + cleanUrl + ' — ' + cleanNote : '- ' + cleanUrl;
}

function appendCaptureLine(existingText, url, note) {
  var text = (existingText || '').toString();
  var line = formatCaptureLine(url, note);
  if (text.length === 0) {
    return line + '\n';
  }
  if (text.charAt(text.length - 1) !== '\n') {
    text += '\n';
  }
  return text + line + '\n';
}

// A URL is well-formed enough to attempt fetching if it declares an http(s)
// scheme. Anything looser is a job for the drain's fetch step, not the
// parser. Other schemes are refused outright: a capture's URL becomes the
// reference's sourceUrl and is rendered as a link, so `javascript:` here
// would run in the app's origin — the one the local helper trusts.
function looksLikeUrl(value) {
  return /^https?:\/\//i.test(value);
}

// Turns inbox.md text into captures, tolerantly. Blank lines and lines
// starting with '#' (comments — inbox.md's own header is written this way
// specifically so parsing skips it) are skipped. Everything else is
// expected to be a capture line in the format
// formatCaptureLine produces; anything that does not parse is reported in
// `malformed` rather than dropped or thrown on, per the drain's obligation
// to never silently lose a line it cannot read.
function parseInboxLines(text) {
  var captures = [];
  var malformed = [];
  var lines = (text || '').toString().split('\n');

  lines.forEach(function (rawLine) {
    var line = rawLine.trim();
    if (line.length === 0 || line.charAt(0) === '#') {
      return;
    }
    if (line.charAt(0) !== '-') {
      malformed.push({ line: line, reason: 'line does not start with "- "' });
      return;
    }

    var rest = line.slice(1).trim();
    var sepIndex = rest.indexOf('—');
    var url = sepIndex === -1 ? rest : rest.slice(0, sepIndex).trim();
    var note = sepIndex === -1 ? '' : rest.slice(sepIndex + 1).trim();

    if (!url) {
      malformed.push({ line: line, reason: 'no URL found' });
      return;
    }
    if (!looksLikeUrl(url)) {
      malformed.push({ line: line, reason: 'URL has no scheme (e.g. https://)' });
      return;
    }

    captures.push({ url: url, note: note, line: line });
  });

  return { captures: captures, malformed: malformed };
}

// Turns whatever the collector typed or pasted into the Add field into the
// URLs to capture: one or many, separated by whitespace or newlines. A bare
// domain ("example.com/work") gets https:// in front; anything else without
// a scheme is handed back in `rejected` rather than guessed at. Repeats
// within the same paste are dropped.
function parseCaptureInput(text) {
  var urls = [];
  var rejected = [];
  (text || '').toString().split(/\s+/).forEach(function (token) {
    var value = token.trim().replace(/[,;]+$/, '');
    if (!value) return;
    if (!looksLikeUrl(value)) {
      if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i.test(value)) {
        value = 'https://' + value;
      } else {
        rejected.push(value);
        return;
      }
    }
    if (urls.indexOf(value) === -1) urls.push(value);
  });
  return { urls: urls, rejected: rejected };
}

// Removes the first line whose trimmed text exactly matches `line` from
// inbox text, preserving every other line untouched — the counterpart to
// appendCaptureLine, used by the drain to strike a capture once its
// reference is in the library. A line that is not found leaves the text
// unchanged, so a drain retrying after an interruption is safe to call
// again.
function removeCaptureLine(text, line) {
  var source = (text || '').toString();
  if (source.length === 0) {
    return source;
  }
  var target = (line || '').toString().trim();
  var lines = source.split('\n');
  var removed = false;
  var next = lines.filter(function (rawLine) {
    if (!removed && rawLine.trim() === target) {
      removed = true;
      return false;
    }
    return true;
  });
  return next.join('\n');
}

// ---- library serialisation (data/library.js round trip) -----------------
// See CONTRIBUTING.md: the data file's shape is a
// contract. Hand-editability depends on generated output matching the
// existing one-block-per-reference format exactly, byte for byte, when no
// data has actually changed — that is what the round-trip test checks.

var LIBRARY_HEADER =
  [
    '// Library data: classic script assigning a global, loaded via a plain',
    '// <script> tag. Browsers block both fetch() and <script type="module"> on',
    '// file://, so this stays hand-editable data in a script, not JSON.',
    '//',
    '// One clear block per entry — open this file directly to fix a typo without',
    '// depending on Claude.',
    '',
    'const LIBRARY = [',
  ].join('\n') + '\n';

var LIBRARY_FOOTER =
  [
    '];',
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = { LIBRARY };',
    '}',
  ].join('\n') + '\n';

// Fixed per-field layout, in the order every existing block already uses.
// status/draftReason are optional and only emitted when present,
// so a reference with neither keeps serialising exactly as before.
var ENTRY_FIELDS = [
  { key: 'id', type: 'inline-string' },
  { key: 'name', type: 'inline-string' },
  { key: 'sourceUrl', type: 'inline-string' },
  { key: 'category', type: 'inline-string' },
  { key: 'status', type: 'inline-string', optional: true },
  { key: 'draftReason', type: 'inline-string', optional: true },
  { key: 'summary', type: 'multiline-string' },
  { key: 'keywords', type: 'multiline-array' },
  { key: 'palette', type: 'inline-array' },
  { key: 'typeNotes', type: 'multiline-string' },
  { key: 'imagePrompt', type: 'multiline-string' },
  { key: 'brief', type: 'multiline-string' },
  { key: 'screenshots', type: 'inline-array' },
  { key: 'createdAt', type: 'inline-string' },
  { key: 'ownerId', type: 'inline-string' },
];

// Picks the delimiter that needs no escaping when one is available (an
// apostrophe-only string quotes with ", a quote-only string quotes with '),
// falling back to ' with escaping for a string that has both. Matches every
// field already in data/library.js, none of which currently mixes the two.
function quoteJs(value) {
  var str = value == null ? '' : String(value);
  var hasApostrophe = str.indexOf("'") !== -1;
  var hasDoubleQuote = str.indexOf('"') !== -1;
  var quoteChar = hasApostrophe && !hasDoubleQuote ? '"' : "'";
  var escaped = str
    .replace(/\\/g, '\\\\')
    .replace(new RegExp(quoteChar, 'g'), '\\' + quoteChar)
    .replace(/\n/g, '\\n');
  return quoteChar + escaped + quoteChar;
}

function inlineStringField(key, value) {
  return '    ' + key + ': ' + quoteJs(value) + ',';
}

function multilineStringField(key, value) {
  return '    ' + key + ':\n      ' + quoteJs(value) + ',';
}

function inlineArrayField(key, arr) {
  return '    ' + key + ': [' + (arr || []).map(quoteJs).join(', ') + '],';
}

function multilineArrayField(key, arr) {
  if (!arr || arr.length === 0) {
    return '    ' + key + ': [],';
  }
  var lines = arr.map(function (item) {
    return '      ' + quoteJs(item) + ',';
  });
  return '    ' + key + ': [\n' + lines.join('\n') + '\n    ],';
}

function serializeBlock(entry, fields) {
  var lines = [];
  fields.forEach(function (field) {
    var value = entry[field.key];
    if (field.optional && (value === undefined || value === null)) {
      return;
    }
    if (field.type === 'inline-string') {
      lines.push(inlineStringField(field.key, value));
    } else if (field.type === 'multiline-string') {
      lines.push(multilineStringField(field.key, value));
    } else if (field.type === 'inline-array') {
      lines.push(inlineArrayField(field.key, value));
    } else if (field.type === 'multiline-array') {
      lines.push(multilineArrayField(field.key, value));
    } else if (field.type === 'nested') {
      lines.push(nestedField(field.key, value));
    }
  });
  return '  {\n' + lines.join('\n') + '\n  },\n';
}

// The one function that rewrites a data file byte for byte.
// Produces the complete source text of a generated data file — a header, one
// block per entry laid out per `fields`, and a footer — byte for byte
// identical to the hand-editable file it replaces when no data has changed.
// Generalised so every generated data file (the library, and the categories
// file after it) shares this instead of duplicating the block-writing rules.
function serializeDataFile(entries, header, footer, fields) {
  var body = (entries || []).map(function (entry) {
    return serializeBlock(entry, fields);
  }).join('');
  return header + body + footer;
}

// Produces the complete source text of data/library.js from an entries
// array — used by both purge and the drain
// to add a new reference.
function serializeLibrary(entries) {
  return serializeDataFile(entries, LIBRARY_HEADER, LIBRARY_FOOTER, ENTRY_FIELDS);
}

// ---- categories serialisation (data/categories.js round trip) -----------
// Same contract as the library — byte-identical when unchanged — and the same
// one-block-per-category, byte-identical-when-unchanged shape.

var CATEGORIES_HEADER =
  [
    '// Categories: classic script assigning a global, loaded via a plain',
    '// <script> tag (no fetch, no ES modules — file:// blocks both).',
    '//',
    '// Deliberately small, and meant to be re-cut once',
    '// roughly ten real references exist, so it is grown from what actually gets',
    '// captured rather than invented up front.',
    '',
    'const CATEGORIES = [',
  ].join('\n') + '\n';

var CATEGORIES_FOOTER =
  [
    '];',
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = { CATEGORIES };',
    '}',
  ].join('\n') + '\n';

// Fixed per-field layout, matching the order every existing block already
// uses.
var CATEGORY_FIELDS = [
  { key: 'id', type: 'inline-string' },
  { key: 'name', type: 'inline-string' },
  { key: 'definition', type: 'multiline-string' },
  { key: 'description', type: 'multiline-string' },
  { key: 'vocabulary', type: 'multiline-array' },
];

// Produces the complete source text of data/categories.js from a categories
// array — the seam a drain uses to add a category.
function serializeCategories(categories) {
  return serializeDataFile(categories, CATEGORIES_HEADER, CATEGORIES_FOOTER, CATEGORY_FIELDS);
}

// Given the full entries array and the tombstone (hidden-id) list, computes
// what a purge should do: which references survive, which are removed, and
// which tombstones can be cleared. A tombstone with no matching entry is
// cleared too — there is nothing left to hide once the record is gone.
function computePurge(entries, hiddenIds) {
  var hidden = {};
  (hiddenIds || []).forEach(function (id) {
    hidden[id] = true;
  });
  var remaining = [];
  var removed = [];
  (entries || []).forEach(function (entry) {
    if (hidden[entry.id]) {
      removed.push(entry);
    } else {
      remaining.push(entry);
    }
  });
  return { remaining: remaining, removed: removed, clearedIds: (hiddenIds || []).slice() };
}

// Given the design-systems array and the ids of purged references, returns
// the design systems that survive and the ones that go with them.
function computeDesignSystemPurge(systems, removedIds) {
  var gone = {};
  (removedIds || []).forEach(function (id) {
    gone[id] = true;
  });
  var remaining = [];
  var removed = [];
  (systems || []).forEach(function (system) {
    if (gone[system.referenceId]) {
      removed.push(system);
    } else {
      remaining.push(system);
    }
  });
  return { remaining: remaining, removed: removed };
}

// Screenshot paths that belong only to the purged references. A path a
// surviving reference still lists is kept, so a purge never breaks another
// tile's image.
function computeImagePurge(removedEntries, remainingEntries) {
  var kept = {};
  (remainingEntries || []).forEach(function (entry) {
    (entry.screenshots || []).forEach(function (path) {
      kept[path] = true;
    });
  });
  var seen = {};
  var paths = [];
  (removedEntries || []).forEach(function (entry) {
    (entry.screenshots || []).forEach(function (path) {
      if (!kept[path] && !seen[path]) {
        seen[path] = true;
        paths.push(path);
      }
    });
  });
  return paths;
}

// Assigns `categoryId` to the entry matching `id` and drops status/draftReason,
// so a resolved reference serialises identically to one that was never
// parked. Every other entry passes through unchanged, by
// reference, so callers get a minimal diff from serializeLibrary.
function resolveDraft(entries, id, categoryId) {
  return (entries || []).map(function (entry) {
    if (!entry || entry.id !== id) return entry;
    var next = {};
    Object.keys(entry).forEach(function (key) {
      if (key === 'status' || key === 'draftReason') return;
      next[key] = entry[key];
    });
    next.category = categoryId;
    return next;
  });
}

// ---- design systems serialisation (data/design-systems.js round trip) ---
// Same contract as the library and categories files. Entry shape
// (referenceId, colors, typography, fonts, rounded, spacing, components,
// omitted, sections) is nested rather than flat, so blocks use the generic
// `nested` field type below instead of the library's inline/multiline types.

var DESIGN_SYSTEMS_HEADER =
  [
    '// Design systems: classic script assigning a global, loaded via a plain',
    '// <script> tag (no fetch, no ES modules — file:// blocks both).',
    '//',
    '// One block per reference, keyed by referenceId. Written by the extraction',
    '// procedure (docs/agents/extract.md); serialised to DESIGN.md text on',
    '// download by serializeDesignMd in this file.',
    '',
    'const DESIGN_SYSTEMS = [',
  ].join('\n') + '\n';

var DESIGN_SYSTEMS_FOOTER =
  [
    '];',
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = { DESIGN_SYSTEMS };',
    '}',
  ].join('\n') + '\n';

// Pretty-prints an arbitrary JS value (string/number/boolean/array/plain
// object) as a JS literal, recursively, reusing quoteJs for leaf strings.
// This is what lets nested fields (colors, typography, components, ...)
// stay hand-readable without a bespoke per-shape writer for each one.
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function serializeValue(value, indent) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'string') {
    return quoteJs(value);
  }
  var innerIndent = indent + '  ';
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    var items = value.map(function (item) {
      return innerIndent + serializeValue(item, innerIndent) + ',';
    });
    return '[\n' + items.join('\n') + '\n' + indent + ']';
  }
  if (isPlainObject(value)) {
    var keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    var lines = keys.map(function (key) {
      return innerIndent + serializeObjectKey(key) + ': ' + serializeValue(value[key], innerIndent) + ',';
    });
    return '{\n' + lines.join('\n') + '\n' + indent + '}';
  }
  throw new Error('serializeValue: unsupported value type');
}

// Design-system token names are frequently not valid bare JS identifiers
// (Google's own naming convention includes hyphens, e.g. `body-md`), so a
// key only prints bare when it actually is one.
var VALID_JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function serializeObjectKey(key) {
  return VALID_JS_IDENTIFIER.test(key) ? key : quoteJs(key);
}

function nestedField(key, value) {
  return '    ' + key + ': ' + serializeValue(value, '    ') + ',';
}

var DESIGN_SYSTEM_FIELDS = [
  { key: 'referenceId', type: 'inline-string' },
  { key: 'name', type: 'inline-string' },
  { key: 'description', type: 'multiline-string' },
  { key: 'colors', type: 'nested' },
  { key: 'typography', type: 'nested' },
  { key: 'fonts', type: 'nested', optional: true },
  { key: 'rounded', type: 'nested', optional: true },
  { key: 'spacing', type: 'nested', optional: true },
  { key: 'components', type: 'nested', optional: true },
  { key: 'omitted', type: 'nested', optional: true },
  { key: 'sections', type: 'nested' },
];

// Produces the complete source text of data/design-systems.js from an
// entries array — the seam a drain (and `/extract`) uses to write a
// reference's design system.
function serializeDesignSystems(entries) {
  return serializeDataFile(entries, DESIGN_SYSTEMS_HEADER, DESIGN_SYSTEMS_FOOTER, DESIGN_SYSTEM_FIELDS);
}

// ---- DESIGN.md serialisation ---------------------------------------------
// Turns one data/design-systems.js entry into Google-format DESIGN.md text,
// strictly per docs/spec.md in google-labs-code/design.md (dumped locally
// via `npx @google/design.md spec`). Pure, no DOM — see
// docs/agents/extract.md.
//
// `colors[key].displayName` / `.role` and the `fonts` array exist only for
// the app's swatch labels and for hand-written `## Colors` / `## Typography`
// prose (already sitting in `entry.sections`, written by the extraction
// procedure) — this function never reads them into the YAML.

// Canonical section order. Google
// accepts a couple of heading aliases (e.g. "Brand & Style" for Overview);
// this repo always emits the primary name, matching the app's own
// DESIGN.md at the repo root.
var DESIGN_MD_SECTION_ORDER = [
  { key: 'overview', heading: 'Overview' },
  { key: 'colors', heading: 'Colors' },
  { key: 'typography', heading: 'Typography' },
  { key: 'layout', heading: 'Layout' },
  { key: 'elevation', heading: 'Elevation & Depth' },
  { key: 'shapes', heading: 'Shapes' },
  { key: 'components', heading: 'Components' },
  { key: 'dosAndDonts', heading: "Do's and Don'ts" },
];

// A YAML plain scalar is unsafe once it starts with an indicator character,
// carries a "key: value"-shaping colon or "space-hash" comment marker,
// leading/trailing whitespace, or reads as a reserved word/bare number —
// each of those needs real quoting instead. Everything else (including a
// hyphen or colon *not* followed by a space, like "-0.02em" or "16:9")
// prints bare, matching the style of the google-labs-code/design.md
// examples and this repo's own DESIGN.md.
function needsYamlQuoting(str) {
  if (str === '') return true;
  if (/^[#&*!|>'"%@`,[\]{}]/.test(str)) return true;
  if (/^[-?:](\s|$)/.test(str)) return true;
  if (/^\s|\s$/.test(str)) return true;
  if (/:\s|\s#/.test(str)) return true;
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(str)) return true;
  if (/^-?\d+(\.\d+)?$/.test(str)) return true;
  return false;
}

function yamlScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  var str = value == null ? '' : String(value);
  if (!needsYamlQuoting(str)) {
    return str;
  }
  var escaped = str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
  return '"' + escaped + '"';
}

function yamlKeyLine(indent, key, value) {
  return indent + key + ': ' + yamlScalar(value);
}

// Semantic colour keys only — `.displayName` / `.role` stop here (spec.md's
// "Shape of the data": colors is a semantic key -> { value, displayName,
// role } map; only .value is a Google field).
function buildColorsYaml(colors) {
  var keys = Object.keys(colors || {});
  if (keys.length === 0) return null;
  var lines = ['colors:'];
  keys.forEach(function (key) {
    lines.push(yamlKeyLine('  ', key, colors[key].value));
  });
  return lines.join('\n');
}

var TYPOGRAPHY_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'fontFeature',
  'fontVariation',
];

function buildTypographyYaml(typography) {
  var keys = Object.keys(typography || {});
  if (keys.length === 0) return null;
  var lines = ['typography:'];
  keys.forEach(function (token) {
    var props = typography[token] || {};
    lines.push('  ' + token + ':');
    TYPOGRAPHY_PROPS.forEach(function (prop) {
      if (props[prop] === undefined || props[prop] === null) return;
      lines.push(yamlKeyLine('    ', prop, props[prop]));
    });
  });
  return lines.join('\n');
}

// Shared by `rounded` and `spacing` — both are a flat named-level -> value
// map. `spacing` records its base unit as just another named level (the
// spec's own example uses `unit`/`base`), not a special case here.
function buildFlatScaleYaml(sectionKey, scale) {
  var keys = Object.keys(scale || {});
  if (keys.length === 0) return null;
  var lines = [sectionKey + ':'];
  keys.forEach(function (level) {
    lines.push(yamlKeyLine('  ', level, scale[level]));
  });
  return lines.join('\n');
}

var COMPONENT_PROPS = [
  'backgroundColor',
  'textColor',
  'typography',
  'rounded',
  'padding',
  'size',
  'height',
  'width',
];

function buildComponentsYaml(components) {
  var keys = Object.keys(components || {});
  if (keys.length === 0) return null;
  var lines = ['components:'];
  keys.forEach(function (name) {
    var props = components[name] || {};
    lines.push('  ' + name + ':');
    var seen = {};
    COMPONENT_PROPS.forEach(function (prop) {
      if (props[prop] === undefined || props[prop] === null) return;
      seen[prop] = true;
      lines.push(yamlKeyLine('    ', prop, props[prop]));
    });
    Object.keys(props).forEach(function (prop) {
      if (seen[prop]) return;
      lines.push(yamlKeyLine('    ', prop, props[prop]));
    });
  });
  return lines.join('\n');
}

// Google's own array, string or `{ section, reason }` form, both preserved.
function buildOmittedYaml(omitted) {
  if (!omitted || omitted.length === 0) return null;
  var lines = ['omitted:'];
  omitted.forEach(function (item) {
    if (typeof item === 'string') {
      lines.push('  - ' + yamlScalar(item));
      return;
    }
    if (item && item.section) {
      lines.push('  - section: ' + yamlScalar(item.section));
      if (item.reason) {
        lines.push('    reason: ' + yamlScalar(item.reason));
      }
    }
  });
  return lines.join('\n');
}

// Splits a `sections.dosAndDonts` string (the "### Do:" / "### Don't:"
// markdown convention written by the extraction procedure) into two plain
// lists, so the app can render them as separate columns rather than one
// undifferentiated prose block. Bold markers are stripped since the app
// renders items as plain list text, not markdown. Unrecognised text (no
// heading matched yet) is ignored rather than guessed into a bucket.
var DOS_HEADING_RE = /^#*\s*do:?$/i;
var DONTS_HEADING_RE = /^#*\s*don.?t:?$/i;
var LIST_ITEM_RE = /^[-*]\s+(.*)$/;

function stripMarkdownEmphasis(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

function parseDosAndDonts(text) {
  var dos = [];
  var donts = [];
  var current = null;
  String(text || '').split('\n').forEach(function (line) {
    var trimmed = line.trim();
    if (!trimmed) return;
    if (DOS_HEADING_RE.test(trimmed)) {
      current = dos;
      return;
    }
    if (DONTS_HEADING_RE.test(trimmed)) {
      current = donts;
      return;
    }
    var item = trimmed.match(LIST_ITEM_RE);
    if (item && current) {
      current.push(stripMarkdownEmphasis(item[1]));
    }
  });
  return { dos: dos, donts: donts };
}

// entry -> DESIGN.md text.
function serializeDesignMd(entry) {
  var e = entry || {};

  var yamlBlocks = [yamlKeyLine('', 'name', e.name)];
  if (e.description) {
    yamlBlocks.push(yamlKeyLine('', 'description', e.description));
  }
  [
    buildOmittedYaml(e.omitted),
    buildColorsYaml(e.colors),
    buildTypographyYaml(e.typography),
    buildFlatScaleYaml('rounded', e.rounded),
    buildFlatScaleYaml('spacing', e.spacing),
    buildComponentsYaml(e.components),
  ].forEach(function (block) {
    if (block) yamlBlocks.push(block);
  });

  var proseBlocks = [];
  DESIGN_MD_SECTION_ORDER.forEach(function (section) {
    var text = e.sections && e.sections[section.key];
    if (!text) return;
    proseBlocks.push('## ' + section.heading + '\n\n' + String(text).trim() + '\n');
  });

  return '---\n' + yamlBlocks.join('\n') + '\n---\n\n' + proseBlocks.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatCaptureLine,
    appendCaptureLine,
    parseInboxLines,
    parseCaptureInput,
    removeCaptureLine,
    serializeDataFile,
    serializeLibrary,
    serializeCategories,
    serializeDesignSystems,
    serializeDesignMd,
    parseDosAndDonts,
    computePurge,
    computeDesignSystemPurge,
    computeImagePurge,
    resolveDraft,
  };
}
