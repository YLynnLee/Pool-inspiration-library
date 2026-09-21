// Small shared UI pieces: the DOM builder, inline icons, toasts and a
// dismissable popover. Loaded before ai-panel.js, inbox-panel.js and
// render.js, which reach it through window.UI.
(function () {
  'use strict';

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === undefined || value === null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.indexOf('on') === 0 && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  // 16px stroke icons, drawn in currentColor so they follow text colour.
  var ICON_PATHS = {
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    inbox: '<path d="M2 9.5 3.8 3.6A1 1 0 0 1 4.8 3h6.4a1 1 0 0 1 1 .6L14 9.5V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/><path d="M2 9.5h3.5l1 1.5h3l1-1.5H14"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    chevron: '<path d="m4.5 6 3.5 3.5L11.5 6"/>',
    check: '<path d="m3.5 8.5 3 3 6-7"/>',
    restore: '<path d="M3 8a5 5 0 1 0 1.5-3.5"/><path d="M3 2.5V5h2.5"/>',
    trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
    stop: '<rect x="4.5" y="4.5" width="7" height="7" rx="1"/>',
    tag: '<path d="M2.5 8.2V3a.5.5 0 0 1 .5-.5h5.2l5.3 5.3-5.7 5.7z"/><circle cx="5.5" cy="5.5" r=".8"/>',
    folder: '<path d="M2 4.5a1 1 0 0 1 1-1h3.2l1.3 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>',
  };

  function icon(name, extraClass) {
    var span = el('span', { class: 'icon' + (extraClass ? ' ' + extraClass : ''), 'aria-hidden': 'true' });
    span.innerHTML =
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      (ICON_PATHS[name] || '') +
      '</svg>';
    return span;
  }

  // ---- toasts ---------------------------------------------------------------

  var toastHost = null;

  function toast(message, options) {
    options = options || {};
    if (!toastHost || !document.body.contains(toastHost)) {
      toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    var item = el('div', { class: 'toast' + (options.tone ? ' is-' + options.tone : '') }, [
      el('span', { class: 'toast-text', text: message }),
    ]);
    function dismiss() {
      window.clearTimeout(timer);
      item.classList.add('is-leaving');
      window.setTimeout(function () { item.remove(); }, 180);
    }
    if (options.action) {
      item.appendChild(el('button', {
        class: 'toast-action',
        type: 'button',
        text: options.action.label,
        onclick: function () {
          dismiss();
          options.action.run();
        },
      }));
    }
    item.appendChild(el('button', { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss', onclick: dismiss }, [icon('close')]));
    toastHost.appendChild(item);
    var timer = options.sticky ? null : window.setTimeout(dismiss, options.duration || 5000);
    return dismiss;
  }

  // ---- popover ----------------------------------------------------------------
  // Anchored under a trigger button, closed by Escape, an outside click, or
  // the trigger again. One open at a time.

  var openPopover = null;

  function closePopover() {
    if (!openPopover) return;
    var current = openPopover;
    openPopover = null;
    current.node.remove();
    current.trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', current.onDown, true);
    document.removeEventListener('keydown', current.onKey, true);
    if (current.restoreFocus) current.trigger.focus();
  }

  function popover(trigger, content) {
    var wasThis = openPopover && openPopover.trigger === trigger;
    closePopover();
    if (wasThis) return null;
    var node = el('div', { class: 'popover', role: 'dialog' }, [content]);
    document.body.appendChild(node);
    var rect = trigger.getBoundingClientRect();
    var width = node.offsetWidth;
    var left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
    node.style.top = rect.bottom + window.scrollY + 8 + 'px';
    node.style.left = left + window.scrollX + 'px';
    trigger.setAttribute('aria-expanded', 'true');
    var state = {
      node: node,
      trigger: trigger,
      restoreFocus: false,
      onDown: function (evt) {
        if (!node.contains(evt.target) && !trigger.contains(evt.target)) closePopover();
      },
      onKey: function (evt) {
        if (evt.key === 'Escape') {
          evt.stopPropagation();
          state.restoreFocus = true;
          closePopover();
        }
      },
    };
    openPopover = state;
    document.addEventListener('mousedown', state.onDown, true);
    document.addEventListener('keydown', state.onKey, true);
    var focusable = node.querySelector('button, [href], input');
    if (focusable) focusable.focus();
    return node;
  }

  // Close the open popover if its trigger lives inside `container` — for a
  // caller about to re-render that container, which would orphan it.
  function closePopoverWithin(container) {
    if (openPopover && container.contains(openPopover.trigger)) closePopover();
  }

  // "3 minutes ago" for a timestamp; blank when it can't be read.
  function timeAgo(iso) {
    var then = new Date(iso).getTime();
    if (!then) return '';
    var s = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (s < 60) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many || one + 's');
  }

  // True while the collector is typing somewhere, so single-key shortcuts
  // and page-wide paste stay out of the way.
  function isTyping(target) {
    var t = target || document.activeElement;
    if (!t) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  }

  window.UI = {
    el: el,
    icon: icon,
    toast: toast,
    popover: popover,
    closePopover: closePopover,
    closePopoverWithin: closePopoverWithin,
    timeAgo: timeAgo,
    plural: plural,
    isTyping: isTyping,
  };
})();
