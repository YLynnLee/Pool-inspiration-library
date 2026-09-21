const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { serializeDesignMd, serializeDesignSystems, parseDosAndDonts } = require('../js/curation.js');

// Splits a serialized DESIGN.md into its YAML front matter and markdown
// body, so a test can assert something is absent from one without the
// other's prose accidentally containing the same substring.
function splitFrontMatter(designMd) {
  var lines = designMd.split('\n');
  assert.equal(lines[0], '---', 'must open with a --- fence');
  var closeIndex = lines.indexOf('---', 1);
  assert.notEqual(closeIndex, -1, 'must close the front matter with a --- fence');
  return {
    yaml: lines.slice(1, closeIndex).join('\n'),
    body: lines.slice(closeIndex + 1).join('\n'),
  };
}

function makeMinimalEntry(overrides) {
  return Object.assign(
    {
      referenceId: 'entry-1',
      name: 'Some Site',
      description: 'Measured from the live site; nothing inferred.',
      colors: {
        primary: { value: '#111111', displayName: 'Near Black', role: 'the ground' },
      },
      typography: {
        'body-md': { fontFamily: 'Inter', fontSize: '16px', fontWeight: 400, lineHeight: 1.5 },
      },
      sections: {
        overview: 'A plain overview.',
      },
    },
    overrides
  );
}

// ---- serializeDesignMd: section order and omission ----------------------

test('serializeDesignMd: prose sections emit in canonical order regardless of object key order', () => {
  const entry = makeMinimalEntry({
    sections: {
      dosAndDonts: "### Do:\n- Do keep it simple.",
      overview: 'The overview text.',
      shapes: 'The shapes text.',
      colors: 'The colors text.',
    },
  });
  const md = serializeDesignMd(entry);
  const { body } = splitFrontMatter(md);
  const overviewAt = body.indexOf('## Overview');
  const colorsAt = body.indexOf('## Colors');
  const shapesAt = body.indexOf('## Shapes');
  const dosAt = body.indexOf("## Do's and Don'ts");
  assert.ok(overviewAt !== -1 && colorsAt !== -1 && shapesAt !== -1 && dosAt !== -1);
  assert.ok(overviewAt < colorsAt);
  assert.ok(colorsAt < shapesAt);
  assert.ok(shapesAt < dosAt);
});

test('serializeDesignMd: absent sections are skipped entirely, not emitted empty', () => {
  const entry = makeMinimalEntry({ sections: { overview: 'Only this one.' } });
  const md = serializeDesignMd(entry);
  const { body } = splitFrontMatter(md);
  assert.ok(body.indexOf('## Overview') !== -1);
  ['## Colors', '## Typography', '## Layout', '## Elevation & Depth', '## Shapes', '## Components', "## Do's and Don'ts"].forEach(
    (heading) => {
      assert.equal(body.indexOf(heading), -1, `${heading} should not appear`);
    }
  );
});

test('serializeDesignMd: an entry with no sections at all produces no prose body', () => {
  const entry = makeMinimalEntry({ sections: {} });
  const md = serializeDesignMd(entry);
  const { body } = splitFrontMatter(md);
  assert.equal(body.trim(), '');
});

// ---- omitted -------------------------------------------------------------

test('serializeDesignMd: omitted entries in string form pass through as a plain list', () => {
  const entry = makeMinimalEntry({ omitted: ['spacing'] });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.match(yaml, /omitted:\n {2}- spacing/);
});

test('serializeDesignMd: omitted entries in {section, reason} form carry the reason', () => {
  const entry = makeMinimalEntry({
    omitted: [{ section: 'components', reason: 'No repeated component language on this site.' }],
  });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.match(yaml, /omitted:\n {2}- section: components\n {4}reason: No repeated component language on this site\./);
});

test('serializeDesignMd: omitted is absent from the YAML entirely when there is nothing to omit', () => {
  const entry = makeMinimalEntry({ omitted: [] });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.equal(yaml.indexOf('omitted:'), -1);
});

// ---- token references -----------------------------------------------------

