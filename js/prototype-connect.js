// PROTOTYPE — throwaway, lives only on prototype/connect-ai.
// Answers three questions about the Connect AI window, inside the real app:
// Visual direction (Q5) is settled on the two-pane window: the AIs on the left,
// the chosen one's guide on the right. Looks A and B are gone.
// C5: the list has a search box over it. No filters, no talk of cost —
// search finds an AI by its own name or by the app it runs through
// ("codex" finds ChatGPT).
//   ?guide=A|B      what a guide shows once steps are done (Q3): folded / open with buttons hidden
//   ?scene=off|fresh|connected|broken|lost   where in the journey the computer is
//   ?fail=login|key|vision|slow|plan   the next connection test fails this way (once)
// The header pill shows the proposed "AI · model" naming (Q4).
// The bar's "Journey" button walks the whole thing, moment by moment: first
// start, finding what's already installed, a failed check, the hand-off to
// the first analyse, a connection that breaks later, and Pool stopping.
// Active only when the URL has ?cproto. Everything runs on in-memory stub
// state: nothing is installed, connected, saved or sent anywhere.
(function () {
  'use strict';

  if (!new URLSearchParams(window.location.search).has('cproto')) return;

  var UI = window.UI;
  var el = UI.el;
  var icon = UI.icon;

  var GUIDES = { A: 'Done steps fold', B: 'Steps open, buttons hidden' };
  var SCENES = { off: 'Pool not started yet', fresh: 'Not connected yet', connected: 'Connected to Claude', broken: 'Connection broke', lost: 'Pool stopped' };
  var FAILS = { none: 'Succeeds', login: 'Not logged in', key: 'Key rejected', vision: 'Can’t see images', slow: 'No answer', plan: 'Plan / billing' };

  // The journey, in order. Each moment sets up the stub state and opens the
  // surface where that moment happens.
  var JOURNEY = [
    { scene: 'off', fail: 'none', title: 'First start', what: 'Opened from the file. Pool has never run — the one manual step, then straight into finding AIs.' },
    { scene: 'fresh', fail: 'none', title: 'Finding what’s here', what: 'Pool looks first. The list regroups around what it found, and the best find is already open.' },
    { scene: 'fresh', fail: 'login', title: 'A check fails', what: 'Connect Claude Code — it says it isn’t logged in. One fix, then Try again succeeds.' },
    { scene: 'fresh', fail: 'none', title: 'Connected → first analyse', what: 'Connect anything. The success state hands you straight to the links waiting.', open: 'claude' },
    { scene: 'broken', fail: 'none', title: 'It breaks later', what: 'Days later an analyse fails: logged out. The header pill says so; one step back in.' },
    { scene: 'lost', fail: 'none', title: 'Pool stopped', what: 'The Terminal window got closed. The AI is still connected — Pool just needs to run.' },
  ];

  function param(key, options, fallback) {
    var v = new URLSearchParams(window.location.search).get(key);
    return options[v] ? v : fallback;
  }

  function setParam(key, value) {
    var p = new URLSearchParams(window.location.search);
    p.set(key, value);
    window.history.replaceState(null, '', window.location.pathname + '?' + p.toString() + window.location.hash);
  }

  // ---- stub catalog (mirrors scripts/ai/catalog.js) ---------------------------

  var CATALOG = [
    { id: 'claude', name: 'Claude', mark: 'C', blurb: 'Use your Claude subscription or an API key.', methods: [
      { id: 'agent', label: 'Claude subscription', app: 'Claude Code', needs: 'A Claude Pro, Max, Team or Enterprise plan.', models: ['Opus 5.5', 'Sonnet 5.5', 'Haiku 4.5'] },
      { id: 'key', label: 'API key', provider: 'Anthropic', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'] },
    ] },
    { id: 'chatgpt', name: 'ChatGPT', mark: 'G', blurb: 'Use your ChatGPT plan through Codex, or an API key.', methods: [
      { id: 'agent', label: 'ChatGPT subscription', app: 'Codex', needs: 'A ChatGPT Plus, Pro, Business or Enterprise plan.', models: ['gpt-5', 'gpt-5-mini'] },
      { id: 'key', label: 'API key', provider: 'OpenAI', models: ['gpt-5', 'gpt-5-mini'] },
    ] },
    { id: 'gemini', name: 'Gemini', mark: 'G', blurb: 'Sign in with your Google account, or use an API key.', methods: [
      { id: 'agent', label: 'Google account', app: 'Antigravity CLI', needs: 'A Google account.', models: ['gemini-3-pro', 'gemini-3-flash'] },
      { id: 'key', label: 'API key', provider: 'Google AI Studio', models: ['gemini-3-pro', 'gemini-3-flash'] },
    ] },
    { id: 'opencode', name: 'OpenCode', mark: 'O', blurb: 'An open-source agent that works with many model providers.', methods: [
      { id: 'agent', label: 'OpenCode', app: 'OpenCode', needs: 'An account with any provider OpenCode supports.', models: [] },
    ] },
    { id: 'pi', name: 'Pi', mark: 'π', blurb: 'A minimal agent that can use your Claude, ChatGPT or Copilot subscription.', methods: [
      { id: 'agent', label: 'Pi', app: 'Pi', needs: 'A Claude, ChatGPT or GitHub Copilot subscription, or an API key.', models: [] },
    ] },
    { id: 'hermes', name: 'Hermes', mark: 'H', blurb: 'Nous Research’s agent, with its own setup wizard.', methods: [
      { id: 'agent', label: 'Hermes', app: 'Hermes Agent', needs: 'An account with any provider Hermes supports.', models: [] },
    ] },
    { id: 'openrouter', name: 'OpenRouter', mark: 'R', blurb: 'One key for hundreds of models from every major lab.', methods: [
      { id: 'key', label: 'API key', provider: 'OpenRouter', models: ['anthropic/claude-sonnet-5.5', 'openai/gpt-5', 'google/gemini-3-pro'] },
    ] },
    { id: 'ollama', name: 'Ollama', mark: 'O', blurb: 'Run a model on this computer — free and private.', methods: [
      { id: 'local', label: 'Ollama', pull: ['qwen2.5vl', 'gemma3', 'llama3.2-vision'] },
    ] },
    { id: 'lmstudio', name: 'LM Studio', mark: 'L', blurb: 'Run a model on this computer with a friendly app.', methods: [
      { id: 'local', label: 'LM Studio', pull: [] },
    ] },
  ];

  // ---- stub state ----------------------------------------------------------------

  var state;

  function loadScene(scene) {
    reopened = {};
    state = {
      connection: null, // { ai, method, model, at }
      installed: { claude: true, opencode: true },
      loggedIn: {},
      envKey: {},
      local: { ollama: { running: true, models: [] } },
      selected: null, // which AI the right pane shows
      busy: '',
      helper: scene === 'off' ? 'never' : scene === 'lost' ? 'stopped' : 'up',
      scanned: scene !== 'fresh' && scene !== 'off', // fresh: Pool still has to look around
      problem: null, // { title, text } — the last analyse failed on this connection
      justConnected: false,
      waiting: 3, // links in the add drawer, waiting to be analysed
      failedOnce: {}, // fail type -> true once it has failed (the retry succeeds)
    };
    if (scene === 'connected' || scene === 'broken' || scene === 'lost') {
      state.connection = { ai: 'claude', method: 'agent', model: 'Sonnet 5.5', at: '2 days ago' };
      state.installed.gemini = true;
      state.loggedIn.claude = true;
      state.local.ollama.models = ['gemma3:4b'];
    }
    if (scene === 'broken') {
      state.loggedIn.claude = false;
      state.problem = { short: 'logged out', title: 'Claude Code is logged out', text: 'The last analyse stopped at the first link — 3 links are still waiting. Log in again and they’ll pick up where they left off.' };
    }
  }

  function find(id) {
    return CATALOG.find(function (a) { return a.id === id; });
  }

  function methodOf(ai, id) {
    return ai.methods.find(function (m) { return m.id === id; }) || ai.methods[0];
  }

  // One status per AI, in plain words: what the helper can already see.
  function statusOf(ai) {
    if (state.connection && state.connection.ai === ai.id) return state.problem ? { tone: 'warn', text: 'Needs attention' } : { tone: 'on', text: 'Connected' };
    if (state.installed[ai.id]) return { tone: 'ready', text: 'Installed' };
    var local = state.local[ai.id];
    if (local && local.running) return local.models.length ? { tone: 'ready', text: 'Running' } : { tone: 'ready', text: 'Running · needs a model' };
    if (state.envKey[ai.id]) return { tone: 'ready', text: 'Key found' };
    return null;
  }

  function connLabel() {
    var c = state.connection;
    return c ? find(c.ai).name + ' · ' + c.model : '';
  }

  // ---- header pill (Q4: AI · model) -------------------------------------------

  function fillPill(slot) {
    slot.textContent = '';
    var c = state.connection;
    // Four faces, each readable without the colour: not connected (dashed, a
    // plus) · connected (dot, AI · model) · broken and Pool stopped (amber, an
    // alert icon and what's wrong in words). Every face opens the window.
    var face = !c ? 'is-off' : state.helper === 'stopped' || state.problem ? 'is-warn' : 'is-on';
    var text = !c ? 'Connect AI'
      : state.helper === 'stopped' ? 'Pool stopped'
      : state.problem ? find(c.ai).name + ' · ' + (state.problem.short || 'not answering')
      : connLabel();
    var lead = face === 'is-off' ? icon('plus', 'cp-pill-icon') : face === 'is-warn' ? icon('alert', 'cp-pill-icon') : el('span', { class: 'ai-dot', 'aria-hidden': 'true' });
    slot.appendChild(el('button', { class: 'btn btn-secondary cp-pill ' + face, type: 'button', title: face === 'is-warn' ? (state.helper === 'stopped' ? 'Pool needs to be running to analyse' : state.problem.title) : null, onclick: function (evt) {
      evt.stopPropagation();
      openConnect(c ? c.ai : null);
    } }, [lead, el('span', { class: 'ai-label', text: text })]));
  }

  function applyHeader() {
    Array.prototype.forEach.call(document.querySelectorAll('.ai-header'), function (slot) {
      if (!slot.querySelector('.cp-pill') || slot.dataset.cp !== stamp()) {
        slot.dataset.cp = stamp();
        fillPill(slot);
      }
    });
  }

  function stamp() {
    return (state.connection ? state.connection.ai + state.connection.model : 'off') + state.helper + (state.problem ? '!' : '');
  }

  function disconnect() {
    var label = connLabel();
    // Disconnecting doesn't log you out of the app: the guide lands on the step
    // you're actually at — Connect if you're still logged in, Log in if the
    // login was lost (a broken connection), install if it's gone.
    state.connection = null;
    state.problem = null;
    state.justConnected = false;
    applyHeader();
    rerender();
    UI.toast('Disconnected from ' + label + '. Your library is unchanged.');
  }

  // ---- modal shell -----------------------------------------------------------------
  //
  // One window, one shape, for the whole journey: the list of AIs on the left,
  // whatever this moment needs on the right. Starting Pool, the scan, a failed
  // check, the hand-off and a later repair all happen in the same right pane,
  // so the window is learnt once.

  var view = null; // the open modal's content root

  function onKey(evt) {
    if (!view) return;
    if (evt.key === 'Escape') return closeModal();
    if ((evt.key === 'ArrowDown' || evt.key === 'ArrowUp') && evt.target.closest && evt.target.closest('.cp-list') && !UI.isTyping(evt.target)) {
      evt.preventDefault();
      var rows = Array.prototype.slice.call(view.querySelectorAll('.cp-list button.cp-row'));
      var i = rows.indexOf(view.querySelector('.cp-row.is-selected')) + (evt.key === 'ArrowDown' ? 1 : -1);
      if (i < 0 || i >= rows.length) return;
      rows[i].click();
      var row = view.querySelectorAll('.cp-list button.cp-row')[i];
      if (row) row.focus();
    }
  }

  function closeModal() {
    var overlay = document.querySelector('.cp-overlay');
    if (overlay) overlay.remove();
    view = null;
    document.removeEventListener('keydown', onKey);
  }

  function openConnect(aiId) {
    closeModal();
    state.selected = aiId || (state.connection && state.connection.ai) || bestFound() || 'claude';
    view = el('div', { class: 'add-modal ai-modal cp-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Connect AI' });
    var overlay = el('div', { class: 'add-modal-overlay cp-overlay' }, [view]);
    overlay.addEventListener('click', function (evt) { if (evt.target === overlay) closeModal(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    rerender();
  }

  function closeX() {
    return el('button', { class: 'cp-x', type: 'button', 'aria-label': 'Close', onclick: closeModal }, [icon('close')]);
  }

  function monogram(ai, size) {
    return el('span', { class: 'cp-mark' + (size ? ' cp-mark-' + size : ''), 'aria-hidden': 'true', text: ai ? ai.mark : '…' });
  }

  function statusLine(st, cls) {
    return el('span', { class: cls + ' is-' + st.tone }, [el('span', { class: 'cp-status-dot', 'aria-hidden': 'true' }), st.text]);
  }

  function rerender() {
    applyHeader();
    renderBar();
    if (!view) return;
    view.textContent = '';
    view.className = 'add-modal ai-modal cp-modal';
    var phase = state.helper !== 'up' ? 'helper' : !state.scanned ? 'scan' : 'ready';
    // A search that hides the open AI moves the pane to the first one left.
    if (phase === 'ready' && state.selected !== 'other') {
      var shown = visible();
      if (shown.indexOf(state.selected) < 0) state.selected = shown.length ? shown[0] : 'other';
    }
    view.appendChild(head(phase));
    var pane = el('div', { class: 'cp-pane' });
    if (phase === 'helper') helperInto(pane);
    else if (phase === 'scan') scanInto(pane);
    else if (state.selected === 'other') otherPane(pane);
    else aiPane(pane, find(state.selected));
    // Before Pool runs there's nothing to choose yet, so no list: just the one
    // step, in a smaller window. The list arrives with the scan.
    if (phase === 'helper') {
      view.classList.add('is-single');
      view.appendChild(pane);
    } else {
      view.appendChild(el('div', { class: 'cp-split' }, [list(phase), pane]));
    }
    if (refocusSearch) {
      var q = view.querySelector('.cp-search');
      if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      refocusSearch = false;
    }
  }

  var refocusSearch = false;

  // The title line says where you stand, not what the window is called.
  function head(phase) {
    var c = state.connection;
    var title = phase === 'helper' ? (state.helper === 'stopped' ? 'Pool stopped running' : 'Connect an AI')
      : c ? 'AI for analysing' : 'Connect an AI';
    var lede = phase === 'helper' && state.helper === 'never' ? 'One thing first: Pool has to be running on this computer.'
      : phase === 'scan' ? 'Looking at what’s already on this computer…'
      : c && state.problem ? connLabel() + ' needs attention.'
      : c && state.helper === 'stopped' ? 'Still connected to ' + connLabel() + '.'
      : c ? ''
      : 'Pool uses an AI to write up each reference you capture. Pick one you already use.';
    return el('div', { class: 'cp-pane-head' }, [
      el('div', {}, [el('h2', { class: 'add-modal-title', text: title }), el('p', { class: 'ai-lede', text: lede })]),
      closeX(),
    ]);
  }

  // ---- the list --------------------------------------------------------------------
  //
  // Grouped by what Pool can see — In use · On this computer · More AIs ·
  // Something else — with a search box on top. While searching, the groups
  // stay, so a match still says whether it's already on this computer.

  var OTHER = { id: 'other', name: 'Something else', mark: '…', blurb: 'Any agent command, or an OpenAI-compatible server.' };

  function query() {
    return (state.query || '').trim().toLowerCase();
  }

  // What a search matched, beyond the AI's name: the app it runs through, or
  // the company behind its key. Shown on the row so "codex" → ChatGPT makes sense.
  function matchedVia(ai) {
    var q = query();
    if (!q || ai.name.toLowerCase().indexOf(q) >= 0) return '';
    var m = ai.methods.find(function (x) { return [x.app, x.provider].some(function (n) { return n && n.toLowerCase().indexOf(q) >= 0; }); });
    return m ? 'via ' + (m.app && m.app.toLowerCase().indexOf(q) >= 0 ? m.app : m.provider) : '';
  }

  function passesSearch(ai) {
    var q = query();
    return !q || ai.name.toLowerCase().indexOf(q) >= 0 || !!matchedVia(ai) || ai.blurb.toLowerCase().indexOf(q) >= 0;
  }

  function groups() {
    var c = state.connection;
    var inUse = [], here = [], more = [];
    CATALOG.filter(passesSearch).forEach(function (ai) {
      if (c && c.ai === ai.id) inUse.push(ai);
      else if (statusOf(ai)) here.push(ai);
      else more.push(ai);
    });
    here.sort(function (a, b) { return rank(a) - rank(b); });
    return [
      { label: 'In use', items: inUse },
      { label: 'On this computer', items: here },
      { label: c || here.length ? 'More AIs' : 'AIs', items: more },
    ].filter(function (g) { return g.items.length; });
  }

  function visible() {
    return CATALOG.filter(passesSearch).map(function (ai) { return ai.id; });
  }

  function rank(ai) {
    return state.installed[ai.id] ? 0 : state.envKey[ai.id] ? 1 : 2;
  }

  function bestFound() {
    var g = groups().find(function (x) { return x.label === 'On this computer'; });
    return g ? g.items[0].id : null;
  }

  function list(phase) {
    var root = el('div', { class: 'cp-list' + (phase !== 'ready' ? ' is-waiting' : ''), role: 'listbox', 'aria-label': 'AIs', 'aria-disabled': String(phase !== 'ready') });
    if (phase !== 'ready') {
      // While Pool looks, the list is there but quiet: plain catalogue
      // order, nothing to pick yet.
      CATALOG.concat([OTHER]).forEach(function (ai, i) {
        root.appendChild(el('div', { class: 'cp-row', style: '--i:' + i }, [
          monogram(ai), el('span', { class: 'cp-row-name', text: ai.name }),
          phase === 'scan' && ai !== OTHER ? el('span', { class: 'cp-row-status cp-row-looking', text: 'Looking…' }) : null,
        ]));
      });
      return root;
    }
    root.appendChild(searchBar());
    var gs = groups();
    if (!gs.length) {
      root.appendChild(el('div', { class: 'cp-empty' }, [
        el('p', { text: 'Nothing called “' + state.query.trim() + '”.' }),
        el('p', { class: 'cp-empty-hint', text: 'If it’s an agent that runs in a terminal, or a server that speaks the OpenAI format, add it under Something else.' }),
      ]));
    }
    gs.forEach(function (g) {
      root.appendChild(el('p', { class: 'cp-group', text: g.label }));
      g.items.forEach(function (ai) { row(ai, root); });
    });
    root.appendChild(otherFoot());
    return root;
  }

  // "Something else" is pinned to the foot of the list, always in reach.
  function otherFoot() {
    var foot = el('div', { class: 'cp-list-foot' });
    var on = state.selected === 'other';
    foot.appendChild(el('button', { class: 'cp-row' + (on ? ' is-selected' : ''), type: 'button', role: 'option', 'aria-selected': String(on), onclick: function () { state.selected = 'other'; rerender(); } }, [
      monogram(OTHER), el('span', { class: 'cp-row-name', text: OTHER.name }),
    ]));
    return foot;
  }

  // A row's second line is only ever news: what Pool found, or why a search
  // matched it. Otherwise the row is just the name.
  function row(ai, into) {
    var st = statusOf(ai);
    var via = matchedVia(ai);
    var on = state.selected === ai.id;
    return into.appendChild(el('button', {
      class: 'cp-row' + (on ? ' is-selected' : ''), type: 'button', role: 'option', 'aria-selected': String(on), tabindex: on ? '0' : '-1',
      onclick: function () { state.selected = ai.id; rerender(); },
    }, [
      monogram(ai),
      el('span', { class: 'cp-row-name', text: ai.name }),
      st ? statusLine(st, 'cp-row-status') : via ? el('span', { class: 'cp-row-status is-none', text: via }) : null,
    ]));
  }

  // ↓ from the box goes into the list; Enter opens the top match; Esc clears
  // the box before it closes the window.
  function searchBar() {
    var input = el('input', { class: 'add-modal-input cp-search', type: 'search', placeholder: window.matchMedia('(max-width: 720px)').matches ? 'Search' : 'Search AIs and apps', 'aria-label': 'Search AIs and apps', value: state.query || '', autocomplete: 'off', spellcheck: 'false' });
    input.addEventListener('input', function () { state.query = input.value; refocusSearch = true; rerender(); });
    input.addEventListener('keydown', function (evt) {
      var first = view.querySelector('.cp-list .cp-group + button.cp-row');
      if (evt.key === 'ArrowDown' && first) { evt.preventDefault(); first.click(); var r = view.querySelector('.cp-row.is-selected'); if (r) r.focus(); }
      else if (evt.key === 'Enter' && first) { evt.preventDefault(); first.click(); }
      else if (evt.key === 'Escape' && input.value) { evt.preventDefault(); evt.stopPropagation(); state.query = ''; refocusSearch = true; rerender(); }
    });
    return el('div', { class: 'cp-filter' }, [
      el('span', { class: 'cp-search-wrap' }, [icon('search', 'cp-search-icon'), input]),
    ]);
  }

  // ---- the pane: one AI ---------------------------------------------------------------

  function aiPane(pane, ai) {
    var st = statusOf(ai);
    pane.appendChild(el('div', { class: 'cp-ai-head' }, [
      monogram(ai, 'lg'),
      el('div', { class: 'cp-ai-head-text' }, [
        el('h3', { class: 'cp-pane-title', text: ai.name }),
        el('p', { class: 'ai-hint', text: ai.blurb }),
      ]),
      st ? statusLine(st, 'cp-badge') : null,
    ]));
    guideInto(pane, ai);
  }

  function otherPane(pane) {
    pane.appendChild(el('div', { class: 'cp-ai-head' }, [
      monogram(null, 'lg'),
      el('div', { class: 'cp-ai-head-text' }, [el('h3', { class: 'cp-pane-title', text: OTHER.name }), el('p', { class: 'ai-hint', text: OTHER.blurb })]),
    ]));
    otherInto(pane);
  }

  // ---- the pane: Pool has to be running -------------------------------------------
  //
  // 'never': the first start. The pool:// shortcut can't work yet, so the manual
  // step is the instruction, and finishing it flows straight on into the scan.
  // 'stopped': it ran before, so pool:// works. One button; the connection is
  // kept and named, so it doesn't feel like starting over.

  function helperInto(pane) {
    var status = el('div', { class: 'notice-slot' });
    if (state.helper === 'stopped') {
      var startBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Start Pool', onclick: function () {
        startBtn.disabled = true;
        UI.setNotice(status, 'info', { title: 'Starting Pool…', text: 'A Terminal window opens. Leave it open while you work.' });
        setTimeout(function () {
          state.helper = 'up';
          closeModal();
          applyHeader();
          UI.toast('Pool is running · still analysing with ' + connLabel() + '.');
        }, 1200);
      } });
      pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Start Pool again' }));
      pane.appendChild(hint('Its Terminal window was closed. Nothing’s lost — ' + connLabel() + ' is still your AI; Pool just needs to run to use it.'));
      pane.appendChild(el('div', { class: 'cp-helper-actions' }, [startBtn]));
      pane.appendChild(status);
      pane.appendChild(hint('Browsing your library works without it. Only adding and analysing need Pool running.'));
      return;
    }
    pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Start Pool once' }));
    pane.appendChild(hint('The very first time, by hand. After that, Connect AI starts it for you.'));
    pane.appendChild(el('ol', { class: 'ai-steps-list cp-steps' }, [
      helperStep(1, 'Open the Pool folder', 'The folder this library lives in — where this page’s file is.'),
      helperStep(2, 'Double-click “Start Pool”', '(“Start Pool.bat” on Windows.) A Terminal window opens and sets things up — about a minute the first time.'),
      helperStep(3, 'Leave that window open', 'This window notices on its own and carries on.', status),
    ]));
    UI.setNotice(status, 'info', { title: 'Waiting for Pool to start…' });
    pane.appendChild(el('p', { class: 'cp-proto-note' }, [
      el('button', { class: 'link-btn', type: 'button', text: 'Prototype: pretend I double-clicked it', onclick: function () {
        UI.setNotice(status, 'success', { title: 'Pool is running' });
        setTimeout(function () { state.helper = 'up'; state.scanned = false; rerender(); }, 600);
      } }),
    ]));
  }

  function helperStep(n, title, text, extra) {
    return el('li', { class: 'ai-step' }, [
      el('span', { class: 'ai-step-mark', 'aria-hidden': 'true', text: String(n) }),
      el('div', { class: 'ai-step-body' }, [el('p', { class: 'ai-step-title', text: title }), hint(text), extra || null]),
    ]);
  }

  // ---- the pane: the scan ----------------------------------------------------------
  //
  // A short beat where the three kinds of thing Pool looks for tick off, then
  // the list regroups and the best find is already open on the right — most
  // people are one click from connected.

  function scanInto(pane) {
    var kinds = ['Agent apps', 'Models running on this computer', 'API keys already set up'];
    pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Looking around' }));
    pane.appendChild(hint('Pool checks what you already have, so you don’t have to know.'));
    var rows = kinds.map(function (t) {
      return el('li', { class: 'cp-scan-row' }, [el('span', { class: 'cp-scan-dot', 'aria-hidden': 'true' }), t]);
    });
    pane.appendChild(el('ul', { class: 'cp-scan' }, rows));
    rows.forEach(function (r, i) { setTimeout(function () { r.classList.add('is-done'); }, 350 * (i + 1)); });
    setTimeout(function () {
      if (!view) return;
      state.scanned = true;
      state.selected = bestFound() || 'claude';
      rerender();
    }, 1400);
  }

  // ---- the guide itself (Q3) ----------------------------------------------------

  var chosenMethod = {}; // aiId -> methodId

  // Which way the guide opens on: what you picked, else what's connected, else the first.
  function currentMethod(ai) {
    var c = state.connection;
    var id = chosenMethod[ai.id] || (c && c.ai === ai.id ? c.method : null);
    return methodOf(ai, id);
  }

  function guideInto(root, ai) {
    var c = state.connection;
    var method = currentMethod(ai);
    if (ai.methods.length > 1) {
      root.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'How to connect' }, ai.methods.map(function (m) {
        return el('button', { class: 'ai-segment-btn', type: 'button', 'aria-pressed': String(m === method), text: m.id === 'key' ? 'API key' : m.label, onclick: function () { chosenMethod[ai.id] = m.id; rerender(); } });
      })));
    }

    var connectedHere = c && c.ai === ai.id && c.method === method.id;
    var guide = param('guide', GUIDES, 'A');
    // Once connected, the steps have done their job: the pane is just the
    // connection (model, Disconnect), and right after connecting, the links
    // waiting in a quieter box underneath.
    if (connectedHere) {
      root.appendChild(connectedBlock(ai, method));
      if (state.justConnected && !state.problem) root.appendChild(handoff());
      return;
    }

    var steps = method.id === 'agent' ? agentSteps(ai, method) : method.id === 'key' ? keySteps(ai, method) : localSteps(ai, method);
    var list = el('ol', { class: 'ai-steps-list cp-steps' });
    // The current step is the first unfinished one you can act on: a step
    // that's only a link (get a key) doesn't hold the primary button back from
    // the field where you paste it.
    var current = steps.findIndex(function (s) { return !s.done && s.actions && s.actions.length; });
    if (current < 0) current = steps.findIndex(function (s) { return !s.done; });
    steps.forEach(function (s, i) {
      list.appendChild(renderStep(i + 1, s, guide, i === current));
    });
    root.appendChild(list);
  }

  var reopened = {}; // ai id -> its app was opened to log in again (repair)
  var modelSaved = null; // model just switched to, confirmed once in the pane

  // The whole guide is replaced by the connection: which model, and Disconnect.
  function connectedBlock(ai, method) {
    var c = state.connection;
    var models = method.id === 'local' ? state.local[ai.id].models : method.models;
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, (method.id === 'agent' ? ['Its own default'] : []).concat(models).map(function (m) {
      return el('option', { value: m, text: m });
    }));
    select.value = c.model;
    var save = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Use this model', disabled: true });
    select.addEventListener('change', function () { save.disabled = select.value === c.model; });
    var status = el('div', { class: 'notice-slot' });
    save.addEventListener('click', function () {
      save.disabled = true;
      UI.setNotice(status, 'info', { title: 'Checking it answers…' });
      setTimeout(function () {
        c.model = select.value;
        modelSaved = c.model;
        rerender();
        // The header button changes too — make that visible for a moment.
        Array.prototype.forEach.call(document.querySelectorAll('.cp-pill'), function (p) { p.classList.add('is-updated'); });
      }, 900);
    });
    var fixStatus = el('div', { class: 'notice-slot' });
    if (state.problem) {
      var check = el('button', { class: 'btn', type: 'button', text: 'I’ve logged in — check again', onclick: function () {
        check.disabled = true;
        UI.setNotice(fixStatus, 'info', { title: 'Checking ' + method.app + ' answers…' });
        setTimeout(function () { state.problem = null; state.loggedIn[ai.id] = true; state.justConnected = true; rerender(); }, 1000);
      } });
      return el('div', { class: 'cp-connected is-warn' }, [
        UI.notice('warning', { title: state.problem.title, text: state.problem.text }),
        el('ol', { class: 'ai-steps-list cp-steps' }, [
          renderStep(1, { title: 'Log in to ' + method.app + ' again', body: [hint('Logins expire now and then. Your model choice and library are kept.')], actions: [
            el('button', { class: 'btn', type: 'button', text: 'Open ' + method.app + ' to log in', onclick: function () {
              UI.toast('Prototype: ' + method.app + ' opened in a Terminal window.');
              reopened[ai.id] = true;
              rerender();
            } }),
          ] }, 'A', !reopened[ai.id]),
          renderStep(2, { title: 'Check it answers', alsoOpen: true, body: [], actions: [check], status: fixStatus }, 'A', !!reopened[ai.id]),
        ]),
        el('div', { class: 'cp-connected-foot' }, [
          el('button', { class: 'btn btn-secondary btn-sm btn-danger-quiet', type: 'button', text: 'Disconnect', onclick: disconnect }),
        ]),
      ]);
    }
    // A model change confirms where you made it, then once is enough.
    var saved = modelSaved && UI.notice('success', { title: 'Now using ' + modelSaved, text: 'Your next analyses use it.' });
    modelSaved = null;
    if (saved) status.appendChild(saved);
    var block = el('div', { class: 'cp-connected' }, [
      el('div', { class: 'cp-connected-head' }, [
        el('span', { class: 'ai-success-mark cp-ok', 'aria-hidden': 'true' }, [icon('check')]),
        el('div', {}, [
          el('p', { class: 'cp-connected-title', text: 'Connected · ' + connLabel() }),
          el('p', { class: 'ai-hint', text: (method.id === 'agent' ? 'Through ' + method.app + ' on this computer' : method.id === 'key' ? 'With your ' + method.provider + ' API key' : 'Running on this computer') + ' · since ' + c.at }),
        ]),
      ]),
      el('label', { class: 'add-modal-label', text: 'Model' }),
      el('div', { class: 'ai-row' }, [select, save]),
      status,
      el('div', { class: 'cp-connected-foot' }, [
        el('button', { class: 'btn btn-secondary btn-sm btn-danger-quiet', type: 'button', text: 'Disconnect', onclick: disconnect }),
      ]),
    ]);
    return block;
  }

  // A step: { title, doneTitle, done, body: [nodes], actions: [buttons], always: [nodes kept when done] }
  function renderStep(n, s, guide, isCurrent) {
    // One primary button in the pane: the current step's first action — the
    // next thing to do. Everything else that's on show is secondary.
    (s.actions || []).forEach(function (b, i) {
      b.classList.remove('btn-primary', 'btn-secondary');
      b.classList.add(isCurrent && i === 0 ? 'btn-primary' : 'btn-secondary');
    });
    var mark = el('span', { class: 'ai-step-mark', 'aria-hidden': 'true' }, s.done ? [icon('check')] : [String(n)]);
    var li = el('li', { class: 'ai-step' + (s.done ? ' is-done' : '') + (guide === 'A' && !s.done && !isCurrent && !s.alsoOpen ? ' is-later' : '') });
    var body = el('div', { class: 'ai-step-body' });
    if (guide === 'A') {
      if (s.done) {
        body.appendChild(el('p', { class: 'ai-step-title', text: s.doneTitle || s.title }));
      } else if (isCurrent || s.alsoOpen) {
        body.appendChild(el('p', { class: 'ai-step-title', text: s.title }));
        (s.body || []).forEach(function (b) { body.appendChild(b); });
        if (s.actions && s.actions.length) body.appendChild(el('div', { class: 'ai-row' }, s.actions));
        if (s.status) body.appendChild(s.status);
      } else {
        body.appendChild(el('p', { class: 'ai-step-title', text: s.title }));
      }
    } else {
      body.appendChild(el('p', { class: 'ai-step-title', text: s.done ? (s.doneTitle || s.title) : s.title }));
      (s.done ? s.always || [] : s.body || []).forEach(function (b) { body.appendChild(b); });
      if (!s.done && s.actions && s.actions.length) body.appendChild(el('div', { class: 'ai-row' }, s.actions));
      if (s.status) body.appendChild(s.status);
    }
    li.appendChild(mark);
    li.appendChild(body);
    return li;
  }

  function hint(text) { return el('p', { class: 'ai-hint', text: text }); }

  // What a failed check says, per way of connecting. Every one names what
  // happened, then the single thing to do; the retry is always the same button.
  function failureFor(type, ai, m) {
    var who = m.app || m.provider || m.label;
    var F = {
      login: m.id === 'agent' ? { title: who + ' isn’t logged in', text: 'Open it, log in with your ' + (m.label.replace(/ subscription| account/i, '') || ai.name) + ' account, then press Connect again.' } : null, // step 2 already holds the "Open … to log in" button
      key: m.id === 'key' ? { title: m.provider + ' didn’t accept that key', text: 'Check you copied all of it, with nothing extra on either end. Still failing? Make a new one.',
        actions: [{ label: 'Make a new key', run: function () {} }] } : null,
      vision: m.id !== 'agent' ? { title: 'That model can’t see images', text: 'Pool reads screenshots, so it needs a model that can see them. ' + (m.id === 'local' ? 'Download one of the recommended ones above.' : 'Pick another model and try again.') } : null,
      slow: { title: who + ' didn’t answer within a minute', text: m.id === 'agent' ? 'It may be updating, or waiting on a question in its own window. Check it, then try again.' : 'The service may be busy. Try again in a moment.' },
      plan: m.id === 'agent' ? { title: 'Your ' + ai.name + ' plan doesn’t include ' + who, text: 'It needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1) + ' Or connect with an API key instead.',
        actions: ai.methods.some(function (x) { return x.id === 'key'; }) ? [{ label: 'Use an API key instead', run: function () { chosenMethod[ai.id] = 'key'; rerender(); } }] : [] }
        : m.id === 'key' ? { title: 'Your ' + m.provider + ' account has no credit', text: 'Keys only work once billing is set up. Add a payment method, then try again.' } : null,
    };
    return F[type] || F.slow;
  }

  function fakeConnect(ai, method, model, status, button) {
    button.disabled = true;
    UI.setNotice(status, 'info', { title: method.id === 'agent' ? 'Checking ' + (method.app || ai.name) + ' answers…' : 'Checking it can see images…', text: method.id === 'agent' ? 'This can take up to a minute.' : null });
    var fail = param('fail', FAILS, 'none');
    setTimeout(function () {
      if (fail !== 'none' && !state.failedOnce[fail]) {
        state.failedOnce[fail] = true;
        var f = failureFor(fail, ai, method);
        UI.setNotice(status, 'error', { title: f.title, text: f.text, actions: f.actions });
        status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        button.disabled = false;
        button.textContent = 'Try again';
        return;
      }
      state.connection = { ai: ai.id, method: method.id, model: model, at: 'just now' };
      state.problem = null;
      state.justConnected = true;
      if (method.id === 'agent') state.loggedIn[ai.id] = true;
      rerender();
    }, 1200);
  }

  // The end of the journey isn't "Connected", it's "your links are being
  // analysed" — offered in a quieter box under the connection, not instead of it.
  function handoff() {
    var n = state.waiting;
    var label = connLabel();
    var done = function () { state.justConnected = false; closeModal(); };
    return el('div', { class: 'cp-handoff' }, [
      el('p', { class: 'cp-handoff-text', text: n ? n + ' link' + (n === 1 ? ' is' : 's are') + ' waiting to be analysed.' : 'Add a link, then press Analyse.' }),
      el('div', { class: 'cp-handoff-actions' }, n ? [
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Analyse ' + n + ' link' + (n === 1 ? '' : 's'), onclick: function () {
          done();
          UI.toast('Analysing ' + n + ' links with ' + label + '…');
        } }),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Later', onclick: done }),
      ] : [
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Add a link', onclick: done }),
      ]),
    ]);
  }

  function agentSteps(ai, m) {
    var installed = !!state.installed[ai.id];
    var connected = state.connection && state.connection.ai === ai.id && state.connection.method === 'agent';
    var connectStatus = el('div', { class: 'notice-slot' });
    var connectBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect', onclick: function () {
      fakeConnect(ai, m, m.models[1] || m.models[0] || 'Its own default', connectStatus, connectBtn);
    } });
    var installBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Install ' + m.app, onclick: function () {
      installBtn.disabled = true;
      installBtn.textContent = 'Installing in a Terminal window…';
      setTimeout(function () { state.installed[ai.id] = true; rerender(); }, 1200);
    } });
    var loginBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Open ' + m.app + ' to log in', onclick: function () {
      state.loggedIn[ai.id] = true;
      rerender();
    } });
    return [
      { title: 'Install ' + m.app, doneTitle: m.app + ' is installed', done: installed,
        body: [hint(m.app + ' is the free app Pool talks to' + (m.app === m.label ? '.' : ' — it uses your ' + m.label.replace(/ (\w)/, function (x) { return x.toLowerCase(); }) + '.'))],
        actions: [installBtn] },
      { title: 'Log in to ' + m.app, doneTitle: (connected ? 'Logged in to ' : 'Still logged in to ') + m.app, done: installed && (connected || !!state.loggedIn[ai.id]),
        alsoOpen: installed, // logging in can't be checked: show it next to Connect
        body: [hint('Needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1) + ' Already logged in? Just press Connect.')],
        actions: installed ? [loginBtn] : [],
        always: [hint('Needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1))] },
      { title: 'Connect', doneTitle: 'Connected', done: connected,
        alsoOpen: installed,
        body: [hint('Pool checks ' + m.app + ' answers. Then you can analyse.')],
        actions: installed ? [connectBtn] : [],
        status: connectStatus },
    ];
  }

  function keySteps(ai, m) {
    var connected = state.connection && state.connection.ai === ai.id && state.connection.method === 'key';
    var status = el('div', { class: 'notice-slot' });
    var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', placeholder: 'Paste your API key', 'aria-label': 'API key' });
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model', hidden: 'hidden' }, m.models.map(function (x) { return el('option', { value: x, text: x }); }));
    var btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Check key', disabled: true });
    key.addEventListener('input', function () { if (select.hidden) btn.disabled = !key.value.trim(); });
    btn.addEventListener('click', function () {
      if (select.hidden) {
        btn.disabled = true;
        UI.setNotice(status, 'info', { title: 'Checking the key…' });
        setTimeout(function () { UI.setNotice(status, null); select.hidden = false; btn.disabled = false; btn.textContent = 'Connect'; }, 700);
      } else {
        fakeConnect(ai, m, select.value, status, btn);
      }
    });
    return [
      // Both steps open from the start: someone with a key ready pastes it
      // straight away, without touching step 1.
      { title: 'Get an API key from ' + m.provider, doneTitle: 'You have an API key', done: connected || !!state.envKey[ai.id],
        alsoOpen: true,
        body: [el('p', { class: 'ai-hint' }, [el('a', { class: 'ext-link', href: '#', onclick: function (e) { e.preventDefault(); } }, ['Get a key', icon('external')]), ' — already have one? Paste it below.'])] },
      { title: 'Paste it and pick a model', doneTitle: 'Key saved · model chosen', done: connected,
        alsoOpen: true,
        body: [el('div', { class: 'ai-row' }, [key]), el('div', { class: 'ai-row' }, [select]), hint('Kept in your Mac’s Keychain, never in the library folder or the browser.')],
        actions: [btn], status: status },
    ];
  }

  function localSteps(ai, m) {
    var local = state.local[ai.id] || { running: false, models: [] };
    var connected = state.connection && state.connection.ai === ai.id;
    var status = el('div', { class: 'notice-slot' });
    var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, local.models.map(function (x) { return el('option', { value: x, text: x }); }));
    var connectBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect', onclick: function () { fakeConnect(ai, m, select.value, status, connectBtn); } });
    var openBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'I’ve opened it — check again', onclick: function () {
      state.local[ai.id] = { running: true, models: [] };
      rerender();
    } });
    var pullBtns = m.pull.map(function (name, i) {
      return el('button', { class: 'btn ' + (i === 0 ? 'btn-primary' : 'btn-secondary'), type: 'button', text: 'Download ' + name + (i === 0 ? ' (recommended)' : ''), onclick: function (e) {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = 'Downloading in a Terminal window…';
        setTimeout(function () { state.local[ai.id].models = [name + ':latest']; rerender(); }, 1200);
      } });
    });
    return [
      { title: 'Install and open ' + m.label, doneTitle: m.label + ' is running', done: local.running,
        body: [el('p', { class: 'ai-hint' }, [el('a', { class: 'ext-link', href: '#', onclick: function (e) { e.preventDefault(); } }, ['Download ' + m.label, icon('external')]), ' — free.'])],
        actions: [openBtn] },
      { title: 'Download a model that can see images', doneTitle: 'You have a model that can see images', done: local.models.length > 0,
        body: [hint('A few GB, once. Pool needs a model that can read screenshots.')],
        actions: pullBtns },
      { title: 'Choose it and connect', doneTitle: 'Connected', done: !!connected,
        body: local.models.length ? [el('div', { class: 'ai-row' }, [select])] : [],
        actions: [connectBtn], status: status },
    ];
  }

  // ---- something else: one form at a time, one primary button ---------------------

  var otherKind = 'agent';

  function otherInto(root) {
    root.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'Kind' }, [
      ['agent', 'Agent command'], ['server', 'OpenAI-compatible server'],
    ].map(function (k) {
      return el('button', { class: 'ai-segment-btn', type: 'button', 'aria-pressed': String(otherKind === k[0]), text: k[1], onclick: function () { otherKind = k[0]; rerender(); } });
    })));
    var form = el('div', { class: 'cp-other' });
    if (otherKind === 'agent') {
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Command' }));
      form.appendChild(el('input', { class: 'add-modal-input ai-mono', type: 'text', placeholder: 'my-agent --headless -p' }));
      form.appendChild(hint('It must run without asking questions. Pool adds its instructions as the last argument.'));
    } else {
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Server address' }));
      form.appendChild(el('input', { class: 'add-modal-input ai-mono', type: 'url', placeholder: 'https://…/v1' }));
      form.appendChild(el('label', { class: 'add-modal-label', text: 'Model' }));
      form.appendChild(el('input', { class: 'add-modal-input ai-mono', type: 'text', placeholder: 'Model name' }));
      form.appendChild(el('label', { class: 'add-modal-label', text: 'API key (optional)' }));
      form.appendChild(el('input', { class: 'add-modal-input ai-mono', type: 'password', placeholder: 'Only if the server needs one' }));
    }
    form.appendChild(el('div', { class: 'add-modal-actions' }, [el('button', { class: 'btn btn-primary', type: 'button', text: 'Connect', onclick: function () { UI.toast('Prototype: custom connections aren’t stubbed.'); } })]));
    root.appendChild(form);
  }

  // ---- switcher bar ------------------------------------------------------------------

  var bar = null;

  function renderBar() {
    if (bar) bar.remove();
    var guide = param('guide', GUIDES, 'A');
    var scene = param('scene', SCENES, 'fresh');
    function chip(key, value, label, current) {
      return el('button', { type: 'button', class: current === value ? 'is-on' : '', text: label, onclick: function () {
        setParam(key, value);
        if (key === 'scene') loadScene(value);
        rerender();
      } });
    }
    bar = el('div', { class: 'proto-bar', role: 'toolbar', 'aria-label': 'Prototype variants' }, [
      el('span', { class: 'proto-bar-label', text: 'Guide' }),
      chip('guide', 'A', 'Fold', guide),
      chip('guide', 'B', 'Open', guide),
      el('span', { class: 'proto-bar-sep' }),
      el('button', { type: 'button', class: 'proto-bar-journey', text: 'Journey ' + (journeyAt >= 0 ? (journeyAt + 1) + '/' + JOURNEY.length : '…'), onclick: function (evt) { evt.stopPropagation(); openJourney(); } }),
      el('span', { class: 'proto-bar-sep' }),
      el('label', { class: 'proto-bar-label' }, ['State ', select('scene', SCENES, scene)]),
      el('label', { class: 'proto-bar-label' }, ['Check ', select('fail', FAILS, param('fail', FAILS, 'none'))]),
      el('span', { class: 'proto-bar-sep' }),
      el('button', { type: 'button', text: 'Open Connect', onclick: function () { openConnect(); } }),
    ]);
    function select(key, options, current) {
      var sel = el('select', { class: 'proto-bar-select', 'aria-label': key }, Object.keys(options).map(function (k) {
        return el('option', { value: k, text: options[k] });
      }));
      sel.value = current;
      sel.addEventListener('change', function () {
        setParam(key, sel.value);
        journeyAt = -1;
        if (key === 'scene') loadScene(sel.value);
        else state.failedOnce = {};
        rerender();
      });
      return sel;
    }
    document.body.appendChild(bar);
  }

  // ---- journey walkthrough ---------------------------------------------------------

  var journeyAt = -1;

  function playMoment(i) {
    var m = JOURNEY[i];
    journeyAt = i;
    setParam('scene', m.scene);
    setParam('fail', m.fail);
    loadScene(m.scene);
    closeModal();
    rerender();
    if (m.scene === 'broken') {
      // This moment starts in the library, not the window: the pill is the signal.
      UI.toast('An analyse just stopped. Look at the AI button in the header.', { tone: 'warning' });
      return;
    }
    if (m.scene === 'lost') return UI.toast('Pool’s Terminal window was closed. Try adding a link, or click the header button.');
    openConnect(m.open);
  }

  function openJourney() {
    var open = document.querySelector('.cp-journey');
    if (open) return open.remove();
    document.body.appendChild(el('div', { class: 'popover cp-journey', role: 'dialog', 'aria-label': 'Journey' }, [
      el('p', { class: 'popover-eyebrow', text: 'Connect AI · the whole journey' }),
      el('ol', { class: 'cp-journey-list' }, JOURNEY.map(function (m, i) {
        return el('li', {}, [el('button', { class: 'cp-journey-item' + (i === journeyAt ? ' is-on' : ''), type: 'button', onclick: function () { openJourney(); playMoment(i); } }, [
          el('span', { class: 'cp-journey-n', text: String(i + 1) }),
          el('span', {}, [el('span', { class: 'cp-journey-title', text: m.title }), el('span', { class: 'cp-journey-what', text: m.what })]),
        ])]);
      })),
    ]));
  }

  document.addEventListener('keydown', function (evt) {
    if (UI.isTyping(evt.target) || !bar) return;
    if (evt.key === ']' || evt.key === '[') return playMoment(Math.max(0, Math.min(JOURNEY.length - 1, journeyAt + (evt.key === ']' ? 1 : -1))));
  });

  // ---- wiring ------------------------------------------------------------------

  // The real ai-panel.js header must not open the real Connect window.
  window.LibraryAI && (window.LibraryAI.openConnect = function () { openConnect(); });

  loadScene(param('scene', SCENES, 'fresh'));
  new MutationObserver(applyHeader).observe(document.getElementById('app'), { childList: true, subtree: true });
  applyHeader();
  renderBar();
  openConnect();
})();
