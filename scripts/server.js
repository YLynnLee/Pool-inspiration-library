#!/usr/bin/env node
// The local helper: serves the app on localhost and gives its Drain panel a
// small API to choose an AI, test it, and run a drain with live progress.
// See SECURITY.md.
//
//   npm start                 (= node scripts/server.js --open)
//   node scripts/server.js [--port 4747] [--open]
//
// Listens on 127.0.0.1 only. Because the API can launch an agent with write
// access to this folder, every API request must carry this server's own
// Host (defeats DNS rebinding) and every POST its own Origin (defeats a
// page on another site posting here), plus a JSON content type.

var fs = require('fs');
var http = require('http');
var path = require('path');
var childProcess = require('child_process');
var configModule = require('./ai/config.js');
var ai = require('./ai/index.js');
var lib = require('./drain-lib.js');
var catalog = require('./ai/catalog.js');
var curation = require('../js/curation.js');

var ROOT = path.resolve(__dirname, '..');
var STATIC_PREFIXES = ['css/', 'js/', 'data/', 'images/', 'fonts/'];
var MAX_LOG_LINES = 3000;
var TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
};

function parseArgs(argv) {
  var opts = { port: Number(process.env.PORT) || 4747, open: false };
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opts.port = Number(argv[++i]);
    else if (argv[i] === '--open') opts.open = true;
  }
  return opts;
}

var opts = parseArgs(process.argv.slice(2));
var ALLOWED_HOSTS = ['127.0.0.1:' + opts.port, 'localhost:' + opts.port];

// ---- drain job (one at a time) --------------------------------------------

var job = null;

function jobSummary() {
  if (!job) return null;
  return { id: job.id, running: job.running, startedAt: job.startedAt, finishedAt: job.finishedAt, ok: job.ok, lines: job.lines.length };
}

function broadcast(event, data) {
  var frame = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
  job.clients.forEach(function (res) { res.write(frame); });
}

function startJob(config, url) {
  job = { id: Date.now().toString(36), running: true, startedAt: new Date().toISOString(), lines: [], clients: new Set(), controller: new AbortController() };
  var current = job;
  var log = function (line) {
    current.lines.push(line);
    if (current.lines.length > MAX_LOG_LINES) current.lines.shift();
    broadcast('line', line);
  };
  ai.runDrain(config, { url: url || undefined, log: log, signal: current.controller.signal })
    .then(function (outcome) {
      current.ok = outcome.code === undefined || outcome.code === 0;
    }, function (err) {
      log('Error: ' + err.message);
      current.ok = false;
    })
    .then(function () {
      current.running = false;
      current.finishedAt = new Date().toISOString();
      broadcast('end', { ok: current.ok });
      current.clients.forEach(function (res) { res.end(); });
      current.clients.clear();
    });
}

// ---- helpers ----------------------------------------------------------------

function inboxStatus() {
  var text = fs.existsSync(path.join(ROOT, 'inbox.md')) ? fs.readFileSync(path.join(ROOT, 'inbox.md'), 'utf8') : '';
  delete require.cache[require.resolve('../data/library.js')];
  var listed = lib.listInbox(text, require('../data/library.js').LIBRARY);
  return {
    captures: listed.captures.length,
    duplicates: listed.captures.filter(function (c) { return c.duplicate; }).length,
    malformed: listed.malformed.length,
    urls: listed.captures.map(function (c) { return c.url; }),
    items: listed.captures.map(function (c) {
      return { url: c.url, note: c.note, line: c.line, duplicate: c.duplicate };
    }),
  };
}

