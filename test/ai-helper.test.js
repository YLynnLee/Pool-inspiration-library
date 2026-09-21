const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../scripts/ai/config.js');
const providers = require('../scripts/ai/providers.js');
const apiDrain = require('../scripts/ai/api-drain.js');
const agentDrain = require('../scripts/ai/agent-drain.js');

test('mergeConfig: switching provider resets its URL, model and key', () => {
  const saved = config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { apiKey: 'sk-ant-secret' } });
  assert.equal(saved.api.apiKey, 'sk-ant-secret');
  const next = config.mergeConfig(saved, { api: { provider: 'ollama' } });
  assert.equal(next.api.baseUrl, 'http://localhost:11434/v1');
  assert.equal(next.api.apiKey, '');
});

test('mergeConfig: a blank key keeps the saved one; clearKey removes it', () => {
  const saved = config.mergeConfig(config.DEFAULT_CONFIG, { api: { apiKey: 'k1' } });
  assert.equal(config.mergeConfig(saved, { api: { apiKey: '', model: 'm' } }).api.apiKey, 'k1');
  assert.equal(config.mergeConfig(saved, { api: { clearKey: true } }).api.apiKey, '');
});

test('mergeConfig: choosing an agent preset fills its command; an edit overrides it', () => {
  const next = config.mergeConfig(config.DEFAULT_CONFIG, { agent: { preset: 'antigravity' } });
  assert.equal(next.agent.command, 'agy --dangerously-skip-permissions --print-timeout 60m -p');
  assert.equal(config.mergeConfig(next, { agent: { command: ' agy --model x -p ' } }).agent.command, 'agy --model x -p');
});

test('publicConfig never exposes a key, only where it comes from', () => {
  const saved = config.mergeConfig(config.DEFAULT_CONFIG, { api: { apiKey: 'sk-ant-abcd1234' } });
  const shown = JSON.stringify(config.publicConfig(saved, {}));
  assert.ok(!shown.includes('sk-ant-abcd1234'));
  assert.deepEqual(config.publicConfig(saved, {}).api.key, { source: 'saved', hint: '…1234' });
  assert.deepEqual(config.publicConfig(config.DEFAULT_CONFIG, { ANTHROPIC_API_KEY: 'x' }).api.key, { source: 'env', hint: 'ANTHROPIC_API_KEY' });
});

test('configProblems: a hosted API needs a key (saved or env); a local one does not', () => {
  const anthropic = config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api' });
  assert.match(config.configProblems(anthropic, {}).join(' '), /ANTHROPIC_API_KEY/);
  assert.deepEqual(config.configProblems(anthropic, { ANTHROPIC_API_KEY: 'x' }), []);
  const ollama = config.mergeConfig(anthropic, { api: { provider: 'ollama', model: 'qwen2.5vl' } });
  assert.deepEqual(config.configProblems(ollama, {}), []);
  assert.match(config.configProblems(config.mergeConfig(ollama, { api: { model: '' } }), {}).join(' '), /model/);
});

const IMAGE_MSG = [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', mediaType: 'image/png', data: 'AAAA' }] }];

test('buildRequest speaks Anthropic Messages for the anthropic provider', () => {
  const req = providers.buildRequest({ provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5' }, 'key', 'sys', IMAGE_MSG);
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.headers['x-api-key'], 'key');
  assert.equal(req.body.system, 'sys');
  assert.deepEqual(req.body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } });
});

