const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  formatCaptureLine,
  appendCaptureLine,
  parseInboxLines,
  removeCaptureLine,
  serializeLibrary,
  serializeCategories,
  computePurge,
  computeDesignSystemPurge,
  computeImagePurge,
  resolveDraft,
} = require('../js/curation.js');

function makeLibraryEntry(overrides) {
  return Object.assign(
    {
      id: 'entry-1',
      name: 'Some Site',
      sourceUrl: 'https://example.com',
      category: 'brutalist',
      summary: 'A plain summary.',
      keywords: ['grid', 'monospace'],
      palette: ['#000000'],
      typeNotes: 'System sans throughout.',
      imagePrompt: 'A prompt.',
      brief: '[YOUR SUBJECT] brief text.',
      screenshots: ['images/entry-1.webp'],
      createdAt: '2026-01-01T00:00:00.000Z',
      ownerId: 'local',
    },
    overrides
  );
}

function makeCategoryEntry(overrides) {
  return Object.assign(
    {
      id: 'some-category',
      name: 'Some Category',
      definition: 'A plain definition.',
      description: 'A plain description.',
      vocabulary: ['term one', 'term two'],
    },
    overrides
  );
}

// Parses generated source text back into a real array by actually running
// it as a CommonJS module — the only trustworthy way to check that
// serialised output is syntactically valid JS whose values match, rather
// than eyeballing the text.
function evalLibrarySource(source) {
  var moduleObj = { exports: {} };
  var fn = new Function('module', 'exports', source);
  fn(moduleObj, moduleObj.exports);
  return moduleObj.exports.LIBRARY;
}

function evalCategoriesSource(source) {
  var moduleObj = { exports: {} };
  var fn = new Function('module', 'exports', source);
  fn(moduleObj, moduleObj.exports);
  return moduleObj.exports.CATEGORIES;
}

test('formatCaptureLine: url and note', () => {
  assert.equal(
    formatCaptureLine('https://example.com', 'liked the grain texture'),
    '- https://example.com — liked the grain texture'
  );
});

test('formatCaptureLine: url only, note omitted entirely', () => {
  assert.equal(formatCaptureLine('https://example.com'), '- https://example.com');
  assert.equal(formatCaptureLine('https://example.com', ''), '- https://example.com');
  assert.equal(formatCaptureLine('https://example.com', '   '), '- https://example.com');
});

test('formatCaptureLine: trims surrounding whitespace on both fields', () => {
  assert.equal(
    formatCaptureLine('  https://example.com  ', '  a note  '),
    '- https://example.com — a note'
  );
});

test('formatCaptureLine: collapses internal line breaks and runs of whitespace to one space', () => {
  assert.equal(
    formatCaptureLine('https://example.com', 'first line\nsecond line'),
    '- https://example.com — first line second line'
  );
  assert.equal(
    formatCaptureLine('https://example.com', 'a   note\n\nwith   gaps'),
    '- https://example.com — a note with gaps'
  );
});

test('formatCaptureLine: absent arguments do not throw', () => {
  assert.equal(formatCaptureLine(), '- ');
  assert.equal(formatCaptureLine(undefined, undefined), '- ');
});

test('appendCaptureLine: appends to an empty file', () => {
  assert.equal(
    appendCaptureLine('', 'https://example.com', 'a note'),
    '- https://example.com — a note\n'
  );
});

test('appendCaptureLine: preserves every existing line untouched', () => {
  const existing = '- https://a.com — first\n- https://b.com — second\n';
  const result = appendCaptureLine(existing, 'https://c.com', 'third');
  assert.equal(result, existing + '- https://c.com — third\n');
});

test('appendCaptureLine: adds a missing trailing newline before appending', () => {
  const existing = '- https://a.com — first';
  const result = appendCaptureLine(existing, 'https://b.com', 'second');
  assert.equal(result, '- https://a.com — first\n- https://b.com — second\n');
});

test('appendCaptureLine: tolerates blank lines and comments already in the file', () => {
  const existing = '\n# a comment\n\n- https://a.com — first\n';
  const result = appendCaptureLine(existing, 'https://b.com', '');
  assert.equal(result, existing + '- https://b.com\n');
});

