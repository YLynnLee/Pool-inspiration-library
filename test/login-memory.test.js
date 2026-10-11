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

// ---- a connection that breaks ---------------------------------------------

async function drain(t, remaining) {
  const config = t.ai.loadConfig();
  const lines = [];
  await t.ai.runDrain(config, { log: (l) => lines.push(l), remaining: () => remaining });
  return lines;
}

test('problem: a drain that stops on a login prompt marks the connection logged out, with how many links wait', { skip: SKIP }, async () => {
  const t = setup();
  try {
    t.mode('ok');
    await t.ai.connect(CONNECT_CLAUDE);
    assert.equal(t.ai.loadConfig().connection.problem, undefined);

    t.mode('loggedout');
    await drain(t, 3);
    const problem = t.ai.loadConfig().connection.problem;
    assert.equal(problem.kind, 'logged-out');
    assert.equal(problem.short, 'logged out');
    assert.ok(problem.title && problem.at);
    assert.match(problem.text, /3 links/);
    assert.equal(await t.signedIn(), 'no', 'the login record agrees');
  } finally {
    t.cleanup();
  }
});

test('problem: an unrelated failure sets none, and a passing connection test clears one', { skip: SKIP }, async () => {
  const t = setup();
  try {
    t.mode('ok');
    await t.ai.connect(CONNECT_CLAUDE);

    t.mode('broken');
    await drain(t, 2);
    assert.equal(t.ai.loadConfig().connection.problem, undefined, 'a link that failed is not a broken connection');

    t.mode('loggedout');
    await drain(t, 2);
    assert.equal(t.ai.loadConfig().connection.problem.kind, 'logged-out');

    t.mode('ok');
    assert.equal((await t.ai.connect(CONNECT_CLAUDE)).ok, true);
    assert.equal(t.ai.loadConfig().connection.problem, undefined);
  } finally {
    t.cleanup();
  }
});

test('problem: an API drain that is refused or cannot reach the server records key-rejected or not-answering, never the key', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-problem-'));
  const store = secrets.createStore({ backend: 'file', dir: path.join(dir, 'secret-store') });
  const ai = aiIndex.create({ file: path.join(dir, '.drain.config.json'), store });
  const apiDrain = require('../scripts/ai/api-drain.js');
  const original = apiDrain.runApiDrain;
  const SECRET = 'sk-ant-SECRET-9876';
  try {
    config.saveConfig(Object.assign(config.loadConfig({ file: path.join(dir, '.drain.config.json'), store }), {
      mode: 'api',
      api: { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', apiKey: SECRET },
      connection: { label: 'Anthropic · claude-sonnet-5-5', ai: 'anthropic', at: new Date().toISOString() },
    }), { file: path.join(dir, '.drain.config.json'), store });

    const cases = [
      ['HTTP 401: invalid x-api-key ' + SECRET, 'key-rejected', 'key not working'],
      ['could not reach https://api.anthropic.com/v1/messages: ECONNREFUSED', 'not-answering', 'not answering'],
    ];
    for (const [reason, kind, short] of cases) {
      apiDrain.runApiDrain = async () => ({ outcomes: [{ kind: 'error', url: 'https://a.test', reason }] });
      await ai.runDrain(ai.loadConfig(), { log() {}, remaining: () => 1 });
      const problem = ai.loadConfig().connection.problem;
      assert.equal(problem.kind, kind);
      assert.equal(problem.short, short);
      assert.match(problem.text, /1 link is still waiting/);
      assert.equal(JSON.stringify(config.publicConfig(ai.loadConfig())).includes(SECRET), false, 'the public config never carries the key');
    }

    apiDrain.runApiDrain = async () => ({ outcomes: [{ kind: 'fetch-failed', url: 'https://a.test', reason: 'timeout' }] });
    ai.disconnect();
    assert.equal(ai.loadConfig().connection, null);
  } finally {
    apiDrain.runApiDrain = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('connection: switching model keeps the "connected since" time', { skip: SKIP }, async () => {
  const t = setup();
  try {
    t.mode('ok');
    await t.ai.connect(CONNECT_CLAUDE);
    const first = t.ai.loadConfig().connection.at;
    await new Promise((r) => setTimeout(r, 15));
    await t.ai.connect({ ai: 'claude', mode: 'agent', agent: { preset: 'claude', model: 'opus' } });
    assert.equal(t.ai.loadConfig().connection.at, first);
  } finally {
    t.cleanup();
  }
});

test('problem: an API drain where some links went through is not a broken connection', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-problem-'));
  const file = path.join(dir, '.drain.config.json');
  const store = secrets.createStore({ backend: 'file', dir: path.join(dir, 'secret-store') });
  const ai = aiIndex.create({ file, store });
  const apiDrain = require('../scripts/ai/api-drain.js');
  const original = apiDrain.runApiDrain;
  try {
    config.saveConfig(Object.assign(config.loadConfig({ file, store }), {
      mode: 'api',
      api: { provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', apiKey: 'sk-ant-x' },
      connection: { label: 'Anthropic · claude-sonnet-5-5', ai: 'anthropic', at: new Date().toISOString() },
    }), { file, store });
    apiDrain.runApiDrain = async () => ({ outcomes: [
      { kind: 'committed', url: 'https://a.test' },
      { kind: 'error', url: 'https://b.test', reason: 'could not reach https://b.test: ETIMEDOUT' },
    ] });
    await ai.runDrain(ai.loadConfig(), { log() {}, remaining: () => 1 });
    assert.equal(ai.loadConfig().connection.problem, undefined);
  } finally {
    apiDrain.runApiDrain = original;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
