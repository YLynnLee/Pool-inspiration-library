// A stand-in for scripts/ai/index.js: the same functions the helper server
// calls, answering from a script instead of the machine. Lives with the tests
// so nothing of it ships in the runtime path.
//
//   var fake = createFakeAi();
//   fake.script({ detect: { agents: [...] }, connect: { ok: false, message: 'Not logged in' } });
//
// `connect` may be a function (update) => result for per-call answers.
// Config is kept in memory: the real layer writes .drain.config.json, and a
// test must never touch the collector's real connection.

var configModule = require('../../scripts/ai/config.js');

var NOTHING_FOUND = { agents: [], local: [], envKeys: [] };

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeAi(initial) {
  var script = Object.assign({
    detect: NOTHING_FOUND,
    connect: { ok: true, message: 'Connected.' },
    models: { models: [], suggested: '' },
    delayMs: 0,
  }, initial || {});
  var config = clone(configModule.DEFAULT_CONFIG);
  var calls = [];

  function answer(name, value, arg) {
    calls.push({ name: name, arg: arg });
    var result = typeof value === 'function' ? value(arg) : value;
    var wait = script.delayMs ? new Promise(function (r) { setTimeout(r, script.delayMs); }) : Promise.resolve();
    return wait.then(function () { return result; });
  }

  return {
    calls: calls,
    // Change what the fake answers from here on.
    script: function (changes) { Object.assign(script, changes); },
    // Put the fake in a connected state without going through connect.
    setConnection: function (connection) { config.connection = connection ? clone(connection) : null; },

    // ---- the AI layer the server depends on ----
    loadConfig: function () { return clone(config); },
    detect: function (options) { return answer('detect', script.detect, options); },
    models: function (update) { return answer('models', script.models, update); },
    connect: function (update) {
      return answer('connect', script.connect, update).then(function (result) {
        if (result.ok) {
          config.connection = { label: result.label || (update && update.ai) || 'Fake AI', ai: (update && update.ai) || null, at: new Date().toISOString() };
        }
        return result;
      });
    },
    checkLogin: function (update) { return answer('checkLogin', script.checkLogin || { ok: false, loggedOut: true }, update); },
    disconnect: function () { calls.push({ name: 'disconnect' }); config.connection = null; },
    runTerminalAction: function (body) { return answer('runTerminalAction', { ok: true, message: 'A Terminal window opened.' }, body); },
    runDrain: function (_config, options) {
      calls.push({ name: 'runDrain' });
      options.log('fake drain');
      return Promise.resolve({ code: 0 });
    },
    refreshPath: function () { return Promise.resolve(); },
  };
}

module.exports = { createFakeAi: createFakeAi, NOTHING_FOUND: NOTHING_FOUND };
