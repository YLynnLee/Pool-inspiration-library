// Every AI the Connect panel offers, by the name people know it by, and how
// each one connects: through its agent app (install → log in → connect),
// an API key, or a local model server. This is also the allowlist for the
// helper's "run in a Terminal window" actions — the browser can only name a
// tool and an action; the command itself always comes from here. See
// SECURITY.md.
//
// Commands are the tools' own documented ones (checked 2026-09); links go to
// their docs so a collector can install by hand if a command ever changes.

var CATALOG = [
  {
    id: 'claude',
    name: 'Claude',
    blurb: 'Anthropic’s Claude — use your Claude subscription or an API key.',
    methods: [
      {
        id: 'agent',
        label: 'Claude subscription',
        preset: 'claude',
        app: 'Claude Code',
        needs: 'A Claude Pro, Max, Team or Enterprise plan.',
        docs: 'https://code.claude.com/docs/en/setup',
        install: { unix: 'curl -fsSL https://claude.ai/install.sh | bash', win: 'powershell -NoProfile -Command "irm https://claude.ai/install.ps1 | iex"' },
        login: { command: 'claude', steps: 'Claude Code opens and sends you to your browser to sign in. When it says you’re logged in, type /exit and close the window.' },
      },
      { id: 'key', label: 'API key', provider: 'anthropic', keyUrl: 'https://console.anthropic.com/settings/keys' },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    blurb: 'OpenAI’s GPT models — use your ChatGPT plan through Codex, or an API key.',
    methods: [
      {
        id: 'agent',
        label: 'ChatGPT subscription',
        preset: 'codex',
        app: 'Codex',
        needs: 'A ChatGPT Plus, Pro, Business or Enterprise plan.',
        docs: 'https://github.com/openai/codex',
        install: { unix: 'npm install -g @openai/codex', win: 'npm install -g @openai/codex' },
        login: { command: 'codex', steps: 'Codex opens. Choose “Sign in with ChatGPT” and finish in your browser, then close the window.' },
      },
      { id: 'key', label: 'API key', provider: 'openai', keyUrl: 'https://platform.openai.com/api-keys' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    blurb: 'Google’s Gemini — sign in with your Google account, or use an API key.',
    methods: [
      {
        id: 'agent',
        label: 'Google account',
        preset: 'antigravity',
        app: 'Antigravity CLI',
        needs: 'A Google account.',
        docs: 'https://github.com/google-antigravity/antigravity-cli',
        install: { unix: 'curl -fsSL https://antigravity.google/cli/install.sh | bash', win: 'powershell -NoProfile -Command "irm https://antigravity.google/cli/install.ps1 | iex"' },
        login: { command: 'agy', steps: 'Antigravity CLI opens and sends you to your browser to sign in with Google. When it says you’re signed in, close the window.' },
      },
      { id: 'key', label: 'API key', provider: 'gemini', keyUrl: 'https://aistudio.google.com/apikey' },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    blurb: 'An open-source agent that works with many model providers.',
    methods: [{
      id: 'agent',
      label: 'OpenCode',
      preset: 'opencode',
      app: 'OpenCode',
      needs: 'An account with any provider OpenCode supports.',
      docs: 'https://opencode.ai/docs/',
      install: { unix: 'npm install -g opencode-ai', win: 'npm install -g opencode-ai' },
      login: { command: 'opencode', steps: 'OpenCode opens. Type /connect, pick your provider and sign in, then close the window.' },
    }],
  },
  {
    id: 'pi',
    name: 'Pi',
    blurb: 'A minimal agent that can use your Claude, ChatGPT or Copilot subscription.',
    methods: [{
      id: 'agent',
      label: 'Pi',
      preset: 'pi',
      app: 'Pi',
      needs: 'A Claude, ChatGPT or GitHub Copilot subscription, or an API key.',
      docs: 'https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent',
      install: { unix: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent', win: 'npm install -g --ignore-scripts @earendil-works/pi-coding-agent' },
      login: { command: 'pi', steps: 'Pi opens. Type /login, choose your subscription and finish in your browser, then close the window.' },
    }],
  },
  {
    id: 'hermes',
    name: 'Hermes',
    blurb: 'Nous Research’s agent, with its own setup wizard for many providers.',
    methods: [{
      id: 'agent',
      label: 'Hermes',
      preset: 'hermes',
      app: 'Hermes Agent',
      needs: 'An account with any provider Hermes supports.',
      docs: 'https://hermes-agent.nousresearch.com/docs/',
      install: { unix: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash', win: 'powershell -NoProfile -Command "iex (irm https://hermes-agent.nousresearch.com/install.ps1)"' },
      login: { command: 'hermes model', steps: 'The Hermes setup wizard opens. Pick a provider and sign in or paste its key, then close the window.' },
    }],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    blurb: 'One key for hundreds of models from every major lab.',
    methods: [{ id: 'key', label: 'API key', provider: 'openrouter', keyUrl: 'https://openrouter.ai/keys' }],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    blurb: 'Run a model on this computer — free and private.',
    methods: [{
      id: 'local',
      label: 'Ollama',
      provider: 'ollama',
      download: 'https://ollama.com/download',
      startHint: 'Installed already? Open the Ollama app so it’s running.',
      pull: ['qwen2.5vl', 'gemma3', 'llama3.2-vision'],
    }],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    blurb: 'Run a model on this computer with a friendly app.',
    methods: [{
      id: 'local',
      label: 'LM Studio',
      provider: 'lmstudio',
      download: 'https://lmstudio.ai',
      startHint: 'In LM Studio, download a vision model (e.g. Qwen2.5-VL or Gemma 3), load it, then turn on the local server in the Developer tab.',
      pull: [],
    }],
  },
];

function findMethod(aiId, methodId) {
  var ai = CATALOG.find(function (a) { return a.id === aiId; });
  var method = ai && ai.methods.find(function (m) { return m.id === methodId; });
  return method ? { ai: ai, method: method } : null;
}

// The only commands the helper will open a Terminal window for: an agent
// app's install or login, or pulling one of the listed Ollama models.
function terminalAction(aiId, action, arg, platform) {
  var found = findMethod(aiId, action === 'pull' ? 'local' : 'agent');
  if (!found) return null;
  var m = found.method;
  var win = (platform || process.platform) === 'win32';
  if (action === 'install' && m.install) {
    return { title: 'Install ' + m.app, command: win ? m.install.win : m.install.unix, steps: 'Installing ' + m.app + '. When it finishes, close this window and press “Check again” in the library.' };
  }
  if (action === 'login' && m.login) {
    return { title: 'Log in to ' + m.app, command: m.login.command, steps: m.login.steps };
  }
  if (action === 'pull' && m.pull && m.pull.indexOf(arg) !== -1) {
    return { title: 'Download ' + arg, command: 'ollama pull ' + arg, steps: 'Downloading ' + arg + ' (a few GB). When it finishes, close this window and press “Check again” in the library.' };
  }
  return null;
}

// What the browser gets: the catalog minus nothing secret (there is
// nothing secret in it), with install commands resolved for this platform
// so the panel can show "or run this yourself".
function publicCatalog(platform) {
  var win = (platform || process.platform) === 'win32';
  return CATALOG.map(function (ai) {
    return Object.assign({}, ai, {
      methods: ai.methods.map(function (m) {
        var copy = Object.assign({}, m);
        if (m.install) copy.install = win ? m.install.win : m.install.unix;
        return copy;
      }),
    });
  });
}

module.exports = { CATALOG: CATALOG, findMethod: findMethod, terminalAction: terminalAction, publicCatalog: publicCatalog };
