const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const lock = require('../scripts/lock.js');
const atomicWrite = require('../scripts/atomic-write.js').writeAtomic;
const { CATEGORIES } = require('../data/categories.js');

const ROOT = path.resolve(__dirname, '..');

function tempLockPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-lock-'));
  return path.join(dir, 'commit.lock');
}

test('acquireSync takes a free lock and withLock releases it after fn runs', () => {
  const lockPath = tempLockPath();
  let ranInsideLock = false;
  const result = lock.withLock(lockPath, () => {
    ranInsideLock = fs.existsSync(lockPath);
    return 'ok';
  });
  assert.equal(ranInsideLock, true);
  assert.equal(result, 'ok');
  assert.equal(fs.existsSync(lockPath), false);
});

test('withLock releases the lock even when fn throws', () => {
  const lockPath = tempLockPath();
  assert.throws(() => lock.withLock(lockPath, () => { throw new Error('boom'); }), /boom/);
  assert.equal(fs.existsSync(lockPath), false);
});

test('acquireSync refuses a lock already held by a live process', () => {
  const lockPath = tempLockPath();
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), { flag: 'wx' });
  assert.throws(() => lock.acquireSync(lockPath, 150), /another commit is in progress/);
  fs.unlinkSync(lockPath);
});

test('acquireSync reclaims a lock left by a dead process', () => {
  const lockPath = tempLockPath();
  // A pid this high is never a real, currently-running process.
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999, startedAt: Date.now() }), { flag: 'wx' });
  lock.acquireSync(lockPath, 1000);
  const held = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(held.pid, process.pid);
  lock.release(lockPath);
});

test('acquireSync reclaims a lock older than STALE_MS even if its pid is alive', () => {
  const lockPath = tempLockPath();
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() - lock.STALE_MS - 1000 }), { flag: 'wx' });
  lock.acquireSync(lockPath, 1000);
  lock.release(lockPath);
});

test('isStale: a fresh lock held by this (live) process is not stale', () => {
  assert.equal(lock.isStale({ pid: process.pid, startedAt: Date.now() }), false);
});

test('isStale: missing or malformed lock data counts as stale', () => {
  assert.equal(lock.isStale(null), true);
  assert.equal(lock.isStale({}), true);
});

test('release is a no-op if the lock file is already gone', () => {
  assert.doesNotThrow(() => lock.release(tempLockPath()));
});

test('atomicWrite never leaves a partially-written target: the file exists in full or not at all', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-atomic-'));
  const file = path.join(dir, 'library.js');
  atomicWrite(file, 'const LIBRARY = [];\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'const LIBRARY = [];\n');
  assert.deepEqual(fs.readdirSync(dir), ['library.js'], 'no leftover .tmp file after a successful write');

  atomicWrite(file, 'const LIBRARY = [{ id: "a" }];\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'const LIBRARY = [{ id: "a" }];\n');
});

// The actual regression this lock exists for: without it, two commit.js
// runs both read data/library.js before either wrote it back, so whichever
// finished last would silently overwrite the other's addition.
test('two commit.js processes writing at once do not lose either reference', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-race-'));
  ['js', 'data', 'scripts'].forEach((d) => fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true }));
  fs.mkdirSync(path.join(dir, 'images'));

  function makeResult(id) {
    return {
      line: '- https://' + id + '.example.com',
      frames: ['.scratch/captures/' + id + '/frame-1.png'],
      reference: {
        id: id,
        name: id,
        sourceUrl: 'https://' + id + '.example.com',
        category: CATEGORIES[0].id,
        summary: 'A summary.',
        keywords: ['oversized serif'],
        palette: ['#000000', '#ffffff'],
        typeNotes: 'A serif and a mono.',
        imagePrompt: 'A black void.',
        brief: '[YOUR SUBJECT] opens on black.',
      },
      designSystem: {
        referenceId: id,
        name: id,
        description: 'Colours measured; type inferred from the screenshots.',
        colors: { surface: { value: '#000000', displayName: 'Void', role: 'the ground' } },
        typography: { body: { fontFamily: 'Inter', fontSize: '16px' } },
        omitted: [{ section: 'components', reason: 'no repeated buttons, cards or inputs on the page' }],
        sections: { overview: 'A quiet black page.' },
      },
    };
  }

  const ids = ['race-a', 'race-b'];
  fs.writeFileSync(path.join(dir, 'inbox.md'), '# Inbox\n' + ids.map((id) => makeResult(id).line).join('\n') + '\n');
  ids.forEach((id) => {
    const frameDir = path.join(dir, '.scratch/captures/' + id);
    fs.mkdirSync(frameDir, { recursive: true });
    fs.writeFileSync(path.join(frameDir, 'frame-1.png'), 'png bytes');
    fs.writeFileSync(path.join(frameDir, 'frame-1.webp'), 'webp bytes');
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(makeResult(id)));
  });

  function run(resultFile) {
    return new Promise((resolve) => {
      const child = childProcess.spawn('node', ['scripts/commit.js', resultFile, '--skip-lint'], { cwd: dir });
      child.on('close', resolve);
    });
  }

  const codes = await Promise.all(ids.map((id) => run(id + '.json')));
  assert.deepEqual(codes, [0, 0]);

  const library = require(path.join(dir, 'data/library.js')).LIBRARY;
  const writtenIds = library.map((e) => e.id);
  assert.ok(writtenIds.includes('race-a'), 'race-a must survive a concurrent commit');
  assert.ok(writtenIds.includes('race-b'), 'race-b must survive a concurrent commit');

  fs.rmSync(dir, { recursive: true, force: true });
});
