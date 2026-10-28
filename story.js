/* Story spine. Original controllers remain the authority for their puzzles. */
(() => {
  const I = window.catI18n;
  const chapters = [
    { id: 'arrival', title: '床底下的新住户', phase: '刚刚认识 · 四个月', kind: 'play', source: '真实经历；互动节奏为改编',
      hint: '床底下，露出一双眼睛。', caption: '今天，出来了一点点。', cat: 'cat-under-sofa', theme: 'bed', size: 'kitten',
      shots: ['搬猫的箱子打开，房间里却找不到猫。', '床底伸出一只白爪，碰了碰玩具。', '它探出半个身子，又悄悄退回去。'],
      beats: [
        ['把玩具放到床边', '它看见了。先停一停，让它自己靠近。', 'watch'],
        ['轻轻晃一下，再等等', '一只白爪伸出来，轻轻碰了碰玩具。', 'peek'],
        ['把玩具挪近一点', '它终于探出半个身子。今天，出来了一点点。', 'out']
      ], plan: '正式版拖动玩具，以移动速度和停顿影响试探；本版用三步点按验证节奏。' },
    { id: 'ambush', title: '沙发底下，有动静', phase: '刚刚认识 · 开始调皮', kind: 'original', source: '原第1幕，真实事件，保留现有玩法',
      hint: '沙发底下，好像有动静。', complete: 'ambush_played', caption: '又躲回去了。',
      shots: ['女孩看书，书边藏着小足球，猫在沙发底下埋伏。', '发现足球，让球落稳；猫探头、伏低。', '猫扑出拍球，再退回沙发底下。'], plan: '保留寻找隐藏足球、落球后扑击、重玩与明确下一幕。' },
    { id: 'stool', title: '这凳子归我了', phase: '奶牛猫大作战', kind: 'play', interaction: 'stool',
      source: '真实经历：脚搭在猫平时睡觉的凳子上，猫跳起来拍脚；移开后满意趴下。',
      hint: '脚刚放上去，小乐就跳起来拍了。', caption: '行行行，你的凳子。', cat: 'cat-pounce', theme: 'stool', size: 'growing',
      shots: ['脚搭在小乐平时睡觉的凳子上。', '小乐跳上凳子，抬爪拍脚，盯着占位的人。', '玩家点击脚把脚移开；小乐满意地趴下，收回凳子。'],
      beats: [], plan: '直接点击画面中的脚；脚移出后才趴下并完成。支持重玩、键盘、减少动态效果与切走取消。' },
    { id: 'yarn', title: '毛线团保卫战', phase: '奶牛猫大作战', kind: 'original', source: '原第2幕，真实事件，保留现有玩法',
      hint: '毛线怎么又散了一地……', complete: 'yarn_rescued', caption: '毛线团，得救了。',
      shots: ['小乐抱着毛线，边蹬边扯。', '直接拿毛线，它护住不肯松爪。', '羽毛铃铛引开猫，趁机收好毛线。'], plan: '保留错误目标反馈、露角玩具、铃声与收线。' },
    { id: 'dad', title: '爸爸的光头，暂时安全', phase: '奶牛猫大作战', kind: 'original', source: '原第3幕，真实事件，保留现有玩法',
      hint: '希小乐，又盯上爸爸的光头了。', complete: 'dad_distracted', caption: '爸爸的光头，暂时安全了。',
      shots: ['爸爸看电视，猫从沙发靠背靠近。', '轻拍光头，爸爸回望，猫假装无辜。', '发现柜下玩具老鼠，猫跳下追逐。'], plan: '保留偷拍循环、隐藏尾巴、发条老鼠与无倒计时设计。' },
    { id: 'teddy', title: '白熊受难记', phase: '奶牛猫大作战', kind: 'original', source: '原第4幕，真实事件，保留现有玩法',
      hint: '白熊的脸，又成了小乐的踏板。', complete: 'teddy_rescued', caption: '被发现了！',
      shots: ['猫在小床上交替踩白熊的脸。', '白熊吱了一声，爸爸和女孩过来围观。', '猫突然停爪，一脸无事发生。'], plan: '保留白熊触发、家人围观、冻结姿态和重玩。' },
    { id: 'footprints', title: '白床单上的黑梅花', phase: '奶牛猫大作战', kind: 'play', source: '真实经历；路线和反馈为改编',
      hint: '白床单上，怎么多了一串黑梅花？', caption: '门只开了一条缝。它说够了。', cat: 'cat-crouch', theme: 'prints', size: 'growing',
      shots: ['白床单特写，一串黑脚印；倒回稍早。', '房门留缝，猫趁人转身溜进来。', '绕家具引出猫，床单留下罪证。'],
      beats: [ ['看看床单上的罪证', '稍早：门才开一条缝，它已经溜进来了。', 'sneak'], ['用玩具引到椅子旁', '它绕过床边，跟着玩具探出头。', 'chair'], ['把玩具移向门口', '终于出来了。原来的那串黑梅花，还留在床单上。', 'door'] ],
      extra: ['直接追过去', '它绕回床边，又留下两朵黑梅花。试试用玩具带路。'], plan: '正式版按家具布局引导路线，追赶会增加脚印；本版保留追赶反馈和三段路线。' },
    { id: 'bedtime', title: '睡前请猫出门', phase: '奶牛猫大作战', kind: 'play', source: '真实经历；具体反应顺序为改编',
      hint: '人要睡了，猫还不想走。', caption: '今晚，人类险胜。', cat: 'cat-recline', theme: 'night', size: 'growing',
      shots: ['猫占着卧室，不肯出来。', '一路撒零食，它吃一颗走一步。', '门口停住，换用玩具引出，再关门。'],
      beats: [ ['撒一小段零食', '它吃一颗，走一步。到了门口，却停住了。', 'threshold'], ['换逗猫棒，引到门外', '耳朵动了！它终于跟着玩具走到了门外。', 'outside'], ['确认猫已出门，轻轻关门', '门关好了。今晚，人类险胜。', 'closed'] ],
      extra: ['再叫它一声', '它看了你一眼，翻个身。看来得换个办法。'], plan: '正式版布置零食路线、观察偏好、配合玩具并判断关门时机；本版是可验证顺序的点按骨架。' },
    { id: 'morning', title: '脚边的小尾巴', phase: '原来这么黏人', kind: 'play', source: '真实经历；误碰不作为操作目标',
      hint: '这么小一只，偏要贴着脚边走。', caption: '慢一点，我们一起走。', cat: 'cat-walk', theme: 'morning', size: 'kitten',
      shots: ['清晨端东西，猫一直贴着脚边走。', '回忆那次没留意的误碰，放下东西查看它。', '它又贴过来；这次放慢脚步一起走。'],
      beats: [ ['放下东西，蹲下来', '想起那次没留意碰到它。你赶紧查看，它又黏了回来。', 'check'], ['等它走到前面', '小尾巴终于走在前面。先看清它的位置。', 'ahead'], ['留出距离，慢慢跟上', '它回头看你一眼，又往前走了两步。', 'walk'] ], plan: '正式版停步、观察和安全通过；本版三步互动，不重演撞飞。此幕为早期回忆，体型回到幼猫。' },
    { id: 'study', title: '说好陪我学习', phase: '原来这么黏人', kind: 'play', source: '陪学习、打瞌睡、看电视与蹭手为真实经历；操作为改编',
      hint: '书刚打开，它也来占个位置。', caption: '它说陪我。然后先睡了。', cat: 'cat-loaf', theme: 'study', size: 'growing',
      shots: ['猫压着书页，又盯上笔尖。', '移开笔，腾出位置，猫慢慢睡着。', '陪看电视的回忆；它把头送进掌心。'],
      beats: [ ['把笔移到一旁', '笔尖挪走了，它的视线也跟过去。', 'pen'], ['给它腾一块位置', '它挨着书趴好，眼睛慢慢眯起来。', 'sleep'], ['翻一页书，摸摸它的头', '它把头蹭进掌心。后来，看电视时也总这样挨着你。', 'pet'] ], plan: '正式版保留轻量桌面互动与陪伴蒙太奇；本版不加压力或倒计时。' },
    { id: 'departure', title: '今天要出远门', phase: '离家之前', kind: 'narrative', source: '离家为真实背景；行李与玩具摆放是创作桥段',
      hint: '房间里，多了一只行李箱。', caption: '它的玩具，都留在家里。', cat: 'cat-sit', theme: 'luggage', size: 'growing',
      shots: ['行李箱打开，猫过来检查。', '足球、羽毛棒和玩具老鼠唤起前面几幕。', '留下玩具，关门；画面转向手机。'],
      beats: [ ['收好要带走的东西', '小乐还在旁边检查。它以为今天也会一起玩。', 'pack'], ['把它的玩具留在家里', '足球、羽毛棒、小老鼠，都放回熟悉的位置。', 'toys'], ['再看一眼房间', '门轻轻关上。过了一阵，手机里传来它的新照片。', 'leave'] ], plan: '整理与回看，不评分；猫不被描写成懂得离别。' },
    { id: 'photos', title: '屏幕里的十二斤', phase: '2026年10月28日 · 离家十三个月', kind: 'narrative', source: '日期、十三个月与十二斤均来自真实背景；本版用复用插画代替真实照片',
      hint: '同一个玩具，身边的猫越来越大。', caption: '怎么长这么大了。', cat: 'cat-sit', theme: 'phone', size: 'adult',
      shots: ['点开手机里的近况。', '同样的足球和小床，对照幼猫与成年体型。', '日期停在2026年10月28日：离家十三个月，十二斤。'],
      beats: [ ['翻到它刚来时', '四个月，小小一只，床底的阴影就能把它藏起来。', 'old'], ['看看现在的它', '2026年10月28日。离家十三个月，它已经十二斤了。', 'now'], ['点开那段熟悉的回忆', '我还记得，你把头蹭进掌心里的样子。', 'memory'] ], plan: '正式版可加入经授权的真实照片与视频；本版明确使用回忆插画，无虚构近况消息。' },
    { id: 'ending', title: '再摸摸头', phase: '一段熟悉的回忆', kind: 'narrative', source: '扩展原摸猫结尾；呈现回忆，不预设现实重逢',
      hint: '伸出手，再摸摸它的头。', caption: '现在想知道，今天又捣了什么乱。', cat: 'cat-loaf', theme: 'memory', size: 'growing',
      shots: ['打开一段旧回忆，猫抬起头。', '它主动蹭进掌心，停留片刻。', '回到现在，保留回看所有章节的入口。'],
      beats: [], plan: '保留摸猫互动；完成后显示中文收尾和重新开始。' }
  ];
  window.catStory = Object.freeze(chapters);
  const room = document.querySelector('.room');
  const sparkles = document.getElementById('sparkles');
  chapters.forEach(chapter => {
    let section = room.querySelector(`[data-scene="${chapter.id}"]`);
    if (!section) {
      section = document.createElement('section');
      section.className = 'scene story-scene';
      section.dataset.scene = chapter.id;
      I.attribute(section, 'aria-label', chapter.title);
    }
    room.insertBefore(section, sparkles);
  });
  document.getElementById('progress').replaceChildren(...chapters.map(chapter => {
    const dot = document.createElement('span');
    dot.className = 'dot';
    I.attribute(dot, 'title', chapter.title);
    return dot;
  }));
  const ui = document.querySelector('.ui-layer');
  const nav = document.createElement('nav');
  nav.className = 'story-navigation';
  I.attribute(nav, 'aria-label', '章节导航');
  nav.innerHTML = '<button id="storyPrevious" type="button">上一幕</button><label><span class="sr-only">选择章节</span><select id="storyChapter"></select></label><button id="storyForward" type="button" disabled>下一幕</button>';
  ui.append(nav); I.hydrate(nav);
  const select = nav.querySelector('select');
  chapters.forEach((chapter, i) => select.add(new Option(`${i + 1} / ${chapters.length} · ${I.text(chapter.title)}`, chapter.id)));
  const panel = document.createElement('article');
  panel.id = 'storyPanel'; panel.className = 'story-panel'; panel.hidden = true;
  panel.innerHTML = '<div class="story-copy"><p id="storyPhase" class="story-phase"></p><h1 id="storyTitle"></h1><p id="storyText" class="story-text" aria-live="polite"></p></div><div id="storyBoard" class="story-board"><div class="story-furniture" aria-hidden="true"></div><div id="storyPrints" class="story-prints" aria-hidden="true"></div><img id="storyCat" class="story-cat" alt="希小乐的回忆插画" draggable="false"><img id="storyProp" class="story-prop" alt="" draggable="false"></div><div class="story-interaction"><p id="storyFeedback" class="story-feedback" role="status"></p><div id="storyActions" class="story-actions"></div></div>';
  ui.append(panel);
  const endingCat = document.getElementById('endingCat');
  endingCat.className = 'story-ending-cat';
  I.attribute(endingCat, 'aria-label', '摸摸回忆里的希小乐');
  endingCat.innerHTML = '<img src="assets/art-v1/cats/cat-loaf.png" alt="等待摸头的希小乐" draggable="false"><span>摸摸头</span>';
  panel.querySelector('#storyBoard').append(endingCat);
  I.hydrate(panel);
  const stoolDecor = document.createElement('div');
  stoolDecor.className = 'story-stool';
  stoolDecor.setAttribute('aria-hidden', 'true');
  stoolDecor.innerHTML = '<div class="stool-legs"></div><div class="stool-seat"></div>';
  panel.querySelector('#storyBoard').prepend(stoolDecor);
  const stoolFoot = document.createElement('button');
  stoolFoot.type = 'button'; stoolFoot.id = 'stoolFoot'; stoolFoot.className = 'stool-foot'; stoolFoot.hidden = true;
  stoolFoot.innerHTML = '<img src="assets/art-v1/props/sock-foot.png" alt="" draggable="false">';
  I.attribute(stoolFoot, 'aria-label', '点击脚，把它从小乐睡觉的凳子上移开');
  panel.querySelector('#storyBoard').append(stoolFoot);
  let active = null, step = 0, printCount = 4;
  const introductions = {
    stool: '你把脚搭在它平时睡觉的凳子上。小乐一看，立刻跳起来拍你的脚。',
    arrival: '2025年，四个月大的希小乐来到家里。箱子打开了，小家伙却躲进床底，不肯出来。',
    footprints: '回来一看，白床单上多了一串黑梅花。门明明只开了一条缝……',
    bedtime: '家人准备睡觉，小乐已经舒服地躺在房间里。叫了好几声，它还是不肯出来。',
    morning: '想起它还很小的时候。每天早晨，你一走动，它就紧紧贴在脚边。',
    study: '书刚打开，小乐就挨了过来。一只爪子压着书页，眼睛却盯上了笔尖。',
    departure: '今天要出远门。行李箱摊开，小乐又凑过来，检查你正在忙什么。',
    photos: '离家后，你从屏幕里看它长大。同一只足球旁边，小家伙已经变了模样。',
    ending: '一段熟悉的回忆里，你垂下手。它走过来，抬起头，把额头送进掌心。'
  };
  const byId = id => document.getElementById(id);
  const cat = byId('storyCat');
  const feedback = byId('storyFeedback');
  const actions = byId('storyActions');
  const board = byId('storyBoard');
  let hooks = {};
  I.attribute(board.querySelector('.story-furniture'), 'data-note', '学习笔记');
  I.attribute(board, 'data-label', '回忆插画');
  window.addEventListener('catlanguagechange', () => {
    [...select.options].forEach((option, index) => { option.textContent = (index + 1) + ' / ' + chapters.length + ' · ' + I.text(chapters[index].title); });
  });
  const stool = window.createStoolScene({
    board, cat, foot: stoolFoot,
    onState(state) {
      if (active?.id !== 'stool') return;
      if (state === 'guarding') I.write(feedback, '这是它平时睡觉的地方。点一下脚，让个位。');
      if (state === 'withdrawing') I.write(feedback, '好好好，这就把脚移开。');
      if (state === 'settled') I.write(feedback, '脚移开了。小乐满意地趴下，凳子又归它了。');
      if (state === 'error') I.write(feedback, '画面还没准备好。');
      hooks.track?.('stool_state', { state });
      hooks.navigation?.();
      renderActions();
    },
    onTrigger() { hooks.interact(); hooks.track('stool_foot_withdraw'); },
    onComplete() { hooks.complete(); hooks.track('stool_round_complete'); }
  });
  function paintPrints() { byId('storyPrints').textContent = '✿ '.repeat(printCount); }
  function button(label, action, primary = false) {
    const item = document.createElement('button');
    item.type = 'button'; I.write(item, label);
    if (primary) item.className = 'primary';
    item.addEventListener('click', action);
    actions.append(item);
  }
  function renderActions() {
    actions.replaceChildren();
    if (!active || active.kind === 'original' || active.id === 'ending') return;
    if (active.id === 'stool' && !stool.finished) {
      button('重玩本幕', () => hooks.replay());
      return;
    }
    const beat = active.beats[step];
    if (beat) {
      button(beat[0], () => {
        hooks.interact();
        I.write(feedback, beat[1]);
        board.dataset.beat = beat[2];
        step++;
        board.dataset.step = String(step);
        if (active.id === 'study' && step >= 2) cat.src = 'assets/art-v1/cats/cat-sleep.png';
        if (active.id === 'photos') board.dataset.size = step === 1 ? 'kitten' : 'adult';
        if (active.id === 'bedtime' && step >= 2) cat.src = 'assets/art-v1/cats/cat-walk.png';
        hooks.track('story_beat', { step, beat: beat[2] });
        if (step === active.beats.length) hooks.complete();
        renderActions();
        actions.querySelector('button')?.focus({ preventScroll: true });
      }, true);
      if (active.extra) button(active.extra[0], () => {
        hooks.interact(); I.write(feedback, active.extra[1]);
        if (active.id === 'footprints') { printCount = Math.min(12, printCount + 2); paintPrints(); }
        hooks.track('story_wrong_approach', { action: active.extra[0] });
      });
    } else {
      button('下一幕', () => hooks.next(), true);
    }
    button('重玩本幕', () => hooks.replay());
  }
  window.createStorySpine = callbacks => {
    hooks = callbacks;
    byId('storyPrevious').addEventListener('click', hooks.previous);
    byId('storyForward').addEventListener('click', hooks.next);
    select.addEventListener('change', () => hooks.go(select.value));
    return {
      leave() { stool.leave(); },
      get busy() { return stool.busy; },
      enter(chapter) {
        stool.leave();
        active = chapter; step = 0; printCount = 4;
        const illustrated = chapter.kind === 'original';
        panel.hidden = illustrated;
        select.value = chapter.id;
        if (illustrated) return;
        I.write(byId('storyPhase'), chapter.phase);
        I.write(byId('storyTitle'), chapter.title);
        I.write(byId('storyText'), introductions[chapter.id]);
        I.write(feedback, chapter.id === 'ending' ? '以前每天都在想，今天怎么又捣乱。' : '');
        board.dataset.theme = chapter.theme;
        board.dataset.size = chapter.size;
        board.dataset.step = '0'; board.dataset.beat = '';
        cat.src = `assets/art-v1/cats/${chapter.cat}.png`;
        cat.hidden = chapter.id === 'ending';
        endingCat.hidden = chapter.id !== 'ending';
        const prop = byId('storyProp');
        prop.src = 'assets/art-v1/props/' + (chapter.id === 'departure' ? 'soccer-ball.png' : 'feather-bell.png');
        prop.hidden = ['photos', 'ending', 'morning', 'stool'].includes(chapter.id);
        paintPrints(); renderActions();
        if (chapter.id === 'stool') stool.enter();
      },
      pet() {
        if (active?.id !== 'ending') return;
        I.write(feedback, '现在想知道，今天又捣了什么乱。');
        board.dataset.beat = 'pet';
        hooks.complete();
      },
      navigation(index, completed, busy) {
        byId('storyPrevious').disabled = index === 0;
        byId('storyForward').disabled = !completed || busy || index === chapters.length - 1;
        I.write(byId('storyForward'), '下一幕');
        select.value = chapters[index].id;
        I.attribute(document.getElementById('progress'), 'aria-label', '第{current}幕，共{total}幕', { current:index + 1, total:chapters.length });
      }
    };
  };
})();
