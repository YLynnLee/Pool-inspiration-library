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
    assert.equal(await dialog(app).locator('.ai-step[data-step="2"]').evaluate((n) => n.classList.contains('is-done')), true, 'opening the login window ticks the step');

    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
  });
});

test('subscription: opening the login ticks the step at once, and it reads Logged in once the login is seen to work', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'unknown') });
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await buttonNamed(app, 'Open Claude Code to log in').click();
    const step = dialog(app).locator('.ai-step[data-step="2"]');
    await app.page.waitForFunction(() => document.querySelector('.ai-step[data-step="2"]').classList.contains('is-done'));
    assert.match(await step.innerText(), /Opened Claude Code to log in/, 'ticked as soon as the window is opened');
    assert.equal(await buttonNamed(app, 'Open Claude Code to log in').count(), 1, 'and it can be opened again');

    fake.script({ checkLogin: { ok: true } });
    await app.page.waitForFunction(() => {
      const n = document.querySelector('.ai-step[data-step="2"]');
      return n && /Logged in to Claude Code/.test(n.textContent);
    }, null, { timeout: 15000 });
    assert.match(await step.innerText(), /Logged in to Claude Code/);
    assert.equal(fake.calls.filter((c) => c.name === 'connect').length, 0, 'checking the login connects nothing');
    await assertOnePrimary(app, 'Connect');
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

test('an AI that connects two ways has tabs, and connecting another AI does not repeat that it replaces the current one', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes') });
  fake.setConnection({ label: 'ChatGPT · gpt-5', ai: 'chatgpt', at: new Date().toISOString() });
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /ChatGPT/.test(document.querySelector('.ai-header').textContent));
    await openWindow(app);
    await app.page.locator('.cp-row', { hasText: 'Claude' }).first().click();
    await waitForPane(app, 'Claude');
    assert.equal(await dialog(app).getByRole('tab', { name: 'Claude subscription' }).count(), 1);
    assert.equal(await dialog(app).getByRole('tab', { name: 'API key' }).count(), 1);
    assert.doesNotMatch(await dialog(app).innerText(), /Connecting this replaces/);
  });
});

// ---- connecting by API key, local server, or something else ----------------

const NO_COST_TALK = /\b(cost|costs|billing|billed|credit|credits|pay|paid|payment|price|pricing|charge|charged)\b/i;

const claudeKeyOnly = (envKeys) => ({
  agents: [{ id: 'claude', label: 'Claude Code', installed: false, signedIn: 'unknown' }],
  local: [],
  envKeys: envKeys || [],
});

const KEY_MODELS = { models: ['claude-sonnet-5-5', 'claude-opus-5-5'], suggested: 'claude-opus-5-5' };

async function openKeyTab(app) {
  await openWindow(app);
  await waitForPane(app, 'Claude');
  await dialog(app).getByRole('tab', { name: 'API key' }).click();
}

const keyField = (app) => dialog(app).getByLabel('API key');

test('API key: the paste field is there on arrival, and Check key is primary but disabled until something is typed', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly(), models: KEY_MODELS });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    assert.equal(await keyField(app).isVisible(), true, 'visible without touching Get a key');
    await assertOnePrimary(app, 'Check key');
    assert.equal(await buttonNamed(app, 'Check key').isDisabled(), true);
    assert.equal(await dialog(app).getByRole('link', { name: /Get a key/ }).count(), 1);
    assert.match(await dialog(app).innerText(), /already have one\? Paste it below/i);
    assert.equal(await dialog(app).locator('a.btn-primary').count(), 0, 'a link never takes the primary button');

    await keyField(app).fill('sk-test-123');
    assert.equal(await buttonNamed(app, 'Check key').isDisabled(), false);
  });
});

