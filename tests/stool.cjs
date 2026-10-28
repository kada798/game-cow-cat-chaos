const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=pathToFileURL(path.join(__dirname,'..','index.html')).href;
const state=(p,value)=>p.waitForFunction(value=>document.getElementById('storyBoard').dataset.stoolState===value,value);
const count=(p,event)=>p.evaluate(event=>window.playableEvents.filter(e=>e.scene==='stool'&&e.event===event).length,event);
async function ready(p,lang='zh') {
  await p.goto(base+'?lang='+lang+'&scene=stool');
  await state(p,'guarding');
}
async function play(p) {
  await p.locator('#stoolFoot').click();
  await state(p,'settled');
}
async function run() {
  const browser=await chromium.launch({headless:true});
  const errors=[];
  const output=path.join(__dirname,'results');fs.mkdirSync(output,{recursive:true});
  try {
    const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
    p.on('pageerror',e=>errors.push(e.message));
    await ready(p);
    assert.equal(await p.locator('#storyChapter').inputValue(),'stool');
    assert.match(await p.locator('#progress').getAttribute('aria-label'),/第3幕，共13幕/);
    assert(await p.locator('#storyForward').isDisabled());
    assert.equal(await p.locator('#storyActions .primary').count(),0,'The target is the visible foot, not a text progression button');
    await p.screenshot({path:path.join(output,'stool-guarding.png')});
    await p.locator('#stoolFoot').click();
    await state(p,'withdrawing');
    assert.match(await p.locator('#storyCat').getAttribute('src'),/cat-paw-raised/,'The cat waits for the foot to move before lying down');
    assert(await p.locator('#storyForward').isDisabled());
    await p.locator('#languageSelect').selectOption('fr');
    await state(p,'settled');
    assert(await p.locator('#stoolFoot').isHidden());
    assert.match(await p.locator('#storyCat').getAttribute('src'),/cat-loaf/);
    assert(await p.locator('#storyForward').isEnabled());
    assert.equal(await count(p,'scene_complete'),1);
    assert.equal(await count(p,'stool_foot_withdraw'),1);
    assert.match(await p.locator('#storyFeedback').textContent(),/satisfait/);
    const order=await p.evaluate(()=>window.playableEvents.filter(e=>e.scene==='stool'&&e.event==='stool_state').map(e=>e.state));
    assert.deepEqual(order,['loading','jumping','swatting','guarding','withdrawing','settling','settled']);
    await p.screenshot({path:path.join(output,'stool-settled.png')});
    await p.locator('#storyActions button').last().click();await state(p,'guarding');
    await p.locator('#stoolFoot').focus();await p.keyboard.press('Enter');await state(p,'settled');
    assert.equal(await count(p,'stool_round_complete'),2);
    await p.locator('#storyForward').click();
    assert.equal(await p.locator('.scene.is-active').getAttribute('data-scene'),'yarn');
    await p.locator('#storyChapter').selectOption('stool');await state(p,'guarding');
    await p.locator('#stoolFoot').click();await state(p,'withdrawing');
    await p.locator('#storyChapter').selectOption('study');
    const completed=await count(p,'scene_complete');
    await p.waitForTimeout(1100);
    assert.equal(await count(p,'scene_complete'),completed,'No late completion after leaving');
    assert.equal(await p.locator('#storyTitle').textContent(),'Tu devais me tenir compagnie');
    await p.locator('#storyChapter').selectOption('stool');await state(p,'guarding');
    await p.locator('#stoolFoot').click();await state(p,'withdrawing');
    await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});
    await p.waitForTimeout(1100);assert.equal(await count(p,'scene_complete'),completed);
    await state(p,'guarding');
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
    await play(p);
    assert.equal(await count(p,'scene_complete'),completed+1);
    // Rotation keeps the same in-flight sequence and its one completion.
    await p.locator('#storyActions button').last().click();await state(p,'guarding');
    await p.locator('#stoolFoot').click();await state(p,'withdrawing');
    await p.setViewportSize({width:844,height:390});await state(p,'settled');
    assert.equal(await count(p,'scene_complete'),completed+2);
    await p.close();
    const q=await browser.newPage({reducedMotion:'reduce'});
    q.on('pageerror',e=>errors.push(e.message));
    for(const lang of ['zh','en','fr'])for(const [width,height]of [[320,568],[390,844],[568,320],[844,390],[1024,768],[1440,900]]) {
      await q.setViewportSize({width,height});await ready(q,lang);
      const geometry=await q.evaluate(()=>{
        const b=document.getElementById('storyBoard').getBoundingClientRect();
        const f=document.getElementById('stoolFoot').getBoundingClientRect();
        const size=parseFloat(document.getElementById('storyBoard').style.getPropertyValue('--stool-cat-size'));
        const toe={x:f.left+size*.65*86/256,y:f.top+size*.975*341/384};
        return {inBoard:toe.x>b.left&&toe.x<b.right&&toe.y>b.top&&toe.y<b.bottom,hit:f.width>=44&&f.height>=44,
          target:document.elementFromPoint(toe.x,toe.y)?.closest('button')?.id};
      });
      assert(geometry.inBoard&&geometry.hit&&geometry.target==='stoolFoot',JSON.stringify({lang,width,height,geometry}));
      await q.screenshot({path:path.join(output,`stool-${lang}-${width}x${height}.png`)});
      await play(q);assert(await q.locator('#storyForward').isEnabled());
    }
    // Decode failure can retry through the actual replay action.
    await q.addInitScript(()=>{const original=HTMLImageElement.prototype.decode;window.restoreDecode=()=>HTMLImageElement.prototype.decode=original;HTMLImageElement.prototype.decode=function(){return Promise.reject(new Error('Test image decode error'))}});
    await q.goto(base+'?lang=zh&scene=stool');await state(q,'error');
    assert(await q.locator('#stoolFoot').isDisabled());assert(await q.locator('#storyForward').isDisabled());
    await q.evaluate(()=>window.restoreDecode());
    await q.getByRole('button',{name:'重玩本幕',exact:true}).click();await state(q,'guarding');await play(q);
    assert.deepEqual(errors,[]);
    console.log('PASS: stool is chapter 3 of 13; click-foot ordered withdrawal before rest; replay/keyboard; live language switch; leave/hidden cancellation; rotation; decode retry; three languages × six viewports; visible toe target; no page errors.');
  }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
