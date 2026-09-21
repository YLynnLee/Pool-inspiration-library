// Measures the design tokens a rendered page actually painted: colour by
// area, font clusters, spacing, radii, shadows, container width. Runs
// standalone in a plain browser console (paste-and-go, no dependencies) or
// injected by an automation tool after the page settles — see ticket 02 of
// .scratch/design-system-extraction. The pure aggregation functions below
// are also `require()`-able from Node for testing, same CommonJS-footer
// convention as js/curation.js and js/query.js; the DOM walk in
// harvestDesign() only runs where `document` exists.
//
// The point of aggregating in the page is that the return value must stay a
// one-to-two-kilobyte digest, never a DOM dump — see docs/adr/0005.

var MIN_DOM_SIZE = 40;
var TOP_COLOURS = 15;
var TOP_FONTS = 25;
var TOP_SPACING = 12;
var TOP_RADII = 15;
var TOP_SHADOWS = 10;
var SAMPLE_MAX_CHARS = 20;

// Parses a computed rgb()/rgba() colour string into a canonical form so
// `rgb(0, 0, 0)` and `rgba(0, 0, 0, 1)` collapse to one bucket, and a fully
// transparent colour (alpha 0) returns null — it paints nothing, so it must
// not compete with the page ground for painted area. getComputedStyle always
// serialises resolved colours this way, so no keyword/hex handling is
// needed here. An SVG `fill` can resolve to a paint-server reference
// (`url("#gradient")`) rather than a colour at all; that isn't a colour to
// cluster on, so it returns null too.
function normalizeColor(value) {
  if (!value) return null;
  var text = value.toString().trim();
  if (text.indexOf('url(') === 0) return null;
  var match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(text);
  if (!match) return text;
  var r = Math.round(parseFloat(match[1]));
  var g = Math.round(parseFloat(match[2]));
  var b = Math.round(parseFloat(match[3]));
  var a = match[4] === undefined ? 1 : parseFloat(match[4]);
  if (a === 0) return null;
  if (a >= 1) return 'rgb(' + r + ', ' + g + ', ' + b + ')';
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + Math.round(a * 100) / 100 + ')';
}

// Accumulates width*height per resolved colour across whichever properties
// carried it, ranks by that painted area rather than occurrence count (a
// 3px border must not outrank the page ground), and returns the top N with
// each one's share of the total painted area actually attributed.
function aggregateColors(records, topN) {
  var limit = topN || TOP_COLOURS;
  var totals = {};
  var order = [];
  var grandTotal = 0;
  (records || []).forEach(function (record) {
    var key = normalizeColor(record.color);
    if (!key || !record.area) return;
    if (!totals[key]) {
      totals[key] = { color: key, area: 0, properties: {} };
      order.push(key);
    }
    totals[key].area += record.area;
    totals[key].properties[record.property] = true;
    grandTotal += record.area;
  });
  var ranked = order
    .map(function (key) {
      return totals[key];
    })
    .sort(function (a, b) {
      return b.area - a.area;
    })
    .slice(0, limit);
  return ranked.map(function (entry) {
    return {
      color: entry.color,
      areaShare: grandTotal ? Math.round((entry.area / grandTotal) * 1000) / 1000 : 0,
      properties: Object.keys(entry.properties).sort(),
    };
  });
}

