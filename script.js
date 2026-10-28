const game = document.getElementById('game');
const hint = document.getElementById('hint');
const caption = document.getElementById('caption');
const cta = document.getElementById('cta');
const sparkles = document.getElementById('sparkles');
const progressDots = [...document.querySelectorAll('.dot')];
const scenes = [...document.querySelectorAll('.scene')];

// Keep scene order, prompt copy, and completion event names in one place.
const sceneData = window.catStory;

let currentScene = 0;
let locked = false;
let firstInteraction = false;
const startedAt = performance.now();
const completedScenes = new Set();
const controllers = {};
const frame = document.getElementById('gameFrame');
let storySpine;
let currentReady = false;

function isCurrentBusy() {
  return Boolean(controllers[sceneData[currentScene]?.id]?.busy || storySpine?.busy);
}
function updateStoryNavigation() {
  const chapter = sceneData[currentScene];
  progressDots.forEach((dot, index) => {
    dot.classList.toggle('is-done', completedScenes.has(sceneData[index].id));
    dot.classList.toggle('is-active', index === currentScene);
    if (index === currentScene) dot.setAttribute('aria-current', 'step');
    else dot.removeAttribute('aria-current');
  });
  storySpine?.navigation(currentScene, currentReady, isCurrentBusy());
}
function recordCompletion(id) {
  completedScenes.add(id);
  currentReady = true;
  updateStoryNavigation();
}
function nextScene() {
  if (!currentReady || isCurrentBusy()) return;
  if (currentScene < sceneData.length - 1) showScene(currentScene + 1);
}

window.playableEvents = [];
const ambushControls = document.getElementById('ambushControls');
const ambushReplay = document.getElementById('ambushReplay');
const ambushNext = document.getElementById('ambushNext');
const ambushSound = document.getElementById('ambushSound');
let ambushFinished = false;
let ambushAudio = null;

function releaseAmbushAudio() {
  const audio = ambushAudio;
  ambushAudio = null;
  if (audio && audio.state !== 'closed') audio.close().catch(() => {});
}

function prepareAmbushAudio() {
  releaseAmbushAudio();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!ambushSound.checked || !AudioContext) return;
  try {
    // Unlock during the tap, before the asynchronous pounce reaches its landing.
    ambushAudio = new AudioContext();
    ambushAudio.resume().catch(() => {});
  } catch { ambushAudio = null; }
}

const ambush = window.createAmbushScene({
  element: document.querySelector('[data-scene="ambush"]'),
  onStateChange(state, busy) {
    if (sceneData[currentScene]?.id !== 'ambush') return;
    if (state === 'hidden' || state === 'error') releaseAmbushAudio();
    const lines = {
      loading: '小猫躲到哪里去了……', hidden: ambushFinished ? '小足球把它引出来了。' : '她好像有个小主意。',
      dropping: '咦，什么掉下来了？', 'ball-landed': '一颗小足球。',
      peek: ambushFinished ? '它还惦记着小足球。' : '书后面，藏着什么呢？', crouch: '屏住呼吸……', pounce: '扑！',
      land: '抓到小足球啦！', retreat: '假装无事发生。', error: '画面还没准备好。'
    };
    window.catI18n.write(hint, lines[state]);
    ambushReplay.disabled = busy || state === 'loading';
    ambushReplay.hidden = !ambushFinished && state !== 'error';
    window.catI18n.write(ambushReplay, state === 'error' ? '重试' : ambushFinished ? '再放一次' : '逗逗它');
    ambushNext.disabled = busy;
    track('ambush_state', { state });
    updateStoryNavigation();
  },
  onTrigger(point) {
    prepareAmbushAudio();
    markFirstInteraction();
    track('ambush_trigger', { x: Math.round(point.x), y: point.y });
  },
  onComplete(round) {
    if (!ambushFinished) track('scene_complete', { action: 'tap_hidden_soccer_ball', result: 'ambush_played' });
    ambushFinished = true;
    recordCompletion('ambush');
    window.catI18n.write(ambushReplay, '再放一次');
    ambushReplay.hidden = false;
    ambushNext.hidden = false;
    track('ambush_round_complete', { round });
  },
  onBallLanded(point) {
    track('ambush_ball_landed', { x: point.x, y: point.y });
  },
  playSound() {
    if (ambushSound.checked) {
      if (ambushAudio) playCuteMeow(ambushAudio);
      vibrate(18);
    }
  }
});

