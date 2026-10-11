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

const CLAUDE_ON = { label: 'Claude · Sonnet 5.5', ai: 'claude', at: new Date().toISOString() };
const SOMETHING_FOUND = {
  agents: [{ id: 'claude', label: 'Claude Code', installed: true }, { id: 'codex', label: 'Codex', installed: false }],
  local: [{ id: 'ollama', label: 'Ollama', running: true, models: [] }, { id: 'lmstudio', label: 'LM Studio', running: false, models: [] }],
  envKeys: ['openai'],
};

const header = (app) => app.page.locator('.ai-header button').first();
const dialog = (app) => app.page.getByRole('dialog');
const rows = (app) => app.page.locator('.cp-list button.cp-row');

async function openWindow(app) {
  await header(app).click();
  await dialog(app).waitFor({ timeout: 5000 });
}

test('Connect AI in the header opens the Connect AI window', async (t) => {
  await withApp(t, { ai: createFakeAi() }, async (app) => {
    await app.page.getByRole('button', { name: 'Connect AI' }).first().click();
    await app.page.getByRole('dialog').waitFor({ timeout: 5000 });
    assert.match(await app.page.getByRole('dialog').innerText(), /Connect/);
  });
});

test('header: off and on faces read in shape and words, and both open the window, not a popover', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake }, async (app) => {
    assert.equal((await header(app).innerText()).trim(), 'Connect AI');
    assert.equal(await header(app).locator('svg').count(), 1, 'a plus icon, not colour alone');
    await openWindow(app);
    assert.equal(await app.page.locator('.popover').count(), 0);
    await app.page.keyboard.press('Escape');
    assert.equal(await dialog(app).count(), 0);

    fake.setConnection(CLAUDE_ON);
    await app.page.reload();
    await app.page.waitForFunction(() => /Claude · Sonnet 5\.5/.test(document.querySelector('.ai-header').textContent));
    assert.equal(await header(app).locator('.ai-dot').count(), 1, 'a dot, not colour alone');
    await openWindow(app);
    assert.equal(await app.page.locator('.popover').count(), 0);
    // opens on the connected AI
    await app.page.locator('.cp-pane-title', { hasText: 'Claude' }).waitFor();
  });
});

test('Pool never started: a small window with the steps and no list; it moves on by itself when Pool answers', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND, delayMs: 700 });
  await withApp(t, { ai: fake }, async (app) => {
    await app.stopHelper();
    await openWindow(app);
    assert.match(await dialog(app).innerText(), /Start Pool once/);
    assert.equal(await app.page.locator('.cp-list').count(), 0, 'no list before Pool runs');
    assert.ok(await dialog(app).evaluate((n) => n.classList.contains('is-single')), 'the small, single-pane window');

    await app.startHelper();
    // the scan: a quiet list, "Looking…" beside each AI, nothing selectable
    await app.page.getByText('Looking…').first().waitFor({ timeout: 8000 });
    assert.equal(await app.page.locator('.cp-list button.cp-row').count(), 0);
    // then ready
    await app.page.locator('.cp-group', { hasText: 'On this computer' }).waitFor({ timeout: 8000 });
  });
});

test('Pool stopped with a connection: "Pool stopped running", one primary Start Pool, header says Pool stopped', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /Claude · Sonnet 5\.5/.test(document.querySelector('.ai-header').textContent));
    await app.stopHelper();
    await openWindow(app);
    const text = await dialog(app).innerText();
    assert.match(text, /Pool stopped running/);
    assert.match(text, /still connected to Claude · Sonnet 5\.5/i);
    assert.equal(await app.page.locator('.cp-list').count(), 0);
    const primaries = dialog(app).locator('.btn-primary');
    assert.equal(await primaries.count(), 1);
    assert.equal((await primaries.innerText()).trim(), 'Start Pool');
    assert.match(await header(app).innerText(), /Pool stopped/);
    assert.equal(await header(app).locator('svg').count(), 1, 'an alert icon, not colour alone');
    assert.match((await header(app).getAttribute('title')) || '', /Pool/);

    // the Pool stopped face opens the window too
    await app.page.keyboard.press('Escape');
    assert.equal(await dialog(app).count(), 0);
    await openWindow(app);
    assert.match(await dialog(app).innerText(), /Pool stopped running/);
  });
});