test('API key: Check key → a model dropdown with the suggested default and Connect as the one primary; Connect connects', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly(), models: KEY_MODELS });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    await keyField(app).fill('sk-test-123');
    await buttonNamed(app, 'Check key').click();
    const select = dialog(app).getByLabel('Model');
    await select.waitFor({ timeout: 5000 });
    assert.equal(await select.inputValue(), 'claude-opus-5-5', 'the suggested model is the default');
    await assertOnePrimary(app, 'Connect');
    assert.match(await dialog(app).innerText(), /Kept in .+, never in the library folder or the browser/);
    assert.equal(fake.calls.find((c) => c.name === 'models').arg.api.apiKey, 'sk-test-123');

    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
    const call = fake.calls.filter((c) => c.name === 'connect').pop().arg;
    assert.deepEqual(call, { ai: 'claude', mode: 'api', api: { provider: 'anthropic', apiKey: 'sk-test-123', model: 'claude-opus-5-5' } });
  });
});

test('API key: a key already in the environment shows the first step ticked', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly(['anthropic']), models: KEY_MODELS });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    await dialog(app).getByText('You have an API key').waitFor({ timeout: 5000 });
    assert.equal(await dialog(app).locator('.ai-step[data-step="1"]').evaluate((n) => n.classList.contains('is-done')), true);
    await assertOnePrimary(app, 'Check key');
    assert.equal(await buttonNamed(app, 'Check key').isDisabled(), false, 'nothing to type: the saved key is used');
  });
});

test('API key: a rejected key says it did not work and how to fix it — with no cost, billing or credit talk', async (t) => {
  const fake = createFakeAi({
    detect: claudeKeyOnly(),
    models: () => { throw new Error('Your credit balance is too low. Add billing to pay for usage.'); },
  });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    await keyField(app).fill('sk-wrong');
    await buttonNamed(app, 'Check key').click();
    const notice = dialog(app).locator('.notice.is-error').first();
    await notice.waitFor({ timeout: 5000 });
    assert.match(await notice.innerText(), /That key didn.t work/);
    assert.match(await notice.innerText(), /copied/i, 'says how to fix it');
    assert.equal(await notice.locator('button').count(), 0);
    await assertOnePrimary(app, 'Try again');
    assert.doesNotMatch(await dialog(app).innerText(), NO_COST_TALK);
    assert.equal(await keyField(app).inputValue(), 'sk-wrong', 'what was pasted is kept for fixing');
    assert.equal(await app.page.evaluate(() => document.documentElement.outerHTML.includes('sk-wrong')), false, 'the key is never written into the page markup');
  });
});

test('API key: a connect that fails shows the error in the step, with Try again; the retry connects', async (t) => {
  const fake = createFakeAi({
    detect: claudeKeyOnly(),
    models: KEY_MODELS,
    connect: { ok: false, message: 'HTTP 400: Your credit balance is too low.' },
  });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    await keyField(app).fill('sk-test-123');
    await buttonNamed(app, 'Check key').click();
    await dialog(app).getByLabel('Model').waitFor({ timeout: 5000 });
    await buttonNamed(app, 'Connect').click();
    await dialog(app).locator('.notice.is-error').first().waitFor({ timeout: 5000 });
    assert.match(await dialog(app).locator('.notice.is-error').first().innerText(), /That key didn.t work/);
    assert.doesNotMatch(await dialog(app).innerText(), NO_COST_TALK);
    await assertOnePrimary(app, 'Try again');

    fake.script({ connect: { ok: true, message: 'Connected.' } });
    await buttonNamed(app, 'Try again').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
  });
});

const ollama = (running, models) => ({
  agents: [],
  local: [{ id: 'ollama', label: 'Ollama', running, models: models || [], suggested: (models || [])[0] || '' }],
  envKeys: [],
});

async function openOllama(app) {
  await openWindow(app);
  await app.page.locator('.cp-row', { hasText: 'Ollama' }).click();
  await waitForPane(app, 'Ollama');
}

test('local server: not running → "I’ve opened it — check again" is the one primary; checking again moves on', async (t) => {
  const fake = createFakeAi({ detect: ollama(false) });
  await withApp(t, { ai: fake }, async (app) => {
    await openOllama(app);
    await assertOnePrimary(app, 'I’ve opened it — check again');
    assert.equal(await dialog(app).getByRole('link', { name: /Download Ollama/ }).count(), 1);
    assert.doesNotMatch(await dialog(app).innerText(), NO_COST_TALK);
    assert.doesNotMatch(await dialog(app).innerText(), /\bfree\b/i);

    fake.script({ detect: ollama(true, []) });
    await buttonNamed(app, 'I’ve opened it — check again').click();
    await buttonNamed(app, 'Download qwen2.5vl (recommended)').waitFor({ timeout: 5000 });
    await assertOnePrimary(app, 'Download qwen2.5vl (recommended)');
  });
});