test('serializeDesignMd: {path.to.token} references pass through verbatim', () => {
  const entry = makeMinimalEntry({
    rounded: { lg: '12px' },
    components: {
      'button-primary': {
        backgroundColor: '{colors.primary}',
        rounded: '{rounded.lg}',
        typography: '{typography.body-md}',
      },
    },
  });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.match(yaml, /backgroundColor: "\{colors\.primary\}"/);
  assert.match(yaml, /rounded: "\{rounded\.lg\}"/);
  assert.match(yaml, /typography: "\{typography\.body-md\}"/);
});

// ---- displayName / role / fonts never leak into YAML ---------------------

test('serializeDesignMd: colors[key].displayName and .role never reach the YAML', () => {
  const entry = makeMinimalEntry({
    colors: {
      primary: { value: '#d8fb3c', displayName: 'Bioluminescent Lime', role: 'the single accent' },
    },
  });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.match(yaml, /primary: "#d8fb3c"/);
  assert.equal(yaml.indexOf('Bioluminescent Lime'), -1);
  assert.equal(yaml.indexOf('the single accent'), -1);
  assert.equal(yaml.indexOf('displayName'), -1);
  assert.equal(yaml.indexOf('role'), -1);
});

test('serializeDesignMd: the fonts array never reaches the YAML', () => {
  const entry = makeMinimalEntry({
    fonts: [
      {
        family: 'Inter',
        role: 'body/UI',
        substitutes: ['-apple-system', 'BlinkMacSystemFont', 'Courier New', 'sans-serif'],
      },
    ],
  });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  assert.equal(yaml.indexOf('fonts'), -1);
  assert.equal(yaml.indexOf('Courier New'), -1);
  assert.equal(yaml.indexOf('substitutes'), -1);
});

// ---- YAML field order ------------------------------------------------------

test('serializeDesignMd: top-level YAML keys follow name, description, omitted, colors, typography, rounded, spacing, components', () => {
  const entry = makeMinimalEntry({
    omitted: ['components'],
    rounded: { sm: '4px' },
    spacing: { unit: '8px' },
  });
  const { yaml } = splitFrontMatter(serializeDesignMd(entry));
  const order = ['name:', 'description:', 'omitted:', 'colors:', 'typography:', 'rounded:', 'spacing:'];
  let lastIndex = -1;
  order.forEach((key) => {
    const index = yaml.indexOf('\n' + key) === -1 && yaml.indexOf(key) === 0 ? 0 : yaml.indexOf('\n' + key);
    assert.ok(index > lastIndex, `${key} should follow the previous key`);
    lastIndex = index;
  });
});

