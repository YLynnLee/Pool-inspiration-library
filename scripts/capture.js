#!/usr/bin/env node
// The drain's capture step as a script: drain.md's fixed recipe, run the
// same way every time by a headless browser rather than by whichever
// browser tools the agent happens to have. See
// AGENTS.md.
//
//   node scripts/capture.js <url> [options]
//
//   --out <dir>          working directory (default .scratch/captures/<slug>; commit.js
//                        only accepts frames under .scratch/captures/)
//   --hide "<selector>"  extra CSS selector to hide before shooting; repeatable
//   --click "<selector>" element to click before the scroll pass (a consent
//                        button the auto-accept missed); repeatable
//   --wait <ms>          extra settle time after load (default 1500)
//   --headed             show the browser window (for sites that block headless)
//   --harvest-only       skip screenshots; only harvest (used by extract)
//
// Writes frame-N.png (+ a .webp twin), harvest.json and capture.json into the working
// directory and prints capture.json to stdout. Exit 0 on success, 2 when the
// site could not be fetched at all (the drain's fetch-failure case), 1 on any
// other error.

var fs = require('fs');
var path = require('path');
var lib = require('./drain-lib.js');

var ROOT = path.resolve(__dirname, '..');
var VIEWPORT = { width: 1440, height: 900 };
var STEP_PX = 250;
var STEP_PAUSE_MS = 120;
var MAX_STEPS = 240;
var JACKED_STEPS = 40;
var SHOT_SETTLE_MS = 900;

// Third-party chrome that is never part of a site's design system — drain.md's
// "suppress known overlays" list.
var OVERLAY_SELECTORS = [
  'iframe[title*="chat" i]',
  'iframe[src*="intercom" i]',
  'iframe[src*="hubspot" i]',
  'iframe[src*="zendesk" i]',
  'iframe[src*="drift" i]',
  '[id*="intercom" i]',
  '[class*="chat-widget" i]',
  '[id*="chat-widget" i]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="consent" i]',
  '[id*="consent" i]',
  '[id*="onetrust" i]',
  '[class*="onetrust" i]',
  '[id*="usercentrics" i]',
  '[id*="didomi" i]',
  '[class*="cc-window" i]',
  '[class*="newsletter-popup" i]',
  '[class*="newsletter-modal" i]',
];

var ACCEPT_BUTTON = /^(accept|accept all|accept all cookies|allow all|allow all cookies|agree|i agree|got it|ok|okay)$/i;

function parseArgs(argv) {
  var opts = { hide: [], click: [], wait: 1500, headed: false, harvestOnly: false };
  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];
    if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--hide') opts.hide.push(argv[++i]);
    else if (arg === '--click') opts.click.push(argv[++i]);
    else if (arg === '--wait') opts.wait = Number(argv[++i]);
    else if (arg === '--headed') opts.headed = true;
    else if (arg === '--harvest-only') opts.harvestOnly = true;
    else if (!opts.url) opts.url = arg;
    else throw new Error('unexpected argument: ' + arg);
  }
  if (!opts.url) throw new Error('usage: node scripts/capture.js <url> [--out dir] [--hide sel] [--click sel] [--wait ms] [--headed] [--harvest-only]');
  return opts;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Playwright's own Chromium if it's been installed, otherwise the collector's
// installed Chrome or Edge — so `npx playwright install` is optional.
async function launchBrowser(headed) {
  var chromium = require('playwright').chromium;
  var attempts = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  var lastError;
  for (var i = 0; i < attempts.length; i++) {
    try {
      return await chromium.launch(Object.assign({ headless: !headed }, attempts[i]));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error('no Chromium browser found — run `npx playwright install chromium`, or install Google Chrome.\n' + lastError.message);
}

// Many sites serve a block page to "HeadlessChrome"; present as the plain
// browser it actually is.
async function makeContext(browser) {
  var probe = await browser.newPage();
  var ua = (await probe.evaluate(function () { return navigator.userAgent; })).replace('HeadlessChrome', 'Chrome');
  await probe.close();
  // ignoreHTTPSErrors: capture only reads public pages, and a company proxy that
  // re-signs TLS would otherwise turn every capture into a fetch failure.
  return browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, bypassCSP: true, ignoreHTTPSErrors: true, userAgent: ua });
}

async function dismissOverlays(page, extraClicks) {
  try {
    var button = page.getByRole('button', { name: ACCEPT_BUTTON }).first();
    if (await button.isVisible({ timeout: 500 })) await button.click({ timeout: 1500 });
  } catch (e) { /* nothing to accept */ }
  for (var i = 0; i < extraClicks.length; i++) {
    try {
      await page.locator(extraClicks[i]).first().click({ timeout: 3000 });
    } catch (e) {
      console.error('warning: could not click ' + extraClicks[i]);
    }
  }
}

async function scrollY(page) {
  return page.evaluate(function () { return window.scrollY; });
}

async function scrollHeight(page) {
  return page.evaluate(function () {
    return Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  });
}

