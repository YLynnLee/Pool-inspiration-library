// PROTOTYPE — throwaway, lives only on prototype/reference-page-and-add-flow.
// Answers two questions from the UX review, inside the real app:
//   ?detail=A|B|C  what the top of a reference page looks like (Q10b)
//   ?add=A|B|C     how the Add drawer shows each link's state (Q12a)
// Active only when the URL has ?proto. Nothing here writes to the library or
// inbox: the Add drawer runs on in-memory stub links and a fake timer.
(function () {
  'use strict';

  if (!new URLSearchParams(window.location.search).has('proto')) return;

  var UI = window.UI;
  var el = UI.el;
  var icon = UI.icon;

  var VARIANTS = {
    detail: { A: 'Header first · label column', B: 'Split · sticky screenshot', C: 'Plate · caption under screenshot' },
    add: { A: 'One list · status per row', B: 'Grouped by state', C: 'Progress track per link' },
    engine: { C: 'AI · model · dropdown' },
  };

  function param(key) {
    var v = new URLSearchParams(window.location.search).get(key);
    return VARIANTS[key][v] ? v : (key === 'detail' ? 'C' : key === 'engine' ? 'C' : 'A');
  }

  function setParam(key, value) {
    var p = new URLSearchParams(window.location.search);
    p.set(key, value);
    window.history.replaceState(null, '', window.location.pathname + '?' + p.toString() + window.location.hash);
    refresh();
  }

  // Icons the shared set lacks, drawn to the same 16px / 1.5 stroke.
  var EXTRA = {
    alert: '<circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11h.01"/>',
    info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.5V11M8 5h.01"/>',
    external: '<path d="M6 3.5H3.5v9h9V10M9 3h4v4M13 3 7.5 8.5"/>',
    back: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
    forward: '<path d="M6 3.5 10.5 8 6 12.5"/>',
  };

  function svg(name) {
    var span = el('span', { class: 'icon', 'aria-hidden': 'true' });
    span.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + EXTRA[name] + '</svg>';
    return span;
  }

  // ---- KEEP? notice -------------------------------------------------------
  // tone: info | success | warning | error. One line of what happened, one of
  // how to fix it, at most one or two actions.
  function notice(tone, title, text, actions) {
    var glyph = tone === 'success' ? icon('check') : svg(tone === 'info' ? 'info' : 'alert');
    return el('div', { class: 'notice is-' + tone, role: tone === 'error' ? 'alert' : 'status' }, [
      glyph,
      el('p', { class: 'notice-title', text: title }),
      text ? el('p', { class: 'notice-text', text: text }) : null,
      actions && actions.length ? el('div', { class: 'notice-actions' }, actions) : null,
    ]);
  }

  function stubToast(what) {
    UI.toast('Prototype: ' + what + '.');
  }

  // ======================================================================
  // Reference page
  // ======================================================================

  function host(url) {
    try { return new URL(url).host.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function entryPieces(entry) {
    var category = window.getCategory(entry.category);
    var pieces = {
      back: el('a', { class: 'back-link', href: '#/' }, [svg('back'), 'Library']),
      title: el('h1', { class: 'entry-title', text: entry.name }),
      host: host(entry.sourceUrl) ? el('p', { class: 'proto-host', text: host(entry.sourceUrl) }) : null,
      actions: el('div', { class: 'proto-actions' }, [
        /^https?:\/\//i.test(entry.sourceUrl || '')
          ? el('a', { class: 'btn btn-ghost btn-sm', href: entry.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, ['Visit site', svg('external')])
          : null,
        el('button', { class: 'btn btn-sm btn-danger-quiet', type: 'button', text: 'Delete…', onclick: function () { stubToast('opens the same Delete confirmation as the tile'); } }),
      ]),
      draft: window.isDraft(entry)
        ? notice('warning', 'Draft — the screenshot didn’t come through', entry.draftReason || 'The site could not be captured usefully.', [
          el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Resolve…', onclick: function () { stubToast('opens Resolve'); } }),
        ])
        : null,
      shots: buildShots(entry),
      categoryName: category ? el('p', { class: 'proto-category-name', text: category.name }) : null,
      categoryDef: category && category.definition ? el('p', { class: 'proto-body proto-body-dim', text: category.definition }) : null,
      summary: el('p', { class: 'proto-body', text: entry.summary }),
      keywords: el('ul', { class: 'keyword-list' }, (entry.keywords || []).map(function (kw) { return el('li', { text: kw }); })),
    };
    pieces.category = category;
    return pieces;
  }

  function buildShots(entry) {
    var wrap = el('div', {});
    var shots = entry.screenshots || [];
    if (!shots.length) return wrap;
    var hero = el('div', { class: 'hero-wrap' }, [el('img', { class: 'hero-image', src: shots[0], alt: entry.name })]);
    wrap.appendChild(hero);
    if (shots.length > 1) {
      wrap.appendChild(el('div', { class: 'extra-screenshots' }, shots.slice(1).map(function (src) {
        return el('img', { class: 'extra-screenshot', src: src, alt: entry.name });
      })));
    }
    return wrap;
  }

  function label(text) {
    return el('h2', { class: 'section-label', text: text });
  }

  var DETAIL_BUILDERS = {
    // A — the header block names the page before anything else; the three
    // facts sit in a label column, the same shape as Breakdown's scale rows.
    A: function (p) {
      return [
        p.back,
        p.draft,
        el('header', { class: 'proto-a-header' }, [el('div', {}, [p.title, p.host]), p.actions]),
        p.shots,
        el('dl', { class: 'proto-facts' }, [
          el('dt', {}, [label('Category')]),
          el('dd', {}, [p.categoryName, p.categoryDef]),
          el('dt', {}, [label('Summary')]),
          el('dd', {}, [p.summary]),
          el('dt', {}, [label('Keywords')]),
          el('dd', {}, [p.keywords]),
        ]),
      ];
    },
    // B — screenshot stays in view on the left while the words scroll.
    B: function (p) {
      return [
        p.back,
        p.draft,
        el('div', { class: 'proto-b-split' }, [
          el('div', { class: 'proto-b-shots' }, [p.shots]),
          el('div', { class: 'proto-b-info' }, [
            p.title,
            p.host,
            p.actions,
            el('div', { class: 'proto-stack' }, [
              el('section', {}, [label('Category'), p.categoryName, p.categoryDef]),
              el('section', {}, [label('Summary'), p.summary]),
              el('section', {}, [label('Keywords'), p.keywords]),
            ]),
          ]),
        ]),
      ];
    },
    // C — the screenshot is the page; the name and category caption it like
    // a plate in a catalogue, then summary and keywords stack below.
    C: function (p) {
      return [
        p.back,
        p.draft,
        p.shots,
        el('div', { class: 'proto-c-caption' }, [
          el('div', {}, [
            p.title,
            p.category
              ? el('p', { class: 'proto-category-line' }, [el('strong', { text: p.category.name }), ' — ' + (p.category.definition || '')])
              : null,
          ]),
          el('div', {}, [p.actions]),
        ]),
        el('div', { class: 'proto-stack' }, [
          el('section', {}, [label('Summary'), p.summary]),
          el('section', {}, [label('Keywords'), p.keywords]),
        ]),
      ];
    },
  };

  function applyDetail() {
    var view = document.querySelector('.view-entry');
    if (!view) return;
    var id = decodeURIComponent((window.location.hash.match(/^#\/entry\/([^/?]+)/) || [])[1] || '');
    var entry = window.getEntry(id);
    if (!entry) return;
    // render.js built the real tabs; keep that node and rebuild around it.
    var tabs = view._protoTabs || view.querySelector('.detail-tabs');
    view._protoTabs = tabs;
    var v = param('detail');
    var parts = DETAIL_BUILDERS[v](entryPieces(entry));
    view.textContent = '';
    view.className = 'view view-entry proto-entry' + (v === 'B' ? ' proto-wide' : '');
    parts.concat([tabs]).forEach(function (node) { if (node) view.appendChild(node); });
  }

  // ======================================================================
  // Header + Add drawer (stub data, fake timer)
  // ======================================================================

  // One stub per state the drawer has to show. `fails` marks the link the
  // fake analysis will refuse, so the failure path shows up on its own.
  var state = {
    connected: true,
    running: false,
    ai: 'claude',
    model: 'opus',
    checking: '',
    menuOpen: false,
    expanded: false,
    links: [
      { url: 'https://linear.app/method', note: 'the tight type scale', status: 'added', ref: 'Linear — Method' },
      { url: 'https://www.figma.com/blocked-example/', note: '', status: 'failed', reason: 'The site blocked the screenshot', fix: 'Retry — it often works on a second try. If it keeps failing, remove it and capture it by hand.' },
      { url: 'https://mobbin.com/discover/apps/ios/latest', note: 'onboarding flows', status: 'waiting' },
      { url: 'https://vercel.com/design', note: '', status: 'waiting' },
    ],
  };
  var timer = null;
  var drawerNode = null;

  function count(status) {
    return state.links.filter(function (l) { return l.status === status; }).length;
  }

  function splitUrl(url) {
    try {
      var u = new URL(url);
      return { host: u.host.replace(/^www\./, ''), rest: (u.pathname === '/' ? '' : u.pathname) + u.search };
    } catch (e) {
      return { host: url, rest: '' };
    }
  }

  // ---- header -----------------------------------------------------------

  function buildHeaderActions() {
    var ai = el('button', {
      class: 'btn btn-ghost proto-ai-btn' + (state.connected ? ' is-connected' : ''),
      type: 'button',
      title: state.connected ? 'Switch or disconnect your AI' : 'Connect the AI that analyses your links',
      onclick: function () {
        state.connected = !state.connected;
        if (!state.connected) stopRun();
        stubToast(state.connected ? 'connected Claude Code' : 'disconnected');
        render();
      },
    }, [el('span', { class: 'status-dot', 'aria-hidden': 'true' }), state.connected ? aiById(state.ai).label.split(' · ')[0] : 'Connect AI']);

    var waiting = count('waiting');
    var done = count('added');
    var failed = count('failed');
    var addChildren;
    if (state.running) {
      var step = state.links.filter(function (l) { return l.status === 'added' || l.status === 'failed' || l.status === 'analysing'; }).length;
      var total = step + waiting;
      addChildren = [el('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Analysing ' + step + ' of ' + total];
    } else if (state.finished && !state.seen) {
      addChildren = [failed ? svg('alert') : icon('check'), done + ' added' + (failed ? ' · ' + failed + ' failed' : '')];
    } else {
      addChildren = [icon('plus'), 'Add reference', waiting ? el('span', { class: 'proto-badge', text: String(waiting) }) : null];
    }
    var add = el('button', {
      class: 'btn btn-primary proto-add-btn',
      type: 'button',
      'aria-label': state.running ? 'Analysing — open to see progress' : 'Add reference',
      onclick: openDrawer,
    }, addChildren);

    return el('div', { class: 'proto-header-actions' }, [ai, add]);
  }

  function applyHeader() {
    var slot = document.querySelector('.library-actions');
    if (!slot) return;
    slot.textContent = '';
    slot.appendChild(buildHeaderActions());
  }

  // ---- drawer -----------------------------------------------------------

  function statusBadge(link) {
    var map = {
      waiting: ['Waiting', null],
      analysing: ['Analysing', 'spinner'],
      added: ['Added', 'check'],
      failed: ['Failed', 'alert'],
    };
    var m = map[link.status];
    var glyph = m[1] === 'spinner' ? el('span', { class: 'spinner', 'aria-hidden': 'true' })
      : m[1] === 'check' ? icon('check')
      : m[1] === 'alert' ? svg('alert')
      : el('span', { class: 'status-dot', 'aria-hidden': 'true' });
    return el('span', { class: 'status is-' + link.status }, [glyph, m[0]]);
  }

  // The site's name first, the full link under it as secondary text.
  function linkMain(link) {
    var parts = splitUrl(link.url);
    return el('div', { class: 'proto-link-main' }, [
      el('p', { class: 'proto-link-host', text: parts.host }),
      el('a', { class: 'proto-link-url', href: link.url, target: '_blank', rel: 'noopener noreferrer', title: link.url, text: link.url }),
      link.note ? el('p', { class: 'proto-link-note', text: link.note }) : null,
    ]);
  }

  function linkTrailing(link) {
    if (link.status === 'added') {
      return el('a', { class: 'icon-btn proto-link-open', href: '#/', 'aria-label': 'Open ' + link.ref, title: 'Open in library', onclick: function () { stubToast('opens ' + link.ref); } }, [svg('forward')]);
    }
    if ((link.status === 'waiting' && !state.running) || link.status === 'failed') {
      return el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + splitUrl(link.url).host, title: 'Remove', onclick: function () { removeLink(link); } }, [icon('trash')]);
    }
    return null;
  }

  function failureNotice(link) {
    return notice('error', link.reason, link.fix, [
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Retry', onclick: function () { link.status = 'waiting'; link.fails = false; render(); } }),
    ]);
  }

  function removeLink(link) {
    var at = state.links.indexOf(link);
    state.links.splice(at, 1);
    render();
    UI.toast('Removed ' + splitUrl(link.url).host + '.', { action: { label: 'Undo', run: function () { state.links.splice(at, 0, link); render(); } } });
  }

  // A — one list, newest first, status on the right of every row.
  function listA() {
    return el('ul', { class: 'proto-link-list' }, state.links.map(function (link) {
      return el('li', { class: 'proto-link' }, [
        el('div', { class: 'proto-link-row' }, [linkMain(link), statusBadge(link), linkTrailing(link)]),
        link.status === 'failed' ? failureNotice(link) : null,
      ]);
    }));
  }

  // B — grouped: what needs you first, then what's moving, then the rest.
  function listB() {
    var groups = [
      ['failed', 'Needs attention'],
      ['analysing', 'Analysing'],
      ['waiting', 'Waiting to be analysed'],
      ['added', 'Added to library'],
    ];
    var wrap = el('div', {});
    groups.forEach(function (g) {
      var links = state.links.filter(function (l) { return l.status === g[0]; });
      if (!links.length) return;
      wrap.appendChild(el('section', { class: 'proto-group' }, [
        el('h3', { class: 'section-label', text: g[1] + ' · ' + links.length }),
        el('ul', { class: 'proto-link-list' }, links.map(function (link) {
          return el('li', { class: 'proto-link' }, [
            el('div', { class: 'proto-link-row' }, [linkMain(link), linkTrailing(link)]),
            link.status === 'failed' ? failureNotice(link) : null,
          ]);
        })),
      ]));
    });
    return wrap;
  }

  // C — every link carries the same three-step track.
  function listC() {
    var steps = ['Waiting', 'Analysing', 'In library'];
    var at = { waiting: 0, analysing: 1, added: 2, failed: 1 };
    return el('ul', { class: 'proto-link-list' }, state.links.map(function (link) {
      var cur = at[link.status];
      var track = el('div', { class: 'proto-track', 'aria-label': 'Status: ' + link.status }, steps.map(function (s, i) {
        var cls = i < cur || (link.status === 'added' && i === cur) ? 'is-done'
          : i === cur ? (link.status === 'failed' ? 'is-failed' : link.status === 'analysing' ? 'is-current' : 'is-done')
          : '';
        return el('span', { class: 'proto-track-step ' + cls, text: link.status === 'failed' && i === cur ? 'Failed' : s });
      }));
      return el('li', { class: 'proto-link' }, [
        el('div', { class: 'proto-link-row' }, [linkMain(link), linkTrailing(link)]),
        track,
        link.status === 'failed' ? failureNotice(link) : null,
      ]);
    }));
  }

  // One AI is connected at a time. Choosing a model stays inside it and is
  // quick (list, save, re-test); changing the AI is the full Connect flow,
  // so it is its own labelled action, "Switch AI…", never a dropdown entry.
  var AIS = [
    { id: 'claude', label: 'Claude Code', models: [['opus', 'Opus 5.5'], ['sonnet', 'Sonnet 5.5'], ['haiku', 'Haiku 4.5']] },
  ];

  function aiById(id) {
    return AIS.filter(function (a) { return a.id === id; })[0] || AIS[0];
  }

  function modelLabel(id) {
    var m = aiById(state.ai).models.filter(function (x) { return x[0] === id; })[0];
    return m ? m[1] : id;
  }

  function commitModel(model) {
    state.checking = modelLabel(model);
    state.menuOpen = false;
    render();
    window.setTimeout(function () {
      state.checking = '';
      state.model = model;
      render();
      UI.toast('Analysing with ' + modelLabel(model) + '.');
    }, 1400);
  }

  function switchAi() {
    stubToast('opens Switch AI — connecting another replaces ' + aiById(state.ai).label);
  }

  function aiDot() {
    return el('span', { class: 'status-dot', 'aria-hidden': 'true' });
  }

  function checkingLine() {
    return state.checking
      ? el('p', { class: 'proto-footer-meta', 'aria-live': 'polite' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Checking ' + state.checking + ' answers…'])
      : null;
  }

  function analyseBtn(waiting) {
    return el('button', {
      class: 'btn btn-primary btn-block',
      type: 'button',
      disabled: !!state.checking,
      text: 'Analyse ' + UI.plural(waiting, 'link'),
      onclick: startRun,
    });
  }

  function modelSelect() {
    var select = el('select', { class: 'field proto-select', 'aria-label': 'Model', disabled: !!state.checking },
      aiById(state.ai).models.map(function (o) { return el('option', { value: o[0], text: o[1] }); }));
    select.value = state.model;
    select.addEventListener('change', function () { commitModel(select.value); });
    return select;
  }

  // One line: dot, the AI, its model, and a chevron. The whole line opens a
  // menu of that AI's models, with "Switch AI…" at the top. The Analyse
  // button sits right under it.
  function buildEngine(waiting) {
    var ai = aiById(state.ai);
    var trigger = el('button', {
      class: 'proto-engine-trigger',
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': state.menuOpen ? 'true' : 'false',
      'aria-label': 'Analyse with ' + ai.label + ', ' + modelLabel(state.model) + '. Change model',
      disabled: !!state.checking,
      onclick: function () { state.menuOpen = !state.menuOpen; render(); },
    }, [
      el('span', { class: 'proto-engine-side' }, [aiDot(), el('span', { class: 'proto-engine-name', text: ai.label })]),
      el('span', { class: 'proto-engine-side' }, [el('span', { class: 'proto-engine-model', text: modelLabel(state.model) }), icon('chevron')]),
    ]);
    var menu = state.menuOpen
      ? el('div', { class: 'proto-menu', role: 'menu' }, [
        el('div', { class: 'proto-menu-head' }, [
          el('span', { class: 'section-label', text: 'Model' }),
          el('button', { class: 'link-btn', type: 'button', text: 'Switch AI…', onclick: function () { state.menuOpen = false; render(); switchAi(); } }),
        ]),
      ].concat(ai.models.map(function (m) {
        var on = m[0] === state.model;
        return el('button', {
          class: 'proto-menu-item' + (on ? ' is-on' : ''),
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': on ? 'true' : 'false',
          onclick: function () { if (on) { state.menuOpen = false; render(); } else commitModel(m[0]); },
        }, [el('span', { text: m[1] }), on ? icon('check') : null]);
      })))
      : null;
    return [
      el('div', { class: 'proto-split' }, [menu, trigger]),
      checkingLine(),
      analyseBtn(waiting),
    ];
  }

  function buildFooter() {
    var waiting = count('waiting');
    var footer = el('div', { class: 'proto-footer' });
    if (!state.connected) {
      footer.appendChild(notice('info', 'Connect an AI to analyse these', 'Use Connect AI at the top of the page.'));
      footer.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', disabled: true, text: 'Analyse ' + UI.plural(waiting, 'link') }));
      return footer;
    }
    if (state.running) {
      footer.appendChild(el('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: stopRun }, [icon('stop'), 'Stop']));
      return footer;
    }
    if (state.finished) {
      var added = count('added');
      var failed = count('failed');
      footer.appendChild(failed
        ? notice('warning', added + ' added · ' + failed + ' failed', null)
        : notice('success', added + ' added to your library', null));
    }
    if (waiting) {
      buildEngine(waiting).forEach(function (node) { if (node) footer.appendChild(node); });
    }
    return footer.childNodes.length ? footer : null;
  }

  function buildDrawer() {
    var input = el('input', { class: 'field', type: 'text', placeholder: 'https://…', 'aria-label': 'Link to add', autocomplete: 'off', spellcheck: 'false' });
    var feedback = el('div', {});
    function add(evt) {
      evt.preventDefault();
      var value = input.value.trim();
      feedback.textContent = '';
      if (!/^https?:\/\/\S+\.\S+/.test(value)) {
        feedback.appendChild(notice('error', value ? 'That isn’t a link' : 'Paste a link first', 'Links start with https:// — copy one from your browser’s address bar.'));
        input.focus();
        return;
      }
      state.links.unshift({ url: value, note: note.value.trim(), status: 'waiting' });
      state.finished = false;
      input.value = '';
      note.value = '';
      render();
    }
    var note = el('textarea', { class: 'field proto-note', rows: '2', placeholder: 'What caught your eye? (optional)', 'aria-label': 'Note', hidden: true });
    var noteToggle = el('button', { class: 'link-btn', type: 'button' }, [icon('plus'), 'Add a note']);
    noteToggle.addEventListener('click', function () {
      note.hidden = false;
      noteToggle.hidden = true;
      note.focus();
    });
    var form = el('form', { class: 'proto-add-form', onsubmit: add }, [
      el('div', { class: 'proto-add-row' }, [input, el('button', { class: 'btn btn-primary', type: 'submit', text: 'Add' })]),
      note,
      el('div', { class: 'proto-add-meta' }, [noteToggle]),
      feedback,
    ]);

    var lists = { A: listA, B: listB, C: listC };
    var body = el('div', { class: 'proto-drawer-body' }, [
      state.links.length ? lists.A() : el('p', { class: 'proto-add-hint', text: 'Nothing added yet.' }),
    ]);

    var drawer = el('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Add references' }, [
      el('div', { class: 'drawer-header' }, [
        el('h2', { class: 'drawer-title', text: 'Add references' }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: closeDrawer }, [icon('close')]),
      ]),
      form,
      body,
      buildFooter(),
    ]);
    var overlay = el('div', { class: 'drawer-overlay proto-drawer' }, [drawer]);
    overlay.addEventListener('mousedown', function (evt) { if (evt.target === overlay) closeDrawer(); });
    return { overlay: overlay, input: input };
  }

  function openDrawer() {
    if (state.finished) { state.seen = true; applyHeader(); }
    var built = buildDrawer();
    if (drawerNode) drawerNode.remove();
    drawerNode = built.overlay;
    document.body.appendChild(drawerNode);
    built.input.focus();
  }

  function closeDrawer() {
    if (drawerNode) drawerNode.remove();
    drawerNode = null;
  }

  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && state.menuOpen) { state.menuOpen = false; render(); return; }
    if (evt.key === 'Escape' && drawerNode) closeDrawer();
  });
  document.addEventListener('mousedown', function (evt) {
    if (state.menuOpen && drawerNode && !evt.target.closest('.proto-split')) { state.menuOpen = false; render(); }
  });

  function renderDrawerInPlace() {
    if (!drawerNode) return;
    var scroll = drawerNode.querySelector('.proto-drawer-body').scrollTop;
    var built = buildDrawer();
    drawerNode.replaceWith(built.overlay);
    drawerNode = built.overlay;
    drawerNode.querySelector('.drawer').style.animation = 'none';
    drawerNode.style.animation = 'none';
    drawerNode.querySelector('.proto-drawer-body').scrollTop = scroll;
  }

  // ---- fake analysis: one link every 2.5s; a "blocked" URL fails ----------

  function startRun() {
    state.running = true;
    state.finished = false;
    state.seen = false;
    tick();
  }

  function tick() {
    var current = state.links.filter(function (l) { return l.status === 'analysing'; })[0];
    if (current) {
      if (/blocked/.test(current.url) && current.fails !== false) {
        current.status = 'failed';
        current.reason = 'The site blocked the screenshot';
        current.fix = 'Retry — it often works on a second try. If it keeps failing, remove it and capture it by hand.';
      } else {
        current.status = 'added';
        current.ref = splitUrl(current.url).host;
      }
    }
    var next = state.links.filter(function (l) { return l.status === 'waiting'; }).pop();
    if (next) {
      next.status = 'analysing';
      timer = window.setTimeout(tick, 2500);
    } else {
      state.running = false;
      state.finished = true;
      state.seen = !!drawerNode;
    }
    render();
  }

  function stopRun() {
    window.clearTimeout(timer);
    state.links.forEach(function (l) { if (l.status === 'analysing') l.status = 'waiting'; });
    state.running = false;
    render();
  }

  // ======================================================================
  // Switcher bar
  // ======================================================================

  var bar = null;

  function scenario(name) {
    stopRun();
    var base = [
      { url: 'https://linear.app/method', note: 'the tight type scale' },
      { url: 'https://www.figma.com/blocked-example/', note: '' },
      { url: 'https://mobbin.com/discover/apps/ios/latest', note: 'onboarding flows' },
      { url: 'https://vercel.com/design', note: '' },
    ];
    state.finished = false;
    state.connected = name !== 'no-ai';
    var statuses = {
      'no-ai': ['waiting', 'waiting', 'waiting', 'waiting'],
      ready: ['waiting', 'waiting', 'waiting', 'waiting'],
      mixed: ['added', 'failed', 'waiting', 'waiting'],
    }[name];
    state.links = base.map(function (l, i) {
      var s = statuses[i];
      return Object.assign({}, l, {
        status: s,
        ref: s === 'added' ? 'Linear — Method' : undefined,
        reason: s === 'failed' ? 'The site blocked the screenshot' : undefined,
        fix: s === 'failed' ? 'Retry — it often works on a second try. If it keeps failing, remove it and capture it by hand.' : undefined,
      });
    });
    if (name === 'mixed') state.finished = true;
    render();
  }

  function renderBar() {
    if (bar) bar.remove();
    var onEntry = !!document.querySelector('.view-entry');
    var key = onEntry ? 'detail' : 'engine';
    var keys = Object.keys(VARIANTS[key]);
    var cur = param(key);
    function step(dir) {
      setParam(key, keys[(keys.indexOf(cur) + dir + keys.length) % keys.length]);
    }
    var children = [
      el('button', { type: 'button', 'aria-label': 'Previous variant', text: '←', onclick: function () { step(-1); } }),
      el('span', { class: 'proto-bar-label', text: (onEntry ? 'Reference page ' : 'Analyse section ') + cur + ' — ' + VARIANTS[key][cur] }),
      el('button', { type: 'button', 'aria-label': 'Next variant', text: '→', onclick: function () { step(1); } }),
    ];
    if (!onEntry) {
      children.push(el('span', { class: 'proto-bar-sep' }));
      children.push(el('button', { type: 'button', text: 'Not connected', onclick: function () { scenario('no-ai'); openDrawer(); } }));
      children.push(el('button', { type: 'button', text: 'Ready', onclick: function () { scenario('ready'); openDrawer(); } }));
      children.push(el('button', { type: 'button', text: 'After a run', onclick: function () { scenario('mixed'); openDrawer(); } }));
    }
    bar = el('div', { class: 'proto-bar', role: 'toolbar', 'aria-label': 'Prototype variants' }, children);
    bar._step = step;
    document.body.appendChild(bar);
  }

  document.addEventListener('keydown', function (evt) {
    if (UI.isTyping(evt.target) || !bar) return;
    if (evt.key === 'ArrowLeft') bar._step(-1);
    else if (evt.key === 'ArrowRight') bar._step(1);
  });

  // ---- wiring ------------------------------------------------------------

  function render() {
    applyHeader();
    renderDrawerInPlace();
    renderBar();
  }

  function refresh() {
    applyDetail();
    applyHeader();
    renderDrawerInPlace();
    renderBar();
  }

  // render.js re-renders on hashchange/popstate and on filter changes; run
  // after it, and after any rebuild of the grid header.
  window.addEventListener('hashchange', function () { window.setTimeout(refresh, 0); });
  window.addEventListener('popstate', function () { window.setTimeout(refresh, 0); });
  new MutationObserver(function () {
    var slot = document.querySelector('.library-actions');
    if (slot && !slot.querySelector('.proto-header-actions')) applyHeader();
  }).observe(document.getElementById('app'), { childList: true, subtree: true });
  refresh();
})();