const yarnControls = document.getElementById('yarnControls');
const yarnReplay = document.getElementById('yarnReplay');
const yarnNext = document.getElementById('yarnNext');
const yarnSound = document.getElementById('yarnSound');
let yarnFinished = false;
let yarnAudio = null;
function releaseYarnAudio() {
  const audio = yarnAudio;
  yarnAudio = null;
  if (audio && audio.state !== 'closed') audio.close().catch(() => {});
}
function prepareYarnAudio() {
  releaseYarnAudio();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!yarnSound.checked || !AudioContext) return;
  try { yarnAudio = new AudioContext(); yarnAudio.resume().catch(() => {}); }
  catch { yarnAudio = null; }
}
const yarn = window.createYarnScene({
  element: document.querySelector('[data-scene="yarn"]'),
  onStateChange(state, busy) {
    if (sceneData[currentScene]?.id !== 'yarn') return;
    if (['loading', 'playing', 'rescued', 'error'].includes(state)) releaseYarnAudio();
    const lines = {
      loading: '哪里传来了窸窸窣窣的声音……',
      playing: '毛线还在它的爪子里。',
      guarded: '它还不肯松爪。',
      attracting: '咦，找到一角羽毛了。',
      following: '还是羽毛更好玩！',
      rescuing: '趁现在，把毛线收好。',
      rescued: '毛线团，得救了。',
      error: '画面还没准备好。'
    };
    window.catI18n.write(hint, lines[state]);
    yarnReplay.disabled = busy || state === 'loading';
    window.catI18n.write(yarnReplay, state === 'error' ? '重试' : state === 'rescued' ? '再玩一次' : '重新开始');
    yarnNext.hidden = state !== 'rescued';
    yarnNext.disabled = busy;
    track('yarn_state', { state });
    updateStoryNavigation();
  },
  onWrongTarget() { markFirstInteraction(); track('yarn_wrong_target'); },
  onTrigger() {
    markFirstInteraction();
    track('yarn_trigger', { tool: 'feather_bell' });
    prepareYarnAudio();
  },
  onToyRevealed() {
    window.catI18n.write(hint, '叮铃！耳朵竖起来了。');
    track('yarn_toy_revealed');
    if (yarnSound.checked && yarnAudio) {
      playToyBell(yarnAudio);
      track('yarn_bell');
      vibrate(15);
    }
  },
  onComplete(round) {
    if (!yarnFinished) track('scene_complete', { action: 'distract_with_feather', result: 'yarn_rescued' });
    yarnFinished = true;
    recordCompletion('yarn');
    track('yarn_round_complete', { round });
  }
});

const dadControls = document.getElementById('dadControls');
const dadReplay = document.getElementById('dadReplay');
const dadNext = document.getElementById('dadNext');
const dadSound = document.getElementById('dadSound');
let dadFinished = false;
let dadAudio = null;
function releaseDadAudio() {
  const audio = dadAudio;
  dadAudio = null;
  if (audio && audio.state !== 'closed') audio.close().catch(() => {});
}
function prepareDadAudio() {
  releaseDadAudio();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!dadSound.checked || !AudioContext) return;
  try { dadAudio = new AudioContext(); dadAudio.resume().catch(() => {}); }
  catch { dadAudio = null; }
}
const dad = window.createDadScene({
  element: document.querySelector('[data-scene="dad"]'),
  onStateChange(state, busy) {
    if (sceneData[currentScene]?.id !== 'dad') return;
    if (['loading', 'watching', 'rescued', 'error'].includes(state)) releaseDadAudio();
    const lines = {
      loading: '爸爸正看到精彩的地方……',
      watching: '希小乐，又盯上爸爸的光头了。',
      stalking: '这只爪爪，偷偷伸过来了。',
      raising: '爸爸还没发现它。',
      tapping: '轻轻一下！',
      innocent: '谁？不是我，我可乖了。',
      revealing: '柜子下面，藏着一条小尾巴。',
      noticing: '吱吱！这是什么声音？',
      chasing: '还是小老鼠更好玩！',
      jumping: '希小乐，出发！',
      relieved: '爸爸摸摸头：刚才是谁？',
      rescued: '光头保住了，继续看电视。',
      error: '画面还没准备好。'
    };
    window.catI18n.write(hint, lines[state]);
    dadReplay.disabled = busy || state === 'loading';
    dadReplay.hidden = !['error', 'rescued'].includes(state);
    window.catI18n.write(dadReplay, state === 'error' ? '重试' : '再玩一次');
    dadNext.hidden = state !== 'rescued';
    dadNext.disabled = busy;
    track('dad_state', { state });
    updateStoryNavigation();
  },
  onTrigger() { markFirstInteraction(); prepareDadAudio(); track('dad_trigger', { tool: 'hidden_windup_mouse' }); },
  onToyRevealed() {
    track('dad_mouse_revealed');
    if (dadSound.checked && dadAudio) { playMouseSqueak(dadAudio); track('dad_mouse_squeak'); }
  },
  onTap() { track('dad_head_tap'); },
  onComplete(round) {
    if (!dadFinished) track('scene_complete', { action: 'tap_hidden_mouse', result: 'dad_distracted' });
    dadFinished = true;
    recordCompletion('dad');
    track('dad_round_complete', { round });
  }
});