test('buildRequest speaks OpenAI chat-completions for everything else, key optional', () => {
  const req = providers.buildRequest({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1/', model: 'qwen2.5vl' }, '', 'sys', IMAGE_MSG);
  assert.equal(req.url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(req.body.messages[0].role, 'system');
  assert.deepEqual(req.body.messages[1].content[1], { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
});

test('parseResponse reads text from both protocols and surfaces provider errors', () => {
  assert.equal(providers.parseResponse('anthropic', 200, { content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' }), 'hi');
  assert.equal(providers.parseResponse('openai', 200, { choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }] }), 'hi');
  assert.throws(() => providers.parseResponse('openai', 401, { error: { message: 'bad key' } }), /401: bad key/);
  assert.throws(() => providers.parseResponse('anthropic', 200, { content: [], stop_reason: 'max_tokens' }), /output limit/);
});

test('extractJson tolerates fences and surrounding prose', () => {
  assert.deepEqual(apiDrain.extractJson('Here you go:\n```json\n{"a": {"b": 1}}\n```'), { a: { b: 1 } });
  assert.deepEqual(apiDrain.extractJson('sure {"keptFrames": [1]} done'), { keptFrames: [1] });
  assert.throws(() => apiDrain.extractJson('no json here'), /no JSON/);
});

test('toResult maps kept frame numbers to paths and takes the line from the inbox', () => {
  const frames = [{ path: 'f1.png' }, { path: 'f2.png' }, { path: 'f3.png' }];
  const result = apiDrain.toResult({ keptFrames: [3, 1, 9], reference: { id: 'x' }, designSystem: {}, line: 'forged' }, { line: '- https://x.example' }, frames);
  assert.deepEqual(result.frames, ['f3.png', 'f1.png']);
  assert.equal(result.line, '- https://x.example');
  assert.equal(result.newCategory, undefined);
});

test('the system prompt carries the procedure docs', () => {
  const system = apiDrain.buildSystemPrompt();
  ['docs/agents/drain.md', 'docs/agents/drain-result.md', 'docs/agents/extract.md', 'docs/agents/image-prompt.md'].forEach((doc) => {
    assert.ok(system.includes('<document name="' + doc + '">'), doc);
  });
});

test('splitCommand handles quotes like a shell, without expanding anything', () => {
  assert.deepEqual(agentDrain.splitCommand('claude --print --dangerously-skip-permissions'), ['claude', '--print', '--dangerously-skip-permissions']);
  assert.deepEqual(agentDrain.splitCommand('my-agent --model "gpt x" \'$HOME\' a\\ b'), ['my-agent', '--model', 'gpt x', '$HOME', 'a b']);
  assert.deepEqual(agentDrain.splitCommand('run ""'), ['run', '']);
  assert.throws(() => agentDrain.splitCommand('run "open'), /unterminated/);
});

test('runAgent passes the prompt as the last argument and streams output lines', async () => {
  const lines = [];
  const command = '"' + process.execPath + '" -e "console.log(process.argv.at(-1).toUpperCase())"';
  const code = await agentDrain.runAgent(command, 'hello agent', { log: (l) => lines.push(l) });
  assert.equal(code, 0);
  assert.deepEqual(lines, ['HELLO AGENT']);
});

test('runAgent explains a missing binary', async () => {
  await assert.rejects(agentDrain.runAgent('definitely-not-an-agent-xyz --go', 'p', { log: () => {} }), /not found on PATH/);
});

test('buildPrompt fills the scope into prompts/drain.md', () => {
  assert.match(agentDrain.buildPrompt('https://x.example'), /URL \(optional\): https:\/\/x\.example/);
  assert.match(agentDrain.buildPrompt(), /whole inbox/);
});

const catalog = require('../scripts/ai/catalog.js');
const terminal = require('../scripts/ai/terminal.js');

test('catalog: every agent method points at a real preset, every key/local method at a real provider', () => {
  catalog.CATALOG.forEach((ai) => ai.methods.forEach((m) => {
    if (m.id === 'agent') {
      assert.ok(config.AGENT_PRESETS.some((p) => p.id === m.preset), ai.id);
      assert.ok(m.install && m.install.unix && m.install.win && m.login && m.login.command && m.docs, ai.id);
    } else {
      assert.ok(config.API_PROVIDERS.some((p) => p.id === m.provider), ai.id);
    }
  }));
});

test('terminal actions only come from the catalog — nothing the browser sends is run', () => {
  assert.equal(catalog.terminalAction('claude', 'login').command, 'claude');
  assert.equal(catalog.terminalAction('claude', 'install', null, 'win32').command, 'powershell -NoProfile -Command "irm https://claude.ai/install.ps1 | iex"');
  assert.equal(catalog.terminalAction('ollama', 'pull', 'qwen2.5vl').command, 'ollama pull qwen2.5vl');
  assert.equal(catalog.terminalAction('ollama', 'pull', 'qwen2.5vl; rm -rf ~'), null);
  assert.equal(catalog.terminalAction('openrouter', 'install'), null);
  assert.equal(catalog.terminalAction('claude', 'uninstall'), null);
  assert.equal(catalog.terminalAction('../../etc', 'login'), null);
});

test('terminal scripts quote their guidance text safely', () => {
  const sh = terminal.unixScript({ title: "It's a test", command: 'claude', steps: "Type /exit; don't `worry` $(now)" });
  assert.ok(sh.includes("'Inspiration Library — It'\\''s a test'"));
  assert.ok(sh.includes("'Type /exit; don'\\''t `worry` $(now)'"));
  const cmd = terminal.winScript({ title: 'A & B', command: 'codex', steps: '50% <done>' });
  assert.ok(cmd.includes('echo Inspiration Library - A ^& B'));
  assert.ok(cmd.includes('echo 50^% ^<done^>'));
});

test('pickModel prefers a strong vision-capable chat model and skips the rest', () => {
  assert.equal(config.pickModel('openai', ['gpt-4o-mini', 'gpt-5', 'gpt-5-mini', 'text-embedding-3-large']), 'gpt-5');
  assert.equal(config.pickModel('anthropic', ['claude-haiku-4-5-20251001', 'claude-opus-5', 'claude-sonnet-5']), 'claude-opus-5');
  assert.equal(config.pickModel('ollama', ['llama3.1:8b', 'qwen2.5vl:7b']), 'qwen2.5vl:7b');
  assert.equal(config.pickModel('gemini', ['models/gemini-2.5-flash', 'models/gemini-2.5-pro', 'models/text-embedding-004']), 'models/gemini-2.5-pro');
});

test('connectionLabel names the connection the way the header shows it', () => {
  assert.equal(config.connectionLabel(config.mergeConfig(config.DEFAULT_CONFIG, { agent: { preset: 'codex' } })), 'Codex CLI');
  assert.equal(config.connectionLabel(config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { provider: 'ollama', model: 'qwen2.5vl' } })), 'Ollama · qwen2.5vl');
  assert.equal(config.connectionLabel(config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { provider: 'custom', model: 'my-model' } })), 'my-model');
});

// ---- API keys stay out of the library folder -------------------------------

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const secrets = require('../scripts/ai/secrets.js');

function tempSetup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'il-keys-'));
  return {
    dir,
    file: path.join(dir, '.drain.config.json'),
    store: secrets.createStore({ backend: 'file', dir: path.join(dir, 'secret-store') }),
  };
}

