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
    var problem = connection && connection.problem;
    var face = stopped || problem ? 'is-warn' : connection ? 'is-on' : 'is-off';
    var described = connection && window.LinkStatus.describeAi(cached.config);
    var text = stopped ? 'Pool stopped'
      : problem ? ((described && described.name) || connection.label) + ' · ' + problem.short
      : connection ? aiLabel(cached.config) || connection.label : 'Connect AI';
    var lead = face === 'is-off' ? icon('plus', 'cp-pill-icon') : face === 'is-warn' ? icon('alert', 'cp-pill-icon') : el('span', { class: 'ai-dot', 'aria-hidden': 'true' });
    slot.appendChild(el('button', {
      class: 'btn btn-secondary cp-pill ' + face + (pulseHeader ? ' is-updated' : ''),
      type: 'button',
      'aria-haspopup': 'dialog',
      title: stopped ? 'Pool needs to be running to analyse' : problem ? problem.title : connection ? 'Connected to ' + connection.label : null,
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
  // Set when the model has just changed, so the header button pulses once.
  var pulseHeader = false;

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
      pulseHeader = true;
      notify();
      pulseHeader = false;
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
  // tried: the last failed connect per AI ({ message, loggedOut }), so the
  // notice and "Try again" survive the pane being rebuilt.
  // keyDraft: an API key being entered, per AI, and what came of checking it.
  // It lives only in memory and is dropped when the window closes.
  // localModel: the model picked per local server, kept across rebuilds.
  // handoff: set when a connection has just been made or repaired, so the
  // box offering to analyse shows once and not on every later opening.
  // modelNotice: the "Now using …" notice after a model change, shown once.
  var ui = { selected: null, query: '', method: {}, otherKind: 'agent', tried: {}, keyDraft: {}, localModel: {}, disconnected: {}, handoff: false, modelNotice: null };
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
    if (isConnectedTo(ai.id)) {
      return cached.config.connection.problem ? { tone: 'warn', text: 'Needs attention' } : { tone: 'on', text: 'Connected' };
    }
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
    ui.keyDraft = {};
    win.overlay.remove();
    win = null;
    document.removeEventListener('keydown', onKey);
  }

  var openingSeq = 0;

  function openConnect(aiId) {
    closeModal();
    ui.selected = aiId || null;
    ui.query = '';
    ui.handoff = false;
    ui.modelNotice = null;
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
      : connection ? ''
      : 'Pool uses an AI to write up each reference you capture. Pick one you already use.';
    return el('div', { class: 'cp-pane-head' }, [
      el('div', {}, [el('h2', { class: 'add-modal-title', text: title }), lede ? el('p', { class: 'ai-lede', text: lede }) : null]),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: closeModal }, [icon('close')]),
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
      if (isConnectedTo('other')) return connectedInto(pane);
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

  // Ticks a step off: its mark becomes a check.
  function tickStep(li) {
    li.classList.add('is-done');
    var mark = li.querySelector('.ai-step-mark');
    mark.textContent = '';
    mark.appendChild(icon('check'));
  }

  // The step renderer: the one place the one-primary-button rule is applied.
  // The subscription, API key and local server flows all go through it.
  //
  // A step is { title, done, alsoOpen, handedOff, body: [nodes], actions: [{
  // label, run, disabled, mount }] }; `mount(button)` hands back the built
  // button, for a step that enables or disables it as the collector types. The current step is the first unfinished one you
  // can act on (a step that's only a link, like "get a key", has no actions and
  // doesn't hold the primary button back). Its first action is primary; every
  // other visible action is secondary. A finished step collapses to a ticked
  // one-line title, unless it can't be verified (log in, connect): `alsoOpen`
  // keeps it on show beside the current step, with secondary buttons.
  // `handedOff` is for a step that can't be ticked but has been acted on (the
  // app was opened to log in): it stays unticked and on show, yet no longer
  // holds the primary button.
  function stepList(steps) {
    var current = steps.findIndex(function (s) { return !s.done && !s.handedOff && s.actions && s.actions.length; });
    if (current < 0) current = steps.findIndex(function (s) { return !s.done; });
    return el('ol', { class: 'ai-steps-list cp-steps' }, steps.map(function (s, i) {
      var open = !s.done || s.alsoOpen;
      var children = [el('p', { class: 'ai-step-title', text: s.title })];
      if (open) {
        (s.body || []).forEach(function (node) { if (node) children.push(node); });
        var actions = (s.actions || []).map(function (a, j) {
          var button = el('button', {
            class: 'btn ' + (i === current && j === 0 ? 'btn-primary' : 'btn-secondary'),
            type: 'button',
            text: a.label,
          });
          if (a.disabled) button.disabled = true;
          if (a.mount) a.mount(button);
          button.addEventListener('click', function () { a.run(button); });
          return button;
        });
        if (actions.length) children.push(el('div', { class: 'ai-row' }, actions));
        if (s.slot) children.push(s.slot);
      }
      var li = el('li', { class: 'ai-step' + (s.done && !s.alsoOpen ? ' is-collapsed' : ''), 'data-step': String(i + 1) }, [
        el('span', { class: 'ai-step-mark', 'aria-hidden': 'true', text: String(i + 1) }),
        el('div', { class: 'ai-step-body' }, children),
      ]);
      if (s.done) tickStep(li);
      return li;
    }));
  }

  // AIs whose login window has been opened this session. Step 2 is ticked as
  // soon as it is (and stays ticked when the guide re-renders, e.g. after
  // "Check again"); "Open … to log in" stays beside it to open it again.
  var loginOpened = {};
  // AIs whose login has been seen to work since the window opened its login
  // step, so the step shows a tick without the collector doing anything more.
  var loginVerified = {};
  var loginWatching = {};

  // After the login window opens, quietly ask the helper whether the app
  // answers yet, until it does (or a few minutes pass). Nothing is connected
  // by this: it only lets the login step tick.
  function watchLogin(aiId, preset) {
    if (loginWatching[aiId] || loginVerified[aiId]) return;
    loginWatching[aiId] = true;
    var attempts = 0;
    function stop() { delete loginWatching[aiId]; }
    function next() {
      window.setTimeout(function () {
        if (!win || !loginWatching[aiId]) return stop();
        api('POST', '/api/login-check', { ai: aiId, agent: { preset: preset } }).then(function (r) {
          if (r.ok) {
            loginVerified[aiId] = true;
            rememberSignedIn(preset, 'yes');
            stop();
            renderPane();
          } else if (++attempts < 15) {
            next();
          } else {
            stop();
          }
        }, stop);
      }, attempts === 0 ? 4000 : 8000);
    }
    next();
  }

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
      pane.appendChild(el('div', { class: 'ai-segment', role: 'tablist', 'aria-label': 'How to connect' }, ai.methods.map(function (m) {
        return el('button', {
          class: 'ai-segment-btn',
          type: 'button',
          role: 'tab',
          'aria-selected': String(m === method),
          text: m.label,
          onclick: function () { ui.method[ai.id] = m.id; renderPane(); },
        });
      })));
    }
    if (connectedHere && methodModeIs(method, cached.config.mode)) return connectedInto(pane);

    var steps = method.id === 'agent' ? agentSteps(ai, method) : method.id === 'key' ? keySteps(ai, method) : localSteps(ai, method);
    pane.appendChild(stepList(steps));
    // A failed connect's notice is brought into view, not left below the fold.
    var failure = pane.querySelector('.notice.is-error');
    if (failure) window.requestAnimationFrame(function () { failure.scrollIntoView({ block: 'nearest' }); });
  }

  // Runs one connection test and, when it passes, moves the pane on to the
  // connection.
  // options: { app } names the agent app in "Checking {app} answers…";
  // { triedKey } is the ui.tried entry a pass clears;
  // { onFail(err) } takes over showing a failure (err.result is the helper's
  // answer, so it can tell a lost login from anything else).
  var busy = false;
  function connectWith(update, status, button, options) {
    options = options || {};
    if (busy) return;
    busy = true;
    button.disabled = true;
    setStatus(status, 'info', update.mode === 'agent' ? 'Checking ' + (options.app || 'it') + ' answers…' : 'Checking it can see images…', update.mode === 'agent' ? 'This can take up to a minute.' : null);
    api('POST', '/api/connect', update).then(function (r) {
      adopt(r.status);
      notify();
      if (!r.ok) {
        var failed = new Error(r.message);
        failed.result = r;
        throw failed;
      }
      if (options.triedKey) delete ui.tried[options.triedKey];
      ui.handoff = true;
      if (update.mode === 'agent' && update.agent && update.ai) rememberSignedIn(update.agent.preset, 'yes');
      if (update.api) delete ui.keyDraft[update.ai];
      renderList();
      renderPane();
    }).catch(function (err) {
      if (err.helperDown) return;
      if (options.onFail) options.onFail(err);
      else setStatus(status, 'error', 'Couldn’t connect', plainFailure(err.message));
    }).then(function () {
      busy = false;
      button.disabled = false;
    });
  }

  // What detection last said about an agent app's login, kept current from
  // what this window has just seen (a pass, or a login prompt).
  function rememberSignedIn(preset, state) {
    var a = found && found.agents.find(function (x) { return x.id === preset; });
    if (a) a.signedIn = state;
  }

  // Install → log in → connect, for an AI that runs through its own app.
  // Log in and connect can't be verified from here, so they stay on show
  // (alsoOpen) beside whichever step is current, as secondary buttons.
  function agentSteps(ai, m) {
    var installed = agentInstalled(m.preset);
    var agent = found && found.agents.find(function (x) { return x.id === m.preset; });
    var signedIn = agent ? agent.signedIn || 'unknown' : 'unknown';
    var connected = isConnectedTo(ai.id, 'agent');
    var loggedIn = connected || signedIn === 'yes' || !!loginVerified[ai.id];
    var opened = !!loginOpened[ai.id];
    var tried = ui.tried[ai.id];
    var installStatus = statusSlot();
    var loginStatus = statusSlot();
    var connectStatus = statusSlot();

    var steps = [
      {
        title: installed ? m.app + ' is installed' : 'Install ' + m.app,
        done: installed,
        body: [
          hint(m.app + ' is the app that lets the library use your ' + m.label.toLowerCase() + '.'),
          el('p', { class: 'ai-hint' }, [
            document.createTextNode('Or run it yourself: '),
            el('code', { class: 'ai-code-inline', text: m.install }),
            document.createTextNode(' · '),
            extLink(m.docs, 'install guide'),
          ]),
        ],
        actions: [
          { label: 'Install ' + m.app, run: terminalRun({ ai: ai.id, action: 'install' }, installStatus) },
          { label: 'Check again', run: checkAgainRun },
        ],
        slot: installStatus,
      },
      {
        title: loggedIn ? (ui.disconnected[ai.id] ? 'Still logged in to ' : 'Logged in to ') + m.app
          : installed && opened ? 'Opened ' + m.app + ' to log in' : 'Log in to ' + m.app,
        done: loggedIn || (installed && opened),
        alsoOpen: !loggedIn,
        body: [
          hint('Needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1)),
          hint(m.login.steps),
          hint('Already logged in? Just press Connect.'),
        ],
        actions: [{
          label: 'Open ' + m.app + ' to log in',
          disabled: !installed,
          run: terminalRun({ ai: ai.id, action: 'login' }, loginStatus, function () {
            loginOpened[ai.id] = true;
            renderPane();
            watchLogin(ai.id, m.preset);
          }),
        }],
        slot: loginStatus,
      },
      {
        title: 'Connect',
        done: connected,
        alsoOpen: true,
        body: [hint('Pool checks ' + m.app + ' answers, then you can analyse.')],
        actions: [{
          label: tried ? 'Try again' : 'Connect',
          disabled: !installed,
          run: function (button) {
            connectWith({ ai: ai.id, mode: 'agent', agent: { preset: m.preset } }, connectStatus, button, {
              app: m.app,
              triedKey: ai.id,
              onFail: function (err) {
                var lost = !!(err.result && err.result.loggedOut);
                ui.tried[ai.id] = { message: err.message, loggedOut: lost };
                if (lost) rememberSignedIn(m.preset, 'no');
                renderPane();
              },
            });
          },
        }],
        slot: connectStatus,
      },
    ];

    // A failed connect is reported in the connect step. When the fix is the
    // login step above, the notice points at it instead of repeating its button.
    if (tried) {
      setStatus(connectStatus, 'error',
        tried.loggedOut ? m.app + ' isn’t logged in' : 'Couldn’t connect',
        tried.loggedOut ? 'Use “Open ' + m.app + ' to log in” above, then press Try again.' : plainFailure(tried.message) + ' Press Try again.');
    }
    return steps;
  }

  // Opens a catalog Terminal action from a step button.
  function terminalRun(body, status, after) {
    return function (button) {
      button.disabled = true;
      api('POST', '/api/terminal', body).then(function (r) {
        setStatus(status, r.ok ? 'success' : 'error', r.ok ? r.message : 'That didn’t work', r.ok ? null : r.message);
        if (r.ok && after) after();
      }, function (err) {
        if (err.helperDown) return;
        setStatus(status, 'error', 'That didn’t work', err.message);
      }).then(function () { button.disabled = false; });
    };
  }

  function checkAgainRun(button) {
    button.disabled = true;
    button.textContent = 'Checking…';
    var done = function () {
      renderList();
      renderPane();
    };
    detectNow(true).then(done, done);
  }

  // Where a pasted key ends up, said plainly — see scripts/ai/secrets.js.
  function keyPromise() {
    return 'Kept in ' + (cached.keyStore || 'a private store on this computer') + ', never in the library folder or the browser.';
  }

  // The key being entered for an AI, and what came of checking it:
  // { value, models: [ids] | null, model, failed: { title, text } | null }.
  function keyDraftFor(aiId) {
    if (!ui.keyDraft[aiId]) ui.keyDraft[aiId] = { value: '', models: null, model: '', failed: null };
    return ui.keyDraft[aiId];
  }

  // A provider or an app may answer a failure in terms of money. Pool's
  // window never talks about cost, so such an answer is replaced by plain
  // advice; everything else is shown as it came.
  var COST_TALK = /quota|billing|credit|balance|\bpay|\bcost|\bprice|pricing|\bcharge|\bplan limit/i;

  function plainFailure(message) {
    return COST_TALK.test(String(message || '')) ? 'It didn’t answer. Check the details above, then try again.' : message;
  }

  // What a failed key check or connect says. A key the provider turned down
  // (or any answer that is about the account) is "That key didn't work" with
  // the one fix the collector has; the provider's own wording is never shown.
  // Not being able to reach the provider, and a model that can't see images,
  // say so instead.
  function keyFailure(providerName, message) {
    if (/\bsee images\b|support images/i.test(message)) return { title: 'Couldn’t connect', text: plainFailure(message) + ' Choose another model, then press Try again.' };
    if (/could not reach|ECONN|ENOTFOUND|timed? ?out|Lost contact/i.test(message)) {
      return { title: 'Couldn’t reach ' + providerName, text: 'Check your internet connection, then press Try again.' };
    }
    return {
      title: 'That key didn’t work',
      text: 'Check that you copied all of it from your ' + providerName + ' account, then paste it again and press Try again.',
    };
  }

  // Both steps are open from the start: someone with a key ready pastes it
  // without touching step 1. Check key is the primary until the key lists
  // models; then it's Connect.
  function keySteps(ai, m) {
    var provider = cached.presets.providers.find(function (p) { return p.id === m.provider; });
    var providerName = provider.label.replace(/ \(.*\)$/, '');
    var saved = hasEnvKey(m.provider);
    var draft = keyDraftFor(ai.id);
    var status = statusSlot();
    var checkButton = null;
    var key = el('input', {
      class: 'add-modal-input ai-mono',
      type: 'password',
      autocomplete: 'off',
      'aria-label': 'API key',
      placeholder: saved ? 'Found $' + provider.keyEnv + ' — leave empty to use it' : 'Paste your API key',
    });
    // As a property, not an attribute: an attribute would put the key in the
    // page's markup.
    key.value = draft.value;
    key.addEventListener('input', function () {
      draft.value = key.value;
      if (draft.models || draft.failed) {
        // The models were listed for the old key, and a failure was about it.
        draft.models = null;
        draft.failed = null;
        renderPane();
        var again = win && win.pane.querySelector('input[aria-label="API key"]');
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      } else if (checkButton) {
        checkButton.disabled = !saved && !draft.value.trim();
      }
    });

    function fail(err) {
      if (err.helperDown) return;
      draft.failed = keyFailure(providerName, err.message);
      renderPane();
    }

    function checkKey(button) {
      button.disabled = true;
      setStatus(status, 'info', 'Checking the key…');
      api('POST', '/api/models', { mode: 'api', api: { provider: m.provider, apiKey: draft.value } }).then(function (r) {
        if (!r.models.length) {
          draft.failed = { title: 'No models to choose from', text: 'This key lists no models. Check that it’s for ' + providerName + '’s API, then press Try again.' };
          return renderPane();
        }
        draft.models = r.models;
        draft.model = r.suggested || r.models[0];
        draft.failed = null;
        renderPane();
      }).catch(function (err) {
        fail(err);
        button.disabled = false;
      });
    }

    var body = [el('div', { class: 'ai-row' }, [key])];
    var actions;
    if (draft.models) {
      var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, draft.models.map(function (id) {
        return el('option', { value: id, text: id });
      }));
      select.value = draft.model;
      select.addEventListener('change', function () { draft.model = select.value; });
      body.push(el('div', { class: 'ai-row' }, [select]));
      actions = [{
        label: draft.failed ? 'Try again' : 'Connect',
        run: function (button) {
          connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, apiKey: draft.value, model: draft.model } }, status, button, {
            onFail: fail,
          });
        },
      }];
    } else {
      actions = [{
        label: draft.failed ? 'Try again' : 'Check key',
        disabled: !saved && !draft.value.trim(),
        mount: function (button) { checkButton = button; },
        run: checkKey,
      }];
    }
    body.push(hint(keyPromise()));
    if (draft.failed) setStatus(status, 'error', draft.failed.title, draft.failed.text);

    return [
      {
        title: saved ? 'You have an API key' : 'Get an API key',
        done: saved,
        alsoOpen: true,
        body: [el('p', { class: 'ai-hint' }, [extLink(m.keyUrl, 'Get a key'), document.createTextNode(' — already have one? Paste it below.')])],
      },
      { title: 'Paste it and pick a model', body: body, actions: actions, slot: status },
    ];
  }

  // Download and open the app → get a model that can see images → connect.
  function localSteps(ai, m) {
    var server = localServer(m.provider);
    var running = !!(server && server.running);
    var models = running ? server.models : [];
    var tried = ui.tried[ai.id + ':local'];
    var downloadStatus = statusSlot();
    var connectStatus = statusSlot();
    var checkAgain = function (label) { return { label: label, run: checkAgainRun }; };

    var modelActions = [];
    var modelBody;
    if (!running) {
      modelBody = [hint('Do step 1 first.')];
    } else if (m.pull.length) {
      modelBody = [hint('The library needs a model that can see images. Download one (a few GB):')];
      modelActions = m.pull.map(function (name, i) {
        return { label: 'Download ' + name + (i === 0 ? ' (recommended)' : ''), run: terminalRun({ ai: ai.id, action: 'pull', arg: name }, downloadStatus) };
      }).concat([checkAgain('Check again')]);
    } else {
      modelBody = [hint(m.startHint)];
      modelActions = [checkAgain('Check again')];
    }

    var chosen = ui.localModel[ai.id];
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, models.map(function (id) {
      return el('option', { value: id, text: id });
    }));
    if (models.indexOf(chosen) !== -1) select.value = chosen;
    else if (server && server.suggested) select.value = server.suggested;
    select.addEventListener('change', function () { ui.localModel[ai.id] = select.value; });

    if (tried) setStatus(connectStatus, 'error', 'Couldn’t connect', plainFailure(tried.message) + ' Press Try again.');

    return [
      {
        title: running ? m.label + ' is running' : 'Install and open ' + m.label,
        done: running,
        body: running ? [] : [el('p', { class: 'ai-hint' }, [
          extLink(m.download, 'Download ' + m.label),
          document.createTextNode(' — ' + (m.pull.length ? m.startHint : 'then open it.')),
        ])],
        actions: running ? [] : [checkAgain('I’ve opened it — check again')],
      },
      {
        title: running && models.length ? 'You have a model that can see images' : 'Get a model that can see images',
        done: running && models.length > 0,
        body: modelBody,
        actions: modelActions,
        slot: downloadStatus,
      },
      {
        title: 'Choose it and connect',
        body: models.length ? [el('div', { class: 'ai-row' }, [select])] : [hint('Your downloaded models will appear here.')],
        actions: models.length ? [{
          label: tried ? 'Try again' : 'Connect',
          run: function (button) {
            connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, model: select.value } }, connectStatus, button, {
              triedKey: ai.id + ':local',
              onFail: function (err) {
                ui.tried[ai.id + ':local'] = { message: err.message };
                renderPane();
              },
            });
          },
        }] : [],
        slot: connectStatus,
      },
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
    if (connection.problem) return repairInto(pane, connection, running);
    var block = el('div', { class: 'cp-connected' });
    block.appendChild(el('div', { class: 'cp-connected-head' }, [
      el('span', { class: 'ai-success-mark cp-ok', 'aria-hidden': 'true' }, [icon('check')]),
      el('div', {}, [
        el('p', { class: 'cp-connected-title', text: 'Connected · ' + (aiLabel(config) || connection.label) }),
        hint(describeConnection() + (since ? ' · connected ' + since : '')),
      ]),
    ]));
    if (described && described.canChange) modelPicker(block, config, running);
    if (ui.modelNotice) {
      var done = statusSlot();
      window.UI.setNotice(done, 'success', ui.modelNotice);
      block.appendChild(done);
      ui.modelNotice = null;
    }
    block.appendChild(el('div', { class: 'cp-connected-foot' }, [disconnectButton(connection, running)]));
    pane.appendChild(block);

    if (ui.handoff) pane.appendChild(handoffBox(running));
  }

  // The connection broke (see connection.problem): a warning that says what
  // happened and how many links wait, then the repair as steps on the same
  // one-primary rule, and Disconnect for giving up on this AI. A passing
  // check replaces the connection, which clears the problem and shows the
  // hand-off (connectWith).
  function repairInto(pane, connection, running) {
    var config = cached.config;
    var problem = connection.problem;
    var described = window.LinkStatus.describeAi(config);
    var ai = findAi(connection.ai);
    var method = ai && ai.methods.find(function (m) { return methodModeIs(m, config.mode); });
    var app = (method && method.app) || (described && described.name) || connection.label;
    var block = el('div', { class: 'cp-connected cp-repair is-warn' });
    var warning = statusSlot();
    window.UI.setNotice(warning, 'warning', { title: (described ? described.name + ' needs attention' : 'Needs attention'), text: problem.text });
    block.appendChild(warning);

    var update = { ai: connection.ai, mode: config.mode };
    if (config.mode === 'agent') update.agent = { preset: config.agent.preset };
    var checkStatus = statusSlot();
    var loginStatus = statusSlot();
    function check(button) {
      connectWith(update, checkStatus, button, {
        app: app,
        onFail: function (err) {
          var lost = !!(err.result && err.result.loggedOut);
          if (lost && config.mode === 'agent') rememberSignedIn(config.agent.preset, 'no');
          setStatus(checkStatus, 'error', lost ? app + ' isn’t logged in yet' : 'Still not working', plainFailure(err.message));
        },
      });
    }

    var steps;
    if (problem.kind === 'logged-out') {
      steps = [
        {
          title: loginVerified[connection.ai] ? 'Logged in to ' + app
            : loginOpened[connection.ai] ? 'Opened ' + app + ' to log in' : 'Log in to ' + app + ' again',
          done: !!(loginVerified[connection.ai] || loginOpened[connection.ai]),
          alsoOpen: !loginVerified[connection.ai],
          body: [hint('Opens ' + app + ' in a Terminal window. Log in there, then come back.')],
          actions: [{
            label: 'Open ' + app + ' to log in',
            run: terminalRun({ ai: connection.ai, action: 'login' }, loginStatus, function () {
              loginOpened[connection.ai] = true;
              renderPane();
              if (config.mode === 'agent') watchLogin(connection.ai, config.agent.preset);
            }),
          }],
          slot: loginStatus,
        },
        { title: 'Check again', body: [hint('Pool checks ' + app + ' answers.')], actions: [{ label: 'I’ve logged in — check again', run: check }], slot: checkStatus },
      ];
    } else {
      steps = [{
        title: 'Check again',
        body: [hint(problem.kind === 'key-rejected'
          ? 'If you’ve fixed the key, check again. Or disconnect and paste a new one.'
          : 'Make sure it’s running, then check again.')],
        actions: [{ label: 'Check again', run: check }],
        slot: checkStatus,
      }];
    }
    block.appendChild(stepList(steps));
    block.appendChild(el('div', { class: 'cp-connected-foot' }, [disconnectButton(connection, running)]));
    pane.appendChild(block);
  }

  function disconnectButton(connection, running) {
    return el('button', {
      class: 'btn btn-secondary btn-sm btn-danger-quiet',
      type: 'button',
      text: 'Disconnect',
      disabled: running,
      title: running ? 'Stop analysing first' : null,
      onclick: function () { disconnect(connection); },
    });
  }

  // The end of the journey isn't "Connected", it's "your links are being
  // analysed": offered in a quieter box under the connection, not instead of
  // it. Analyse starts the same drain the Add drawer starts and closes the
  // window; progress shows where it always does.
  function handoffBox(running) {
    var waiting = cached.inbox ? cached.inbox.captures : 0;
    var links = window.UI.plural(waiting, 'link');
    return el('div', { class: 'cp-handoff' }, [
      el('p', {
        class: 'cp-handoff-text',
        text: waiting ? links + (waiting === 1 ? ' is' : ' are') + ' waiting to be analysed.' : 'Add a link, then press Analyse.',
      }),
      el('div', { class: 'cp-handoff-actions' }, waiting ? [
        el('button', {
          class: 'btn btn-secondary btn-sm',
          type: 'button',
          text: 'Analyse ' + links,
          disabled: running,
          onclick: function () {
            closeModal();
            startDrain();
          },
        }),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Later', onclick: closeModal }),
      ] : [
        el('button', {
          class: 'btn btn-secondary btn-sm',
          type: 'button',
          text: 'Add a link',
          onclick: function () {
            closeModal();
            if (window.openInbox) window.openInbox();
          },
        }),
      ]),
    ]);
  }

  // Picks the model this AI drains with. An agent app gets an "Automatic" choice
  // plus its models (or a typed name); an API gets its model list. Choosing a
  // model switches to it straight away; a typed name switches on Enter or blur.
  function modelPicker(block, config, running) {
    var agentMode = config.mode === 'agent';
    var current = agentMode ? config.agent.model || '' : config.api.model;
    var OTHER_MODEL = '\u0000other';
    var appName = (window.LinkStatus.describeAi(config) || {}).name || 'the app';
    var status = statusSlot();
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model', hidden: 'hidden', disabled: running });
    var typed = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Model name', placeholder: 'Model name, then Enter', hidden: 'hidden', disabled: running });
    var switching = false;
    block.appendChild(el('label', { class: 'add-modal-label', text: 'Model' }));
    block.appendChild(el('div', { class: 'ai-row' }, [select, typed]));
    block.appendChild(status);

    function chosen() {
      return select.hidden || select.value === OTHER_MODEL ? typed.value.trim() : select.value;
    }
    select.addEventListener('change', function () {
      typed.hidden = select.value !== OTHER_MODEL;
      if (!typed.hidden) {
        typed.focus();
        return;
      }
      switchModel();
    });
    // 'change' fires on Enter and when the field loses focus.
    typed.addEventListener('change', switchModel);

    api('POST', '/api/models', { mode: config.mode }).then(function (r) {
      var options = r.models.map(function (m) {
        return typeof m === 'string' ? { id: m, label: m } : m;
      });
      var free = agentMode ? r.free : true;
      if (agentMode) options.unshift({ id: '', label: 'Automatic (' + appName + ' chooses)' });
      if (current && !options.some(function (o) { return o.id === current; })) options.push({ id: current, label: window.LinkStatus.modelName(current) });
      if (free) options.push({ id: OTHER_MODEL, label: 'Other…' });
      options.forEach(function (o) {
        select.appendChild(el('option', { value: o.id, text: o.label }));
      });
      select.value = current;
      select.hidden = false;
    }, function (err) {
      if (err.helperDown) return;
      // No list to pick from (the key or server can't list models): a typed
      // name still works.
      typed.hidden = false;
      typed.value = current;
      window.UI.setNotice(status, 'warning', { title: 'Couldn’t list models', text: plainFailure(err.message) + ' Type a model name instead.' });
    });

    function switchModel() {
      var model = chosen();
      if (switching || running || model === current || (!agentMode && !model)) return;
      switching = true;
      select.disabled = typed.disabled = true;
      setStatus(status, 'info', agentMode ? 'Checking it answers…' : 'Checking it can see images…', agentMode ? 'This can take up to a minute.' : null);
      setModel(model).then(function () {
        var now = window.LinkStatus.describeAi(cached.config);
        ui.modelNotice = { title: 'Now using ' + ((now && now.model) || (model ? window.LinkStatus.modelName(model) : 'automatic model choice')), text: 'Your next analyses use it.' };
        renderPane();
      }).catch(function (err) {
        switching = false;
        select.disabled = typed.disabled = false;
        if (err.helperDown) return;
        setStatus(status, 'error', 'Couldn’t switch model', plainFailure(err.message) + ' Still using the previous model.');
        // Show the model still in use, not the one that failed.
        if (!select.hidden) {
          select.value = current;
          typed.hidden = true;
        } else {
          typed.value = current;
        }
      });
    }
  }

  // Clears only the connection. Where the pane lands follows from what the
  // helper remembers of the login: still logged in → Connect is the primary;
  // login lost → Open {app} to log in is. The window is left on the way the
  // collector had connected, so "Connect" means the same thing again.
  function disconnect(connection) {
    var config = cached.config;
    var lost = connection.problem && connection.problem.kind === 'logged-out';
    api('POST', '/api/disconnect', {}).then(function (next) {
      var ai = findAi(connection.ai);
      var method = ai && ai.methods.find(function (m) {
        return methodModeIs(m, config.mode) && (m.id === 'agent' || !m.provider || m.provider === config.api.provider);
      });
      if (method) ui.method[ai.id] = method.id;
      if (config.mode === 'agent') {
        if (lost) rememberSignedIn(config.agent.preset, 'no');
        else rememberSignedIn(config.agent.preset, 'yes');
        ui.disconnected[connection.ai] = true;
      }
      adopt(next);
      notify();
      renderList();
      renderPane();
      window.UI.toast('Disconnected from ' + connection.label + '. Your library is unchanged.');
    }, function (err) {
      if (err.helperDown) return;
      window.UI.toast('Couldn’t disconnect: ' + err.message);
    });
  }

  // ---- something else: any agent command, or an OpenAI-compatible server ------------------

  function otherInto(pane) {
    pane.appendChild(el('div', { class: 'ai-segment', role: 'tablist', 'aria-label': 'Kind' }, [
      ['agent', 'Agent command'], ['server', 'OpenAI-compatible server'],
    ].map(function (k) {
      return el('button', {
        class: 'ai-segment-btn',
        type: 'button',
        role: 'tab',
        'aria-selected': String(ui.otherKind === k[0]),
        text: k[1],
        onclick: function () { ui.otherKind = k[0]; renderPane(); },
      });
    })));
    var status = statusSlot();
    var button = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect' });
    var form = el('div', { class: 'cp-other' });
    // A failure is shown in place rather than by rebuilding the form, so what
    // was typed stays; the button becomes Try again.
    var options = {
      onFail: function (err) {
        setStatus(status, 'error', 'Couldn’t connect', plainFailure(err.message));
        button.textContent = 'Try again';
        status.scrollIntoView({ block: 'nearest' });
      },
    };
    if (ui.otherKind === 'agent') {
      var cmd = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Agent command', placeholder: 'e.g. my-agent --headless -p' });
      button.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'agent', agent: { preset: 'custom', command: cmd.value } }, status, button, options);
      });
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Command' }));
      form.appendChild(cmd);
      form.appendChild(hint('It must run without asking questions; the instructions are added as its last argument.'));
    } else {
      var base = el('input', { class: 'add-modal-input ai-mono', type: 'url', spellcheck: 'false', 'aria-label': 'Base URL', placeholder: 'https://…/v1' });
      var model = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Model', placeholder: 'Model name' });
      var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', autocomplete: 'off', 'aria-label': 'API key', placeholder: 'Only if the server needs one' });
      button.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'api', api: { provider: 'custom', baseUrl: base.value, apiKey: key.value, model: model.value } }, status, button, options);
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

  var drain = { running: false, startedAt: 0, lines: [], step: 0, total: 0, currentUrl: '', ok: null, finished: false, error: '' };
  var source = null;

  function resetDrain() {
    drain.lines = [];
    drain.startedAt = Date.now();
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
    var moved = false;
    if (m) {
      moved = drain.step !== Number(m[1]);
      drain.step = Number(m[1]);
      drain.total = Number(m[2]);
      drain.currentUrl = m[3];
    }
    notify();
    // A link just finished: recount the inbox so the list ticks it off now,
    // not at the end of the run.
    if (moved) refreshStatus();
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
