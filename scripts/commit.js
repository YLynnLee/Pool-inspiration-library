#!/usr/bin/env node
// Writes one finished drain (or extract) result into the library, so the
// agent's only output is a JSON file and the write-order and file-format
// rules live in code no model can get wrong. See
// docs/agents/drain-result.md for the result shape and
// AGENTS.md for why.
//
//   node scripts/commit.js <result.json> [--dry-run] [--skip-lint]
//
// A drain result (has `reference`) is written in drain.md's order:
// screenshots, then category, then reference, then design system, then the
// inbox line is struck. An extract result (only `designSystem`) replaces or
// appends that reference's design system. --dry-run validates and lints
// without writing anything; run it first and fix every reported problem.

var fs = require('fs');
var os = require('os');
var path = require('path');
var childProcess = require('child_process');
var curation = require('../js/curation.js');
var lib = require('./drain-lib.js');
var lock = require('./lock.js');
var atomicWrite = require('./atomic-write.js').writeAtomic;

var ROOT = path.resolve(__dirname, '..');
var FILES = {
  inbox: path.join(ROOT, 'inbox.md'),
  library: path.join(ROOT, 'data/library.js'),
  categories: path.join(ROOT, 'data/categories.js'),
  designSystems: path.join(ROOT, 'data/design-systems.js'),
};
// Every drain path (interactive, the app's Drain button, drain-run.js) ends
// up here, and every write below is a full rewrite of one of the FILES
// above, so two commits running at once could silently lose one's
// additions to the other's. This lock serialises them; see lock.js for why
// and how.
var LOCK_FILE = path.join(ROOT, '.scratch/commit.lock');

function load(file, name) {
  delete require.cache[require.resolve(file)];
  return require(file)[name];
}

// extract.md's lint step: serialise to a temp DESIGN.md and run Google's
// linter over it. The linter exits 0 even on findings, so errors are read
// from its JSON summary.
function lint(ds) {
  var tmp = path.join(os.tmpdir(), 'design-' + ds.referenceId + '-' + process.pid + '.md');
  fs.writeFileSync(tmp, curation.serializeDesignMd(ds));
  try {
    var run = childProcess.spawnSync('npx', ['--yes', '@google/design.md', 'lint', tmp], { encoding: 'utf8', cwd: ROOT });
    if (run.error || run.status !== 0) {
      return { ok: false, text: 'linter could not run: ' + (run.error ? run.error.message : run.stderr.trim()) + ' (offline? use --skip-lint and say so in your report)' };
    }
    var report = JSON.parse(run.stdout);
    var problems = report.findings.filter(function (f) { return f.severity === 'error' || f.severity === 'warning'; });
    return {
      ok: report.summary.errors === 0,
      text: problems.map(function (f) { return f.severity + ': ' + (f.path ? f.path + ': ' : '') + f.message; }).join('\n'),
    };
  } finally {
    fs.unlinkSync(tmp);
  }
}

// Frames are PNGs (what the model sees) with a .webp twin written by
// capture.js (what the library stores), so writing screenshots is a copy.
function webpTwin(frame) {
  return path.resolve(ROOT, frame).replace(/\.png$/i, '.webp');
}

function writeScreenshots(frames, targets) {
  frames.forEach(function (frame, i) {
    fs.copyFileSync(webpTwin(frame), path.join(ROOT, targets[i]));
  });
}

function main(argv) {
  var file = argv.find(function (a) { return !a.startsWith('--'); });
  var dryRun = argv.indexOf('--dry-run') !== -1;
  var skipLint = argv.indexOf('--skip-lint') !== -1;
  if (!file) {
    console.error('usage: node scripts/commit.js <result.json> [--dry-run] [--skip-lint]');
    return 64;
  }

  var result;
  try {
    result = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (e) {
    console.error('could not read ' + file + ' as JSON: ' + e.message);
    return 1;
  }

  // Everything from here on reads then rewrites data/*.js whole, so it all
  // runs under one lock: a second, overlapping commit.js waits instead of
  // reading the same pre-write state and clobbering this run's additions
  // when it writes.
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  try {
    return lock.withLock(LOCK_FILE, function () { return commitLocked(file, result, dryRun, skipLint); });
  } catch (e) {
    console.error('Not committed — ' + e.message);
    return 1;
  }
}

function commitLocked(file, result, dryRun, skipLint) {
  var state = {
    library: load(FILES.library, 'LIBRARY'),
    categories: load(FILES.categories, 'CATEGORIES'),
    designSystems: load(FILES.designSystems, 'DESIGN_SYSTEMS'),
  };
  var isDrain = !!result.reference;
  var errors = isDrain ? lib.validateDrainResult(result, state) : lib.validateExtractResult(result, state);
  if (isDrain) {
    (result.frames || []).forEach(function (frame) {
      if (!fs.existsSync(path.resolve(ROOT, frame))) errors.push('frame not found: ' + frame);
      else if (!fs.existsSync(webpTwin(frame))) errors.push('frame has no .webp twin (re-run scripts/capture.js): ' + frame);
    });
  }
  if (errors.length) {
    console.error('Not committed — fix these in ' + file + ' and re-run:\n- ' + errors.join('\n- '));
    return 1;
  }

  if (skipLint) {
    console.log('lint: SKIPPED (--skip-lint) — report this to the collector');
  } else {
    var linted = lint(result.designSystem);
    if (!linted.ok) {
      console.error('Not committed — DESIGN.md lint failed:\n' + linted.text);
      return 1;
    }
    console.log('lint: clean' + (linted.text ? ' (warnings below)\n' + linted.text : ''));
  }

  if (dryRun) {
    console.log('dry run: valid, nothing written');
    return 0;
  }

  if (!isDrain) {
    atomicWrite(FILES.designSystems, curation.serializeDesignSystems(lib.upsertDesignSystem(state.designSystems, result.designSystem)));
    console.log('wrote design system for ' + result.designSystem.referenceId);
    return 0;
  }

  var ref = result.reference;
  var screenshots = lib.screenshotPaths(ref.id, result.frames.length);
  writeScreenshots(result.frames, screenshots);
  console.log('wrote ' + screenshots.join(', '));

  if (result.newCategory) {
    var cat = result.newCategory;
    state.categories.push({ id: cat.id, name: cat.name, definition: cat.definition, description: cat.description, vocabulary: cat.vocabulary });
    atomicWrite(FILES.categories, curation.serializeCategories(state.categories));
    console.log('created category ' + cat.id + ' (nearest rejected: ' + result.rejectedCategory + ')');
  }

  state.library.push(lib.buildReference(ref, screenshots, new Date().toISOString()));
  atomicWrite(FILES.library, curation.serializeLibrary(state.library));
  console.log('added reference ' + ref.id + (ref.status === 'draft' ? ' (draft: ' + ref.draftReason + ')' : ''));

  atomicWrite(FILES.designSystems, curation.serializeDesignSystems(lib.upsertDesignSystem(state.designSystems, result.designSystem)));
  console.log('wrote design system for ' + ref.id);

  var inbox = fs.existsSync(FILES.inbox) ? fs.readFileSync(FILES.inbox, 'utf8') : '';
  atomicWrite(FILES.inbox, curation.removeCaptureLine(inbox, result.line));
  console.log('struck inbox line: ' + result.line);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