test('after the scan: three groups with statuses, the best AI open, Something else pinned', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await app.page.locator('.cp-group', { hasText: 'On this computer' }).waitFor({ timeout: 8000 });
    const groups = await app.page.locator('.cp-group').allInnerTexts();
    assert.deepEqual(groups, ['On this computer', 'More AIs']);
    const claude = app.page.locator('.cp-row', { hasText: 'Claude' }).first();
    assert.match(await claude.innerText(), /Installed/);
    assert.match(await app.page.locator('.cp-row', { hasText: 'Ollama' }).innerText(), /Running · needs a model/);
    assert.match(await app.page.locator('.cp-row', { hasText: 'ChatGPT' }).innerText(), /Key found/);
    // best found is open
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'Claude');
    // Something else is pinned at the foot
    const lastRow = await app.page.locator('.cp-list .cp-list-foot .cp-row').innerText();
    assert.match(lastRow, /Something else/);
  });
});

test('connected: the In use group says Connected and the pane opens on that AI', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  fake.setConnection({ label: 'ChatGPT · gpt-5', ai: 'chatgpt', at: new Date().toISOString() });
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /ChatGPT/.test(document.querySelector('.ai-header').textContent));
    await openWindow(app);
    await app.page.locator('.cp-group', { hasText: 'In use' }).waitFor({ timeout: 8000 });
    assert.match(await app.page.locator('.cp-row', { hasText: 'ChatGPT' }).innerText(), /Connected/);
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'ChatGPT');
  });
});

test('search: finds by app name, reselects when the open AI is hidden, shows the empty state', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await app.page.locator('.cp-group').first().waitFor({ timeout: 8000 });
    const search = app.page.getByRole('searchbox', { name: 'Search AIs and apps' });
    assert.equal(await search.getAttribute('placeholder'), 'Search AIs and apps');
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'Claude');

    await search.fill('codex');
    assert.equal(await rows(app).count(), 2, 'ChatGPT, and Something else');
    assert.match(await rows(app).first().innerText(), /ChatGPT/);
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'ChatGPT');

    await search.fill('zzzz');
    assert.match(await dialog(app).innerText(), /Nothing called/);
    assert.match(await dialog(app).innerText(), /Something else/);
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'Something else');
  });
});

test('keyboard: ↓ and ↑ move through the list, Enter in the search opens the first match, Esc clears then closes', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await app.page.locator('.cp-group').first().waitFor({ timeout: 8000 });
    const title = async () => (await app.page.locator('.cp-pane-title').first().innerText()).trim();
    const search = app.page.getByRole('searchbox');
    await search.focus();
    const start = await title();
    await app.page.keyboard.press('ArrowDown');
    const second = await title();
    assert.notEqual(second, start);
    await app.page.keyboard.press('ArrowUp');
    assert.equal(await title(), start);

    await search.fill('gem');
    await app.page.keyboard.press('Enter');
    assert.equal(await title(), 'Gemini');

    await app.page.keyboard.press('Escape');
    assert.equal(await search.inputValue(), '', 'first Esc clears the search');
    assert.equal(await dialog(app).count(), 1);
    await app.page.keyboard.press('Escape');
    assert.equal(await dialog(app).count(), 0, 'second Esc closes');
  });
});

