// Categories: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// Deliberately small, and meant to be re-cut once
// roughly ten real references exist, so it is grown from what actually gets
// captured rather than invented up front.

const CATEGORIES = [
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES };
}
