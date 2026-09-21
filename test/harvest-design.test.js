const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeColor,
  primaryFontFamily,
  aggregateColors,
  clusterFonts,
  buildSpacingHistogram,
  aggregateRadii,
  aggregateShadows,
  computeLayout,
  detectCanvasDominance,
  isVisible,
} = require('../scripts/harvest-design.js');

test('normalizeColor: rgb() and rgba(..., 1) collapse to the same key', () => {
  assert.equal(normalizeColor('rgb(0, 0, 0)'), normalizeColor('rgba(0, 0, 0, 1)'));
});

test('normalizeColor: fully transparent colour returns null', () => {
  assert.equal(normalizeColor('rgba(0, 0, 0, 0)'), null);
});

test('normalizeColor: an SVG paint-server reference is not a colour', () => {
  assert.equal(normalizeColor('url("#bar-gradient")'), null);
});

test('normalizeColor: partial alpha is preserved and rounded', () => {
  assert.equal(normalizeColor('rgba(10, 20, 30, 0.5)'), 'rgba(10, 20, 30, 0.5)');
});

test('aggregateColors: ranks by painted area, not occurrence count', () => {
  const records = [
    // Three small border slivers outnumber the one page-ground record...
    { property: 'border-color', color: 'rgb(200, 0, 0)', area: 10 },
    { property: 'border-color', color: 'rgb(200, 0, 0)', area: 10 },
    { property: 'border-color', color: 'rgb(200, 0, 0)', area: 10 },
    // ...but the ground still covers far more area and must rank first.
    { property: 'background-color', color: 'rgb(0, 0, 0)', area: 1000000 },
  ];
  const result = aggregateColors(records, 15);
  assert.equal(result[0].color, 'rgb(0, 0, 0)');
  assert.ok(result[0].areaShare > result[1].areaShare);
});

test('aggregateColors: merges rgb()/rgba(...,1) and reports contributing properties', () => {
  const records = [
    { property: 'background-color', color: 'rgb(0, 0, 0)', area: 100 },
    { property: 'color', color: 'rgba(0, 0, 0, 1)', area: 50 },
  ];
  const result = aggregateColors(records, 15);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].properties, ['background-color', 'color']);
});

test('aggregateColors: skips fully transparent entries', () => {
  const records = [
    { property: 'border-color', color: 'rgba(0, 0, 0, 0)', area: 500 },
    { property: 'background-color', color: 'rgb(255, 255, 255)', area: 10 },
  ];
  const result = aggregateColors(records, 15);
  assert.equal(result.length, 1);
  assert.equal(result[0].color, 'rgb(255, 255, 255)');
});

test('aggregateColors: caps at topN by area', () => {
  const records = [];
  for (let i = 0; i < 20; i++) {
    records.push({ property: 'color', color: `rgb(${i}, ${i}, ${i})`, area: i + 1 });
  }
  const result = aggregateColors(records, 15);
  assert.equal(result.length, 15);
  assert.equal(result[0].color, 'rgb(19, 19, 19)');
});

test('primaryFontFamily: drops the fallback chain and surrounding quotes', () => {
  assert.equal(primaryFontFamily('"HelveticaNowDisplay", -apple-system, "system-ui", sans-serif'), 'HelveticaNowDisplay');
});

test('clusterFonts: trims each record to its primary family, keeping the digest compact', () => {
  const result = clusterFonts(
    [{ family: 'Georgia, "Times New Roman", serif', size: '16px', weight: '400', lineHeight: 'normal', letterSpacing: 'normal', area: 100, sample: 'Body copy' }],
    25
  );
  assert.equal(result[0].fontFamily, 'Georgia');
});

test('clusterFonts: keys on family+size+weight+line-height+letter-spacing', () => {
  const records = [
    { family: 'Georgia', size: '16px', weight: '400', lineHeight: '24px', letterSpacing: 'normal', area: 100, sample: 'Hello world' },
    { family: 'Georgia', size: '16px', weight: '400', lineHeight: '24px', letterSpacing: 'normal', area: 200, sample: 'Second line' },
    { family: 'Georgia', size: '32px', weight: '700', lineHeight: '40px', letterSpacing: 'normal', area: 50, sample: 'Heading' },
  ];
  const result = clusterFonts(records, 25);
  assert.equal(result.length, 2);
  const body = result.find((c) => c.fontSize === '16px');
  assert.equal(body.elementCount, 2);
  assert.equal(body.sample, 'Hello world');
});