test('appendCaptureLine: a null or undefined existing file is treated as empty', () => {
  assert.equal(appendCaptureLine(null, 'https://a.com', ''), '- https://a.com\n');
  assert.equal(appendCaptureLine(undefined, 'https://a.com', ''), '- https://a.com\n');
});

test('parseInboxLines: a well-formed line with a note', () => {
  const result = parseInboxLines('- https://example.com — liked the grain texture\n');
  assert.deepEqual(result.captures, [
    {
      url: 'https://example.com',
      note: 'liked the grain texture',
      line: '- https://example.com — liked the grain texture',
    },
  ]);
  assert.deepEqual(result.malformed, []);
});

test('parseInboxLines: a well-formed line with no note', () => {
  const result = parseInboxLines('- https://example.com\n');
  assert.deepEqual(result.captures, [
    { url: 'https://example.com', note: '', line: '- https://example.com' },
  ]);
  assert.deepEqual(result.malformed, []);
});

test('parseInboxLines: multiple lines, in order', () => {
  const result = parseInboxLines('- https://a.com — first\n- https://b.com\n');
  assert.deepEqual(
    result.captures.map((c) => c.url),
    ['https://a.com', 'https://b.com']
  );
});

test('parseInboxLines: blank lines are tolerated and produce no capture or malformed entry', () => {
  const result = parseInboxLines('\n   \n- https://a.com\n\n');
  assert.equal(result.captures.length, 1);
  assert.equal(result.malformed.length, 0);
});

test('parseInboxLines: comment lines (starting with #) are tolerated', () => {
  const result = parseInboxLines('# Inbox\n\nSome prose about the format.\n- https://a.com\n');
  assert.equal(result.captures.length, 1);
  assert.equal(result.malformed.length, 1);
  assert.equal(result.malformed[0].line, 'Some prose about the format.');
});

test('parseInboxLines: the real inbox.md header (every line commented) yields no malformed entries', () => {
  const header =
    '# Inbox\n#\n# Captured-but-unanalysed references. One line per capture: `- <url> — <optional note>`.\n# Appended to by the app\'s Add control and by the collector\'s capture Shortcut. Drained by the\n# agent — see `.scratch/curation-loop/spec.md`.\n';
  const result = parseInboxLines(header + '- https://a.com\n');
  assert.deepEqual(result.malformed, []);
  assert.equal(result.captures.length, 1);
});

test('parseInboxLines: a line missing the leading "- " is reported as malformed, not dropped', () => {
  const result = parseInboxLines('https://example.com no dash prefix\n');
  assert.equal(result.captures.length, 0);
  assert.equal(result.malformed.length, 1);
  assert.equal(result.malformed[0].line, 'https://example.com no dash prefix');
  assert.ok(result.malformed[0].reason);
});

test('parseInboxLines: a line with an empty URL is reported as malformed', () => {
  const result = parseInboxLines('- — just a note, no url\n');
  assert.equal(result.captures.length, 0);
  assert.equal(result.malformed.length, 1);
});

test('parseInboxLines: a line whose URL has no scheme is reported as malformed', () => {
  const result = parseInboxLines('- not-a-url — some note\n');
  assert.equal(result.captures.length, 0);
  assert.equal(result.malformed.length, 1);
});

test('parseInboxLines: does not throw on malformed input', () => {
  assert.doesNotThrow(() => parseInboxLines('- \n---\n#\n'));
});

test('parseInboxLines: an empty file yields no captures and no error', () => {
  assert.deepEqual(parseInboxLines(''), { captures: [], malformed: [] });
});

test('parseInboxLines: an absent file (null/undefined) yields no captures and no error', () => {
  assert.deepEqual(parseInboxLines(null), { captures: [], malformed: [] });
  assert.deepEqual(parseInboxLines(undefined), { captures: [], malformed: [] });
});

test('removeCaptureLine: removes the matching line and preserves the rest', () => {
  const existing = '- https://a.com — first\n- https://b.com — second\n- https://c.com — third\n';
  const result = removeCaptureLine(existing, '- https://b.com — second');
  assert.equal(result, '- https://a.com — first\n- https://c.com — third\n');
});

test('removeCaptureLine: preserves comments and blank lines around the removed line', () => {
  const existing = '# Inbox\n\n- https://a.com — first\n- https://b.com — second\n';
  const result = removeCaptureLine(existing, '- https://a.com — first');
  assert.equal(result, '# Inbox\n\n- https://b.com — second\n');
});