const teddyControls = document.getElementById('teddyControls');
const teddyReplay = document.getElementById('teddyReplay');
const teddyNext = document.getElementById('teddyNext');
const teddySound = document.getElementById('teddySound');
let teddyFinished = false;
let teddyAudio = null;
function releaseTeddyAudio() {
  const audio = teddyAudio;
  teddyAudio = null;
  if (audio && audio.state !== 'closed') audio.close().catch(() => {});
}
function prepareTeddyAudio() {
  releaseTeddyAudio();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!teddySound.checked || !AudioContext) return;
  try { teddyAudio = new AudioContext(); teddyAudio.resume().catch(() => {}); }
  catch { teddyAudio = null; }
}
const teddy = window.createTeddyScene({
  element: document.querySelector('[data-scene="teddy"]'),
  onStateChange(state, busy) {
    if (sceneData[currentScene]?.id !== 'teddy') return;
    if (['loading', 'kneading', 'frozen', 'error'].includes(state)) releaseTeddyAudio();
    const lines = {
      loading: '小床那边，又有动静了……',
      kneading: '白熊的脸，又成了小乐的踏板。',
      calling: '白熊轻轻吱了一声。',
      approaching: '爸爸和女孩，过来看热闹了。',
      watching: '咦？怎么都在看我？',
      frozen: '爪爪停住了。刚才什么也没发生。',
      error: '画面还没准备好。'
    };
    window.catI18n.write(hint, lines[state]);
    teddyReplay.disabled = busy || state === 'loading';
    teddyReplay.hidden = !['error', 'frozen'].includes(state);
    window.catI18n.write(teddyReplay, state === 'error' ? '重试' : '再玩一次');
    teddyNext.hidden = state !== 'frozen';
    teddyNext.disabled = busy;
    track('teddy_state', { state });
    updateStoryNavigation();
  },
  onTrigger() { markFirstInteraction(); prepareTeddyAudio(); track('teddy_trigger', { action: 'tap_white_teddy' }); },
  onSqueak() {
    if (teddySound.checked && teddyAudio) { playPlushSqueak(teddyAudio); track('teddy_squeak'); }
  },
  onAudienceArrived() { track('teddy_audience_arrived'); },
  onComplete(round) {
    if (!teddyFinished) track('scene_complete', { action: 'gather_family', result: 'teddy_rescued' });
    teddyFinished = true;
    recordCompletion('teddy');
    track('teddy_round_complete', { round });
  }
});

// Lightweight analytics shim for playable-ad testing.
function track(event, data = {}) {
  const payload = {
    event,
    scene: sceneData[currentScene]?.id || 'ending',
    timeMs: Math.round(performance.now() - startedAt),
    ...data
  };
  window.playableEvents.push(payload);
  console.log('[playable]', payload);
}

function markFirstInteraction() {
  if (firstInteraction) return;
  firstInteraction = true;
  track('first_interaction');
}

