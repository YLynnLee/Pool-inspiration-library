// Library data: classic script assigning a global, loaded via a plain
// <script> tag. Browsers block both fetch() and <script type="module"> on
// file://, so this stays hand-editable data in a script, not JSON.
//
// One clear block per entry — open this file directly to fix a typo without
// depending on Claude.

const LIBRARY = [
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LIBRARY };
}
