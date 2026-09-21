#!/usr/bin/env node
// Runs a drain from the terminal with the AI chosen in the app's Drain panel
// (.drain.config.json) — the same code path the app's Drain button uses.
//
//   node scripts/drain-run.js           drain the whole inbox
//   node scripts/drain-run.js <url>     drain one line
//   node scripts/drain-run.js --test    check the configured AI can be reached

var configModule = require('./ai/config.js');
var ai = require('./ai/index.js');

async function main(argv) {
  var config = configModule.loadConfig();
  if (argv[0] === '--test') {
    var result = await ai.testConnection(config);
    console.log((result.ok ? 'ok: ' : 'failed: ') + result.message);
    return result.ok ? 0 : 1;
  }
  var controller = new AbortController();
  process.on('SIGINT', function () { controller.abort(); });
  var outcome = await ai.runDrain(config, {
    url: argv[0],
    log: function (line) { console.log(line); },
    signal: controller.signal,
  });
  return outcome.code === undefined ? 0 : outcome.code;
}

main(process.argv.slice(2)).then(function (code) {
  process.exitCode = code;
}, function (err) {
  console.error(err.message);
  process.exitCode = 1;
});