// Route by chapter ID, keeping each original controller responsible for its own lifecycle.
function showScene(index) {
  if (!Number.isInteger(index) || index < 0 || index >= sceneData.length) return;
  storySpine?.leave();
  Object.values(controllers).forEach(controller => controller.leave());
  releaseAmbushAudio(); releaseYarnAudio(); releaseDadAudio(); releaseTeddyAudio();
  currentScene = index;
  locked = false;
  currentReady = false;
  const chapter = sceneData[index];
  scenes.forEach(scene => {
    scene.classList.remove('is-active', 'is-cleared');
    scene.setAttribute('aria-hidden', String(scene.dataset.scene !== chapter.id));
  });
  document.querySelector('[data-scene="' + chapter.id + '"]').classList.add('is-active');
  caption.classList.remove('show'); window.catI18n.write(caption, '');
  cta.classList.remove('show');
  window.catI18n.write(hint, chapter.hint);
  const original = chapter.kind === 'original';
  ['ambush', 'yarn', 'dad', 'teddy'].forEach(id => {
    frame.classList.toggle('is-' + id, chapter.id === id);
    document.getElementById(id + 'Controls').hidden = chapter.id !== id;
  });
  frame.classList.add('is-illustrated');
  frame.classList.toggle('is-story', !original);
  frame.classList.toggle('is-ending', chapter.id === 'ending');
  ambushFinished = false; yarnFinished = false; dadFinished = false; teddyFinished = false;
  ambushNext.hidden = true; yarnNext.hidden = true; dadNext.hidden = true; teddyNext.hidden = true;
  storySpine.enter(chapter);
  updateStoryNavigation();
  track('scene_start', { chapter: index + 1, title: chapter.title });
  controllers[chapter.id]?.enter();
}

function showEnding() {
  showScene(sceneData.findIndex(chapter => chapter.id === 'ending'));
}