test('phone width: the list is a horizontal strip and the page does not scroll sideways', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake, viewport: { width: 390, height: 780 } }, async (app) => {
    await openWindow(app);
    await app.page.locator('.cp-list button.cp-row').first().waitFor({ timeout: 8000 });
    const direction = await app.page.locator('.cp-list').evaluate((n) => getComputedStyle(n).flexDirection);
    assert.equal(direction, 'row');
    const overflow = await app.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, 'horizontal overflow: ' + overflow);
  });
});

test('the Add drawer still shows AI · model off the shared state', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.keyboard.press('i');
    const line = app.page.locator('.ai-line');
    await line.waitFor({ timeout: 5000 });
    assert.match(await line.innerText(), /Claude/);
    assert.match(await line.innerText(), /Sonnet 5\.5/);
  });
});

test('the Add drawer\'s AI · model line switches model through the shared state', async (t) => {
  const fake = createFakeAi({
    detect: SOMETHING_FOUND,
    models: { models: [{ id: 'opus', label: 'Opus 5.5' }, { id: 'sonnet', label: 'Sonnet 5.5' }], free: false },
    connect: { ok: true, message: 'Now using Opus 5.5.', label: 'Claude · Opus 5.5' },
  });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.keyboard.press('i');
    await app.page.locator('.ai-line.is-button').click();
    await app.page.getByRole('radio', { name: 'Opus 5.5' }).click();
    await app.page.getByText('Now using Opus 5.5.').waitFor({ timeout: 5000 });
    const call = fake.calls.filter((c) => c.name === 'connect').pop();
    assert.equal(call.arg.agent.model, 'opus');
  });
});

test('phone width: Something else is reachable in the strip', async (t) => {
  const fake = createFakeAi({ detect: SOMETHING_FOUND });
  await withApp(t, { ai: fake, viewport: { width: 390, height: 780 } }, async (app) => {
    await openWindow(app);
    const other = app.page.locator('.cp-list .cp-row', { hasText: 'Something else' });
    await other.waitFor({ timeout: 8000 });
    await other.scrollIntoViewIfNeeded();
    await other.click();
    assert.equal((await app.page.locator('.cp-pane-title').first().innerText()).trim(), 'Something else');
  });
});

// ---- connecting through a subscription ------------------------------------

const claudeApp = (installed, signedIn) => ({
  agents: [{ id: 'claude', label: 'Claude Code', installed, signedIn }],
  local: [],
  envKeys: [],
});

const primaries = (app) => dialog(app).locator('.btn-primary');
const buttonNamed = (app, name) => dialog(app).getByRole('button', { name, exact: true });

async function waitForPane(app, title) {
  await app.page.locator('.cp-pane-title', { hasText: title }).first().waitFor({ timeout: 8000 });
}

async function assertOnePrimary(app, label) {
  const found = await primaries(app).allInnerTexts();
  assert.deepEqual(found.map((s) => s.trim()), [label], 'exactly one primary button on screen');
}

test('subscription: exactly one primary at every step — Install, then Open to log in, then Connect', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(false, 'unknown') });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await assertOnePrimary(app, 'Install Claude Code');

    await buttonNamed(app, 'Install Claude Code').click();
    assert.deepEqual(fake.calls.filter((c) => c.name === 'runTerminalAction').pop().arg, { ai: 'claude', action: 'install' });

    fake.script({ detect: claudeApp(true, 'unknown') });
    await buttonNamed(app, 'Check again').click();
    await dialog(app).getByText('Claude Code is installed').waitFor({ timeout: 5000 });
    await assertOnePrimary(app, 'Open Claude Code to log in');

    await buttonNamed(app, 'Open Claude Code to log in').click();
    await app.page.waitForFunction(() => /^Connect$/.test((document.querySelector('[role=dialog] .btn-primary') || {}).textContent || ''));
    await assertOnePrimary(app, 'Connect');
    assert.deepEqual(fake.calls.filter((c) => c.name === 'runTerminalAction').pop().arg, { ai: 'claude', action: 'login' });
    assert.equal(await dialog(app).locator('.ai-step[data-step="2"]').evaluate((n) => n.classList.contains('is-done')), false, 'opening the app is not the same as being logged in');

    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
  });
});

