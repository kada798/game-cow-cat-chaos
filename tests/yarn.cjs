const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?lang=zh';
const output = process.env.YARN_SCREENSHOTS || path.join(__dirname, 'results');
const sizes = [[320,568], [390,844], [430,932], [568,320], [870,612], [768,1024], [1024,768], [820,1180], [1191,668], [1440,900], [1920,1080], [2560,1440]];
const scene = '[data-scene="yarn"]';
const state = (page, value) => page.waitForFunction(s => document.querySelector('[data-scene="yarn"]').dataset.state === s, value);
const shot = (page, name) => page.screenshot({ path: path.join(output, `yarn-${name}.png`) });
const events = page => page.evaluate(() => window.playableEvents.filter(e => e.scene === 'yarn'));
const count = async (page, name) => (await events(page)).filter(e => e.event === name).length;
const art = require('../assets/art-v1/manifest.json').assets;

async function enter(page) {
  await page.evaluate(() => showScene(window.catStory.findIndex(scene => scene.id === 'yarn')));
  await page.waitForSelector(`${scene}.is-active.is-ready`);
  await state(page, 'playing');
  assert(await page.locator('#yarnReplay').isEnabled());
  assert(await page.locator('#yarnNext').isHidden());
}

async function open(page) {
  await page.goto(url);
  await page.waitForFunction(() => typeof showScene === 'function' && window.playableViewport);
  assert.equal(await page.locator(scene).count(), 1, 'Runtime must provide exactly one yarn scene.');
  assert.equal(await page.locator('.yarn-scene[data-scene="yarn"]').count(), 1);
  assert.equal(await page.locator('.scene').nth(await page.evaluate(() => window.catStory.findIndex(chapter => chapter.id === 'yarn'))).getAttribute('data-scene'), 'yarn');
  await page.evaluate(() => {
    const root = document.querySelector('[data-scene="yarn"]');
    window.yarnTestTrace = { poses: [], states: [] };
    const add = (key, value) => {
      const list = window.yarnTestTrace[key];
      if (value && list.at(-1) !== value) list.push(value);
    };
    const snapshot = () => {
      add('states', root.dataset.state);
      add('poses', root.querySelector('.yarn-cat')?.dataset.pose);
    };
    new MutationObserver(records => {
      for (const r of records) {
        if (r.target === root && r.attributeName === 'data-state') add('states', r.oldValue);
        if (r.target.matches('.yarn-cat') && r.attributeName === 'data-pose') add('poses', r.oldValue);
      }
      snapshot();
    }).observe(root, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-state', 'data-pose'] });
    snapshot();
  });
}

async function ready(page) {
  await open(page);
  await enter(page);
}

async function tap(page, selector) {
  const hit = page.locator(`${selector} .hit-area`);
  const target = await hit.count() ? hit : page.locator(selector);
  const b = await target.boundingBox();
  assert(b && b.width > 0 && b.height > 0, `Missing visible target: ${selector}`);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

async function opacity(page, selector, visible) {
  await page.waitForFunction(({ selector, visible }) => {
    const node = document.querySelector(selector);
    if (!node) return false;
    let alpha = 1;
    for (let e = node; e; e = e.parentElement) {
      const css = getComputedStyle(e);
      if (css.display === 'none' || css.visibility === 'hidden') return !visible;
      alpha *= Number(css.opacity);
    }
    return visible ? alpha > .8 : alpha < .05;
  }, { selector, visible });
}

async function finished(page, total) {
  await state(page, 'rescued');
  await page.waitForFunction(n => window.playableEvents.filter(e => e.event === 'yarn_round_complete').length === n, total);
  assert(await page.locator('#yarnNext').isVisible());
  assert(await page.locator('#yarnNext').isEnabled());
  assert(await page.locator('#yarnReplay').isEnabled());
  await opacity(page, '.yarn-tangle', false);
  await opacity(page, '.yarn-tidy', true);
}

async function visibility(page, hidden) {
  await page.evaluate(value => {
    if (value) Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    else delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

async function checkLayout(page) {
  const m = await page.evaluate(() => {
    const box = e => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const button = document.querySelector('#featherToy');
    const hit = button.querySelector('.hit-area');
    const r = hit.getBoundingClientRect();
    const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const controls = document.querySelector('#yarnControls');
    const active = document.querySelector('[data-scene="yarn"]');
    return {
      size: [innerWidth, innerHeight], frame: box(document.querySelector('#gameFrame')), stage: box(document.querySelector('#game')),
      hit: box(hit), controls: box(controls), hud: box(document.querySelector('.hud')),
      ball: box(document.querySelector('#yarnMess')),
      catSize: box(document.querySelector('.yarn-play')).width,
      toyImage: box(button.querySelector('img')), toyClip: box(button.querySelector('.yarn-feather-crop')),
      toyState: active.dataset.toy,
      target: button.tagName === 'BUTTON' && !button.disabled && button.contains(center),
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      images: [...active.querySelectorAll('img')].map(img => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 })),
      controlsHit: [...controls.querySelectorAll('button')].filter(e => e.checkVisibility()).map(box),
      textFits: ['.title', '.hint'].every(s => {
        const e = document.querySelector(s);
        return e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1;
      })
    };
  });
  const details = JSON.stringify(m);
  const inside = b => b.x >= -.3 && b.y >= -.3 && b.right <= m.size[0] + .3 && b.bottom <= m.size[1] + .3;
  for (const b of [m.frame, m.stage]) {
    assert(Math.abs(b.x) < .3 && Math.abs(b.y) < .3, details);
    assert(Math.abs(b.width - m.size[0]) < .3 && Math.abs(b.height - m.size[1]) < .3, details);
  }
  assert(m.images.length && m.images.every(e => e.loaded), details);
  assert(m.textFits && !m.overflow && m.target, details);
  assert(m.hit.width >= 43.8 && m.hit.height >= 43.8 && inside(m.hit), details);
  assert(inside(m.controls) && m.hit.y >= m.hud.bottom - .3, details);
  for (const b of m.controlsHit) assert(b.width >= 43.8 && b.height >= 43.8 && inside(b), details);
  assert.match(await page.locator('#featherToy').ariaSnapshot(), /button "[^"]+"/, 'Toy needs an accessible button name.');
  assert.equal(await page.locator('#yarnSound').getAttribute('type'), 'checkbox');
  const diameter = m.ball.width * art['yarn-tidy'].ballDiameter / art['yarn-tidy'].width;
  const head = m.catSize * art['cat-yarn-play'].headWidth / art['cat-yarn-play'].width;
  assert(Math.abs(diameter / head - .8) < .015, `Wrong yarn/head ratio: ${diameter / head}`);
  assert.equal(m.toyState, 'hidden');
  assert(Math.abs(m.hit.x - 8) < .5, `Toy is not at viewport edge: ${details}`);
  const visibleWidth = Math.max(0, Math.min(m.toyImage.right, m.toyClip.right) - Math.max(m.toyImage.x, m.toyClip.x));
  const visibleHeight = Math.max(0, Math.min(m.toyImage.bottom, m.toyClip.bottom) - Math.max(m.toyImage.y, m.toyClip.y));
  const visibleFraction = visibleWidth * visibleHeight / (m.toyImage.width * m.toyImage.height);
  assert(visibleFraction > .005 && visibleFraction < .2, `Not a corner-only clue: ${visibleFraction}`);
  assert(Math.hypot(m.ball.x + m.ball.width / 2 - m.hit.x - m.hit.width / 2, m.ball.y - m.hit.y) > 140, 'Toy must be separated from the yarn.');
}

async function pullAndReveal(page) {
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.yarnAudioProbe = { created: 0, played: 0 };
    window.AudioContext = class extends NativeAudio {
      constructor(...args) { super(...args); window.yarnAudioProbe.created++; }
      createOscillator() { window.yarnAudioProbe.played++; return super.createOscillator(); }
    };
  });
  await ready(page);
  await checkLayout(page);
  await page.waitForFunction(() => Number(document.querySelector('[data-scene="yarn"]').dataset.pull) < .02);
  const rest = await page.locator('#yarnPullThread').getAttribute('d');
  await page.waitForFunction(() => Number(document.querySelector('[data-scene="yarn"]').dataset.pull) > .96);
  const peak = await page.evaluate(() => ({
    path: document.querySelector('#yarnPullThread').getAttribute('d'),
    ball: document.querySelector('#yarnMess').style.transform,
    roll: document.querySelector('.yarn-ball-roll').style.transform,
    pose: document.querySelector('.yarn-cat').dataset.pose
  }));
  assert.notEqual(peak.path, rest);
  assert.equal(peak.pose, 'tug');
  assert(/translate\(-1[12]/.test(peak.ball), peak.ball);
  assert(/rotate\(-2[12]/.test(peak.roll), peak.roll);
  await shot(page, 'pull-peak');
  assert.deepEqual(await page.evaluate(() => window.yarnAudioProbe), { created: 0, played: 0 });
  await tap(page, '#featherToy');
  await state(page, 'attracting');
  assert.deepEqual(await page.evaluate(() => window.yarnAudioProbe), { created: 1, played: 0 });
  await page.waitForFunction(() => document.querySelector('[data-scene="yarn"]').dataset.toy === 'active');
  assert.deepEqual(await page.evaluate(() => window.yarnAudioProbe), { created: 1, played: 2 });
  assert.equal(await count(page, 'yarn_toy_revealed'), 1);
  assert.equal(await count(page, 'yarn_bell'), 1);
  const full = await page.locator('#featherToy img').boundingBox();
  const screen = page.viewportSize();
  assert(full.x >= 0 && full.y >= 0 && full.x + full.width <= screen.width && full.y + full.height <= screen.height);
  await shot(page, 'toy-revealed');
  await finished(page, 1);
  await tap(page, '#yarnReplay');
  await checkLayout(page);
  await page.locator('#yarnSound').uncheck();
  await tap(page, '#featherToy');
  await finished(page, 2);
  assert.equal(await count(page, 'yarn_bell'), 1, 'Muted replay must not ring.');
  assert.deepEqual(await page.evaluate(() => window.yarnAudioProbe), { created: 1, played: 2 });
}

async function rescueAndReplay(page) {
  await ready(page);
  const initial = (await events(page)).filter(e => e.event === 'yarn_state').map(e => e.state);
  assert.deepEqual(initial.slice(-2), ['loading', 'playing']);
  assert.equal(await page.locator('.yarn-cat').getAttribute('data-pose'), 'play');
  await checkLayout(page);
  await opacity(page, '.yarn-tangle', true);
  await opacity(page, '.yarn-tidy', false);
  await shot(page, 'playing');

  const wrongStart = (await events(page)).length;
  await tap(page, '#yarnMess');
  await page.waitForFunction(() => window.playableEvents.some(e => e.event === 'yarn_wrong_target'));
  await state(page, 'guarded');
  await opacity(page, '.yarn-tangle', true);
  await state(page, 'playing');
  await page.waitForTimeout(1300);
  const wrong = (await events(page)).slice(wrongStart);
  assert.deepEqual(wrong.filter(e => e.event === 'yarn_state').map(e => e.state), ['guarded', 'playing']);
  assert.equal(wrong.filter(e => e.event === 'yarn_wrong_target').length, 1);
  assert.equal(await count(page, 'yarn_trigger'), 0);
  assert.equal(await count(page, 'yarn_round_complete'), 0);
  assert.equal(await count(page, 'scene_complete'), 0);
  assert(await page.locator(`${scene}.is-active`).isVisible());
  assert(await page.locator('#yarnNext').isHidden());
  await opacity(page, '.yarn-tangle', true);

  const start = (await events(page)).length;
  await tap(page, '#featherToy');
  await state(page, 'attracting');
  assert(await page.locator('#yarnReplay').isDisabled());
  await opacity(page, '.yarn-tangle', true);
  for (let i = 0; i < 3; i++) await tap(page, '#featherToy');
  await state(page, 'following');
  assert(await page.locator('#yarnReplay').isDisabled());
  await opacity(page, '.yarn-tangle', true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // The target may be disabled while busy, so inspect geometry at rest below.
  const movingState = await page.locator(scene).getAttribute('data-state');
  assert(['following', 'rescuing', 'rescued'].includes(movingState), `Resize reset sequence to ${movingState}`);
  await shot(page, 'moving-landscape');
  await page.waitForFunction(() => ['rescuing', 'rescued'].includes(document.querySelector('[data-scene="yarn"]').dataset.state));
  await opacity(page, '.yarn-tangle', false);
  await finished(page, 1);
  const first = (await events(page)).slice(start);
  assert.deepEqual(first.filter(e => e.event === 'yarn_state').map(e => e.state), ['attracting', 'following', 'rescuing', 'rescued']);
  assert.equal(first.filter(e => e.event === 'yarn_trigger').length, 1, 'Rapid taps must not queue rescues.');
  assert.equal(first.filter(e => e.event === 'yarn_round_complete').length, 1);
  assert.equal(first.find(e => e.event === 'yarn_round_complete').round, 1);
  assert.deepEqual(first.filter(e => e.event === 'scene_complete').map(e => e.result), ['yarn_rescued']);
  const trace = await page.evaluate(() => window.yarnTestTrace);
  for (const pose of ['play', 'alert', 'walk', 'pounce']) assert(trace.poses.includes(pose), `Missing cat pose ${pose}: ${JSON.stringify(trace)}`);
  for (const s of ['loading', 'playing', 'guarded', 'attracting', 'following', 'rescuing', 'rescued']) assert(trace.states.includes(s), `Missing actual DOM state ${s}`);
  await shot(page, 'rescued-landscape');

  await tap(page, '#featherToy');
  await tap(page, '#yarnMess');
  await page.waitForTimeout(1600);
  assert.equal(await page.locator(scene).getAttribute('data-state'), 'rescued');
  assert(await page.locator(`${scene}.is-active`).isVisible(), 'Success must not auto-advance.');
  assert.equal(await count(page, 'yarn_round_complete'), 1);
  assert.equal(await count(page, 'yarn_trigger'), 1);
  assert.equal(await count(page, 'yarn_wrong_target'), 1);

  await page.locator('#yarnSound').uncheck();
  await tap(page, '#yarnReplay');
  await state(page, 'playing');
  assert(await page.locator('#yarnNext').isHidden());
  assert.equal(await page.locator('.yarn-cat').getAttribute('data-pose'), 'play');
  await opacity(page, '.yarn-tangle', true);
  await opacity(page, '.yarn-tidy', false);
  await checkLayout(page);
  await tap(page, '#featherToy');
  await state(page, 'attracting');
  // Disabled replay/Next must not reset or skip an in-flight rescue.
  await tap(page, '#yarnReplay');
  assert(await page.locator('#yarnNext').isHidden() || await page.locator('#yarnNext').isDisabled());
  await finished(page, 2);
  assert.equal(await count(page, 'yarn_trigger'), 2);
  assert.equal(await count(page, 'scene_complete'), 1, 'Replay must not count scene completion twice in one entry.');
  assert.deepEqual((await events(page)).filter(e => e.event === 'yarn_round_complete').map(e => e.round), [1, 2]);
  await tap(page, '#yarnNext');
  await page.waitForSelector('[data-scene="dad"].is-active');
  assert(await page.locator('#yarnControls').isHidden());
}

async function interruptions(page) {
  await ready(page);
  for (const phase of ['attracting', 'following', 'rescuing']) {
    await tap(page, '#featherToy');
    await state(page, phase);
    await visibility(page, true);
    try {
      await state(page, 'playing');
      await page.waitForTimeout(6500);
      assert.equal(await count(page, 'yarn_round_complete'), 0, `Completed while hidden during ${phase}`);
      assert.equal(await count(page, 'scene_complete'), 0);
      assert.equal(await page.locator(scene).getAttribute('data-state'), 'playing');
      assert(await page.locator('#yarnNext').isHidden());
    } finally { await visibility(page, false); }
    await state(page, 'playing');
    assert(await page.locator('#yarnReplay').isEnabled());
    await opacity(page, '.yarn-tangle', true);
  }

  await tap(page, '#featherToy');
  await state(page, 'following');
  await page.evaluate(() => showScene(window.catStory.findIndex(scene => scene.id === 'dad')));
  await page.waitForSelector('[data-scene="dad"].is-active');
  const afterLeave = (await events(page)).length;
  await page.waitForTimeout(6500);
  assert.equal((await events(page)).length, afterLeave, 'Inactive scene emitted late events.');
  assert.equal(await count(page, 'yarn_round_complete'), 0);
  assert.equal(await count(page, 'scene_complete'), 0);
  assert(await page.locator('#yarnControls').isHidden());
  assert.equal(await page.locator(scene).evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);

  await enter(page);
  await tap(page, '#featherToy');
  await finished(page, 1);
  assert.equal(await count(page, 'scene_complete'), 1);
  await page.evaluate(() => showScene(window.catStory.findIndex(scene => scene.id === 'dad')));
  await enter(page);
  await tap(page, '#featherToy');
  await finished(page, 2);
  assert.equal(await count(page, 'scene_complete'), 2, 'A fresh entry must permit exactly one new completion.');
}

async function loadingAndRetry(page) {
  await open(page);
  // Gate native image decoding, not the game controller, to hold real loading.
  await page.evaluate(() => {
    const urls = new Set([...document.querySelectorAll('[data-scene="yarn"] img')].map(e => e.src));
    const original = HTMLImageElement.prototype.decode;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    window.yarnTestDecode = { calls: 0, fail: false, release, restore: () => { HTMLImageElement.prototype.decode = original; } };
    HTMLImageElement.prototype.decode = async function (...args) {
      if (this.closest('[data-scene="yarn"]') || urls.has(this.src)) {
        window.yarnTestDecode.calls++;
        await gate;
        if (window.yarnTestDecode.fail) throw new Error('Test-only yarn image decode failure');
      }
      return original.apply(this, args);
    };
  });
  try {
    await page.evaluate(() => showScene(window.catStory.findIndex(scene => scene.id === 'yarn')));
    await state(page, 'loading');
    await page.waitForFunction(() => window.yarnTestDecode.calls > 0);
    assert(await page.locator('#yarnReplay').isDisabled());
    assert(await page.locator('#yarnNext').isHidden());
    await page.evaluate(() => { window.yarnTestDecode.fail = true; window.yarnTestDecode.release(); });
    await state(page, 'error');
    assert(await page.locator('#yarnReplay').isEnabled());
    assert.equal(await count(page, 'scene_complete'), 0);
    assert(await page.locator('#yarnNext').isHidden());
    await page.evaluate(() => window.yarnTestDecode.restore());
    await tap(page, '#yarnReplay');
    await state(page, 'playing');
    await page.waitForSelector(`${scene}.is-active.is-ready`);
    const states = (await events(page)).filter(e => e.event === 'yarn_state').map(e => e.state);
    assert.deepEqual(states.slice(-4), ['loading', 'error', 'loading', 'playing']);
    await checkLayout(page);
    await tap(page, '#featherToy');
    await finished(page, 1);
  } finally {
    await page.evaluate(() => { window.yarnTestDecode.release(); window.yarnTestDecode.restore(); });
  }
}

async function keyboardAndReducedMotion(page) {
  await ready(page);
  assert(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
  await page.locator('#yarnMess').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.playableEvents.some(e => e.event === 'yarn_wrong_target'));
  await state(page, 'playing');
  assert.equal(await count(page, 'scene_complete'), 0);
  await page.locator('#featherToy').focus();
  await page.keyboard.press('Space');
  await finished(page, 1);
  assert.deepEqual((await events(page)).filter(e => e.event === 'yarn_state' && ['attracting', 'following', 'rescuing', 'rescued'].includes(e.state)).map(e => e.state), ['attracting', 'following', 'rescuing', 'rescued']);
  await page.locator('#yarnReplay').focus();
  await page.keyboard.press('Enter');
  await state(page, 'playing');
  await page.locator('#featherToy').focus();
  await page.keyboard.press('Enter');
  await finished(page, 2);
  assert.equal(await count(page, 'scene_complete'), 1);
  await page.locator('#yarnNext').focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-scene="dad"].is-active');
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  async function withPage(label, options, test) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, ...options });
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push({ test: label, message: e.message }));
    try {
      await test(page);
      assert.deepEqual(errors, [], 'Unexpected page errors.');
      console.log(`PASS: yarn ${label}`);
    } catch (error) {
      await shot(page, `failure-${label}`).catch(() => {});
      const diagnostics = await events(page).catch(() => []);
      console.error(`FAIL: yarn ${label}`, JSON.stringify({ errors, events: diagnostics }, null, 2));
      throw error;
    } finally { await page.close(); }
  }
  try {
    await withPage('pull-reveal-audio', {}, pullAndReveal);
    await withPage('rescue-replay', {}, rescueAndReplay);
    await withPage('interruptions', {}, interruptions);
    await withPage('loading-retry', {}, loadingAndRetry);
    await withPage('keyboard-reduced', { hasTouch: false, reducedMotion: 'reduce', viewport: { width: 1024, height: 768 } }, keyboardAndReducedMotion);
    for (const [width, height] of sizes) {
      await withPage(`${width}x${height}`, { viewport: { width, height } }, async page => {
        await ready(page);
        await checkLayout(page);
        await opacity(page, '.yarn-tangle', true);
        await shot(page, `${width}x${height}`);
      });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: yarn wrong target, ordered rescue, rapid taps, replay, explicit Next, moving resize, visibility/leave cancellation, load retry, keyboard/reduced motion, ${sizes.length} full viewports; no page errors.`);
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
