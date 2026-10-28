const { chromium } = require('playwright');
const sharp = require('sharp');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const art = require('../assets/art-v1/manifest.json').assets;
const output = path.join(__dirname, 'results');
const url = pathToFileURL(path.join(root, 'index.html')).href + '?scene=teddy&lang=zh';
const sizes = [[320,568],[390,844],[430,932],[486,668],[568,320],[870,612],[768,1024],[1024,768],[820,1180],[1191,668],[1440,900],[1920,1080],[2560,1440]];
const state = (p, s) => p.waitForFunction(s => document.querySelector('.teddy-scene').dataset.state === s, s);
const events = p => p.evaluate(() => window.playableEvents.filter(e => e.scene === 'teddy'));
const count = async (p, name) => (await events(p)).filter(e => e.event === name).length;
const shot = (p, name) => p.screenshot({ path: path.join(output, 'teddy-' + name + '.png') });
const finished = (p, n) => p.waitForFunction(n => window.playableEvents.filter(e => e.event === 'teddy_round_complete').length === n, n);
async function ready(p) {
  await p.goto(url);
  await p.waitForSelector('.teddy-scene.is-ready');
  await state(p, 'kneading');
  await p.waitForFunction(() => getComputedStyle(document.querySelector('.teddy-rig')).opacity === '1');
}
async function tap(p, selector) {
  const b = await p.locator(selector).boundingBox();
  await p.touchscreen.tap(b.x + b.width * .4, b.y + b.height * .4);
}
async function layout(p, frozen = false) {
  const m = await p.evaluate(() => {
    const box = e => {
      const r = (typeof e === 'string' ? document.querySelector(e) : e).getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
    };
    const bear = document.querySelector('#teddy'), r = bear.getBoundingClientRect();
    return {
      width:innerWidth, height:innerHeight, frame:box('#gameFrame'), stage:box('#game'), hud:box('.hud'), controls:box('#teddyControls'),
      bear:box(bear), hit:box(bear.querySelector('.hit-area')),
      bed:box('.teddy-bed-back'), dad:box('.teddy-dad'), girl:box('.teddy-girl'), cat:box('.teddy-cat-frozen'),
      catSource:document.querySelector('.teddy-cat-frozen').getAttribute('src'),
      loaded:[...document.querySelectorAll('.teddy-scene img')].every(e => e.complete && e.naturalWidth > 0),
      overflow:document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
      target:document.elementFromPoint(r.x + r.width * .4, r.y + r.height * .4)?.closest('button') === bear,
      textFits:['.title','.hint'].every(s => { const e = document.querySelector(s); return e.scrollWidth <= e.clientWidth+1 && e.scrollHeight <= e.clientHeight+1; })
    };
  });
  for (const r of [m.frame,m.stage]) assert(Math.abs(r.x)<.3 && Math.abs(r.y)<.3 && Math.abs(r.width-m.width)<.3 && Math.abs(r.height-m.height)<.3);
  assert(m.loaded && !m.overflow && m.textFits, JSON.stringify(m));
  if (!frozen) assert(m.target);
  assert(m.hit.width >= 43.8 && m.hit.height >= 43.8);
  for (const r of [m.bear,m.dad,m.girl,m.controls]) assert(r.x>=0 && r.right<=m.width+.5 && r.y>m.hud.bottom && r.bottom<=m.height, JSON.stringify(m));
  const bed = art['cat-bed-complete'];
  const bedBottom = m.bed.y + bed.bounds[3] / bed.height * m.bed.height;
  assert(bedBottom <= m.controls.y + 1, 'Visible bed must not overlap bottom controls.');
  const visibleTop = m.cat.y + art['cat-knead'].bounds[1] / 512 * m.cat.height;
  assert(visibleTop > m.hud.bottom);
  assert.equal(m.catSource, 'assets/art-v1/cats/cat-knead.png', 'Freeze must retain the approved markings and proportions.');
  const roomScale = Math.max(m.width / 1672, m.height / 941);
  const roomLeft = (m.width - 1672 * roomScale) / 2;
  const roomTop = (m.height - 941 * roomScale) / 2;
  const visibleBedLeft = m.bed.x + bed.bounds[0] / bed.width * m.bed.width;
  const visibleBedRight = m.bed.x + bed.bounds[2] / bed.width * m.bed.width;
  const ground = (box, id) => {
    const asset = art[id];
    const x = box.x + asset.anchor[0] / asset.width * box.width;
    const y = box.y + asset.anchor[1] / asset.height * box.height;
    const sourceX = (x - roomLeft) / roomScale;
    const floorY = roomTop + (606 + Math.max(0, sourceX - 1386) * .238) * roomScale;
    assert(y >= floorY + 3, id + ' must meet the wooden floor, not the wall: ' + JSON.stringify({x,y,floorY}));
    assert(y < m.controls.y, id + ' must stay above the controls.');
    assert(x < visibleBedLeft || x > visibleBedRight, id + ' must sit beside the bed, not behind it.');
    return y;
  };
  const dadFloor = ground(m.dad, 'dad-crouch');
  ground(m.girl, 'girl-kneel');
  if (m.width < m.height) {
    const girlTop = m.girl.y + art['girl-kneel'].bounds[1] / art['girl-kneel'].height * m.girl.height;
    assert(girlTop > dadFloor + 3, 'The girl must not cover the dad foot contact on portrait screens.');
  }
}
async function contact() {
  const head = await sharp(path.join(root,'assets/art-v1',art['white-teddy-head'].file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const bed = await sharp(path.join(root,'assets/art-v1',art['cat-bed-back'].file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for (const id of ['knead-paw-far','knead-paw-near']) {
    const paw = await sharp(path.join(root,'assets/art-v1',art[id].file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for (const offset of [-3,3]) {
      let overlap=0;
      for (let y=0;y<512;y++) for(let x=0;x<512;x++) if (paw.data[(y*512+x)*4+3]>180) {
        const wx=210+(x-256)*360/512, wy=662+(y-448)*360/512+offset;
        const bx=Math.floor((wx-20)*768/250), by=Math.floor((wy-552)*512/(250*512/768));
        if(bx>=0&&bx<768&&by>=0&&by<512&&head.data[(by*768+bx)*4+3]>180) overlap++;
      }
      assert(overlap>50, id+' must overlap the teddy face at both ends of its press: '+overlap);
    }
  }
  for(const [x,y] of [[279,666],[236,647]]) {
    const bx=Math.floor((x-8)*1024/370), by=Math.floor((y-512)*640/231.25);
    assert(bed.data[(by*1024+bx)*4+3]>180,'Hind paws must be supported by the mattress.');
  }
  assert.deepEqual(art['cat-knead'].anchor,art['cat-frozen'].anchor);
  assert.equal(art['cat-knead'].headWidth,art['cat-frozen'].headWidth);
}
async function frozenStill(p) {
  await p.waitForTimeout(250);
  const before=await p.locator('.teddy-bed').first().screenshot();
  const pulse=await p.locator('.teddy-scene').getAttribute('data-knead');
  await p.waitForTimeout(600);
  const after=await p.locator('.teddy-bed').first().screenshot();
  assert.equal(await p.locator('.teddy-scene').getAttribute('data-knead'),pulse);
  assert((await sharp(before).raw().toBuffer()).equals(await sharp(after).raw().toBuffer()),'The frozen scene must stop kneading, not keep moving behind the final pose.');
}
async function story(p) {
  await ready(p); await layout(p);
  assert.equal(await p.locator('.teddy-audience').getAttribute('aria-hidden'),'true');
  assert(await p.locator('#teddyNext').isHidden());
  const pulse=await p.locator('.teddy-scene').getAttribute('data-knead');
  await p.waitForTimeout(280);
  assert.notEqual(await p.locator('.teddy-scene').getAttribute('data-knead'),pulse);
  const motion=await p.evaluate(() => {
    const y=s=>new DOMMatrix(getComputedStyle(document.querySelector(s)).transform).m42;
    return {far:y('.teddy-paw-far'),near:y('.teddy-paw-near'),body:getComputedStyle(document.querySelector('.teddy-cat-body')).transform,head:new DOMMatrix(getComputedStyle(document.querySelector('.teddy-bear-head')).transform).m22};
  });
  assert(Math.abs(motion.far+motion.near)<.02 && Math.abs(motion.far)>0.05);
  assert.equal(motion.body,'none'); assert(motion.head<1);
  await shot(p,'kneading');
  await tap(p,'#teddy'); await state(p,'calling');
  assert.deepEqual(await p.evaluate(()=>window.teddyTestAudio),{created:1,played:0});
  await state(p,'approaching');
  assert.equal(await count(p,'teddy_squeak'),1);
  assert.equal(await p.locator('.teddy-cat').getAttribute('data-pose'),'knead');
  for(let i=0;i<3;i++) await tap(p,'#teddy');
  assert.equal(await count(p,'teddy_trigger'),1);
  await p.setViewportSize({width:844,height:390});
  await state(p,'watching');
  assert.equal(await p.locator('.teddy-cat').getAttribute('data-pose'),'frozen');
  for(const s of ['.teddy-dad','.teddy-girl']) assert.equal(await p.locator(s).evaluate(e=>getComputedStyle(e).opacity),'1');
  await finished(p,1); await layout(p,true); await frozenStill(p);
  await p.waitForTimeout(1300);
  assert(await p.locator('.teddy-scene.is-active').isVisible(),'No legacy auto-advance.');
  assert.equal(await count(p,'scene_complete'),1);
  assert.deepEqual(await p.evaluate(()=>window.teddyTestAudio),{created:1,played:1});
  const order=(await events(p)).filter(e=>e.event==='teddy_state'&&['calling','approaching','watching','frozen'].includes(e.state)).map(e=>e.state);
  assert.deepEqual(order,['calling','approaching','watching','frozen']);
  await shot(p,'frozen');
  await p.locator('#teddySound').uncheck();
  await tap(p,'#teddyReplay'); await state(p,'kneading');
  assert.equal(await p.locator('.teddy-audience').getAttribute('aria-hidden'),'true');
  for(const s of ['.teddy-dad','.teddy-girl']) assert.equal(await p.locator(s).evaluate(e=>getComputedStyle(e).opacity),'0');
  await tap(p,'#teddy'); await finished(p,2);
  assert.equal(await count(p,'scene_complete'),1); assert.equal(await count(p,'teddy_squeak'),1);
  await tap(p,'#teddyNext'); await p.waitForSelector('[data-scene="footprints"].is-active');
  assert(await p.locator('#teddyControls').isHidden());
  assert.equal(await p.locator('.teddy-scene').evaluate(e=>e.getAnimations({subtree:true}).length),0);
}
async function interrupts(p) {
  await ready(p); await p.locator('#teddySound').uncheck();
  for(const phase of ['calling','approaching','watching']) {
    await tap(p,'#teddy'); await state(p,phase);
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const pulse=await p.locator('.teddy-scene').getAttribute('data-knead');
    await p.waitForTimeout(2300);
    assert.equal(await count(p,'teddy_round_complete'),0);
    assert.equal(await p.locator('.teddy-scene').getAttribute('data-knead'),pulse);
    assert.equal(await p.locator('.teddy-audience').getAttribute('aria-hidden'),'true');
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await state(p,'kneading');
  }
  await tap(p,'#teddy'); await state(p,'approaching'); await p.evaluate(()=>showScene(window.catStory.findIndex(scene => scene.id === 'dad')));
  await p.waitForTimeout(2300);
  assert.equal(await count(p,'scene_complete'),0);
  assert.equal(await p.locator('.teddy-scene').evaluate(e=>e.getAnimations({subtree:true}).length),0);
}
async function loading(p) {
  await p.addInitScript(()=>{
    const original=HTMLImageElement.prototype.decode; let release;
    const gate=new Promise(resolve=>{release=resolve;});
    window.teddyDecode={release,restore:()=>{HTMLImageElement.prototype.decode=original;}};
    HTMLImageElement.prototype.decode=async function(...args){if(this.closest('.teddy-scene')){await gate;throw new Error('Test image failure');}return original.apply(this,args);};
  });
  await p.goto(url); await state(p,'loading');
  assert(await p.locator('#teddy').isDisabled()); assert(await p.locator('#teddyReplay').isDisabled());
  await p.evaluate(()=>window.teddyDecode.release()); await state(p,'error');
  assert(await p.locator('#teddyReplay').isEnabled());
  await p.evaluate(()=>window.teddyDecode.restore()); await tap(p,'#teddyReplay'); await state(p,'kneading');
  await tap(p,'#teddy'); await finished(p,1);
}
async function run() {
  fs.mkdirSync(output,{recursive:true}); await contact();
  const browser=await chromium.launch({headless:true}), errors=[];
  async function withPage(name,opts,test) {
    const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,...opts});
    p.setDefaultTimeout(16000); p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{
      window.teddyTestAudio={created:0,played:0}; const Native=window.AudioContext;
      window.AudioContext=class extends Native {constructor(...a){super(...a);window.teddyTestAudio.created++;}createOscillator(){window.teddyTestAudio.played++;return super.createOscillator();}};
    });
    try{await test(p);assert.deepEqual(errors,[]);console.log('PASS: teddy '+name);}
    catch(e){await shot(p,'failure-'+name);console.error(await events(p));throw e;}
    finally{await p.close();}
  }
  try{
    await withPage('knead-audience-freeze-replay',{},story);
    await withPage('interruptions',{},interrupts);
    await withPage('loading-retry',{},loading);
    await withPage('keyboard-reduced',{hasTouch:false,reducedMotion:'reduce'},async p=>{
      await ready(p); const pulse=await p.locator('.teddy-scene').getAttribute('data-knead'); await p.waitForTimeout(250);
      assert.equal(await p.locator('.teddy-scene').getAttribute('data-knead'),pulse);
      await p.locator('#teddy').focus(); await p.keyboard.press('Space'); await finished(p,1);
      await p.locator('#teddyReplay').focus(); await p.keyboard.press('Enter'); await state(p,'kneading');
      await p.locator('#teddy').focus(); await p.keyboard.press('Enter'); await finished(p,2);
      assert.equal(await count(p,'scene_complete'),1);
    });
    for(const [width,height] of sizes) await withPage(width+'x'+height,{viewport:{width,height}},async p=>{
      await ready(p); await layout(p); await shot(p,width+'x'+height+'-kneading');
      await tap(p,'#teddy'); await finished(p,1); await layout(p,true); await shot(p,width+'x'+height+'-frozen');
    });
    console.log('PASS: teddy paw/face contact, mattress support, grounded side audience, unchanged cat identity, independent alternating paws, head squash, audience-before-freeze, frozen stillness, mute, replay, cancellation, load retry, keyboard/reduced motion and 13 viewports; no page errors.');
  }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
