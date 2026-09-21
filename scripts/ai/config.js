// Which AI a drain uses, and how to reach it. Two modes
// (docs/adr/0007-local-helper-connects-any-ai.md):
//
//   agent — hand the whole drain to an agent CLI the collector already uses
//           (Claude Code, Codex, Gemini CLI, OpenCode, Pi, Hermes, …). The
//           agent runs docs/agents/drain.md itself.
//   api   — the helper runs the drain and calls a model API directly
//           (Anthropic, OpenAI, Gemini, OpenRouter, Ollama, LM Studio, or any
//           OpenAI-compatible endpoint). No agent CLI needed.
//
// Stored in .drain.config.json at the repo root (gitignored). The file never
// holds an API key: keys live in the operating system's secret store
// (scripts/ai/secrets.js) and the file only notes which provider and server
// a saved key belongs to. Keys never leave the helper either: publicConfig()
// masks them before anything is sent to the browser.

var fs = require('fs');
var path = require('path');
var secrets = require('./secrets.js');

var ROOT = path.resolve(__dirname, '../..');
var CONFIG_FILE = path.join(ROOT, '.drain.config.json');

// Headless commands; the prompt is appended as the final argument. Flags
// change between releases — the UI lets the collector edit the command.
var AGENT_PRESETS = [
  { id: 'claude', label: 'Claude Code', command: 'claude --print --dangerously-skip-permissions' },
  { id: 'codex', label: 'Codex CLI', command: 'codex exec --dangerously-bypass-approvals-and-sandbox' },
  { id: 'gemini', label: 'Gemini CLI', command: 'gemini --yolo -p' },
  { id: 'opencode', label: 'OpenCode', command: 'opencode run' },
  { id: 'pi', label: 'Pi', command: 'pi -p' },
  { id: 'hermes', label: 'Hermes Agent', command: 'hermes chat --yolo -q' },
  { id: 'custom', label: 'Custom command', command: '' },
];

// format: which wire protocol callModel speaks. keyEnv: the environment
// variable used when no key is saved, so a collector who already exports
// OPENAI_API_KEY etc. never has to paste it into the UI.
var API_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', format: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5', keyEnv: 'ANTHROPIC_API_KEY', needsKey: true },
  { id: 'openai', label: 'OpenAI (GPT)', format: 'openai', baseUrl: 'https://api.openai.com/v1', model: '', keyEnv: 'OPENAI_API_KEY', needsKey: true },
  { id: 'gemini', label: 'Google Gemini', format: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '', keyEnv: 'GEMINI_API_KEY', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', format: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: '', keyEnv: 'OPENROUTER_API_KEY', needsKey: true },
  { id: 'ollama', label: 'Ollama (local)', format: 'openai', baseUrl: 'http://localhost:11434/v1', model: '', keyEnv: '', needsKey: false },
  { id: 'lmstudio', label: 'LM Studio (local)', format: 'openai', baseUrl: 'http://localhost:1234/v1', model: '', keyEnv: '', needsKey: false },
  { id: 'custom', label: 'Other OpenAI-compatible', format: 'openai', baseUrl: '', model: '', keyEnv: '', needsKey: false },
];

// connection: set only by a successful Connect (a passing connection test),
// cleared by any settings change — it's what the app's Drain button checks.
var DEFAULT_CONFIG = {
  connection: null,
  mode: 'agent',
  agent: { preset: 'claude', command: AGENT_PRESETS[0].command },
  api: { provider: 'anthropic', baseUrl: API_PROVIDERS[0].baseUrl, model: API_PROVIDERS[0].model, apiKey: '' },
};

function findProvider(id) {
  return API_PROVIDERS.find(function (p) { return p.id === id; }) || API_PROVIDERS[API_PROVIDERS.length - 1];
}

function findPreset(id) {
  return AGENT_PRESETS.find(function (p) { return p.id === id; }) || AGENT_PRESETS[AGENT_PRESETS.length - 1];
}