test('clusterFonts: ranks by painted area and caps at topN', () => {
  const records = [];
  for (let i = 0; i < 30; i++) {
    records.push({ family: 'Arial', size: `${i}px`, weight: '400', lineHeight: 'normal', letterSpacing: 'normal', area: i + 1, sample: 'x' });
  }
  const result = clusterFonts(records, 25);
  assert.equal(result.length, 25);
  assert.equal(result[0].fontSize, '29px');
});

test('clusterFonts: truncates long samples', () => {
  const longText = 'a'.repeat(200);
  const result = clusterFonts([{ family: 'Arial', size: '16px', weight: '400', lineHeight: 'normal', letterSpacing: 'normal', area: 10, sample: longText }], 25);
  assert.ok(result[0].sample.length <= 28);
});

test('buildSpacingHistogram: counts non-zero values and infers a base unit', () => {
  const values = [{ value: 8 }, { value: 8 }, { value: 8 }, { value: 16 }, { value: 0 }, { value: 3 }];
  const result = buildSpacingHistogram(values, 20);
  assert.deepEqual(
    result.find((r) => r.value === 8),
    { value: 8, count: 3 }
  );
  assert.ok(!result.some((r) => r.value === 0));
});

test('buildSpacingHistogram: output is sorted ascending by value', () => {
  const values = [{ value: 24 }, { value: 4 }, { value: 4 }, { value: 12 }, { value: 12 }];
  const result = buildSpacingHistogram(values, 20);
  const ordered = result.map((r) => r.value);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b));
});

test('aggregateRadii: distinct values with a sample and a count, ranked by frequency', () => {
  const records = [
    { value: '8px', sample: 'button.btn' },
    { value: '8px', sample: 'div.card' },
    { value: '50%', sample: 'img.avatar' },
    { value: '0px', sample: 'div.flat' },
  ];
  const result = aggregateRadii(records, 15);
  assert.equal(result.length, 2);
  assert.equal(result[0].value, '8px');
  assert.equal(result[0].count, 2);
  assert.equal(result[0].sample, 'button.btn');
  assert.ok(!result.some((r) => r.value === '0px'));
});

test('aggregateShadows: distinct non-none values with counts', () => {
  const records = [{ value: '0px 2px 4px rgba(0,0,0,0.1)' }, { value: '0px 2px 4px rgba(0,0,0,0.1)' }, { value: 'none' }];
  const result = aggregateShadows(records, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].count, 2);
});

test('computeLayout: picks the widest recurring width under the viewport', () => {
  const widths = [1440, 1440, 1200, 1200, 1200, 600];
  const result = computeLayout(widths, 1440);
  assert.equal(result.containerWidth, 1200);
  assert.equal(result.viewportWidth, 1440);
});

test('computeLayout: null when nothing recurs', () => {
  const result = computeLayout([1000, 900, 800], 1440);
  assert.equal(result.containerWidth, null);
});

test('detectCanvasDominance: flags a page where canvas covers most of the viewport', () => {
  const note = detectCanvasDominance(900 * 600, 1000 * 700);
  assert.ok(note && note.indexOf('canvas-dominated') !== -1);
  assert.ok(note.indexOf('77%') !== -1);
});

test('detectCanvasDominance: null when canvas covers only a small share', () => {
  assert.equal(detectCanvasDominance(50 * 50, 1000 * 700), null);
});

test('isVisible: false for display:none, hidden, zero opacity, or zero area', () => {
  const rect = { width: 100, height: 50 };
  assert.equal(isVisible({ display: 'none', visibility: 'visible', opacity: '1' }, rect), false);
  assert.equal(isVisible({ display: 'block', visibility: 'hidden', opacity: '1' }, rect), false);
  assert.equal(isVisible({ display: 'block', visibility: 'visible', opacity: '0' }, rect), false);
  assert.equal(isVisible({ display: 'block', visibility: 'visible', opacity: '1' }, { width: 0, height: 50 }), false);
  assert.equal(isVisible({ display: 'block', visibility: 'visible', opacity: '1' }, rect), true);
});
