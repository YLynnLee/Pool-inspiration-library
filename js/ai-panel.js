// Connect AI + Drain. Owns the connection and drain state and publishes it as
// window.LibraryAI for the header's AI button (here) and the Add drawer
// (inbox-panel.js), which is where draining is started and watched.
// Everything goes through the local helper (scripts/server.js); the page
// itself never calls a model — see SECURITY.md.
// Opened from file://, the Connect AI window explains how to start the helper.
(function () {
  'use strict';

  var HELPER_URL = 'http://localhost:4747/';
  var served = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  var cached = null;
  // The last config the helper reported, kept while it isn't answering so the
  // window and the header can say "still connected to …" about a stopped Pool.
  var lastConfig = null;
  // False until the first status request has come back, so a page that has
  // only just loaded isn't mistaken for a helper that isn't there.
  var statusSettled = !served;
  var el = window.UI.el;
  var icon = window.UI.icon;
  var listeners = [];

  function notify() {
    renderHeaders();
    listeners.forEach(function (fn) { fn(); });
  }

  function adopt(status) {
    cached = status;
    if (status) lastConfig = status.config;
  }

  // The helper stopped answering (its Terminal window was closed, the process
  // died, …) as opposed to answering with an error. Everything it reported is
  // stale; the window and the header move to "Pool stopped".
  function onHelperLost() {
    var wasUp = !!cached;
    cached = null;
    found = null;
    if (wasUp) {
      notify();
      syncWindow();
    }
  }

  function api(method, pathname, body) {
    return fetch(pathname, {
      method: method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json.error || 'HTTP ' + res.status);
        return json;
      });
    }, function () {
      // fetch() itself rejected: tagged so callers can stay quiet instead of
      // showing the browser's raw "Failed to fetch".
      var err = new Error('Lost contact with the library helper — is it still running?');
      err.helperDown = true;
      onHelperLost();
      throw err;
    });
  }

  function refreshStatus() {
    if (!served) return Promise.resolve(null);
    return api('GET', '/api/status').then(function (s) {
      adopt(s);
      statusSettled = true;
      if (s.job && s.job.running) followDrain();
      notify();
      syncWindow();
      return s;
    }, function () {
      cached = null;
      statusSettled = true;
      notify();
      syncWindow();
      return null;
    });
  }

  // ---- header: the Connect AI button ---------------------------------------------
  //
  // Three faces, each readable without the colour: off (dashed, a plus,
  // "Connect AI"), on (a dot, "AI · model") and Pool stopped (amber, an alert
  // icon, "Pool stopped"). Every face opens the Connect AI window.

  function aiLabel(config) {
    var described = window.LinkStatus.describeAi(config);
    if (!described) return '';
    return described.name + (described.model ? ' · ' + described.model : '');
  }

  function fillHeader(slot) {
    slot.textContent = '';
    var stopped = !cached && served && statusSettled && lastConfig && lastConfig.connection;
    var connection = cached && cached.config.connection;
    var face = stopped ? 'is-warn' : connection ? 'is-on' : 'is-off';
    var text = stopped ? 'Pool stopped' : connection ? aiLabel(cached.config) || connection.label : 'Connect AI';
    var lead = face === 'is-off' ? icon('plus', 'cp-pill-icon') : face === 'is-warn' ? icon('alert', 'cp-pill-icon') : el('span', { class: 'ai-dot', 'aria-hidden': 'true' });
    slot.appendChild(el('button', {
      class: 'btn btn-secondary cp-pill ' + face,
      type: 'button',
      'aria-haspopup': 'dialog',
      title: stopped ? 'Pool needs to be running to analyse' : connection ? 'Connected to ' + connection.label : null,
      onclick: function () { openConnect(); },
    }, [lead, el('span', { class: 'ai-label', text: text })]));
  }

  function renderHeaders() {
    Array.prototype.forEach.call(document.querySelectorAll('.ai-header'), fillHeader);
  }

  // Called by render.js each time it builds the header.
  window.buildAiHeader = function () {
    var slot = el('span', { class: 'ai-header' });
    fillHeader(slot);
    return slot;
  };

  // ---- changing the model -------------------------------------------------------
  //
  // Shared by the Connect AI window and the drawer's AI · model line. Saving
  // re-runs the connection test, so a model that can't answer never replaces
  // one that can: on failure nothing is saved and the previous model stays.

  var modelCheck = { checking: '' };

  // The models the connected AI can use: { models: [{ id, label }], free }.
  // Rejects when they can't be listed.
  function listModels() {
    var config = cached.config;
    return api('POST', '/api/models', { mode: config.mode }).then(function (r) {
      return { models: window.LinkStatus.modelOptions(r.models, ''), free: config.mode === 'agent' ? !!r.free : true };
    });
  }

  function setModel(model) {
    var config = cached.config;
    var update = { ai: config.connection.ai, mode: config.mode };
    if (config.mode === 'agent') update.agent = { model: model };
    else update.api = { model: model };
    modelCheck.checking = model;
    notify();
    return api('POST', '/api/connect', update).then(function (r) {
      adopt(r.status);
      if (!r.ok) throw new Error(r.message);
      return r;
    }).then(function (r) {
      modelCheck.checking = '';
      notify();
      return r;
    }, function (err) {
      modelCheck.checking = '';
      notify();
      throw err;
    });
  }

  function describeConnection() {
    var config = cached.config;
    if (config.mode === 'api' && config.api) return 'API · ' + (config.api.model || config.api.provider);
    return 'Agent app on this computer';
  }

  // ---- the Connect AI window ---------------------------------------------------------
  //
  // One window for the whole journey: the AIs on the left (grouped by what Pool
  // found, with one search box), the chosen AI on the right. Before Pool runs
  // there's nothing to choose yet, so the window is smaller, with one pane and
  // no list. It is in one of three phases, worked out each time it renders:
  //   helper  Pool isn't answering: how to start it
  //   scan    Pool answers, detection hasn't come back: a quiet list
  //   ready   the full list, search and pane

  var START_LINK = 'pool://start';
  var EMPTY_FOUND = { agents: [], local: [], envKeys: [] };
  var OTHER = { id: 'other', name: 'Something else', blurb: 'Any agent command, or an OpenAI-compatible server.' };

  var found = null; // what detection saw: { agents, local, envKeys }
  var scanning = false;
  var win = null; // { overlay, modal, list, pane, filter, phase, timer }
  var ui = { selected: null, query: '', method: {}, otherKind: 'agent' };
  var paneSeq = 0; // changes whenever the pane is rebuilt, so late callbacks can tell

  function helperUp() {
    // An opaque no-cors request still tells us whether anything answers.
    return fetch(HELPER_URL + 'api/status', { mode: 'no-cors', cache: 'no-store' }).then(function () { return true; }, function () { return false; });
  }

  function goToHelper() {
    window.location.href = HELPER_URL + '?connect=1';
  }

  function phase() {
    if (!served) return 'helper';
    if (!statusSettled) return 'scan';
    if (!cached) return 'helper';
    return found ? 'ready' : 'scan';
  }

  function detectNow(fresh) {
    return api('GET', '/api/detect' + (fresh ? '?fresh=1' : '')).then(function (d) {
      found = d;
      return d;
    });
  }

  function ensureScan() {
    if (found || scanning || !cached) return;
    scanning = true;
    detectNow().then(null, function () {
      // The guides still work without detection.
      if (cached) found = EMPTY_FOUND;
    }).then(function () {
      scanning = false;
      syncWindow();
    });
  }

  // ---- what Pool found, as a status per AI ----

  function agentInstalled(preset) {
    var a = found && found.agents.find(function (x) { return x.id === preset; });
    return !!(a && a.installed);
  }

  function localServer(provider) {
    return found && found.local.find(function (x) { return x.id === provider; });
  }

  function hasEnvKey(provider) {
    return !!(found && found.envKeys.indexOf(provider) !== -1);
  }

  function isConnectedTo(aiId, mode) {
    var connection = cached.config.connection;
    return !!(connection && connection.ai === aiId && (!mode || cached.config.mode === mode));
  }

  // { tone, text } — only ever news about what's here. null when nothing is.
  function statusOf(ai) {
    if (isConnectedTo(ai.id)) return { tone: 'on', text: 'Connected' };
    var kinds = { agent: null, local: null, key: null };
    ai.methods.forEach(function (m) {
      if (m.id === 'agent' && agentInstalled(m.preset)) kinds.agent = { tone: 'ready', text: 'Installed' };
      if (m.id === 'local') {
        var server = localServer(m.provider);
        if (server && server.running) kinds.local = { tone: 'ready', text: server.models.length ? 'Running' : 'Running · needs a model' };
      }
      if (m.id === 'key' && hasEnvKey(m.provider)) kinds.key = { tone: 'ready', text: 'Key found' };
    });
    return kinds.agent || kinds.local || kinds.key;
  }

  function rank(ai) {
    var st = statusOf(ai);
    return !st ? 3 : st.text === 'Installed' ? 0 : st.text === 'Key found' ? 2 : 1;
  }

  // ---- search: by the AI's name, the app it runs through, or its key's company ----

  function query() {
    return ui.query.trim().toLowerCase();
  }

  function providerLabel(id) {
    var p = cached && cached.presets.providers.find(function (x) { return x.id === id; });
    return p ? p.label : id;
  }

  function matchedVia(ai) {
    var q = query();
    if (!q || ai.name.toLowerCase().indexOf(q) >= 0) return '';
    var names = [];
    ai.methods.forEach(function (m) {
      if (m.app) names.push(m.app);
      if (m.provider) names.push(providerLabel(m.provider));
    });
    var hit = names.find(function (n) { return n.toLowerCase().indexOf(q) >= 0; });
    return hit ? 'via ' + hit : '';
  }

  function passesSearch(ai) {
    var q = query();
    return !q || ai.name.toLowerCase().indexOf(q) >= 0 || !!matchedVia(ai) || String(ai.blurb || '').toLowerCase().indexOf(q) >= 0;
  }

  // In use · On this computer · More AIs, in the order they're listed.
  function groups() {
    var inUse = [];
    var here = [];
    var more = [];
    cached.catalog.filter(passesSearch).forEach(function (ai) {
      if (isConnectedTo(ai.id)) inUse.push(ai);
      else if (statusOf(ai)) here.push(ai);
      else more.push(ai);
    });
    here.sort(function (a, b) { return rank(a) - rank(b); });
    return [
      { label: 'In use', items: inUse },
      { label: 'On this computer', items: here },
      { label: inUse.length || here.length ? 'More AIs' : 'AIs', items: more },
    ].filter(function (g) { return g.items.length; });
  }

  function shownIds() {
    var ids = [];
    groups().forEach(function (g) { g.items.forEach(function (ai) { ids.push(ai.id); }); });
    return ids;
  }

  // The AI the window opens on: the connected one, else the best found.
  function defaultSelection() {
    var connection = cached.config.connection;
    if (connection && cached.catalog.some(function (a) { return a.id === connection.ai; })) return connection.ai;
    var ids = shownIds();
    return ids.length ? ids[0] : 'other';
  }

  function findAi(id) {
    return cached.catalog.find(function (a) { return a.id === id; });
  }

  // ---- window shell ----

  function closeModal() {
    openingSeq++;
    if (!win) return;
    window.clearInterval(win.timer);
    win.overlay.remove();
    win = null;
    document.removeEventListener('keydown', onKey);
  }

  var openingSeq = 0;

  function openConnect(aiId) {
    closeModal();
    ui.selected = aiId || null;
    ui.query = '';
    // Whatever the page last heard, ask again first: the window opens on the
    // truth (Pool may have stopped since), not on a stale frame.
    var seq = ++openingSeq;
    if (served) refreshStatus().then(function () { if (seq === openingSeq) mountWindow(); });
    else mountWindow();
  }

  function mountWindow() {
    var modal = el('div', { class: 'add-modal ai-modal cp-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Connect AI' });
    var overlay = el('div', { class: 'add-modal-overlay cp-overlay' }, [modal]);
    overlay.addEventListener('click', function (evt) {
      if (evt.target === overlay) closeModal();
    });
    win = { overlay: overlay, modal: modal, list: null, pane: null, filter: null, phase: null, focused: false, timer: 0 };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    // While Pool isn't answering, keep asking: the window moves on by itself.
    win.timer = window.setInterval(function () {
      if (!win || win.phase !== 'helper') return;
      if (served) refreshStatus();
      else helperUp().then(function (up) { if (up && win) goToHelper(); });
    }, 1500);
    renderWindow();
  }

  // Re-renders the whole window only when its phase changed, so a refresh in
  // the background never wipes what's being typed.
  function syncWindow() {
    if (win && phase() !== win.phase) renderWindow();
  }

  function onKey(evt) {
    if (!win) return;
    if (evt.key === 'Escape') {
      evt.preventDefault();
      if (ui.query) {
        ui.query = '';
        if (win.filter) win.filter.querySelector('input').value = '';
        selectionFollowsSearch();
        renderList();
        renderPane();
        return;
      }
      return closeModal();
    }
    if ((evt.key === 'ArrowDown' || evt.key === 'ArrowUp') && win.phase === 'ready') {
      var t = evt.target;
      var inList = t === document.body || (t.closest && (t.closest('.cp-list') || t.classList.contains('cp-search')));
      if (!inList) return;
      evt.preventDefault();
      var ids = shownIds().concat(['other']);
      var i = ids.indexOf(ui.selected) + (evt.key === 'ArrowDown' ? 1 : -1);
      if (i < 0 || i >= ids.length) return;
      var fromSearch = t.classList && t.classList.contains('cp-search');
      choose(ids[i]);
      if (!fromSearch) {
        var row = win.list.querySelector('.cp-row.is-selected');
        if (row) row.focus();
      }
    }
  }

  function choose(id) {
    ui.selected = id;
    renderList();
    renderPane();
  }

  // A search that hides the open AI moves the pane to the first one left.
  function selectionFollowsSearch() {
    var ids = shownIds();
    if (ui.selected === null) ui.selected = defaultSelection();
    else if (ui.selected !== 'other' && ids.indexOf(ui.selected) < 0) ui.selected = ids.length ? ids[0] : 'other';
  }

  function renderWindow() {
    if (!win) return;
    var p = phase();
    win.phase = p;
    win.modal.textContent = '';
    win.modal.classList.toggle('is-single', p === 'helper');
    win.modal.appendChild(head(p));
    win.pane = el('div', { class: 'cp-pane' });
    win.filter = null;
    if (p === 'helper') {
      win.list = null;
      win.modal.appendChild(win.pane);
    } else {
      win.list = el('div', { class: 'cp-list' + (p === 'scan' ? ' is-waiting' : ''), role: 'listbox', 'aria-label': 'AIs', 'aria-disabled': String(p !== 'ready') });
      win.modal.appendChild(el('div', { class: 'cp-split' }, [win.list, win.pane]));
    }
    if (p === 'ready') {
      win.filter = searchBar();
      selectionFollowsSearch();
    }
    renderList();
    renderPane();
    if (p === 'scan') ensureScan();
    if (p === 'ready' && win.filter && !win.focused && window.matchMedia('(min-width: 721px)').matches) {
      win.focused = true;
      win.filter.querySelector('input').focus();
    }
  }

  // The title line says where you stand, not what the window is called.
  function head(p) {
    var connection = cached && cached.config.connection;
    var stopped = p === 'helper' && served && lastConfig && lastConfig.connection;
    var title = stopped ? 'Pool stopped running' : connection ? 'AI for analysing' : 'Connect an AI';
    var lede = stopped ? 'Still connected to ' + aiLabel(lastConfig) + '.'
      : p === 'helper' ? 'One thing first: Pool has to be running on this computer.'
      : p === 'scan' ? 'Looking at what’s already on this computer…'
      : connection ? 'Analysing with ' + (aiLabel(cached.config) || connection.label) + '.'
      : 'Pool uses an AI to write up each reference you capture. Pick one you already use.';
    return el('div', { class: 'cp-pane-head' }, [
      el('div', {}, [el('h2', { class: 'add-modal-title', text: title }), el('p', { class: 'ai-lede', text: lede })]),
      el('button', { class: 'cp-x', type: 'button', 'aria-label': 'Close', onclick: closeModal }, [icon('close')]),
    ]);
  }

  // ---- the list ----

  function monogram(ai, size) {
    return el('span', { class: 'cp-mark' + (size ? ' cp-mark-' + size : ''), 'aria-hidden': 'true', text: ai.name.charAt(0) });
  }

  function statusLine(st, cls) {
    return el('span', { class: cls + ' is-' + st.tone }, [el('span', { class: 'cp-status-dot', 'aria-hidden': 'true' }), st.text]);
  }

  function renderList() {
    if (!win || !win.list) return;
    var root = win.list;
    root.textContent = '';
    if (win.phase !== 'ready') {
      // While Pool looks, the list is there but quiet: catalogue order,
      // nothing to pick yet.
      var all = cached ? cached.catalog.concat([OTHER]) : [];
      all.forEach(function (ai, i) {
        root.appendChild(el('div', { class: 'cp-row', style: '--i:' + i }, [
          monogram(ai),
          el('span', { class: 'cp-row-name', text: ai.name }),
          ai !== OTHER ? el('span', { class: 'cp-row-status cp-row-looking', text: 'Looking…' }) : null,
        ]));
      });
      return;
    }
    root.appendChild(win.filter);
    var gs = groups();
    if (!gs.length) {
      root.appendChild(el('div', { class: 'cp-empty' }, [
        el('p', { text: 'Nothing called “' + ui.query.trim() + '”.' }),
        el('p', { class: 'cp-empty-hint', text: 'If it’s an agent that runs in a terminal, or a server that speaks the OpenAI format, add it under Something else.' }),
      ]));
    }
    gs.forEach(function (g) {
      root.appendChild(el('p', { class: 'cp-group', text: g.label }));
      g.items.forEach(function (ai) {
        var st = statusOf(ai);
        var via = matchedVia(ai);
        root.appendChild(row(ai, st ? statusLine(st, 'cp-row-status') : via ? el('span', { class: 'cp-row-status is-none', text: via }) : null));
      });
    });
    // "Something else" is pinned to the foot of the list, always in reach.
    root.appendChild(el('div', { class: 'cp-list-foot' }, [row(OTHER, null)]));
  }

  function row(ai, statusNode) {
    var on = ui.selected === ai.id;
    return el('button', {
      class: 'cp-row' + (on ? ' is-selected' : ''),
      type: 'button',
      role: 'option',
      'aria-selected': String(on),
      tabindex: on ? '0' : '-1',
      onclick: function () { choose(ai.id); },
    }, [monogram(ai), el('span', { class: 'cp-row-name', text: ai.name }), statusNode]);
  }

  // Enter opens the top match; Esc (handled for the window) clears the box
  // before it closes anything.
  function searchBar() {
    var input = el('input', {
      class: 'add-modal-input cp-search',
      type: 'search',
      role: 'searchbox',
      placeholder: window.matchMedia('(max-width: 720px)').matches ? 'Search' : 'Search AIs and apps',
      'aria-label': 'Search AIs and apps',
      value: ui.query,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    input.addEventListener('input', function () {
      ui.query = input.value;
      selectionFollowsSearch();
      renderList();
      renderPane();
    });
    input.addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        var ids = shownIds();
        if (ids.length) choose(ids[0]);
      }
    });
    return el('div', { class: 'cp-filter' }, [el('span', { class: 'cp-search-wrap' }, [icon('search', 'cp-search-icon'), input])]);
  }

  // ---- the pane ----

  function renderPane() {
    if (!win || !win.pane) return;
    paneSeq++;
    var pane = win.pane;
    pane.textContent = '';
    if (win.phase === 'helper') return helperPane(pane);
    if (win.phase === 'scan') return scanPane(pane);
    if (ui.selected === 'other') {
      pane.appendChild(el('div', { class: 'cp-ai-head' }, [
        monogram(OTHER, 'lg'),
        el('div', { class: 'cp-ai-head-text' }, [el('h3', { class: 'cp-pane-title', text: OTHER.name }), el('p', { class: 'ai-hint', text: OTHER.blurb })]),
      ]));
      return otherInto(pane);
    }
    var ai = findAi(ui.selected);
    var st = statusOf(ai);
    pane.appendChild(el('div', { class: 'cp-ai-head' }, [
      monogram(ai, 'lg'),
      el('div', { class: 'cp-ai-head-text' }, [el('h3', { class: 'cp-pane-title', text: ai.name }), el('p', { class: 'ai-hint', text: ai.blurb })]),
      st ? statusLine(st, 'cp-badge') : null,
    ]));
    guideInto(pane, ai);
  }

  function hint(text) {
    return el('p', { class: 'ai-hint', text: text });
  }

  // Pool isn't running. First start: the one by-hand step (the pool:// link
  // can't work until Start Pool has been double-clicked once). Stopped: one
  // button, and the connection is named so it doesn't feel like starting over.
  function helperPane(pane) {
    var status = el('div', { class: 'notice-slot' });
    var stopped = served && lastConfig && lastConfig.connection;
    if (stopped) {
      var start = el('button', { class: 'btn btn-primary', type: 'button', text: 'Start Pool' });
      start.addEventListener('click', function () {
        start.disabled = true;
        window.UI.setNotice(status, 'info', { title: 'Starting Pool…', text: 'A Terminal window opens. Leave it open while you work.' });
        window.location.href = START_LINK;
        window.setTimeout(function () { start.disabled = false; }, 8000);
      });
      pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Start Pool again' }));
      pane.appendChild(hint('Its Terminal window was closed. Nothing’s lost — ' + aiLabel(lastConfig) + ' is still your AI; Pool just needs to run to use it.'));
      pane.appendChild(el('div', { class: 'cp-helper-actions' }, [start]));
      pane.appendChild(status);
      pane.appendChild(hint('Browsing your library works without it. Only adding and analysing need Pool running.'));
      return;
    }
    function helperStep(n, title, text, extra) {
      return el('li', { class: 'ai-step' }, [
        el('span', { class: 'ai-step-mark', 'aria-hidden': 'true', text: String(n) }),
        el('div', { class: 'ai-step-body' }, [el('p', { class: 'ai-step-title', text: title }), hint(text), extra || null]),
      ]);
    }
    window.UI.setNotice(status, 'info', { title: 'Waiting for Pool to start…' });
    pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Start Pool once' }));
    pane.appendChild(hint('The very first time, by hand. After that, Connect AI can start it for you.'));
    pane.appendChild(el('ol', { class: 'ai-steps-list cp-steps' }, [
      helperStep(1, 'Open the Pool folder', 'The folder this library lives in — where this page’s file is.'),
      helperStep(2, 'Double-click “Start Pool”', '(“Start Pool.bat” on Windows.) A Terminal window opens and sets things up — about a minute the first time.'),
      helperStep(3, 'Leave that window open', 'This window notices on its own and carries on.', status),
    ]));
    pane.appendChild(el('p', { class: 'cp-start-link' }, [
      'Already did this once? ',
      el('a', { href: START_LINK, text: 'Start Pool for me' }),
      '.',
    ]));
  }

  function scanPane(pane) {
    var kinds = ['Agent apps', 'Models running on this computer', 'API keys already set up'];
    pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Looking around' }));
    pane.appendChild(hint('Pool checks what you already have, so you don’t have to know.'));
    pane.appendChild(el('ul', { class: 'cp-scan' }, kinds.map(function (t) {
      return el('li', { class: 'cp-scan-row' }, [el('span', { class: 'cp-scan-dot', 'aria-hidden': 'true' }), t]);
    })));
  }

  // ---- one AI's pane: its guide, or — once connected — the connection ----------------
  //
  // Each AI opens a guide shaped by how it connects: an agent app gets
  // install → log in → connect steps, an API key gets a "get a key" link and a
  // key field, a local model server gets download → model → connect. The guide
  // ticks off what the helper can already see is done.

  // A link that leaves Pool, marked with the external-link icon.
  function extLink(href, label) {
    return el('a', { class: 'ext-link', href: href, target: '_blank', rel: 'noopener' }, [label, icon('external')]);
  }

  // A numbered step: its title, whether it's already done, and its content.
  function step(number, title, done, children) {
    var li = el('li', { class: 'ai-step' }, [
      el('span', { class: 'ai-step-mark', 'aria-hidden': 'true', text: String(number) }),
      el('div', { class: 'ai-step-body' }, [el('p', { class: 'ai-step-title', text: title })].concat(children || [])),
    ]);
    if (done) markStepDone(li);
    return li;
  }

  // Ticks a step off in place — when a login window opens or a connection
  // passes, without re-rendering the guide.
  function markStepDone(li) {
    if (li.classList.contains('is-done')) return;
    li.classList.add('is-done');
    var mark = li.querySelector('.ai-step-mark');
    mark.textContent = '';
    mark.appendChild(icon('check'));
    li.querySelector('.ai-step-title').textContent += ' — done';
  }

  // AIs whose login window has been opened this session, so step 2 stays
  // ticked when the guide re-renders (e.g. after "Check again").
  var loginOpened = {};

  function statusSlot() {
    return el('div', { class: 'notice-slot' });
  }

  // Report into a statusSlot(): what happened, and (optionally) how to fix it.
  // No tone clears it.
  function setStatus(slot, tone, title, text) {
    window.UI.setNotice(slot, tone, { title: title, text: text });
  }

  function methodModeIs(method, mode) {
    return method.id === 'agent' ? mode === 'agent' : mode === 'api';
  }

  function guideInto(pane, ai) {
    var connection = cached.config.connection;
    var connectedHere = connection && connection.ai === ai.id;
    var method = ai.methods.find(function (m) { return m.id === ui.method[ai.id]; })
      || (connectedHere && ai.methods.find(function (m) { return methodModeIs(m, cached.config.mode); }))
      || ai.methods[0];
    if (ai.methods.length > 1) {
      pane.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'How to connect' }, ai.methods.map(function (m) {
        return el('button', {
          class: 'ai-segment-btn',
          type: 'button',
          'aria-pressed': String(m === method),
          text: m.id === 'key' ? 'Use an API key' : 'Use my ' + m.label,
          onclick: function () { ui.method[ai.id] = m.id; renderPane(); },
        });
      })));
    }
    if (connection && !connectedHere) {
      pane.appendChild(el('p', { class: 'ai-hint cp-replaces', text: 'Connecting this replaces ' + (aiLabel(cached.config) || connection.label) + '.' }));
    }
    if (connectedHere && methodModeIs(method, cached.config.mode)) return connectedInto(pane);

    var steps = method.id === 'agent' ? agentSteps(ai, method)
      : method.id === 'key' ? keySteps(ai, method)
      : localSteps(ai, method);
    pane.appendChild(el('ol', { class: 'ai-steps-list cp-steps' }, steps));
  }

  // Runs one connection test, ticking `doneStep` and moving on to the
  // connection when it passes.
  var busy = false;
  function connectWith(update, status, button, doneStep) {
    if (busy) return;
    busy = true;
    button.disabled = true;
    setStatus(status, 'info', update.mode === 'agent' ? 'Checking it answers…' : 'Checking it can see images…', update.mode === 'agent' ? 'This can take up to a minute.' : null);
    api('POST', '/api/connect', update).then(function (r) {
      adopt(r.status);
      notify();
      if (!r.ok) throw new Error(r.message);
      renderList();
      if (doneStep) {
        markStepDone(doneStep);
        setStatus(status, 'success', r.message);
        var shown = paneSeq;
        window.setTimeout(function () {
          if (shown === paneSeq) renderPane();
        }, 1200);
      } else {
        renderPane();
      }
    }).catch(function (err) {
      if (err.helperDown) return;
      setStatus(status, 'error', 'Couldn’t connect', err.message);
    }).then(function () {
      busy = false;
      button.disabled = false;
    });
  }

  function terminalButton(label, body, status, after) {
    var button = el('button', { class: 'btn btn-secondary', type: 'button', text: label });
    button.addEventListener('click', function () {
      button.disabled = true;
      api('POST', '/api/terminal', body).then(function (r) {
        setStatus(status, r.ok ? 'success' : 'error', r.ok ? r.message : 'That didn’t work', r.ok ? null : r.message);
        if (r.ok && after) after();
      }, function (err) {
        if (err.helperDown) return;
        setStatus(status, 'error', 'That didn’t work', err.message);
      }).then(function () { button.disabled = false; });
    });
    return button;
  }

  function checkAgainButton() {
    var button = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Check again' });
    button.addEventListener('click', function () {
      button.disabled = true;
      button.textContent = 'Checking…';
      var done = function () {
        renderList();
        renderPane();
      };
      detectNow(true).then(done, done);
    });
    return button;
  }

  function agentSteps(ai, m) {
    var installed = agentInstalled(m.preset);
    var installStatus = statusSlot();
    var loginStatus = statusSlot();
    var connectStatus = statusSlot();
    var connected = isConnectedTo(ai.id, 'agent');
    var loginStep, connectStep;
    var connectBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect' });
    connectBtn.addEventListener('click', function () {
      connectWith({ ai: ai.id, mode: 'agent', agent: { preset: m.preset } }, connectStatus, connectBtn, connectStep);
    });
    if (!installed) connectBtn.disabled = true;
    var loginBtn = terminalButton('Log in to ' + m.app, { ai: ai.id, action: 'login' }, loginStatus, function () {
      loginOpened[ai.id] = true;
      markStepDone(loginStep);
    });
    if (!installed) loginBtn.disabled = true;

    loginStep = step(2, 'Log in', installed && (connected || !!loginOpened[ai.id]), [
      hint('Needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1)),
      hint(m.login.steps),
      el('div', { class: 'ai-row' }, [loginBtn]),
      loginStatus,
      hint('Already logged in? Skip to step 3.'),
    ]);
    connectStep = step(3, 'Connect', installed && connected, [
      hint('The library checks ' + m.app + ' answers, then you can analyse.'),
      el('div', { class: 'ai-row' }, [connectBtn]),
      connectStatus,
    ]);

    return [
      step(1, 'Install ' + m.app, installed, installed ? [] : [
        hint(m.app + ' is the free app that lets the library use your ' + m.label.toLowerCase() + '.'),
        el('div', { class: 'ai-row' }, [
          terminalButton('Install ' + m.app, { ai: ai.id, action: 'install' }, installStatus),
          checkAgainButton(),
        ]),
        installStatus,
        el('p', { class: 'ai-hint' }, [
          document.createTextNode('Or run it yourself: '),
          el('code', { class: 'ai-code-inline', text: m.install }),
          document.createTextNode(' · '),
          extLink(m.docs, 'install guide'),
        ]),
      ]),
      loginStep,
      connectStep,
    ];
  }

  // Where a pasted key ends up, said plainly — see scripts/ai/secrets.js.
  function keyPromise() {
    return 'Kept in ' + (cached.keyStore || 'a private store on this computer') + ' — never in the library folder, never in the browser, and only ever sent to this provider over https.';
  }

  function keySteps(ai, m) {
    var provider = cached.presets.providers.find(function (p) { return p.id === m.provider; });
    var status = statusSlot();
    var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', autocomplete: 'off', 'aria-label': 'API key', placeholder: hasEnvKey(m.provider) ? 'Found $' + provider.keyEnv + ' — leave empty to use it' : 'Paste your API key' });
    var next = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Continue' });
    var chooser = el('div', { class: 'ai-row', hidden: 'hidden' });
    var connectStep;
    next.addEventListener('click', function () {
      next.disabled = true;
      setStatus(status, 'info', 'Checking the key…');
      api('POST', '/api/models', { mode: 'api', api: { provider: m.provider, apiKey: key.value } }).then(function (r) {
        setStatus(status, null);
        if (!r.models.length) throw new Error('No models were listed for this key.');
        chooser.textContent = '';
        var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, r.models.map(function (id) {
          return el('option', { value: id, text: id });
        }));
        select.value = r.suggested || r.models[0];
        var connectBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect' });
        connectBtn.addEventListener('click', function () {
          connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, apiKey: key.value, model: select.value } }, status, connectBtn, connectStep);
        });
        chooser.appendChild(select);
        chooser.appendChild(connectBtn);
        chooser.hidden = false;
      }).catch(function (err) {
        if (err.helperDown) return;
        setStatus(status, 'error', 'Couldn’t check the key', err.message);
      }).then(function () { next.disabled = false; });
    });
    return [
      step(1, 'Get an API key', hasEnvKey(m.provider), [
        el('p', { class: 'ai-hint' }, [
          document.createTextNode('Create one in your ' + provider.label.replace(/ \(.*\)$/, '') + ' account. '),
          extLink(m.keyUrl, 'Get a key'),
        ]),
      ]),
      connectStep = step(2, 'Paste it and pick a model', isConnectedTo(ai.id, 'api'), [
        el('div', { class: 'ai-row' }, [key, next]),
        chooser,
        status,
        hint(keyPromise()),
      ]),
    ];
  }

  function localSteps(ai, m) {
    var server = localServer(m.provider);
    var running = !!(server && server.running);
    var models = running ? server.models : [];
    var status = statusSlot();
    var pullStatus = statusSlot();
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, models.map(function (id) {
      return el('option', { value: id, text: id });
    }));
    if (server && server.suggested) select.value = server.suggested;
    var connectStep;
    var connectBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect' });
    connectBtn.addEventListener('click', function () {
      connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, model: select.value } }, status, connectBtn, connectStep);
    });
    if (!models.length) connectBtn.disabled = true;

    var modelStepBody = !running ? [hint('Do step 1 first.')]
      : m.pull.length ? [
        hint('The library needs a model that can see images. Download one (a few GB):'),
        el('div', { class: 'ai-row' }, m.pull.map(function (name) {
          return terminalButton(name, { ai: ai.id, action: 'pull', arg: name }, pullStatus);
        }).concat([checkAgainButton()])),
        pullStatus,
      ]
      : [hint(m.startHint), el('div', { class: 'ai-row' }, [checkAgainButton()])];

    return [
      step(1, 'Install and open ' + m.label, running, running ? [] : [
        el('p', { class: 'ai-hint' }, [
          extLink(m.download, 'Download ' + m.label),
          document.createTextNode(' — free. ' + (m.pull.length ? m.startHint : 'Then open it.')),
        ]),
        el('div', { class: 'ai-row' }, [checkAgainButton()]),
      ]),
      step(2, 'Get a model that can see images', running && models.length > 0, modelStepBody),
      connectStep = step(3, 'Choose it and connect', running && isConnectedTo(ai.id, 'api'), models.length ? [el('div', { class: 'ai-row' }, [select, connectBtn]), status] : [hint('Your downloaded models will appear here.')]),
    ];
  }

  // ---- connected: the connection itself ------------------------------------------------
  //
  // Which AI and model, a model dropdown, Disconnect — and, when links are
  // waiting, a quieter box offering to analyse them.

  function connectedInto(pane) {
    var connection = cached.config.connection;
    var config = cached.config;
    var described = window.LinkStatus.describeAi(config);
    var since = window.UI.timeAgo(connection.at);
    var running = window.LibraryAI.drain.running;
    var block = el('div', { class: 'cp-connected' });
    block.appendChild(el('div', { class: 'cp-connected-head' }, [
      el('span', { class: 'ai-success-mark cp-ok', 'aria-hidden': 'true' }, [icon('check')]),
      el('div', {}, [
        el('p', { class: 'cp-connected-title', text: 'Connected · ' + (aiLabel(config) || connection.label) }),
        hint(describeConnection() + (since ? ' · connected ' + since : '')),
      ]),
    ]));
    if (described && described.canChange) modelPicker(block, config, running);
    block.appendChild(el('div', { class: 'cp-connected-foot' }, [
      el('button', {
        class: 'btn btn-secondary btn-sm btn-danger-quiet',
        type: 'button',
        text: 'Disconnect',
        disabled: running,
        title: running ? 'Stop analysing first' : null,
        onclick: function () { disconnect(connection.label); },
      }),
    ]));
    pane.appendChild(block);

    var waiting = cached.inbox ? cached.inbox.captures : 0;
    if (waiting) {
      pane.appendChild(el('div', { class: 'cp-handoff' }, [
        el('p', { class: 'cp-handoff-text', text: window.UI.plural(waiting, 'link') + (waiting === 1 ? ' is' : ' are') + ' waiting to be analysed.' }),
        el('div', { class: 'cp-handoff-actions' }, [
          el('button', {
            class: 'btn btn-secondary btn-sm',
            type: 'button',
            text: 'Analyse ' + window.UI.plural(waiting, 'link'),
            disabled: running,
            onclick: function () {
              closeModal();
              startDrain();
            },
          }),
        ]),
      ]));
    }
  }

  // Picks the model this AI drains with. An agent app gets "its own default"
  // plus its models (or a typed name); an API gets its model list.
  function modelPicker(block, config, running) {
    var agentMode = config.mode === 'agent';
    var current = agentMode ? config.agent.model || '' : config.api.model;
    var OTHER_MODEL = '\u0000other';
    var status = statusSlot();
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model', hidden: 'hidden' });
    var typed = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Model name', placeholder: 'Model name', hidden: 'hidden' });
    var save = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Use this model', disabled: true });
    block.appendChild(el('label', { class: 'add-modal-label', text: 'Model' }));
    block.appendChild(el('div', { class: 'ai-row' }, [select, typed, save]));
    block.appendChild(status);

    function chosen() {
      return select.hidden || select.value === OTHER_MODEL ? typed.value.trim() : select.value;
    }
    function changed() {
      save.disabled = running || chosen() === current || (!agentMode && !chosen());
    }
    select.addEventListener('change', function () {
      typed.hidden = select.value !== OTHER_MODEL;
      if (!typed.hidden) typed.focus();
      changed();
    });
    typed.addEventListener('input', changed);

    api('POST', '/api/models', { mode: config.mode }).then(function (r) {
      var options = r.models.map(function (m) {
        return typeof m === 'string' ? { id: m, label: m } : m;
      });
      var free = agentMode ? r.free : true;
      if (agentMode) options.unshift({ id: '', label: 'Its own default' });
      if (current && !options.some(function (o) { return o.id === current; })) options.push({ id: current, label: current });
      if (free) options.push({ id: OTHER_MODEL, label: 'Other…' });
      options.forEach(function (o) {
        select.appendChild(el('option', { value: o.id, text: o.label }));
      });
      select.value = current;
      select.hidden = false;
      changed();
    }, function (err) {
      if (err.helperDown) return;
      // No list to pick from (the key or server can't list models): a typed
      // name still works.
      typed.hidden = false;
      typed.value = current;
      window.UI.setNotice(status, 'warning', { title: 'Couldn’t list models', text: err.message + ' Type a model name instead.' });
      changed();
    });

    save.addEventListener('click', function () {
      var model = chosen();
      save.disabled = true;
      setStatus(status, 'info', agentMode ? 'Checking it answers…' : 'Checking it can see images…', agentMode ? 'This can take up to a minute.' : null);
      setModel(model).then(function (r) {
        window.UI.toast(r.message);
        renderPane();
      }).catch(function (err) {
        if (err.helperDown) return;
        setStatus(status, 'error', 'Couldn’t switch model', err.message + ' Still using the previous model.');
        save.disabled = false;
      });
    });
  }

  function disconnect(label) {
    api('POST', '/api/disconnect', {}).then(function (next) {
      adopt(next);
      notify();
      renderList();
      renderPane();
      window.UI.toast('Disconnected from ' + label + '. Your library is unchanged.');
    }, function (err) {
      if (err.helperDown) return;
      window.UI.toast('Couldn’t disconnect: ' + err.message);
    });
  }

  // ---- something else: any agent command, or an OpenAI-compatible server ------------------

  function otherInto(pane) {
    pane.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'Kind' }, [
      ['agent', 'Agent command'], ['server', 'OpenAI-compatible server'],
    ].map(function (k) {
      return el('button', {
        class: 'ai-segment-btn',
        type: 'button',
        'aria-pressed': String(ui.otherKind === k[0]),
        text: k[1],
        onclick: function () { ui.otherKind = k[0]; renderPane(); },
      });
    })));
    var status = statusSlot();
    var button = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect' });
    var form = el('div', { class: 'cp-other' });
    if (ui.otherKind === 'agent') {
      var cmd = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Agent command', placeholder: 'e.g. my-agent --headless -p' });
      button.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'agent', agent: { preset: 'custom', command: cmd.value } }, status, button);
      });
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Command' }));
      form.appendChild(cmd);
      form.appendChild(hint('It must run without asking questions; the instructions are added as its last argument.'));
    } else {
      var base = el('input', { class: 'add-modal-input ai-mono', type: 'url', spellcheck: 'false', 'aria-label': 'Base URL', placeholder: 'https://…/v1' });
      var model = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Model', placeholder: 'Model name' });
      var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', autocomplete: 'off', 'aria-label': 'API key', placeholder: 'Only if the server needs one' });
      button.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'api', api: { provider: 'custom', baseUrl: base.value, apiKey: key.value, model: model.value } }, status, button);
      });
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Server address' }));
      form.appendChild(base);
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Model' }));
      form.appendChild(model);
      form.appendChild(el('label', { class: 'add-modal-label', text: 'API key (optional)' }));
      form.appendChild(key);
      form.appendChild(hint('A key is kept in ' + (cached.keyStore || 'a private store on this computer') + ', and only sent to this server over https (plain http only to this computer).'));
    }
    form.appendChild(el('div', { class: 'add-modal-actions' }, [button]));
    form.appendChild(status);
    pane.appendChild(form);
  }

  // ---- Drain ---------------------------------------------------------------------
  //
  // Started from the inbox drawer (or the Connected screen). While a drain
  // runs, this keeps one event stream open whatever is on screen, so the
  // header and drawer can show progress and a toast can say when it's done.
  // API drains log "[2/5] https://…" per capture, which gives a real
  // count; agent drains don't, so their progress is just the latest line.

  var drain = { running: false, lines: [], step: 0, total: 0, currentUrl: '', ok: null, finished: false, error: '' };
  var source = null;

  function resetDrain() {
    drain.lines = [];
    drain.step = 0;
    drain.total = 0;
    drain.currentUrl = '';
    drain.ok = null;
    drain.finished = false;
    drain.error = '';
  }

  function onLine(line) {
    drain.lines.push(line);
    if (drain.lines.length > 2000) drain.lines.shift();
    var m = /^\[(\d+)\/(\d+)\] (.+)$/.exec(line);
    if (m) {
      drain.step = Number(m[1]);
      drain.total = Number(m[2]);
      drain.currentUrl = m[3];
    }
    notify();
  }

  function followDrain() {
    if (source) return;
    resetDrain();
    drain.running = true;
    source = new EventSource('/api/drain/events');
    source.addEventListener('line', function (evt) { onLine(JSON.parse(evt.data)); });
    source.addEventListener('end', function (evt) {
      var result = JSON.parse(evt.data);
      source.close();
      source = null;
      drain.running = false;
      drain.finished = true;
      drain.ok = !!result.ok;
      refreshStatus();
      // A clean run is a brief confirmation. One that needs attention stays in
      // the header ("2 added · 1 failed") until the drawer is opened.
      if (result.ok) {
        window.UI.toast('Analysis finished.', {
          action: { label: 'Show new references', run: function () { window.location.reload(); } },
        });
      }
    });
    source.onerror = function () {
      if (source && source.readyState === EventSource.CLOSED) {
        source = null;
        drain.running = false;
        drain.error = 'Lost contact with the library helper — is it still running?';
        notify();
      }
    };
  }

  function startDrain(url) {
    if (drain.running) return Promise.resolve();
    resetDrain();
    drain.running = true;
    notify();
    return api('POST', '/api/drain', url ? { url: url } : {}).then(function () {
      if (cached) cached.job = { running: true };
      followDrain();
    }, function (err) {
      drain.running = false;
      drain.error = err.message;
      notify();
    });
  }

  function stopDrain() {
    return api('POST', '/api/drain/stop', {});
  }

  // The inbox may change behind the page's back (the capture Shortcut, an
  // edit by hand), so recount on coming back to the tab.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !drain.running) refreshStatus();
  });

  window.LibraryAI = {
    served: served,
    status: function () { return cached; },
    refresh: refreshStatus,
    subscribe: function (fn) { listeners.push(fn); },
    drain: drain,
    modelCheck: modelCheck,
    listModels: listModels,
    setModel: setModel,
    startDrain: startDrain,
    stopDrain: stopDrain,
    openConnect: function () { openConnect(); },
  };

  // Arrived from the file:// page's Connect AI button: open Connect straight
  // away, then tidy the URL.
  var wantsConnect = served && new URLSearchParams(window.location.search).get('connect') === '1';
  refreshStatus().then(function () {
    if (!wantsConnect) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    openConnect();
  });

  // Opened as a file while Pool is running: move to the helper's copy, which
  // saves straight into this folder instead of asking for it with a picker.
  if (!served) {
    helperUp().then(function (up) {
      if (up) window.location.replace(HELPER_URL + window.location.hash);
    });
  }
})();