// The step-scroll pass: small wheel steps (wheel, not scrollTo, so smooth-
// scroll libraries and scroll-triggered reveals see real input) until the
// page stops moving. Returns whether the page scrolls natively at all — a
// scroll-jacked page keeps window.scrollY at 0 and is shot by step count.
async function stepScrollPass(page) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  var still = 0;
  var last = await scrollY(page);
  var moved = false;
  for (var step = 0; step < MAX_STEPS && still < 6; step++) {
    await page.mouse.wheel(0, STEP_PX);
    await sleep(STEP_PAUSE_MS);
    var y = await scrollY(page);
    if (y > last) { moved = true; still = 0; } else still++;
    last = y;
    if (!moved && step >= JACKED_STEPS) break;
  }
  return moved;
}

async function backToTop(page) {
  await page.evaluate(function () { window.scrollTo(0, 0); });
  for (var i = 0; i < 20 && (await scrollY(page)) > 0; i++) {
    await page.mouse.wheel(0, -2000);
    await sleep(STEP_PAUSE_MS);
  }
  await sleep(SHOT_SETTLE_MS);
}

// The box of actually-rendered content in the current viewport, so a layout
// centred in a narrow column isn't kept as a mostly-empty 1440px frame
// (drain.md: "frame to the page's actual rendered content").
async function contentClip(page) {
  return page.evaluate(function (vp) {
    var bodyBg = getComputedStyle(document.body).backgroundColor;
    var left = vp.width, right = 0, bottom = 0;
    var painted = function (el, cs) {
      if (/^(IMG|VIDEO|CANVAS|SVG|PICTURE|IFRAME)$/i.test(el.tagName)) return true;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
      var bg = cs.backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== bodyBg) return true;
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.textContent.trim()) return true;
      }
      return false;
    };
    var all = document.body ? document.body.getElementsByTagName('*') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vp.height || r.right <= 0 || r.left >= vp.width) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      if (!painted(el, cs)) continue;
      left = Math.min(left, Math.max(0, r.left));
      right = Math.max(right, Math.min(vp.width, r.right));
      bottom = Math.max(bottom, Math.min(vp.height, r.bottom));
    }
    if (right - left < vp.width * 0.3 || bottom < vp.height * 0.3) {
      return { x: 0, y: 0, width: vp.width, height: vp.height };
    }
    return { x: Math.floor(left), y: 0, width: Math.ceil(right - left), height: Math.ceil(bottom) };
  }, VIEWPORT);
}

// drain.md's dead-space check, done in a blank page's canvas so there is no
// Python dependency: crops a blank (near-white) band on the right or bottom
// edge wider than 12% of the frame, then encodes the frame as PNG (what the
// model is shown — every vision API decodes it) and WebP (what the library
// stores under images/).
async function finishFrame(canvasPage, buffer) {
  return canvasPage.evaluate(async function (b64) {
    var THRESHOLD = 0.12;
    var WHITE = 248;
    var img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    var w = img.width, h = img.height;
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var d = ctx.getImageData(0, 0, w, h).data;
    var blank = function (x, y) {
      var i = (y * w + x) * 4;
      return d[i] >= WHITE && d[i + 1] >= WHITE && d[i + 2] >= WHITE;
    };
    var stepX = Math.max(1, Math.floor(w / 400));
    var stepY = Math.max(1, Math.floor(h / 400));
    var rowBlank = function (y) { for (var x = 0; x < w; x += stepX) if (!blank(x, y)) return false; return true; };
    var colBlank = function (x) { for (var y = 0; y < h; y += stepY) if (!blank(x, y)) return false; return true; };
    var bottom = h;
    while (bottom > 0 && rowBlank(bottom - 1)) bottom--;
    var right = w;
    while (right > 0 && colBlank(right - 1)) right--;
    var crop = right > 0 && bottom > 0 && ((w - right) / w > THRESHOLD || (h - bottom) / h > THRESHOLD);
    var out = document.createElement('canvas');
    out.width = crop ? right : w;
    out.height = crop ? bottom : h;
    out.getContext('2d').drawImage(c, 0, 0);
    return {
      cropped: crop ? w + 'x' + h + ' -> ' + out.width + 'x' + out.height : null,
      png: out.toDataURL('image/png').split(',')[1],
      webp: out.toDataURL('image/webp', 0.8).split(',')[1],
    };
  }, buffer.toString('base64'));
}

async function shoot(page, canvasPage, file) {
  await sleep(SHOT_SETTLE_MS);
  var clip = await contentClip(page);
  var frame = await finishFrame(canvasPage, await page.screenshot({ clip: clip }));
  fs.writeFileSync(file, Buffer.from(frame.png, 'base64'));
  fs.writeFileSync(file.replace(/\.png$/, '.webp'), Buffer.from(frame.webp, 'base64'));
  return { clip: clip, cropped: frame.cropped };
}

