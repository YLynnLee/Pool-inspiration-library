// The helper's one entry point into draining: run a drain, or test that the
// configured AI is reachable and can see images, in whichever mode the
// config names. Used by scripts/server.js (the app's Drain panel) and
// scripts/drain-run.js (terminal runs).

var childProcess = require('child_process');
var configModule = require('./config.js');
var providers = require('./providers.js');
var agentDrain = require('./agent-drain.js');
var catalog = require('./catalog.js');
var terminal = require('./terminal.js');
var os = require('os');
var path = require('path');
var apiDrain = require('./api-drain.js');

var ROOT = path.resolve(__dirname, '../..');

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

// Pulls the model name out of an agent's two-line test reply ("OK" then the
// model). Agents vary in how chatty they are even when told not to be, so
// this takes the last non-empty line that isn't itself just "OK" and trims
// it down to something label-sized.
function extractAgentModel(text) {
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var candidate = lines.filter(function (l) { return !/^ok\.?$/i.test(l); }).pop();
  if (!candidate) return null;
  candidate = candidate.replace(/^(model( name)?|running as)\s*[:\-]\s*/i, '').replace(/^["'`]|["'`]$/g, '');
  return candidate.slice(0, 80) || null;
}

async function testConnection(config) {
  var problems = configModule.configProblems(config);
  if (problems.length) return { ok: false, message: problems.join(' ') };

  if (config.mode === 'agent') {
    var argv;
    try {
      argv = agentDrain.splitCommand(configModule.agentCommand(config));
    } catch (e) {
      return { ok: false, message: e.message };
    }
    if (!onPath(argv[0])) {
      return { ok: false, message: '"' + argv[0] + '" is not on PATH. Install it, or start the helper from a terminal where it runs.' };
    }
    var output = [];
    try {
      var code = await agentDrain.runAgent(
        configModule.agentCommand(config),
        'Reply with exactly two lines and nothing else: the word OK on the first line, ' +
          'then the exact name of the model you are running as on the second line. Do not run any tools.',
        { log: function (l) { output.push(l); }, timeoutMs: 180000 }
      );
      var text = output.join('\n').trim();
      if (code === 0 && /\bok\b/i.test(text)) {
        var model = extractAgentModel(text);
        return {
          ok: true,
          message: argv[0] + ' answered. It will analyse links with its own tools and model' + (model ? ' (' + model + ').' : '.'),
          model: model,
        };
      }
      var failure = { ok: false, message: argv[0] + ' didn’t answer' + (text ? ': “' + text.slice(-300) + '”' : '') + '.' };
      // Read against the catalog's login prompts for this app. A match is
      // reported so the window can send the collector to the login step.
      if (catalog.looksLoggedOut(config.agent.preset, text)) failure.loggedOut = true;
      return failure;
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
    return { ok: false, message: config.api.model + ' answered "' + reply.trim().slice(0, 80) + '" to a solid red image — it may not support images, and analysing needs vision.' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// What the Connect panel can offer on this machine: which agent apps are
// installed, which local model servers are running (and their models), and
// which providers already have a key in the environment. Each agent app also
// says whether it's signedIn: 'yes' | 'no' | 'unknown', from what the helper
// has seen of its tests (see config.loginState).
// `storage` ({ file, store }) is where the config is read from.
async function detect(options, storage) {
  if (!pathRefreshed || (options && options.fresh)) refreshPath();
  await pathRefreshed;
  var saved = configModule.loadConfig(storage);
  var agents = configModule.AGENT_PRESETS.filter(function (p) { return p.id !== 'custom'; }).map(function (p) {
    return { id: p.id, label: p.label, command: p.command, installed: onPath(p.command.split(' ')[0]), signedIn: configModule.loginState(saved, p.id) };
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

// Lists the models the collector can switch to: a provider's models for the
// key being entered (or the saved one), or, in agent mode, the agent's own
// list, with a suggested default, so the collector picks from a list instead
// of typing a name.
async function models(update, storage) {
  var draft = configModule.mergeConfig(configModule.loadConfig(storage), update);
  if (draft.mode === 'agent') return agentModels(configModule.findPreset(draft.agent.preset));
  var ids = await providers.listModels(draft.api);
  return { models: ids, suggested: configModule.pickModel(draft.api.provider, ids) };
}

// An agent's models: its own list command when it has one and it answers,
// else the preset's shortcuts. `free` says a typed name is accepted too.
async function agentModels(preset) {
  var shortcuts = (preset.models || []).map(function (m) { return { id: m[0], label: m[1] }; });
  var result = { models: shortcuts, suggested: '', free: Boolean(preset.modelFlag), supported: Boolean(preset.modelFlag) };
  if (!preset.listModels) return result;
  if (!pathRefreshed) refreshPath();
  await pathRefreshed;
  var argv = agentDrain.splitCommand(preset.listModels);
  var listed = await new Promise(function (resolve) {
    childProcess.execFile(argv[0], argv.slice(1), { cwd: ROOT, timeout: 30000, maxBuffer: 1e6 }, function (err, stdout) {
      resolve(err ? [] : parseModelList(String(stdout)));
    });
  });
  if (listed.length) result.models = listed;
  return result;
}

// One model per line, the id first and an optional tab-separated label;
// progress lines ("Fetching available models...") are skipped.
function parseModelList(text) {
  return text.split('\n').map(function (line) {
    var parts = line.trim().split('\t');
    var id = parts[0].trim();
    if (!id || /\s/.test(id) || /\.\.\.$/.test(id)) return null;
    return { id: id, label: (parts[1] || id).trim() };
  }).filter(Boolean);
}

// Connect = apply the choice, prove it works, and only then save it as the
// connection the Drain button uses. A failed test saves no connection — but a
// pass, or a login prompt in the failure, is remembered for that agent app.
async function connect(update, storage) {
  var draft = configModule.mergeConfig(configModule.loadConfig(storage), update);
  draft.connection = null;
  var result = await testConnection(draft);
  if (draft.mode === 'agent') {
    var event = result.ok ? 'answered' : result.loggedOut ? 'loggedOut' : null;
    if (event) {
      var remembered = configModule.recordLogin(draft, draft.agent.preset, event);
      if (result.ok) draft = remembered;
      else configModule.saveConfig(Object.assign(configModule.loadConfig(storage), { logins: remembered.logins }), storage);
    }
  }
  if (!result.ok) return result;
  var label = configModule.connectionLabel(draft);
  if (draft.mode === 'agent' && result.model) label += ' · ' + result.model;
  // Changing model on the same AI keeps "connected since" as it was.
  var aiId = typeof update.ai === 'string' ? update.ai : null;
  var previous = configModule.loadConfig(storage).connection;
  var since = previous && aiId && previous.ai === aiId && previous.at ? previous.at : new Date().toISOString();
  draft.connection = { label: label, ai: aiId, at: since };
  configModule.saveConfig(draft, storage);
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

// Clears the connection only: installed apps and logins are untouched, so the
// window can land on the step the collector is actually at.
function disconnect(storage) {
  var config = configModule.loadConfig(storage);
  config.connection = null;
  configModule.saveConfig(config, storage);
}

// options: { url?, log(line), signal?, remaining?() }
async function runDrain(config, options) {
  var problems = configModule.configProblems(config);
  if (problems.length) throw new Error(problems.join(' '));
  if (config.mode === 'agent') {
    return agentDrain.runAgentDrain(Object.assign({ command: configModule.agentCommand(config) }, options));
  }
  options.log('Draining with ' + configModule.findProvider(config.api.provider).label + ' · ' + config.api.model);
  return apiDrain.runApiDrain(Object.assign({ api: config.api }, options));
}

// The words for each kind of connection-level failure. `short` goes in the
// header, `title` is its tooltip, `text` is the pane's warning (with how many
// links are still waiting added). None of it quotes the agent's or API's own
// output, so a key can't end up here.
var PROBLEM_KINDS = {
  'logged-out': { short: 'logged out', title: function (who) { return who + ' is logged out. Log in again to keep analysing.'; }, text: function (who) { return who + ' logged out while analysing.'; } },
  'key-rejected': { short: 'key not working', title: function (who) { return 'The key for ' + who + ' isn’t working. Check it, or connect another AI.'; }, text: function (who) { return 'The key for ' + who + ' stopped working while analysing.'; } },
  'not-answering': { short: 'not answering', title: function (who) { return who + ' isn’t answering. Check it is running, then check again.'; }, text: function (who) { return who + ' stopped answering while analysing.'; } },
};

function waitingText(count) {
  if (!(count > 0)) return '';
  return ' ' + (count === 1 ? '1 link is' : count + ' links are') + ' still waiting.';
}

function buildProblem(kind, who, waiting) {
  var words = PROBLEM_KINDS[kind];
  return { kind: kind, short: words.short, title: words.title(who), text: words.text(who) + waitingText(waiting), at: new Date().toISOString() };
}

// Which connection-level failure a stopped drain amounts to, or null. One
// link failing to capture is not one: that leaves the connection alone.
function connectionFailure(config, outcome, text) {
  if (config.mode === 'agent') {
    var stopped = outcome && outcome.code !== undefined && outcome.code !== 0;
    return stopped && catalog.looksLoggedOut(config.agent.preset, text) ? 'logged-out' : null;
  }
  // Links that never reached the model (a duplicate, a site that wouldn't
  // load) say nothing about the connection. If any link that did reach it
  // went through, the connection works and the rest failed on their own.
  var reached = ((outcome && outcome.outcomes) || []).filter(function (o) { return o.kind !== 'duplicate' && o.kind !== 'fetch-failed'; });
  if (!reached.length || reached.some(function (o) { return o.kind !== 'error'; })) return null;
  var reasons = reached.map(function (o) { return String(o.reason || ''); });
  if (reasons.some(function (r) { return /\bHTTP (401|403)\b|key was not accepted/i.test(r); })) return 'key-rejected';
  if (reasons.some(function (r) { return /could not reach/i.test(r); })) return 'not-answering';
  return null;
}

// A drain, and afterwards a record of why it stopped when the connection
// itself was the reason, kept on the connection for the header and window.
async function runDrainRecording(config, options, storage) {
  var tail = [];
  var wrapped = Object.assign({}, options, {
    log: function (line) {
      tail.push(line);
      if (tail.length > 40) tail.shift();
      options.log(line);
    },
  });
  var outcome = await runDrain(config, wrapped);
  var aborted = options.signal && options.signal.aborted;
  var kind = aborted ? null : connectionFailure(config, outcome, tail.join('\n'));
  if (kind) {
    var saved = configModule.loadConfig(storage);
    if (saved.connection) {
      var waiting = typeof options.remaining === 'function' ? options.remaining() : 0;
      saved.connection.problem = buildProblem(kind, configModule.connectionLabel(saved), waiting);
      if (kind === 'logged-out' && saved.mode === 'agent') saved = configModule.recordLogin(saved, saved.agent.preset, 'loggedOut');
      configModule.saveConfig(saved, storage);
    }
  }
  return outcome;
}

// The helper's AI layer. `storage` ({ file, store }) says where the config and
// its keys live; the tests point it at a temp directory. The default layer,
// exported below, uses .drain.config.json and the OS secret store.
function create(storage) {
  return {
    loadConfig: function () { return configModule.loadConfig(storage); },
    testConnection: testConnection,
    runDrain: function (config, options) { return runDrainRecording(config, options, storage); },
    detect: function (options) { return detect(options, storage); },
    models: function (update) { return models(update, storage); },
    connect: function (update) { return connect(update, storage); },
    disconnect: function () { return disconnect(storage); },
    runTerminalAction: runTerminalAction,
    refreshPath: refreshPath,
    extractAgentModel: extractAgentModel,
    parseModelList: parseModelList,
  };
}

module.exports = create();
module.exports.create = create;