// The actually-used family is the first name in a computed font-family
// stack; the rest is the browser's fallback chain, which bloats the digest
// without telling the agent anything it can't already assume.
function primaryFontFamily(family) {
  var first = (family || '').toString().split(',')[0] || '';
  return first.trim().replace(/^["']|["']$/g, '');
}

// Keys a font cluster on family+size+weight+line-height+letter-spacing —
// the properties that together define one rung of a type scale — and
// accumulates painted area, element count, and one short text sample per
// cluster. Caps at ~25 clusters by area; naming the clusters into a scale
// happens later, in the agent's head.
function clusterFonts(records, topN) {
  var limit = topN || TOP_FONTS;
  var clusters = {};
  var order = [];
  (records || []).forEach(function (record) {
    if (!record.area) return;
    var family = primaryFontFamily(record.family);
    var key = [family, record.size, record.weight, record.lineHeight, record.letterSpacing].join('|');
    if (!clusters[key]) {
      clusters[key] = {
        fontFamily: family,
        fontSize: record.size,
        fontWeight: record.weight,
        lineHeight: record.lineHeight,
        letterSpacing: record.letterSpacing,
        area: 0,
        elementCount: 0,
        sample: '',
      };
      order.push(key);
    }
    var cluster = clusters[key];
    cluster.area += record.area;
    cluster.elementCount += 1;
    if (!cluster.sample && record.sample) {
      cluster.sample = record.sample.toString().trim().slice(0, SAMPLE_MAX_CHARS);
    }
  });
  return order
    .map(function (key) {
      return clusters[key];
    })
    .sort(function (a, b) {
      return b.area - a.area;
    })
    .slice(0, limit)
    .map(function (cluster) {
      return {
        fontFamily: cluster.fontFamily,
        fontSize: cluster.fontSize,
        fontWeight: cluster.fontWeight,
        lineHeight: cluster.lineHeight,
        letterSpacing: cluster.letterSpacing,
        elementCount: cluster.elementCount,
        sample: cluster.sample,
      };
    });
}

// Tallies observed non-zero margin/padding/gap pixel values so a 4px or 8px
// base unit can be inferred from the mode, without recording which
// property each observation came from — the ticket only asks for values
// with counts.
function buildSpacingHistogram(values, topN) {
  var limit = topN || TOP_SPACING;
  var counts = {};
  (values || []).forEach(function (entry) {
    var px = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value);
    if (!px || isNaN(px)) return;
    var key = Math.round(px);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts)
    .map(function (key) {
      return { value: Number(key), count: counts[key] };
    })
    .sort(function (a, b) {
      return b.count - a.count || a.value - b.value;
    })
    .slice(0, limit)
    .sort(function (a, b) {
      return a.value - b.value;
    });
}

// Distinct border-radius values with a sample selector and how often each
// was observed, ranked by frequency.
function aggregateRadii(records, topN) {
  return tallyDistinctValues(records, topN || TOP_RADII, '0px');
}

// Shared by aggregateRadii and aggregateShadows: distinct value with a
// count, ranked by frequency, skipping the value that means "none of this"
// for the property in question (`0px` for radii, `none` for shadows). Keeps
// the first sample selector seen for a value when records carry one.
function tallyDistinctValues(records, limit, skipValue) {
  var entries = {};
  var order = [];
  (records || []).forEach(function (record) {
    if (!record.value || record.value === skipValue) return;
    if (!entries[record.value]) {
      entries[record.value] = record.sample !== undefined ? { value: record.value, count: 0, sample: record.sample || '' } : { value: record.value, count: 0 };
      order.push(record.value);
    }
    entries[record.value].count += 1;
  });
  return order
    .map(function (value) {
      return entries[value];
    })
    .sort(function (a, b) {
      return b.count - a.count;
    })
    .slice(0, limit);
}

// Distinct non-`none` box-shadow values with counts, ranked by frequency.
function aggregateShadows(records, topN) {
  return tallyDistinctValues(records, topN || TOP_SHADOWS, 'none');
}

// The widest content-container width that recurs (count > 1) and is
// narrower than the viewport it was measured at — picking the widest
// recurring width rather than the most frequent one, since a handful of
// full-bleed rows would otherwise drown out the container.
function computeLayout(widths, viewportWidth) {
  var counts = {};
  (widths || []).forEach(function (width) {
    var rounded = Math.round(width);
    counts[rounded] = (counts[rounded] || 0) + 1;
  });
  var recurring = Object.keys(counts)
    .map(Number)
    .filter(function (width) {
      return counts[width] > 1 && width < viewportWidth;
    })
    .sort(function (a, b) {
      return b - a;
    });
  return {
    containerWidth: recurring.length ? recurring[0] : null,
    viewportWidth: viewportWidth,
  };
}

// A page where canvas elements cover most of the viewport is one where
// getComputedStyle can't see what's actually drawn — the visual language
// lives inside the pixels, not the cascade. Flags it at a 30% coverage
// threshold so the agent knows to lean on the screenshots instead.
var CANVAS_DOMINANCE_THRESHOLD = 0.3;

function detectCanvasDominance(canvasArea, viewportArea) {
  if (!viewportArea) return null;
  var coverage = canvasArea / viewportArea;
  if (coverage < CANVAS_DOMINANCE_THRESHOLD) return null;
  return 'canvas-dominated page (' + Math.round(coverage * 100) + '% of viewport covered by <canvas>) — colours/fonts below are only what the surrounding DOM carries, not what the canvas draws';
}

// True when an element is visible enough to paint anything: not
// display:none, not visibility:hidden, not fully transparent, and has a
// non-zero rendered area.
function isVisible(computedStyle, rect) {
  if (computedStyle.display === 'none') return false;
  if (computedStyle.visibility === 'hidden') return false;
  if (parseFloat(computedStyle.opacity) === 0) return false;
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

// Element has its own direct text (not just inherited from descendants),
// so a font-cluster record isn't logged once per ancestor of the same
// paragraph and doesn't wildly overstate that cluster's painted area.
function ownText(el) {
  var text = '';
  for (var i = 0; i < el.childNodes.length; i++) {
    var node = el.childNodes[i];
    if (node.nodeType === 3) text += node.nodeValue;
  }
  return text.trim();
}

function firstClass(el) {
  var className = el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className;
  if (!className || typeof className !== 'string') return '';
  var first = className.trim().split(/\s+/)[0];
  return first ? '.' + first : '';
}

// Walks the rendered DOM, reads getComputedStyle, and aggregates in the
// page so what crosses into agent context is the digest below, never a DOM
// dump. Deterministic for a given page/viewport: no sampling, no
// randomness.
function harvestDesign() {
  var notes = [];
  var allElements = document.body ? document.body.getElementsByTagName('*') : [];
  if (allElements.length < MIN_DOM_SIZE) {
    notes.push('thin DOM (' + allElements.length + ' elements, under ' + MIN_DOM_SIZE + ') — page may be canvas/WebGL-dominated or scripting-blocked');
  }

  var colorRecords = [];
  var fontRecords = [];
  var spacingValues = [];
  var radiusRecords = [];
  var shadowRecords = [];
  var containerWidths = [];
  var skippedIframes = 0;
  var canvasArea = 0;

  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];

    if (el.tagName === 'CANVAS') {
      var canvasRect = el.getBoundingClientRect();
      if (canvasRect.width > 0 && canvasRect.height > 0) canvasArea += canvasRect.width * canvasRect.height;
    }

    if (el.tagName === 'IFRAME') {
      var reachable = true;
      try {
        reachable = !!el.contentDocument;
      } catch (err) {
        reachable = false;
      }
      if (!reachable) {
        skippedIframes += 1;
        continue;
      }
    }

    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    if (!isVisible(cs, rect)) continue;

    var area = rect.width * rect.height;

    colorRecords.push({ property: 'background-color', color: cs.backgroundColor, area: area });
    colorRecords.push({ property: 'color', color: cs.color, area: area });
    if (typeof cs.fill === 'string' && cs.fill && cs.fill !== 'none') {
      colorRecords.push({ property: 'fill', color: cs.fill, area: area });
    }

    var borderWidths = [parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderRightWidth) || 0, parseFloat(cs.borderBottomWidth) || 0, parseFloat(cs.borderLeftWidth) || 0];
    var avgBorderWidth = (borderWidths[0] + borderWidths[1] + borderWidths[2] + borderWidths[3]) / 4;
    if (avgBorderWidth > 0) {
      var perimeter = 2 * (rect.width + rect.height);
      colorRecords.push({ property: 'border-color', color: cs.borderTopColor, area: perimeter * avgBorderWidth });
    }

    if (ownText(el)) {
      fontRecords.push({
        family: cs.fontFamily,
        size: cs.fontSize,
        weight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        area: area,
        sample: ownText(el),
      });
    }

    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'].forEach(function (prop) {
      var value = parseFloat(cs[prop]);
      if (value) spacingValues.push({ property: prop, value: value });
    });

    if (cs.borderRadius && cs.borderRadius !== '0px') {
      radiusRecords.push({ value: cs.borderRadius, sample: el.tagName.toLowerCase() + firstClass(el) });
    }

    if (cs.boxShadow && cs.boxShadow !== 'none') {
      shadowRecords.push({ value: cs.boxShadow });
    }

    var display = cs.display;
    if ((display === 'block' || display === 'flex' || display === 'grid') && rect.width > 200) {
      containerWidths.push(rect.width);
    }
  }

  if (skippedIframes > 0) {
    notes.push(skippedIframes + ' cross-origin iframe' + (skippedIframes === 1 ? '' : 's') + ' skipped');
  }
  var canvasNote = detectCanvasDominance(canvasArea, window.innerWidth * window.innerHeight);
  if (canvasNote) notes.push(canvasNote);

  return {
    colours: aggregateColors(colorRecords),
    fonts: clusterFonts(fontRecords),
    spacing: buildSpacingHistogram(spacingValues),
    radii: aggregateRadii(radiusRecords),
    shadows: aggregateShadows(shadowRecords),
    layout: computeLayout(containerWidths, window.innerWidth),
    notes: notes,
  };
}

typeof document !== 'undefined' ? harvestDesign() : undefined;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeColor: normalizeColor,
    primaryFontFamily: primaryFontFamily,
    aggregateColors: aggregateColors,
    clusterFonts: clusterFonts,
    buildSpacingHistogram: buildSpacingHistogram,
    aggregateRadii: aggregateRadii,
    aggregateShadows: aggregateShadows,
    computeLayout: computeLayout,
    detectCanvasDominance: detectCanvasDominance,
    isVisible: isVisible,
    harvestDesign: harvestDesign,
  };
}