// ---- round-trip the atmospheric-glass example -----------------------------
// A hand-built entry modelled on examples/atmospheric-glass/DESIGN.md from
// google-labs-code/design.md. Exercises every YAML-bearing field
// this serialiser supports in combination, then actually lints the output
// with the real CLI.
const ATMOSPHERIC_GLASS_ENTRY = {
  referenceId: 'atmospheric-glass-fixture',
  name: 'Atmospheric Glass',
  description: 'Fixture modelled on the google-labs-code/design.md atmospheric-glass example; all values measured from that source file.',
  colors: {
    surface: { value: '#0b1326', displayName: 'Deep Night', role: 'the page background' },
    'surface-container-lowest': { value: '#060e20' },
    'surface-container': { value: '#171f33' },
    'on-surface': { value: '#dae2fd', displayName: 'Ice White', role: 'primary text' },
    'on-surface-variant': { value: '#c4c7c8' },
    outline: { value: '#8e9192' },
    primary: { value: '#ffffff', displayName: 'Pure White', role: 'the single accent' },
    'on-primary': { value: '#2f3131' },
    'primary-container': { value: '#e2e2e2' },
    secondary: { value: '#adc9eb' },
    'on-secondary': { value: '#14324e' },
    tertiary: { value: '#ffffff' },
    'on-tertiary': { value: '#620040' },
    error: { value: '#ffb4ab' },
    'on-error': { value: '#690005' },
    background: { value: '#0b1326' },
    'on-background': { value: '#dae2fd' },
  },
  typography: {
    'display-lg': { fontFamily: 'Inter', fontSize: '84px', fontWeight: 700, lineHeight: '90px', letterSpacing: '-0.04em' },
    'headline-lg': { fontFamily: 'Inter', fontSize: '32px', fontWeight: 600, lineHeight: '40px', letterSpacing: '-0.02em' },
    'headline-md': { fontFamily: 'Inter', fontSize: '24px', fontWeight: 500, lineHeight: '32px' },
    'body-lg': { fontFamily: 'Inter', fontSize: '18px', fontWeight: 400, lineHeight: '28px' },
    'body-md': { fontFamily: 'Inter', fontSize: '16px', fontWeight: 400, lineHeight: '24px' },
    'label-sm': { fontFamily: 'Inter', fontSize: '12px', fontWeight: 600, lineHeight: '16px', letterSpacing: '0.05em' },
  },
  fonts: [
    {
      family: 'Inter',
      role: 'the only typeface in the system',
      substitutes: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    },
  ],
  rounded: {
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },
  spacing: {
    unit: '8px',
    'container-padding': '24px',
    'card-gap': '16px',
    'section-margin': '40px',
    'glass-padding': '20px',
  },
  components: {
    'glass-card-standard': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      textColor: '{colors.primary}',
      rounded: '{rounded.lg}',
      padding: '{spacing.glass-padding}',
    },
    'button-primary': {
      backgroundColor: '{colors.primary}',
      textColor: '{colors.on-primary}',
      typography: '{typography.label-sm}',
      rounded: '{rounded.xl}',
      height: '48px',
      padding: '0 24px',
    },
    'input-field': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      textColor: '{colors.primary}',
      typography: '{typography.body-md}',
      rounded: '{rounded.xl}',
      padding: '20px',
      height: '48px',
    },
  },
  sections: {
    overview:
      'This design system centers on a high-fidelity Glassmorphism aesthetic designed to evoke a sense of clarity, depth, and modern sophistication. The brand personality is ethereal yet functional, transforming complex meteorological data into a serene visual experience.',
    colors:
      'The color strategy prioritizes luminosity and contrast. Because the background is a vibrant, multi-colored abstract composition, the UI components utilize a monochromatic white palette with varying alpha channels to maintain legibility.\n\n' +
      '- **Primary (#ffffff):** the single accent, used at full opacity only where contrast is highest.\n' +
      '- **Surface (#0b1326):** the deep-night ground the glass panels float above.',
    typography:
      'The design system utilizes **Inter** for its neutral, geometric clarity which balances the organic nature of the blurred backgrounds. Large display sizes are used for temperature readings to create a clear focal point.',
    layout:
      'The layout follows a fluid, contextual model. An 8px base grid governs all dimensions; related metrics are grouped with 16px gaps, and 24px+ outer margins keep the background visible.',
    elevation:
      'Depth is achieved through the physics of light and refraction rather than darkness: standard cards use a 20px blur, elevated cards (modals) use 40px, and every glass surface carries a 1px white border to simulate refraction.',
    shapes:
      'The shape language is organic and approachable. Standard cards use 1rem radius; buttons and search bars use the xl (1.5rem) radius for a soft, tactile feel.',
    components:
      'Glass containers, action elements and inputs all share the same alpha-blended, blurred-backdrop treatment described above, varying only in blur radius and corner radius.',
  },
};

