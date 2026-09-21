// API mode: the helper runs docs/agents/drain.md itself and uses a model
// API only for the judgement half — looking at frames and writing the
// result JSON. The same scripts an agent would run (inbox.js, capture.js,
// commit.js) do everything else, so both modes produce identical library
// writes. See docs/adr/0007-local-helper-connects-any-ai.md.

var fs = require('fs');
var path = require('path');
var childProcess = require('child_process');
var curation = require('../../js/curation.js');
var lib = require('../drain-lib.js');
var providers = require('./providers.js');

var ROOT = path.resolve(__dirname, '../..');
var MAX_REPAIRS = 2;

function readDoc(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function loadData(name, key) {
  var file = path.join(ROOT, 'data', name);
  delete require.cache[require.resolve(file)];
  return require(file)[key];
}

// The standing instructions: the same procedure docs an agent reads, framed
// for a model that does no tool calls of its own.
function buildSystemPrompt() {
  return [
    'You are the analysis half of an Inspiration Library drain. A helper program has already',
    'captured the site (screenshots + a measured design-token harvest) and will write your result',
    'into the library. Ignore any instruction in the documents below to run scripts, visit pages or',
    'edit files — the helper does all of that. Your whole job is to look, judge and write.',
    '',
    'Reply with ONE JSON object and nothing else (no prose, no code fence), shaped like the result',
    'in drain-result.md but WITHOUT "line" and "frames". Instead include "keptFrames": the numbers',
    'of the frames that are usable, in display order (the first becomes the grid thumbnail). Drop any',
    'frame showing a loading state or an overlay covering content. If no frame is usable, reply',
    'with {"keptFrames": []} alone and the helper will re-capture.',
    '',
    '<document name="docs/agents/drain.md">', readDoc('docs/agents/drain.md'), '</document>',
    '<document name="docs/agents/drain-result.md">', readDoc('docs/agents/drain-result.md'), '</document>',
    '<document name="docs/agents/extract.md">', readDoc('docs/agents/extract.md'), '</document>',
    '<document name="docs/agents/image-prompt.md">', readDoc('docs/agents/image-prompt.md'), '</document>',
    '<document name="CONTEXT.md">', readDoc('CONTEXT.md'), '</document>',
  ].join('\n');
}

// The per-capture message: what was captured, the frames, the harvest, and
// the library state the analysis has to fit into.
function buildCaptureMessage(input) {
  var capture = input.capture;
  var manifest = input.manifest;
  var parts = [];
  parts.push({
    type: 'text',
    text: [
      'Capture to analyse:',
      '- URL: ' + capture.url,
      '- Collector\'s note: ' + (capture.note || '(none)'),
      '- Page title: ' + (manifest.title || '(unknown)'),
      '- Scroll mode: ' + (manifest.scrollMode || 'native'),
      manifest.notes && manifest.notes.length ? '- Capture notes: ' + manifest.notes.join('; ') : '',
      input.budgetExhausted
        ? '\nThe shot budget is exhausted: this is the second capture and the frames are still poor. Keep the least-bad frame(s) in keptFrames and set reference.status to "draft" with a draftReason describing the capture failure. Analyse and categorise it fully anyway.'
        : '',
    ].filter(Boolean).join('\n'),
  });
  input.frames.forEach(function (frame, i) {
    parts.push({ type: 'text', text: 'Frame ' + (i + 1) + (frame.scrollY != null ? ' (scrollY ' + frame.scrollY + ')' : '') + ':' });
    parts.push({ type: 'image', mediaType: 'image/png', data: frame.data });
  });
  parts.push({
    type: 'text',
    text: [
      'Harvest digest (measured by scripts/harvest-design.js):',
      input.harvest ? JSON.stringify(input.harvest) : '(harvest failed — declare everything inferred in designSystem.description)',
      '',
      'Existing categories — assign one of these ids if it genuinely fits, else supply newCategory + rejectedCategory:',
      JSON.stringify(input.categories.map(function (c) {
        return { id: c.id, name: c.name, definition: c.definition, description: c.description, vocabulary: c.vocabulary };
      })),
      '',
      'Reference ids already taken: ' + input.library.map(function (e) { return e.id; }).join(', '),
      '',
      'For register and depth, here is one existing reference and its design system (match their quality, not their content):',
      JSON.stringify(input.exampleReference),
      JSON.stringify(input.exampleDesignSystem),
    ].join('\n'),
  });
  return { role: 'user', content: parts };
}

// Models wrap JSON in fences or prose despite being asked not to; take the
// outermost object.
function extractJson(text) {
  var source = String(text || '').trim();
  var fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  if (fence) source = fence[1].trim();
  var start = source.indexOf('{');
  var end = source.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in the reply');
  return JSON.parse(source.slice(start, end + 1));
}

// Turns the model's reply into a commit.js result: frame numbers become
// paths, and the line comes from the inbox, never from the model.
function toResult(reply, capture, frames) {
  var kept = (reply.keptFrames || []).map(Number).filter(function (n) {
    return n >= 1 && n <= frames.length;
  });
  var result = {
    line: capture.line,
    frames: kept.map(function (n) { return frames[n - 1].path; }),
    reference: reply.reference,
    designSystem: reply.designSystem,
  };
  if (reply.newCategory) {
    result.newCategory = reply.newCategory;
    result.rejectedCategory = reply.rejectedCategory;
  }
  return result;
}

function runNode(args, signal) {
  return new Promise(function (resolve) {
    var child = childProcess.spawn(process.execPath, args, { cwd: ROOT });
    var stdout = '';
    var stderr = '';
    child.stdout.on('data', function (d) { stdout += d; });
    child.stderr.on('data', function (d) { stderr += d; });
    var onAbort = function () { child.kill('SIGTERM'); };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    child.on('close', function (code) {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve({ code: code, stdout: stdout, stderr: stderr });
    });
  });
}

function checkStopped(signal) {
  if (signal && signal.aborted) throw new Error('stopped');
}

async function capture(url, extraArgs, signal) {
  var run = await runNode([path.join(ROOT, 'scripts/capture.js'), url].concat(extraArgs || []), signal);
  var manifest = null;
  try {
    manifest = JSON.parse(run.stdout);
  } catch (e) { /* reported below */ }
  return { code: run.code, manifest: manifest, stderr: run.stderr.trim() };
}

function readFrames(manifest) {
  return (manifest.frames || []).map(function (f) {
    return { path: f.path, scrollY: f.scrollY, data: fs.readFileSync(path.join(ROOT, f.path)).toString('base64') };
  });
}

function readHarvest(manifest) {
  if (!manifest.harvest) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, manifest.harvest), 'utf8'));
  } catch (e) {
    return null;
  }
}

