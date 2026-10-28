const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?scene=ambush&lang=zh';
const output = process.env.AMBUSH_SCREENSHOTS || path.join(__dirname, 'results');
const girlArt = require('../assets/art-v1/manifest.json').assets['girl-reading'];
const ballArt = require('../assets/art-v1/manifest.json').assets['soccer-ball'];
const sharp = require('sharp');
fs.mkdirSync(output, { recursive: true });
const state = (page, value) => page.waitForFunction(s => document.querySelector('.ambush-scene').dataset.state === s, value);
const rounds = page => page.evaluate(() => window.playableEvents.filter(e => e.event === 'ambush_round_complete').length);
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`) });

async function ready(page) {
  await page.goto(url);
  await page.waitForSelector('.ambush-scene.is-ready');
  await page.waitForFunction(() => !document.querySelector('#ambushBall').disabled);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.ambush-rig')).opacity === '1');
}

async function tap(page, selector) {
  const b = await page.locator(selector).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * .8);
}

async function checkLayout(page) {
  const m = await page.evaluate(girlTopFraction => {
    const box = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const p = window.playableViewport.toScreenPoint(294, 664);
    return {
      size: [innerWidth, innerHeight], frame: box('#gameFrame'), stage: box('#game'),
      hud: box('.hud'), ball: box('#ambushBall'), hit: box('#ambushBall .hit-area'), girl: box('.ambush-girl'), controls: box('#ambushControls'),
      ballPhase: document.querySelector('.ambush-ball-motion').dataset.ball,
      ballSize: document.querySelector('#ambushBall').offsetWidth,
      catSize: parseFloat(getComputedStyle(document.querySelector('.ambush-scene')).getPropertyValue('--sprite-size')),
      girlVisibleTop: box('.ambush-girl').y + box('.ambush-girl').height * girlTopFraction,
      back: window.playableViewport.toScenePoint(p.x, p.y),
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      images: [...document.querySelectorAll('.ambush-scene img')].every(e => e.complete && e.naturalWidth > 0),
      textFits: ['.title', '.hint'].every(s => {
        const e = document.querySelector(s);
        return e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1;
      })
    };
  }, girlArt.bounds[1] / girlArt.height);
  for (const b of [m.frame, m.stage]) {
    assert(Math.abs(b.x) < .3 && Math.abs(b.y) < .3);
    assert(Math.abs(b.width - m.size[0]) < .3 && Math.abs(b.height - m.size[1]) < .3, JSON.stringify(m));
  }
  assert(m.images && m.textFits && !m.overflow, JSON.stringify(m));
  assert(m.hit.width >= 43.8 && m.hit.height >= 43.8);
  assert(m.girl.x >= 0 && m.girl.right <= m.size[0] + .3 && m.girl.bottom <= m.size[1]);
  assert(m.girlVisibleTop > m.hud.bottom, JSON.stringify(m));
  assert(m.ball.x >= 0 && m.ball.right <= m.size[0] + .3);
  assert(m.ball.y > m.hud.bottom && m.ball.bottom <= m.size[1]);
  assert(m.controls.x >= 0 && m.controls.right <= m.size[0] && m.controls.bottom <= m.size[1]);
  assert(Math.abs(m.back.x - 294) < .01 && Math.abs(m.back.y - 664) < .01 && m.back.inside);
  const ratio = (m.ballSize * ballArt.ballDiameter / ballArt.width) / (m.catSize * 112 / 512);
  assert(Math.abs(ratio - 2 / 3) < .01, 'Visible ball diameter must be 2/3 of the normalized cat head.');
  if (m.ballPhase === 'hand') {
    const book = { x: m.girl.x + m.girl.width * girlArt.bookAnchor[0] / girlArt.width, y: m.girl.y + m.girl.height * girlArt.bookAnchor[1] / girlArt.height };
    assert(Math.abs(m.ball.y + m.ball.height / 2 - book.y) < m.girl.height * .08);
    assert(m.ball.x > book.x && m.ball.right < m.girl.right);
    assert(await page.locator('#ambushBall').evaluate(e => {
      const r = e.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === e;
    }), 'The girl must not intercept the ball hit area.');
  }
}

async function checkHiddenCorner(page) {
  const r = await page.locator('#ambushBall').boundingBox();
  const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width) + 1, height: Math.ceil(r.height) + 1 };
  const visible = await page.screenshot({ clip });
  await page.locator('#ambushBall').evaluate(e => { e.style.visibility = 'hidden'; });
  const concealed = await page.screenshot({ clip });
  await page.locator('#ambushBall').evaluate(e => { e.style.visibility = ''; });
  const a = await sharp(visible).removeAlpha().raw().toBuffer();
  const b = await sharp(concealed).removeAlpha().raw().toBuffer();
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 15) changed++;
  }
  const fullBallArea = Math.PI * (r.width * ballArt.ballDiameter / ballArt.width / 2) ** 2;
  assert(changed > fullBallArea * .025 && changed < fullBallArea * .45, `Only a discoverable corner should show: ${changed / fullBallArea}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const trackErrors = page => page.on('pageerror', e => errors.push(e.message));
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    trackErrors(page);
    await page.addInitScript(() => {
      window.testAudio = { created: 0, played: 0 };
      const NativeAudio = window.AudioContext;
      window.AudioContext = class extends NativeAudio {
        constructor(...args) { super(...args); window.testAudio.created++; }
        createOscillator() { window.testAudio.played++; return super.createOscillator(); }
      };
    });
    await ready(page);
    assert.match(await page.locator('.ambush-girl').getAttribute('src'), /girl-reading\.png$/);
    assert.match(await page.locator('.ambush-girl').getAttribute('alt'), /低头阅读/);
    assert.match(await page.locator('.ambush-peek').getAttribute('src'), /cat-under-sofa\.png$/);
    assert.equal(await page.locator('.ambush-scene .ambush-television, .ambush-scene .ambush-tv-frame').count(), 0);
    assert.equal(await page.locator('#ambushFoot').count(), 0);
    assert.match(await page.locator('#ambushBall img').getAttribute('src'), /soccer-ball\.png$/);
    await checkLayout(page);
    await checkHiddenCorner(page);
    assert(await page.locator('#ambushReplay').isHidden(), 'The ball is the initial discovery target.');
    const sock = await page.evaluate(() => window.playableViewport.toScreenPoint(297, 669));
    await page.touchscreen.tap(sock.x, sock.y);
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'ambush_trigger').length), 0);
    assert(await page.locator('#ambushNext').isHidden());
    await state(page, 'peek');
    await page.waitForTimeout(500);
    await shot(page, 'phone-peek');
    await tap(page, '#ambushBall');
    await state(page, 'dropping');
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'ambush_ball_landed').length), 0);
    await page.waitForTimeout(300);
    await shot(page, 'phone-ball-drop');
    await state(page, 'ball-landed');
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'ambush_state' && e.state === 'pounce').length), 0);
    const landed = await page.locator('#ambushBall').evaluate(e => {
      const r = e.getBoundingClientRect();
      return window.playableViewport.toScenePoint(r.x + r.width / 2, r.y + r.height / 2);
    });
    assert(Math.abs(landed.x - 310) < .1 && Math.abs(landed.y - 694) < .1);
    await shot(page, 'phone-ball-landed');
    await state(page, 'crouch');
    assert(await page.locator('#ambushReplay').isDisabled());
    assert.deepEqual(await page.evaluate(() => window.testAudio), { created: 1, played: 0 });
    await state(page, 'pounce');
    await page.waitForTimeout(360);
    await shot(page, 'phone-pounce');
    await state(page, 'land');
    await page.waitForTimeout(160);
    await shot(page, 'phone-land');
    await state(page, 'retreat');
    await page.waitForFunction(() => window.playableEvents.some(e => e.event === 'ambush_round_complete'));
    assert.equal(await rounds(page), 1);
    assert(await page.locator('#ambushNext').isVisible());
    assert.deepEqual(await page.evaluate(() => window.testAudio), { created: 1, played: 1 });
    const sequence = await page.evaluate(() => {
      const events = window.playableEvents;
      return events.slice(events.findIndex(e => e.event === 'ambush_trigger')).filter(e => e.event === 'ambush_state').slice(0, 8).map(e => e.state);
    });
    assert.deepEqual(sequence, ['dropping', 'ball-landed', 'peek', 'crouch', 'pounce', 'land', 'retreat', 'hidden']);
    assert.equal(await page.locator('.ambush-ball-motion').getAttribute('data-ball'), 'floor');
    assert(await page.locator('#ambushBall').isDisabled());
    assert.equal(await page.evaluate(() => window.playableEvents.find(e => e.event === 'scene_complete').action), 'tap_hidden_soccer_ball');
    await page.locator('#ambushSound').uncheck();
    await tap(page, '#ambushReplay');
    await state(page, 'crouch');
    for (let i = 0; i < 3; i++) await tap(page, '#ambushBall');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(150);
    await checkLayout(page);
    await page.waitForFunction(() => window.playableEvents.filter(e => e.event === 'ambush_round_complete').length === 2);
    assert.equal(await rounds(page), 2);
    assert.deepEqual(await page.evaluate(() => window.testAudio), { created: 1, played: 1 });
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'scene_complete' && e.scene === 'ambush').length), 1);
    await shot(page, 'landscape-complete');
    await tap(page, '#ambushReplay');
    await state(page, 'dropping');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(3500);
    assert.equal(await rounds(page), 2);
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'ambush_ball_landed').length), 2, 'Interrupted drops must never land or trigger a late pounce.');
    assert.equal(await page.locator('.ambush-ball-motion').getAttribute('data-ball'), 'hand');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await state(page, 'peek');
    await tap(page, '#ambushNext');
    await page.waitForSelector('[data-scene="stool"].is-active');
    await page.waitForFunction(() => !document.getElementById('stoolFoot').disabled);
    await page.locator('#stoolFoot').click();
    await page.waitForFunction(() => document.getElementById('storyBoard').dataset.stoolState === 'settled');
    await page.locator('#storyForward').click();
    await page.waitForSelector('[data-scene="yarn"].is-active.is-ready');
    await page.waitForFunction(() => document.querySelector('[data-scene="yarn"]').dataset.state === 'playing');
    assert(await page.locator('#ambushControls').isHidden());
    assert(await page.locator('#yarnControls').isVisible());
    assert(await page.locator('#yarnNext').isHidden());
    await tap(page, '#featherToy');
    await page.waitForFunction(() => document.querySelector('[data-scene="yarn"]').dataset.state === 'rescued');
    await page.waitForSelector('#yarnNext:visible');
    await page.waitForTimeout(1300);
    assert(await page.locator('[data-scene="yarn"].is-active').isVisible(), 'Yarn must wait for explicit Next.');
    assert.equal(await page.evaluate(() => window.playableEvents.filter(e => e.event === 'scene_complete' && e.scene === 'yarn' && e.result === 'yarn_rescued').length), 1);
    await tap(page, '#yarnNext');
    await page.waitForSelector('[data-scene="dad"].is-active');
    assert(await page.locator('#yarnControls').isHidden());
    await page.waitForSelector('[data-scene="dad"].is-ready');
    await tap(page, '#hiddenMouse');
    await page.waitForSelector('#dadNext:visible');
    assert(await page.locator('[data-scene="dad"].is-active').isVisible());
    assert(await page.locator('#yarnControls').isHidden());
    await tap(page, '#dadNext');
    await page.waitForSelector('[data-scene="teddy"].is-active');
    await page.waitForSelector('[data-scene="teddy"].is-ready');
    await page.waitForFunction(() => !document.querySelector('#teddy').disabled);
    await tap(page, '#teddy');
    await page.waitForSelector('#teddyNext:visible');
    await page.waitForTimeout(1300);
    assert(await page.locator('[data-scene="teddy"].is-active').isVisible(), 'Teddy must wait for explicit Next.');
    assert.equal(await page.locator('.teddy-cat').getAttribute('data-pose'), 'frozen');
    await tap(page, '#teddyNext');
    await page.waitForSelector('[data-scene="footprints"].is-active');
    await page.locator('#storyChapter').selectOption('ending');
    await page.waitForSelector('[data-scene="ending"].is-active');
    await shot(page, 'legacy-ending');
    await page.close();

    const sizes = [[320,568], [390,844], [430,932], [568,320], [870,612], [768,1024], [1024,768], [820,1180], [1191,668], [1440,900], [1920,1080], [2560,1440]];
    for (const [width, height] of sizes) {
      const p = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      trackErrors(p);
      await ready(p);
      await checkLayout(p);
      await state(p, 'peek');
      await p.waitForTimeout(500);
      await checkHiddenCorner(p);
      await shot(p, `${width}x${height}`);
      await p.close();
    }
    const keyboard = await browser.newPage({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    trackErrors(keyboard);
    await ready(keyboard);
    await keyboard.locator('#ambushBall').focus();
    await keyboard.keyboard.press('Space');
    await keyboard.waitForFunction(() => window.playableEvents.some(e => e.event === 'ambush_round_complete'));
    assert.equal(await rounds(keyboard), 1);
    assert.deepEqual(errors, []);
    console.log(`PASS: hidden soccer ball corner and 2/3 head ratio, drop-before-pounce, no sock trigger, replay, mute, interrupted drop, keyboard, ambush-to-yarn rescue and explicit Next, legacy scenes, ${sizes.length} viewports; no page errors.`);
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
