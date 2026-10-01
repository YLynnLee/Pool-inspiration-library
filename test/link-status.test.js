const test = require('node:test');
const assert = require('node:assert/strict');
const { derive, explainFailure } = require('../js/link-status.js');

const idle = { running: false, currentUrl: '', step: 0, total: 0, lines: [], finished: false, ok: null, error: '' };

function item(url, note) {
  return { url, note: note || '', line: '- ' + url, duplicate: false };
}

function run(overrides) {
  return derive(Object.assign({ inbox: { items: [] }, known: [], library: [], drain: idle, retried: [] }, overrides));
}

const byUrl = (result, url) => result.links.find((l) => l.url === url);

test('nothing waiting: no links, idle header', () => {
  const r = run({});
  assert.deepEqual(r.links, []);
  assert.deepEqual(r.header, { kind: 'idle', waiting: 0, step: 0, total: 0, added: 0, failed: 0 });
});

test('links waiting with no AI connected are plain Waiting, with host and note', () => {
  const r = run({ inbox: { items: [item('https://www.mobbin.com/discover', 'onboarding flows'), item('https://vercel.com/')] } });
  assert.equal(r.links.length, 2);
  assert.equal(r.links[0].status, 'waiting');
  assert.equal(r.links[0].host, 'mobbin.com');
  assert.equal(r.links[0].note, 'onboarding flows');
  assert.equal(r.header.kind, 'idle');
  assert.equal(r.header.waiting, 2);
});

test('a run in progress: the current link analyses, the rest wait, header carries step of total', () => {
  const drain = Object.assign({}, idle, {
    running: true, step: 2, total: 3, currentUrl: 'https://b.com/',
    lines: ['[1/3] https://a.com/', '  capturing…', '  already in the library — struck from the inbox', '[2/3] https://b.com/', '  capturing…'],
  });
  const r = run({
    inbox: { items: [item('https://b.com/'), item('https://c.com/')] },
    known: [{ url: 'https://a.com/', note: '' }],
    library: [{ id: 'a', name: 'A', sourceUrl: 'https://a.com/' }],
    drain,
  });
  assert.equal(byUrl(r, 'https://a.com/').status, 'added');
  assert.equal(byUrl(r, 'https://b.com/').status, 'analysing');
  assert.equal(byUrl(r, 'https://c.com/').status, 'waiting');
  assert.deepEqual(r.header, { kind: 'running', waiting: 1, step: 2, total: 3, added: 1, failed: 0 });
});

test('a finished run with mixed results: added links name their reference, failures say why', () => {
  const drain = Object.assign({}, idle, {
    finished: true, ok: false, step: 2, total: 2, currentUrl: 'https://b.com/',
    lines: ['[1/2] https://a.com/', '  capturing…', '[2/2] https://b.com/', '  capturing…', '  fetch failed (HTTP 403) — left in the inbox with the reason noted'],
  });
  const r = run({
    inbox: { items: [item('https://b.com/', 'fetch failed: HTTP 403')] },
    known: [{ url: 'https://a.com/', note: 'nice type' }, { url: 'https://b.com/', note: '' }],
    library: [{ id: 'a-site', name: 'A Site', sourceUrl: 'https://a.com/' }],
    drain,
  });
  const a = byUrl(r, 'https://a.com/');
  assert.equal(a.status, 'added');
  assert.deepEqual(a.reference, { id: 'a-site', name: 'A Site' });
  assert.equal(a.note, 'nice type');
  const b = byUrl(r, 'https://b.com/');
  assert.equal(b.status, 'failed');
  assert.match(b.reason, /blocked/i);
  assert.ok(b.fix);
  assert.equal(b.note, '', 'the failure text is not shown as the collector’s note');
  assert.deepEqual(r.header, { kind: 'finished', waiting: 0, step: 2, total: 2, added: 1, failed: 1 });
});

