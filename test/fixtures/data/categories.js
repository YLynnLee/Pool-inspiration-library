// Categories: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// Deliberately small, and meant to be re-cut once
// roughly ten real references exist, so it is grown from what actually gets
// captured rather than invented up front.

const CATEGORIES = [
  {
    id: 'white-cube-gallery',
    name: 'White Cube Gallery',
    definition:
      'A near-colourless black-on-white interface with no brand accent of its own, stepping back so a dense, uncaptioned masonry grid of curated imagery can supply all the colour and texture.',
    description:
      "White Cube Gallery sites borrow the discipline of an art gallery's white cube: the interface itself carries almost no colour information at all — a pure or near-pure white ground, a single near-black ink for every label and heading, and never a second brand hue. Whatever colour the page has belongs entirely to the content it curates: a dense, tightly-packed masonry grid of photography, illustration and found imagery, each tile touching its neighbours with only a hairline gap and no caption competing for attention. Interface chrome recedes rather than announces itself — a pill-shaped search bar, small rounded-full icon buttons, tab labels in a compact sans — all sized modestly and kept to the same one ink colour, so nothing but the curated grid itself earns visual weight. Motion is a soft fade-in as tiles resolve rather than any dramatic reveal. The overall effect reads as curatorial restraint: the product is the taste on display, and the surrounding UI is disciplined into near-invisibility so it never competes with what's being shown.",
    vocabulary: [
      'white cube ground',
      'single near-black ink',
      'dense uncaptioned masonry grid',
      'pill-shaped search bar',
      'rounded-full icon buttons',
      'hairline tile gaps',
      'curatorial restraint',
      'soft tile fade-in',
    ],
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES };
}
