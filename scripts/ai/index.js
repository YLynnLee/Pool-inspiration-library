// The helper's one entry point into draining: run a drain, or test that the
// configured AI is reachable and can see images, in whichever mode the
// config names. Used by scripts/server.js (the app's Drain panel) and
// scripts/drain-run.js (terminal and nightly runs).

var childProcess = require('child_process');
var configModule = require('./config.js');
var providers = require('./providers.js');
var agentDrain = require('./agent-drain.js');
var catalog = require('./catalog.js');
var terminal = require('./terminal.js');
var os = require('os');
var path = require('path');
var apiDrain = require('./api-drain.js');

// A 64×64 solid red PNG: a vision check that costs a handful of tokens. A
// model that answers "red" can see images; one that can't will say so or
// guess, and a drain needs to know before it starts.
var RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAf0lEQVR4nNXOQREAIAzAsFIN868MMYjgsWsU5NwZyiRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4twO/HpDkwGEXgoORwAAAABJRU5ErkJggg==';

// The helper may have been started without the PATH a terminal has (from
// Finder, or before an app was installed). Before looking for AI apps,
// merge in the user's login-shell PATH and the usual install locations, so
// an app installed a minute ago is found without restarting anything.
// Asking a login shell for its PATH takes a couple of seconds, so it runs
// once at startup and again only when the collector presses "Check again".
function capture(bin, args) {
  return new Promise(function (resolve) {
    childProcess.execFile(bin, args, { encoding: 'utf8', timeout: 6000 }, function (err, stdout) {
      resolve(err ? '' : String(stdout).trim());
    });
  });
}

var npmBin = null;
var pathRefreshed = null;
function refreshPath() {
  pathRefreshed = (async function () {
    var loginPath = process.platform !== 'win32' && process.env.SHELL ? await capture(process.env.SHELL, ['-ilc', 'printf %s "$PATH"']) : '';
    if (npmBin === null) {
      var prefix = await capture(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['prefix', '-g']);
      npmBin = prefix ? (process.platform === 'win32' ? prefix : path.join(prefix, 'bin')) : '';
    }
    var parts = (process.env.PATH || '').split(path.delimiter);
    var add = function (dir) {
      if (dir && parts.indexOf(dir) === -1) parts.push(dir);
    };
    loginPath.split(':').forEach(add);
    add(npmBin);
    add(path.join(os.homedir(), '.local', 'bin'));
    if (process.platform === 'darwin') {
      add('/opt/homebrew/bin');
      add('/usr/local/bin');
    }
    process.env.PATH = parts.filter(Boolean).join(path.delimiter);
  })();
  return pathRefreshed;
}

function onPath(bin) {
  var lookup = process.platform === 'win32' ? 'where' : 'which';
  return childProcess.spawnSync(lookup, [bin], { encoding: 'utf8' }).status === 0;
}