test('local server: running without a vision model — the recommended download is primary, the others secondary, each in a Terminal window', async (t) => {
  const fake = createFakeAi({ detect: ollama(true, []) });
  await withApp(t, { ai: fake }, async (app) => {
    await openOllama(app);
    await assertOnePrimary(app, 'Download qwen2.5vl (recommended)');
    for (const other of ['Download gemma3', 'Download llama3.2-vision']) {
      assert.ok(await buttonNamed(app, other).evaluate((n) => n.classList.contains('btn-secondary')), other + ' is secondary');
    }
    await buttonNamed(app, 'Download gemma3').click();
    await dialog(app).getByText('A Terminal window opened.').waitFor({ timeout: 5000 });
    const call = fake.calls.filter((c) => c.name === 'runTerminalAction').pop().arg;
    assert.deepEqual(call, { ai: 'ollama', action: 'pull', arg: 'gemma3' });
  });
});

test('local server: with a model — pick it and Connect, the one primary', async (t) => {
  const fake = createFakeAi({ detect: ollama(true, ['qwen2.5vl:latest', 'gemma3:latest']) });
  await withApp(t, { ai: fake }, async (app) => {
    await openOllama(app);
    await assertOnePrimary(app, 'Connect');
    await dialog(app).getByLabel('Model').selectOption('gemma3:latest');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
    const call = fake.calls.filter((c) => c.name === 'connect').pop().arg;
    assert.deepEqual(call, { ai: 'ollama', mode: 'api', api: { provider: 'ollama', model: 'gemma3:latest' } });
  });
});

test('local server: a model that cannot see images fails in the step, with Try again', async (t) => {
  const fake = createFakeAi({
    detect: ollama(true, ['llama3:latest']),
    connect: { ok: false, message: 'llama3:latest answered "blue" to a solid red image — it may not support images, and analysing needs vision.' },
  });
  await withApp(t, { ai: fake }, async (app) => {
    await openOllama(app);
    await buttonNamed(app, 'Connect').click();
    await dialog(app).locator('.notice.is-error').first().waitFor({ timeout: 5000 });
    assert.match(await dialog(app).locator('.notice.is-error').first().innerText(), /may not support images/);
    await assertOnePrimary(app, 'Try again');
  });
});

async function openOther(app) {
  await openWindow(app);
  await app.page.locator('.cp-list .cp-row', { hasText: 'Something else' }).click();
  await waitForPane(app, 'Something else');
}

test('Something else: tabs for Agent command and OpenAI-compatible server, each with one primary Connect that uses the existing paths', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly() });
  await withApp(t, { ai: fake }, async (app) => {
    await openOther(app);
    assert.equal(await dialog(app).getByRole('tab', { name: 'Agent command' }).getAttribute('aria-selected'), 'true');
    await assertOnePrimary(app, 'Connect');
    await dialog(app).getByLabel('Agent command').fill('my-agent --headless -p');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
    assert.deepEqual(fake.calls.filter((c) => c.name === 'connect').pop().arg, {
      ai: 'other', mode: 'agent', agent: { preset: 'custom', command: 'my-agent --headless -p' },
    });
  });

  const second = createFakeAi({ detect: claudeKeyOnly() });
  await withApp(t, { ai: second }, async (app) => {
    await openOther(app);
    await dialog(app).getByRole('tab', { name: 'OpenAI-compatible server' }).click();
    await assertOnePrimary(app, 'Connect');
    await dialog(app).getByLabel('Base URL').fill('http://localhost:8000/v1');
    await dialog(app).getByLabel('Model', { exact: true }).fill('my-model');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).getByText(/^Connected/).first().waitFor({ timeout: 5000 });
    assert.deepEqual(second.calls.filter((c) => c.name === 'connect').pop().arg, {
      ai: 'other', mode: 'api', api: { provider: 'custom', baseUrl: 'http://localhost:8000/v1', apiKey: '', model: 'my-model' },
    });
  });
});

