// Where API keys live: the operating system's own secret store, never the
// library folder. The folder is often synced (iCloud Desktop, Dropbox) or
// zipped and shared, and .drain.config.json sits in it — so that file only
// records *that* a key is saved, and the key itself goes here.
//
//   macOS    — the login Keychain, via /usr/bin/security.
//   Windows  — a file encrypted with DPAPI for the current Windows user
//              (the same protection Credential Manager uses), in %APPDATA%.
//   Linux    — the Secret Service (GNOME Keyring, KWallet) via secret-tool.
//   anything else, or when those fail — a 0600 file in the user's config
//              directory, still outside the library folder.
//
// Keys are always passed to those tools on stdin, never as a command-line
// argument, which any other process on the machine can read from `ps`.

var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');

var SERVICE = 'Inspiration Library';

// Account names are provider ids; anything else is refused before it gets
// near a shell or a file name.
function checkAccount(account) {
  if (!/^[a-z0-9-]{1,40}$/.test(String(account))) throw new Error('bad secret name: ' + account);
  return account;
}

function run(cmd, args, input) {
  var result = childProcess.spawnSync(cmd, args, { input: input || '', encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.error) throw result.error;
  return result;
}

// ---- macOS Keychain ---------------------------------------------------------------

// `security -i` reads commands from stdin, so the key never appears in argv.
// It splits on whitespace and honours double quotes, so a key is only
// accepted if it has neither — every provider's keys are plain tokens.
function keychainBackend() {
  return {
    name: 'keychain',
    label: 'your Mac’s Keychain',
    get: function (account) {
      var r = run('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', checkAccount(account), '-w']);
      return r.status === 0 ? r.stdout.replace(/\n$/, '') : '';
    },
    set: function (account, key) {
      if (/[\s"'\\]/.test(key)) throw new Error('That key contains spaces or quotes — check it was pasted correctly.');
      var r = run('/usr/bin/security', ['-i'], 'add-generic-password -U -s "' + SERVICE + '" -a ' + checkAccount(account) + ' -l "' + SERVICE + ' — ' + account + ' API key" -w "' + key + '"\n');
      if (r.status !== 0 || /error/i.test(r.stderr || '')) throw new Error('Could not save the key to the Keychain.');
    },
    remove: function (account) {
      run('/usr/bin/security', ['delete-generic-password', '-s', SERVICE, '-a', checkAccount(account)]);
    },
  };
}

// ---- Windows DPAPI --------------------------------------------------------------

function dpapiBackend(dir) {
  var ps = ['-NoProfile', '-NonInteractive', '-Command'];
  function file(account) {
    return path.join(dir, checkAccount(account) + '.dpapi');
  }
  return {
    name: 'dpapi',
    label: 'Windows’ encrypted store for your user',
    get: function (account) {
      var f = file(account);
      if (!fs.existsSync(f)) return '';
      var r = run('powershell.exe', ps.concat([
        '$e=[Console]::In.ReadToEnd().Trim(); $s=ConvertTo-SecureString $e; ' +
          '[Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))',
      ]), fs.readFileSync(f, 'utf8'));
      return r.status === 0 ? r.stdout.replace(/\r?\n$/, '') : '';
    },
    set: function (account, key) {
      var r = run('powershell.exe', ps.concat([
        '$k=[Console]::In.ReadToEnd(); ConvertTo-SecureString $k -AsPlainText -Force | ConvertFrom-SecureString',
      ]), key);
      if (r.status !== 0 || !r.stdout.trim()) throw new Error('Could not encrypt the key.');
      writePrivate(file(account), r.stdout.trim() + '\n');
    },
    remove: function (account) {
      try { fs.unlinkSync(file(account)); } catch (e) { /* already gone */ }
    },
  };
}

// ---- Linux Secret Service ----------------------------------------------------------

function secretToolBackend() {
  var attrs = function (account) { return ['service', SERVICE, 'account', checkAccount(account)]; };
  return {
    name: 'secret-service',
    label: 'your system keyring',
    get: function (account) {
      var r = run('secret-tool', ['lookup'].concat(attrs(account)));
      return r.status === 0 ? r.stdout.replace(/\n$/, '') : '';
    },
    set: function (account, key) {
      var r = run('secret-tool', ['store', '--label=' + SERVICE + ' — ' + account + ' API key'].concat(attrs(account)), key);
      if (r.status !== 0) throw new Error('Could not save the key to the keyring.');
    },
    remove: function (account) {
      run('secret-tool', ['clear'].concat(attrs(account)));
    },
  };
}

// ---- fallback: a private file outside the library folder -----------------------------

function writePrivate(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  var tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

function fileBackend(dir) {
  var file = path.join(dir, 'keys.json');
  function read() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
    } catch (e) {
      return {};
    }
  }
  return {
    name: 'file',
    label: 'a private file in ' + dir.replace(os.homedir(), '~'),
    get: function (account) {
      return read()[checkAccount(account)] || '';
    },
    set: function (account, key) {
      var all = read();
      all[checkAccount(account)] = key;
      writePrivate(file, JSON.stringify(all, null, 2) + '\n');
    },
    remove: function (account) {
      var all = read();
      if (!(checkAccount(account) in all)) return;
      delete all[account];
      writePrivate(file, JSON.stringify(all, null, 2) + '\n');
    },
  };
}

// ---- choosing one ------------------------------------------------------------------

function userConfigDir(platform, env) {
  if (platform === 'win32') return path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), SERVICE);
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', SERVICE);
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'inspiration-library');
}