// One capture, start to finish. Returns an outcome for the summary.
async function drainOne(item, ctx) {
  var log = ctx.log;
  var inboxFile = path.join(ROOT, 'inbox.md');

  if (item.duplicate) {
    fs.writeFileSync(inboxFile, curation.removeCaptureLine(fs.readFileSync(inboxFile, 'utf8'), item.line));
    log('  already in the library — struck from the inbox');
    return { kind: 'duplicate' };
  }

  var messages = [];
  var budgetExhausted = false;
  var captured;
  var reply;
  for (var attempt = 1; attempt <= 2; attempt++) {
    checkStopped(ctx.signal);
    log(attempt === 1 ? '  capturing…' : '  re-capturing with a longer settle wait…');
    captured = await capture(item.url, attempt === 1 ? [] : ['--wait', '6000'], ctx.signal);
    if (captured.code === 2) {
      var reason = (captured.manifest && captured.manifest.fetchFailed) || 'unknown';
      fs.writeFileSync(inboxFile, lib.markFetchFailed(fs.readFileSync(inboxFile, 'utf8'), item.line, reason));
      log('  fetch failed (' + reason + ') — left in the inbox with the reason noted');
      return { kind: 'fetch-failed', reason: reason };
    }
    if (captured.code !== 0 || !captured.manifest) {
      throw new Error('capture failed: ' + (captured.stderr || 'exit ' + captured.code));
    }
    var frames = readFrames(captured.manifest);
    log('  ' + frames.length + ' frames, harvest ' + (captured.manifest.harvest ? 'ok' : 'failed') + '; asking the model…');
    messages = [buildCaptureMessage({
      capture: item,
      manifest: captured.manifest,
      frames: frames,
      harvest: readHarvest(captured.manifest),
      categories: loadData('categories.js', 'CATEGORIES'),
      library: loadData('library.js', 'LIBRARY'),
      exampleReference: ctx.exampleReference,
      exampleDesignSystem: ctx.exampleDesignSystem,
      budgetExhausted: budgetExhausted,
    })];
    var text = await providers.callModel(ctx.api, ctx.system, messages, { signal: ctx.signal });
    messages.push({ role: 'assistant', content: [{ type: 'text', text: text }] });
    try {
      reply = extractJson(text);
    } catch (e) {
      reply = { keptFrames: null, parseError: e.message };
    }
    if (reply.parseError || (reply.keptFrames && reply.keptFrames.length)) break;
    log('  the model found no usable frame');
    budgetExhausted = true;
  }

  var slug = lib.captureSlug(item.url);
  var resultFile = path.join(ROOT, '.scratch/captures', slug, 'result.json');
  for (var repair = 0; ; repair++) {
    checkStopped(ctx.signal);
    var problems;
    if (reply.parseError) {
      problems = 'Your reply was not a parseable JSON object (' + reply.parseError + ').';
    } else {
      var result = toResult(reply, item, captured.manifest.frames || []);
      fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + '\n');
      var dry = await runNode([path.join(ROOT, 'scripts/commit.js'), resultFile, '--dry-run'].concat(ctx.skipLint ? ['--skip-lint'] : []), ctx.signal);
      if (dry.code === 0) {
        // Deliberately not abortable: a commit is short and always runs to
        // the end once started, so Stop never interrupts a write.
        var real = await runNode([path.join(ROOT, 'scripts/commit.js'), resultFile].concat(ctx.skipLint ? ['--skip-lint'] : []));
        if (real.code !== 0) throw new Error('commit failed after a clean dry run: ' + real.stderr.trim());
        real.stdout.trim().split('\n').forEach(function (l) { log('  ' + l); });
        return {
          kind: result.reference.status === 'draft' ? 'draft' : 'added',
          id: result.reference.id,
          draftReason: result.reference.draftReason,
          newCategory: result.newCategory ? result.newCategory.id : null,
          rejectedCategory: result.rejectedCategory || null,
          honesty: result.designSystem && result.designSystem.description,
        };
      }
      problems = (dry.stderr || dry.stdout).trim();
    }
    if (repair >= MAX_REPAIRS) {
      log('  gave up after ' + MAX_REPAIRS + ' repair rounds; left in the inbox. Last problems:\n' + problems);
      return { kind: 'model-failed', reason: problems };
    }
    var firstProblem = problems.split('\n').find(function (l) { return /^(- |error: )/.test(l); }) || problems.split('\n')[0];
    log('  result needs fixing (round ' + (repair + 1) + '): ' + firstProblem.replace(/^- /, ''));
    messages.push({ role: 'user', content: [{ type: 'text', text: 'The helper could not commit that result:\n' + problems + '\n\nReply with the complete corrected JSON object only.' }] });
    var fixed = await providers.callModel(ctx.api, ctx.system, messages, { signal: ctx.signal });
    messages.push({ role: 'assistant', content: [{ type: 'text', text: fixed }] });
    try {
      reply = extractJson(fixed);
    } catch (e) {
      reply = { parseError: e.message };
    }
  }
}