test('Something else: a failed connect keeps what was typed and the button becomes Try again', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly(), connect: { ok: false, message: '"my-agent" is not on PATH.' } });
  await withApp(t, { ai: fake }, async (app) => {
    await openOther(app);
    await dialog(app).getByLabel('Agent command').fill('my-agent -p');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).locator('.notice.is-error').first().waitFor({ timeout: 5000 });
    assert.match(await dialog(app).locator('.notice.is-error').first().innerText(), /not on PATH/);
    await assertOnePrimary(app, 'Try again');
    assert.equal(await dialog(app).getByLabel('Agent command').inputValue(), 'my-agent -p');
  });
});

test('API key: editing the key after a failure clears the failure; a network failure says so rather than blaming the key', async (t) => {
  const fake = createFakeAi({
    detect: claudeKeyOnly(),
    models: () => { throw new Error('could not reach https://api.anthropic.com: getaddrinfo ENOTFOUND'); },
  });
  await withApp(t, { ai: fake }, async (app) => {
    await openKeyTab(app);
    await keyField(app).fill('sk-test-123');
    await buttonNamed(app, 'Check key').click();
    const notice = dialog(app).locator('.notice.is-error').first();
    await notice.waitFor({ timeout: 5000 });
    assert.match(await notice.innerText(), /Couldn.t reach/);
    assert.doesNotMatch(await notice.innerText(), /key didn.t work/);

    await keyField(app).focus();
    await app.page.keyboard.press('End');
    await app.page.keyboard.type('4');
    assert.equal(await dialog(app).locator('.notice.is-error').count(), 0, 'the old failure is gone');
    await assertOnePrimary(app, 'Check key');
    assert.equal(await keyField(app).inputValue(), 'sk-test-1234', 'typing carries on after the rebuild');
  });
});

test('Something else: an answer about money is replaced with plain advice', async (t) => {
  const fake = createFakeAi({ detect: claudeKeyOnly(), connect: { ok: false, message: 'HTTP 429: insufficient_quota — add billing to your account.' } });
  await withApp(t, { ai: fake }, async (app) => {
    await openOther(app);
    await dialog(app).getByRole('tab', { name: 'OpenAI-compatible server' }).click();
    await dialog(app).getByLabel('Base URL').fill('http://localhost:8000/v1');
    await buttonNamed(app, 'Connect').click();
    await dialog(app).locator('.notice.is-error').first().waitFor({ timeout: 5000 });
    assert.doesNotMatch(await dialog(app).innerText(), NO_COST_TALK);
    assert.doesNotMatch(await dialog(app).innerText(), /quota/i);
    await assertOnePrimary(app, 'Try again');
  });
});

// ---- connected, disconnect and a connection that breaks --------------------

const waiting = (n) => () => ({ captures: n, duplicates: 0, malformed: 0, urls: [], items: [] });

test('after connecting: the connection, then a separate hand-off box — and no "Setup steps"', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), connect: { ok: true, message: 'Connected.', label: 'Claude Code · Sonnet 5.5' } });
  await withApp(t, { ai: fake, inbox: waiting(3) }, async (app) => {
    await openWindow(app);
    await waitForPane(app, 'Claude');
    await buttonNamed(app, 'Connect').click();
    const connection = dialog(app).locator('.cp-connected');
    await connection.waitFor({ timeout: 5000 });
    assert.match(await connection.innerText(), /Connected · Claude Code · Sonnet 5\.5/);
    assert.equal(await dialog(app).getByText(/Setup steps/i).count(), 0);
    const box = dialog(app).locator('.cp-handoff');
    assert.equal(await connection.locator('.cp-handoff').count(), 0, 'the box sits under the connection, not inside it');
    assert.match(await box.innerText(), /3 links are waiting to be analysed\./);
    assert.deepEqual((await box.getByRole('button').allInnerTexts()).map((s) => s.trim()), ['Analyse 3 links', 'Later']);
  });
});

async function connectClaude(app) {
  await openWindow(app);
  await waitForPane(app, 'Claude');
  await buttonNamed(app, 'Connect').click();
  await dialog(app).locator('.cp-connected').waitFor({ timeout: 5000 });
}