// Merges a partial update (from the UI) over the current config. An empty
// apiKey means "keep the saved one"; clearKey removes it. Switching provider
// or preset without naming a baseUrl/command picks up the new one's default.
function mergeConfig(current, update) {
  var next = JSON.parse(JSON.stringify(current || DEFAULT_CONFIG));
  update = update || {};
  if (update.connection !== undefined) next.connection = update.connection;
  if (update.mode === 'agent' || update.mode === 'api') next.mode = update.mode;

  if (update.agent) {
    if (update.agent.preset && update.agent.preset !== next.agent.preset) {
      next.agent.preset = findPreset(update.agent.preset).id;
      next.agent.command = findPreset(next.agent.preset).command;
    }
    if (typeof update.agent.command === 'string') next.agent.command = update.agent.command.trim();
  }

  if (update.api) {
    if (update.api.provider && update.api.provider !== next.api.provider) {
      var provider = findProvider(update.api.provider);
      next.api.provider = provider.id;
      next.api.baseUrl = provider.baseUrl;
      next.api.model = provider.model;
      next.api.apiKey = '';
    }
    if (typeof update.api.baseUrl === 'string') {
      var nextBase = update.api.baseUrl.trim().replace(/\/+$/, '');
      // A saved key belongs to the server it was saved for. Pointing the
      // same provider somewhere else drops it, unless a key comes with the
      // change — so a key saved for one server is never sent to another.
      if (originOf(nextBase) !== originOf(next.api.baseUrl)) next.api.apiKey = '';
      next.api.baseUrl = nextBase;
    }
    if (typeof update.api.model === 'string') next.api.model = update.api.model.trim();
    if (typeof update.api.apiKey === 'string' && update.api.apiKey.trim()) next.api.apiKey = update.api.apiKey.trim();
    if (update.api.clearKey) next.api.apiKey = '';
  }
  return next;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (e) {
    return String(url || '');
  }
}

// A key may travel over plain http only to this computer (Ollama, LM
// Studio, a local proxy); anywhere else it would cross the network readable
// by anyone on it. Returns the reason to refuse, or '' when it's fine.
function insecureKeyTransport(url, apiKey) {
  if (!apiKey) return '';
  var u;
  try {
    u = new URL(url);
  } catch (e) {
    return '';
  }
  if (u.protocol === 'https:') return '';
  var host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || /^127\./.test(host)) return '';
  return 'Refusing to send your API key to ' + u.host + ' over unencrypted http. Use an https:// address.';
}

// The key a request will actually use: the saved one, else the provider's
// environment variable.
function resolveApiKey(api, env) {
  if (api.apiKey) return api.apiKey;
  var provider = findProvider(api.provider);
  return (provider.keyEnv && (env || process.env)[provider.keyEnv]) || '';
}

// What the browser is allowed to see: everything except the key itself.
function publicConfig(config, env) {
  var api = config.api;
  var provider = findProvider(api.provider);
  var envKey = provider.keyEnv && (env || process.env)[provider.keyEnv];
  return {
    connection: config.connection || null,
    mode: config.mode,
    agent: { preset: config.agent.preset, command: config.agent.command },
    api: {
      provider: api.provider,
      baseUrl: api.baseUrl,
      model: api.model,
      key: api.apiKey
        ? { source: 'saved', hint: '…' + api.apiKey.slice(-4) }
        : envKey
          ? { source: 'env', hint: provider.keyEnv }
          : { source: 'none' },
    },
  };
}

// Problems that make a config unusable, in words the UI can show as-is.
function configProblems(config, env) {
  var problems = [];
  if (config.mode === 'agent') {
    if (!config.agent.command) problems.push('Enter the command that runs your agent headlessly.');
  } else {
    var provider = findProvider(config.api.provider);
    if (!config.api.baseUrl) problems.push('Enter the API base URL.');
    if (!config.api.model) problems.push('Enter a model name — one that can read images.');
    if (provider.needsKey && !resolveApiKey(config.api, env)) {
      problems.push('Add an API key' + (provider.keyEnv ? ' (or export ' + provider.keyEnv + ' before starting the helper).' : '.'));
    }
  }
  return problems;
}

// What the connection is called in the app's header: "Claude Code",
// "OpenAI · gpt-5", "Ollama · qwen2.5vl".
function connectionLabel(config) {
  if (config.mode === 'agent') {
    var preset = findPreset(config.agent.preset);
    return preset.id === 'custom' ? config.agent.command.split(/\s+/)[0] : preset.label;
  }
  var provider = findProvider(config.api.provider);
  if (provider.id === 'custom') return config.api.model;
  return provider.label.replace(/ \(.*\)$/, '') + ' · ' + config.api.model;
}