test('removeCaptureLine: removing a line not present leaves the text unchanged', () => {
  const existing = '- https://a.com — first\n';
  assert.equal(removeCaptureLine(existing, '- https://z.com — missing'), existing);
});

test('removeCaptureLine: removing from an empty or absent file yields an empty result without error', () => {
  assert.equal(removeCaptureLine('', '- https://a.com'), '');
  assert.equal(removeCaptureLine(null, '- https://a.com'), '');
  assert.equal(removeCaptureLine(undefined, '- https://a.com'), '');
});

test('removeCaptureLine: only removes the first matching occurrence', () => {
  const existing = '- https://a.com\n- https://a.com\n';
  const result = removeCaptureLine(existing, '- https://a.com');
  assert.equal(result, '- https://a.com\n');
});

test('serializeLibrary: round-trips the real data/library.js byte-identically when no data has changed', () => {
  const filePath = path.join(__dirname, '..', 'data', 'library.js');
  const onDisk = fs.readFileSync(filePath, 'utf8');
  const { LIBRARY } = require('../data/library.js');
  assert.equal(serializeLibrary(LIBRARY), onDisk);
});

test('serializeLibrary: output re-parses to equivalent data via a real JS eval', () => {
  const entries = [
    makeLibraryEntry({ id: 'a', name: 'Site A' }),
    makeLibraryEntry({ id: 'b', name: 'Site B', keywords: ['one'] }),
  ];
  const parsed = evalLibrarySource(serializeLibrary(entries));
  assert.deepEqual(parsed, entries);
});

test('serializeLibrary: an apostrophe in a field round-trips correctly', () => {
  const entries = [makeLibraryEntry({ summary: "It's a site with an apostrophe." })];
  const source = serializeLibrary(entries);
  assert.ok(source.indexOf('"It\'s a site with an apostrophe."') !== -1);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: a double quote in a field round-trips correctly', () => {
  const entries = [makeLibraryEntry({ typeNotes: 'A "quoted" word.' })];
  const source = serializeLibrary(entries);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: a field with both an apostrophe and a double quote round-trips correctly', () => {
  const entries = [makeLibraryEntry({ brief: "It's called \"the thing\", apparently." })];
  const source = serializeLibrary(entries);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: embedded newlines inside a brief round-trip correctly', () => {
  const entries = [makeLibraryEntry({ brief: 'First paragraph.\n\nSecond paragraph.' })];
  const source = serializeLibrary(entries);
  assert.ok(source.indexOf('\\n\\n') !== -1);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: non-ASCII in names and summaries round-trips correctly', () => {
  const entries = [
    makeLibraryEntry({ name: 'Café Ünïcode — 日本語', summary: 'Emoji test: 🎨✨' }),
  ];
  const source = serializeLibrary(entries);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: a backslash in a field round-trips correctly', () => {
  const entries = [makeLibraryEntry({ summary: 'A path like C:\\Users\\x and a \\n literal.' })];
  const source = serializeLibrary(entries);
  assert.deepEqual(evalLibrarySource(source), entries);
});

test('serializeLibrary: keeps one readable multi-line block with keywords one-per-line', () => {
  const entries = [makeLibraryEntry({ keywords: ['one', 'two', 'three'] })];
  const source = serializeLibrary(entries);
  assert.ok(source.indexOf("    keywords: [\n      'one',\n      'two',\n      'three',\n    ],") !== -1);
});

test('serializeLibrary: an empty array yields empty entries and no error', () => {
  assert.equal(serializeLibrary([]), serializeLibrary([]));
  assert.ok(serializeLibrary([]).indexOf('const LIBRARY = [\n];') !== -1);
});

test('serializeLibrary: an optional status/draftReason pair is included only when present', () => {
  const withDraft = makeLibraryEntry({ status: 'draft', draftReason: 'Fits no existing category.' });
  const source = serializeLibrary([withDraft]);
  assert.deepEqual(evalLibrarySource(source), [withDraft]);
  assert.ok(source.indexOf("status: 'draft'") !== -1);
  assert.ok(source.indexOf("draftReason: 'Fits no existing category.'") !== -1);

  const withoutDraft = makeLibraryEntry();
  const source2 = serializeLibrary([withoutDraft]);
  assert.equal(source2.indexOf('status:'), -1);
  assert.equal(source2.indexOf('draftReason:'), -1);
});

