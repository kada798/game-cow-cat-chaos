const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sharp = require('sharp');
const art = require('../assets/art-v1/manifest.json').assets;
const imageData = new Map();
function pixels(id) {
  if (!imageData.has(id)) imageData.set(id, sharp(path.join(__dirname, '../assets/art-v1', art[id].file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  return imageData.get(id);
}

async function checkPerch(p, id) {
  const root = await p.locator('.dad-perched-cat').evaluate(e => {
    const s = getComputedStyle(e);
    return { x: parseFloat(s.left), y: parseFloat(s.top), size: parseFloat(getComputedStyle(e.closest('.dad-scene')).getPropertyValue('--dad-cat-size')) };
  });
  const cat = await pixels(id), sofa = await pixels('sofa-back');
  const ranges = id === 'cat-stand' ? [[95,175],[330,400]] : [[180,255],[260,310]];
  for (const [left, right] of ranges) {
    let toe;
    for (let y = 400; y < 480; y++) for (let x = left; x <= right; x++) {
      const i = (y * cat.info.width + x) * 4;
      if (cat.data[i + 3] > 180 && Math.min(...cat.data.subarray(i, i + 3)) > 120) toe = { x, y: y + 1 };
    }
    assert(toe, 'Missing white foot in the support sample.');
    const worldX = root.x + (toe.x - 256) * root.size / 512;
    const worldY = root.y + (toe.y - 448) * root.size / 512;
    const column = Math.round((worldX - 10) * 1024 / 560);
    let surface;
    for (let y = 0; y < sofa.info.height; y++) if (sofa.data[(y * sofa.info.width + column) * 4 + 3] > 180) { surface = 385 + y * 560 / 1024; break; }
    const gap = surface - worldY;
    assert(gap >= -11 && gap <= 1, id + ' must rest on the upholstered top, not float or sink deeply: ' + gap);
  }
}
const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?scene=dad&lang=zh';
const output = path.join(__dirname, 'results');
const sizes = [[320,568],[390,844],[430,932],[568,320],[870,612],[768,1024],[1024,768],[820,1180],[1191,668],[1440,900],[1920,1080],[2560,1440]];
const state = (p, s) => p.waitForFunction(s => document.querySelector('.dad-scene').dataset.state === s, s);
const events = p => p.evaluate(() => window.playableEvents.filter(e => e.scene === 'dad'));
const count = async (p, name) => (await events(p)).filter(e => e.event === name).length;
const shot = (p, name) => p.screenshot({ path: path.join(output, 'dad-' + name + '.png') });
const finished = (p, n) => p.waitForFunction(n => window.playableEvents.filter(e => e.event === 'dad_round_complete').length === n, n);

async function ready(p) {
  await p.goto(url);
  await p.waitForSelector('.dad-scene.is-ready');
  await p.waitForFunction(() => !document.querySelector('#hiddenMouse').disabled && getComputedStyle(document.querySelector('.dad-rig')).opacity === '1');
}

async function tap(p, selector) {
  const b = await p.locator(selector).boundingBox();
  await p.touchscreen.tap(b.x + b.width * .18, b.y + b.height * .5);
}

async function checkLayout(p) {
  const m = await p.evaluate(() => {
    const box = e => {
      const r = (typeof e === 'string' ? document.querySelector(e) : e).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const b = document.querySelector('#hiddenMouse');
    const r = b.getBoundingClientRect();
    return {
      width: innerWidth, height: innerHeight, frame: box('#gameFrame'), stage: box('#game'), hud: box('.hud'),
      mouse: box(b), hit: box(b.querySelector('.hit-area')), person: box('.dad-person'), controls: box('#dadControls'),
      television: box('.dad-television'), personImage: box('.dad-person-watch'),
      target: document.elementFromPoint(r.x + r.width * .18, r.y + r.height * .5)?.closest('button') === b,
      loaded: [...document.querySelectorAll('.dad-scene img')].every(i => i.complete && i.naturalWidth > 0),
      overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      textFits: ['.title','.hint'].every(s => { const e = document.querySelector(s); return e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1; })
    };
  });
  for (const r of [m.frame, m.stage]) assert(Math.abs(r.x) < .3 && Math.abs(r.y) < .3 && Math.abs(r.width - m.width) < .3 && Math.abs(r.height - m.height) < .3);
  assert(m.loaded && !m.overflow && m.textFits && m.target, JSON.stringify(m));
  assert(m.hit.width >= 43.8 && m.hit.height >= 43.8);
  for (const r of [m.mouse, m.person, m.controls]) assert(r.x >= 0 && r.right <= m.width + .5 && r.y > m.hud.bottom && r.bottom <= m.height, JSON.stringify(m));
  const tv = art['media-tv-side'], person = art['dad-bald-watch'];
  const tvLeft = m.television.x + tv.bounds[0] / tv.width * m.television.width;
  const tvRight = m.television.x + tv.bounds[2] / tv.width * m.television.width;
  const dadLeft = m.personImage.x + person.bounds[0] / person.width * m.personImage.width;
  const scale = m.person.width / 246;
  assert(tvLeft >= 0 && tvRight < m.width && dadLeft - tvRight >= 20 * scale, 'The side-facing TV needs a visible viewing gap: ' + JSON.stringify(m));
  assert.equal(tv.screenFaces, 'right');
  assert.match(await p.locator('.dad-television').getAttribute('src'), /media-tv-side\.png$/);
  await checkPerch(p, 'cat-stand');
}

async function tailPixels(p) {
  const r = await p.locator('#hiddenMouse').boundingBox();
  const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width) + 1, height: Math.ceil(r.height) + 1 };
  const before = await p.screenshot({ clip });
  await p.locator('#hiddenMouse').evaluate(e => { e.style.visibility = 'hidden'; });
  const after = await p.screenshot({ clip });
  await p.locator('#hiddenMouse').evaluate(e => { e.style.visibility = ''; });
  const a = await sharp(before).removeAlpha().raw().toBuffer(), b = await sharp(after).removeAlpha().raw().toBuffer();
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) if (Math.max(...[0,1,2].map(c => Math.abs(a[i + c] - b[i + c]))) > 15) changed++;
  assert(changed > 2 && changed < r.width * r.height * .15, 'Only the discoverable tail should show: ' + changed);
}

async function story(p) {
  await ready(p);
  assert.match(await p.title(), /游戏：奶牛猫大作战.*Moo Cat Mayhem/);
  assert.equal(await p.locator('.title').innerText(), '奶牛猫大作战');
  assert(await p.locator('#dadNext').isHidden());
  assert(await p.locator('#dadReplay').isHidden());
  await checkLayout(p);
  await tailPixels(p);
  await p.waitForFunction(() => window.playableEvents.filter(e => e.event === 'dad_head_tap').length >= 2);
  assert.equal(await count(p, 'scene_complete'), 0, 'Idle taps have no countdown or failure.');
  await state(p, 'raising');
  await shot(p, 'paw-raised');
  await state(p, 'tapping');
  await p.evaluate(() => {
    const a = document.querySelector('.dad-perched-cat').getAnimations()[0];
    a.pause(); a.currentTime = 279;
  });
  const distance = await p.evaluate(() => {
    const cat = document.querySelector('.dad-perched-cat');
    const matrix = new DOMMatrix(getComputedStyle(cat).transform);
    const paw = new DOMPoint((66 - 256) * 160 / 512, (260 - 448) * 160 / 512).matrixTransform(matrix);
    const root = getComputedStyle(cat), dad = getComputedStyle(document.querySelector('.dad-person'));
    return Math.hypot(parseFloat(root.left) + paw.x - (parseFloat(dad.left) + 551 * parseFloat(dad.width) / 768),
      parseFloat(root.top) + paw.y - (parseFloat(dad.top) + 115 * parseFloat(dad.height) / 1024));
  });
  assert(distance < 14, 'The paw must meet the bald scalp, not tap empty space: ' + distance);
  await shot(p, 'scalp-contact');
  await p.evaluate(() => document.querySelector('.dad-perched-cat').getAnimations()[0].play());
  await state(p, 'innocent');
  assert.equal(await p.locator('.dad-person').getAttribute('data-pose'), 'react');
  await checkPerch(p, 'cat-sit');
  await shot(p, 'dad-reacts');
  await tap(p, '#hiddenMouse');
  await state(p, 'revealing');
  assert.deepEqual(await p.evaluate(() => window.dadTestAudio), { created: 1, played: 0 });
  for (let i = 0; i < 3; i++) await tap(p, '#hiddenMouse');
  await state(p, 'noticing');
  assert.equal(await count(p, 'dad_mouse_revealed'), 1);
  assert.equal(await count(p, 'dad_mouse_squeak'), 1);
  assert.equal(await count(p, 'dad_trigger'), 1);
  assert.equal(await p.locator('.dad-scene').getAttribute('data-toy'), 'active');
  await shot(p, 'mouse-revealed');
  await state(p, 'chasing');
  const toyOrigin = await p.locator('#hiddenMouse').evaluate(e => e.style.left);
  await p.setViewportSize({ width: 844, height: 390 });
  assert.equal(await p.locator('#hiddenMouse').evaluate(e => e.style.left), toyOrigin, 'Resize must not move the discovered toy origin.');
  await state(p, 'jumping');
  await shot(p, 'jump');
  await state(p, 'relieved');
  await finished(p, 1);
  const landing = await p.locator('.dad-perched-cat').evaluate(e => {
    const r = e.getBoundingClientRect();
    return window.playableViewport.toScenePoint(r.x, r.y);
  });
  assert(Math.abs(landing.x - 185) < .1 && Math.abs(landing.y - 720) < .1, 'Lowering the perch must preserve the floor landing.');
  await p.waitForTimeout(1400);
  assert(await p.locator('.dad-scene.is-active').isVisible(), 'Success must wait for explicit Next.');
  assert(await p.locator('#dadNext').isVisible());
  assert.equal(await p.locator('.dad-person').getAttribute('data-pose'), 'watch');
  const order = (await events(p)).filter(e => e.event === 'dad_state' && ['revealing','noticing','chasing','jumping','relieved','rescued'].includes(e.state)).map(e => e.state);
  assert.deepEqual(order, ['revealing','noticing','chasing','jumping','relieved','rescued']);
  assert.deepEqual(await p.evaluate(() => window.dadTestAudio), { created: 1, played: 2 });
  await shot(p, 'rescued');
  await p.locator('#dadSound').uncheck();
  await tap(p, '#dadReplay');
  await state(p, 'watching');
  assert.equal(await p.locator('.dad-scene').getAttribute('data-toy'), 'hidden');
  assert.equal(await p.locator('#hiddenMouse').evaluate(e => e.style.left), '');
  await tap(p, '#hiddenMouse');
  await finished(p, 2);
  assert.equal(await count(p, 'scene_complete'), 1);
  assert.equal(await count(p, 'dad_mouse_squeak'), 1);
  await tap(p, '#dadNext');
  await p.waitForSelector('[data-scene="teddy"].is-active');
  assert(await p.locator('#dadControls').isHidden());
}

async function interruptions(p) {
  await ready(p);
  await p.locator('#dadSound').uncheck();
  for (const phase of ['revealing','chasing','jumping','relieved']) {
    await tap(p, '#hiddenMouse');
    await state(p, phase);
    await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(1900);
    assert.equal(await count(p, 'dad_round_complete'), 0);
    assert.equal(await p.locator('.dad-scene').getAttribute('data-toy'), 'hidden');
    await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await state(p, 'watching');
  }
  await tap(p, '#hiddenMouse');
  await state(p, 'jumping');
  await p.evaluate(() => showScene(window.catStory.findIndex(scene => scene.id === 'teddy')));
  await p.waitForTimeout(1900);
  assert.equal(await count(p, 'scene_complete'), 0);
  assert.equal(await p.locator('.dad-scene').evaluate(e => e.getAnimations({ subtree: true }).length), 0);
}

async function loading(p) {
  await p.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    window.dadDecode = { release, fail: true, restore: () => { HTMLImageElement.prototype.decode = original; } };
    HTMLImageElement.prototype.decode = async function(...args) {
      if (this.closest('.dad-scene')) { await gate; if (window.dadDecode.fail) throw new Error('Test image failure'); }
      return original.apply(this, args);
    };
  });
  await p.goto(url);
  await state(p, 'loading');
  assert(await p.locator('#hiddenMouse').isDisabled());
  assert(await p.locator('#dadNext').isHidden());
  await p.evaluate(() => window.dadDecode.release());
  await state(p, 'error');
  assert(await p.locator('#dadReplay').isEnabled());
  await p.evaluate(() => window.dadDecode.restore());
  await tap(p, '#dadReplay');
  await state(p, 'watching');
  await tap(p, '#hiddenMouse');
  await finished(p, 1);
}

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const withPage = async (name, options, test) => {
    const p = await browser.newPage({ viewport: { width:390, height:844 }, hasTouch:true, ...options });
    p.setDefaultTimeout(18000);
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => {
      window.dadTestAudio = { created:0, played:0 };
      const Native = window.AudioContext;
      window.AudioContext = class extends Native {
        constructor(...args) { super(...args); window.dadTestAudio.created++; }
        createOscillator() { window.dadTestAudio.played++; return super.createOscillator(); }
      };
    });
    try { await test(p); assert.deepEqual(errors, []); console.log('PASS: dad ' + name); }
    catch (e) { await shot(p, 'failure-' + name); console.error(await events(p)); throw e; }
    finally { await p.close(); }
  };
  try {
    await withPage('story-audio-replay', {}, story);
    await withPage('interruptions', {}, interruptions);
    await withPage('loading-retry', {}, loading);
    await withPage('keyboard-reduced', { hasTouch:false, reducedMotion:'reduce' }, async p => {
      await ready(p); await p.locator('#hiddenMouse').focus(); await p.keyboard.press('Space'); await finished(p,1);
      await p.locator('#dadReplay').focus(); await p.keyboard.press('Enter'); await state(p,'watching');
      await p.locator('#hiddenMouse').focus(); await p.keyboard.press('Enter'); await finished(p,2);
      assert.equal(await count(p,'scene_complete'),1);
    });
    for (const [width,height] of sizes) await withPage(width + 'x' + height, { viewport:{width,height} }, async p => {
      await ready(p); await checkLayout(p); await tailPixels(p); await shot(p,width + 'x' + height);
    });
    console.log('PASS: side-facing TV viewing gap, opaque foot/sofa support, scalp contact, fixed landing, hidden-tail pixels, reveal-before-squeak, chase, replay, mute, cancellation, loading retry, keyboard/reduced motion, 12 viewports; no page errors.');
  } finally { await browser.close(); }
}
run().catch(e => { console.error(e); process.exitCode=1; });