// Scrolls back down in the same small steps and shoots each time the page
// crosses one of the target offsets.
async function shootPass(page, canvasPage, outDir, native) {
  var frames = [];
  var targets;
  if (native) {
    targets = lib.shotPositions(await scrollHeight(page), VIEWPORT.height);
  } else {
    targets = [0, 10, 20, 30, JACKED_STEPS];
  }
  var step = 0;
  for (var t = 0; t < targets.length; t++) {
    var target = targets[t];
    var guard = 0;
    while (guard++ < MAX_STEPS) {
      var here = native ? await scrollY(page) : step;
      if (here >= target - STEP_PX / 2) break;
      var before = native ? here : null;
      await page.mouse.wheel(0, STEP_PX);
      await sleep(STEP_PAUSE_MS);
      step++;
      if (native && (await scrollY(page)) === before) break;
    }
    var file = path.join(outDir, 'frame-' + (frames.length + 1) + '.png');
    var shot = await shoot(page, canvasPage, file);
    var frame = { path: path.relative(ROOT, file), scrollY: native ? await scrollY(page) : null, wheelSteps: step, clip: shot.clip };
    if (shot.cropped) frame.cropped = shot.cropped;
    frames.push(frame);
  }
  return frames;
}

async function harvest(page) {
  var source = fs.readFileSync(path.join(ROOT, 'scripts/harvest-design.js'), 'utf8');
  source = source.replace(/^typeof document !== 'undefined' \? harvestDesign\(\) : undefined;$/m, '');
  return page.evaluate('(function () { var module; ' + source + '\n; return harvestDesign(); })()');
}

async function main() {
  var opts = parseArgs(process.argv.slice(2));
  var outDir = path.resolve(ROOT, opts.out || path.join('.scratch/captures', lib.captureSlug(opts.url)));
  fs.mkdirSync(outDir, { recursive: true });
  fs.readdirSync(outDir).forEach(function (f) {
    if (/^frame-\d+\.(png|webp)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  });

  var browser = await launchBrowser(opts.headed);
  var manifest = { url: opts.url, capturedAt: new Date().toISOString(), viewport: VIEWPORT, browser: browser.version(), notes: [] };
  try {
    var context = await makeContext(browser);
    var page = await context.newPage();

    var response;
    try {
      response = await page.goto(opts.url, { waitUntil: 'load', timeout: 45000 });
    } catch (e) {
      return fetchFailed(manifest, outDir, e.message.split('\n')[0]);
    }
    if (response && response.status() >= 400) {
      return fetchFailed(manifest, outDir, 'HTTP ' + response.status());
    }
    try {
      await page.waitForLoadState('networkidle', { timeout: 15000 });
    } catch (e) {
      manifest.notes.push('network never went idle within 15s; shot anyway after the settle wait');
    }
    manifest.finalUrl = page.url();
    manifest.title = await page.title();

    await page.addStyleTag({ content: OVERLAY_SELECTORS.concat(opts.hide).join(',\n') + ' { display: none !important; }' });
    await dismissOverlays(page, opts.click);
    await sleep(opts.wait);

    var native = await stepScrollPass(page);
    var short = !native && (await scrollHeight(page)) <= VIEWPORT.height + 10;
    manifest.scrollMode = native ? 'native' : short ? 'single screen (nothing to scroll)' : 'scroll-jacked (shot by wheel steps; window.scrollY never moved)';
    await backToTop(page);

    if (!opts.harvestOnly) {
      var canvasPage = await context.newPage();
      manifest.frames = await shootPass(page, canvasPage, outDir, native || short);
      await canvasPage.close();
    }

    try {
      var digest = await harvest(page);
      fs.writeFileSync(path.join(outDir, 'harvest.json'), JSON.stringify(digest, null, 2) + '\n');
      manifest.harvest = path.relative(ROOT, path.join(outDir, 'harvest.json'));
    } catch (e) {
      manifest.harvest = null;
      manifest.notes.push('harvest failed: ' + e.message.split('\n')[0] + ' — extract from the screenshots and declare it in description');
    }

    manifest.next = opts.harvestOnly
      ? 'Read harvest.json and the reference\'s existing screenshots, then write the design system.'
      : 'Look at every frame. Discard any that shows a loading state or an overlay; re-run with --hide/--click/--wait if needed (shot budget: two re-runs).';
    finish(manifest, outDir);
    return 0;
  } finally {
    await browser.close();
  }
}

function finish(manifest, outDir) {
  var text = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(path.join(outDir, 'capture.json'), text);
  process.stdout.write(text);
}

function fetchFailed(manifest, outDir, reason) {
  manifest.ok = false;
  manifest.fetchFailed = reason;
  manifest.next = 'Fetch failure: run `node scripts/inbox.js fail "<line>" "' + reason.replace(/"/g, "'") + '"` and move on.';
  finish(manifest, outDir);
  return 2;
}

main().then(function (code) {
  process.exitCode = code;
}, function (err) {
  console.error(err.message);
  process.exitCode = 1;
});
