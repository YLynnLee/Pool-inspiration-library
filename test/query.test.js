const test = require('node:test');
const assert = require('node:assert/strict');
const { filterEntries, sortEntries, visibleEntries, isDraft, draftEntries, applyDraftVisibility } = require('../js/query.js');

function makeEntry(overrides) {
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

test('filterEntries: substring match on name', () => {
  const entries = [makeEntry({ id: 'a', name: 'Voxel Landscape' }), makeEntry({ id: 'b', name: 'Serif Green' })];
  const result = filterEntries(entries, { query: 'voxel' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: substring match on summary', () => {
  const entries = [
    makeEntry({ id: 'a', summary: 'A landing page with a voxel-rendered hill.' }),
    makeEntry({ id: 'b', summary: 'Nothing relevant here.' }),
  ];
  const result = filterEntries(entries, { query: 'voxel-rendered' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: substring match on keywords', () => {
  const entries = [
    makeEntry({ id: 'a', keywords: ['acid green', 'type collage'] }),
    makeEntry({ id: 'b', keywords: ['monospace'] }),
  ];
  const result = filterEntries(entries, { query: 'type collage' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: substring match on category', () => {
  const entries = [makeEntry({ id: 'a', category: 'kinetic-editorial' }), makeEntry({ id: 'b', category: 'brutalist' })];
  const result = filterEntries(entries, { query: 'kinetic' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: query is case-insensitive', () => {
  const entries = [makeEntry({ id: 'a', name: 'Lando Norris' })];
  assert.deepEqual(filterEntries(entries, { query: 'LANDO' }).map((e) => e.id), ['a']);
  assert.deepEqual(filterEntries(entries, { query: 'lando' }).map((e) => e.id), ['a']);
  assert.deepEqual(filterEntries(entries, { query: 'LaNdO' }).map((e) => e.id), ['a']);
});

test('filterEntries: category filter is case-insensitive', () => {
  const entries = [makeEntry({ id: 'a', category: 'Kinetic-Editorial' })];
  assert.deepEqual(filterEntries(entries, { category: 'kinetic-editorial' }).map((e) => e.id), ['a']);
});

test('filterEntries: category and query combine with AND', () => {
  const entries = [
    makeEntry({ id: 'a', category: 'kinetic-editorial', name: 'Lando Norris' }),
    makeEntry({ id: 'b', category: 'brutalist', name: 'Lando Something' }),
    makeEntry({ id: 'c', category: 'kinetic-editorial', name: 'Unrelated' }),
  ];
  const result = filterEntries(entries, { category: 'kinetic-editorial', query: 'lando' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: keyword filter matches exact keyword case-insensitively', () => {
  const entries = [
    makeEntry({ id: 'a', keywords: ['Acid Green', 'type collage'] }),
    makeEntry({ id: 'b', keywords: ['acid'] }),
  ];
  const result = filterEntries(entries, { keyword: 'acid green' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: keyword filter combines with category and query via AND', () => {
  const entries = [
    makeEntry({ id: 'a', category: 'kinetic-editorial', name: 'Lando', keywords: ['acid green'] }),
    makeEntry({ id: 'b', category: 'kinetic-editorial', name: 'Lando', keywords: ['monospace'] }),
  ];
  const result = filterEntries(entries, { category: 'kinetic-editorial', query: 'lando', keyword: 'acid green' });
  assert.deepEqual(result.map((e) => e.id), ['a']);
});

test('filterEntries: empty, absent and whitespace-only criteria are ignored', () => {
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
  assert.equal(filterEntries(entries, { query: '' }).length, 2);
  assert.equal(filterEntries(entries, { query: '   ' }).length, 2);
  assert.equal(filterEntries(entries, {}).length, 2);
  assert.equal(filterEntries(entries, undefined).length, 2);
  assert.equal(filterEntries(entries, { category: '  ', keyword: '' }).length, 2);
});

test('filterEntries: an empty library returns an empty array without throwing', () => {
  assert.deepEqual(filterEntries([], { query: 'anything' }), []);
  assert.deepEqual(filterEntries(undefined, { query: 'anything' }), []);
});

test('filterEntries: a query matching nothing returns an empty array without throwing', () => {
  const entries = [makeEntry({ id: 'a' })];
  assert.deepEqual(filterEntries(entries, { query: 'zzzznomatch' }), []);
});

test('sortEntries: orders newest first', () => {
  const entries = [
    makeEntry({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
    makeEntry({ id: 'new', createdAt: '2026-06-01T00:00:00.000Z' }),
    makeEntry({ id: 'mid', createdAt: '2026-03-01T00:00:00.000Z' }),
  ];
  assert.deepEqual(sortEntries(entries).map((e) => e.id), ['new', 'mid', 'old']);
});

test('sortEntries: entries sharing a createdAt keep a stable relative order', () => {
  const entries = [
    makeEntry({ id: 'first', createdAt: '2026-01-01T00:00:00.000Z' }),
    makeEntry({ id: 'second', createdAt: '2026-01-01T00:00:00.000Z' }),
  ];
  assert.deepEqual(sortEntries(entries).map((e) => e.id), ['first', 'second']);
});

test('sortEntries: an empty library returns an empty array', () => {
  assert.deepEqual(sortEntries([]), []);
});

test('visibleEntries: excludes tombstoned ids', () => {
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' }), makeEntry({ id: 'c' })];
  const result = visibleEntries(entries, ['b']);
  assert.deepEqual(result.map((e) => e.id), ['a', 'c']);
});

test('visibleEntries: restores entries when hidden list no longer includes them', () => {
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
  assert.deepEqual(visibleEntries(entries, []).map((e) => e.id), ['a', 'b']);
  assert.deepEqual(visibleEntries(entries, undefined).map((e) => e.id), ['a', 'b']);
});

test('visibleEntries: hidden ids referring to entries that no longer exist are ignored', () => {
  const entries = [makeEntry({ id: 'a' })];
  assert.deepEqual(visibleEntries(entries, ['ghost', 'a']).map((e) => e.id), []);
  assert.deepEqual(visibleEntries(entries, ['ghost']).map((e) => e.id), ['a']);
});

test('visibleEntries: an empty library returns an empty array', () => {
  assert.deepEqual(visibleEntries([], ['a']), []);
});

test('isDraft: a reference with no status field is treated as live', () => {
  const entry = makeEntry({ id: 'a' });
  delete entry.status;
  assert.equal(isDraft(entry), false);
});

test("isDraft: a reference with status 'live' is treated as live", () => {
  assert.equal(isDraft(makeEntry({ id: 'a', status: 'live' })), false);
});

test("isDraft: a reference with status 'draft' is treated as a draft", () => {
  assert.equal(isDraft(makeEntry({ id: 'a', status: 'draft' })), true);
});

test('draftEntries: returns only entries parked as drafts', () => {
  const entries = [
    makeEntry({ id: 'a', status: 'draft' }),
    makeEntry({ id: 'b' }),
    makeEntry({ id: 'c', status: 'draft' }),
  ];
  assert.deepEqual(draftEntries(entries).map((e) => e.id), ['a', 'c']);
});

test('draftEntries: a library with no drafts returns an empty array', () => {
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
  assert.deepEqual(draftEntries(entries), []);
});

test('applyDraftVisibility: excludes drafts by default', () => {
  const entries = [makeEntry({ id: 'a', status: 'draft' }), makeEntry({ id: 'b' })];
  assert.deepEqual(applyDraftVisibility(entries, false).map((e) => e.id), ['b']);
});

test('applyDraftVisibility: includes drafts when asked for', () => {
  const entries = [makeEntry({ id: 'a', status: 'draft' }), makeEntry({ id: 'b' })];
  assert.deepEqual(applyDraftVisibility(entries, true).map((e) => e.id), ['a', 'b']);
});

test('applyDraftVisibility: a library containing only drafts, with drafts excluded, returns an empty array', () => {
  const entries = [makeEntry({ id: 'a', status: 'draft' }), makeEntry({ id: 'b', status: 'draft' })];
  assert.deepEqual(applyDraftVisibility(entries, false), []);
});

test('applyDraftVisibility: a library containing no drafts is unaffected either way', () => {
  const entries = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
  assert.deepEqual(applyDraftVisibility(entries, false).map((e) => e.id), ['a', 'b']);
  assert.deepEqual(applyDraftVisibility(entries, true).map((e) => e.id), ['a', 'b']);
});

test('applyDraftVisibility: an empty library returns an empty array', () => {
  assert.deepEqual(applyDraftVisibility([], true), []);
});

test('draft filtering combines with search and category via filterEntries (AND)', () => {
  const entries = [
    makeEntry({ id: 'a', category: 'kinetic-editorial', name: 'Lando', status: 'draft' }),
    makeEntry({ id: 'b', category: 'kinetic-editorial', name: 'Lando' }),
    makeEntry({ id: 'c', category: 'brutalist', name: 'Lando', status: 'draft' }),
  ];
  const matched = filterEntries(entries, { category: 'kinetic-editorial', query: 'lando' });
  assert.deepEqual(applyDraftVisibility(matched, false).map((e) => e.id), ['b']);
  assert.deepEqual(applyDraftVisibility(matched, true).map((e) => e.id), ['a', 'b']);
});

const { countByCategory, keywordSuggestions } = require('../js/query.js');

test('countByCategory: counts entries per category id', () => {
  const entries = [makeEntry({ id: 'a', category: 'x' }), makeEntry({ id: 'b', category: 'x' }), makeEntry({ id: 'c', category: 'y' })];
  assert.deepEqual(countByCategory(entries), { x: 2, y: 1 });
});

test('keywordSuggestions: empty query suggests nothing', () => {
  assert.deepEqual(keywordSuggestions([makeEntry()], '  '), []);
});

test('keywordSuggestions: prefix matches first, then most used, with counts', () => {
  const entries = [
    makeEntry({ id: 'a', keywords: ['serif display', 'big grid'] }),
    makeEntry({ id: 'b', keywords: ['Big Grid', 'grid'] }),
    makeEntry({ id: 'c', keywords: ['grid'] }),
  ];
  assert.deepEqual(keywordSuggestions(entries, 'GRI'), [
    { keyword: 'grid', count: 2 },
    { keyword: 'big grid', count: 2 },
  ]);
});

test('keywordSuggestions: respects the limit', () => {
  const entries = [makeEntry({ keywords: ['a1', 'a2', 'a3'] })];
  assert.equal(keywordSuggestions(entries, 'a', 2).length, 2);
});