// Shared procedural celebration for the legacy scenes.
function burstSparkles(count = 22) {
  sparkles.innerHTML = '';
  const colors = ['#ffd166', '#ff6b6b', '#52c7a7', '#60a5fa', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const x = 18 + Math.random() * 64;
    piece.style.left = `${x}%`;
    piece.style.top = `${28 + Math.random() * 45}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    sparkles.appendChild(piece);
    piece.animate([
      { transform: 'translate(0, 0) scale(0.2)', opacity: 0 },
      { transform: `translate(${Math.random() * 170 - 85}px, ${Math.random() * -150 - 20}px) scale(1)`, opacity: 1 },
      { transform: `translate(${Math.random() * 230 - 115}px, ${Math.random() * 160 + 90}px) scale(0.4)`, opacity: 0 }
    ], {
      duration: 900 + Math.random() * 420,
      delay: Math.random() * 120,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards'
    });
  }
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// Tiny synthesized bell for the electric mouse toy.
function playToyBell(preparedAudio) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = preparedAudio || new AudioContext();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.52);
  gain.connect(audio.destination);

  [880, 1175].forEach((frequency, index) => {
    const osc = audio.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, audio.currentTime + index * 0.11);
    osc.connect(gain);
    osc.start(audio.currentTime + index * 0.11);
    osc.stop(audio.currentTime + 0.42 + index * 0.08);
  });

  setTimeout(() => { if (audio.state !== 'closed') audio.close().catch(() => {}); }, 700);
}

function playMouseSqueak(audio) {
  const gain = audio.createGain();
  const start = audio.currentTime;
  gain.connect(audio.destination);
  gain.gain.setValueAtTime(0.001, start);
  [0, 0.16].forEach(delay => {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, start + delay);
    osc.frequency.exponentialRampToValueAtTime(2100, start + delay + 0.045);
    osc.frequency.exponentialRampToValueAtTime(1400, start + delay + 0.12);
    gain.gain.setValueAtTime(0.001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.065, start + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + delay + 0.13);
    osc.connect(gain);
    osc.start(start + delay);
    osc.stop(start + delay + 0.14);
  });
  setTimeout(() => { if (audio.state !== 'closed') audio.close().catch(() => {}); }, 500);
}

function playMeow() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(620, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(360, audio.currentTime + 0.22);
  osc.frequency.exponentialRampToValueAtTime(520, audio.currentTime + 0.46);
  gain.gain.setValueAtTime(0.001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.58);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.62);
  setTimeout(() => audio.close(), 760);
}

function playPlushSqueak(audio) {
  const osc = audio.createOscillator(), gain = audio.createGain();
  const now = audio.currentTime;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(560, now);
  osc.frequency.exponentialRampToValueAtTime(940, now + .055);
  osc.frequency.exponentialRampToValueAtTime(610, now + .19);
  gain.gain.setValueAtTime(.001, now);
  gain.gain.exponentialRampToValueAtTime(.06, now + .015);
  gain.gain.exponentialRampToValueAtTime(.001, now + .22);
  osc.connect(gain); gain.connect(audio.destination);
  osc.start(now); osc.stop(now + .24);
  setTimeout(() => { if (audio.state !== 'closed') audio.close().catch(() => {}); }, 400);
}

function playCuteMeow(preparedAudio) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = preparedAudio || new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(720, audio.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, audio.currentTime + 0.18);
  osc.frequency.exponentialRampToValueAtTime(760, audio.currentTime + 0.36);
  gain.gain.setValueAtTime(0.001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, audio.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.46);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.5);
  setTimeout(() => { if (audio.state !== 'closed') audio.close().catch(() => {}); }, 650);
}

function playRescueChime() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.11, audio.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.48);
  gain.connect(audio.destination);

  [660, 990, 1320].forEach((frequency, index) => {
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audio.currentTime + index * 0.08);
    osc.connect(gain);
    osc.start(audio.currentTime + index * 0.08);
    osc.stop(audio.currentTime + 0.26 + index * 0.08);
  });

  setTimeout(() => audio.close(), 650);
}

document.getElementById('endingCat').addEventListener('click', () => {
  const endingCat = document.getElementById('endingCat');
  playCuteMeow();
  vibrate(18);
  endingCat.classList.remove('is-meowing');
  void endingCat.offsetWidth;
  endingCat.classList.add('is-meowing');
  track('ending_cat_pet');
  storySpine.pet();
});

ambushReplay.addEventListener('click', () => ambush.replay());
ambushSound.addEventListener('change', () => {
  if (!ambushSound.checked) releaseAmbushAudio();
  else if (sceneData[currentScene]?.id === 'ambush' && ambush.busy) prepareAmbushAudio();
});
ambushNext.addEventListener('click', () => {
  if (!ambushFinished || ambush.busy) return;
  nextScene();
});
yarnReplay.addEventListener('click', () => yarn.replay());
yarnSound.addEventListener('change', () => {
  if (!yarnSound.checked) releaseYarnAudio();
  else if (document.querySelector('[data-scene="yarn"]').dataset.state === 'attracting') prepareYarnAudio();
});
yarnNext.addEventListener('click', () => {
  if (yarn.rescued && !yarn.busy) nextScene();
});
dadReplay.addEventListener('click', () => dad.replay());
dadSound.addEventListener('change', () => {
  if (!dadSound.checked) releaseDadAudio();
  else if (document.querySelector('[data-scene="dad"]').dataset.state === 'revealing') prepareDadAudio();
});
dadNext.addEventListener('click', () => { if (dad.rescued && !dad.busy) nextScene(); });
teddyReplay.addEventListener('click', () => teddy.replay());
teddySound.addEventListener('change', () => {
  if (!teddySound.checked) releaseTeddyAudio();
  else if (document.querySelector('[data-scene="teddy"]').dataset.state === 'calling') prepareTeddyAudio();
});
teddyNext.addEventListener('click', () => { if (teddy.rescued && !teddy.busy) nextScene(); });

Object.assign(controllers, { ambush, yarn, dad, teddy });
storySpine = window.createStorySpine({
  interact: markFirstInteraction,
  navigation: updateStoryNavigation,
  track,
  complete() {
    if (currentReady) return;
    const chapter = sceneData[currentScene];
    recordCompletion(chapter.id);
    track('scene_complete', { action: 'story_interaction', result: chapter.id + '_complete' });
    if (chapter.id === 'ending') {
      window.catI18n.write(cta, '从头再玩一次');
      cta.classList.add('show');
      if (!window.playableEvents.some(event => event.event === 'playable_complete')) track('playable_complete');
    }
  },
  previous() { if (currentScene > 0) showScene(currentScene - 1); },
  next: nextScene,
  go(id) { showScene(sceneData.findIndex(chapter => chapter.id === id)); },
  replay() {
    completedScenes.delete(sceneData[currentScene].id);
    showScene(currentScene);
  }
});

cta.addEventListener('click', () => {
  completedScenes.clear();
  track('story_restart');
  showScene(0);
});

const previewScene = sceneData.findIndex(chapter => chapter.id === new URLSearchParams(location.search).get('scene'));
currentScene = Math.max(0, previewScene);
track('impression');
showScene(currentScene);
