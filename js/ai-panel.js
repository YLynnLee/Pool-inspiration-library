// Connect AI + Drain. Owns the connection and drain state and publishes it as
// window.LibraryAI for the header's AI pill (here) and the inbox drawer
// (inbox-panel.js), which is where draining is started and watched.
// Everything goes through the local helper (scripts/server.js); the page
// itself never calls a model — see SECURITY.md.
// Opened from file://, Connect AI explains how to start the helper instead.
(function () {
  'use strict';

  var HELPER_URL = 'http://localhost:4747/';
  var served = window.location.protocol === 'http:' || window.location.protocol === 'https:';
  var cached = null;
  var el = window.UI.el;
  var icon = window.UI.icon;
  var listeners = [];

  function notify() {
    renderHeaders();
    listeners.forEach(function (fn) { fn(); });
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
    });
  }

  function refreshStatus() {
    if (!served) return Promise.resolve(null);
    return api('GET', '/api/status').then(function (s) {
      cached = s;
      if (s.job && s.job.running) followDrain();
      notify();
      return s;
    }, function () {
      cached = null;
      notify();
      return null;
    });
  }

  // ---- header: the AI pill -------------------------------------------------------
  //
  // Not connected: a quiet "Connect AI" with a hollow dot. Connected: the AI's
  // name with a lit dot, opening a small menu to switch or disconnect — the
  // full Connect dialog only opens when there's actually a choice to make.

  function fillHeader(slot) {
    window.UI.closePopoverWithin(slot);
    slot.textContent = '';
    var connection = cached && cached.config.connection;
    if (!connection) {
      slot.appendChild(el('button', {
        class: 'ai-pill is-off',
        type: 'button',
        title: 'Connect the AI you use, so Drain can analyse your inbox',
        onclick: function () { openConnect(); },
      }, [el('span', { class: 'ai-dot', 'aria-hidden': 'true' }), el('span', { text: 'Connect AI' })]));
      return;
    }
    slot.appendChild(el('button', {
      class: 'ai-pill',
      type: 'button',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      title: 'Connected to ' + connection.label,
      onclick: function (evt) { openAiMenu(evt.currentTarget); },
    }, [
      el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'ai-pill-label', text: connection.label }),
      icon('chevron', 'ai-pill-chevron'),
    ]));
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

  function describeConnection() {
    var config = cached.config;
    if (config.mode === 'api' && config.api) return 'API · ' + (config.api.model || config.api.provider);
    return 'Agent app on this computer';
  }

  function openAiMenu(trigger) {
    var connection = cached.config.connection;
    var body = el('div', { class: 'ai-menu' });

    function showMain() {
      body.textContent = '';
      var since = window.UI.timeAgo(connection.at);
      body.appendChild(el('p', { class: 'popover-eyebrow', text: 'AI for draining' }));
      body.appendChild(el('div', { class: 'ai-menu-current' }, [
        el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
        el('div', {}, [
          el('p', { class: 'ai-menu-name', text: connection.label }),
          el('p', { class: 'ai-menu-meta', text: describeConnection() + (since ? ' · connected ' + since : '') }),
        ]),
      ]));
      var running = drain.running;
      body.appendChild(el('div', { class: 'ai-menu-actions' }, [
        el('button', {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          text: 'Switch AI…',
          onclick: function () { window.UI.closePopover(); openConnect(); },
        }),
        el('button', {
          class: 'btn btn-ghost btn-sm btn-danger-quiet',
          type: 'button',
          text: 'Disconnect',
          disabled: running,
          title: running ? 'Stop the drain first' : null,
          onclick: showConfirm,
        }),
      ]));
      if (running) body.appendChild(el('p', { class: 'ai-menu-note', text: 'A drain is running with this AI.' }));
    }

    function showConfirm() {
      body.textContent = '';
      var status = el('p', { class: 'ai-menu-note', 'aria-live': 'polite' });
      var confirm = el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Disconnect' });
      confirm.addEventListener('click', function () {
        confirm.disabled = true;
        confirm.textContent = 'Disconnecting…';
        api('POST', '/api/disconnect', {}).then(function (next) {
          cached = next;
          window.UI.closePopover();
          notify();
          window.UI.toast('Disconnected from ' + connection.label + '. Your library and inbox are unchanged.', {
            action: { label: 'Connect another', run: function () { openConnect(); } },
          });
        }, function (err) {
          confirm.disabled = false;
          confirm.textContent = 'Disconnect';
          status.textContent = err.message;
          status.classList.add('is-error');
        });
      });
      body.appendChild(el('p', { class: 'ai-menu-name', text: 'Disconnect ' + connection.label + '?' }));
      body.appendChild(el('p', { class: 'ai-menu-meta', text: 'Drain stops working until you connect an AI again. Nothing in your library or inbox changes, and any saved key stays on this computer.' }));
      body.appendChild(el('div', { class: 'ai-menu-actions' }, [
        el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Cancel', onclick: showMain }),
        confirm,
      ]));
      body.appendChild(status);
      confirm.focus();
    }

    showMain();
    window.UI.popover(trigger, body);
  }

  // ---- modal shell -------------------------------------------------------------

  function onKey(evt) {
    if (evt.key === 'Escape') closeModal();
  }

  function closeModal() {
    var overlay = document.querySelector('.ai-modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onKey);
  }

  function mount(children) {
    closeModal();
    var modal = el('div', { class: 'add-modal ai-modal', role: 'dialog', 'aria-modal': 'true' }, children);
    var overlay = el('div', { class: 'add-modal-overlay ai-modal-overlay' }, [modal]);
    overlay.addEventListener('click', function (evt) {
      if (evt.target === overlay) closeModal();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    return modal;
  }

  function closeButton(text) {
    return el('button', { class: 'add-modal-cancel', type: 'button', text: text || 'Close', onclick: closeModal });
  }

  // ---- Connect: opened from file:// --------------------------------------------
  //
  // A page can't start programs, but it can follow an pool://
  // link, which the launcher registers with the computer on its first run
  // (scripts/register-url-handler.sh). Following it starts the helper
  // quietly; this waits for it to answer, then switches to it with Connect
  // already open.

  var START_LINK = 'pool://start';
  // pool:// only works once "Start Pool" has been double-clicked by hand at
  // least once (that's what registers the link — see
  // scripts/register-url-handler.sh). Until then this link resolves to
  // nothing and the helper will never answer, so there's little point
  // waiting long or burying the manual step behind a delay: it's shown
  // up front, every time, as the actual instruction — the automatic
  // pool:// attempt is the shortcut that skips it once it's set up, not
  // the primary thing being explained.
  var WAIT_MS = 60000;

  function helperUp() {
    // An opaque no-cors request still tells us whether anything answers.
    return fetch(HELPER_URL + 'api/status', { mode: 'no-cors', cache: 'no-store' }).then(function () { return true; }, function () { return false; });
  }

  function goToHelper() {
    window.location.href = HELPER_URL + '?connect=1';
  }

  function openStartHelper() {
    helperUp().then(function (up) {
      if (up) return goToHelper();

      var status = el('p', { class: 'add-modal-status', 'aria-live': 'polite', text: 'Trying to connect automatically…' });
      var retry = el('button', { class: 'add-modal-cancel', type: 'button', text: 'Try again', hidden: 'hidden' });
      var stopped = false;
      mount([
        el('h2', { class: 'add-modal-title', text: 'One-time setup: start Pool' }),
        el('p', { class: 'ai-lede', text: 'Before Connect AI can reach your computer, it needs to be started once, by hand. After this, Connect AI opens on its own — no more steps.' }),
        el('ol', { class: 'ai-steps-list' }, [
          step(1, 'Open the Pool folder', false, [el('p', { class: 'ai-hint', text: 'The folder this library lives in — where this page’s file is.' })]),
          step(2, 'Double-click “Start Pool”', false, [el('p', { class: 'ai-hint', text: '(“Start Pool.bat” on Windows.) A window opens and sets things up.' })]),
          step(3, 'Leave that window open, then come back here', false, [status]),
        ]),
        el('div', { class: 'add-modal-actions' }, [el('button', { class: 'add-modal-cancel', type: 'button', text: 'Cancel', onclick: function () { stopped = true; closeModal(); } }), retry]),
      ]);

      function start() {
        stopped = false;
        retry.hidden = true;
        status.classList.remove('is-error');
        status.textContent = 'Trying to connect automatically…';
        window.location.href = START_LINK;
        var began = Date.now();
        (function poll() {
          if (stopped || !document.body.contains(status)) return;
          helperUp().then(function (ok) {
            if (ok) {
              status.textContent = 'Ready — opening…';
              return goToHelper();
            }
            var waited = Date.now() - began;
            if (waited > WAIT_MS) {
              status.textContent = 'Still not running — do the step above, then try again.';
              status.classList.add('is-error');
              retry.hidden = false;
              return;
            }
            window.setTimeout(poll, 1000);
          });
        })();
      }
      retry.addEventListener('click', start);
      start();
    });
  }

  // ---- Connect: pick an AI, then follow its own guide ----------------------------
  //
  // The grid lists AIs by the names people know (Claude, ChatGPT, Gemini…).
  // Each opens a guide shaped by how that AI connects: an agent app gets
  // install → log in → connect steps, an API key gets a "get a key" link and
  // a key field, a local model server gets download → model → connect. The
  // guide ticks off what the helper can already see is done.

  var found = null;

  function detectNow(fresh) {
    return api('GET', '/api/detect' + (fresh ? '?fresh=1' : '')).then(function (d) {
      found = d;
      return d;
    });
  }

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

  function tagFor(ai) {
    var connection = cached.config.connection;
    if (connection && connection.ai === ai.id) return 'Connected';
    if (!found) return '';
    for (var i = 0; i < ai.methods.length; i++) {
      var m = ai.methods[i];
      if (m.id === 'agent' && agentInstalled(m.preset)) return 'Installed';
      if (m.id === 'local' && localServer(m.provider) && localServer(m.provider).running) return 'Running';
      if (m.id === 'key' && hasEnvKey(m.provider)) return 'Key found';
    }
    return '';
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
    li.querySelector('.ai-step-mark').textContent = '✓';
    li.querySelector('.ai-step-title').textContent += ' — done';
  }

  // AIs whose login window has been opened this session, so step 2 stays
  // ticked when the guide re-renders (e.g. after "Check again").
  var loginOpened = {};

  function isConnectedTo(aiId, mode) {
    var connection = cached.config.connection;
    return !!(connection && connection.ai === aiId && (!mode || cached.config.mode === mode));
  }

  function statusLine() {
    return el('p', { class: 'ai-option-status', 'aria-live': 'polite' });
  }

  function setStatus(line, text, isError) {
    line.textContent = text || '';
    line.classList.toggle('is-error', !!isError);
  }

  function openConnect(startAt) {
    if (!served || !cached) return openStartHelper();
    var view = el('div', { class: 'ai-view' });
    var current = function () {};
    mount([view]);

    var busy = false;
    // doneStep, when given, is ticked on success and left on screen for a
    // moment before the guide gives way to the "Connected" view.
    function connectWith(update, status, button, doneStep) {
      if (busy) return;
      busy = true;
      button.disabled = true;
      setStatus(status, update.mode === 'agent' ? 'Checking it answers — this can take up to a minute…' : 'Checking it can see images…');
      api('POST', '/api/connect', update).then(function (r) {
        cached = r.status;
        notify();
        if (!r.ok) throw new Error(r.message);
        if (!doneStep) return showConnected(r.message);
        markStepDone(doneStep);
        setStatus(status, r.message);
        var shown = current;
        setTimeout(function () {
          if (current === shown) showConnected(r.message);
        }, 1200);
      }).catch(function (err) {
        setStatus(status, err.message, true);
      }).then(function () {
        busy = false;
        button.disabled = false;
      });
    }

    function terminalButton(label, body, status, after) {
      var button = el('button', { class: 'add-modal-cancel', type: 'button', text: label });
      button.addEventListener('click', function () {
        button.disabled = true;
        api('POST', '/api/terminal', body).then(function (r) {
          setStatus(status, r.ok ? r.message : r.message, !r.ok);
          if (r.ok && after) after();
        }, function (err) {
          setStatus(status, err.message, true);
        }).then(function () { button.disabled = false; });
      });
      return button;
    }

    function checkAgainButton(rerender) {
      var button = el('button', { class: 'add-modal-cancel', type: 'button', text: 'Check again' });
      button.addEventListener('click', function () {
        button.disabled = true;
        button.textContent = 'Checking…';
        detectNow(true).then(rerender, rerender);
      });
      return button;
    }

    // -- connected: say so, and offer the obvious next step
    function showConnected(message) {
      current = function () {};
      view.textContent = '';
      var waiting = cached.inbox ? cached.inbox.captures : 0;
      var label = cached.config.connection ? cached.config.connection.label : 'your AI';
      view.appendChild(el('div', { class: 'ai-success' }, [
        el('span', { class: 'ai-success-mark', 'aria-hidden': 'true' }, [icon('check')]),
        el('h2', { class: 'add-modal-title', text: 'Connected to ' + label }),
        el('p', { class: 'ai-lede', text: message }),
        el('p', { class: 'ai-hint', text: waiting ? (waiting === 1 ? '1 capture is' : waiting + ' captures are') + ' waiting in your inbox.' : 'Your inbox is empty — add a link any time and drain it from the Inbox.' }),
      ]));
      var actions = [el('button', { class: 'btn btn-ghost', type: 'button', text: 'Done', onclick: closeModal })];
      if (waiting) {
        actions.push(el('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: 'Drain ' + window.UI.plural(waiting, 'capture') + ' now',
          onclick: function () {
            closeModal();
            startDrain();
          },
        }));
      }
      var row = el('div', { class: 'add-modal-actions' }, actions);
      view.appendChild(row);
      row.lastChild.focus();
    }

    // -- the grid of AIs
    function showGrid() {
      current = function () { showGrid(); };
      view.textContent = '';
      var connection = cached.config.connection;
      if (connection) {
        view.appendChild(el('h2', { class: 'add-modal-title', text: 'Switch AI' }));
        view.appendChild(el('p', { class: 'ai-lede', text: 'You’re connected to ' + connection.label + '. Connecting another replaces it — your library and inbox stay as they are.' }));
      } else {
        view.appendChild(el('h2', { class: 'add-modal-title', text: 'Connect your AI' }));
        view.appendChild(el('p', { class: 'ai-lede', text: 'Pick the AI you use. It shows you exactly how to connect it — sign in, paste a key, or run it on this computer.' }));
      }
      var grid = el('div', { class: 'ai-grid' });
      cached.catalog.forEach(function (ai) {
        var tag = tagFor(ai);
        grid.appendChild(el('button', { class: 'ai-card' + (tag === 'Connected' ? ' is-connected' : ''), type: 'button', onclick: function () { showGuide(ai); } }, [
          el('span', { class: 'ai-card-name', text: ai.name }),
          el('span', { class: 'ai-card-tag', text: tag }),
        ]));
      });
      grid.appendChild(el('button', { class: 'ai-card', type: 'button', onclick: showOther }, [
        el('span', { class: 'ai-card-name', text: 'Something else' }),
        el('span', { class: 'ai-card-tag', text: '' }),
      ]));
      view.appendChild(grid);
      view.appendChild(el('div', { class: 'add-modal-actions' }, [closeButton()]));
    }

    function guideHeader(title, blurb, aiId) {
      view.textContent = '';
      view.appendChild(el('button', { class: 'ai-back', type: 'button', text: '← All AIs', onclick: function () { showGrid(); } }));
      view.appendChild(el('h2', { class: 'add-modal-title', text: title }));
      if (blurb) view.appendChild(el('p', { class: 'ai-lede', text: blurb }));
      var connection = cached.config.connection;
      if (connection && connection.ai !== aiId) {
        view.appendChild(el('p', { class: 'ai-hint', text: 'You’re connected to ' + connection.label + '. Connecting this replaces it.' }));
      }
    }

    // -- one AI's guide
    function showGuide(ai, methodId) {
      var method = ai.methods.find(function (m) { return m.id === methodId; }) || ai.methods[0];
      current = function () { showGuide(ai, method.id); };
      guideHeader(ai.name, ai.blurb, ai.id);
      if (ai.methods.length > 1) {
        view.appendChild(el('div', { class: 'ai-segment', role: 'group', 'aria-label': 'How to connect' }, ai.methods.map(function (m) {
          return el('button', {
            class: 'ai-segment-btn',
            type: 'button',
            'aria-pressed': String(m === method),
            text: m.id === 'key' ? 'Use an API key' : 'Use my ' + m.label,
            onclick: function () { showGuide(ai, m.id); },
          });
        })));
      }
      var rerender = function () { showGuide(ai, method.id); };
      if (!found && method.id !== 'key') {
        view.appendChild(el('p', { class: 'ai-hint ai-checking', text: 'Checking what’s on this computer…' }));
        view.appendChild(el('div', { class: 'add-modal-actions' }, [closeButton()]));
        return;
      }
      var steps = method.id === 'agent' ? agentSteps(ai, method, rerender)
        : method.id === 'key' ? keySteps(ai, method)
        : localSteps(ai, method, rerender);
      view.appendChild(el('ol', { class: 'ai-steps-list' }, steps));
      view.appendChild(el('div', { class: 'add-modal-actions' }, [closeButton()]));
    }

    function agentSteps(ai, m, rerender) {
      var installed = agentInstalled(m.preset);
      var installStatus = statusLine();
      var loginStatus = statusLine();
      var connectStatus = statusLine();
      var connected = isConnectedTo(ai.id, 'agent');
      var loginStep, connectStep;
      var connectBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Connect' });
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
        el('p', { class: 'ai-hint', text: 'Needs ' + m.needs.charAt(0).toLowerCase() + m.needs.slice(1) }),
        el('p', { class: 'ai-hint', text: m.login.steps }),
        el('div', { class: 'ai-row' }, [loginBtn]),
        loginStatus,
        el('p', { class: 'ai-hint', text: 'Already logged in? Skip to step 3.' }),
      ]);
      connectStep = step(3, 'Connect', installed && connected, [
        el('p', { class: 'ai-hint', text: 'The library checks ' + m.app + ' answers, then Drain is ready.' }),
        el('div', { class: 'ai-row' }, [connectBtn]),
        connectStatus,
      ]);

      return [
        step(1, 'Install ' + m.app, installed, installed ? [] : [
          el('p', { class: 'ai-hint', text: m.app + ' is the free app that lets the library use your ' + m.label.toLowerCase() + '.' }),
          el('div', { class: 'ai-row' }, [
            terminalButton('Install ' + m.app, { ai: ai.id, action: 'install' }, installStatus),
            checkAgainButton(rerender),
          ]),
          installStatus,
          el('p', { class: 'ai-hint' }, [
            document.createTextNode('Or run it yourself: '),
            el('code', { class: 'ai-code-inline', text: m.install }),
            document.createTextNode(' · '),
            el('a', { href: m.docs, target: '_blank', rel: 'noopener', text: 'install guide ↗' }),
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
      var status = statusLine();
      var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', autocomplete: 'off', 'aria-label': 'API key', placeholder: hasEnvKey(m.provider) ? 'Found $' + provider.keyEnv + ' — leave empty to use it' : 'Paste your API key' });
      var next = el('button', { class: 'add-modal-cancel', type: 'button', text: 'Continue' });
      var chooser = el('div', { class: 'ai-row', hidden: 'hidden' });
      var connectStep;
      next.addEventListener('click', function () {
        next.disabled = true;
        setStatus(status, 'Checking the key…');
        api('POST', '/api/models', { mode: 'api', api: { provider: m.provider, apiKey: key.value } }).then(function (r) {
          setStatus(status, '');
          if (!r.models.length) throw new Error('No models were listed for this key.');
          chooser.textContent = '';
          var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, r.models.map(function (id) {
            return el('option', { value: id, text: id });
          }));
          select.value = r.suggested || r.models[0];
          var connectBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Connect' });
          connectBtn.addEventListener('click', function () {
            connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, apiKey: key.value, model: select.value } }, status, connectBtn, connectStep);
          });
          chooser.appendChild(select);
          chooser.appendChild(connectBtn);
          chooser.hidden = false;
        }).catch(function (err) {
          setStatus(status, err.message, true);
        }).then(function () { next.disabled = false; });
      });
      return [
        step(1, 'Get an API key', hasEnvKey(m.provider), [
          el('p', { class: 'ai-hint' }, [
            document.createTextNode('Create one in your ' + provider.label.replace(/ \(.*\)$/, '') + ' account. You pay per use. '),
            el('a', { href: m.keyUrl, target: '_blank', rel: 'noopener', text: 'Get a key ↗' }),
          ]),
        ]),
        connectStep = step(2, 'Paste it and pick a model', isConnectedTo(ai.id, 'api'), [
          el('div', { class: 'ai-row' }, [key, next]),
          chooser,
          status,
          el('p', { class: 'ai-hint', text: keyPromise() }),
        ]),
      ];
    }

    function localSteps(ai, m, rerender) {
      var server = localServer(m.provider);
      var running = !!(server && server.running);
      var models = running ? server.models : [];
      var status = statusLine();
      var pullStatus = statusLine();
      var select = el('select', { class: 'add-modal-input', 'aria-label': 'Model' }, models.map(function (id) {
        return el('option', { value: id, text: id });
      }));
      if (server && server.suggested) select.value = server.suggested;
      var connectStep;
      var connectBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Connect' });
      connectBtn.addEventListener('click', function () {
        connectWith({ ai: ai.id, mode: 'api', api: { provider: m.provider, model: select.value } }, status, connectBtn, connectStep);
      });
      if (!models.length) connectBtn.disabled = true;

      var modelStepBody = !running ? [el('p', { class: 'ai-hint', text: 'Do step 1 first.' })]
        : m.pull.length ? [
          el('p', { class: 'ai-hint', text: 'The library needs a model that can see images. Download one (a few GB):' }),
          el('div', { class: 'ai-row' }, m.pull.map(function (name) {
            return terminalButton(name, { ai: ai.id, action: 'pull', arg: name }, pullStatus);
          }).concat([checkAgainButton(rerender)])),
          pullStatus,
        ]
        : [el('p', { class: 'ai-hint', text: m.startHint }), el('div', { class: 'ai-row' }, [checkAgainButton(rerender)])];

      return [
        step(1, 'Install and open ' + m.label, running, running ? [] : [
          el('p', { class: 'ai-hint' }, [
            el('a', { href: m.download, target: '_blank', rel: 'noopener', text: 'Download ' + m.label + ' ↗' }),
            document.createTextNode(' — free. ' + (m.pull.length ? m.startHint : 'Then open it.')),
          ]),
          el('div', { class: 'ai-row' }, [checkAgainButton(rerender)]),
        ]),
        step(2, 'Get a model that can see images', running && models.length > 0, modelStepBody),
        connectStep = step(3, 'Choose it and connect', running && isConnectedTo(ai.id, 'api'), models.length ? [el('div', { class: 'ai-row' }, [select, connectBtn]), status] : [el('p', { class: 'ai-hint', text: 'Your downloaded models will appear here.' })]),
      ];
    }

    // -- anything not in the list
    function showOther() {
      current = showOther;
      guideHeader('Something else', 'Any agent app that can run from a command, or any server that speaks the OpenAI API.');
      var cmdStatus = statusLine();
      var cmd = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Agent command', placeholder: 'e.g. my-agent --headless -p' });
      var cmdBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Connect' });
      cmdBtn.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'agent', agent: { preset: 'custom', command: cmd.value } }, cmdStatus, cmdBtn);
      });
      var srvStatus = statusLine();
      var base = el('input', { class: 'add-modal-input ai-mono', type: 'url', spellcheck: 'false', 'aria-label': 'Base URL', placeholder: 'https://…/v1' });
      var key = el('input', { class: 'add-modal-input ai-mono', type: 'password', autocomplete: 'off', 'aria-label': 'API key', placeholder: 'API key (if it needs one)' });
      var model = el('input', { class: 'add-modal-input ai-mono', type: 'text', spellcheck: 'false', 'aria-label': 'Model', placeholder: 'Model name' });
      var srvBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Connect' });
      srvBtn.addEventListener('click', function () {
        connectWith({ ai: 'other', mode: 'api', api: { provider: 'custom', baseUrl: base.value, apiKey: key.value, model: model.value } }, srvStatus, srvBtn);
      });
      view.appendChild(el('ol', { class: 'ai-steps-list' }, [
        step('A', 'An agent command', false, [
          el('p', { class: 'ai-hint', text: 'It must run without asking questions; the drain instructions are added as its last argument.' }),
          el('div', { class: 'ai-row' }, [cmd, cmdBtn]),
          cmdStatus,
        ]),
        step('B', 'An OpenAI-compatible server', false, [base, key, el('div', { class: 'ai-row' }, [model, srvBtn]), srvStatus, el('p', { class: 'ai-hint', text: 'A key is kept in ' + (cached.keyStore || 'a private store on this computer') + ', and only sent to this server over https (plain http only to this computer).' })]),
      ]));
      view.appendChild(el('div', { class: 'add-modal-actions' }, [closeButton()]));
    }

    showGrid();
    detectNow().then(function () {
      if (document.body.contains(view)) current();
    }, function () { /* the guides still work without detection */ });
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
      window.UI.toast(result.ok ? 'Drain finished. Reload to see the new references.' : 'Drain finished with problems — the inbox has the details.', {
        tone: result.ok ? null : 'warn',
        sticky: true,
        action: result.ok
          ? { label: 'Show new references', run: function () { window.location.reload(); } }
          : { label: 'Open inbox', run: function () { if (window.openInbox) window.openInbox(); } },
      });
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
})();
