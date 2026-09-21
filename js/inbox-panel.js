// The inbox drawer: the one place captures go in and get drained. Adding a
// link, seeing what's waiting, taking one back out, and draining them all
// live here, so the whole capture → drain loop reads as one list rather than
// an Add dialog in one corner and a Drain count in another.
//
// Writes only ever happen in direct response to the collector (Add, Remove,
// Drain) — never on load, never on a timer. See
// docs/adr/0002-app-writes-its-own-data.md.
(function () {
  'use strict';

  var UI = window.UI;
  var el = UI.el;
  var icon = UI.icon;
  var AI = window.LibraryAI;

  // Links added from file:// this session. That page can't read inbox.md,
  // so this is the only list it can honestly show.
  var addedHere = [];

  // ---- header button ------------------------------------------------------------

  function fillButton(button) {
    var status = AI.status();
    var drain = AI.drain;
    button.textContent = '';
    button.classList.toggle('is-busy', drain.running);
    if (drain.running) {
      button.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
      button.appendChild(el('span', { text: drain.total ? 'Draining ' + drain.step + '/' + drain.total : 'Draining…' }));
      button.title = 'Show drain progress';
      return;
    }
    button.appendChild(icon('inbox'));
    button.appendChild(el('span', { text: 'Inbox' }));
    var count = status && status.inbox ? status.inbox.captures : 0;
    if (count) button.appendChild(el('span', { class: 'count-badge', text: String(count) }));
    button.title = count ? UI.plural(count, 'capture') + ' waiting — add links and drain them (I)' : 'Add a link to the inbox (I)';
  }

  function refreshButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.inbox-btn'), fillButton);
  }

  window.buildInboxButton = function () {
    var button = el('button', { class: 'btn btn-ghost inbox-btn', type: 'button', onclick: function () { openInbox(); } });
    fillButton(button);
    return button;
  };

  // ---- drawer -------------------------------------------------------------------

  var drawer = null; // { overlay, input, note, feedback, list, footer, footerKind, returnFocus }

  function isOpen() {
    return !!(drawer && document.body.contains(drawer.overlay));
  }

  function closeInbox() {
    if (!isOpen()) return;
    var d = drawer;
    drawer = null;
    d.overlay.classList.add('is-leaving');
    document.removeEventListener('keydown', onDrawerKey, true);
    window.setTimeout(function () { d.overlay.remove(); }, 180);
    if (d.returnFocus && document.body.contains(d.returnFocus)) d.returnFocus.focus();
  }

  function onDrawerKey(evt) {
    if (evt.key === 'Escape' && !document.querySelector('.add-modal-overlay, .popover')) {
      evt.stopPropagation();
      closeInbox();
    }
  }

  function openInbox(prefill) {
    if (isOpen()) {
      if (prefill) {
        drawer.input.value = prefill;
        drawer.input.focus();
      }
      return;
    }
    var input = el('input', {
      class: 'field inbox-input',
      type: 'text',
      inputmode: 'url',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Paste a link — or several',
      'aria-label': 'Link to add',
    });
    var note = el('input', {
      class: 'field inbox-note',
      type: 'text',
      placeholder: 'What caught your eye? (optional)',
      'aria-label': 'Note',
      hidden: true,
    });
    var noteToggle = el('button', {
      class: 'link-btn',
      type: 'button',
      text: '+ Add a note',
      onclick: function () {
        note.hidden = false;
        noteToggle.hidden = true;
        note.focus();
      },
    });
    var addBtn = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Add' });
    var feedback = el('p', { class: 'inbox-feedback', 'aria-live': 'polite' });
    var form = el('form', { class: 'inbox-add', novalidate: true }, [
      el('div', { class: 'inbox-add-row' }, [input, addBtn]),
      note,
      el('div', { class: 'inbox-add-meta' }, [noteToggle, feedback]),
    ]);
    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      addFromInput();
    });

    var list = el('div', { class: 'inbox-list' });
    var footer = el('div', { class: 'drawer-footer' });
    var close = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close inbox', onclick: closeInbox }, [icon('close')]);
    var countLabel = el('span', { class: 'drawer-count' });

    var panel = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'inbox-title' }, [
      el('header', { class: 'drawer-header' }, [
        el('div', {}, [
          el('h2', { class: 'drawer-title', id: 'inbox-title' }, ['Inbox ', countLabel]),
          el('p', { class: 'drawer-sub', text: 'Links waiting to be analysed and added to your library.' }),
        ]),
        close,
      ]),
      form,
      list,
      footer,
    ]);
    var overlay = el('div', { class: 'drawer-overlay' }, [panel]);
    overlay.addEventListener('mousedown', function (evt) {
      if (evt.target === overlay) closeInbox();
    });

    drawer = {
      overlay: overlay,
      input: input,
      note: note,
      noteToggle: noteToggle,
      addBtn: addBtn,
      feedback: feedback,
      list: list,
      footer: footer,
      footerKind: '',
      countLabel: countLabel,
      returnFocus: document.activeElement,
    };
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onDrawerKey, true);
    renderDrawer();
    if (prefill) input.value = prefill;
    input.focus();
    if (AI.served) AI.refresh();
  }

  function setFeedback(text, tone) {
    drawer.feedback.textContent = text || '';
    drawer.feedback.className = 'inbox-feedback' + (tone ? ' is-' + tone : '');
  }

  // ---- adding ---------------------------------------------------------------------

  // Looser than the drain's exact-string dedupe on purpose: this only warns
  // before adding, so "medium.com" should count as the waiting
  // "https://medium.com/".
  function sameUrl(a, b) {
    return String(a).replace(/\/+$/, '') === String(b).replace(/\/+$/, '');
  }

  function libraryEntryFor(url) {
    var entries = window.getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (sameUrl(entries[i].sourceUrl, url)) return entries[i];
    }
    return null;
  }

  function addFromInput() {
    var d = drawer;
    var parsed = window.parseCaptureInput(d.input.value);
    if (!parsed.urls.length) {
      setFeedback(parsed.rejected.length ? 'That doesn’t look like a link — try https://…' : 'Paste a link first.', 'error');
      d.input.focus();
      return;
    }
    var status = AI.status();
    var waiting = status && status.inbox ? status.inbox.urls : addedHere.map(function (a) { return a.url; });
    var toAdd = [];
    var inLibrary = [];
    var alreadyWaiting = 0;
    parsed.urls.forEach(function (url) {
      var entry = libraryEntryFor(url);
      if (entry) inLibrary.push(entry);
      else if (waiting.some(function (w) { return sameUrl(w, url); })) alreadyWaiting++;
      else toAdd.push(url);
    });

    var noteText = d.note.value;
    var added = 0;
    d.addBtn.disabled = true;
    d.addBtn.textContent = 'Adding…';
    setFeedback('');

    var chain = Promise.resolve();
    toAdd.forEach(function (url) {
      chain = chain.then(function () {
        return window.appendToInbox(url, noteText).then(function () {
          added++;
          if (!AI.served || !AI.status()) addedHere.unshift({ url: url, note: noteText.trim() });
        });
      });
    });

    chain
      .then(function () {
        var parts = [];
        if (added) parts.push('Added ' + UI.plural(added, 'link') + '.');
        if (inLibrary.length === 1) parts.push('“' + inLibrary[0].name + '” is already in your library.');
        else if (inLibrary.length > 1) parts.push(inLibrary.length + ' are already in your library.');
        if (alreadyWaiting) parts.push(alreadyWaiting === 1 ? 'One was already waiting.' : alreadyWaiting + ' were already waiting.');
        if (parsed.rejected.length) parts.push('Skipped: ' + parsed.rejected.join(', ') + '.');
        setFeedback(parts.join(' '), added ? 'ok' : 'warn');
        d.input.value = '';
        d.note.value = '';
        d.note.hidden = true;
        d.noteToggle.hidden = false;
        d.input.focus();
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'Could not save. Nothing was changed.';
        setFeedback(added ? 'Added ' + added + ', then: ' + msg : msg, 'error');
      })
      .then(function () {
        if (!drawer) return;
        drawer.addBtn.disabled = false;
        drawer.addBtn.textContent = 'Add';
        if (AI.served) AI.refresh();
        else renderDrawer();
      });
  }

  // ---- the list -------------------------------------------------------------------

  function splitUrl(url) {
    try {
      var u = new URL(url);
      var rest = (u.pathname === '/' ? '' : u.pathname) + u.search;
      return { host: u.host.replace(/^www\./, ''), rest: rest };
    } catch (e) {
      return { host: url, rest: '' };
    }
  }

  function removeItem(item, button) {
    button.disabled = true;
    window.removeFromInbox(item.line).then(function () {
      AI.refresh();
      UI.toast('Removed ' + splitUrl(item.url).host + ' from the inbox.', {
        action: {
          label: 'Undo',
          run: function () {
            window.appendToInbox(item.url, item.note).then(AI.refresh, function (err) {
              UI.toast(err.message, { tone: 'error' });
            });
          },
        },
      });
    }, function (err) {
      button.disabled = false;
      UI.toast(err.message, { tone: 'error' });
    });
  }

  function buildItem(item, opts) {
    var parts = splitUrl(item.url);
    var active = opts.draining && item.url === AI.drain.currentUrl;
    var tags = [];
    if (active) tags.push(el('span', { class: 'inbox-tag is-active' }, [el('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Analysing']));
    if (item.duplicate) tags.push(el('span', { class: 'inbox-tag', title: 'Draining will just clear it from the inbox', text: 'Already in library' }));
    if (/fetch failed:/.test(item.note || '')) tags.push(el('span', { class: 'inbox-tag is-warn', text: 'Last try failed' }));

    var main = el('div', { class: 'inbox-item-main' }, [
      el('a', { class: 'inbox-item-url', href: item.url, target: '_blank', rel: 'noopener noreferrer', title: item.url }, [
        el('span', { class: 'inbox-host', text: parts.host }),
        el('span', { class: 'inbox-path', text: parts.rest }),
      ]),
      item.note ? el('p', { class: 'inbox-item-note', text: item.note }) : null,
      tags.length ? el('div', { class: 'inbox-tags' }, tags) : null,
    ]);
    var row = el('li', { class: 'inbox-item' + (active ? ' is-active' : '') }, [main]);
    if (opts.removable) {
      var remove = el('button', {
        class: 'icon-btn inbox-remove',
        type: 'button',
        'aria-label': 'Remove ' + parts.host + ' from the inbox',
        title: opts.draining ? 'Wait for the drain to finish' : 'Remove from inbox',
        disabled: opts.draining,
      }, [icon('close')]);
      remove.addEventListener('click', function () { removeItem(item, remove); });
      row.appendChild(remove);
    }
    return row;
  }

  function renderList() {
    var d = drawer;
    var status = AI.status();
    d.list.textContent = '';
    if (!AI.served || !status) {
      d.countLabel.textContent = '';
      if (addedHere.length) {
        d.list.appendChild(el('p', { class: 'inbox-section-label', text: 'Added just now' }));
        d.list.appendChild(el('ul', { class: 'inbox-items' }, addedHere.map(function (item) {
          return buildItem(item, { removable: false });
        })));
      } else {
        d.list.appendChild(el('div', { class: 'inbox-empty' }, [
          el('p', { text: 'Links you add are saved to inbox.md in the library folder.' }),
          el('p', { class: 'inbox-empty-hint', text: 'To see what’s waiting and drain it, open the library through its helper — “Connect AI” below starts it.' }),
        ]));
      }
      return;
    }
    var items = status.inbox.items || [];
    d.countLabel.textContent = items.length ? String(items.length) : '';
    if (!items.length) {
      d.list.appendChild(el('div', { class: 'inbox-empty' }, [
        el('p', { text: 'Nothing waiting.' }),
        el('p', { class: 'inbox-empty-hint', text: 'Paste a link above — or anywhere on the page — and it lands here, ready to drain.' }),
      ]));
      return;
    }
    var draining = AI.drain.running;
    d.list.appendChild(el('ul', { class: 'inbox-items' }, items.map(function (item) {
      return buildItem(item, { removable: true, draining: draining });
    })));
    if (status.inbox.malformed) {
      d.list.appendChild(el('p', { class: 'inbox-empty-hint', text: UI.plural(status.inbox.malformed, 'line') + ' in inbox.md couldn’t be read and will be left alone.' }));
    }
  }

  // ---- the footer: draining ---------------------------------------------------------

  function footerKind() {
    var status = AI.status();
    var drain = AI.drain;
    if (!AI.served) return 'no-helper';
    if (!status) return 'offline';
    if (drain.running) return 'running';
    if (drain.finished) return 'finished';
    if (!status.config.connection) return 'no-ai';
    return status.inbox.captures ? 'ready' : 'empty';
  }

  function lastUsefulLine(lines) {
    for (var i = lines.length - 1; i >= 0; i--) {
      var line = String(lines[i]).trim();
      if (line) return line;
    }
    return '';
  }

  function buildLog() {
    var pre = el('pre', { class: 'drain-log' });
    pre.textContent = AI.drain.lines.join('\n');
    var details = el('details', { class: 'drain-log-details' }, [el('summary', { text: 'Full log' }), pre]);
    details.addEventListener('toggle', function () {
      if (details.open) pre.scrollTop = pre.scrollHeight;
    });
    return details;
  }

  function renderFooter() {
    var d = drawer;
    var kind = footerKind();
    var status = AI.status();
    var drain = AI.drain;

    // While running, update the live pieces in place, so an open log keeps
    // its scroll position and the bar animates rather than being rebuilt.
    if (kind === 'running' && d.footerKind === 'running' && d.live) {
      updateRunning(d.live);
      return;
    }
    d.footerKind = kind;
    d.live = null;
    d.footer.textContent = '';
    var label = status && status.config.connection ? status.config.connection.label : '';

    if (drain.error && kind !== 'running') {
      d.footer.appendChild(el('p', { class: 'drawer-error', text: drain.error }));
    }

    if (kind === 'no-helper') {
      d.footer.appendChild(el('p', { class: 'drawer-footer-text', text: 'Draining happens in the library’s helper, which connects your AI.' }));
      d.footer.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Connect AI', onclick: AI.openConnect }));
    } else if (kind === 'offline') {
      d.footer.appendChild(el('p', { class: 'drawer-footer-text', text: 'Can’t reach the library helper. Is its window still open?' }));
      d.footer.appendChild(el('button', { class: 'btn btn-ghost btn-block', type: 'button', text: 'Try again', onclick: AI.refresh }));
    } else if (kind === 'no-ai') {
      d.footer.appendChild(el('p', { class: 'drawer-footer-text', text: status.inbox.captures ? 'Connect an AI to analyse these and add them to your library.' : 'Connect an AI so these can be analysed when you drain.' }));
      d.footer.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Connect AI', onclick: AI.openConnect }));
    } else if (kind === 'empty') {
      d.footer.appendChild(el('p', { class: 'drawer-footer-text' }, [
        el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
        ' ' + label + ' is ready to drain.',
      ]));
    } else if (kind === 'ready') {
      var n = status.inbox.captures;
      var dups = status.inbox.duplicates;
      d.footer.appendChild(el('button', {
        class: 'btn btn-primary btn-block',
        type: 'button',
        text: 'Drain ' + UI.plural(n, 'capture'),
        onclick: function (evt) {
          evt.currentTarget.disabled = true;
          AI.startDrain();
        },
      }));
      d.footer.appendChild(el('p', { class: 'drawer-footer-meta', text: 'With ' + label + ' · a few minutes each · uses your plan or credit' + (dups ? ' · ' + dups + ' already in the library will just be cleared' : '') + '. You can stop any time; finished ones stay.' }));
    } else if (kind === 'running') {
      var bar = el('div', { class: 'progress' }, [el('div', { class: 'progress-bar' })]);
      var title = el('p', { class: 'drain-title' });
      var line = el('p', { class: 'drain-line' });
      var stop = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [icon('stop'), 'Stop']);
      stop.addEventListener('click', function () {
        stop.disabled = true;
        stop.lastChild.textContent = 'Stopping…';
        AI.stopDrain();
      });
      var log = buildLog();
      d.live = { bar: bar, title: title, line: line, log: log.querySelector('pre') };
      d.footer.appendChild(el('div', { class: 'drain-head' }, [
        el('div', {}, [title, el('p', { class: 'drawer-footer-meta', text: 'With ' + label + '. You can close this — it keeps going.' })]),
        stop,
      ]));
      d.footer.appendChild(bar);
      d.footer.appendChild(line);
      d.footer.appendChild(log);
      updateRunning(d.live);
    } else if (kind === 'finished') {
      d.footer.appendChild(el('div', { class: 'drain-result' + (drain.ok ? '' : ' is-warn') }, [
        icon(drain.ok ? 'check' : 'close'),
        el('p', { class: 'drain-title', text: drain.ok ? 'Drain finished' : 'Drain finished with problems' }),
      ]));
      var summary = summaryLines(drain.lines);
      if (summary.length) d.footer.appendChild(el('ul', { class: 'drain-summary' }, summary.map(function (s) { return el('li', { text: s }); })));
      d.footer.appendChild(buildLog());
      d.footer.appendChild(el('div', { class: 'drawer-footer-actions' }, [
        el('button', {
          class: 'btn btn-ghost',
          type: 'button',
          text: 'Dismiss',
          onclick: function () {
            drain.finished = false;
            renderDrawer();
          },
        }),
        el('button', { class: 'btn btn-primary', type: 'button', text: 'Show new references', onclick: function () { window.location.reload(); } }),
      ]));
    }
  }

  // The "Summary" block API drains end with; agent drains print their own.
  function summaryLines(lines) {
    var at = lines.lastIndexOf('Summary');
    if (at === -1) return [];
    return lines.slice(at + 1).map(function (l) { return String(l).replace(/^-\s*/, '').trim(); }).filter(Boolean).slice(0, 8);
  }

  function updateRunning(live) {
    var drain = AI.drain;
    if (drain.total) {
      live.bar.classList.remove('is-indeterminate');
      live.bar.firstChild.style.width = Math.max(4, ((drain.step - 0.5) / drain.total) * 100) + '%';
      live.title.textContent = 'Analysing ' + splitUrl(drain.currentUrl).host + ' · ' + drain.step + ' of ' + drain.total;
    } else {
      live.bar.classList.add('is-indeterminate');
      live.bar.firstChild.style.width = '';
      live.title.textContent = 'Draining…';
    }
    live.line.textContent = lastUsefulLine(drain.lines) || 'Starting…';
    var pre = live.log;
    var atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
    pre.textContent = drain.lines.join('\n');
    if (atBottom) pre.scrollTop = pre.scrollHeight;
  }

  var lastListKey = '';

  function renderDrawer() {
    if (!isOpen()) return;
    var status = AI.status();
    // Rebuild the list only when what it shows changed — not on every log line.
    var key = JSON.stringify([
      status && status.inbox ? status.inbox.items : null,
      AI.drain.running,
      AI.drain.currentUrl,
      addedHere.length,
    ]);
    if (key !== lastListKey || !drawer.list.firstChild) {
      lastListKey = key;
      renderList();
    }
    renderFooter();
  }

  AI.subscribe(function () {
    refreshButtons();
    renderDrawer();
  });

  // ---- page-wide shortcuts ---------------------------------------------------------
  // Paste a link anywhere (outside a text field) and it opens the inbox with
  // the link ready to add. "I" opens the inbox.

  document.addEventListener('paste', function (evt) {
    if (UI.isTyping(evt.target) || document.querySelector('.add-modal-overlay')) return;
    var text = evt.clipboardData ? evt.clipboardData.getData('text') : '';
    if (!text || !window.parseCaptureInput(text).urls.length) return;
    evt.preventDefault();
    openInbox(text.trim());
  });

  document.addEventListener('keydown', function (evt) {
    if (evt.metaKey || evt.ctrlKey || evt.altKey || UI.isTyping(evt.target)) return;
    if (document.querySelector('.add-modal-overlay, .lightbox')) return;
    if ((evt.key === 'i' || evt.key === 'I') && !isOpen()) {
      evt.preventDefault();
      openInbox();
    }
  });

  window.openInbox = openInbox;
})();
