// Design systems: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// One block per reference, keyed by referenceId. Written by the extraction
// procedure (docs/agents/extract.md); serialised to DESIGN.md text on
// download by serializeDesignMd in this file.

const DESIGN_SYSTEMS = [
  {
    referenceId: 'seasats',
    name: 'Seasats',
    description:
      'A calm, cinematic product showcase where uncrewed boats float alone in coloured atmosphere, from dawn-grey water to sage and burnt orange. Large, light display type sits over the imagery and a small uppercase monospace handles every label, giving a quiet instrument-panel precision.',
    measurementNotes:
      "Measured from harvest.json: the ink (#232323), paper white (#FFFDFD), pure black fill, the dark green button (#2B3922) and sage tint (#E3EDE4), all font families, sizes, weights, line heights and letter-spacings, the 4/8/12/16/32px spacing steps, the 2/4/6/8px radii and the 1376px container. The harvest flagged the page as canvas-dominated (about 4x the viewport), so the gradient backdrops (sage-to-peach, orange-to-oxblood, teal), the photographed scenes and the hero's text colour over imagery are inferred from the frames and their hex values are approximate. No shadows were found. The font names are the site's own web fonts; the substitutes are suggestions.",
    colors: {
      surface: {
        value: '#FFFDFD',
        displayName: 'Foam White',
        role: 'the paper-white used for the pill switcher, the button and text on dark scenes',
      },
      'on-surface': {
        value: '#232323',
        displayName: 'Hull Charcoal',
        role: 'body copy and headlines on light scenes, and the hairline rules at low opacity',
      },
      background: {
        value: '#000000',
        displayName: 'Abyss Black',
        role: 'fills of the canvas and the product silhouettes',
      },
      primary: {
        value: '#2B3922',
        displayName: 'Kelp Green',
        role: 'the arrow tab on the main button',
      },
      tint: {
        value: '#E3EDE4',
        displayName: 'Sage Mist',
        role: 'the pale backdrop that opens the product section',
      },
      'accent-warm': {
        value: '#D9722B',
        displayName: 'Signal Orange',
        role: 'the Quickfish backdrop and active tab fill, grading down to oxblood',
      },
      'accent-sea': {
        value: '#4E9B85',
        displayName: 'Shallow Teal',
        role: 'the mission-section backdrop, grading to deep green',
      },
    },
    typography: {
      display: {
        fontFamily: 'seasonMix',
        fontSize: '124px',
        fontWeight: 400,
        lineHeight: 0.9,
        letterSpacing: '-1.24px',
      },
      headline: {
        fontFamily: 'seasonMix',
        fontSize: '64px',
        fontWeight: 400,
        lineHeight: 1,
        letterSpacing: '-0.64px',
      },
      'headline-sm': {
        fontFamily: 'seasonMix',
        fontSize: '32px',
        fontWeight: 400,
        lineHeight: 1,
        letterSpacing: '-0.32px',
      },
      title: {
        fontFamily: 'seasonMix',
        fontSize: '24px',
        fontWeight: 500,
        lineHeight: 1.2,
      },
      body: {
        fontFamily: 'seasonSans',
        fontSize: '19px',
        fontWeight: 400,
        lineHeight: 1.3,
      },
      'body-sm': {
        fontFamily: 'seasonSans',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: 1.4,
      },
      label: {
        fontFamily: 'supplyMono',
        fontSize: '12px',
        fontWeight: 400,
        lineHeight: 0.9,
      },
      mono: {
        fontFamily: 'supplyMono',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 0.9,
      },
      readout: {
        fontFamily: 'supplyMono',
        fontSize: '32px',
        fontWeight: 400,
        lineHeight: 0.9,
      },
    },
    fonts: [
      {
        family: 'seasonMix',
        role: 'display and headline serif-grotesque hybrid',
        substitutes: [
          'Instrument Serif',
          'Fraunces',
          'Georgia',
          'serif',
        ],
      },
      {
        family: 'seasonSans',
        role: 'body copy',
        substitutes: [
          'Inter',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      {
        family: 'supplyMono',
        role: 'labels, tabs, buttons and data readouts',
        substitutes: [
          'JetBrains Mono',
          'IBM Plex Mono',
          'Menlo',
          'monospace',
        ],
      },
    ],
    rounded: {
      xs: '2px',
      sm: '4px',
      md: '6px',
      lg: '8px',
    },
    spacing: {
      unit: '4px',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '32px',
    },
    components: {
      'button-primary': {
        backgroundColor: '{colors.surface}',
        textColor: '{colors.on-surface}',
        typography: '{typography.mono}',
        rounded: '{rounded.lg}',
        padding: '8px',
      },
      'button-arrow': {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.surface}',
        rounded: '{rounded.sm}',
        size: '30px',
      },
      'switcher-tab': {
        backgroundColor: '{colors.surface}',
        textColor: '{colors.on-surface}',
        typography: '{typography.label}',
        rounded: '{rounded.sm}',
        padding: '8px',
      },
      'switcher-tab-active': {
        backgroundColor: '{colors.accent-warm}',
        textColor: '{colors.surface}',
        typography: '{typography.label}',
        rounded: '{rounded.sm}',
        padding: '8px',
      },
    },
    sections: {
      overview: 'Seasats treats each machine as a quiet protagonist. Boats sit alone in a still scene (mirror-calm dawn water, a sage gradient, a burnt-orange dusk) and the page does little more than let them be looked at. Huge, light, tightly set headlines float over the imagery; everything operational is whispered in a small uppercase monospace, like labels on a chart table. The mood is calm confidence rather than defence-tech aggression, and the footer closes with a wordmark so big it is cut by the edge of the screen.',
      colors: 'The page is built from atmosphere rather than a fixed palette. Foam White (#FFFDFD) and Hull Charcoal (#232323) are the only text colours, flipping to suit the scene behind them. Abyss Black (#000000) fills the product silhouettes. Each product owns a backdrop: Sage Mist (#E3EDE4) grading to peach for the light vessel, Signal Orange (#D9722B) grading to oxblood for the fast one, and Shallow Teal (#4E9B85) deepening to green for the mission section. Kelp Green (#2B3922) appears only as the small arrow tab on the main button.',
      typography: 'Three families split the work. seasonMix, a light serif-grotesque hybrid, sets all headlines from 124px down to 24px with slight negative tracking and line heights at or below 1. seasonSans sets body copy at 16–19px. supplyMono, uppercase and small (12–14px), sets buttons, switcher tabs, section labels and footer data, and is enlarged to 32px for the scroll-distance readout. Substitutes: Instrument Serif or Fraunces for seasonMix, Inter for seasonSans, JetBrains Mono or IBM Plex Mono for supplyMono.',
      layout: 'A full-bleed, one-subject-per-viewport scroll inside a 1376px container with a 32px page margin. Headlines are centred over the hero and left-anchored in later scenes. The product section places a column of short feature statements at the left and the machine at the right, with a centred pill switcher pinned at the bottom. The footer is three columns (live data, navigation, contact) above a full-width wordmark.',
      elevation: 'There are no shadows. Depth comes from the photographed scenes, reflections in water, and the gradient fields. Interface chrome sits flat on top as white pills.',
      shapes: 'Small, precise radii: 8px on buttons, 4px on switcher tabs, 6px on press tags and 2px on the logo. The product silhouettes carry the visual curves; the interface stays squared off and compact.',
      components: "A white pill button with monospace uppercase text and a dark green arrow tab. A three-way pill switcher for Lightfish, Quickfish and Heavyfish whose active tab fills with the scene's accent colour. Feature statements are an icon, a 24px title and a one-line description, divided by hairline rules at 16% charcoal.",
      dosAndDonts: "### Do:\n- Show one machine per scene, centred or right-weighted, in clean profile against a single gradient colour field.\n- Set headlines in seasonMix at 64px or larger with negative letter-spacing of about 1% and a line height of 1 or less.\n- Set every label, tab and button in 12–14px uppercase supplyMono.\n- Separate feature statements with 1px hairlines at 16% #232323, never boxes or cards.\n- Keep button radii at 8px and switcher tabs at 4px.\n\n### Don't:\n- Don't add drop shadows to the interface or the product.\n- Don't mix more than one gradient colour field within a single scene.\n- Don't set body copy in the monospace or labels in the serif.\n- Don't crowd the machine with more than three short feature statements beside it.",
    },
  },
  {
    referenceId: 'xai',
    name: 'xAI',
    description:
      'A clean, neutral developer platform: warm-white ground, near-black type, black pill actions and rounded tiles that each preview a product by showing a miniature of it. A single hot orange glow behind the code sample is the only flourish.',
    measurementNotes:
      "Measured from harvest.json (no harvest notes flagged problems): the colours near-black #0A0A0A, tile #F9F8F6, #D7D1C9, ember #E04A26, #24292E and #8D867E; all font families, sizes, weights, line heights and letter-spacing; the spacing histogram (mode 8 and 12px); the radii (9999px pills, 6/8/12/16px); the shadow set; and the 1280px container. Inferred from the frames: colour roles (what is ground versus accent), the grey of the secondary pill and its exact shade, the gradient news thumbnails, the generated image mosaic and the code window's orange grain glow, whose gradient values are approximate. The logotype is an SVG and not measured.",
    colors: {
      primary: {
        value: '#0A0A0A',
        displayName: 'Near Black',
        role: 'primary pill buttons, headlines and body text',
      },
      surface: {
        value: '#FFFFFF',
        displayName: 'Pure White',
        role: 'the page ground and the code window',
      },
      tile: {
        value: '#F9F8F6',
        displayName: 'Warm Paper',
        role: 'product tiles, plan cards and soft secondary pills',
      },
      border: {
        value: '#D7D1C9',
        displayName: 'Stone Line',
        role: 'hairlines, dividers and quiet borders',
      },
      muted: {
        value: '#8D867E',
        displayName: 'Taupe Grey',
        role: 'captions and stat labels',
      },
      'code-ink': {
        value: '#24292E',
        displayName: 'Editor Slate',
        role: 'code text inside the sample window',
      },
      accent: {
        value: '#E04A26',
        displayName: 'Ember Orange',
        role: 'the grain glow behind the code window, the bot orb and warm thumbnails',
      },
    },
    typography: {
      display: {
        fontFamily: 'xVf',
        fontSize: '60px',
        fontWeight: 450,
        lineHeight: 1,
        letterSpacing: '-0.6px',
      },
      headline: {
        fontFamily: 'xVf',
        fontSize: '48px',
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '-0.48px',
      },
      'headline-sm': {
        fontFamily: 'xVf',
        fontSize: '30px',
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: '-0.3px',
      },
      title: {
        fontFamily: 'xVf',
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: 1.4,
        letterSpacing: '-0.16px',
      },
      body: {
        fontFamily: 'xVf',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.4,
      },
      label: {
        fontFamily: 'xVf',
        fontSize: '14px',
        fontWeight: 500,
        lineHeight: 1.4,
      },
      caption: {
        fontFamily: 'xVf',
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: 1.6,
      },
      mono: {
        fontFamily: 'GeistMono',
        fontSize: '13px',
        fontWeight: 400,
        lineHeight: 1.8,
      },
    },
    fonts: [
      {
        family: 'xVf',
        role: 'variable grotesque for all interface and headline type',
        substitutes: [
          'Inter',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      {
        family: 'GeistMono',
        role: 'code, tool logs and diffs',
        substitutes: [
          'JetBrains Mono',
          'SF Mono',
          'Menlo',
          'monospace',
        ],
      },
    ],
    rounded: {
      sm: '6px',
      md: '12px',
      lg: '16px',
      full: '9999px',
    },
    spacing: {
      unit: '4px',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '24px',
      xl: '40px',
    },
    components: {
      'button-primary': {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.surface}',
        typography: '{typography.label}',
        rounded: '{rounded.full}',
        padding: '12px',
      },
      'button-secondary': {
        backgroundColor: '{colors.tile}',
        textColor: '{colors.primary}',
        typography: '{typography.label}',
        rounded: '{rounded.full}',
        padding: '12px',
      },
      tile: {
        backgroundColor: '{colors.tile}',
        textColor: '{colors.primary}',
        typography: '{typography.body}',
        rounded: '{rounded.lg}',
        padding: '16px',
      },
      'code-window': {
        backgroundColor: '{colors.surface}',
        textColor: '{colors.code-ink}',
        typography: '{typography.mono}',
        rounded: '{rounded.md}',
        padding: '12px',
      },
    },
    sections: {
      overview: 'A product platform that behaves like infrastructure: pale, exact and unshowy. The ground is warm white and nearly everything is set in one medium-weight grotesque in near-black. Each product is introduced by a miniature of itself in a soft rounded tile, and the only theatre is a hot orange grain glow behind the code sample. It feels confident, plain-spoken and engineered.',
      colors: 'Near Black (#0A0A0A) carries headlines, body and the primary pills. Pure White (#FFFFFF) is the page and the code window, with Warm Paper (#F9F8F6) lifting tiles and plan cards slightly off it. Stone Line (#D7D1C9) draws hairlines and Taupe Grey (#8D867E) quiets captions. Ember Orange (#E04A26) is the single warm accent, appearing behind the code and in the bot orb and thumbnails, never in text or interface chrome.',
      typography: 'xVf, a variable grotesque, runs the whole page: 60px at weight 450 for the hero, 48px and 30px at 500 for section heads, 13–16px for navigation, cards and body. Headlines use roughly -1% tracking and line height 1. Geist Mono at 11–13px sets code and tool logs. Substitutes: Inter for xVf, JetBrains Mono for GeistMono.',
      layout: 'A 1280px container centred in the 1440px viewport with a 104px left edge in the frame. The hero is centred above a three-column tile row and a mixed mosaic row; the developer section is a two-column split of copy and code; statistics sit in a three-column row between hairlines; the news strip is four equal cards; and the footer is a six-column link grid under a hairline.',
      elevation: "Almost flat. Tiles are separated from the page by a tint and sometimes a 1px 6%-black ring; the sticky header has a faint bottom hairline. The only true shadows are on floating windows (a soft 16px / 48px drop at 22% black) and the traffic-light dots' tiny colour glows.",
      shapes: 'Pills (9999px) for every button, tab and announcement; 16px for tiles and plan cards; 12px for windows; 6px for small links. Chat bubbles use 16px with a 6px tail corner. Orbs and avatars are fully circular.',
      components: "Black pill and soft grey pill buttons, often in pairs; a split primary button with a chevron menu; rounded tiles with a caption left and an 'Explore →' link right; a white code window with traffic-light dots, copy control and language tabs underneath; a statistic row; news cards with gradient thumbnails; and plan cards with check-mark lists.",
      dosAndDonts: "### Do:\n- Use a solid #0A0A0A pill with white 14px weight-500 text for the main action, and #F9F8F6 for its sibling.\n- Show each product through a miniature of its own interface inside a 16px-radius #F9F8F6 tile.\n- Set headlines at weight 450–500 with line height 1 and about -1% tracking.\n- Keep Ember Orange (#E04A26) to background glows and thumbnails behind content.\n- Separate sections with 1px #D7D1C9 hairlines.\n\n### Don't:\n- Don't use rectangular or sharp-cornered buttons; every action is a 9999px pill.\n- Don't set body or navigation type heavier than weight 500.\n- Don't colour text with the accent or use more than one accent colour.\n- Don't box the statistic row in cards; it sits open between hairlines.",
    },
  },
  {
    referenceId: 'cosmos',
    name: 'Cosmos',
    description:
      'A quiet, paper-white canvas that gets out of the way of the pictures: one heavy, tightly tracked grotesque, black pill buttons and softly rounded tiles, with all the colour supplied by the imagery around them.',
    measurementNotes:
      "Measured from harvest.json: the near-black #0A0A0A (lab 3.6), the off-white ground (lab 96.6), white, the light-grey tile and the pale-grey text values, converted from lab to hex and so approximate to within a unit or two; every font size, weight, line height and letter-spacing, all in the single family cosmosOracle; the spacing histogram (mode 16px, then 8px and 4px); the radius set (pill, 16/12/8/3px); the shadow set (very soft 0 1px 8px at 5% black); and the 1376px container in a 1440px viewport. Inferred from the frames: colour roles, the grey pill's exact shade, the secondary-text greys, the display tokens' names, and the greyscale logo marquee and floating tile treatment, which are image-based. The harvest flagged a canvas covering the hero viewport, so the floating tiles are not measured and the hero colours come only from the surrounding DOM.",
    colors: {
      primary: {
        value: '#0A0A0A',
        displayName: 'Ink Black',
        role: 'headlines, body text and solid pill buttons',
      },
      surface: {
        value: '#F6F5F3',
        displayName: 'Warm Paper',
        role: 'the page ground and feature tiles',
      },
      'surface-raised': {
        value: '#FFFFFF',
        displayName: 'Pure White',
        role: 'cards, the search field and the QR card',
      },
      tile: {
        value: '#F1F0EE',
        displayName: 'Soft Stone',
        role: 'secondary grey pill buttons and tile backgrounds',
      },
      muted: {
        value: '#979594',
        displayName: 'Mid Grey',
        role: 'descriptions, handles and inactive nav items',
      },
      faded: {
        value: '#D0CFCC',
        displayName: 'Pale Grey',
        role: 'inactive names in the brand list',
      },
    },
    typography: {
      display: {
        fontFamily: 'cosmosOracle',
        fontSize: '72px',
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.04em',
      },
      headline: {
        fontFamily: 'cosmosOracle',
        fontSize: '48px',
        fontWeight: 500,
        lineHeight: 1,
        letterSpacing: '-0.04em',
      },
      title: {
        fontFamily: 'cosmosOracle',
        fontSize: '26px',
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: '-0.04em',
      },
      'title-sm': {
        fontFamily: 'cosmosOracle',
        fontSize: '20px',
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      },
      body: {
        fontFamily: 'cosmosOracle',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: 1.4,
        letterSpacing: '-0.02em',
      },
      label: {
        fontFamily: 'cosmosOracle',
        fontSize: '15px',
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '-0.02em',
      },
      caption: {
        fontFamily: 'cosmosOracle',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.4,
        letterSpacing: '-0.02em',
      },
    },
    fonts: [
      {
        family: 'cosmosOracle',
        role: 'the single family for every headline, label and caption',
        substitutes: [
          'Inter',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    ],
    rounded: {
      sm: '8px',
      md: '12px',
      lg: '16px',
      full: '9999px',
    },
    spacing: {
      unit: '4px',
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    components: {
      'button-primary': {
        backgroundColor: '{colors.primary}',
        textColor: '{colors.surface-raised}',
        typography: '{typography.label}',
        rounded: '{rounded.full}',
        padding: '16px',
      },
      'button-secondary': {
        backgroundColor: '{colors.tile}',
        textColor: '{colors.primary}',
        typography: '{typography.label}',
        rounded: '{rounded.full}',
        padding: '16px',
      },
      'search-field': {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.muted}',
        typography: '{typography.body}',
        rounded: '{rounded.full}',
        padding: '16px',
      },
      'feature-tile': {
        backgroundColor: '{colors.surface}',
        textColor: '{colors.primary}',
        rounded: '{rounded.lg}',
        padding: '16px',
      },
      'collector-card': {
        backgroundColor: '{colors.surface-raised}',
        textColor: '{colors.primary}',
        rounded: '{rounded.lg}',
        padding: '16px',
      },
    },
    sections: {
      overview: 'Cosmos is a paper-white room for looking at pictures. The interface is deliberately thin: one very heavy, very tight grotesque, black pill buttons and softly rounded containers, so that tilted lamp photographs, book covers and collector boards supply every bit of colour. The opening drifts images around the headline like prints tossed in the air; below it the page settles into rounded tiles, an index of names that fades from black to grey, and rows of collector cards.',
      colors: 'Ink Black (#0A0A0A) carries headlines, text and the solid pill buttons. Warm Paper (#F6F5F3) is the ground, with Pure White (#FFFFFF) lifting the search field and cards off it. Soft Stone (#F1F0EE) backs secondary pills, Mid Grey (#979594) sets descriptions and handles, and Pale Grey (#D0CFCC) is reserved for the inactive names in the brand list. There is no accent colour; the imagery is the colour.',
      typography: 'A single proprietary grotesque, cosmosOracle, carries everything. Display is 72px bold at line-height 1 and about -4% tracking; section headings are 48px medium; tile titles 26px; names and nav 15-20px; descriptions and handles 14-16px regular. Every size is tracked slightly negative. Substitute with Inter or Helvetica Neue at the same weights and tighten the tracking.',
      layout: 'A 1376px container centred in a 1440px viewport with 32px side gutters. Headings sit flush left on a wide margin; the hero is centred. Feature tiles run in a horizontal row of equal 384px squares with a 24px gap that overflows the right edge, and collector cards are 224px wide in the same overflowing row. Spacing is a 4px base with 8px, 16px and 24px steps.',
      elevation: 'Almost flat. Cards and the search field use a hairline border and a very soft shadow (0 1px 8px at 5% black); the QR card and sticky nav use a slightly stronger 0 4px 16px at 10%. The top bar fades into the content with a gradient rather than a hard edge.',
      shapes: 'Pill-shaped (fully rounded) buttons and search field, 16px radius for tiles and cards, 12px and 8px for small thumbnails, and circular avatars. Floating hero images are tilted rounded squares with a 3-8px radius.',
      components: 'Buttons: a solid black pill with white 15px medium text is the main action; a pale grey pill with black text is secondary. Search field: a white pill with a magnifier icon and a circular tool button at its end, inside a faint outer ring. Feature tile: a warm off-white square with a rounded 16px corner holding a small illustration, and a 26px title with one grey line beneath it. Collector card: a white 16px card topped by a three-image strip, an overlapping circular avatar, a name, a grey handle and a black follow pill.',
      dosAndDonts: "### Do:\n- Keep the ground at Warm Paper #F6F5F3 and let imagery supply every colour.\n- Set display type at 72px bold, line-height 1 and about -4% tracking.\n- Use fully rounded pills for every button and the search field.\n- Fade inactive list items to Pale Grey #D0CFCC and keep the active one at Ink Black.\n\n### Don't:\n- Don't add an accent colour or a gradient to the interface itself.\n- Don't use serif or monospace type; one grotesque does everything.\n- Don't square off the corners of buttons or cards; keep at least 12px on containers.\n- Don't use heavy shadows; keep them under 10% black.",
    },
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DESIGN_SYSTEMS };
}
