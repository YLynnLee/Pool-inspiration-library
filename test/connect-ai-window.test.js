const test = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./support/app-harness.js');
const { createFakeAi } = require('./support/fake-ai.js');

// `npm test` is documented as needing no browser, so these skip without one.
async function withApp(t, options, body) {
  let app;
  try {
    app = await startApp(options);
  } catch (e) {
    if (e.code === 'NO_BROWSER') return t.skip(e.message.split('\n')[0]);
    throw e;
  }
  try {
    await body(app);
  } finally {
    await app.close();
  }
}

test('Connect AI in the header opens the Connect AI window', async (t) => {
  await withApp(t, { ai: createFakeAi() }, async (app) => {
    await app.page.getByRole('button', { name: 'Connect AI' }).first().click();
    await app.page.getByRole('dialog').waitFor({ timeout: 5000 });
    assert.match(await app.page.getByRole('dialog').innerText(), /Connect/);
  });
});
