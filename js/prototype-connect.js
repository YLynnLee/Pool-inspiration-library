// PROTOTYPE — throwaway, lives only on prototype/connect-ai.
// Answers three questions about the Connect AI window, inside the real app:
//   ?look=A|B|C     visual direction (Q5): strict DESIGN.md / new elements / two-pane redesign
//   ?guide=A|B      what a guide shows once steps are done (Q3): folded / open with buttons hidden
//   ?scene=fresh|connected   which stub state the computer is in
// The header pill shows the proposed "AI · model" naming (Q4).
// Active only when the URL has ?cproto. Everything runs on in-memory stub
// state: nothing is installed, connected, saved or sent anywhere.
(function () {
  'use strict';

  if (!new URLSearchParams(window.location.search).has('cproto')) return;

  var UI = window.UI;
  var el = UI.el;
  var icon = UI.icon;

  var LOOKS = { A: 'Strict system', B: 'New elements', C: 'Two-pane' };
  var GUIDES = { A: 'Done steps fold', B: 'Steps open, buttons hidden' };
  var SCENES = { fresh: 'Not connected yet', connected: 'Connected to Claude' };

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
    state = {
      connection: null, // { ai, method, model, at }
      installed: { claude: true, opencode: true },
      loggedIn: {},
      envKey: {},
      local: { ollama: { running: true, models: [] } },
      selected: null, // look C: which AI the right pane shows
      busy: '',
    };
    if (scene === 'connected') {
      state.connection = { ai: 'claude', method: 'agent', model: 'Sonnet 5.5', at: '2 days ago' };
      state.installed.gemini = true;
      state.loggedIn.claude = true;
      state.local.ollama.models = ['gemma3:4b'];
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
    if (state.connection && state.connection.ai === ai.id) return { tone: 'on', text: 'Connected' };
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
    var btn = el('button', { class: 'btn btn-secondary cp-pill', type: 'button', onclick: function (evt) {
      evt.stopPropagation();
      if (c) openMenu(evt.currentTarget); else openConnect();
    } }, c ? [
      el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'ai-label', text: connLabel() }),
      icon('chevron', 'ai-chevron'),
    ] : [el('span', { class: 'ai-dot is-off', 'aria-hidden': 'true' }), 'Connect AI']);
    slot.appendChild(btn);
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
    return state.connection ? state.connection.ai + state.connection.model : 'off';
  }

  function openMenu(trigger) {
    var c = state.connection;
    var ai = find(c.ai);
    var m = methodOf(ai, c.method);
    var body = el('div', { class: 'ai-menu' }, [
      el('p', { class: 'popover-eyebrow', text: 'AI for analysing' }),
      el('div', { class: 'ai-menu-current' }, [
        el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
        el('div', {}, [
          el('p', { class: 'ai-menu-name', text: connLabel() }),
          el('p', { class: 'ai-menu-meta', text: (m.id === 'agent' ? m.label + ' · through ' + m.app : m.id === 'key' ? m.provider + ' API key' : 'On this computer') + ' · connected ' + c.at }),
        ]),
      ]),
      el('div', { class: 'ai-menu-actions' }, [
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Model…', onclick: function () { UI.closePopover(); openConnect(ai.id); } }),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Switch AI…', onclick: function () { UI.closePopover(); openConnect(); } }),
        el('button', { class: 'btn btn-secondary btn-sm btn-danger-quiet', type: 'button', text: 'Disconnect', onclick: function () { UI.closePopover(); disconnect(); } }),
      ]),
    ]);
    UI.popover(trigger, body);
  }

  function disconnect() {
    var label = connLabel();
    state.connection = null;
    applyHeader();
    rerender();
    UI.toast('Disconnected from ' + label + '. Your library is unchanged.');
  }

  // ---- modal shell -----------------------------------------------------------------

  var view = null; // the open modal's content root
  var route = null; // { aiId, methodId } or null for the grid / 'other'

  function onKey(evt) {
    if (evt.key === 'Escape' && view) closeModal();
  }

  function closeModal() {
    var overlay = document.querySelector('.cp-overlay');
    if (overlay) overlay.remove();
    view = null;
    document.removeEventListener('keydown', onKey);
  }

  function openConnect(aiId) {
    closeModal();
    var look = param('look', LOOKS, 'A');
    route = aiId ? { aiId: aiId } : null;
    if (look === 'C') state.selected = aiId || (state.connection && state.connection.ai) || firstReady() || 'claude';
    view = el('div', { class: 'add-modal ai-modal cp-modal cp-look-' + look, role: 'dialog', 'aria-modal': 'true' });
    var overlay = el('div', { class: 'add-modal-overlay cp-overlay' }, [view]);
    overlay.addEventListener('click', function (evt) { if (evt.target === overlay) closeModal(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    rerender();
  }

  function firstReady() {
    var ai = CATALOG.find(function (a) { return statusOf(a); });
    return ai && ai.id;
  }

  function rerender() {
    applyHeader();
    renderBar();
    if (!view) return;
    var look = param('look', LOOKS, 'A');
    view.className = 'add-modal ai-modal cp-modal cp-look-' + look;
    view.textContent = '';
    if (look === 'C') return renderTwoPane();
    if (route && route.aiId === 'other') return renderOtherPage(look);
    if (route) return renderGuidePage(find(route.aiId), look);
    renderGrid(look);
  }

  function closeX() {
    return el('button', { class: 'cp-x', type: 'button', 'aria-label': 'Close', onclick: closeModal }, [icon('close')]);
  }

  function bottomClose() {
    return el('div', { class: 'add-modal-actions' }, [el('button', { class: 'btn btn-secondary', type: 'button', text: 'Close', onclick: closeModal })]);
  }

  function monogram(ai, size) {
    return el('span', { class: 'cp-mark' + (size ? ' cp-mark-' + size : ''), 'aria-hidden': 'true', text: ai ? ai.mark : '…' });
  }

  function statusLine(st, cls) {
    if (!st) return el('span', { class: cls || 'cp-status is-none', text: 'Not set up' });
    return el('span', { class: (cls || 'cp-status') + ' is-' + st.tone }, [el('span', { class: 'cp-status-dot', 'aria-hidden': 'true' }), st.text]);
  }

  // ---- grid (looks A and B) -----------------------------------------------------

  function renderGrid(look) {
    if (look === 'B') view.appendChild(closeX());
    var c = state.connection;
    view.appendChild(el('h2', { class: 'add-modal-title', text: c ? 'Switch AI' : 'Connect an AI' }));
    view.appendChild(el('p', { class: 'ai-lede', text: c
      ? 'Analysing with ' + connLabel() + '. Picking another replaces it — your library stays as it is.'
      : 'Pool uses an AI to look at what you capture and write up each reference. Pick one you already use.' }));

    if (look === 'B' && c) {
      var ai = find(c.ai);
      view.appendChild(el('div', { class: 'cp-current' }, [
        monogram(ai, 'lg'),
        el('div', { class: 'cp-current-text' }, [
          el('p', { class: 'cp-current-name', text: connLabel() }),
          el('p', { class: 'cp-current-meta', text: methodOf(ai, c.method).label + ' · connected ' + c.at }),
        ]),
        el('button', { class: 'btn btn-secondary btn-sm', type: 'button', text: 'Manage', onclick: function () { go(ai.id); } }),
      ]));
      view.appendChild(el('p', { class: 'cp-eyebrow', text: 'Or switch to' }));
    }

    var grid = el('div', { class: 'ai-grid cp-grid' });
    CATALOG.forEach(function (ai) {
      if (look === 'B' && c && c.ai === ai.id) return;
      var st = statusOf(ai);
      grid.appendChild(el('button', { class: 'ai-card cp-card' + (st && st.tone === 'on' ? ' is-connected' : ''), type: 'button', onclick: function () { go(ai.id); } }, [
        look === 'B' ? el('span', { class: 'cp-card-top' }, [monogram(ai), st ? statusLine(st, 'cp-badge') : null]) : null,
        el('span', { class: 'ai-card-name', text: ai.name }),
        el('span', { class: 'cp-card-blurb', text: ai.blurb }),
        look === 'A' ? statusLine(st) : el('span', { class: 'cp-card-ways', text: ways(ai) }),
      ]));
    });
    grid.appendChild(el('button', { class: 'ai-card cp-card', type: 'button', onclick: function () { go('other'); } }, [
      look === 'B' ? el('span', { class: 'cp-card-top' }, [monogram(null)]) : null,
      el('span', { class: 'ai-card-name', text: 'Something else' }),
      el('span', { class: 'cp-card-blurb', text: 'Any agent command, or an OpenAI-compatible server.' }),
      look === 'A' ? el('span', { class: 'cp-status is-none', text: '' }) : el('span', { class: 'cp-card-ways', text: 'Advanced' }),
    ]));
    view.appendChild(grid);
    if (look === 'A') view.appendChild(bottomClose());
  }

  function ways(ai) {
    return ai.methods.map(function (m) {
      return m.id === 'agent' ? (/subscription|account/i.test(m.label) ? 'Subscription' : 'Agent app') : m.id === 'key' ? 'API key' : 'Free · on this computer';
    }).join(' · ');
  }

  function go(aiId) {
    route = { aiId: aiId };
    rerender();
  }

  function backLink() {
    return el('button', { class: 'link-btn ai-back', type: 'button', onclick: function () { route = null; rerender(); } }, [icon('back'), 'All AIs']);
  }

  // ---- one AI's guide page (looks A and B) ------------------------------------

  function renderGuidePage(ai, look) {
    if (look === 'B') view.appendChild(closeX());
    view.appendChild(backLink());
    view.appendChild(look === 'B'
      ? el('div', { class: 'cp-guide-head' }, [monogram(ai, 'lg'), el('div', {}, [el('h2', { class: 'add-modal-title', text: ai.name }), el('p', { class: 'ai-hint', text: ai.blurb })])])
      : el('h2', { class: 'add-modal-title', text: ai.name }));
    guideInto(view, ai);
    if (look === 'A') view.appendChild(bottomClose());
  }

  function renderOtherPage(look) {
    if (look === 'B') view.appendChild(closeX());
    view.appendChild(backLink());
    view.appendChild(el('h2', { class: 'add-modal-title', text: 'Something else' }));
    otherInto(view);
    if (look === 'A') view.appendChild(bottomClose());
  }

  // ---- two-pane (look C) ------------------------------------------------------------

  function renderTwoPane() {
    view.appendChild(el('div', { class: 'cp-pane-head' }, [
      el('div', {}, [
        el('h2', { class: 'add-modal-title', text: state.connection ? 'AI for analysing' : 'Connect an AI' }),
        el('p', { class: 'ai-lede', text: state.connection ? 'Analysing with ' + connLabel() + '.' : 'Pool uses an AI to write up each reference you capture. Pick one you already use.' }),
      ]),
      closeX(),
    ]));
    var list = el('div', { class: 'cp-list', role: 'listbox', 'aria-label': 'AIs' });
    CATALOG.concat([{ id: 'other', name: 'Something else', mark: '…', blurb: '' }]).forEach(function (ai) {
      var st = ai.id === 'other' ? null : statusOf(ai);
      list.appendChild(el('button', { class: 'cp-row' + (state.selected === ai.id ? ' is-selected' : ''), type: 'button', role: 'option', 'aria-selected': String(state.selected === ai.id), onclick: function () { state.selected = ai.id; rerender(); } }, [
        el('span', { class: 'cp-mark', 'aria-hidden': 'true', text: ai.mark }),
        el('span', { class: 'cp-row-name', text: ai.name }),
        st ? statusLine(st, 'cp-row-status') : null,
      ]));
    });
    var pane = el('div', { class: 'cp-pane' });
    if (state.selected === 'other') {
      pane.appendChild(el('h3', { class: 'cp-pane-title', text: 'Something else' }));
      otherInto(pane);
    } else {
      var ai = find(state.selected);
      pane.appendChild(el('h3', { class: 'cp-pane-title', text: ai.name }));
      pane.appendChild(el('p', { class: 'ai-hint', text: ai.blurb }));
      guideInto(pane, ai);
    }
    view.appendChild(el('div', { class: 'cp-split' }, [list, pane]));
  }

  // ---- the guide itself (Q3) ----------------------------------------------------

  var chosenMethod = {}; // aiId -> methodId

  function guideInto(root, ai) {
    var c = state.connection;
    var method = methodOf(ai, chosenMethod[ai.id] || (c && c.ai === ai.id ? c.method : null));
    if (ai.methods.length > 1) {
      root.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'How to connect' }, ai.methods.map(function (m) {
        return el('button', { class: 'ai-segment-btn', type: 'button', 'aria-pressed': String(m === method), text: m.id === 'key' ? 'API key' : m.label, onclick: function () { chosenMethod[ai.id] = m.id; rerender(); } });
      })));
    }
    if (c && c.ai !== ai.id) root.appendChild(el('p', { class: 'ai-hint cp-replaces', text: 'Connecting this replaces ' + connLabel() + '.' }));

    var connectedHere = c && c.ai === ai.id && c.method === method.id;
    var guide = param('guide', GUIDES, 'A');
    if (connectedHere && guide === 'A') return root.appendChild(connectedBlock(ai, method, true));

    var steps = method.id === 'agent' ? agentSteps(ai, method) : method.id === 'key' ? keySteps(ai, method) : localSteps(ai, method);
    var list = el('ol', { class: 'ai-steps-list cp-steps' });
    var currentFound = false;
    steps.forEach(function (s, i) {
      var isCurrent = !s.done && !currentFound;
      if (isCurrent) currentFound = true;
      list.appendChild(renderStep(i + 1, s, guide, isCurrent));
    });
    root.appendChild(list);
    if (connectedHere) root.appendChild(connectedBlock(ai, method, false));
  }

  // Q3 / guide A: the whole guide is replaced by the connection's status.
  // guide B: shown under the (open) steps instead of a Connect button.
  function connectedBlock(ai, method, withSetup) {
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
      setTimeout(function () { c.model = select.value; rerender(); UI.toast('Now analysing with ' + connLabel() + '.'); }, 900);
    });
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
    if (withSetup) {
      var steps = method.id === 'agent' ? agentSteps(ai, method) : method.id === 'key' ? keySteps(ai, method) : localSteps(ai, method);
      block.appendChild(el('details', { class: 'cp-setup' }, [
        el('summary', { text: 'Setup steps (all done)' }),
        el('ol', { class: 'ai-steps-list cp-steps' }, steps.map(function (s, i) { return renderStep(i + 1, s, 'A', false); })),
      ]));
    }
    return block;
  }

  // A step: { title, doneTitle, done, body: [nodes], actions: [buttons], always: [nodes kept when done] }
  function renderStep(n, s, guide, isCurrent) {
    var mark = el('span', { class: 'ai-step-mark', 'aria-hidden': 'true' }, s.done ? [icon('check')] : [String(n)]);
    var li = el('li', { class: 'ai-step' + (s.done ? ' is-done' : '') + (guide === 'A' && !s.done && !isCurrent ? ' is-later' : '') });
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

  function fakeConnect(ai, method, model, status, button) {
    button.disabled = true;
    UI.setNotice(status, 'info', { title: method.id === 'agent' ? 'Checking ' + (method.app || ai.name) + ' answers…' : 'Checking it can see images…', text: method.id === 'agent' ? 'This can take up to a minute.' : null });
    setTimeout(function () {
      state.connection = { ai: ai.id, method: method.id, model: model, at: 'just now' };
      if (method.id === 'agent') state.loggedIn[ai.id] = true;
      rerender();
      UI.toast('Connected · ' + connLabel());
    }, 1200);
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
        body: [hint(m.app + ' is the free app Pool talks to' + (m.app === m.label ? '.' : ' — it uses your ' + m.label.toLowerCase() + '.'))],
        actions: [installBtn] },
      { title: 'Log in to ' + m.app, doneTitle: 'Logged in to ' + m.app, done: installed && (connected || !!state.loggedIn[ai.id]),
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
    var btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Check key' });
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
      { title: 'Get an API key from ' + m.provider, doneTitle: 'You have an API key', done: connected || !!state.envKey[ai.id],
        alsoOpen: true,
        body: [el('p', { class: 'ai-hint' }, ['You pay ' + m.provider + ' per use. ', el('a', { class: 'ext-link', href: '#', onclick: function (e) { e.preventDefault(); } }, ['Get a key', icon('external')])])] },
      { title: 'Paste it and pick a model', doneTitle: 'Key saved · model chosen', done: connected,
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
    var look = param('look', LOOKS, 'A');
    var guide = param('guide', GUIDES, 'A');
    var scene = param('scene', SCENES, 'fresh');
    var keys = Object.keys(LOOKS);
    function step(dir) {
      setParam('look', keys[(keys.indexOf(look) + dir + keys.length) % keys.length]);
      if (look === 'C' || param('look', LOOKS, 'A') === 'C') {
        var reopen = !!view;
        closeModal();
        if (reopen) openConnect();
      } else rerender();
    }
    function chip(key, value, label, current) {
      return el('button', { type: 'button', class: current === value ? 'is-on' : '', text: label, onclick: function () {
        setParam(key, value);
        if (key === 'scene') { loadScene(value); route = null; }
        rerender();
      } });
    }
    bar = el('div', { class: 'proto-bar', role: 'toolbar', 'aria-label': 'Prototype variants' }, [
      el('button', { type: 'button', 'aria-label': 'Previous look', text: '←', onclick: function () { step(-1); } }),
      el('span', { class: 'proto-bar-label', text: 'Look ' + look + ' — ' + LOOKS[look] }),
      el('button', { type: 'button', 'aria-label': 'Next look', text: '→', onclick: function () { step(1); } }),
      el('span', { class: 'proto-bar-sep' }),
      el('span', { class: 'proto-bar-label', text: 'Guide' }),
      chip('guide', 'A', 'Fold', guide),
      chip('guide', 'B', 'Open', guide),
      el('span', { class: 'proto-bar-sep' }),
      chip('scene', 'fresh', 'Not connected', scene),
      chip('scene', 'connected', 'Connected', scene),
      el('span', { class: 'proto-bar-sep' }),
      el('button', { type: 'button', text: 'Open Connect', onclick: function () { openConnect(); } }),
    ]);
    bar._step = step;
    document.body.appendChild(bar);
  }

  document.addEventListener('keydown', function (evt) {
    if (UI.isTyping(evt.target) || !bar) return;
    if (evt.key === 'ArrowLeft') bar._step(-1);
    else if (evt.key === 'ArrowRight') bar._step(1);
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