const CLAUDE_CONNECTS = { detect: claudeApp(true, 'yes'), connect: { ok: true, message: 'Connected.', label: 'Claude Code · Sonnet 5.5' } };

test('hand-off: Analyse closes the window and starts the drain', async (t) => {
  const fake = createFakeAi(CLAUDE_CONNECTS);
  await withApp(t, { ai: fake, inbox: waiting(2) }, async (app) => {
    await connectClaude(app);
    await buttonNamed(app, 'Analyse 2 links').click();
    await dialog(app).waitFor({ state: 'detached', timeout: 5000 });
    await app.page.waitForFunction(() => window.LibraryAI.drain.running || window.LibraryAI.drain.finished, null, { timeout: 5000 });
    const started = fake.calls.some((c) => c.name === 'runDrain');
    assert.ok(started, 'the same drain the Add drawer starts');
  });
});

test('hand-off: Later closes the window, and opening it again shows no hand-off', async (t) => {
  const fake = createFakeAi(CLAUDE_CONNECTS);
  await withApp(t, { ai: fake, inbox: waiting(2) }, async (app) => {
    await connectClaude(app);
    await buttonNamed(app, 'Later').click();
    await dialog(app).waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(fake.calls.filter((c) => c.name === 'runDrain').length, 0);
    await openWindow(app);
    await dialog(app).locator('.cp-connected').waitFor({ timeout: 5000 });
    assert.equal(await dialog(app).locator('.cp-handoff').count(), 0);
  });
});

test('hand-off: with nothing waiting it says to add a link, and Add a link opens the Add drawer', async (t) => {
  const fake = createFakeAi(CLAUDE_CONNECTS);
  await withApp(t, { ai: fake, inbox: waiting(0) }, async (app) => {
    await connectClaude(app);
    assert.match(await dialog(app).locator('.cp-handoff').innerText(), /Add a link, then press Analyse\./);
    await buttonNamed(app, 'Add a link').click();
    await app.page.locator('.cp-modal').waitFor({ state: 'detached', timeout: 5000 });
    await app.page.locator('.inbox-input').waitFor({ timeout: 5000 });
  });
});

// ---- the connected pane ----------------------------------------------------

const MODELS = { models: [{ id: 'sonnet', label: 'Sonnet 5.5' }, { id: 'opus', label: 'Opus 5.5' }], free: false };

async function openConnected(app) {
  await openWindow(app);
  await dialog(app).locator('.cp-connected').waitFor({ timeout: 8000 });
  await dialog(app).locator('select[aria-label="Model"]:not([hidden])').waitFor({ timeout: 5000 });
}

test('connected: only the connection — model dropdown with the app\'s models and an Automatic choice, no separate save button', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), models: MODELS });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake, inbox: waiting(2) }, async (app) => {
    await openConnected(app);
    const options = await dialog(app).locator('select[aria-label="Model"] option').allInnerTexts();
    assert.deepEqual(options.map((s) => s.trim()), ['Automatic (Claude chooses)', 'Sonnet 5.5', 'Opus 5.5']);
    assert.equal(await dialog(app).locator('.cp-handoff').count(), 0, 'no hand-off when merely opening the window');
    assert.equal(await dialog(app).getByText(/Setup steps/i).count(), 0);
    assert.equal(await dialog(app).getByRole('button', { name: 'Use this model' }).count(), 0, 'choosing a model applies it');
  });
});

test('model change: choosing one re-checks, then shows the success notice once, updates the header and pulses it', async (t) => {
  const fake = createFakeAi({
    detect: claudeApp(true, 'yes'),
    models: MODELS,
    connect: { ok: true, message: 'Connected.', label: 'Claude · Opus 5.5' },
  });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await openConnected(app);
    await dialog(app).locator('select[aria-label="Model"]').selectOption('opus');
    const notice = dialog(app).locator('.notice.is-success');
    await notice.waitFor({ timeout: 5000 });
    assert.match(await notice.innerText(), /Now using Opus 5\.5/);
    assert.match(await notice.innerText(), /Your next analyses use it\./);
    assert.deepEqual(fake.calls.filter((c) => c.name === 'connect').pop().arg.agent, { model: 'opus' });
    await app.page.waitForFunction(() => /Opus 5\.5/.test(document.querySelector('.ai-header').textContent));
    assert.equal(await header(app).evaluate((b) => b.classList.contains('is-updated')), true, 'the header button pulses');
    await app.page.keyboard.press('Escape');
    await openConnected(app);
    assert.equal(await dialog(app).locator('.notice.is-success').count(), 0, 'shown once');
  });
});

