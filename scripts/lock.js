// A cross-process exclusive lock via an atomically-created lockfile. Used
// by commit.js so two drains writing data/library.js (etc.) at the same
// time — two manual drains started in different terminals, say — can't
// lose one write to the other. Every write to those files is a full
// rewrite of the whole array, so a lost update here doesn't corrupt one
// entry, it silently drops everyone the losing process had added.
//
// The lock is a JSON file holding the holder's pid and start time.
// Acquiring it is `fs.writeFileSync(..., {flag: 'wx'})`, which fails if the
// file already exists — that existence check and the create are one
// filesystem call, so two processes racing to acquire can't both succeed.
// A lock is reclaimed as stale if its holder process is no longer alive or
// it's older than STALE_MS (a crashed commit.js should never leave the
// library unwritable).

var fs = require('fs');

var STALE_MS = 5 * 60 * 1000; // commit.js's own work finishes in well under this
var DEFAULT_TIMEOUT_MS = 10000;
var RETRY_MS = 100;

function readLock(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function holderAlive(pid) {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0); // signal 0: no-op, just checks the pid exists
    return true;
  } catch (e) {
    return false;
  }
}

function isStale(lock) {
  if (!lock || typeof lock.startedAt !== 'number') return true;
  if (Date.now() - lock.startedAt > STALE_MS) return true;
  return !holderAlive(lock.pid);
}

function tryAcquire(lockPath) {
  try {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    throw e;
  }
}

// Synchronous sleep so callers (commit.js's whole pipeline is synchronous)
// don't need to thread a promise through main() just for this.
function sleepSync(ms) {
  var sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

// Blocks until the lock is free (reclaiming a stale one along the way) or
// timeoutMs elapses, in which case it throws with an actionable message
// instead of hanging a drain indefinitely.
function acquireSync(lockPath, timeoutMs) {
  var deadline = Date.now() + (timeoutMs == null ? DEFAULT_TIMEOUT_MS : timeoutMs);
  for (;;) {
    if (tryAcquire(lockPath)) return;
    var lock = readLock(lockPath);
    if (isStale(lock)) {
      try { fs.unlinkSync(lockPath); } catch (e) { /* another process already cleaned it up */ }
      continue;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        'another commit is in progress (pid ' + lock.pid + ', started ' + new Date(lock.startedAt).toISOString() +
        ') — wait for it to finish and try again. If it is actually gone, delete ' + lockPath + '.'
      );
    }
    sleepSync(RETRY_MS);
  }
}

function release(lockPath) {
  try { fs.unlinkSync(lockPath); } catch (e) { /* already gone */ }
}

// Runs fn() while holding the lock, releasing it (even on throw) before
// returning. fn's return value is passed through.
function withLock(lockPath, fn, timeoutMs) {
  acquireSync(lockPath, timeoutMs);
  try {
    return fn();
  } finally {
    release(lockPath);
  }
}

module.exports = {
  withLock: withLock,
  acquireSync: acquireSync,
  release: release,
  isStale: isStale,
  STALE_MS: STALE_MS,
};
