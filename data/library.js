// Library data: classic script assigning a global, loaded via a plain
// <script> tag. Browsers block both fetch() and <script type="module"> on
// file://, so this stays hand-editable data in a script, not JSON.
//
// One clear block per entry — open this file directly to fix a typo without
// depending on Claude.

const LIBRARY = [
  {
    id: 'seasats',
    name: 'Seasats — Ocean Autonomy',
    sourceUrl: 'https://www.seasats.com/',
    category: 'hardware-atmosphere',
    summary:
      'Autonomous boats photographed as lone sculptural objects, each product lit against its own colour field: dawn-grey water for the opening, pale sage for the light vessel, burnt orange for the fast one. A thin light serif carries the headlines at monumental size while a monospace voice handles every label, tab and coordinate, and the footer ends on a wordmark so large it is cropped by the viewport.',
    keywords: [
      'full-bleed product photography',
      'per-product gradient backdrop',
      'light display serif',
      'monospace labels',
      'pill product switcher',
      'oversized cropped wordmark',
      'scroll odometer readout',
      'mirror-calm water reflections',
      'hairline-rule feature list',
      'wide-set extended logotype',
    ],
    palette: ['#000000', '#232323', '#FFFDFD', '#2B3922', '#E3EDE4', '#D9722B', '#4E9B85'],
    typeNotes:
      'Three voices. seasonMix, a light, tightly tracked display serif-grotesque hybrid, runs at 124px for the hero down to 24px for card titles with negative letter-spacing and 0.9-ish line height. seasonSans at 16–19px sets body copy. supplyMono at 12–14px, uppercase, sets every button, tab, label and the footer data, and appears at 32px for the scroll-distance readout. The logotype is a separate wide, extended geometric face.',
    imagePrompt:
      'A cinematic photograph of three uncrewed matte-grey boats floating motionless on glassy open water at dawn, each with a slim mast, a dome sensor and a black solar deck, mirrored perfectly in the surface below them. The central boat sits low and small in the frame while two larger hulls are cropped at the left and right edges. Wide, eye-level composition shot at water height with a 35mm lens and a deep depth of field. Soft pre-sunrise light with a single low warm glow on the horizon, producing a quiet, still mood. Muted film grade with a gentle haze. Pale blue-grey sky fading into dusty mauve, slate-blue water, gunmetal hulls with small copper accents, no text, no watermark, no logos.',
    brief:
      '[YOUR SUBJECT] shown as a single sculptural object in clean profile, centred against a smooth full-bleed colour gradient chosen for that subject alone (sage-to-peach, or burnt orange-to-oxblood). Headlines in a light, tightly tracked display serif at very large size, supporting labels in small uppercase monospace, thin hairline rules between short feature statements, and a pill-shaped switcher that changes the subject and its colour field. Close with a wordmark so large it bleeds off the bottom edge.',
    screenshots: ['images/seasats.webp', 'images/seasats-2.webp', 'images/seasats-3.webp', 'images/seasats-4.webp'],
    createdAt: '2026-10-12T12:49:11.485Z',
    ownerId: 'local',
  },
  {
    id: 'xai',
    name: 'xAI — Frontier AI Platform',
    sourceUrl: 'https://x.ai/',
    category: 'product-platform-light',
    summary:
      'A warm-white developer platform where every product is previewed by a miniature of its own interface: a chat thread, a dark code-editor session, a voice orb, a mosaic of generated imagery. Black pill buttons, one tight grotesque and a single flash of ember orange inside a code window keep it quiet and exact.',
    keywords: [
      'live product tiles',
      'black pill buttons',
      'off-white rounded cards',
      'code window with orange grain glow',
      'tight grotesque headline with underlined word',
      'oversized stat row',
      'hairline dividers',
      'monospace code and tool logs',
      'gradient news thumbnails',
      'check-mark feature lists',
    ],
    palette: ['#0A0A0A', '#F9F8F6', '#D7D1C9', '#E04A26', '#FFFFFF', '#24292E', '#8D867E'],
    typeNotes:
      'One variable grotesque (xVf) does nearly everything: 60px at weight 450 and -1% tracking for the hero, 48px and 30px at weight 500 for section heads, 13–16px for navigation, cards and body. Geist Mono at 11–13px sets code, tool logs and the diff view. Headlines are tight (line height 1.0) while body copy sits at 1.4–1.6.',
    imagePrompt:
      'A studio photograph of a flat-lay of black cotton garments and accessories, a tote bag, a hooded sweatshirt, folded t-shirts, a baseball cap and a beanie, each with a small circular white emblem, arranged edge to edge on a pale grey seamless surface. Shot top-down with an 50mm lens at f/8 so every item is sharp. Soft overhead softbox light with gentle shadows under the folds, giving a calm, orderly mood. Neutral commercial grade with fine detail in the knit and cotton. Matte black fabric, soft grey backdrop, off-white emblems, no text, no watermark.',
    brief:
      '[YOUR SUBJECT] introduced through a row of rounded warm-white tiles, each holding a small live preview of one of its products (a chat thread, a dark code editor, a voice orb), with a short title and an arrow link below. Tight, medium-weight grotesque headlines, black pill buttons paired with soft grey ones, a monospace code window lit by an orange grainy glow, and a plain row of very large statistics between hairline rules.',
    screenshots: ['images/xai.webp', 'images/xai-2.webp', 'images/xai-3.webp', 'images/xai-4.webp'],
    createdAt: '2026-10-12T13:57:57.524Z',
    ownerId: 'local',
  },
  {
    id: 'cosmos',
    name: 'Cosmos — Visual Curation Network',
    sourceUrl: 'https://www.cosmos.so/',
    category: 'curated-image-field',
    summary:
      "A warm off-white canvas where the content is other people's saved imagery: tilted tiles of lamps drift around a giant, tightly tracked headline and a pill search bar, then give way to rounded feature tiles, a brand-name list that fades from black to pale grey beside floating book covers, and rows of collector cards. Black pill buttons and one heavy grotesque are the only interface chrome, so the pictures do all the talking.",
    keywords: [
      'floating tilted image tiles',
      'oversized tight-tracked grotesque headline',
      'pill search field',
      'black pill buttons',
      'brand-name list fading to grey',
      'collector profile cards with triple image strip',
      'rounded off-white feature tiles',
      'greyscale logo marquee',
      'QR download card',
      'warm off-white ground',
    ],
    palette: ['#0A0A0A', '#F6F5F3', '#FFFFFF', '#F1F0EE', '#D0CFCC', '#979594'],
    typeNotes:
      'One proprietary heavy grotesque (cosmosOracle) does everything: 72px bold headlines at 1.0 line-height and about -4% tracking, 48px and 26px medium section and tile titles, 14-20px for names and handles, all slightly negatively tracked. Large brand names switch between black and pale grey to show the active item. No serif or monospace voice.',
    imagePrompt:
      'A top-down still-life photograph of dozens of small, tilted square photographic prints scattered mid-air above a warm off-white paper surface, each print showing a different vintage lamp: brass desk lamps, a white ribbed pendant, a red enamel table lamp, cream fabric shades. The prints float at varied heights, the nearest ones crisp and the distant ones faded and soft, leaving a clear open space in the centre of the frame. Shot from directly overhead with a 50mm lens at f/4, soft diffused window light from above that casts faint, short shadows beneath each print. Calm, curious and gallery-like. Warm off-white (#F6F5F3) ground, near-black (#0A0A0A) accents, glossy photographic paper edges with rounded corners, muted amber, cream, and a single red accent. No text, no watermark, no logos.',
    brief:
      '[YOUR SUBJECT] presented on a warm off-white ground, with a field of small tilted, rounded-corner image tiles floating around a single oversized, tightly tracked heavy grotesque headline. A wide pill-shaped search field and one solid black pill button sit beneath it. Further sections use soft off-white rounded tiles with a bold title and a grey one-line description, a stacked list of names that fades from black to pale grey beside loosely scattered cover images, and a row of small cards each topped by a three-image strip with a circular avatar and a black pill action. Everything is quiet, precise, with imagery as the only colour.',
    screenshots: ['images/cosmos.webp', 'images/cosmos-2.webp', 'images/cosmos-3.webp', 'images/cosmos-4.webp', 'images/cosmos-5.webp'],
    createdAt: '2026-10-12T14:57:51.642Z',
    ownerId: 'local',
  },
  {
    id: 'mistral',
    name: 'Mistral — Sovereign AI',
    sourceUrl: 'https://mistral.ai/',
    category: 'product-platform-light',
    summary:
      'A paper-white enterprise AI site ruled into a hairline grid and enlivened by a pixel-art world: a black cat, a flag, and stepped blocks of amber and vermilion fill the margins around a huge, tight grotesque headline. Products are shown as miniature interfaces floating on saturated orange and yellow colour fields, and a single blood-red quote panel breaks the calm before a footer of striped sunset bands under a blocky M.',
    keywords: [
      'pixel-art mascot and flag',
      'hairline grid frame',
      'stepped amber and vermilion blocks',
      'tight medium-weight grotesque headline',
      'interface miniature on orange field',
      'floating concept chips on connector lines',
      'black login block in the nav',
      'sidebar section index',
      'blood-red quote panel',
      'striped sunset footer under blocky M',
    ],
    palette: ['#FBFBF8', '#F5F4EF', '#18181B', '#151524', '#000000', '#FF5229', '#FF8204', '#E51300', '#E4E3DE'],
    typeNotes:
      'ALTMistral, a tight medium-weight grotesque, does the display work at weight 500: 96px at line height 1 and -2% tracking for the hero, 56px and 44px for section statements, 32px and 24px for tile and card titles, and 16px with slight positive tracking for the navigation. Inter at 16–20px, weight 400, sets descriptions, quotes attributions and the footer legal line. Every headline is tracked negative and set at or just above line height 1.',
    imagePrompt:
      'A flat 8-bit pixel-art illustration of a tiny black cat with an orange collar sitting on a stepped plinth built from blocks of amber yellow and vermilion orange, beside a small pixel flag on a pale blue pole and a miniature pixel castle and factory in the distance. Two large vermilion diamonds hover at the right edge. Wide, centred, straight-on composition with a perfectly flat orthographic view and crisp square pixels. Even, shadowless light that gives a playful, calm mood. Retro video-game sprite style on a clean warm paper-white field, fine hairline grid lines crossing the background. Paper white (#FBFBF8), near-black (#18181B), amber (#FF8204), vermilion (#FF5229), no text, no watermark, no logos.',
    brief:
      '[YOUR SUBJECT] opened by a huge, tightly set medium-weight grotesque headline on a warm paper-white ground ruled into a hairline grid, with a pixel-art mascot and stepped amber and vermilion blocks living in the margins. Introduce each offering as a miniature interface floating on a saturated orange or yellow colour field, list concepts as small chips joined by thin connector lines, add a sidebar index that highlights the active section, and break the calm with one blood-red full-bleed quote panel. End with striped sunset bands beneath a large blocky pixel logo.',
    screenshots: ['images/mistral.webp', 'images/mistral-2.webp', 'images/mistral-3.webp', 'images/mistral-4.webp', 'images/mistral-5.webp'],
    createdAt: '2026-10-12T15:29:59.944Z',
    ownerId: 'local',
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LIBRARY };
}
