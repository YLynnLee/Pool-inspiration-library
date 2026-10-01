// Where each link in the Add drawer stands, derived from what the helper
// reports. Pure: no DOM, no fetch — see CONTRIBUTING.md. Loadable as a classic
// browser <script> (window.LinkStatus) and via Node's require() through the
// CommonJS footer, same convention as js/curation.js.
//
// input
//   inbox    the helper's inbox ({ items: [{ url, note }] }), or null when the
//            page isn't served by the helper and can't read it
//   known    links the page has seen this session ([{ url, note }]) — a link
//            leaves the inbox once it is analysed, so this is how an Added
//            link stays in the list
//   library  the library's references ([{ id, name, sourceUrl }])
//   drain    the helper's drain state: running, currentUrl, step, total,
//            lines, finished, ok, error
//   retried  URLs the collector has sent back to Waiting
// output
//   links    [{ url, host, note, status, reference?, reason?, fix? }]
//   header   { kind: 'idle' | 'running' | 'finished', waiting, step, total, added, failed }

(function (root) {
  var FAILED_NOTE = /^fetch failed:\s*/i;

  // Failure output -> a plain reason and the next thing to try. The first
  // match wins, so the specific causes come before the broad ones.
  var FAILURES = [
    {
      test: /lost contact with the library helper|helper.*(unreachable|not running)|ECONNREFUSED.*(4747|helper)/i,
      reason: 'Pool’s helper stopped responding',
      fix: 'Check its window is still open, then Retry.',
    },
    {
      test: /no ai connected|not connected|disconnected|unauthori[sz]ed|invalid api key/i,
      reason: 'The AI isn’t connected',
      fix: 'Connect it again from Connect AI in the header, then Retry.',
    },
    {
      test: /timeout|timed out|exceeded/i,
      reason: 'The site took too long to load',
      fix: 'Retry — a second try is often quicker. If it keeps failing, remove it and capture it by hand.',
    },
    {
      test: /\b40[13]\b|blocked|forbidden|ERR_BLOCKED|captcha|access denied/i,
      reason: 'The site blocked the screenshot',
      fix: 'Retry — it often works on a second try. If it keeps failing, remove it and capture it by hand.',
    },
    {
      test: /no usable frame|screenshot|frames?\b.*(failed|none)|fetch failed/i,
      reason: 'No usable screenshot came back',
      fix: 'Retry. If it keeps failing, remove it and capture it by hand.',
    },
  ];

  function explainFailure(text) {
    var raw = String(text || '');
    for (var i = 0; i < FAILURES.length; i++) {
      if (FAILURES[i].test.test(raw)) return { reason: FAILURES[i].reason, fix: FAILURES[i].fix };
    }
    return { reason: 'Something went wrong while analysing this link', fix: 'Retry. If it keeps failing, open the full log for details.' };
  }

  function key(url) {
    return String(url || '').replace(/\/+$/, '');
  }

  function hostOf(url) {
    try {
      return new URL(url).host.replace(/^www\./, '');
    } catch (e) {
      return String(url || '');
    }
  }

  // "nice type; fetch failed: HTTP 403" -> the collector's own note, and the failure.
  function splitNote(note) {
    var own = [];
    var failure = '';
    String(note || '').split(/;\s*/).forEach(function (part) {
      if (FAILED_NOTE.test(part)) failure = part.replace(FAILED_NOTE, '');
      else if (part.trim()) own.push(part.trim());
    });
    return { note: own.join('; '), failure: failure };
  }

  // The drain logs "[2/5] <url>" before each link, then indented lines about it.
  // Returns url key -> the failure text its lines contain, if any.
  var LOG_FAILURE = /fetch failed|^\s*error:|gave up|no usable frame/i;
  function failuresFromLog(lines) {
    var found = {};
    var current = null;
    (lines || []).forEach(function (line) {
      var m = /^\[\d+\/\d+\] (.+)$/.exec(line);
      if (m) {
        current = key(m[1]);
        return;
      }
      if (current && LOG_FAILURE.test(line) && !found[current]) found[current] = String(line).trim();
    });
    return found;
  }

  function derive(input) {
    var inbox = input.inbox;
    var known = input.known || [];
    var library = input.library || [];
    var drain = input.drain || {};
    var retried = (input.retried || []).map(key);

    var libraryByUrl = {};
    library.forEach(function (e) {
      libraryByUrl[key(e.sourceUrl)] = e;
    });
    var logFailures = failuresFromLog(drain.lines);
    var currentKey = key(drain.currentUrl);

    var waitingItems = inbox ? inbox.items || [] : [];
    var inInbox = {};
    waitingItems.forEach(function (it) {
      inInbox[key(it.url)] = it;
    });

    var links = [];
    function push(url, note, status, extra) {
      var link = { url: url, host: hostOf(url), note: note, status: status };
      Object.keys(extra || {}).forEach(function (k) { link[k] = extra[k]; });
      links.push(link);
    }

    // Links no longer in the inbox come first: analysed (or struck as a duplicate).
    if (inbox) {
      known.forEach(function (k) {
        var id = key(k.url);
        if (inInbox[id]) return;
        if (drain.running && id === currentKey) {
          push(k.url, splitNote(k.note).note, 'analysing');
        } else if (libraryByUrl[id]) {
          var ref = libraryByUrl[id];
          push(k.url, splitNote(k.note).note, 'added', { reference: { id: ref.id, name: ref.name } });
        } else if (drain.running || drain.finished) {
          // Analysed this run, but the page hasn't loaded the new library yet.
          push(k.url, splitNote(k.note).note, 'added', { reference: null });
        }
      });
    }

    var rows = inbox ? waitingItems : known;
    rows.forEach(function (it) {
      var id = key(it.url);
      var parts = splitNote(it.note);
      if (!inbox) return push(it.url, parts.note, 'waiting');
      if (drain.running && id === currentKey) return push(it.url, parts.note, 'analysing');
      var isRetried = retried.indexOf(id) !== -1;
      var failure = isRetried ? '' : parts.failure || logFailures[id] || (!drain.running && drain.error && id === currentKey ? drain.error : '');
      if (failure) {
        var why = explainFailure(failure);
        return push(it.url, parts.note, 'failed', { reason: why.reason, fix: why.fix });
      }
      push(it.url, parts.note, 'waiting');
    });

    var count = function (s) { return links.filter(function (l) { return l.status === s; }).length; };
    var finished = !!(drain.finished || (!drain.running && drain.error));
    return {
      links: links,
      header: {
        kind: drain.running ? 'running' : finished ? 'finished' : 'idle',
        waiting: count('waiting'),
        step: drain.running || finished ? drain.step || 0 : 0,
        total: drain.running || finished ? drain.total || 0 : 0,
        added: count('added'),
        failed: count('failed'),
      },
    };
  }

  var api = { derive: derive, explainFailure: explainFailure, key: key, hostOf: hostOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LinkStatus = api;
})(typeof window !== 'undefined' ? window : this);
