// Categories: classic script assigning a global, loaded via a plain
// <script> tag (no fetch, no ES modules — file:// blocks both).
//
// Deliberately small, and meant to be re-cut once
// roughly ten real references exist, so it is grown from what actually gets
// captured rather than invented up front.

const CATEGORIES = [
  {
    id: 'hardware-atmosphere',
    name: 'Hardware Atmosphere',
    definition:
      'Sites for a physical machine or device where the product is the lone photographed subject and each model owns a full-bleed colour field, a space the library has no category for yet.',
    description:
      'Hardware Atmosphere is the look of a company that makes one kind of physical thing and trusts the object to carry the page. The machine is shot or rendered cleanly, usually in profile or at water-line or eye level, lit like a sculpture and isolated from any context that would make it read as a catalogue shot. Around it, the page supplies mood rather than furniture: a gradient field in a colour specific to that product, a sky that deepens as you scroll, a calm surface it reflects in. The colour is a character of the product, so switching models switches the whole room.\n\nType plays a supporting but disciplined role. Headlines are set large and light, tightly tracked, often in a refined serif or serif-grotesque hybrid that softens an otherwise technical subject. Everything functional, from labels and tabs to spec readouts and addresses, drops into a small uppercase monospace that signals instrumentation. Short feature statements are separated by hairline rules rather than boxed into cards. Interface chrome is minimal: a pill switcher, one button, a logotype, and a footer that ends on an oversized wordmark.\n\nWhat separates it from a general product page is that the atmosphere and the object are one composition. Nothing competes with the machine, copy is sparse and declarative, and motion is slow and continuous: a scroll that travels through dawn, day and dusk, or a model that rotates into place as the backdrop shifts.',
    vocabulary: [
      'product as sole subject',
      'per-model colour field',
      'gradient backdrop',
      'profile view',
      'hairline rule',
      'monospace instrument labels',
      'pill switcher',
      'light display serif',
      'oversized wordmark',
      'reflected surface',
      'slow atmospheric scroll',
      'sparse declarative copy',
    ],
  },
  {
    id: 'product-platform-light',
    name: 'Product Platform Light',
    definition:
      'Software and API platforms on a neutral off-white ground that demonstrate each product through a miniature of its own interface in rounded tiles, which hardware-atmosphere does not cover because there the physical object is the subject on a colour field.',
    description:
      'Product Platform Light is the look of a software company that wants to be read as infrastructure: neutral, legible and quick to scan. The ground is a warm white, the type is one tightly set grotesque in medium weights, and the only strongly coloured things are the products themselves. Instead of photography or illustration of an abstract idea, each offering is shown by a small, live-looking fragment of its own interface, such as a chat exchange, an editor session or a voice orb, housed in a softly rounded off-white tile with a label and an arrow link along the bottom edge.\n\nControls are pills. A solid black pill is the main action and a soft grey pill is the secondary one; a split button hides a menu. Navigation is plain text with small chevrons. Code is first-class content, shown in a white window with traffic-light dots, a copy control and language tabs, often sitting on a single bright, grainy colour field that is the only decoration on the page.\n\nStructure is conventional and calm: a centred hero with an announcement pill, a tile grid, a developer section with code, a row of very large numerals between hairlines, a news strip with gradient thumbnails, a two-column plan comparison with check-mark lists, and a dense link footer. It differs from a hardware showcase because nothing is staged as an object; the interface is the subject.',
    vocabulary: [
      'announcement pill',
      'interface miniature tile',
      'black pill button',
      'soft grey secondary pill',
      'split button',
      'code window',
      'language tabs',
      'grain colour field',
      'statistic row',
      'hairline divider',
      'gradient thumbnail',
      'check-mark list',
      'medium-weight grotesque',
      'off-white ground',
    ],
  },
  {
    id: 'curated-image-field',
    name: 'Curated Image Field',
    definition:
      "Image-led platforms on a neutral off-white ground where the content is a field of curated pictures — floating, tiled or strip-framed — and the interface shrinks to black pills and one heavy grotesque, which product-platform-light does not cover because there the subject is a miniature of the product's own interface.",
    description:
      "Curated Image Field is the look of a place whose product is taste: a collection of other people's saved images. The ground is a warm off-white, almost paper, and the pictures are treated as objects rather than illustrations. They tilt, float, overlap and drift at different depths around the type, fading toward the edges, so the opening feels like a table of prints tossed into the air rather than a grid. Imagery supplies all of the colour; the page itself is monochrome.\n\nType is a single heavy grotesque set very large and very tight, with negative tracking and a line-height of about one, so headlines read as a block. Section titles drop to a medium weight and tile descriptions to a quiet grey. Lists of names, such as brands or collectors, are set oversized and the inactive items fade to pale grey while the active one stays black, giving a sense of a slowly turning index.\n\nControls are pills: a solid black pill for the main action, a pale grey pill for the secondary one, and a rounded search field with a circular tool at its end. Containers are soft rounded rectangles with hairline borders and the faintest shadow. Collector cards pair a three-image strip with an overlapping circular avatar, a name, a handle and a black follow pill. Social proof is a double row of greyscale logotypes, and a white card with a QR code points to the app.\n\nIt differs from a product platform page because nothing is staged as an interface demonstration. The images are the subject, and the chrome exists only to get out of their way.",
    vocabulary: [
      'floating tilted image tiles',
      'off-white paper ground',
      'oversized tight-tracked grotesque',
      'fading name list',
      'pill search field',
      'black pill button',
      'soft grey pill',
      'triple image strip card',
      'overlapping circular avatar',
      'greyscale logo marquee',
      'rounded feature tile',
      'QR download card',
      'imagery as sole colour',
    ],
  },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CATEGORIES };
}
