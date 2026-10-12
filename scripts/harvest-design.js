// Measures the design tokens a rendered page actually painted: colour by
// area, font clusters (and whether their webfonts loaded), spacing, radii,
// shadows, container width — plus the custom properties the site declares
// on :root, as names for those measurements. Runs
// standalone in a plain browser console (paste-and-go, no dependencies) or
// injected by an automation tool after the page settles. The pure
// aggregation functions below
// are also `require()`-able from Node for testing, same CommonJS-footer
// convention as js/curation.js and js/query.js; the DOM walk in
// harvestDesign() only runs where `document` exists.
//
// The point of aggregating in the page is that the return value must stay a
// one-to-two-kilobyte digest, never a DOM dump — see docs/agents/extract.md.

var MIN_DOM_SIZE = 40;
var TOP_COLOURS = 15;
var TOP_FONTS = 25;
var TOP_SPACING = 12;
var TOP_RADII = 15;
var TOP_SHADOWS = 10;
var TOP_CUSTOM_PROPERTIES = 40;
var SAMPLE_MAX_CHARS = 20;
var CUSTOM_PROPERTY_VALUE_MAX_CHARS = 60;
var ROOT_SELECTORS = { ':root': true, html: true, ':host': true };
var SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
var SVG_SHAPE_TAGS = { path: true, circle: true, rect: true, ellipse: true, polygon: true, polyline: true, line: true, text: true, tspan: true, use: true };

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

// The colour records one element contributes, each with the area it paints.
// `color` and `fill` are both inherited, so reading them off every element
// would credit the body text colour once per level of nesting and paint a
// phantom black (fill's initial value) over the whole page: `color` only
// counts where the element carries its own text, `fill` only on SVG shapes.
function colourRecordsFor(cs, rect, opts) {
  var records = [];
  var area = rect.width * rect.height;
  records.push({ property: 'background-color', color: cs.backgroundColor, area: area });
  if (opts.hasText && !opts.isSvgShape) {
    records.push({ property: 'color', color: cs.color, area: area });
  }
  if (opts.isSvgShape && typeof cs.fill === 'string' && cs.fill && cs.fill !== 'none') {
    records.push({ property: 'fill', color: cs.fill, area: area });
  }
  var borderWidths = [parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderRightWidth) || 0, parseFloat(cs.borderBottomWidth) || 0, parseFloat(cs.borderLeftWidth) || 0];
  var avgBorderWidth = (borderWidths[0] + borderWidths[1] + borderWidths[2] + borderWidths[3]) / 4;
  if (avgBorderWidth > 0) {
    var perimeter = 2 * (rect.width + rect.height);
    records.push({ property: 'border-color', color: cs.borderTopColor, area: perimeter * avgBorderWidth });
  }
  return records;
}

// The site's own token names: custom properties declared on :root/html,
// ranked by how many var() references the stylesheets make to them. A
// utility framework can declare hundreds it never uses, so once anything is
// referenced the unreferenced ones are dropped. Declared, not painted —
// evidence for naming the measured values, not a substitute for them.
function rankCustomProperties(declared, uses, topN) {
  var limit = topN || TOP_CUSTOM_PROPERTIES;
  var counts = uses || {};
  var entries = Object.keys(declared || {})
    .map(function (name) {
      var value = (declared[name] || '').toString().trim();
      return { name: name, value: value.slice(0, CUSTOM_PROPERTY_VALUE_MAX_CHARS), uses: counts[name] || 0 };
    })
    .filter(function (entry) {
      return entry.value;
    });
  var anyUsed = entries.some(function (entry) {
    return entry.uses > 0;
  });
  return entries
    .filter(function (entry) {
      return !anyUsed || entry.uses > 0;
    })
    .sort(function (a, b) {
      return b.uses - a.uses || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    })
    .slice(0, limit);
}

// Whether each family the font clusters name actually loaded. The computed
// family is the first in the stack whether or not its webfont arrived, so a
// failed @font-face means the page showed a fallback the clusters don't
// name. `system` means no @font-face declares it: it rendered only if
// installed on the capturing machine (or it's a generic like sans-serif).
function fontLoadStatus(families, faces) {
  return (families || []).map(function (family) {
    var key = family.toLowerCase();
    var statuses = (faces || [])
      .filter(function (face) {
        return primaryFontFamily(face.family).toLowerCase() === key;
      })
      .map(function (face) {
        return face.status;
      });
    var status = 'system';
    if (statuses.length) {
      if (statuses.indexOf('loaded') !== -1) status = 'loaded';
      else if (statuses.indexOf('error') !== -1) status = 'failed';
      else if (statuses.indexOf('loading') !== -1) status = 'loading';
      else status = 'not loaded';
    }
    return { family: family, status: status };
  });
}

