// Agent mode: hand the whole drain to an agent CLI the collector already
// uses, exactly as the nightly job does. The agent reads prompts/drain.md
// and runs the scripts itself. See SECURITY.md.

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.resolve(__dirname, '../..');

// Splits a command string into argv the way a shell would for plain words
// and quoted strings — no expansion, no pipes. A preset is a program plus
// flags, never a shell script, so nothing here needs a shell.
function splitCommand(command) {
  var args = [];
  var current = '';
  var quote = null;
  var pending = false;
  for (var i = 0; i < command.length; i++) {
    var ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < command.length) current += command[++i];
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      pending = true;
    } else if (/\s/.test(ch)) {
      if (pending) args.push(current);
      current = '';
      pending = false;
    } else if (ch === '\\' && i + 1 < command.length) {
      current += command[++i];
      pending = true;
    } else {
      current += ch;
      pending = true;
    }
  }
  if (quote) throw new Error('unterminated quote in command');
  if (pending) args.push(current);
  return args;
}

function buildPrompt(url) {
  var prompt = fs.readFileSync(path.join(ROOT, 'prompts/drain.md'), 'utf8');
  return prompt.replace('URL (optional):', 'URL (optional): ' + (url || '(none — drain the whole inbox)')) +
    '\n\nYou were started from the Pool app, not a terminal: nobody can answer questions ' +
    'mid-run, so follow the procedure without pausing for confirmation.';
}

// Runs the agent with a prompt as its final argument, streaming its output
// line by line. Resolves with the exit code. Stopping kills the agent's
// whole process group, since agents spawn their own children.
function runAgent(command, prompt, options) {
  var argv = splitCommand(command);
  if (!argv.length) return Promise.reject(new Error('no agent command configured'));
  return new Promise(function (resolve, reject) {
    var child;
    try {
      child = childProcess.spawn(argv[0], argv.slice(1).concat([prompt]), {
        cwd: ROOT,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return reject(e);
    }
    var forward = function (stream) {
      var buffer = '';
      stream.on('data', function (d) {
        buffer += d;
        var lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(function (l) { options.log(l); });
      });
      stream.on('end', function () { if (buffer) options.log(buffer); });
    };
    forward(child.stdout);
    forward(child.stderr);
    var timer = options.timeoutMs ? setTimeout(function () { stop(); }, options.timeoutMs) : null;
    var stop = function () {
      try {
        if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch (e) { /* already gone */ }
    };
    if (options.signal) options.signal.addEventListener('abort', stop, { once: true });
    child.on('error', function (e) {
      if (timer) clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error('"' + argv[0] + '" was not found on PATH — is it installed, and was the helper started from a shell that can see it?') : e);
    });
    child.on('close', function (code) {
      if (timer) clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', stop);
      resolve(code);
    });
  });
}

async function runAgentDrain(options) {
  options.log('Starting: ' + options.command);
  var code = await runAgent(options.command, buildPrompt(options.url), options);
  if (options.signal && options.signal.aborted) {
    options.log('Stopped. Anything the agent had not committed is still in the inbox.');
  } else {
    options.log(code === 0 ? 'Agent finished.' : 'Agent exited with code ' + code + '.');
  }
  return { code: code };
}

module.exports = {
  splitCommand: splitCommand,
  buildPrompt: buildPrompt,
  runAgent: runAgent,
  runAgentDrain: runAgentDrain,
};