test('serializeCategories: round-trips the real data/categories.js byte-identically when no data has changed', () => {
  const filePath = path.join(__dirname, '..', 'data', 'categories.js');
  const onDisk = fs.readFileSync(filePath, 'utf8');
  const { CATEGORIES } = require('../data/categories.js');
  assert.equal(serializeCategories(CATEGORIES), onDisk);
});

test('serializeCategories: output re-parses to equivalent data via a real JS eval', () => {
  const categories = [
    makeCategoryEntry({ id: 'a', name: 'Category A' }),
    makeCategoryEntry({ id: 'b', name: 'Category B', vocabulary: ['one'] }),
  ];
  const parsed = evalCategoriesSource(serializeCategories(categories));
  assert.deepEqual(parsed, categories);
});

test('serializeCategories: appending a category leaves every existing block untouched', () => {
  const { CATEGORIES } = require('../data/categories.js');
  const before = serializeCategories(CATEGORIES);
  const after = serializeCategories(CATEGORIES.concat([makeCategoryEntry({ id: 'new-one' })]));
  assert.equal(after.indexOf(before.slice(0, before.lastIndexOf('];'))), 0);
});

test('serializeCategories: a definition or description containing an apostrophe round-trips without escaping artefacts', () => {
  const categories = [
    makeCategoryEntry({ definition: "It's a definition.", description: "It's a description." }),
  ];
  const source = serializeCategories(categories);
  assert.ok(source.indexOf('"It\'s a definition."') !== -1);
  assert.ok(source.indexOf('"It\'s a description."') !== -1);
  assert.deepEqual(evalCategoriesSource(source), categories);
});

test('serializeCategories: the vocabulary list serialises as a multi-line block matching the existing style', () => {
  const categories = [makeCategoryEntry({ vocabulary: ['one', 'two', 'three'] })];
  const source = serializeCategories(categories);
  assert.ok(source.indexOf("    vocabulary: [\n      'one',\n      'two',\n      'three',\n    ],") !== -1);
});

test('serializeCategories: field order matches the existing file exactly', () => {
  const categories = [makeCategoryEntry()];
  const source = serializeCategories(categories);
  const idIndex = source.indexOf('id:');
  const nameIndex = source.indexOf('name:');
  const definitionIndex = source.indexOf('definition:');
  const descriptionIndex = source.indexOf('description:');
  const vocabularyIndex = source.indexOf('vocabulary:');
  assert.ok(idIndex < nameIndex);
  assert.ok(nameIndex < definitionIndex);
  assert.ok(definitionIndex < descriptionIndex);
  assert.ok(descriptionIndex < vocabularyIndex);
});

test('serializeCategories: an empty array yields empty entries and no error', () => {
  assert.equal(serializeCategories([]), serializeCategories([]));
  assert.ok(serializeCategories([]).indexOf('const CATEGORIES = [\n];') !== -1);
});

test('computePurge: computes the right remaining references and clears the acted-on tombstones', () => {
  const entries = [makeLibraryEntry({ id: 'a' }), makeLibraryEntry({ id: 'b' }), makeLibraryEntry({ id: 'c' })];
  const result = computePurge(entries, ['b']);
  assert.deepEqual(result.remaining.map((e) => e.id), ['a', 'c']);
  assert.deepEqual(result.removed.map((e) => e.id), ['b']);
  assert.deepEqual(result.clearedIds, ['b']);
});

test('computePurge: a tombstone referring to a reference that no longer exists is ignored without error', () => {
  const entries = [makeLibraryEntry({ id: 'a' })];
  const result = computePurge(entries, ['does-not-exist']);
  assert.deepEqual(result.remaining.map((e) => e.id), ['a']);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.clearedIds, ['does-not-exist']);
});

test('computePurge: no tombstones is a no-op that changes nothing', () => {
  const entries = [makeLibraryEntry({ id: 'a' }), makeLibraryEntry({ id: 'b' })];
  const result = computePurge(entries, []);
  assert.deepEqual(result.remaining, entries);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.clearedIds, []);
});