function hasCommand(cmd) {
  try {
    return run(cmd, ['--version']).error === undefined;
  } catch (e) {
    return false;
  }
}

// options.backend forces one ('keychain' | 'dpapi' | 'secret-service' |
// 'file') — the tests use 'file' with a temp dir. INSPIRATION_SECRETS does
// the same from the environment.
function createStore(options) {
  options = options || {};
  var platform = options.platform || process.platform;
  var env = options.env || process.env;
  var dir = options.dir || userConfigDir(platform, env);
  var wanted = options.backend || env.INSPIRATION_SECRETS || '';

  var backend;
  if (wanted === 'file') backend = fileBackend(dir);
  else if (wanted === 'keychain' || (!wanted && platform === 'darwin' && fs.existsSync('/usr/bin/security'))) backend = keychainBackend();
  else if (wanted === 'dpapi' || (!wanted && platform === 'win32')) backend = dpapiBackend(path.join(dir, 'keys'));
  else if (wanted === 'secret-service' || (!wanted && platform === 'linux' && hasCommand('secret-tool'))) backend = secretToolBackend();
  else backend = fileBackend(dir);

  var fallback = backend.name === 'file' ? null : fileBackend(dir);
  var cache = {};

  // A secure store that fails to write (a locked keyring, no desktop
  // session) falls back to the private file rather than losing the key.
  var active = backend;
  return {
    get name() { return active.name; },
    get label() { return active.label; },
    get: function (account) {
      if (account in cache) return cache[account];
      var value = '';
      try {
        value = active.get(account);
      } catch (e) {
        value = '';
      }
      if (!value && fallback && active !== fallback) value = fallback.get(account);
      cache[account] = value;
      return value;
    },
    set: function (account, key) {
      if (cache[account] === key) return;
      try {
        active.set(account, key);
      } catch (e) {
        if (!fallback || /pasted correctly/.test(e.message)) throw e;
        active = fallback;
        active.set(account, key);
      }
      cache[account] = key;
    },
    remove: function (account) {
      [backend, fallback].forEach(function (b) {
        if (!b) return;
        try { b.remove(account); } catch (e) { /* nothing to remove */ }
      });
      cache[account] = '';
    },
  };
}

var shared = null;

function defaultStore() {
  if (!shared) shared = createStore();
  return shared;
}

module.exports = { createStore: createStore, defaultStore: defaultStore, SERVICE: SERVICE };