test('model change: a failing check keeps the old model and says so', async (t) => {
  const fake = createFakeAi({
    detect: claudeApp(true, 'yes'),
    models: MODELS,
    connect: { ok: false, message: 'claude didn’t answer.' },
  });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await openConnected(app);
    const before = await dialog(app).locator('select[aria-label="Model"]').inputValue();
    await dialog(app).locator('select[aria-label="Model"]').selectOption('opus');
    const notice = dialog(app).locator('.notice.is-error');
    await notice.waitFor({ timeout: 5000 });
    assert.equal(await dialog(app).locator('select[aria-label="Model"]').inputValue(), before, 'the dropdown goes back to the model in use');
    assert.match(await notice.innerText(), /previous model/i);
    assert.equal(await dialog(app).locator('.notice.is-success').count(), 0);
    assert.match(await header(app).innerText(), /Sonnet 5\.5/);
    assert.equal(await header(app).evaluate((b) => b.classList.contains('is-updated')), false);
  });
});

test('Disconnect is red at rest', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), models: MODELS });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await openConnected(app);
    const colour = await buttonNamed(app, 'Disconnect').evaluate((b) => getComputedStyle(b).color);
    const [r, g, b] = colour.match(/\d+/g).map(Number);
    assert.ok(r > 200 && g < 190 && b < 190, 'red text before any hover: ' + colour);
  });
});

// ---- disconnect ------------------------------------------------------------

const LOGGED_OUT = {
  kind: 'logged-out',
  short: 'logged out',
  title: 'Claude Code is logged out. Log in again to keep analysing.',
  text: 'Claude Code logged out while analysing. 3 links are still waiting.',
  at: new Date().toISOString(),
};

test('disconnect while signed in: lands on Connect as the primary, login ticked, with a toast', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), models: MODELS });
  fake.setConnection(CLAUDE_ON);
  await withApp(t, { ai: fake }, async (app) => {
    await openConnected(app);
    await buttonNamed(app, 'Disconnect').click();
    await assertOnePrimaryEventually(app, 'Connect');
    assert.match(await dialog(app).innerText(), /Still logged in to Claude Code/);
    assert.equal(await dialog(app).locator('.cp-connected').count(), 0);
    assert.match(await app.page.locator('.toast').innerText(), /library is unchanged/i);
    assert.equal((await header(app).innerText()).trim(), 'Connect AI');
  });
});

test('disconnect after the login was lost: lands on Open {app} to log in as the primary', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), models: MODELS });
  fake.setConnection(Object.assign({}, CLAUDE_ON, { problem: LOGGED_OUT }));
  await withApp(t, { ai: fake }, async (app) => {
    await openWindow(app);
    await dialog(app).locator('.cp-repair').waitFor({ timeout: 8000 });
    await buttonNamed(app, 'Disconnect').click();
    await dialog(app).locator('.cp-repair').waitFor({ state: 'detached', timeout: 5000 });
    await assertOnePrimaryEventually(app, 'Open Claude Code to log in');
    assert.equal(await buttonNamed(app, 'Connect').count(), 1, 'Connect stays on show, secondary');
  });
});

async function assertOnePrimaryEventually(app, label) {
  await app.page.waitForFunction((l) => {
    const found = Array.from(document.querySelectorAll('[role=dialog] .btn-primary')).map((b) => b.textContent.trim());
    return found.length === 1 && found[0] === l;
  }, label, { timeout: 5000 });
  await assertOnePrimary(app, label);
}

// ---- a connection that breaks ----------------------------------------------