test('resolveDraft: assigns the category and strips status and draftReason', () => {
  const draft = makeLibraryEntry({ id: 'a', status: 'draft', draftReason: 'fits nothing yet' });
  const result = resolveDraft([draft], 'a', 'terminal-noir');
  assert.equal(result[0].category, 'terminal-noir');
  assert.equal('status' in result[0], false);
  assert.equal('draftReason' in result[0], false);
});

test('resolveDraft: leaves every other entry untouched', () => {
  const draft = makeLibraryEntry({ id: 'a', status: 'draft', draftReason: 'fits nothing yet' });
  const other = makeLibraryEntry({ id: 'b' });
  const result = resolveDraft([draft, other], 'a', 'terminal-noir');
  assert.deepEqual(result[1], other);
  assert.deepEqual(result.map((e) => e.id), ['a', 'b']);
});

test('resolveDraft: an id that matches nothing leaves the array unchanged', () => {
  const entries = [makeLibraryEntry({ id: 'a', status: 'draft', draftReason: 'fits nothing yet' })];
  const result = resolveDraft(entries, 'does-not-exist', 'terminal-noir');
  assert.deepEqual(result, entries);
});

test('resolveDraft: a resolved reference serialises identically to one that was never a draft', () => {
  const draft = makeLibraryEntry({ id: 'a', status: 'draft', draftReason: 'fits nothing yet' });
  const neverDraft = makeLibraryEntry({ id: 'a', category: 'terminal-noir' });
  const [resolved] = resolveDraft([draft], 'a', 'terminal-noir');
  assert.equal(serializeLibrary([resolved]), serializeLibrary([neverDraft]));
});

test('computePurge: tolerates an absent tombstone list', () => {
  const entries = [makeLibraryEntry({ id: 'a' })];
  const result = computePurge(entries, undefined);
  assert.deepEqual(result.remaining, entries);
  assert.deepEqual(result.clearedIds, []);
});

test('computeDesignSystemPurge: drops only the design systems of purged references', () => {
  const systems = [{ referenceId: 'a' }, { referenceId: 'b' }, { referenceId: 'c' }];
  const result = computeDesignSystemPurge(systems, ['b']);
  assert.deepEqual(result.remaining.map((s) => s.referenceId), ['a', 'c']);
  assert.deepEqual(result.removed.map((s) => s.referenceId), ['b']);
});

test('computeDesignSystemPurge: a reference with no design system is a no-op', () => {
  const result = computeDesignSystemPurge([{ referenceId: 'a' }], ['b']);
  assert.equal(result.removed.length, 0);
  assert.equal(result.remaining.length, 1);
});

test('computeImagePurge: lists screenshots of purged references, keeping any a survivor still uses', () => {
  const removed = [makeLibraryEntry({ id: 'b', screenshots: ['images/b.webp', 'images/shared.webp', 'images/b.webp'] })];
  const remaining = [makeLibraryEntry({ id: 'a', screenshots: ['images/a.webp', 'images/shared.webp'] })];
  assert.deepEqual(computeImagePurge(removed, remaining), ['images/b.webp']);
});

const { parseCaptureInput } = require('../js/curation.js');

test('parseCaptureInput: keeps full URLs, adds https:// to bare domains', () => {
  assert.deepEqual(parseCaptureInput(' https://a.com/x \n example.org/work?id=1 '), {
    urls: ['https://a.com/x', 'https://example.org/work?id=1'],
    rejected: [],
  });
});

test('parseCaptureInput: several URLs at once, repeats dropped, junk rejected', () => {
  assert.deepEqual(parseCaptureInput('https://a.com, https://a.com\nhello www.b.io'), {
    urls: ['https://a.com', 'https://www.b.io'],
    rejected: ['hello'],
  });
});

test('parseCaptureInput: empty input', () => {
  assert.deepEqual(parseCaptureInput(''), { urls: [], rejected: [] });
});

test('parseInboxLines: only http(s) links are captures — javascript: and other schemes are malformed', () => {
  const result = parseInboxLines('- javascript://%0aalert(1)\n- file:///etc/passwd\n- http://ok.com\n');
  assert.deepEqual(result.captures.map((c) => c.url), ['http://ok.com']);
  assert.equal(result.malformed.length, 2);
});
