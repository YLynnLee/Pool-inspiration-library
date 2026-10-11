const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../scripts/server.js');
const { createFakeAi } = require('./support/fake-ai.js');

async function withHelper(ai, body) {
  const helper = createServer({ ai });
  const port = await helper.listen(0);
  const origin = 'http://localhost:' + port;
  const call = async (method, path, payload) => {
    const res = await fetch(origin + path, {
      method,
      headers: { 'content-type': 'application/json', origin },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    return res.json();
  };
  try {
    await body(call);
  } finally {
    await helper.close();
  }
}

test('helper built with an injected AI layer: connect, status and disconnect go through it', async () => {
  const fake = createFakeAi();
  await withHelper(fake, async (call) => {
    assert.equal((await call('GET', '/api/status')).config.connection, null);

    fake.script({ connect: { ok: false, message: 'Not logged in' } });
    const failed = await call('POST', '/api/connect', { ai: 'claude' });
    assert.deepEqual([failed.ok, failed.message], [false, 'Not logged in']);
    assert.equal(failed.status.config.connection, null);

    fake.script({ connect: { ok: true, message: 'Connected.', label: 'Claude' } });
    const passed = await call('POST', '/api/connect', { ai: 'claude' });
    assert.equal(passed.status.config.connection.label, 'Claude');

    const after = await call('POST', '/api/disconnect', {});
    assert.equal(after.config.connection, null);
  });
});

test('helper built with an injected AI layer: detection comes from the layer', async () => {
  const fake = createFakeAi({ detect: { agents: [], local: [], envKeys: ['anthropic'] } });
  await withHelper(fake, async (call) => {
    assert.deepEqual((await call('GET', '/api/detect')).envKeys, ['anthropic']);
  });
});
