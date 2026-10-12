const test = require('node:test');
const assert = require('node:assert/strict');
const {
  failureFromNote,
  failuresFromLog,
  explainFailure,
  deriveRows,
  summarise,
} = require('../js/links.js');

const A = 'https://a.example/';
const B = 'https://b.example/page';
const C = 'https://c.example/';

test('failureFromNote reads the last fetch failure and nothing else', () => {
  assert.equal(failureFromNote(''), '');
  assert.equal(failureFromNote('the tight type scale'), '');
  assert.equal(failureFromNote('fetch failed: timeout after 30s'), 'timeout after 30s');
  assert.equal(failureFromNote('my note; fetch failed: 403; fetch failed: blocked by captcha'), 'blocked by captcha');
});

test('failuresFromLog maps summary lines and per-link errors to their urls', () => {
  const reasons = failuresFromLog([
    '[1/2] ' + A,
    '  error: the model said nope — left in the inbox',
    '[2/2] ' + B,
    'Summary',
    '- 0 added',
    '- still in the inbox: ' + B + ' — model-failed: bad json',
  ]);
  assert.equal(reasons[A], 'the model said nope');
  assert.equal(reasons[B], 'bad json');
});

test('explainFailure gives a plain title and one fix, with a safe fallback', () => {
  assert.match(explainFailure('Timeout 30000ms exceeded').title, /too long/);
  assert.match(explainFailure('403 Forbidden').title, /blocked/);
  assert.match(explainFailure('net::ERR_NAME_NOT_RESOLVED').fix, /Check the link/);
  assert.match(explainFailure('401 invalid api key').fix, /Connect AI/);
  const odd = explainFailure('something odd happened');
  assert.equal(odd.title, 'The analysis didn’t finish');
  assert.match(odd.fix, /something odd happened\. Retry, or remove it\.$/);
  assert.equal(explainFailure('').fix, 'Retry, or remove it.');
});

test('with no run, waiting links are listed newest first; a noted failure shows as failed', () => {
  const rows = deriveRows({
    waiting: [
      { url: A, note: '', line: 'a' },
      { url: B, note: 'fetch failed: timeout', line: 'b' },
    ],
  });
  assert.deepEqual(rows.map((r) => [r.url, r.status]), [[B, 'failed'], [A, 'waiting']]);
  assert.match(rows[0].title, /too long/);
});

test('during a run the current link is analysing, the rest wait, and finished ones are added', () => {
  const run = { links: [{ url: A, note: '' }, { url: B, note: '' }, { url: C, note: '' }], running: true, currentUrl: B, lines: [] };
  const rows = deriveRows({
    waiting: [{ url: B, note: '' }, { url: C, note: '' }],
    run,
    library: [{ id: 'a', name: 'A site', sourceUrl: A }],
  });
  assert.deepEqual(rows.map((r) => r.status), ['added', 'analysing', 'waiting']);
  assert.equal(rows[0].id, 'a');
});

test('an agent drain that names no current link shows every unfinished link as analysing', () => {
  const run = { links: [{ url: A, note: '' }, { url: B, note: '' }], running: true, currentUrl: '', lines: [] };
  const rows = deriveRows({ waiting: [{ url: A, note: '' }, { url: B, note: '' }], run });
  assert.deepEqual(rows.map((r) => r.status), ['analysing', 'analysing']);
});

test('after a run: gone from the inbox and in the library is added; left behind is failed', () => {
  const run = {
    links: [{ url: A, note: '' }, { url: B, note: '' }, { url: C, note: '' }],
    running: false,
    currentUrl: '',
    lines: ['[2/3] ' + B, '- still in the inbox: ' + B + ' — model-failed: bad json'],
  };
  const rows = deriveRows({
    waiting: [{ url: B, note: '' }, { url: C, note: 'fetch failed: 403' }],
    run,
    library: [{ id: 'a', name: 'A site', sourceUrl: A }],
  });
  assert.deepEqual(rows.map((r) => r.status), ['added', 'failed', 'failed']);
  assert.match(rows[1].title, /AI’s answer/);
  assert.match(rows[2].title, /blocked/);
  assert.deepEqual(summarise(rows), { waiting: 0, analysing: 0, added: 1, failed: 2 });
});

test('a link left behind with no reason after a run says it was stopped', () => {
  const run = { links: [{ url: A, note: '' }], running: false, currentUrl: '', lines: [] };
  const rows = deriveRows({ waiting: [{ url: A, note: '' }], run });
  assert.equal(rows[0].status, 'failed');
  assert.match(rows[0].title, /stopped/);
});

test('links added after a run started come first and wait', () => {
  const run = { links: [{ url: A, note: '' }], running: true, currentUrl: A, lines: [] };
  const rows = deriveRows({ waiting: [{ url: A, note: '' }, { url: C, note: '' }], run });
  assert.deepEqual(rows.map((r) => [r.url, r.status]), [[C, 'waiting'], [A, 'analysing']]);
});

test('a link already in the library reads as added, with the reference to open', () => {
  const rows = deriveRows({
    waiting: [{ url: A, note: '', line: 'a', duplicate: true }],
    library: [{ id: 'a', name: 'A site', sourceUrl: A }],
  });
  assert.deepEqual(rows.map((r) => [r.status, r.id, r.line]), [['added', 'a', 'a']]);
});
