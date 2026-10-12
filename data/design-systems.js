// Design systems: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// One block per reference, keyed by referenceId. Written by the extraction
// procedure (docs/agents/extract.md); serialised to DESIGN.md text on
// download by serializeDesignMd in this file.

const DESIGN_SYSTEMS = [
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DESIGN_SYSTEMS };
}