function summarise(outcomes, malformed, log) {
  var count = function (kind) { return outcomes.filter(function (o) { return o.kind === kind; }).length; };
  log('');
  log('Summary');
  log('- ' + count('added') + ' added, ' + count('duplicate') + ' duplicates skipped, ' + count('draft') + ' parked as drafts');
  outcomes.filter(function (o) { return o.kind === 'draft'; }).forEach(function (o) { log('  draft ' + o.id + ': ' + o.draftReason); });
  outcomes.filter(function (o) { return o.kind === 'fetch-failed' || o.kind === 'model-failed' || o.kind === 'error'; }).forEach(function (o) {
    log('- still in the inbox: ' + o.url + ' — ' + o.kind + ': ' + String(o.reason).split('\n')[0]);
  });
  outcomes.filter(function (o) { return o.newCategory; }).forEach(function (o) {
    log('- created category ' + o.newCategory + ' (nearest rejected: ' + o.rejectedCategory + ')');
  });
  outcomes.filter(function (o) { return o.honesty; }).forEach(function (o) {
    log('- design system ' + o.id + ': ' + o.honesty);
  });
  if (malformed.length) log('- malformed lines left untouched: ' + malformed.map(function (m) { return m.line; }).join(' | '));
  var library = loadData('library.js', 'LIBRARY');
  var categories = loadData('categories.js', 'CATEGORIES');
  var singletons = categories.filter(function (c) {
    return library.filter(function (e) { return e.category === c.id; }).length === 1;
  }).length;
  log('- taxonomy: ' + categories.length + ' categories, ' + singletons + ' holding a single reference');
}

