const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const config = require('../scripts/ai/config.js');
const secrets = require('../scripts/ai/secrets.js');
const catalog = require('../scripts/ai/catalog.js');
const aiIndex = require('../scripts/ai/index.js');

// The helper's connect layer, driven the way the server drives it (connect,
// detect, disconnect), against a stand-in `claude` on PATH and a temp config
// file, so a test never touches the collector's real connection.
//
// The stand-in answers from $FAKE_CLAUDE: "ok" answers the test, "loggedout"
// prints a login prompt and fails, "broken" fails with something unrelated.

const SKIP = process.platform === 'win32' ? 'uses a shell-script stand-in for the agent app' : false;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-login-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'claude'), [
    '#!/bin/sh',
    'case "$FAKE_CLAUDE" in',
    '  ok) printf "OK\\nclaude-sonnet-5-5\\n" ;;',
    '  loggedout) echo "Not logged in · Please run /login"; exit 1 ;;',
    '  custom) echo "Session expired, sign in again with ZZ-LOGIN"; exit 1 ;;',
    '  *) echo "connect ECONNRESET api.anthropic.com"; exit 1 ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o755 });
  const file = path.join(dir, '.drain.config.json');
  const store = secrets.createStore({ backend: 'file', dir: path.join(dir, 'secret-store') });
  const originalPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + originalPath;
  const ai = aiIndex.create({ file, store });
  return {
    ai,
    file,
    mode(value) { process.env.FAKE_CLAUDE = value; },
    async signedIn() {
      const found = await ai.detect();
      return found.agents.find((a) => a.id === 'claude').signedIn;
    },
    cleanup() {
      process.env.PATH = originalPath;
      delete process.env.FAKE_CLAUDE;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

const CONNECT_CLAUDE = { ai: 'claude', mode: 'agent', agent: { preset: 'claude' } };

test('login memory: never tested is unknown; a passing test makes it yes, and disconnecting keeps it', { skip: SKIP }, async () => {
  const t = setup();
  try {
    assert.equal(await t.signedIn(), 'unknown');

    t.mode('ok');
    assert.equal((await t.ai.connect(CONNECT_CLAUDE)).ok, true);
    assert.equal(await t.signedIn(), 'yes');

    t.ai.disconnect();
    assert.equal(t.ai.loadConfig().connection, null);
    assert.equal(await t.signedIn(), 'yes', 'disconnect clears the connection, not the login');
  } finally {
    t.cleanup();
  }
});

test('login memory: a failure that shows a login prompt makes it no; one that does not leaves it alone', { skip: SKIP }, async () => {
  const t = setup();
  try {
    t.mode('ok');
    await t.ai.connect(CONNECT_CLAUDE);
    assert.equal(await t.signedIn(), 'yes');

    t.mode('broken');
    const unrelated = await t.ai.connect(CONNECT_CLAUDE);
    assert.equal(unrelated.ok, false);
    assert.equal(unrelated.loggedOut, undefined);
    assert.equal(await t.signedIn(), 'yes', 'a network failure says nothing about the login');

    t.mode('loggedout');
    const out = await t.ai.connect(CONNECT_CLAUDE);
    assert.equal(out.ok, false);
    assert.equal(out.loggedOut, true, 'the result says why, so the window can point at the login step');
    assert.equal(await t.signedIn(), 'no');

    t.mode('ok');
    await t.ai.connect(CONNECT_CLAUDE);
    assert.equal(await t.signedIn(), 'yes', 'a passing test clears loggedOut');
  } finally {
    t.cleanup();
  }
});

test('login memory: the prompts that count as logged out come only from the catalog', { skip: SKIP }, async () => {
  const t = setup();
  const method = catalog.findMethod('claude', 'agent').method;
  const original = method.login.patterns;
  try {
    t.mode('custom');
    assert.equal((await t.ai.connect(CONNECT_CLAUDE)).loggedOut, undefined, 'not a prompt the catalog knows');
    assert.equal(await t.signedIn(), 'unknown');

    method.login.patterns = original.concat(['ZZ-LOGIN']);
    assert.equal((await t.ai.connect(CONNECT_CLAUDE)).loggedOut, true);
    assert.equal(await t.signedIn(), 'no');
  } finally {
    method.login.patterns = original;
    t.cleanup();
  }
});

test('catalog: every agent app lists the prompts that mean it is logged out', () => {
  catalog.CATALOG.forEach((ai) => ai.methods.filter((m) => m.id === 'agent').forEach((m) => {
    assert.ok(Array.isArray(m.login.patterns) && m.login.patterns.length > 0, ai.id);
    m.login.patterns.forEach((p) => assert.doesNotThrow(() => new RegExp(p, 'i'), ai.id + ': ' + p));
  }));
});