// The family the page asked for is the first name in a computed font-family
// stack; the rest is the browser's fallback chain, which bloats the digest
// without telling the agent anything it can't already assume. Whether that
// first family actually loaded is fontLoadStatus's job.
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
// property each observation came from — only the values and their counts
// are recorded.
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

function isSvgShape(el) {
  return el.namespaceURI === SVG_NAMESPACE && !!SVG_SHAPE_TAGS[el.tagName.toLowerCase()];
}

// Custom properties declared on :root/html (inside @media, @layer, @supports
// and @import too) and a count of var() references to each across every
// readable stylesheet. Values come from the root's computed style, so a
// property redeclared under a media query reads as it resolved for this
// capture. Cross-origin sheets without CORS can't be read; they're counted.
function collectCustomProperties() {
  var names = {};
  var uses = {};
  var unreadableSheets = 0;
  var varPattern = /var\(\s*(--[A-Za-z0-9_-]+)/g;

  function readStyle(style, isRoot) {
    if (isRoot) {
      for (var i = 0; i < style.length; i++) {
        if (style[i].indexOf('--') === 0) names[style[i]] = true;
      }
    }
    var match;
    var text = style.cssText || '';
    varPattern.lastIndex = 0;
    while ((match = varPattern.exec(text))) uses[match[1]] = (uses[match[1]] || 0) + 1;
  }

  function walk(rules) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.style) {
        var isRoot = (rule.selectorText || '').split(',').some(function (selector) {
          return ROOT_SELECTORS[selector.trim()];
        });
        readStyle(rule.style, isRoot);
      }
      if (rule.styleSheet) readSheet(rule.styleSheet);
      if (rule.cssRules) walk(rule.cssRules);
    }
  }

  function readSheet(sheet) {
    var rules;
    try {
      rules = sheet.cssRules;
    } catch (err) {
      unreadableSheets += 1;
      return;
    }
    if (rules) walk(rules);
  }

  for (var s = 0; s < document.styleSheets.length; s++) readSheet(document.styleSheets[s]);
  readStyle(document.documentElement.style, true);

  var rootStyle = window.getComputedStyle(document.documentElement);
  var declared = {};
  Object.keys(names).forEach(function (name) {
    declared[name] = rootStyle.getPropertyValue(name);
  });
  return { declared: declared, uses: uses, unreadableSheets: unreadableSheets };
}

function collectFontFaces() {
  var faces = [];
  if (document.fonts && typeof document.fonts.forEach === 'function') {
    document.fonts.forEach(function (face) {
      faces.push({ family: face.family, status: face.status });
    });
  }
  return faces;
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
    var text = ownText(el);

    colorRecords.push.apply(colorRecords, colourRecordsFor(cs, rect, { hasText: !!text, isSvgShape: isSvgShape(el) }));

    if (text) {
      fontRecords.push({
        family: cs.fontFamily,
        size: cs.fontSize,
        weight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        area: area,
        sample: text,
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

  var fonts = clusterFonts(fontRecords);
  var families = [];
  fonts.forEach(function (cluster) {
    if (families.indexOf(cluster.fontFamily) === -1) families.push(cluster.fontFamily);
  });
  var fontLoading = fontLoadStatus(families, collectFontFaces());
  fontLoading.forEach(function (entry) {
    if (entry.status !== 'loaded' && entry.status !== 'system') {
      notes.push('font "' + entry.family + '" is declared by @font-face but ' + entry.status + ' — text set in it may have rendered in a fallback from its stack; check the screenshots');
    }
  });

  var custom = collectCustomProperties();
  if (custom.unreadableSheets > 0) {
    notes.push(custom.unreadableSheets + ' cross-origin stylesheet' + (custom.unreadableSheets === 1 ? '' : 's') + ' unreadable — custom properties declared there are missing from customProperties');
  }

  return {
    colours: aggregateColors(colorRecords),
    fonts: fonts,
    fontLoading: fontLoading,
    customProperties: rankCustomProperties(custom.declared, custom.uses),
    spacing: buildSpacingHistogram(spacingValues),
    radii: aggregateRadii(radiusRecords),
    shadows: aggregateShadows(shadowRecords),
    layout: computeLayout(containerWidths, window.innerWidth),
    notes: notes,
  };
}

// capture.js injects this file into a live page and calls harvestDesign()
// itself; it declares __poolHarvestAutoRunSkip__ first so this line stays a
// no-op there instead of double-running. Pasted standalone into a console,
// that variable is undeclared and this runs on its own.
typeof document !== 'undefined' && typeof __poolHarvestAutoRunSkip__ === 'undefined' ? harvestDesign() : undefined;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeColor: normalizeColor,
    colourRecordsFor: colourRecordsFor,
    rankCustomProperties: rankCustomProperties,
    fontLoadStatus: fontLoadStatus,
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