test('a link already in the library is Added, not Waiting', () => {
  const r = run({
    inbox: { items: [] },
    known: [{ url: 'https://a.com', note: '' }],
    library: [{ id: 'a', name: 'A', sourceUrl: 'https://a.com/' }],
  });
  assert.equal(byUrl(r, 'https://a.com').status, 'added');
});

test('a link analysed this run before the page has the new library is Added with no reference yet', () => {
  const drain = Object.assign({}, idle, { finished: true, ok: true, step: 1, total: 1, currentUrl: 'https://a.com/', lines: ['[1/1] https://a.com/'] });
  const r = run({ known: [{ url: 'https://a.com/', note: '' }], drain });
  assert.equal(byUrl(r, 'https://a.com/').status, 'added');
  assert.equal(byUrl(r, 'https://a.com/').reference, null);
});

test('a collector-removed link (not known, not waiting) is not listed', () => {
  assert.deepEqual(run({ known: [] }).links, []);
});

test('a link added while the page is not served by the helper shows as Waiting', () => {
  const r = run({ inbox: null, known: [{ url: 'https://new.com/', note: 'x' }] });
  assert.equal(r.links.length, 1);
  assert.equal(r.links[0].status, 'waiting');
  assert.equal(r.links[0].note, 'x');
  assert.equal(r.header.waiting, 1);
});

test('retry returns a failed link to Waiting and clears its failure', () => {
  const drain = Object.assign({}, idle, {
    finished: true, ok: false,
    lines: ['[1/1] https://b.com/', '  error: boom — left in the inbox'],
  });
  const input = { inbox: { items: [item('https://b.com/')] }, known: [{ url: 'https://b.com/', note: '' }], drain };
  assert.equal(byUrl(run(input), 'https://b.com/').status, 'failed');
  assert.equal(byUrl(run(Object.assign({ retried: ['https://b.com/'] }, input)), 'https://b.com/').status, 'waiting');
});

test('a stopped run leaves unfinished links Waiting, not Failed', () => {
  const drain = Object.assign({}, idle, {
    finished: true, ok: false,
    lines: ['[1/2] https://a.com/', '  capturing…', 'Stopped. This capture is still in the inbox; nothing half-written.'],
  });
  const r = run({ inbox: { items: [item('https://a.com/'), item('https://b.com/')] }, drain });
  assert.equal(byUrl(r, 'https://a.com/').status, 'waiting');
});

test('losing the helper mid-run fails the link being analysed with a helper fix', () => {
  const drain = Object.assign({}, idle, { error: 'Lost contact with the library helper — is it still running?', currentUrl: 'https://a.com/', step: 1, total: 1, lines: ['[1/1] https://a.com/'] });
  const r = run({ inbox: { items: [item('https://a.com/')] }, drain });
  const a = byUrl(r, 'https://a.com/');
  assert.equal(a.status, 'failed');
  assert.match(a.reason, /helper/i);
});

// ---- explainFailure ------------------------------------------------------

test('explainFailure: each known failure maps to a plain reason and fix', () => {
  const cases = [
    ['fetch failed (HTTP 403)', /blocked/i],
    ['fetch failed: net::ERR_BLOCKED_BY_CLIENT', /blocked|screenshot/i],
    ['fetch failed (Timeout 45000ms exceeded)', /too long|timed out/i],
    ['error: No AI connected — left in the inbox', /AI/],
    ['error: 401 Unauthorized — invalid api key', /AI|key/i],
    ['Lost contact with the library helper — is it still running?', /helper/i],
    ['the model found no usable frame', /screenshot/i],
  ];
  cases.forEach(([text, expected]) => {
    const e = explainFailure(text);
    assert.match(e.reason, expected, text);
    assert.ok(e.fix && e.fix.length > 5, 'fix for ' + text);
  });
});

test('explainFailure: unknown output falls back to a generic reason that still suggests Retry', () => {
  const e = explainFailure('error: something nobody planned for');
  assert.ok(e.reason);
  assert.match(e.fix, /Retry/);
});
