// Opens a visible Terminal window running one catalog command (an install,
// a login, a model download), with a line of guidance above it. Logins in
// particular have to be interactive — the tools open a browser sign-in and
// ask questions — so they run where the collector can see and answer them.
// Only ever called with commands from catalog.js's terminalAction.

var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

var ROOT = path.resolve(__dirname, '../..');

function shQuote(text) {
  return "'" + String(text).replace(/'/g, "'\\''") + "'";
}

function cmdEcho(text) {
  return 'echo ' + String(text).replace(/([&|<>^%])/g, '^$1');
}

// The script body for macOS/Linux: borrow the user's own shell PATH (the
// window may not start with it), show the guidance, run the command, and
// leave the window open so any error stays readable.
function unixScript(action) {
  return [
    '#!/bin/sh',
    'cd ' + shQuote(ROOT),
    'if [ -n "${SHELL:-}" ]; then P=$("$SHELL" -ilc \'printf %s "$PATH"\' 2>/dev/null) && [ -n "$P" ] && PATH="$P:$PATH"; fi',
    'PATH="$PATH:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin"; export PATH',
    'clear',
    'printf "%s\\n\\n%s\\n\\n" ' + shQuote('Pool — ' + action.title) + ' ' + shQuote(action.steps),
    action.command,
    'printf "\\n%s\\n" ' + shQuote('Finished. You can close this window and go back to the library.'),
  ].join('\n') + '\n';
}

function winScript(action) {
  return [
    '@echo off',
    'cd /d "' + ROOT + '"',
    cmdEcho('Pool - ' + action.title),
    'echo.',
    cmdEcho(action.steps),
    'echo.',
    action.command,
    'echo.',
    cmdEcho('Finished. You can close this window and go back to the library.'),
    'pause',
  ].join('\r\n') + '\r\n';
}

function spawnDetached(bin, args, extra) {
  return new Promise(function (resolve, reject) {
    var child = childProcess.spawn(bin, args, Object.assign({ detached: true, stdio: 'ignore' }, extra));
    child.on('error', reject);
    child.on('spawn', function () {
      child.unref();
      resolve();
    });
  });
}

async function openTerminal(action) {
  var stamp = Date.now().toString(36);
  if (process.platform === 'win32') {
    var cmdFile = path.join(os.tmpdir(), 'pool-' + stamp + '.cmd');
    fs.writeFileSync(cmdFile, winScript(action));
    // start's first quoted argument is the window title; verbatim keeps
    // Node from re-quoting it.
    await spawnDetached('cmd.exe', ['/c', 'start "" "' + cmdFile + '"'], { windowsVerbatimArguments: true });
    return;
  }
  var file = path.join(os.tmpdir(), 'pool-' + stamp + (process.platform === 'darwin' ? '.command' : '.sh'));
  fs.writeFileSync(file, unixScript(action), { mode: 0o755 });
  if (process.platform === 'darwin') {
    await spawnDetached('open', ['-a', 'Terminal', file]);
    return;
  }
  var terminals = [
    ['x-terminal-emulator', ['-e', 'sh', file]],
    ['gnome-terminal', ['--', 'sh', file]],
    ['konsole', ['-e', 'sh', file]],
    ['xterm', ['-e', 'sh', file]],
  ];
  for (var i = 0; i < terminals.length; i++) {
    try {
      await spawnDetached(terminals[i][0], terminals[i][1]);
      return;
    } catch (e) { /* try the next terminal */ }
  }
  throw new Error('no terminal app found — run this yourself: ' + action.command);
}

module.exports = { openTerminal: openTerminal, unixScript: unixScript, winScript: winScript };
