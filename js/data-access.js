// Data-access module. The only code aware that entries currently come from
// the in-memory LIBRARY global. Moving to a hosted backend later means
// rewriting this file and nothing else.

function getEntries() {
  return (typeof LIBRARY !== 'undefined' ? LIBRARY : []).slice();
}

function getEntry(id) {
  var entries = typeof LIBRARY !== 'undefined' ? LIBRARY : [];
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].id === id) return entries[i];
  }
  return null;
}

// Replaces the in-memory entries wholesale, in place — used after a purge
// writes the trimmed array to disk, so the grid reflects the removal
// without a reload. LIBRARY is declared with `const` (and, loaded as a
// classic script, is never a `window` property), so its binding can't be
// reassigned; splicing mutates the existing array instead.
function setEntries(entries) {
  if (typeof LIBRARY === 'undefined') return;
  LIBRARY.splice.apply(LIBRARY, [0, LIBRARY.length].concat(entries));
}

function getCategories() {
  return (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).slice();
}

function getCategory(id) {
  var categories = typeof CATEGORIES !== 'undefined' ? CATEGORIES : [];
  for (var i = 0; i < categories.length; i++) {
    if (categories[i].id === id) return categories[i];
  }
  return null;
}

// Null where a reference has no design system yet — the common case,
// not an error.
function getDesignSystem(referenceId) {
  var systems = typeof DESIGN_SYSTEMS !== 'undefined' ? DESIGN_SYSTEMS : [];
  for (var i = 0; i < systems.length; i++) {
    if (systems[i].referenceId === referenceId) return systems[i];
  }
  return null;
}

function getDesignSystems() {
  return (typeof DESIGN_SYSTEMS !== 'undefined' ? DESIGN_SYSTEMS : []).slice();
}

// Same in-place splice as setEntries, for the same const-binding reason.
function setDesignSystems(systems) {
  if (typeof DESIGN_SYSTEMS === 'undefined') return;
  DESIGN_SYSTEMS.splice.apply(DESIGN_SYSTEMS, [0, DESIGN_SYSTEMS.length].concat(systems));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getEntries, getEntry, getCategories, getCategory, getDesignSystem, getDesignSystems, setDesignSystems, setEntries };
}
