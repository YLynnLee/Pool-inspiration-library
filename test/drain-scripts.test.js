const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const lib = require('../scripts/drain-lib.js');
const { LIBRARY } = require('../data/library.js');
const { CATEGORIES } = require('../data/categories.js');

const ROOT = path.resolve(__dirname, '..');

function makeResult(overrides) {
  const base = {
    line: '- https://new.example.com — loved the type',
    frames: ['.scratch/captures/new-example-com/frame-1.png'],
    reference: {
      id: 'new-example',
      name: 'New Example',
      sourceUrl: 'https://new.example.com',
      category: CATEGORIES[0].id,
      summary: 'A summary.',
      keywords: ['oversized serif'],
      palette: ['#000000', '#ffffff'],
      typeNotes: 'A serif and a mono.',
      imagePrompt: 'A black void.',
      brief: '[YOUR SUBJECT] opens on black.',
    },
    designSystem: {
      referenceId: 'new-example',
      name: 'New Example',
      description: 'Colours measured; type inferred from the screenshots.',
      colors: { surface: { value: '#000000', displayName: 'Void', role: 'the ground' } },
      typography: { body: { fontFamily: 'Inter', fontSize: '16px' } },
      omitted: [{ section: 'components', reason: 'no repeated buttons, cards or inputs on the page' }],
      sections: { overview: 'A quiet black page.' },
    },
  };
  return Object.assign(base, overrides);
}

test('listInbox flags a capture whose URL is already a sourceUrl', () => {
  const known = LIBRARY[0].sourceUrl;
  const inbox = '# header\n- ' + known + '\n- https://new.example.com — note\nnot a capture\n';
  const listed = lib.listInbox(inbox, LIBRARY);
  assert.deepEqual(listed.captures.map((c) => c.duplicate), [true, false]);
  assert.equal(listed.captures[1].note, 'note');
  assert.equal(listed.malformed.length, 1);
});

test('markFetchFailed keeps the line and appends the reason to its note', () => {
  const inbox = '- https://a.example\n- https://b.example — nice grid\n';
  assert.equal(
    lib.markFetchFailed(inbox, '- https://b.example — nice grid', 'HTTP 403'),
    '- https://a.example\n- https://b.example — nice grid; fetch failed: HTTP 403\n'
  );
  assert.equal(
    lib.markFetchFailed(inbox, '- https://a.example', 'timed out'),
    '- https://a.example — fetch failed: timed out\n- https://b.example — nice grid\n'
  );
});

test('captureSlug is filesystem-safe and stable', () => {
  assert.equal(lib.captureSlug('https://www.dyson.co.uk/oral-care/Camera?x=1'), 'dyson-co-uk-oral-care-camera');
  assert.equal(lib.captureSlug('not a url'), 'capture');
});

test('shotPositions gives five spread shots on a long page and fewer on a short one', () => {
  assert.deepEqual(lib.shotPositions(9900, 900), [0, 2250, 4500, 6750, 9000]);
  assert.deepEqual(lib.shotPositions(1500, 900), [0, 600]);
  assert.deepEqual(lib.shotPositions(800, 900), [0]);
});

test('a complete result validates', () => {
  assert.deepEqual(lib.validateDrainResult(makeResult(), { library: LIBRARY, categories: CATEGORIES }), []);
});

test('validation rejects blanks, placeholders, duplicates and unknown categories', () => {
  const result = makeResult();
  result.reference.summary = 'TODO';
  result.reference.palette = ['black'];
  result.reference.category = 'no-such-category';
  result.reference.sourceUrl = LIBRARY[0].sourceUrl;
  result.reference.brief = 'A brief without the placeholder.';
  const errors = lib.validateDrainResult(result, { library: LIBRARY, categories: CATEGORIES });
  const text = errors.join('\n');
  assert.match(text, /summary is empty or a placeholder/);
  assert.match(text, /palette/);
  assert.match(text, /does not exist/);
  assert.match(text, /duplicate/);
  assert.match(text, /\[YOUR SUBJECT\]/);
});

test('a new category must be complete, match the reference and name the rejected neighbour', () => {
  const result = makeResult({ newCategory: { id: 'quiet-serif', name: 'Quiet Serif', definition: 'd', description: 'e', vocabulary: ['v'] } });
  result.reference.category = 'quiet-serif';
  let errors = lib.validateDrainResult(result, { library: LIBRARY, categories: CATEGORIES });
  assert.deepEqual(errors, ['rejectedCategory is required with a newCategory: name the nearest existing category and why it was rejected']);
  result.rejectedCategory = CATEGORIES[0].id + ': too dark';
  errors = lib.validateDrainResult(result, { library: LIBRARY, categories: CATEGORIES });
  assert.deepEqual(errors, []);
});