test('broken connection: amber header face with words and tooltip, a Needs attention row, a warning, repair steps and a red Disconnect', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'no'), models: MODELS });
  fake.setConnection(Object.assign({}, CLAUDE_ON, { problem: LOGGED_OUT }));
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /logged out/.test(document.querySelector('.ai-header').textContent));
    assert.equal((await header(app).innerText()).trim(), 'Claude · logged out');
    assert.equal(await header(app).getAttribute('title'), LOGGED_OUT.title);
    assert.equal(await header(app).evaluate((b) => b.classList.contains('is-warn')), true);
    assert.equal(await header(app).locator('svg').count(), 1, 'an alert icon, not colour alone');

    await openWindow(app);
    await app.page.locator('.cp-row', { hasText: 'Claude' }).first().waitFor({ timeout: 8000 });
    assert.match(await app.page.locator('.cp-row', { hasText: 'Claude' }).first().innerText(), /Needs attention/);

    const warning = dialog(app).locator('.notice.is-warning');
    assert.match(await warning.innerText(), /3 links are still waiting/);
    assert.equal(await dialog(app).locator('.cp-repair .ai-steps-list').count(), 1, 'repair steps sit under the warning');
    assert.equal(await dialog(app).getByText(/Setup steps/i).count(), 0);

    await assertOnePrimary(app, 'Open Claude Code to log in');
    assert.equal(await buttonNamed(app, 'I’ve logged in — check again').count(), 1);
    assert.equal(await buttonNamed(app, 'Disconnect').count(), 1);
    const colour = await buttonNamed(app, 'Disconnect').evaluate((b) => getComputedStyle(b).color);
    assert.ok(Number(colour.match(/\d+/g)[0]) > 200, 'Disconnect is red: ' + colour);
  });
});

test('repair: opening the app moves the primary to the check; a passing check clears the problem and shows the hand-off', async (t) => {
  const fake = createFakeAi({
    detect: claudeApp(true, 'no'),
    models: MODELS,
    connect: { ok: false, message: 'claude didn’t answer: “Not logged in”.', loggedOut: true },
  });
  fake.setConnection(Object.assign({}, CLAUDE_ON, { problem: LOGGED_OUT }));
  await withApp(t, { ai: fake, inbox: waiting(3) }, async (app) => {
    await openWindow(app);
    await dialog(app).locator('.cp-repair').waitFor({ timeout: 8000 });
    await buttonNamed(app, 'Open Claude Code to log in').click();
    await assertOnePrimaryEventually(app, 'I’ve logged in — check again');
    assert.deepEqual(fake.calls.filter((c) => c.name === 'runTerminalAction').pop().arg, { ai: 'claude', action: 'login' });

    await buttonNamed(app, 'I’ve logged in — check again').click();
    await dialog(app).locator('.notice.is-error').waitFor({ timeout: 5000 });
    assert.match(await header(app).innerText(), /logged out/, 'still broken');

    fake.script({ connect: { ok: true, message: 'Connected.', label: 'Claude · Sonnet 5.5' } });
    await buttonNamed(app, 'I’ve logged in — check again').click();
    await dialog(app).locator('.cp-handoff').waitFor({ timeout: 5000 });
    assert.match(await dialog(app).locator('.cp-handoff').innerText(), /3 links are waiting/);
    assert.equal(await dialog(app).locator('.cp-repair').count(), 0);
    assert.equal((await header(app).innerText()).trim(), 'Claude · Sonnet 5.5');
  });
});

test('broken connection that is not about login: one primary Check again, and Disconnect', async (t) => {
  const fake = createFakeAi({ detect: claudeApp(true, 'yes'), models: MODELS });
  fake.setConnection(Object.assign({}, CLAUDE_ON, {
    problem: { kind: 'not-answering', short: 'not answering', title: 'Claude Code isn’t answering.', text: 'Claude Code stopped answering while analysing. 1 link is still waiting.', at: new Date().toISOString() },
  }));
  await withApp(t, { ai: fake }, async (app) => {
    await app.page.waitForFunction(() => /not answering/.test(document.querySelector('.ai-header').textContent));
    await openWindow(app);
    await dialog(app).locator('.cp-repair').waitFor({ timeout: 8000 });
    await assertOnePrimary(app, 'Check again');
    assert.match(await dialog(app).locator('.notice.is-warning').innerText(), /1 link is still waiting/);
    assert.equal(await buttonNamed(app, 'Disconnect').count(), 1);
  });
});