test('saveConfig: the key goes to the secret store, never into the config file', () => {
  const t = tempSetup();
  const cfg = config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { apiKey: 'sk-ant-SECRET123' } });
  config.saveConfig(cfg, t);
  const onDisk = fs.readFileSync(t.file, 'utf8');
  assert.doesNotMatch(onDisk, /SECRET123/);
  assert.deepEqual(JSON.parse(onDisk).api.savedKey, { provider: 'anthropic', baseUrl: 'https://api.anthropic.com' });
  assert.equal(fs.statSync(t.file).mode & 0o777, 0o600);
  assert.equal(config.loadConfig(t).api.apiKey, 'sk-ant-SECRET123');
});

test('loadConfig: a plain-text key from an older config file is moved to the store and scrubbed', () => {
  const t = tempSetup();
  fs.writeFileSync(t.file, JSON.stringify({ mode: 'api', api: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5', apiKey: 'sk-OLDPLAIN' } }), { mode: 0o644 });
  assert.equal(config.loadConfig(t).api.apiKey, 'sk-OLDPLAIN');
  assert.doesNotMatch(fs.readFileSync(t.file, 'utf8'), /OLDPLAIN/);
  assert.equal(fs.statSync(t.file).mode & 0o777, 0o600);
  assert.equal(t.store.get('openai'), 'sk-OLDPLAIN');
});

test('loadConfig: a saved key is not handed to a different server than it was saved for', () => {
  const t = tempSetup();
  config.saveConfig(config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { apiKey: 'sk-ant-K' } }), t);
  const edited = JSON.parse(fs.readFileSync(t.file, 'utf8'));
  edited.api.baseUrl = 'https://evil.example';
  fs.writeFileSync(t.file, JSON.stringify(edited));
  assert.equal(config.loadConfig(t).api.apiKey, '');
});

test('saveConfig: switching provider or clearing the key removes the old key from the store', () => {
  const t = tempSetup();
  const withKey = config.mergeConfig(config.DEFAULT_CONFIG, { mode: 'api', api: { apiKey: 'sk-ant-K' } });
  config.saveConfig(withKey, t);
  config.saveConfig(config.mergeConfig(withKey, { api: { provider: 'ollama' } }), t);
  const fresh = secrets.createStore({ backend: 'file', dir: path.join(t.dir, 'secret-store') });
  assert.equal(fresh.get('anthropic'), '');
  assert.equal(JSON.parse(fs.readFileSync(t.file, 'utf8')).api.savedKey, undefined);
});

test('mergeConfig: pointing a provider at another server drops its saved key', () => {
  const saved = config.mergeConfig(config.DEFAULT_CONFIG, { api: { provider: 'custom' } });
  const keyed = config.mergeConfig(saved, { api: { baseUrl: 'https://a.example/v1', apiKey: 'k1' } });
  assert.equal(keyed.api.apiKey, 'k1');
  assert.equal(config.mergeConfig(keyed, { api: { baseUrl: 'https://a.example/v2' } }).api.apiKey, 'k1');
  assert.equal(config.mergeConfig(keyed, { api: { baseUrl: 'https://b.example/v1' } }).api.apiKey, '');
  assert.equal(config.mergeConfig(keyed, { api: { baseUrl: 'https://b.example/v1', apiKey: 'k2' } }).api.apiKey, 'k2');
});

test('insecureKeyTransport: keys only over https, or plain http to this computer', () => {
  assert.equal(config.insecureKeyTransport('https://api.openai.com/v1/models', 'k'), '');
  assert.equal(config.insecureKeyTransport('http://localhost:11434/v1', 'k'), '');
  assert.equal(config.insecureKeyTransport('http://127.0.0.1:1234/v1', 'k'), '');
  assert.equal(config.insecureKeyTransport('http://[::1]:8080/v1', 'k'), '');
  assert.equal(config.insecureKeyTransport('http://192.168.1.5:8080/v1', ''), '');
  assert.match(config.insecureKeyTransport('http://192.168.1.5:8080/v1', 'k'), /unencrypted http/);
});

test('secrets file store: round trip, private file, refuses odd names', () => {
  const t = tempSetup();
  t.store.set('openai', 'sk-1');
  assert.equal(secrets.createStore({ backend: 'file', dir: path.join(t.dir, 'secret-store') }).get('openai'), 'sk-1');
  assert.equal(fs.statSync(path.join(t.dir, 'secret-store', 'keys.json')).mode & 0o777, 0o600);
  assert.throws(() => t.store.set('../x', 'k'), /bad secret name/);
  t.store.remove('openai');
  assert.equal(t.store.get('openai'), '');
});

test('redactKey: a key quoted back in a provider error is masked', () => {
  const err = providers.redactKey(new Error('HTTP 401: Incorrect API key provided: sk-proj-ABCDEFGH1234.'), 'sk-proj-ABCDEFGH1234');
  assert.equal(err.message, 'HTTP 401: Incorrect API key provided: …1234.');
});

test('listModels: refuses to send a key over plain http to another machine', async () => {
  await assert.rejects(
    providers.listModels({ provider: 'custom', baseUrl: 'http://192.168.1.5:8080/v1', apiKey: 'sk-LAN' }),
    /unencrypted http/
  );
});
