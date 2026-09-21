// Design systems: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// One block per reference, keyed by referenceId. Written by the extraction
// procedure (docs/agents/extract.md); serialised to DESIGN.md text on
// download by serializeDesignMd in this file. See
// docs/adr/0005-design-systems-follow-design-md.md.

const DESIGN_SYSTEMS = [
  {
    referenceId: 'cosmos-explore',
    name: 'Cosmos — Explore',
    description:
      "Colours, the cosmosOracle type scale, the spacing histogram and the radius set are measured with scripts/harvest-design.js against the live DOM — the page is not canvas-dominated. The harvest returns several colours as raw lab()/oklch() CSS Color 4 strings rather than rgb() (the site's stylesheet declares colour in those spaces directly), so each was converted to an approximate sRGB hex via a 1x1-canvas fillStyle readback before being recorded below; the hex values are therefore a close render-accurate approximation, not a byte-for-byte replay of the original colour-space value. The single largest measured colour by painted area, near-black #0d0d0d, is not a background panel — direct inspection confirmed it's the one ink colour used for every heading, tab label and card title on the page, which simply sums to a large total area across many small text elements; the screenshots confirm the page reads as overwhelmingly white, and 'surface' below follows the screenshots over the raw area ranking, per extract.md's Interpret step. One measured radius value came back as '1.67772e+07px' — a floating-point artefact of a CSS rounded-full utility rather than a real dimension — and is normalised to 9999px below, the same 'round as the box allows' treatment the Ciao Energy entry gives its own oversized radius.",
    colors: {
      surface: {
        value: '#ffffff',
        displayName: 'Paper White',
        role: "the page ground — confirmed as document.body's own background-color, not just the top measured swatch",
      },
      'surface-alt': {
        value: '#f7f5f3',
        displayName: 'Warm Fog',
        role: "the barely-warm off-white backing the main content container, a shade off the page's pure white",
      },
      'on-surface': {
        value: '#0d0d0d',
        displayName: 'Ink',
        role: 'every heading, tab label, card title and body of copy on the page — the one text colour in the whole system',
      },
      icon: {
        value: '#000000',
        displayName: 'Pure Black',
        role: 'SVG icon and logo fills, measured as a distinct pure black rather than the slightly warm Ink used for text',
      },
      primary: {
        value: '#0d0d0d',
        displayName: 'Ink',
        role: "the interface's only accent — every active tab, primary button and emphasised state, since no separate brand hue exists",
      },
    },
    typography: {
      display: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '58px',
        fontWeight: 400,
        lineHeight: 1,
        letterSpacing: '-2.32px',
      },
      headline: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '26px',
        fontWeight: 400,
        lineHeight: 1.15,
      },
      title: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '20px',
        fontWeight: 400,
        lineHeight: 1.15,
      },
      'label-lg': {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      label: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: '-0.28px',
      },
      body: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.4,
      },
      caption: {
        fontFamily: 'cosmosOracle, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.5,
      },
    },
    fonts: [
      {
        family: 'cosmosOracle',
        role: 'every size and weight in the system — the only typeface on the page',
        substitutes: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
      },
    ],
    rounded: {
      sm: '3px',
      md: '16px',
      lg: '20px',
      full: '9999px',
    },
    spacing: {
      unit: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    components: {
      'search-bar': {
        backgroundColor: '{colors.surface-alt}',
        rounded: '{rounded.full}',
        typography: '{typography.body}',
      },
      'grid-tile': {
        rounded: '{rounded.md}',
      },
      'button-primary': {
        backgroundColor: '{colors.on-surface}',
        textColor: '{colors.surface}',
        rounded: '{rounded.lg}',
        typography: '{typography.label-lg}',
      },
      'icon-button': {
        backgroundColor: '{colors.surface}',
        textColor: '{colors.icon}',
        rounded: '{rounded.full}',
      },
    },
    sections: {
      overview: "Cosmos's Explore page is almost entirely white and black: a pill search bar and a row of topic tabs sit above a dense, uncaptioned masonry grid of curated photography, art and interface shots, each tile touching its neighbours with only a hairline gap. Nothing in the chrome carries colour — every label, tab and icon renders in the same near-black ink — so the mood swings entirely on whatever tiles happen to be showing, from a stormy seascape to a cropped Apple stock-ticker screenshot to a black-and-white street photo.",
      colors: "**Paper White** (#ffffff) is the page's own confirmed background. A barely-warm **Warm Fog** (#f7f5f3) backs the main content container, a shade off pure white. **Ink** (#0d0d0d) is the one text colour in the entire system — every heading, tab and card title — and by painted area is the largest single measured colour on the page, since it sums across so much small text. A separate pure **Black** (#000000) is measured on SVG icon fills, kept distinct from Ink's slightly warm tone. No accent colour exists anywhere in the interface; colour belongs entirely to the curated imagery in the grid.",
      typography: 'One face, **cosmosOracle**, carries the whole page — a plain grotesque stepping from a 12px caption up to a single oversized 58px display moment reserved for the sign-up headline, always in the one Ink colour.',
      layout: 'The measured spacing observations cluster around a 4px unit, stepping cleanly through 8, 16, 24 and 32px. The recurring content container measured at 1448px against a 1512px viewport, essentially edge-to-edge.',
      elevation: 'Mostly flat: a handful of measured multi-layer box-shadows apply a very low-opacity (2–10%) soft blur to a few floating elements (the search bar and a small number of cards), never a hard or high-contrast shadow.',
      shapes: "Radii cluster into four rungs: a subtle 3px on the majority of grid tiles and cards, 16px on a smaller set of larger cards, 20px on primary buttons, and a 'full' rung — effectively a pill/circle — on the search bar and every small icon button.",
      components: 'Three repeated patterns recur: the **search bar** (fully pill-shaped, Warm Fog fill, body-sized placeholder text), the **grid tile** (16px radius, the base unit of the masonry grid), and a solid Ink **primary button** (20px radius, Paper White text, used for the sign-up CTA), and a small round **icon button** (fully pill-shaped, pure Black icon fill) used for search and utility actions.',
      dosAndDonts: "### Do:\n- **Do** keep every piece of interface chrome in the single Ink colour — no second hue, ever, outside the curated imagery itself.\n- **Do** pack grid tiles edge to edge with only a hairline gap and no captions competing with the imagery.\n- **Do** reserve the oversized 58px display size for a single moment per page — it should read as rare, not routine.\n\n### Don't:\n- **Don't** introduce a brand accent colour into the UI chrome — the whole point is that colour belongs to the content, not the interface.\n- **Don't** add captions or borders to grid tiles; the hairline gap and nothing else is what keeps the grid feeling curated rather than cluttered.\n- **Don't** treat the raw '1.67772e+07px' radius value as a real dimension — it's a rounded-full utility's floating-point artefact and means simply 'fully round'.",
    },
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DESIGN_SYSTEMS };
}