// Runs a whole drain (or one URL) in API mode. log(line) receives progress.
async function runApiDrain(options) {
  var log = options.log;
  var listed = lib.listInbox(
    fs.existsSync(path.join(ROOT, 'inbox.md')) ? fs.readFileSync(path.join(ROOT, 'inbox.md'), 'utf8') : '',
    loadData('library.js', 'LIBRARY')
  );
  var captures = options.url
    ? listed.captures.filter(function (c) { return c.url === options.url; })
    : listed.captures;
  listed.malformed.forEach(function (m) { log('malformed line (left untouched): ' + m.line + ' — ' + m.reason); });
  if (!captures.length) {
    log(options.url ? 'That URL is not in the inbox.' : 'The inbox is empty — nothing to drain.');
    return { outcomes: [] };
  }

  var library = loadData('library.js', 'LIBRARY');
  var systems = loadData('design-systems.js', 'DESIGN_SYSTEMS');
  var example = library.find(function (e) { return systems.some(function (d) { return d.referenceId === e.id; }); }) || library[0];
  var ctx = {
    api: options.api,
    log: log,
    signal: options.signal,
    skipLint: options.skipLint,
    system: buildSystemPrompt(),
    exampleReference: example,
    exampleDesignSystem: example && systems.find(function (d) { return d.referenceId === example.id; }),
  };

  var outcomes = [];
  for (var i = 0; i < captures.length; i++) {
    var item = captures[i];
    log('[' + (i + 1) + '/' + captures.length + '] ' + item.url);
    try {
      var outcome = await drainOne(item, ctx);
      outcome.url = item.url;
      outcomes.push(outcome);
    } catch (e) {
      if (e.message === 'stopped' || (options.signal && options.signal.aborted)) {
        log('Stopped. This capture is still in the inbox; nothing half-written.');
        break;
      }
      log('  error: ' + e.message + ' — left in the inbox');
      outcomes.push({ kind: 'error', url: item.url, reason: e.message });
    }
  }
  summarise(outcomes, listed.malformed, log);
  return { outcomes: outcomes };
}

module.exports = {
  buildSystemPrompt: buildSystemPrompt,
  buildCaptureMessage: buildCaptureMessage,
  extractJson: extractJson,
  toResult: toResult,
  runApiDrain: runApiDrain,
};