// Picks a sensible default from a provider's model list: the strongest
// general model that can read images. The collector can always change it.
var MODEL_PREFERENCES = {
  anthropic: [/^claude-opus-5$/, /^claude-opus/, /^claude-sonnet/, /^claude/],
  openai: [/^gpt-5(\.\d+)?$/, /^gpt-5/, /^gpt-4\.1$/, /^gpt-4o$/, /^gpt/],
  gemini: [/gemini-[\d.]+-pro$/, /gemini.*pro/, /gemini.*flash/, /gemini/],
  openrouter: [/claude-opus/, /gpt-5/, /gemini.*pro/, /claude/],
  ollama: [/(vl|vision|llava|gemma3|minicpm-v|moondream)/],
  lmstudio: [/(vl|vision|llava|gemma-?3|minicpm-v|moondream)/],
};
var NOT_CHAT = /(embed|audio|realtime|transcribe|tts|whisper|dall-e|image|moderation|search|instruct|computer-use|codex|-mini|-nano|live)/i;

function pickModel(providerId, ids) {
  var usable = (ids || []).filter(function (id) { return !NOT_CHAT.test(id); }).sort().reverse();
  var preferences = MODEL_PREFERENCES[providerId] || [];
  for (var i = 0; i < preferences.length; i++) {
    var hit = usable.find(function (id) { return preferences[i].test(id); });
    if (hit) return hit;
  }
  return usable[0] || (ids || [])[0] || '';
}

// options: { file, store } — the tests point these at a temp file and a
// file-backed secret store.
function readConfigFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

// On load the saved key is fetched back from the secret store — but only if
// it was saved for this same provider and server. A config file written
// before keys moved out of it still has `apiKey` in plain text: that key is
// moved into the store and scrubbed from the file here, the first time the
// helper reads it.
function loadConfig(options) {
  options = options || {};
  var file = options.file || CONFIG_FILE;
  var store = options.store || secrets.defaultStore();
  var raw = readConfigFile(file);
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  var legacyKey = raw.api && typeof raw.api.apiKey === 'string' ? raw.api.apiKey.trim() : '';
  var savedKey = raw.api && raw.api.savedKey;
  if (raw.api) delete raw.api.apiKey;
  var config = mergeConfig(DEFAULT_CONFIG, raw);

  if (legacyKey) {
    config.api.apiKey = legacyKey;
    try {
      saveConfig(config, { file: file, store: store });
    } catch (e) {
      // The store refused it; keep working with the key in memory and try
      // again on the next load rather than failing the helper.
    }
    return config;
  }
  if (savedKey && savedKey.provider === config.api.provider && originOf(savedKey.baseUrl) === originOf(config.api.baseUrl)) {
    config.api.apiKey = store.get(config.api.provider);
  }
  return config;
}

// Written without the key: the key goes to the secret store, and the file
// records only { provider, baseUrl } for it. A key for a provider no longer
// in use is removed from the store, so nothing lingers there either.
// Written atomically, and 0600 even when replacing an older, looser file.
function saveConfig(config, options) {
  options = options || {};
  var file = options.file || CONFIG_FILE;
  var store = options.store || secrets.defaultStore();
  var previous = readConfigFile(file);
  var previousProvider = previous && previous.api && previous.api.savedKey ? previous.api.savedKey.provider : null;

  var onDisk = JSON.parse(JSON.stringify(config));
  var key = onDisk.api.apiKey;
  delete onDisk.api.apiKey;
  delete onDisk.api.savedKey;
  if (key) {
    store.set(config.api.provider, key);
    onDisk.api.savedKey = { provider: config.api.provider, baseUrl: config.api.baseUrl };
  }
  if (previousProvider && (!key || previousProvider !== config.api.provider)) store.remove(previousProvider);

  var tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(onDisk, null, 2) + '\n', { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

// Where keys are kept, in words for the Connect panel.
function keyStoreLabel() {
  return secrets.defaultStore().label;
}

module.exports = {
  AGENT_PRESETS: AGENT_PRESETS,
  API_PROVIDERS: API_PROVIDERS,
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  CONFIG_FILE: CONFIG_FILE,
  findProvider: findProvider,
  findPreset: findPreset,
  mergeConfig: mergeConfig,
  resolveApiKey: resolveApiKey,
  insecureKeyTransport: insecureKeyTransport,
  keyStoreLabel: keyStoreLabel,
  publicConfig: publicConfig,
  configProblems: configProblems,
  connectionLabel: connectionLabel,
  pickModel: pickModel,
  loadConfig: loadConfig,
  saveConfig: saveConfig,
};