test('subscription: installed but not known to be logged in — log in is primary and Connect stays beside it, secondary', async (t) => {
  for (const signedIn of ['unknown', 'no']) {
    const fake = createFakeAi({ detect: claudeApp(true, signedIn) });
    await withApp(t, { ai: fake }, async (app) => {
      await openWindow(app);
      await waitForPane(app, 'Claude');
      await assertOnePrimary(app, 'Open Claude Code to log in');
      const text = await dialog(app).innerText();
      assert.match(text, /Claude Pro, Max, Team or Enterprise/, 'says what plan it needs');
      assert.match(text, /Already logged in\? Just press Connect\./);
      assert.equal(await buttonNamed(app, 'Connect').count(), 1);
      assert.ok(await buttonNamed(app, 'Connect').evaluate((n) => n.classList.contains('btn-secondary')));
      assert.match(text, /Claude Code is installed/, 'the finished install step is one ticked line');
    });
  }
});

test('subscription: signed in — the login step is ticked and Connect is primary', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes') });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await assertOnePrimary(app, 'Connect');
    assert.match(await dialog(app).innerText(), /Logged in to Claude Code/);
    assert.equal(await buttonNamed(app, 'Open Claude Code to log in').count(), 0, 'nothing left to do for the login');
  });
});

test('subscription: a failed connect shows the error in its step, in view, with Try again; the retry connects', async (t) => {
  const fake = createFakeAi({
    detect: claudeApp(true, 'unknown'),
    delayMs: 300,
    connect: { ok: false, message: 'claude didn’t answer: “Not logged in · Please run /login”.', loggedOut: true },
  });
  await withApp(t, { ai: fake, viewport: { width: 1100, height: 560 } }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await buttonNamed(app, 'Open Claude Code to log in').click();
    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText('Checking Claude Code answers…').waitFor({ timeout: 5000 });

    const notice = dialog(app).locator('.notice.is-error').first();
    await notice.waitFor({ timeout: 5000 });
    const inView = await notice.evaluate((n) => {
      const r = n.getBoundingClientRect();
      const p = n.closest('.cp-pane').getBoundingClientRect();
      return r.top >= p.top - 1 && r.bottom <= p.bottom + 1;
    });
    assert.ok(inView, 'the notice is scrolled into view');
    const noticeText = await notice.innerText();
    assert.match(noticeText, /log in/i);
    assert.equal(await notice.locator('button').count(), 0, 'it points at the login step, it does not repeat its button');
    await assertOnePrimary(app, 'Try again');

    fake.script({ connect: { ok: true, message: 'Connected.' } });
    await buttonNamed(app, 'Try again').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
  });
});

test('a failure that is not about login says what happened and keeps one primary', async (t) => {
  const fake = createFakeAi({
    detect: claudeApp(true, 'yes'),
    connect: { ok: false, message: 'claude didn’t answer: “connect ECONNRESET”.' },
  });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/ECONNRESET/).waitFor({ timeout: 5000 });
    await assertOnePrimary(app, 'Try again');
  });
});

test('an AI that connects two ways has tabs, and connecting another AI says it replaces the current one', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes') });
  fake.setConnection({ label: 'ChatGPT · gpt-5', ai: 'chatgpt', at: new Date().toISOString() });
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /ChatGPT/.test(document.querySelector('.ai-header').textContent));
    await openWindow(app);
    await app.page.locator('.cp-row', { hasText: 'Claude' }).first().click();
    await waitForPane(app, 'Claude');
    assert.equal(await dialog(app).getByRole('tab', { name: 'Claude subscription' }).count(), 1);
    assert.equal(await dialog(app).getByRole('tab', { name: 'API key' }).count(), 1);
    assert.match(await dialog(app).innerText(), /Connecting this replaces ChatGPT/);
  });
});
