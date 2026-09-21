// Pure query functions over arrays of entries. No DOM access.
// Loadable both as a classic browser <script> (assigns nothing global by
// itself — callers use the top-level function declarations) and via
// Node's require() through the CommonJS footer below.

function normalize(value) {
  return (value || '').toString().toLowerCase();
}

function entryHaystack(entry) {
  return [entry.name, entry.summary, entry.category]
    .concat(entry.keywords || [])
    .map(normalize)
    .join(' ');
}

function filterEntries(entries, criteria) {
  criteria = criteria || {};
  var query = normalize(criteria.query).trim();
  var category = normalize(criteria.category).trim();
  var keyword = normalize(criteria.keyword).trim();

  return (entries || []).filter(function (entry) {
    if (category && normalize(entry.category) !== category) {
      return false;
    }
    if (keyword) {
      var keywords = (entry.keywords || []).map(normalize);
      if (keywords.indexOf(keyword) === -1) {
        return false;
      }
    }
    if (query && entryHaystack(entry).indexOf(query) === -1) {
      return false;
    }
    return true;
  });
}

function sortEntries(entries) {
  return (entries || [])
    .slice()
    .sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function visibleEntries(entries, hiddenIds) {
  var hidden = {};
  (hiddenIds || []).forEach(function (id) {
    hidden[id] = true;
  });
  return (entries || []).filter(function (entry) {
    return !hidden[entry.id];
  });
}

// A reference with no status field is live. Only an explicit 'draft' parks it.
function isDraft(entry) {
  return !!entry && entry.status === 'draft';
}

function draftEntries(entries) {
  return (entries || []).filter(isDraft);
}

function applyDraftVisibility(entries, showDrafts) {
  return (entries || []).filter(function (entry) {
    return showDrafts || !isDraft(entry);
  });
}

// How many entries sit in each category, keyed by category id — the counts on
// the category pills, taken over whatever the other filters already matched.
function countByCategory(entries) {
  var counts = {};
  (entries || []).forEach(function (entry) {
    counts[entry.category] = (counts[entry.category] || 0) + 1;
  });
  return counts;
}

// Keywords containing the search text, for the search box's suggestions.
// Prefix matches before mid-word ones, then the most-used first, then A–Z.
// Each comes with how many entries carry it.
function keywordSuggestions(entries, query, limit) {
  var q = normalize(query).trim();
  if (!q) return [];
  var counts = {};
  var labels = {};
  (entries || []).forEach(function (entry) {
    (entry.keywords || []).forEach(function (kw) {
      var key = normalize(kw);
      if (key.indexOf(q) === -1) return;
      counts[key] = (counts[key] || 0) + 1;
      if (!labels[key]) labels[key] = kw;
    });
  });
  return Object.keys(counts)
    .sort(function (a, b) {
      var prefix = (b.indexOf(q) === 0) - (a.indexOf(q) === 0);
      if (prefix) return prefix;
      if (counts[b] !== counts[a]) return counts[b] - counts[a];
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .slice(0, limit || 6)
    .map(function (key) {
      return { keyword: labels[key], count: counts[key] };
    });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filterEntries, sortEntries, visibleEntries, isDraft, draftEntries, applyDraftVisibility, countByCategory, keywordSuggestions };
}