function status() {
  var config = configModule.loadConfig();
  return {
    helper: true,
    config: configModule.publicConfig(config),
    problems: configModule.configProblems(config),
    keyStore: configModule.keyStoreLabel(),
    presets: {
      agents: configModule.AGENT_PRESETS,
      providers: configModule.API_PROVIDERS.map(function (p) {
        return { id: p.id, label: p.label, baseUrl: p.baseUrl, model: p.model, needsKey: p.needsKey, keyEnv: p.keyEnv };
      }),
    },
    catalog: catalog.publicCatalog(),
    inbox: inboxStatus(),
    job: jobSummary(),
  };
}

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > (limit || 1e6)) req.destroy(new Error('body too large'));
      else chunks.push(c);
    });
    req.on('end', function () {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(new Error('body is not JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ---- the app's own saves ------------------------------------------------------
// Served from here, the page is a different site (origin) from the
// index.html file, so the folder it was granted there doesn't apply. It
// saves through these instead — the helper already knows the folder. Only
// the files the app writes itself (CONTRIBUTING.md).

var WRITABLE = ['data/library.js', 'data/design-systems.js'];

function writeAtomic(rel, text) {
  var file = path.join(ROOT, rel);
  var tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function deleteImages(paths) {
  var failed = [];
  (Array.isArray(paths) ? paths : []).forEach(function (rel) {
    var file = path.resolve(ROOT, String(rel));
    if (!/^images\/[^/]+$/.test(String(rel)) || file.indexOf(path.join(ROOT, 'images') + path.sep) !== 0) {
      failed.push(rel);
      return;
    }
    try {
      fs.unlinkSync(file);
    } catch (e) {
      if (e.code !== 'ENOENT') failed.push(rel);
    }
  });
  return failed;
}

async function handleFiles(req, res, pathname) {
  var body = await readBody(req, 20e6);
  if (pathname === '/api/files/inbox') {
    if (typeof body.url !== 'string' || !body.url.trim()) return send(res, 400, { error: 'A URL is required.' });
    var inboxFile = path.join(ROOT, 'inbox.md');
    var existing = fs.existsSync(inboxFile) ? fs.readFileSync(inboxFile, 'utf8') : '';
    writeAtomic('inbox.md', curation.appendCaptureLine(existing, body.url, typeof body.note === 'string' ? body.note : ''));
    return send(res, 200, { ok: true });
  }
  if (pathname === '/api/files/inbox-remove') {
    if (typeof body.line !== 'string' || !body.line.trim()) return send(res, 400, { error: 'Which capture? A line is required.' });
    if (job && job.running) return send(res, 409, { error: 'Wait for the drain to finish before removing captures.' });
    var inboxPath = path.join(ROOT, 'inbox.md');
    var current = fs.existsSync(inboxPath) ? fs.readFileSync(inboxPath, 'utf8') : '';
    var next = curation.removeCaptureLine(current, body.line);
    if (next === current) return send(res, 410, { error: 'That capture is no longer in the inbox.' });
    writeAtomic('inbox.md', next);
    return send(res, 200, { ok: true });
  }
  if (pathname === '/api/files/write') {
    if (WRITABLE.indexOf(body.file) === -1 || typeof body.text !== 'string') return send(res, 400, { error: 'The app can only write ' + WRITABLE.join(' and ') + '.' });
    writeAtomic(body.file, body.text);
    return send(res, 200, { ok: true });
  }
  if (pathname === '/api/files/delete-images') {
    return send(res, 200, { failed: deleteImages(body.paths) });
  }
  return send(res, 404, { error: 'no such endpoint' });
}

// ---- API --------------------------------------------------------------------

function guard(req) {
  if (ALLOWED_HOSTS.indexOf(req.headers.host) === -1) return 'bad host';
  if (req.method !== 'GET') {
    var origin = req.headers.origin;
    if (!origin || ALLOWED_HOSTS.indexOf(origin.replace(/^http:\/\//, '')) === -1 || origin.indexOf('http://') !== 0) return 'bad origin';
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return 'content-type must be application/json';
  }
  return null;
}

async function handleApi(req, res, pathname) {
  var refused = guard(req);
  if (refused) return send(res, 403, { error: refused });

  if (req.method === 'GET' && pathname === '/api/status') return send(res, 200, status());

  if (req.method === 'POST' && pathname.indexOf('/api/files/') === 0) return handleFiles(req, res, pathname);

  if (req.method === 'GET' && pathname === '/api/detect') {
    return send(res, 200, await ai.detect({ fresh: new URL(req.url, 'http://localhost').searchParams.get('fresh') === '1' }));
  }

  if (req.method === 'POST' && pathname === '/api/models') {
    try {
      return send(res, 200, await ai.models(await readBody(req)));
    } catch (e) {
      return send(res, 400, { error: e.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/connect') {
    var result = await ai.connect(await readBody(req));
    return send(res, 200, Object.assign(result, { status: status() }));
  }

  if (req.method === 'POST' && pathname === '/api/terminal') {
    return send(res, 200, await ai.runTerminalAction(await readBody(req)));
  }

  if (req.method === 'POST' && pathname === '/api/disconnect') {
    ai.disconnect();
    return send(res, 200, status());
  }

  if (req.method === 'POST' && pathname === '/api/drain') {
    if (job && job.running) return send(res, 409, { error: 'a drain is already running' });
    var body = await readBody(req);
    var config = configModule.loadConfig();
    if (!config.connection) return send(res, 400, { error: 'Connect an AI first.' });
    startJob(config, typeof body.url === 'string' ? body.url.trim() : '');
    return send(res, 202, { job: jobSummary() });
  }

  if (req.method === 'POST' && pathname === '/api/drain/stop') {
    if (job && job.running) job.controller.abort();
    return send(res, 200, { job: jobSummary() });
  }

  if (req.method === 'GET' && pathname === '/api/drain/events') {
    if (!job) return send(res, 404, { error: 'no drain has run yet' });
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    job.lines.forEach(function (line) { res.write('event: line\ndata: ' + JSON.stringify(line) + '\n\n'); });
    if (!job.running) {
      res.write('event: end\ndata: ' + JSON.stringify({ ok: job.ok }) + '\n\n');
      return res.end();
    }
    job.clients.add(res);
    var current = job;
    req.on('close', function () { current.clients.delete(res); });
    return;
  }

  send(res, 404, { error: 'no such endpoint' });
}

// ---- static -----------------------------------------------------------------

function serveStatic(req, res, pathname) {
  var rel;
  try {
    rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
  } catch (e) {
    res.writeHead(400);
    return res.end('bad request');
  }
  var allowed = rel === 'index.html' || STATIC_PREFIXES.some(function (p) { return rel.indexOf(p) === 0; });
  var file = path.resolve(ROOT, rel);
  if (!allowed || file.indexOf(ROOT + path.sep) !== 0 || rel.split('/').some(function (s) { return s.charAt(0) === '.'; })) {
    res.writeHead(404);
    return res.end('not found');
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  var pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.indexOf('/api/') === 0) {
    handleApi(req, res, pathname).catch(function (err) {
      if (!res.headersSent) send(res, 500, { error: err.message });
    });
  } else if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, pathname);
  } else {
    res.writeHead(405);
    res.end();
  }
});

var APP_URL = 'http://localhost:' + opts.port + '/';

function openApp() {
  var opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  childProcess.spawn(opener, [APP_URL], { stdio: 'ignore', detached: true }).unref();
}

ai.refreshPath();

server.listen(opts.port, '127.0.0.1', function () {
  console.log('Pool is running at ' + APP_URL);
  console.log('Click Connect AI in the app. Ctrl+C (or closing this window) stops it.');
  if (opts.open) openApp();
});

// A second double-click on the launcher finds the helper already running:
// just open the app instead of failing on the busy port.
server.on('error', function (err) {
  if (err.code !== 'EADDRINUSE') {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  http.get({ host: '127.0.0.1', port: opts.port, path: '/api/status', headers: { host: 'localhost:' + opts.port } }, function (res) {
    res.resume();
    if (res.statusCode === 200) {
      console.log('Pool is already running at ' + APP_URL);
      if (opts.open) openApp();
    } else {
      console.error('Port ' + opts.port + ' is used by another program — try `node scripts/server.js --port 4848`.');
      process.exitCode = 1;
    }
  }).on('error', function () {
    console.error('Port ' + opts.port + ' is used by another program — try `node scripts/server.js --port 4848`.');
    process.exitCode = 1;
  });
});
