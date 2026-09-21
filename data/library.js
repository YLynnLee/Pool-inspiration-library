// Library data: classic script assigning a global, loaded via a plain
// <script> tag. Browsers block both fetch() and <script type="module"> on
// file://, so this stays hand-editable data in a script, not JSON.
//
// One clear block per entry — open this file directly to fix a typo without
// depending on Claude.

const LIBRARY = [
  {
    id: 'cosmos-explore',
    name: 'Cosmos — Explore',
    sourceUrl: 'https://www.cosmos.so/explore',
    category: 'white-cube-gallery',
    summary:
      "Cosmos's Explore page is almost entirely white and black: a pill search bar and a row of topic tabs sit above a dense, uncaptioned masonry grid of curated photography, art and interface shots, each tile touching its neighbours with only a hairline gap. Nothing in the chrome carries colour — every label, tab and icon renders in the same near-black ink — so the mood swings entirely on whatever tiles happen to be showing, from a stormy seascape to a cropped Apple stock-ticker screenshot to a black-and-white street photo.",
    keywords: [
      'dense uncaptioned masonry grid',
      'white cube ground',
      'single near-black ink',
      'pill-shaped search bar',
      'hairline tile gaps',
      'topic tab row',
      'soft tile fade-in on load',
      'curated mixed-media imagery',
    ],
    palette: ['#ffffff', '#f7f5f3', '#0d0d0d', '#000000'],
    typeNotes:
      'One face, cosmosOracle, carries the entire interface at a handful of compact sizes (12–20px) and one oversized 58px moment for the sign-up CTA headline; every size renders in the same near-black ink (#0d0d0d), so the type system reads as monochrome as the ground it sits on.',
    imagePrompt:
      'A dense grid of small rectangular tiles fitted together edge to edge with only a hairline gap, each tile a different fragment of photography or art — a wave, a lamp, an interior, a face — on a pure white field. No captions, no borders, no colour outside the tiles themselves. Clean, quiet, gallery-white, restrained black sans-serif labels floating above. Curatorial, precise, a wall of taste rather than a page of content.',
    brief:
      '[YOUR SUBJECT] disappears behind a pure white ground and a single near-black ink — no brand colour anywhere in the interface itself. Put a pill-shaped search field and a row of small tab labels at the top, all rendered in that one ink colour, then let a dense masonry grid of imagery fill the rest of the page: tiles of differing heights packed edge to edge with only a hairline gap between them, no captions, no borders, nothing competing with the images for attention. Let tiles resolve with a soft fade-in as they load rather than any dramatic reveal.\n\nKeep every piece of UI chrome modest and rounded — a fully round search bar, small rounded-full icon buttons — so nothing in the interface itself earns visual weight next to the grid. Reserve one moment of scale for a single oversized headline (a sign-up prompt, a closing statement) rendered at several times the base size, still in the same ink colour, still with no second hue introduced.\n\nType system: one plain sans for everything, from 12px labels to a single 50-60px display moment, always in the one near-black ink. Palette: pure white ground (#FFFFFF), a barely-warm off-white for content containers (#F7F5F3), and near-black ink (#0D0D0D) for every label — no accent colour at all; colour belongs entirely to whatever content fills the grid. Tone: curatorial and disciplined — the interface is furniture, not a voice, and it should read as confident restraint rather than absence.',
    screenshots: ['images/cosmos-explore.webp', 'images/cosmos-explore-2.webp'],
    createdAt: '2026-09-10T08:07:25.234Z',
    ownerId: 'local',
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LIBRARY };
}