async function testConnection(config) {
  var problems = configModule.configProblems(config);
  if (problems.length) return { ok: false, message: problems.join(' ') };

  if (config.mode === 'agent') {
    var argv;
    try {
      argv = agentDrain.splitCommand(config.agent.command);
    } catch (e) {
      return { ok: false, message: e.message };
    }
    if (!onPath(argv[0])) {
      return { ok: false, message: '"' + argv[0] + '" is not on PATH. Install it, or start the helper from a terminal where it runs.' };
    }
    var output = [];
    try {
      var code = await agentDrain.runAgent(config.agent.command, 'Reply with exactly the word OK and nothing else. Do not run any tools.', {
        log: function (l) { output.push(l); },
        timeoutMs: 180000,
      });
      var text = output.join('\n').trim();
      if (code === 0 && /\bok\b/i.test(text)) return { ok: true, message: argv[0] + ' answered. It will run the drain with its own tools and model.' };
      return { ok: false, message: argv[0] + ' didn’t answer' + (text ? ': “' + text.slice(-300) + '”' : '') + '. If you haven’t logged in yet, do step 2 first.' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  try {
    var reply = await providers.callModel(config.api, 'You are a connection test. Answer in one word.', [{
      role: 'user',
      content: [
        { type: 'image', mediaType: 'image/png', data: RED_PNG },
        { type: 'text', text: 'What colour fills this image? One word.' },
      ],
    }]);
    if (/\bred\b/i.test(reply)) return { ok: true, message: config.api.model + ' answered and can see images.' };
    return { ok: false, message: config.api.model + ' answered "' + reply.trim().slice(0, 80) + '" to a solid red image — it may not support images, and a drain needs vision.' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// What the Connect panel can offer on this machine: which agent apps are
// installed, which local model servers are running (and their models), and
// which providers already have a key in the environment.
async function detect(options) {
  if (!pathRefreshed || (options && options.fresh)) refreshPath();
  await pathRefreshed;
  var agents = configModule.AGENT_PRESETS.filter(function (p) { return p.id !== 'custom'; }).map(function (p) {
    return { id: p.id, label: p.label, command: p.command, installed: onPath(p.command.split(' ')[0]) };
  });
  var local = await Promise.all(['ollama', 'lmstudio'].map(function (id) {
    var provider = configModule.findProvider(id);
    return providers.listModels({ provider: id, baseUrl: provider.baseUrl }, { timeoutMs: 1500 }).then(function (models) {
      return { id: id, label: provider.label, running: true, models: models, suggested: configModule.pickModel(id, models) };
    }, function () {
      return { id: id, label: provider.label, running: false, models: [] };
    });
  }));
  var envKeys = configModule.API_PROVIDERS.filter(function (p) { return p.keyEnv && process.env[p.keyEnv]; }).map(function (p) { return p.id; });
  return { agents: agents, local: local, envKeys: envKeys };
}

// Lists a provider's models for the key being entered, with a suggested
// default, so the collector picks from a list instead of typing a name.
async function models(update) {
  var draft = configModule.mergeConfig(configModule.loadConfig(), update);
  var ids = await providers.listModels(draft.api);
  return { models: ids, suggested: configModule.pickModel(draft.api.provider, ids) };
}

// Connect = apply the choice, prove it works, and only then save it as the
// connection the Drain button uses. A failed test saves nothing.
async function connect(update) {
  var draft = configModule.mergeConfig(configModule.loadConfig(), update);
  draft.connection = null;
  var result = await testConnection(draft);
  if (!result.ok) return result;
  draft.connection = { label: configModule.connectionLabel(draft), ai: typeof update.ai === 'string' ? update.ai : null, at: new Date().toISOString() };
  configModule.saveConfig(draft);
  return { ok: true, message: 'Connected to ' + draft.connection.label + '.' };
}

// Opens a Terminal window for one of the catalog's install/login/download
// steps. Anything not in the catalog is refused.
async function runTerminalAction(body) {
  var action = catalog.terminalAction(body.ai, body.action, body.arg);
  if (!action) return { ok: false, message: 'That action isn’t available.' };
  try {
    await terminal.openTerminal(action);
    return { ok: true, message: 'A Terminal window opened — ' + action.steps };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function disconnect() {
  var config = configModule.loadConfig();
  config.connection = null;
  configModule.saveConfig(config);
}

// options: { url?, log(line), signal? }
async function runDrain(config, options) {
  var problems = configModule.configProblems(config);
  if (problems.length) throw new Error(problems.join(' '));
  if (config.mode === 'agent') {
    return agentDrain.runAgentDrain(Object.assign({ command: config.agent.command }, options));
  }
  options.log('Draining with ' + configModule.findProvider(config.api.provider).label + ' · ' + config.api.model);
  return apiDrain.runApiDrain(Object.assign({ api: config.api }, options));
}

module.exports = { testConnection: testConnection, runDrain: runDrain, detect: detect, models: models, connect: connect, disconnect: disconnect, runTerminalAction: runTerminalAction, refreshPath: refreshPath };
