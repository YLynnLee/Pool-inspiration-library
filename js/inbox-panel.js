// The Add drawer: the one place links go in and get analysed. Adding a
// link, seeing what's waiting, taking one back out, and analysing them all
// live here, so the whole add → analyse loop reads as one list rather than
// an Add dialog in one corner and a count in another. (The collector never
// sees the words "inbox" or "drain"; the code keeps them for the file and
// the procedure behind it.)
//
// Writes only ever happen in direct response to the collector (Add, Remove,
// Drain) — never on load, never on a timer. See CONTRIBUTING.md.
(function () {
  'use strict';

  var UI = window.UI;
  var el = UI.el;
  var icon = UI.icon;
  var AI = window.LibraryAI;

  // Links this page has seen, newest first ([{ url, note }]). A link leaves
  // the helper's inbox once it is analysed, and a page that isn't served by
  // the helper can't read the inbox at all — so this is what keeps every
  // added link in the list. Kept for the browser session so a reload after a
  // run still shows what was added.
  var KNOWN_KEY = 'pool.addedLinks';
  var known = loadKnown();
  // Links sent back to Waiting this session; their old failure no longer counts.
  var retried = [];

  function loadKnown() {
    try {
      var list = JSON.parse(window.sessionStorage.getItem(KNOWN_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (k) { return k && typeof k.url === 'string'; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveKnown() {
    try {
      window.sessionStorage.setItem(KNOWN_KEY, JSON.stringify(known));
    } catch (e) {
      // Private window or blocked storage: the list just won't survive a reload.
    }
  }

  function knownIndex(url) {
    for (var i = 0; i < known.length; i++) if (sameUrl(known[i].url, url)) return i;
    return -1;
  }

  function remember(url, note) {
    var at = knownIndex(url);
    if (at !== -1) known.splice(at, 1);
    known.unshift({ url: url, note: note || '' });
    saveKnown();
  }

  function forget(url) {
    var at = knownIndex(url);
    if (at === -1) return;
    known.splice(at, 1);
    saveKnown();
  }

  // Anything waiting in the inbox is a link the page should keep showing.
  function syncKnown(status) {
    var changed = false;
    ((status && status.inbox && status.inbox.items) || []).forEach(function (item) {
      if (knownIndex(item.url) === -1) {
        known.push({ url: item.url, note: item.note || '' });
        changed = true;
      }
    });
    if (changed) saveKnown();
  }

  // ---- header button ------------------------------------------------------------

  function fillButton(button) {
    var status = AI.status();
    var drain = AI.drain;
    button.textContent = '';
    button.classList.toggle('is-busy', drain.running);
    if (drain.running) {
      button.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' }));
      button.appendChild(el('span', { text: drain.total ? 'Analysing ' + drain.step + ' of ' + drain.total : 'Analysing…' }));
      button.title = 'Show progress';
      return;
    }
    button.appendChild(icon('plus'));
    button.appendChild(el('span', { text: 'Add reference' }));
    var count = status && status.inbox ? status.inbox.captures : 0;
    if (count) button.appendChild(el('span', { class: 'count-badge', text: String(count) }));
    button.title = count ? UI.plural(count, 'link') + ' waiting (I)' : 'Add a reference (I)';
  }

  function refreshButtons() {
    Array.prototype.forEach.call(document.querySelectorAll('.inbox-btn'), fillButton);
  }

  window.buildInboxButton = function () {
    var button = el('button', { class: 'btn btn-secondary inbox-btn', type: 'button', onclick: function () { openInbox(); } });
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
    var feedback = el('div', { class: 'notice-slot' });
    var form = el('form', { class: 'inbox-add', novalidate: true }, [
      el('div', { class: 'inbox-add-row' }, [input, addBtn]),
      note,
      el('div', { class: 'inbox-add-meta' }, [noteToggle]),
      feedback,
    ]);
    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      addFromInput();
    });

    var list = el('div', { class: 'inbox-list' });
    var footer = el('div', { class: 'drawer-footer' });
    var close = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: closeInbox }, [icon('close')]);
    var countLabel = el('span', { class: 'drawer-count' });

    var panel = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'inbox-title' }, [
      el('header', { class: 'drawer-header' }, [
        el('div', {}, [
          el('h2', { class: 'drawer-title', id: 'inbox-title' }, ['Add references ', countLabel]),
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

  // Report into the form's notice slot: what happened, and how to fix it.
  function setFeedback(tone, title, text) {
    UI.setNotice(drawer.feedback, tone, { title: title, text: text });
  }

  // ---- adding ---------------------------------------------------------------------

  // Looser than the drain's exact-string dedupe on purpose: this only warns
  // before adding, so "medium.com" should count as the waiting
  // "https://medium.com/".
  function sameUrl(a, b) {
    return window.LinkStatus.key(a) === window.LinkStatus.key(b);
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
      setFeedback('error', parsed.rejected.length ? 'That isn’t a link' : 'Nothing to add', parsed.rejected.length ? 'Paste an address that starts with https://' : 'Paste a link first.');
      d.input.focus();
      return;
    }
    var status = AI.status();
    var waiting = status && status.inbox ? status.inbox.urls : known.map(function (k) { return k.url; });
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
    setFeedback(null);

    var chain = Promise.resolve();
    toAdd.forEach(function (url) {
      chain = chain.then(function () {
        return window.appendToInbox(url, noteText).then(function () {
          added++;
          remember(url, noteText.trim());
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
        setFeedback(added ? 'success' : 'warning', parts[0] || 'Nothing added', parts.slice(1).join(' '));
        d.input.value = '';
        d.note.value = '';
        d.note.hidden = true;
        d.noteToggle.hidden = false;
        d.input.focus();
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'Could not save. Nothing was changed.';
        setFeedback('error', added ? 'Added ' + added + ', then stopped' : 'Couldn’t add the link', msg);
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


  // The helper's own record of a waiting link: its exact line is what Remove needs.
  function inboxItemFor(url) {
    var status = AI.status();
    var items = (status && status.inbox && status.inbox.items) || [];
    for (var i = 0; i < items.length; i++) if (sameUrl(items[i].url, url)) return items[i];
    return null;
  }

  function removeLink(link, button) {
    var item = inboxItemFor(link.url);
    if (!item) return;
    button.disabled = true;
    window.removeFromInbox(item.line).then(function () {
      forget(link.url);
      AI.refresh();
      UI.toast('Removed ' + link.host + '.', {
        action: {
          label: 'Undo',
          run: function () {
            window.appendToInbox(link.url, link.note).then(function () {
              remember(link.url, link.note);
              AI.refresh();
            }, function (err) {
              if (drawer) setFeedback('error', 'Couldn’t put ' + link.host + ' back', err.message);
            });
          },
        },
      });
    }, function (err) {
      button.disabled = false;
      if (drawer) setFeedback('error', 'Couldn’t remove ' + link.host, err.message);
    });
  }

  // Retry puts the link back to Waiting: its line is rewritten without the
  // failure the helper noted on it, so the next run starts clean.
  function retryLink(link, button) {
    var item = inboxItemFor(link.url);
    button.disabled = true;
    var rewrite = item ? window.removeFromInbox(item.line).then(function () {
      // If the clean line can't be written, put the original back rather than lose the link.
      return window.appendToInbox(link.url, link.note).catch(function (err) {
        return window.appendToInbox(item.url, item.note).then(function () { throw err; });
      });
    }) : Promise.resolve();
    rewrite.then(function () {
      if (retried.indexOf(link.url) === -1) retried.push(link.url);
      remember(link.url, link.note);
      if (AI.served) AI.refresh();
      else renderDrawer();
    }, function (err) {
      button.disabled = false;
      if (drawer) setFeedback('error', 'Couldn’t retry ' + link.host, err.message);
    });
  }

  function trailingControl(link, busy) {
    if (link.status === 'added') {
      var open = el('a', {
        class: 'icon-btn',
        href: link.reference ? '#/entry/' + encodeURIComponent(link.reference.id) : '#/',
        'aria-label': link.reference ? 'Open ' + link.reference.name : 'Open in the library',
        title: 'Open in library',
      }, [icon('forward')]);
      open.addEventListener('click', function () {
        closeInbox();
        // The page loaded before this run, so it has to reload to know the new reference.
        if (!link.reference) window.setTimeout(function () { window.location.reload(); }, 0);
      });
      return open;
    }
    if ((link.status === 'waiting' || link.status === 'failed') && AI.served && inboxItemFor(link.url)) {
      var remove = el('button', {
        class: 'icon-btn',
        type: 'button',
        'aria-label': 'Remove ' + link.host,
        title: busy ? 'Wait for analysing to finish' : 'Remove',
        disabled: busy,
      }, [icon('trash')]);
      remove.addEventListener('click', function () { removeLink(link, remove); });
      return remove;
    }
    return null;
  }

  function buildLinkRow(link, busy) {
    var main = el('div', { class: 'link-row-main' }, [
      el('p', { class: 'link-host', text: link.host }),
      el('a', { class: 'link-url', href: link.url, target: '_blank', rel: 'noopener noreferrer', title: link.url, text: link.url }),
      link.note ? el('p', { class: 'link-note', text: link.note }) : null,
    ]);
    var row = el('li', { class: 'link-row is-' + link.status }, [
      el('div', { class: 'link-row-line' }, [main, UI.status(link.status), trailingControl(link, busy)]),
    ]);
    if (link.status === 'failed') {
      row.appendChild(UI.notice('error', {
        title: link.reason,
        text: link.fix,
        actions: [{ label: 'Retry', run: function (evt) { retryLink(link, evt.currentTarget); } }],
      }));
    }
    return row;
  }

  function derived() {
    var status = AI.status();
    var served = AI.served && status;
    return window.LinkStatus.derive({
      inbox: served ? status.inbox : null,
      known: known,
      library: window.getEntries(),
      drain: AI.drain,
      retried: retried,
    });
  }

  function renderList() {
    var d = drawer;
    var status = AI.status();
    d.list.textContent = '';
    var result = derived();
    d.countLabel.textContent = result.links.length ? String(result.links.length) : '';
    if (!result.links.length) {
      d.list.appendChild(el('div', { class: 'inbox-empty' }, [el('p', { text: 'Nothing added yet.' })]));
      return;
    }
    var busy = AI.drain.running;
    d.list.appendChild(el('ul', { class: 'link-rows' }, result.links.map(function (link) {
      return buildLinkRow(link, busy);
    })));
    if (status && status.inbox && status.inbox.malformed) {
      d.list.appendChild(UI.notice('warning', { title: UI.plural(status.inbox.malformed, 'saved line') + ' couldn’t be read', text: 'It’s left alone.' }));
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
      d.footer.appendChild(UI.notice('error', { title: 'Analysing stopped', text: drain.error }));
    }

    if (kind === 'no-helper') {
      d.footer.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Connect AI', onclick: AI.openConnect }));
    } else if (kind === 'offline') {
      d.footer.appendChild(UI.notice('error', {
        title: 'Can’t reach the library helper',
        text: 'Check its window is still open.',
        actions: [{ label: 'Try again', run: AI.refresh }],
      }));
    } else if (kind === 'no-ai') {
      d.footer.appendChild(UI.notice('info', { title: 'No AI connected', text: 'Connect one to analyse your links.' }));
      d.footer.appendChild(el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Connect AI', onclick: AI.openConnect }));
    } else if (kind === 'empty') {
      d.footer.appendChild(el('p', { class: 'drawer-footer-text' }, [
        el('span', { class: 'ai-dot', 'aria-hidden': 'true' }),
        ' ' + label + ' is ready.',
      ]));
    } else if (kind === 'ready') {
      var n = status.inbox.captures;
      var dups = status.inbox.duplicates;
      d.footer.appendChild(el('button', {
        class: 'btn btn-primary btn-block',
        type: 'button',
        text: 'Analyse ' + UI.plural(n, 'link'),
        onclick: function (evt) {
          evt.currentTarget.disabled = true;
          AI.startDrain();
        },
      }));
      d.footer.appendChild(el('p', { class: 'drawer-footer-meta', text: 'With ' + label + ' · uses your plan or credit' + (dups ? ' · ' + dups + ' already in the library will just be cleared' : '') }));
    } else if (kind === 'running') {
      var bar = el('div', { class: 'progress' }, [el('div', { class: 'progress-bar' })]);
      var title = el('p', { class: 'drain-title' });
      var line = el('p', { class: 'drain-line' });
      var stop = el('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, [icon('stop'), 'Stop']);
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
      d.footer.appendChild(UI.notice(drain.ok ? 'success' : 'warning', { title: drain.ok ? 'Analysis finished' : 'Analysis finished with problems' }));
      var summary = summaryLines(drain.lines);
      if (summary.length) d.footer.appendChild(el('ul', { class: 'drain-summary' }, summary.map(function (s) { return el('li', { text: s }); })));
      d.footer.appendChild(buildLog());
      d.footer.appendChild(el('div', { class: 'drawer-footer-actions' }, [
        el('button', {
          class: 'btn btn-secondary',
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
      live.title.textContent = 'Analysing ' + window.LinkStatus.hostOf(drain.currentUrl) + ' · ' + drain.step + ' of ' + drain.total;
    } else {
      live.bar.classList.add('is-indeterminate');
      live.bar.firstChild.style.width = '';
      live.title.textContent = 'Analysing…';
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
    syncKnown(status);
    // A new run reports its own failures; the old Retry no longer applies.
    if (AI.drain.running && retried.length) retried = [];
    var key = JSON.stringify([
      status && status.inbox ? status.inbox.items : null,
      AI.drain.running,
      AI.drain.currentUrl,
      AI.drain.finished,
      AI.drain.error,
      known,
      retried,
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
  // Paste a link anywhere (outside a text field) and it opens the drawer with
  // the link ready to add. "I" opens the drawer.

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