test('serializeDesignMd: the atmospheric-glass fixture round-trips to a lint-clean DESIGN.md', () => {
  const md = serializeDesignMd(ATMOSPHERIC_GLASS_ENTRY);
  assert.match(md, /^---\nname: Atmospheric Glass\n/);

  const tmpFile = path.join(os.tmpdir(), `atmospheric-glass-fixture-${process.pid}.md`);
  fs.writeFileSync(tmpFile, md);
  try {
    let output;
    try {
      output = execFileSync('npx', ['--yes', '@google/design.md', 'lint', tmpFile], {
        encoding: 'utf8',
        timeout: 60000,
      });
    } catch (spawnError) {
      // The linter is a network-fetched CLI (npx @google/design.md); if it
      // cannot be reached at all in this environment, skip rather than fail
      // the suite on an infrastructure problem unrelated to the serialiser.
      if (spawnError.code === 'ENOENT' || /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EACCES|EEXIST/.test(String(spawnError))) {
        test.skip('npx @google/design.md unreachable in this environment');
        return;
      }
      // A non-zero exit still carries the JSON report on stdout.
      output = spawnError.stdout ? spawnError.stdout.toString() : '';
      if (!output) throw spawnError;
    }
    const report = JSON.parse(output);
    assert.equal(report.summary.errors, 0, JSON.stringify(report.findings, null, 2));
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// ---- serializeDesignSystems (data file round trip) ------------------------

function evalDesignSystemsSource(source) {
  const moduleObj = { exports: {} };
  const fn = new Function('module', 'exports', source);
  fn(moduleObj, moduleObj.exports);
  return moduleObj.exports.DESIGN_SYSTEMS;
}

test('serializeDesignSystems: round-trips the real data/design-systems.js byte-identically when no data has changed', () => {
  const onDisk = fs.readFileSync(path.join(__dirname, '..', 'data', 'design-systems.js'), 'utf8');
  const { DESIGN_SYSTEMS } = require('../data/design-systems.js');
  assert.equal(serializeDesignSystems(DESIGN_SYSTEMS), onDisk);
});

test('serializeDesignSystems: output re-parses to equivalent data via a real JS eval', () => {
  const entries = [makeMinimalEntry({ referenceId: 'entry-a' }), makeMinimalEntry({ referenceId: 'entry-b' })];
  const parsed = evalDesignSystemsSource(serializeDesignSystems(entries));
  assert.deepEqual(parsed, entries);
});

test('serializeDesignSystems: optional nested fields are included only when present', () => {
  const withExtras = makeMinimalEntry({
    referenceId: 'with-extras',
    fonts: [{ family: 'Inter', role: 'body' }],
    components: { button: { backgroundColor: '#fff' } },
    omitted: ['spacing'],
  });
  const source = serializeDesignSystems([withExtras]);
  assert.match(source, /fonts: \[/);
  assert.match(source, /components: \{/);
  assert.match(source, /omitted: \[/);

  const withoutExtras = makeMinimalEntry({ referenceId: 'without-extras' });
  const source2 = serializeDesignSystems([withoutExtras]);
  assert.equal(/\n {4}fonts: /.test(source2), false);
  assert.equal(/\n {4}components: /.test(source2), false);
  assert.equal(/\n {4}omitted: /.test(source2), false);
});

test('serializeDesignSystems: an empty array yields empty entries and no error', () => {
  assert.ok(serializeDesignSystems([]).indexOf('const DESIGN_SYSTEMS = [\n];') !== -1);
});

// ---- parseDosAndDonts: sections.dosAndDonts -> two plain lists -----------

test('parseDosAndDonts: splits the "### Do:" / "### Don\'t:" convention into two lists', () => {
  const text = "### Do:\n- **Do** keep the ground true black.\n- **Do** use one accent.\n\n### Don't:\n- **Don't** add a gradient.\n- **Don't** introduce a second face.";
  const result = parseDosAndDonts(text);
  assert.deepEqual(result.dos, ['Do keep the ground true black.', 'Do use one accent.']);
  assert.deepEqual(result.donts, ["Don't add a gradient.", "Don't introduce a second face."]);
});

test('parseDosAndDonts: strips bold markdown markers from list items', () => {
  const text = '### Do:\n- **Do** this.';
  const result = parseDosAndDonts(text);
  assert.deepEqual(result.dos, ['Do this.']);
});

test('parseDosAndDonts: missing or empty text yields two empty lists', () => {
  assert.deepEqual(parseDosAndDonts(''), { dos: [], donts: [] });
  assert.deepEqual(parseDosAndDonts(undefined), { dos: [], donts: [] });
});

test('parseDosAndDonts: text with no recognised heading yields two empty lists', () => {
  assert.deepEqual(parseDosAndDonts('- a stray bullet with no heading'), { dos: [], donts: [] });
});

test('parseDosAndDonts: real Locomotive and Ciao Energy fixtures parse into non-empty balanced lists', () => {
  const { DESIGN_SYSTEMS } = require('../data/design-systems.js');
  DESIGN_SYSTEMS.forEach((entry) => {
    const result = parseDosAndDonts(entry.sections.dosAndDonts);
    assert.ok(result.dos.length > 0, entry.referenceId + ' should have at least one do');
    assert.ok(result.donts.length > 0, entry.referenceId + " should have at least one don't");
  });
});