test('a design system must declare components or omit them with a reason', () => {
  const result = makeResult();
  delete result.designSystem.omitted;
  const errors = lib.validateDrainResult(result, { library: LIBRARY, categories: CATEGORIES });
  assert.match(errors.join('\n'), /components/);
});

test('a draft needs a capture-failure reason', () => {
  const result = makeResult();
  result.reference.status = 'draft';
  const errors = lib.validateDrainResult(result, { library: LIBRARY, categories: CATEGORIES });
  assert.match(errors.join('\n'), /draftReason/);
});

test('buildReference fills the script-owned fields in serialiser order', () => {
  const entry = lib.buildReference(makeResult().reference, lib.screenshotPaths('new-example', 2), '2026-01-01T00:00:00.000Z');
  assert.deepEqual(entry.screenshots, ['images/new-example.webp', 'images/new-example-2.webp']);
  assert.deepEqual(entry.palette, ['#000000', '#FFFFFF']);
  assert.equal(entry.ownerId, 'local');
  assert.deepEqual(Object.keys(entry).slice(0, 5), ['id', 'name', 'sourceUrl', 'category', 'summary']);
});

test('upsertDesignSystem replaces in place or appends', () => {
  const entries = [{ referenceId: 'a', name: '1' }, { referenceId: 'b', name: '1' }];
  assert.deepEqual(lib.upsertDesignSystem(entries, { referenceId: 'a', name: '2' }).map((e) => e.referenceId + e.name), ['a2', 'b1']);
  assert.deepEqual(lib.upsertDesignSystem(entries, { referenceId: 'c', name: '1' }).map((e) => e.referenceId), ['a', 'b', 'c']);
});

test('commit.js writes screenshots, reference, design system and strikes the line, in a scratch copy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'drain-commit-'));
  ['js', 'data', 'scripts'].forEach((d) => fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true }));
  fs.mkdirSync(path.join(dir, 'images'));
  const result = makeResult();
  fs.writeFileSync(path.join(dir, 'inbox.md'), '# Inbox\n- https://keep.example\n' + result.line + '\n');
  const frameDir = path.join(dir, '.scratch/captures/new-example-com');
  fs.mkdirSync(frameDir, { recursive: true });
  fs.writeFileSync(path.join(frameDir, 'frame-1.png'), 'png bytes');
  fs.writeFileSync(path.join(frameDir, 'frame-1.webp'), 'webp bytes');
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result));

  const dry = childProcess.spawnSync('node', ['scripts/commit.js', 'result.json', '--dry-run', '--skip-lint'], { cwd: dir, encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(fs.readdirSync(path.join(dir, 'images')).length, 0);

  const run = childProcess.spawnSync('node', ['scripts/commit.js', 'result.json', '--skip-lint'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(fs.readFileSync(path.join(dir, 'images/new-example.webp'), 'utf8'), 'webp bytes');
  const library = require(path.join(dir, 'data/library.js')).LIBRARY;
  assert.equal(library[library.length - 1].id, 'new-example');
  const systems = require(path.join(dir, 'data/design-systems.js')).DESIGN_SYSTEMS;
  assert.equal(systems[systems.length - 1].referenceId, 'new-example');
  assert.equal(fs.readFileSync(path.join(dir, 'inbox.md'), 'utf8'), '# Inbox\n- https://keep.example\n');

  const again = childProcess.spawnSync('node', ['scripts/commit.js', 'result.json', '--skip-lint'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(again.status, 0, 'a second commit of the same result must be refused as a duplicate');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('frames must be .png files inside .scratch/captures — nothing else gets copied into images/', () => {
  const state = { library: LIBRARY, categories: CATEGORIES };
  [
    '/Users/someone/.aws/credentials',
    '.scratch/captures/../../.git/config',
    '.scratch/captures/x/notes.txt',
    'images/existing.png',
  ].forEach((frame) => {
    const errors = lib.validateDrainResult(makeResult({ frames: [frame] }), state);
    assert.ok(errors.some((e) => /frame/.test(e) && /\.scratch\/captures/.test(e)), frame + ' should be refused');
  });
  assert.deepEqual(lib.validateDrainResult(makeResult(), state), []);
});

test('sourceUrl must be http(s)', () => {
  const state = { library: LIBRARY, categories: CATEGORIES };
  const result = makeResult();
  result.reference.sourceUrl = 'javascript://%0aalert(1)';
  result.line = '';
  assert.ok(lib.validateDrainResult(result, state).some((e) => /http\(s\)/.test(e)));
});
