const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?lang=zh';
const expected = ['arrival', 'ambush', 'stool', 'yarn', 'dad', 'teddy', 'footprints', 'bedtime', 'morning', 'study', 'departure', 'photos', 'ending'];
const original = { ambush: ['#ambushBall', '#ambushNext'], yarn: ['#featherToy', '#yarnNext'], dad: ['#hiddenMouse', '#dadNext'], teddy: ['#teddy', '#teddyNext'] };
const errors = [];
const active = p => p.locator('.scene.is-active').getAttribute('data-scene');
async function finish(p, id) {
  if (id === 'stool') {
    await p.waitForFunction(() => !document.getElementById('stoolFoot').disabled);
    await p.locator('#stoolFoot').click();
    await p.waitForFunction(() => document.getElementById('storyBoard').dataset.stoolState === 'settled');
  } else if (original[id]) {
    const [target, next] = original[id];
    await p.waitForFunction(selector => !document.querySelector(selector).disabled, target);
    await p.locator(target).click();
    await p.locator(next).waitFor({ state: 'visible' });
  } else if (id === 'ending') {
    await p.locator('#endingCat').focus();
    await p.keyboard.press('Enter');
  } else {
    for (let i = 0; i < 3; i++) await p.locator('#storyActions .primary').click();
  }
}
async function run() {
  const browser = await chromium.launch({ headless: true });
  const output = process.env.STORY_RESULTS || path.join(__dirname, 'results');
  fs.mkdirSync(output, { recursive: true });
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    p.on('pageerror', error => errors.push(error.message));
    p.on('response', r => { if (r.status() >= 400) errors.push(r.url() + ': ' + r.status()); });
    await p.goto(url);
    assert.equal(await active(p), 'arrival');
    assert.equal(await p.locator('.dot').count(),13);
    assert(await p.locator('#storyPrevious').isDisabled());
    assert(await p.locator('#storyForward').isDisabled());
    const order = [];
    for (const id of expected) {
      assert.equal(await active(p), id);
      order.push(id);
      if (id === 'footprints') {
        await p.getByRole('button', { name: '直接追过去', exact: true }).click();
        assert.equal((await p.locator('#storyPrints').textContent()).match(/✿/g).length, 6);
        assert(await p.locator('#storyForward').isDisabled());
      }
      if (id === 'bedtime') {
        assert.equal(await p.getByRole('button', { name: '确认猫已出门，轻轻关门', exact: true }).count(), 0);
        await p.getByRole('button', { name: '再叫它一声', exact: true }).click();
        assert.match(await p.locator('#storyFeedback').textContent(), /翻个身/);
      }
      await finish(p, id);
      if (id !== 'ending') {
        assert(await p.locator('#storyForward').isEnabled(), id + ' completion unlocks next');
        await p.locator('#storyForward').click();
      }
    }
    assert.deepEqual(order, expected);
    assert.equal(await p.locator('.dot.is-done').count(),13);
    assert(await p.locator('#cta').isVisible());
    assert.match(await p.locator('#storyFeedback').textContent(), /今天又捣了什么乱/);
    assert.equal(await p.evaluate(() => window.playableEvents.filter(e => e.event === 'playable_complete').length), 1);
    await p.locator('#endingCat').click();
    assert.equal(await p.evaluate(() => window.playableEvents.filter(e => e.event === 'scene_complete' && e.scene === 'ending').length), 1);
    await p.locator('#cta').click();
    assert.equal(await active(p), 'arrival');
    assert.equal(await p.locator('.dot.is-done').count(), 0);
    assert(await p.locator('#storyForward').isDisabled());
    await p.locator('#storyChapter').selectOption('bedtime');
    await p.locator('#storyActions .primary').click();
    await p.getByRole('button', { name: '重玩本幕', exact: true }).click();
    assert.equal(await p.locator('#storyBoard').getAttribute('data-step'), '0');
    await p.locator('#storyPrevious').click();
    assert.equal(await active(p), 'footprints');
    await p.locator('#storyChapter').selectOption('dad');
    await p.waitForFunction(() => !document.querySelector('#hiddenMouse').disabled);
    await p.locator('#hiddenMouse').click();
    await p.locator('#storyChapter').selectOption('study');
    const before = await p.evaluate(() => window.playableEvents.filter(e => e.event === 'dad_round_complete').length);
    await p.waitForTimeout(1500);
    assert.equal(await p.evaluate(() => window.playableEvents.filter(e => e.event === 'dad_round_complete').length), before, 'Leaving cancels pending original completion');
    for (const [width, height] of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1440,900]]) {
      await p.setViewportSize({ width, height });
      for (const id of ['arrival','stool','footprints','bedtime','morning','study','departure','photos','ending']) {
        await p.locator('#storyChapter').selectOption(id);
        await p.waitForTimeout(50);
        const layout = await p.evaluate(() => {
          const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
          return { panel:rect('storyPanel'), board:rect('storyBoard'), previous:rect('storyPrevious'), next:rect('storyForward'), overflow:document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
            images: [...document.querySelectorAll('#storyPanel img')].filter(i => !i.hidden).every(i => i.complete && i.naturalWidth > 0) };
        });
        assert(!layout.overflow && layout.images, JSON.stringify({width,height,id,layout}));
        for (const box of [layout.panel,layout.board,layout.previous,layout.next]) assert(box.x >= 0 && box.y >= 0 && box.right <= width + 1 && box.bottom <= height + 1 && box.width > 0 && box.height > 0, JSON.stringify({width,height,id,layout}));
        assert(layout.previous.height >= 44 && layout.next.height >= 44);
        if (id === 'stool') await finish(p,id);
        else if (id !== 'ending') {
          for (let i = 0; i < 3; i++) {
            await p.locator('#storyActions .primary').click();
            const actionsFit = await p.locator('#storyActions').evaluate(e => e.getBoundingClientRect().bottom <= innerHeight + 1);
            assert(actionsFit, `${id} step ${i + 1} actions must remain on screen at ${width}x${height}`);
          }
        }
      }
      await p.locator('#storyChapter').selectOption('footprints');
      await p.screenshot({ path:path.join(output, `story-${width}x${height}.png`) });
    }
    await p.goto(url + '&scene=teddy');
    assert.equal(await active(p), 'teddy');
    await p.goto(url + '&scene=unknown');
    assert.equal(await active(p), 'arrival');
    assert.deepEqual(errors, []);
    console.log('PASS: thirteen-chapter full playthrough; four original puzzles; ordered bedtime; footprints feedback; replay, previous, chapter picker, restart; keyboard pet; interrupted controller cleanup; six viewport sizes; preview fallback; no page errors.');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
