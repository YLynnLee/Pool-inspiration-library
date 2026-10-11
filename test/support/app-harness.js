// Starts the helper with a fake AI layer on a free port and opens the app in
// a real browser. `close()` shuts the page, browser and server down.
//
//   var app = await startApp({ ai: fake });
//   await app.page.getByRole('button', { name: 'Connect AI' }).click();
//   await app.close();
//
// `app.stopHelper()` makes the helper go away, as when its Terminal closes;
// `app.startHelper()` brings it back on the same port, as Start Pool does.
// `options.viewport` sets the page size (default 1280×800).

var createServer = require('../../scripts/server.js').createServer;

async function launchBrowser() {
  var chromium = require('playwright').chromium;
  var attempts = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  var lastError;
  for (var i = 0; i < attempts.length; i++) {
    try {
      return await chromium.launch(attempts[i]);
    } catch (e) {
      lastError = e;
    }
  }
  var err = new Error('no Chromium browser found — run `npx playwright install chromium`, or install Google Chrome.\n' + lastError.message);
  err.code = 'NO_BROWSER';
  throw err;
}

async function startApp(options) {
  var helper = createServer({ ai: options.ai });
  var port = await helper.listen(0);
  var running = true;
  var browser;
  try {
    browser = await launchBrowser();
    var page = await browser.newPage({ viewport: options.viewport || { width: 1280, height: 800 } });
    await page.goto('http://localhost:' + port + (options.path || '/'));
  } catch (e) {
    if (browser) await browser.close();
    await helper.close();
    throw e;
  }
  return {
    page: page,
    port: port,
    stopHelper: async function () {
      if (!running) return;
      running = false;
      await helper.close();
    },
    startHelper: async function () {
      if (running) return;
      helper = createServer({ ai: options.ai });
      await helper.listen(port);
      running = true;
    },
    close: async function () {
      await browser.close();
      if (running) await helper.close();
    },
  };
}

module.exports = { startApp: startApp };
