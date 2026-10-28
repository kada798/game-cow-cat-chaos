const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname,'..');
const base = pathToFileURL(path.join(root,'index.html')).href;
const context = { window:{} };
for (const lang of ['zh','en','fr']) vm.runInNewContext(fs.readFileSync(path.join(root,'locales',lang+'.js'),'utf8'),context);
const catalogs = context.window.catLocales;
const keys = Object.keys(catalogs.zh).sort();
for (const lang of ['en','fr']) {
  assert.deepEqual(Object.keys(catalogs[lang]).sort(),keys);
  for (const key of keys) {
    assert(catalogs[lang][key].trim());
    assert(!/[\u3400-\u9fff]/.test(catalogs[lang][key]), `${lang} missing translation: ${key}`);
    assert.deepEqual(catalogs[lang][key].match(/\{\w+\}/g)||[], catalogs.zh[key].match(/\{\w+\}/g)||[], key+' placeholders');
  }
}
const originals={ambush:['#ambushBall','#ambushNext'],yarn:['#featherToy','#yarnNext'],dad:['#hiddenMouse','#dadNext'],teddy:['#teddy','#teddyNext']};
async function finish(p,id) {
  if (id === 'stool') {
    await p.waitForFunction(() => !document.getElementById('stoolFoot').disabled);
    await p.locator('#stoolFoot').click();
    await p.waitForFunction(() => document.getElementById('storyBoard').dataset.stoolState === 'settled');
  } else if(originals[id]) {
    const [target,next]=originals[id];
    await p.waitForFunction(s=>!document.querySelector(s).disabled,target);
    await p.locator(target).click();
    await p.locator(next).waitFor({state:'visible'});
  } else if(id==='ending') await p.locator('#endingCat').click();
  else for(let i=0;i<3;i++)await p.locator('#storyActions .primary').click();
}
async function cleanLanguage(p,lang) {
  if(lang==='zh')return;
  const leaks=await p.evaluate(()=>{
    const result=[];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const node=walker.currentNode, el=node.parentElement;
      if(!el||el.closest('script,style,option')||!/[\u3400-\u9fff]/.test(node.textContent))continue;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      if(r.width&&r.height&&s.visibility!=='hidden'&&s.display!=='none')result.push(node.textContent.trim());
    }
    for(const el of document.querySelectorAll('[aria-label],[alt],[title]'))for(const attr of ['aria-label','alt','title'])if(/[\u3400-\u9fff]/.test(el.getAttribute(attr)||''))result.push(attr+':'+el.getAttribute(attr));
    return result;
  });
  assert.deepEqual(leaks,[],lang+' must not leak untranslated player text');
}
async function layout(p,lang,id) {
  const result=await p.evaluate(()=>{
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const errors=[];
    for(const e of document.querySelectorAll('#languageSelect,.story-navigation button,.story-navigation select,#storyActions button,.ambush-controls:not([hidden]) button,.ambush-controls:not([hidden]) label')) {
      if(!visible(e))continue;
      const r=e.getBoundingClientRect();
      if(r.left<-.5||r.top<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.height<43.5)errors.push({text:e.textContent,box:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,height:r.height}});
    }
    for(const selector of ['.hint','.brand-row .title']) {
      const e=document.querySelector(selector);
      if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)errors.push({selector,overflow:true});
    }
    const hud=document.querySelector('.hud').getBoundingClientRect();
    const navigation=document.querySelector('.story-navigation').getBoundingClientRect();
    if(navigation.top<hud.bottom)errors.push({overlap:'header/navigation',headerBottom:hud.bottom,navigationTop:navigation.top});
    return errors;
  });
  if(result.length)await p.screenshot({path:path.join(__dirname,'results','i18n-layout-failure.png')});
  assert.deepEqual(result,[],lang+' '+id+' controls must fit');
}
async function run() {
  const browser=await chromium.launch({headless:true});
  const output=path.join(__dirname,'results');fs.mkdirSync(output,{recursive:true});
  const errors=[];
  try {
    if(!process.env.I18N_LAYOUT_ONLY) {
    for(const lang of ['zh','en','fr']) {
      const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',locale:lang==='zh'?'zh-CN':lang+'-'+(lang==='en'?'GB':'FR')});
      p.on('pageerror',e=>errors.push(e.message));
      await p.goto(base+'?lang='+lang);
      assert.equal(await p.locator('html').getAttribute('lang'),lang==='zh'?'zh-CN':lang);
      const ids=await p.evaluate(()=>window.catStory.map(c=>c.id));
      for(const id of ids) {
        assert.equal(await p.locator('.scene.is-active').getAttribute('data-scene'),id);
        await finish(p,id);
        await cleanLanguage(p,lang);
        await layout(p,lang,id);
        if(id!=='ending')await p.locator('#storyForward').click();
      }
      await p.screenshot({path:path.join(output,'i18n-ending-'+lang+'.png')});
      assert.equal(await p.locator('.dot.is-done').count(),13);
      console.log('PASS: '+lang+' full thirteen-chapter playthrough and text coverage');
      // Changes must not re-enter, replay, drop completion, lose paw prints or reset a beat.
      await p.locator('#storyChapter').selectOption('footprints');
      await p.locator('#storyActions button').nth(1).click();
      await p.locator('#storyActions .primary').click();
      const before=await p.evaluate(()=>({step:document.getElementById('storyBoard').dataset.step,prints:document.getElementById('storyPrints').textContent,starts:window.playableEvents.filter(e=>e.event==='scene_start').length}));
      for(const next of ['fr','zh','en'])await p.locator('#languageSelect').selectOption(next);
      const after=await p.evaluate(()=>({step:document.getElementById('storyBoard').dataset.step,prints:document.getElementById('storyPrints').textContent,starts:window.playableEvents.filter(e=>e.event==='scene_start').length}));
      assert.deepEqual(after,before);
      assert.match(await p.locator('#storyFeedback').textContent(),/little earlier/i);
      await p.locator('#storyChapter').selectOption('bedtime');
      await p.locator('#storyActions .primary').click();
      await p.locator('#languageSelect').selectOption('fr');
      assert.equal(await p.locator('#storyBoard').getAttribute('data-step'),'1');
      assert(await p.locator('#storyForward').isDisabled());
      await p.locator('#storyActions .primary').click();await p.locator('#storyActions .primary').click();
      await p.locator('#languageSelect').selectOption('en');
      assert(await p.locator('#storyForward').isEnabled());
      await p.locator('#storyChapter').selectOption('dad');
      await p.waitForFunction(()=>!document.querySelector('#hiddenMouse').disabled);
      await p.locator('#hiddenMouse').click();
      await p.locator('#languageSelect').selectOption('fr');
      await p.locator('#dadNext').waitFor({state:'visible'});
      await cleanLanguage(p,'fr');
      assert.equal(await p.evaluate(()=>window.playableEvents.filter(e=>e.event==='dad_round_complete').length),2);
      await p.close();
    }
    const p=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',locale:'fr-FR'});
    await p.goto(base);assert.equal(await p.locator('html').getAttribute('lang'),'fr');
    await p.locator('#languageSelect').selectOption('en');
    await p.goto(base);assert.equal(await p.locator('html').getAttribute('lang'),'en');
    await p.goto(base+'?lang=zh&scene=bedtime');assert.equal(await p.locator('html').getAttribute('lang'),'zh-CN');
    await p.goto(base+'?lang=invalid');assert.equal(await p.locator('html').getAttribute('lang'),'en');
    await p.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}})});
    await p.goto(base+'?lang=fr');await p.locator('#languageSelect').selectOption('en');assert.equal(await p.locator('html').getAttribute('lang'),'en');
    await p.close();
    }
    const responsive=await browser.newPage({reducedMotion:'reduce'});
    responsive.on('pageerror',e=>errors.push(e.message));
    const languages=process.env.I18N_LANGS?process.env.I18N_LANGS.split(','):['zh','en','fr'];
    const sizes=process.env.I18N_SIZES?JSON.parse(process.env.I18N_SIZES):[[320,568],[390,844],[568,320],[844,390],[1024,768],[1440,900]];
    for(const lang of languages)for(const [width,height] of sizes) {
      await responsive.setViewportSize({width,height});
      await responsive.goto(base+'?lang='+lang);
      for(const id of ['arrival','stool','footprints','bedtime','morning','study','departure','photos','ending']) {
        await responsive.locator('#storyChapter').selectOption(id);
        await layout(responsive,lang,id);
        if(id==='stool')await finish(responsive,id);
        else if(id!=='ending')for(let i=0;i<3;i++){await responsive.locator('#storyActions .primary').click();await layout(responsive,lang,id+' step'+i);}
      }
      for(const id of Object.keys(originals)) {
        await responsive.locator('#storyChapter').selectOption(id);
        await responsive.waitForFunction(s=>!document.querySelector(s).disabled,originals[id][0]);
        await finish(responsive,id);await layout(responsive,lang,id);
      }
      await responsive.locator('#storyChapter').selectOption('bedtime');
      await responsive.screenshot({path:path.join(output,`i18n-${lang}-${width}x${height}.png`)});
      console.log(`PASS: ${lang} layout ${width}x${height}`);
    }
    assert.deepEqual(errors,[]);
    console.log(process.env.I18N_LAYOUT_ONLY
      ? `PASS: ${keys.length} matching catalog keys and placeholders; selected responsive layouts; no page errors.`
      : `PASS: ${keys.length} matching catalog keys, placeholders, browser/saved/URL precedence, denied storage, live switches preserve beats/progress/prints and original animation; no page errors.`);
  }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
