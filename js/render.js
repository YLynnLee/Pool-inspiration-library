// Render module: builds DOM, owns the hash router. Depends on data-access.js
// and query.js; nothing depends on this file.
(function () {
  'use strict';

  var HIDDEN_KEY = 'pool:hidden-ids';
  var app = document.getElementById('app');
  var UI = window.UI;
  var icon = UI.icon;

  // ---- tombstones (see docs/agents/drain.md) ----------

  function getHiddenIds() {
    try {
      var raw = window.localStorage.getItem(HIDDEN_KEY);
      var ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids : [];
    } catch (err) {
      return [];
    }
  }

  function setHiddenIds(ids) {
    try {
      window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
    } catch (err) {
      /* localStorage unavailable — hiding degrades to session-only, no crash */
    }
  }

  function hideEntry(id) {
    var ids = getHiddenIds();
    if (ids.indexOf(id) === -1) ids.push(id);
    setHiddenIds(ids);
  }

  function restoreEntry(id) {
    setHiddenIds(getHiddenIds().filter(function (hiddenId) {
      return hiddenId !== id;
    }));
  }

  // ---- routing ---------------------------------------------------------

  function parseHash() {
    var hash = window.location.hash || '#/';
    hash = hash.replace(/^#/, '');
    if (hash.indexOf('/') !== 0) hash = '/' + hash;

    var entryMatch = hash.match(/^\/entry\/([^/?]+)/);
    if (entryMatch) {
      return { view: 'entry', id: decodeURIComponent(entryMatch[1]) };
    }

    var qIndex = hash.indexOf('?');
    var params = new URLSearchParams(qIndex >= 0 ? hash.slice(qIndex + 1) : '');
    var show = params.get('show') || '';
    return {
      view: 'grid',
      query: params.get('q') || '',
      category: params.get('category') || '',
      keyword: params.get('keyword') || '',
      show: show === 'drafts' || show === 'hidden' ? show : '',
    };
  }

  function buildGridHash(filters) {
    var params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.category) params.set('category', filters.category);
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.show) params.set('show', filters.show);
    var qs = params.toString();
    return '#/' + (qs ? '?' + qs : '');
  }

  // Filter changes on the grid update the URL without a hashchange, and only
  // the parts of the page that depend on them — so typing in search never
  // rebuilds the header or loses the caret, and a pill click never jumps to
  // the top. `push` gives the change its own Back step; typing doesn't.
  var lastRouteKey = '';

  function setFilters(next, push) {
    var hash = buildGridHash(next);
    var url = window.location.pathname + window.location.search + hash;
    window.history[push ? 'pushState' : 'replaceState'](null, '', url);
    lastRouteKey = hash;
    updateGrid(next);
  }

  var NO_FILTERS = { query: '', category: '', keyword: '', show: '' };

  // ---- helpers -----------------------------------------------------

  var el = UI.el;

  // execCommand first: synchronous, no permission prompt, works under
  // file:// and under automation. navigator.clipboard.writeText can hang
  // indefinitely waiting on a permission prompt with no UI to answer it
  // (seen under CDP-driven Chrome), so it is only a fallback enhancement,
  // raced against a short timeout rather than awaited unconditionally.
  function copyText(text, onDone) {
    function done(ok) {
      if (onDone) onDone(ok);
    }
    if (legacyCopy(text)) {
      done(true);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      var settled = false;
      var timer = window.setTimeout(function () {
        if (!settled) {
          settled = true;
          done(false);
        }
      }, 1200);
      navigator.clipboard.writeText(text).then(
        function () {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            done(true);
          }
        },
        function () {
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            done(false);
          }
        }
      );
    } else {
      done(false);
    }
  }

  function legacyCopy(text) {
    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function flashCopied(button, label) {
    var original = button.textContent;
    button.textContent = label || 'Copied!';
    button.classList.add('is-copied');
    window.setTimeout(function () {
      button.textContent = original;
      button.classList.remove('is-copied');
    }, 1400);
  }

  // ---- grid view -----------------------------------------------------
  //
  // renderGrid builds the page shell once; updateGrid fills in everything a
  // filter can change: the view switch (All / Drafts / Hidden), category
  // pills with counts over the other active filters, the active-filter
  // tokens, and the tiles.

  var gridView = null; // { root, filters, search, segments, pills, meta, results }

  function isGridMounted() {
    return !!(gridView && document.body.contains(gridView.root));
  }

  function refreshGrid() {
    if (isGridMounted()) updateGrid(gridView.filters);
  }

  function renderGrid(filters) {
    var root = el('div', { class: 'view view-grid' });
    var search = buildSearch();
    var segments = el('div', { class: 'segments-slot' });
    var pills = el('div', { class: 'pill-row', role: 'group', 'aria-label': 'Filter by category' });
    var meta = el('div', { class: 'filter-meta' });
    var results = el('div', { class: 'results', 'aria-live': 'polite', 'aria-busy': 'false' });

    root.appendChild(el('header', { class: 'library-header' }, [
      el('div', { class: 'library-title-row' }, [
        el('h1', { class: 'library-title', text: 'Pool' }),
        el('div', { class: 'library-actions' }, [
          window.buildAiHeader ? window.buildAiHeader() : null,
          window.buildInboxButton ? window.buildInboxButton() : null,
        ]),
      ]),
      el('div', { class: 'filter-bar' }, [search.wrap, segments]),
      pills,
      meta,
    ]));
    root.appendChild(results);

    gridView = { root: root, filters: filters, search: search, segments: segments, pills: pills, meta: meta, results: results };
    search.input.value = filters.query;
    search.sync();

    app.innerHTML = '';
    app.appendChild(root);
    updateGrid(filters);
  }

  function updateGrid(filters) {
    if (!isGridMounted()) return renderGrid(filters);
    gridView.filters = filters;
    if (document.activeElement !== gridView.search.input && gridView.search.input.value !== filters.query) {
      gridView.search.input.value = filters.query;
    }
    gridView.search.sync();

    var all = window.sortEntries(window.getEntries());
    var hiddenIds = getHiddenIds();
    var notHidden = window.visibleEntries(all, hiddenIds);
    var hidden = all.filter(function (e) { return hiddenIds.indexOf(e.id) !== -1; });
    var drafts = window.draftEntries(notHidden);
    var pool = filters.show === 'hidden' ? hidden : filters.show === 'drafts' ? drafts : notHidden;

    // Counts on the pills answer "how many would I get if I clicked this",
    // so they're taken after search and keyword but before category.
    var facet = window.filterEntries(pool, { query: filters.query, keyword: filters.keyword });
    var matched = window.filterEntries(facet, { category: filters.category });

    fillSegments(filters, notHidden.length, drafts.length, hidden.length);
    fillPills(filters, window.countByCategory(facet), window.countByCategory(pool), facet.length);
    fillMeta(filters, matched.length, pool.length);

    gridView.results.textContent = '';
    if (matched.length === 0) {
      gridView.results.appendChild(buildEmptyState(filters, all.length));
    } else {
      var grid = el('div', { class: 'grid' });
      matched.forEach(function (entry) {
        grid.appendChild(buildTile(entry, hiddenIds.indexOf(entry.id) !== -1));
      });
      gridView.results.appendChild(grid);
    }
  }

  // -- search, with keyword and category suggestions as you type

  function buildSearch() {
    var listId = 'search-suggestions';
    var input = el('input', {
      class: 'search-input',
      type: 'text',
      placeholder: 'Search references, keywords, categories…',
      'aria-label': 'Search references',
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': listId,
      autocomplete: 'off',
      spellcheck: 'false',
    });
    var clear = el('button', { class: 'search-clear icon-btn', type: 'button', 'aria-label': 'Clear search', hidden: true }, [icon('close')]);
    var hint = el('kbd', { class: 'search-kbd', text: '/', title: 'Press / to search' });
    var list = el('div', { class: 'suggestions', id: listId, role: 'listbox', hidden: true });
    var wrap = el('div', { class: 'search-wrap' }, [icon('search', 'search-icon'), input, clear, hint, list]);

    var options = [];
    var active = -1;

    function sync() {
      var has = !!input.value;
      clear.hidden = !has;
      hint.hidden = has || document.activeElement === input;
    }

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }

    function setActive(index) {
      active = index;
      options.forEach(function (opt, i) {
        opt.node.classList.toggle('is-active', i === index);
        opt.node.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
      if (index >= 0) {
        input.setAttribute('aria-activedescendant', options[index].node.id);
        options[index].node.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function choose(opt) {
      var f = gridView.filters;
      input.value = '';
      close();
      if (opt.kind === 'keyword') setFilters(Object.assign({}, f, { keyword: opt.value, query: '' }), true);
      else setFilters(Object.assign({}, f, { category: opt.value, query: '' }), true);
      input.focus();
    }

    function suggest() {
      var q = input.value.trim();
      options = [];
      list.textContent = '';
      if (!q) return close();
      var f = gridView.filters;
      var entries = window.visibleEntries(window.getEntries(), getHiddenIds());
      var counts = window.countByCategory(entries);
      var lower = q.toLowerCase();
      var cats = window.getCategories().filter(function (cat) {
        return counts[cat.id] && cat.id !== f.category && cat.name.toLowerCase().indexOf(lower) !== -1;
      }).slice(0, 3);
      var kws = window.keywordSuggestions(entries, q, 6).filter(function (k) {
        return k.keyword.toLowerCase() !== (f.keyword || '').toLowerCase();
      });

      function group(label, items, build) {
        if (!items.length) return;
        list.appendChild(el('p', { class: 'suggestions-label', text: label }));
        items.forEach(function (item) {
          var opt = build(item);
          opt.node = el('div', { class: 'suggestion', role: 'option', id: 'suggestion-' + options.length, 'aria-selected': 'false' }, [
            icon(opt.kind === 'keyword' ? 'tag' : 'folder'),
            el('span', { class: 'suggestion-text', text: opt.label }),
            el('span', { class: 'suggestion-count', text: String(opt.count) }),
          ]);
          opt.node.addEventListener('mousedown', function (evt) { evt.preventDefault(); });
          opt.node.addEventListener('click', function () { choose(opt); });
          options.push(opt);
          list.appendChild(opt.node);
        });
      }
      group('Filter by category', cats, function (cat) {
        return { kind: 'category', value: cat.id, label: cat.name, count: counts[cat.id] };
      });
      group('Filter by keyword', kws, function (k) {
        return { kind: 'keyword', value: k.keyword, label: k.keyword, count: k.count };
      });
      if (!options.length) return close();
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      setActive(-1);
    }

    input.addEventListener('input', function () {
      setFilters(Object.assign({}, gridView.filters, { query: input.value }), false);
      suggest();
    });
    input.addEventListener('focus', function () {
      sync();
      suggest();
    });
    input.addEventListener('blur', function () {
      close();
      sync();
    });
    input.addEventListener('keydown', function (evt) {
      var open = !list.hidden && options.length;
      if (evt.key === 'ArrowDown' && open) {
        evt.preventDefault();
        setActive((active + 1) % options.length);
      } else if (evt.key === 'ArrowUp' && open) {
        evt.preventDefault();
        setActive(active <= 0 ? options.length - 1 : active - 1);
      } else if (evt.key === 'Enter') {
        if (open && active >= 0) {
          evt.preventDefault();
          choose(options[active]);
        } else {
          close();
        }
      } else if (evt.key === 'Escape') {
        if (open) close();
        else if (input.value) {
          input.value = '';
          setFilters(Object.assign({}, gridView.filters, { query: '' }), false);
        } else input.blur();
      }
    });
    clear.addEventListener('click', function () {
      input.value = '';
      setFilters(Object.assign({}, gridView.filters, { query: '' }), false);
      close();
      input.focus();
    });

    return { wrap: wrap, input: input, sync: sync };
  }

  // -- All / Drafts / Hidden. Shown only when there are drafts or hidden
  // references to switch to; a library with neither needs no switch.

  function fillSegments(filters, allCount, draftCount, hiddenCount) {
    var slot = gridView.segments;
    slot.textContent = '';
    var specs = [{ id: '', label: 'All', count: allCount }];
    if (draftCount || filters.show === 'drafts') specs.push({ id: 'drafts', label: 'Drafts', count: draftCount, tone: 'draft' });
    if (hiddenCount || filters.show === 'hidden') specs.push({ id: 'hidden', label: 'Hidden', count: hiddenCount });
    if (specs.length === 1) return;
    slot.appendChild(el('div', { class: 'segmented', role: 'group', 'aria-label': 'Show' }, specs.map(function (spec) {
      var on = filters.show === spec.id;
      return el('button', {
        class: 'segment' + (spec.tone ? ' is-' + spec.tone : ''),
        type: 'button',
        'aria-pressed': on ? 'true' : 'false',
        title: spec.id === 'drafts' ? 'References whose capture needs attention' : spec.id === 'hidden' ? 'References you hid — restore or delete them' : 'Everything in your library',
        onclick: function () {
          if (!on) setFilters(Object.assign({}, filters, { show: spec.id }), true);
        },
      }, [spec.label + ' ', el('span', { class: 'segment-count', text: String(spec.count) })]);
    })));
  }

  // -- category pills. Categories nothing in view belongs to are left out
  // rather than shown with a 0; the active one always stays.

  function fillPills(filters, facetCounts, poolCounts, facetTotal) {
    var wrap = gridView.pills;
    wrap.textContent = '';
    wrap.appendChild(el('button', {
      class: 'pill' + (filters.category ? '' : ' is-active'),
      type: 'button',
      'aria-pressed': filters.category ? 'false' : 'true',
      onclick: function () {
        if (filters.category) setFilters(Object.assign({}, filters, { category: '' }), true);
      },
    }, ['All ', el('span', { class: 'pill-count', text: String(facetTotal) })]));

    window.getCategories().forEach(function (cat) {
      var on = filters.category === cat.id;
      if (!poolCounts[cat.id] && !on) return;
      var count = facetCounts[cat.id] || 0;
      wrap.appendChild(el('button', {
        class: 'pill' + (on ? ' is-active' : '') + (count ? '' : ' is-empty'),
        type: 'button',
        'aria-pressed': on ? 'true' : 'false',
        title: cat.definition || cat.name,
        onclick: function () {
          setFilters(Object.assign({}, filters, { category: on ? '' : cat.id }), true);
        },
      }, [cat.name + ' ', el('span', { class: 'pill-count', text: String(count) })]));
    });
  }

  // -- the tokens row: every active filter as something you can remove one
  // by one, plus how many references are showing.

  function fillMeta(filters, shown, total) {
    var wrap = gridView.meta;
    wrap.textContent = '';
    var tokens = [];
    function token(kind, label, value, without) {
      tokens.push(el('span', { class: 'filter-token is-' + kind }, [
        el('span', { class: 'filter-token-kind', text: label }),
        el('span', { class: 'filter-token-value', text: value }),
        el('button', {
          class: 'filter-token-remove',
          type: 'button',
          'aria-label': 'Remove ' + label.toLowerCase() + ' filter ' + value,
          onclick: function () { setFilters(Object.assign({}, filters, without), true); },
        }, [icon('close')]),
      ]));
    }
    if (filters.query) token('query', 'Search', '“' + filters.query + '”', { query: '' });
    if (filters.category) {
      var cat = window.getCategory(filters.category);
      token('category', 'Category', cat ? cat.name : filters.category, { category: '' });
    }
    if (filters.keyword) token('keyword', 'Keyword', filters.keyword, { keyword: '' });

    var noun = filters.show === 'drafts' ? 'draft' : filters.show === 'hidden' ? 'hidden reference' : 'reference';
    var countText = tokens.length ? shown + ' of ' + UI.plural(total, noun) : UI.plural(total, noun);
    wrap.appendChild(el('span', { class: 'result-count', text: countText }));
    tokens.forEach(function (t) { wrap.appendChild(t); });
    if (tokens.length > 1) {
      wrap.appendChild(el('button', {
        class: 'clear-filters',
        type: 'button',
        text: 'Clear all',
        onclick: function () { setFilters(Object.assign({}, NO_FILTERS, { show: filters.show }), true); },
      }));
    }
  }

  function buildEmptyState(filters, libraryTotal) {
    var hasFilters = !!(filters.query || filters.category || filters.keyword);
    var title;
    var hint = '';
    var action = null;
    if (hasFilters) {
      title = filters.query ? 'Nothing matches “' + filters.query + '”.' : 'Nothing matches these filters.';
      hint = 'Try fewer words, or remove a filter above.';
      action = el('button', {
        class: 'btn btn-ghost',
        type: 'button',
        text: 'Clear filters',
        onclick: function () { setFilters(Object.assign({}, NO_FILTERS, { show: filters.show }), true); },
      });
    } else if (filters.show === 'drafts') {
      title = 'No drafts.';
      hint = 'Every capture came through cleanly.';
      action = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Back to all', onclick: function () { setFilters(NO_FILTERS, true); } });
    } else if (filters.show === 'hidden') {
      title = 'Nothing hidden.';
      action = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Back to all', onclick: function () { setFilters(NO_FILTERS, true); } });
    } else if (!libraryTotal) {
      title = 'Your library is empty.';
      hint = 'Paste a link anywhere on this page to add it to the inbox, then drain it.';
      action = el('button', { class: 'btn btn-primary', type: 'button', text: 'Open inbox', onclick: function () { if (window.openInbox) window.openInbox(); } });
    } else {
      title = 'No references to show.';
    }
    return el('div', { class: 'empty-state' }, [
      el('p', { class: 'empty-title', text: title }),
      hint ? el('p', { class: 'empty-hint', text: hint }) : null,
      action,
    ]);
  }

  function buildTile(entry, isHidden) {
    var category = window.getCategory(entry.category);
    var isDraft = window.isDraft(entry);
    var tile = el('div', {
      class: 'tile' + (isHidden ? ' is-hidden' : '') + (isDraft ? ' is-draft' : ''),
    });

    var link = el('a', { class: 'tile-link', href: '#/entry/' + encodeURIComponent(entry.id) });
    var img = el('img', {
      class: 'tile-image',
      src: entry.screenshots && entry.screenshots[0] ? entry.screenshots[0] : '',
      alt: entry.name,
      loading: 'lazy',
    });
    link.appendChild(img);

    if (isDraft) {
      link.appendChild(el('span', { class: 'draft-badge', text: 'Draft' }));
    }
    if (isHidden) {
      link.appendChild(el('span', { class: 'hidden-badge', text: 'Hidden' }));
    }

    var meta = el('div', { class: 'tile-meta' }, [
      el('span', { class: 'tile-name', text: entry.name }),
      el('span', { class: 'tile-category', text: category ? category.name : entry.category }),
    ]);
    if (isDraft && entry.draftReason) {
      meta.appendChild(el('span', { class: 'draft-reason', text: entry.draftReason }));
    }
    link.appendChild(meta);
    tile.appendChild(link);

    function action(label, className, title, handler) {
      return el('button', {
        class: 'tile-action ' + className,
        type: 'button',
        title: title,
        onclick: function (evt) {
          evt.preventDefault();
          evt.stopPropagation();
          handler();
        },
      }, [label]);
    }

    if (isHidden) {
      // A hidden reference's two ways out, side by side and labelled,
      // instead of one ambiguous icon.
      tile.appendChild(el('div', { class: 'tile-actions' }, [
        action('Restore', 'is-restore', 'Show this reference in the library again', function () {
          restoreEntry(entry.id);
          refreshGrid();
          UI.toast('Restored ' + entry.name + '.');
        }),
        action('Delete…', 'is-delete', 'Delete this reference for good', function () {
          openPurgeModal(entry);
        }),
      ]));
      return tile;
    }

    if (isDraft) {
      tile.appendChild(el('div', { class: 'tile-actions' }, [
        action('Resolve…', 'is-resolve', 'Assign a category to this draft', function () {
          openResolveModal(entry);
        }),
      ]));
    }

    tile.appendChild(el('button', {
      class: 'tile-hide-btn',
      type: 'button',
      title: 'Delete this reference',
      'aria-label': 'Delete ' + entry.name,
      onclick: function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        openPurgeModal(entry);
      },
    }, [icon('trash')]));

    return tile;
  }

  // ---- detail view -----------------------------------------------------

  function renderDetail(id) {
    var entry = window.getEntry(id);
    var root = el('div', { class: 'view view-entry' });

    root.appendChild(
      el('a', { class: 'back-link', href: '#/', text: '‹ All references' })
    );

    if (!entry) {
      root.appendChild(
        el('div', { class: 'not-found' }, [
          el('p', { text: 'Reference not found. It may have been removed.' }),
        ])
      );
      app.innerHTML = '';
      app.appendChild(root);
      return;
    }

    var category = window.getCategory(entry.category);

    if (window.isDraft(entry)) {
      root.appendChild(
        el('div', { class: 'detail-draft-notice' }, [
          el('span', { class: 'draft-badge', text: 'Draft' }),
          entry.draftReason ? el('span', { class: 'draft-reason', text: entry.draftReason }) : null,
        ])
      );
    }

    // 1. hero screenshot
    var heroWrap = el('div', { class: 'hero-wrap' });
    var hero = el('img', {
      class: 'hero-image',
      src: entry.screenshots[0],
      alt: entry.name,
    });
    hero.addEventListener('click', function () {
      openLightbox(entry.screenshots[0], entry.name);
    });
    heroWrap.appendChild(hero);
    root.appendChild(heroWrap);

    if (entry.screenshots.length > 1) {
      var extra = el('div', { class: 'extra-screenshots' });
      entry.screenshots.slice(1).forEach(function (src) {
        var img = el('img', { class: 'extra-screenshot', src: src, alt: entry.name });
        img.addEventListener('click', function () {
          openLightbox(src, entry.name);
        });
        extra.appendChild(img);
      });
      root.appendChild(extra);
    }

    // 2. name -> sourceUrl
    var titleRow = el('div', { class: 'entry-title-row' });
    // http(s) only: a javascript: sourceUrl would run in the helper's trusted origin.
    if (/^https?:\/\//i.test(entry.sourceUrl || '')) {
      titleRow.appendChild(
        el('a', {
          class: 'entry-name entry-name-link',
          href: entry.sourceUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: entry.name,
        })
      );
    } else {
      titleRow.appendChild(el('span', { class: 'entry-name', text: entry.name }));
    }
    root.appendChild(titleRow);

    // 3. category badge + one-line definition, expandable to the full essay
    if (category) {
      root.appendChild(buildCategorySection(category));
    }

    // 4. summary
    root.appendChild(el('p', { class: 'entry-summary', text: entry.summary }));

    // 5. keyword chips
    var chipRow = el('div', { class: 'chip-row' });
    (entry.keywords || []).forEach(function (kw) {
      chipRow.appendChild(
        el('a', {
          class: 'chip',
          href: buildGridHash({ query: '', category: '', keyword: kw }),
          text: kw,
        })
      );
    });
    root.appendChild(el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: 'Keywords' }),
      chipRow,
    ]));

    // 6. everything past the header is tabbed: the design
    // system breakdown, the whole DESIGN.md, and the prompts. A reference
    // with no design system still gets tabs — Breakdown falls back to the
    // plain palette + type notes it has always had, and the DESIGN.md tab
    // is simply absent, since six of eight pilot references have no design
    // system and that is a valid state indefinitely.
    root.appendChild(buildDetailTabs(entry, window.getDesignSystem(entry.id)));

    app.innerHTML = '';
    app.appendChild(root);
  }

  // Shared by the plain Palette section and the design system's Colours
  // panel: a colour tile that copies its own hex to the clipboard on click.
  function buildCopySwatch(hex, extraClass) {
    var swatch = el('button', {
      class: extraClass ? 'swatch ' + extraClass : 'swatch',
      type: 'button',
      title: hex,
      style: 'background-color:' + hex,
    });
    swatch.appendChild(el('span', { class: 'swatch-hex', text: hex }));
    swatch.addEventListener('click', function () {
      copyText(hex, function (ok) {
        flashCopied(swatch, ok ? 'Copied!' : 'Copy failed');
      });
    });
    return swatch;
  }

  function buildPaletteSection(entry) {
    var swatchRow = el('div', { class: 'swatch-row' });
    (entry.palette || []).forEach(function (hex) {
      swatchRow.appendChild(buildCopySwatch(hex));
    });
    return el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: 'Palette' }),
      swatchRow,
    ]);
  }

  // ---- detail tabs -------------------------------------------------------
  // Three ways to read the same reference, rather than one long scroll:
  // the measured breakdown, the whole document, the prompts. Tab state is
  // in-memory and resets to the first tab on navigation — it is deliberately
  // not in the hash, so deep links stay `#/entry/<id>` and the back link
  // keeps behaving exactly as it did.

  function buildPlainStyleSections(entry) {
    var frag = document.createDocumentFragment();
    frag.appendChild(buildPaletteSection(entry));
    frag.appendChild(el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: 'Type' }),
      el('p', { class: 'type-notes', text: entry.typeNotes }),
    ]));
    return frag;
  }

  function buildPromptsPanel(entry) {
    var frag = document.createDocumentFragment();
    frag.appendChild(buildPromptBlock('Image prompt', entry.imagePrompt));
    frag.appendChild(buildPromptBlock('Brief', entry.brief));
    return frag;
  }

  function buildDetailTabs(entry, ds) {
    var specs = [
      {
        id: 'breakdown',
        label: 'Breakdown',
        build: function () {
          return ds ? buildDesignSystemSections(ds) : buildPlainStyleSections(entry);
        },
      },
    ];
    // No design system, no document to show — the tab is absent rather than
    // present and empty, the same rule the panels themselves follow.
    if (ds) {
      specs.push({
        id: 'design-md',
        label: 'DESIGN.md',
        build: function () {
          return buildDesignMdPanel(ds);
        },
      });
    }
    // Prompts hang off the reference, not the design system, so this tab is
    // always here.
    specs.push({
      id: 'prompts',
      label: 'Prompts',
      build: function () {
        return buildPromptsPanel(entry);
      },
    });

    var strip = el('div', { class: 'tab-strip', role: 'tablist' });
    var body = el('div', { class: 'tab-body' });
    var buttons = [];
    var panels = [];

    function select(index, moveFocus) {
      buttons.forEach(function (button, i) {
        var isActive = i === index;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        // Roving tabindex: one stop for the whole strip, arrows move within.
        button.tabIndex = isActive ? 0 : -1;
        panels[i].hidden = !isActive;
      });
      if (moveFocus) buttons[index].focus();
    }

    specs.forEach(function (spec, index) {
      var tabId = 'tab-' + spec.id;
      var panelId = 'tabpanel-' + spec.id;

      var button = el('button', {
        class: 'tab-button',
        type: 'button',
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        text: spec.label,
      });
      button.addEventListener('click', function () {
        select(index, false);
      });
      button.addEventListener('keydown', function (evt) {
        var next = null;
        if (evt.key === 'ArrowRight') next = (index + 1) % specs.length;
        else if (evt.key === 'ArrowLeft') next = (index - 1 + specs.length) % specs.length;
        else if (evt.key === 'Home') next = 0;
        else if (evt.key === 'End') next = specs.length - 1;
        if (next === null) return;
        evt.preventDefault();
        select(next, true);
      });
      buttons.push(button);
      strip.appendChild(button);

      var panel = el('div', {
        class: 'tab-panel',
        role: 'tabpanel',
        id: panelId,
        'aria-labelledby': tabId,
        tabindex: '0',
      });
      panel.appendChild(spec.build());
      panels.push(panel);
      body.appendChild(panel);
    });

    select(0, false);
    return el('div', { class: 'detail-tabs' }, [strip, body]);
  }

  // ---- design system panels ---------------------------------------------
  // Renders data/design-systems.js entries as a Refero-style breakdown.
  // Each builder returns null when its data is absent, so the caller can
  // filter blanks rather than every builder needing its own presence check
  // — an omitted section renders as nothing, never an empty panel.

  function buildDesignSystemSections(ds) {
    var frag = document.createDocumentFragment();
    if (ds.description) {
      frag.appendChild(el('section', { class: 'entry-section' }, [
        el('h2', { class: 'section-label', text: 'Character' }),
        el('p', { class: 'type-notes', text: ds.description }),
      ]));
    }
    [
      buildDesignColorsPanel(ds.colors),
      buildDesignTypographyPanel(ds.typography, ds.fonts),
      buildDesignSpacingShapePanel(ds.spacing, ds.rounded, ds.sections),
      buildDesignElevationPanel(ds.sections),
      buildDesignDosDontsPanel(ds.sections && ds.sections.dosAndDonts),
      buildDesignOmittedPanel(ds.omitted),
    ].forEach(function (panel) {
      if (panel) frag.appendChild(panel);
    });
    return frag;
  }

  // Download — the whole system as a real DESIGN.md, plus an always-present
  // Copy. Verified against a real file:// page: a blob URL through
  // <a download> completes the download (lands in the OS Downloads folder)
  // even though file:// gives the page a null origin, so that is the
  // primary path — feature-detected via the `download` property rather
  // than by trying and catching, since a failed download fires no event to
  // catch. The File System Access save picker (js/fs-write.js) is the
  // fallback for a browser where `download` isn't wired up at all.
  function triggerBlobDownload(filename, text) {
    var blob = new Blob([text], { type: 'text/markdown' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function buildDesignMdActions(ds) {
    var filename = ds.referenceId + '-DESIGN.md';
    var actions = el('div', { class: 'design-download-actions' });

    var downloadBtn = el('button', { class: 'copy-btn', type: 'button', text: 'Download .md' });
    downloadBtn.addEventListener('click', function () {
      var text = window.serializeDesignMd(ds);
      if ('download' in document.createElement('a')) {
        triggerBlobDownload(filename, text);
        flashCopied(downloadBtn, 'Downloaded!');
        return;
      }
      if (!window.saveDesignMdFile) {
        flashCopied(downloadBtn, 'Not supported');
        return;
      }
      window.saveDesignMdFile(filename, text).then(
        function () {
          flashCopied(downloadBtn, 'Saved!');
        },
        function (err) {
          if (err && err.name === 'AbortError') return; // collector cancelled the picker
          flashCopied(downloadBtn, 'Save failed');
        }
      );
    });
    actions.appendChild(downloadBtn);

    var copyBtn = el('button', { class: 'copy-btn', type: 'button', text: 'Copy .md' });
    copyBtn.addEventListener('click', function () {
      copyText(window.serializeDesignMd(ds), function (ok) {
        flashCopied(copyBtn, ok ? 'Copied!' : 'Copy failed');
      });
    });
    actions.appendChild(copyBtn);

    return actions;
  }

  // The DESIGN.md tab: the actions above the document itself, so the tab
  // shows exactly the text the Copy button puts on the clipboard rather
  // than asking the collector to download a file to find out what is in it.
  function buildDesignMdPanel(ds) {
    return el('section', { class: 'entry-section prompt-block' }, [
      buildActionHeader('DESIGN.md', buildDesignMdActions(ds)),
      el('pre', { class: 'prompt-text design-md-text', text: window.serializeDesignMd(ds) }),
    ]);
  }

  // Colours — swatch grid: colour, human display name, hex, role sentence.
  function buildDesignColorsPanel(colors) {
    var keys = Object.keys(colors || {});
    if (keys.length === 0) return null;
    var grid = el('div', { class: 'design-color-grid' });
    keys.forEach(function (key) {
      var c = colors[key] || {};
      grid.appendChild(el('div', { class: 'design-color-card' }, [
        buildCopySwatch(c.value, 'design-color-swatch'),
        el('div', { class: 'design-color-name', text: c.displayName || key }),
        c.role ? el('p', { class: 'design-color-role', text: c.role }) : null,
      ]));
    });
    return el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: 'Colours' }),
      grid,
    ]);
  }

  // Typography — specimen ladder (real size/weight/tracking per token) then
  // the fonts list (family, role, substitute stack).
  var TYPE_SPECIMEN_STYLE_PROPS = [
    ['fontFamily', 'font-family'],
    ['fontSize', 'font-size'],
    ['fontWeight', 'font-weight'],
    ['fontStyle', 'font-style'],
    ['lineHeight', 'line-height'],
    ['letterSpacing', 'letter-spacing'],
  ];

  function typeSpecimenStyle(token) {
    return TYPE_SPECIMEN_STYLE_PROPS
      .filter(function (pair) {
        return token[pair[0]] !== undefined && token[pair[0]] !== null;
      })
      .map(function (pair) {
        return pair[1] + ':' + token[pair[0]];
      })
      .join(';');
  }

  function describeTypeToken(token) {
    var parts = [];
    if (token.fontSize) parts.push(token.fontSize);
    if (token.fontWeight !== undefined && token.fontWeight !== null) parts.push(String(token.fontWeight));
    if (token.fontStyle) parts.push(token.fontStyle);
    if (token.lineHeight !== undefined && token.lineHeight !== null) parts.push(token.lineHeight + ' line-height');
    if (token.letterSpacing) parts.push(token.letterSpacing + ' tracking');
    return parts.join(' · ');
  }

  function buildDesignFontsList(fonts) {
    if (!fonts || fonts.length === 0) return null;
    var list = el('div', { class: 'design-fonts-list' });
    fonts.forEach(function (font) {
      list.appendChild(el('div', { class: 'design-fonts-row' }, [
        el('div', { class: 'design-fonts-family', text: font.family }),
        font.role ? el('p', { class: 'design-fonts-role', text: font.role }) : null,
        // Observed weights/sizes (spec.md's "Shape of the data") — not yet
        // populated by the extraction procedure for either pilot reference,
        // so this renders only once an entry actually carries it.
        font.observedRange
          ? el('p', { class: 'design-fonts-range', text: 'Observed: ' + font.observedRange })
          : null,
        font.substitutes && font.substitutes.length
          ? el('p', { class: 'design-fonts-substitutes', text: 'Substitute: ' + font.substitutes.join(', ') })
          : null,
      ]));
    });
    return list;
  }

  function buildDesignTypographyPanel(typography, fonts) {
    var tokens = Object.keys(typography || {});
    var fontsList = buildDesignFontsList(fonts);
    if (tokens.length === 0 && !fontsList) return null;

    var children = [el('h2', { class: 'section-label', text: 'Typography' })];
    if (tokens.length) {
      var ladder = el('div', { class: 'design-type-ladder' });
      tokens.forEach(function (token) {
        var t = typography[token] || {};
        ladder.appendChild(el('div', { class: 'design-type-row' }, [
          el('div', { class: 'design-type-specimen', style: typeSpecimenStyle(t), text: 'Aa Bg 123' }),
          el('div', { class: 'design-type-meta' }, [
            el('span', { class: 'design-type-token', text: token }),
            el('span', { class: 'design-type-values', text: describeTypeToken(t) }),
          ]),
        ]));
      });
      children.push(ladder);
    }
    if (fontsList) children.push(fontsList);
    return el('section', { class: 'entry-section' }, children);
  }

  // Spacing & shape — base unit and named scale; radius scale with what
  // carries each level. There is no structured "what carries it" field per
  // radius level (spec.md's "Shape of the data" has none), so — the same
  // move as the Elevation panel — the caption comes from `sections.shapes`
  // prose when present, the one place that observation is actually written.
  function buildDesignScaleRow(label, scale, caption) {
    var list = el('div', { class: 'design-scale-list' });
    Object.keys(scale).forEach(function (level) {
      list.appendChild(el('span', { class: 'design-scale-item' }, [
        el('span', { class: 'design-scale-level', text: level }),
        el('span', { class: 'design-scale-value', text: String(scale[level]) }),
      ]));
    });
    return el('div', { class: 'design-scale-row' }, [
      el('span', { class: 'design-scale-label', text: label }),
      el('div', { class: 'design-scale-body' }, [
        list,
        caption ? el('p', { class: 'design-scale-caption', text: caption }) : null,
      ]),
    ]);
  }

  function buildDesignSpacingShapePanel(spacing, rounded, sections) {
    var spacingKeys = Object.keys(spacing || {});
    var roundedKeys = Object.keys(rounded || {});
    if (spacingKeys.length === 0 && roundedKeys.length === 0) return null;
    var children = [el('h2', { class: 'section-label', text: 'Spacing & shape' })];
    if (spacingKeys.length) children.push(buildDesignScaleRow('Spacing', spacing));
    if (roundedKeys.length) {
      children.push(buildDesignScaleRow('Radius', rounded, sections && sections.shapes));
    }
    return el('section', { class: 'entry-section' }, children);
  }

  // Elevation — the shadow set, where present. There is no structured shadow
  // field in the data (spec.md's "Shape of the data"); `sections.elevation`
  // prose is where measured box-shadow values actually live, so that prose
  // is what this panel surfaces, called out on its own since it otherwise
  // has no dedicated widget above.
  function buildDesignElevationPanel(sections) {
    var text = sections && sections.elevation;
    if (!text) return null;
    return el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: 'Elevation' }),
      el('p', { class: 'design-prose-text', text: text }),
    ]);
  }

  // Do's and Don'ts — rendered as two lists, since that is how they are
  // read. Parsing lives in curation.js (parseDosAndDonts) so it stays a
  // pure, unit-tested function rather than DOM-coupled logic here.
  function buildDesignDosDontsColumn(label, items, modifierClass) {
    var list = el('ul', { class: 'design-dos-donts-list ' + modifierClass });
    items.forEach(function (item) {
      list.appendChild(el('li', { text: item }));
    });
    return el('div', { class: 'design-dos-donts-column' }, [
      el('h3', { class: 'design-dos-donts-heading', text: label }),
      list,
    ]);
  }

  function buildDesignDosDontsPanel(text) {
    if (!text) return null;
    var parsed = window.parseDosAndDonts(text);
    if (parsed.dos.length === 0 && parsed.donts.length === 0) return null;
    var columns = el('div', { class: 'design-dos-donts' }, [
      parsed.dos.length ? buildDesignDosDontsColumn('Do', parsed.dos, 'is-do') : null,
      parsed.donts.length ? buildDesignDosDontsColumn("Don't", parsed.donts, 'is-dont') : null,
    ]);
    return el('section', { class: 'entry-section' }, [
      el('h2', { class: 'section-label', text: "Do's and Don'ts" }),
      columns,
    ]);
  }

  // Omitted sections don't render as empty panels — the reason itself is
  // information ("this site has no component system"), surfaced quietly.
  function buildDesignOmittedPanel(omitted) {
    if (!omitted || omitted.length === 0) return null;
    var list = el('div', { class: 'design-omitted' });
    omitted.forEach(function (item) {
      if (typeof item === 'string') {
        list.appendChild(el('p', { class: 'design-omitted-item', text: item }));
        return;
      }
      if (item && item.section) {
        var text = item.reason ? item.section + ' — ' + item.reason : item.section;
        list.appendChild(el('p', { class: 'design-omitted-item', text: text }));
      }
    });
    return el('section', { class: 'entry-section design-omitted-section' }, [
      el('h2', { class: 'section-label', text: 'Not observed' }),
      list,
    ]);
  }

  function buildCategorySection(category) {
    var wrap = el('div', { class: 'category-section' });
    var row = el('div', { class: 'category-badge-row' }, [
      el('a', {
        class: 'category-badge',
        href: buildGridHash({ query: '', category: category.id, keyword: '' }),
        text: category.name,
      }),
      el('span', { class: 'category-definition', text: category.definition }),
    ]);
    wrap.appendChild(row);

    var details = el('details', { class: 'category-details' });
    details.appendChild(el('summary', { class: 'category-details-summary', text: 'About this style' }));
    details.appendChild(el('p', { class: 'category-description', text: category.description }));
    var vocabRow = el('div', { class: 'chip-row category-vocab' });
    (category.vocabulary || []).forEach(function (word) {
      vocabRow.appendChild(el('span', { class: 'chip chip-static', text: word }));
    });
    details.appendChild(vocabRow);
    wrap.appendChild(details);

    return wrap;
  }

  // Shared by every entry-section whose h2 sits opposite one action element
  // (a single copy button, or a row of several) — buildPromptBlock below and
  // buildDesignMdPanel in the design-system panels.
  function buildActionHeader(label, trailing) {
    return el('div', { class: 'prompt-header' }, [
      el('h2', { class: 'section-label', text: label }),
      trailing,
    ]);
  }

  function buildPromptBlock(label, text) {
    var copyBtn = el('button', { class: 'copy-btn', type: 'button', text: 'Copy' });
    copyBtn.addEventListener('click', function () {
      copyText(text, function (ok) {
        flashCopied(copyBtn, ok ? 'Copied!' : 'Copy failed');
      });
    });
    return el('section', { class: 'entry-section prompt-block' }, [
      buildActionHeader(label, copyBtn),
      el('pre', { class: 'prompt-text', text: text }),
    ]);
  }

  function openLightbox(src, alt) {
    var existing = document.querySelector('.lightbox');
    if (existing) existing.remove();
    var overlay = el('div', { class: 'lightbox' });
    var img = el('img', { class: 'lightbox-image', src: src, alt: alt });
    overlay.appendChild(img);
    overlay.addEventListener('click', function () {
      overlay.remove();
    });
    document.addEventListener('keydown', function onKey(evt) {
      if (evt.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
    });
    document.body.appendChild(overlay);
  }

  // ---- purge (permanent deletion) ---------------------------------------
  // Writes only ever happen from here, in direct response to the collector
  // confirming the purge — never on load, never on a timer. See
  // CONTRIBUTING.md and docs/agents/drain.md.

  function onPurgeModalKey(evt) {
    if (evt.key === 'Escape') closePurgeModal();
  }

  function closePurgeModal() {
    var overlay = document.querySelector('.purge-modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onPurgeModalKey);
  }

  function openPurgeModal(target) {
    if (document.querySelector('.purge-modal-overlay')) return;

    var purge = window.computePurge(window.getEntries(), [target.id]);
    var count = purge.removed.length;
    if (count === 0) return;
    var systemPurge = window.computeDesignSystemPurge(
      window.getDesignSystems(),
      purge.removed.map(function (e) {
        return e.id;
      })
    );
    var imagePaths = window.computeImagePurge(purge.removed, purge.remaining);

    var status = el('p', { class: 'add-modal-status', 'aria-live': 'polite' });
    function setStatus(text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    }

    var list = el('ul', { class: 'purge-modal-list' });
    purge.removed.forEach(function (entry) {
      list.appendChild(
        el('li', { class: 'purge-modal-item', text: entry.name + ' — ' + entry.sourceUrl })
      );
    });

    var cancelBtn = el('button', {
      class: 'add-modal-cancel',
      type: 'button',
      text: 'Cancel',
      onclick: closePurgeModal,
    });
    var confirmLabel = 'Delete for good';
    var confirmBtn = el('button', { class: 'btn btn-danger', type: 'button', text: confirmLabel });

    confirmBtn.addEventListener('click', function () {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Purging…';
      setStatus('', false);

      var failedImages = [];
      window
        .writeLibrary(window.serializeLibrary(purge.remaining))
        .then(function () {
          window.setEntries(purge.remaining);
          setHiddenIds(
            getHiddenIds().filter(function (id) {
              return purge.clearedIds.indexOf(id) === -1;
            })
          );
          if (systemPurge.removed.length === 0) return null;
          return window
            .writeDesignSystems(window.serializeDesignSystems(systemPurge.remaining))
            .then(function () {
              window.setDesignSystems(systemPurge.remaining);
            });
        })
        .then(function () {
          if (imagePaths.length === 0) return [];
          return window.deleteImages(imagePaths);
        })
        .then(function (failed) {
          failedImages = failed || [];
          if (failedImages.length > 0) {
            refreshGrid();
            throw new Error(
              'Purged, but could not delete ' + failedImages.length + ' image file(s): ' +
                failedImages.join(', ')
            );
          }
          closePurgeModal();
          if (parseHash().view === 'entry') window.location.hash = '#/';
          else refreshGrid();
          UI.toast('Deleted ' + target.name + '.');
        })
        .catch(function (err) {
          setStatus((err && err.message) || 'Could not purge. Nothing was changed.', true);
          confirmBtn.disabled = false;
          confirmBtn.textContent = confirmLabel;
        });
    });

    var modal = el('div', { class: 'add-modal purge-modal' }, [
      el('h2', { class: 'add-modal-title', text: 'Delete ' + target.name + '?' }),
      el('p', { class: 'purge-modal-copy', text: 'This removes it from the library files, not just from view:' }),
      el('ul', { class: 'purge-modal-what' }, [
        el('li', { text: 'its library entry' }),
        systemPurge.removed.length ? el('li', { text: 'its measured design system' }) : null,
        imagePaths.length ? el('li', { text: UI.plural(imagePaths.length, 'screenshot file') }) : null,
      ]),
      list,
      el('p', { class: 'purge-modal-note', text: 'It can only be brought back from git, if it was committed.' }),
      status,
      el('div', { class: 'add-modal-actions' }, [cancelBtn, confirmBtn]),
    ]);

    var overlay = el('div', { class: 'add-modal-overlay purge-modal-overlay' });
    overlay.addEventListener('click', function (evt) {
      if (evt.target === overlay) closePurgeModal();
    });
    overlay.appendChild(modal);

    document.addEventListener('keydown', onPurgeModalKey);
    document.body.appendChild(overlay);
  }

  // ---- resolve (assign a draft a category) -------------------------------
  // Writes only ever happen from here, in direct response to the collector
  // confirming a category — never on load, never on a timer. See
  // CONTRIBUTING.md.

  function onResolveModalKey(evt) {
    if (evt.key === 'Escape') closeResolveModal();
  }

  function closeResolveModal() {
    var overlay = document.querySelector('.resolve-modal-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onResolveModalKey);
  }

  function openResolveModal(entry) {
    if (document.querySelector('.resolve-modal-overlay')) return;

    var categories = window.getCategories();
    var selectedId = null;

    var status = el('p', { class: 'add-modal-status', 'aria-live': 'polite' });
    function setStatus(text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    }

    var confirmBtn = el('button', { class: 'add-modal-save', type: 'button', text: 'Resolve' });
    confirmBtn.disabled = true;

    var list = el('div', { class: 'resolve-modal-list', role: 'radiogroup', 'aria-label': 'Category' });
    categories.forEach(function (cat) {
      var optionId = 'resolve-category-' + cat.id;
      var radio = el('input', {
        type: 'radio',
        name: 'resolve-category',
        id: optionId,
        value: cat.id,
      });
      radio.addEventListener('change', function () {
        selectedId = cat.id;
        confirmBtn.disabled = false;
      });
      var label = el('label', { class: 'resolve-modal-option', for: optionId }, [
        radio,
        el('div', {}, [
          el('span', { class: 'resolve-modal-option-name', text: cat.name }),
          el('span', { class: 'resolve-modal-option-definition', text: cat.definition }),
        ]),
      ]);
      list.appendChild(label);
    });

    confirmBtn.addEventListener('click', function () {
      if (!selectedId) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Resolving…';
      setStatus('', false);

      var updated = window.resolveDraft(window.getEntries(), entry.id, selectedId);

      window
        .writeLibrary(window.serializeLibrary(updated))
        .then(function () {
          window.setEntries(updated);
          closeResolveModal();
          refreshGrid();
        })
        .catch(function (err) {
          setStatus((err && err.message) || 'Could not resolve. Nothing was changed.', true);
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Resolve';
        });
    });

    var cancelBtn = el('button', {
      class: 'add-modal-cancel',
      type: 'button',
      text: 'Close',
      onclick: closeResolveModal,
    });

    var modalChildren = [
      el('h2', { class: 'add-modal-title', text: 'Resolve draft' }),
      el('p', { class: 'resolve-modal-copy' }, [
        document.createTextNode(entry.name + (entry.draftReason ? ' — ' + entry.draftReason : '')),
      ]),
    ];
    modalChildren.push(
      el('p', { class: 'resolve-modal-copy' }, [
        document.createTextNode(
          'This draft is here because its site could not be captured usefully, not because it ' +
            'lacks a category — a drain always assigns one. ' +
            (categories.length > 0
              ? "Re-picking a category below won't fix the screenshot; "
              : "Picking a category here won't fix the screenshot, and there are no categories " +
                'to pick from yet anyway; ') +
            "the real fix is re-capturing the site by hand and replacing this entry's " +
            "screenshot yourself. Close this if you're not ready to do that."
        ),
      ])
    );
    if (categories.length > 0) {
      modalChildren.push(list);
    }
    modalChildren.push(status, el('div', { class: 'add-modal-actions' }, [cancelBtn, confirmBtn]));

    var modal = el('div', { class: 'add-modal resolve-modal' }, modalChildren);

    var overlay = el('div', { class: 'add-modal-overlay resolve-modal-overlay' });
    overlay.addEventListener('click', function (evt) {
      if (evt.target === overlay) closeResolveModal();
    });
    overlay.appendChild(modal);

    document.addEventListener('keydown', onResolveModalKey);
    document.body.appendChild(overlay);
  }

  // ---- app entry point -------------------------------------------------

  function renderApp() {
    var key = window.location.hash;
    if (key === lastRouteKey) return;
    lastRouteKey = key;
    var route = parseHash();
    if (route.view === 'entry') {
      renderDetail(route.id);
      window.scrollTo(0, 0);
    } else if (isGridMounted()) {
      // Back/Forward between filter states: update in place, keep scroll.
      updateGrid(route);
    } else {
      renderGrid(route);
      window.scrollTo(0, 0);
    }
  }

  // "/" jumps to search from anywhere on the grid.
  document.addEventListener('keydown', function (evt) {
    if (evt.key !== '/' || evt.metaKey || evt.ctrlKey || UI.isTyping(evt.target)) return;
    if (!isGridMounted() || document.querySelector('.add-modal-overlay, .drawer-overlay, .lightbox')) return;
    evt.preventDefault();
    gridView.search.input.focus();
  });

  if (!window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
  }
  window.addEventListener('hashchange', renderApp);
  window.addEventListener('popstate', renderApp);
  renderApp();
})();
