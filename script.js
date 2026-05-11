const game = document.getElementById('game');
const hint = document.getElementById('hint');
const cta = document.getElementById('cta');
const sparkles = document.getElementById('sparkles');
const progressDots = [...document.querySelectorAll('.dot')];
const scenes = [...document.querySelectorAll('.scene')];

// Keep scene order, prompt copy, and completion event names in one place.
const sceneData = [
  {
    id: 'closet',
    hint: 'Tap the tangled yarn!',
    complete: 'yarn_rescued'
  },
  {
    id: 'dad',
    hint: "Save Dad's head!",
    complete: 'dad_distracted'
  },
  {
    id: 'teddy',
    hint: 'Rescue the teddy!',
    complete: 'teddy_rescued'
  }
];

let currentScene = 0;
let locked = false;
let firstInteraction = false;
const startedAt = performance.now();

window.playableEvents = [];

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

// Shared completion path for each playable scene.
function completeScene(action) {
  if (locked) return;
  locked = true;
  markFirstInteraction();
  if (action === 'tap_tangled_yarn') playMeow();
  if (action === 'tap_electric_mouse') playToyBell();
  if (action === 'tap_teddy') playRescueChime();

  const activeScene = scenes[currentScene];
  const caption = activeScene.querySelector('.caption');
  activeScene.classList.add('is-cleared');
  caption.classList.add('show');
  hint.textContent = 'Nice!';
  track('scene_complete', {
    action,
    result: sceneData[currentScene].complete
  });
  burstSparkles();
  vibrate([24, 20, 35]);

  setTimeout(() => {
    currentScene += 1;
    if (currentScene >= sceneData.length) {
      showEnding();
    } else {
      showScene(currentScene);
    }
    locked = false;
  }, 1050);
}

// Reset visual state and reveal the next scene.
function showScene(index) {
  scenes.forEach((scene) => {
    scene.classList.remove('is-active', 'is-cleared');
    const caption = scene.querySelector('.caption');
    if (caption) caption.classList.remove('show');
  });

  scenes[index].classList.add('is-active');
  hint.textContent = sceneData[index].hint;
  progressDots.forEach((dot, dotIndex) => {
    dot.classList.toggle('is-done', dotIndex < index);
    dot.classList.toggle('is-active', dotIndex === index);
  });
  track('scene_start');
}

// Final payoff screen after all playable scenes are cleared.
function showEnding() {
  scenes.forEach((scene) => scene.classList.remove('is-active', 'is-cleared'));
  const ending = document.querySelector('[data-scene="ending"]');
  ending.classList.add('is-active');
  ending.querySelector('.caption').classList.add('show');
  hint.textContent = 'He missed you too.';
  progressDots.forEach((dot) => {
    dot.classList.add('is-done');
    dot.classList.remove('is-active');
  });
  cta.classList.add('show');
  burstSparkles(38);
  track('playable_complete');
}

// Procedural particle burst, so the demo has no image dependencies.
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
function playToyBell() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();
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

  setTimeout(() => audio.close(), 700);
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

function playCuteMeow() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const audio = new AudioContext();
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
  setTimeout(() => audio.close(), 650);
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

document.getElementById('yarnMess').addEventListener('pointerdown', () => completeScene('tap_tangled_yarn'));
document.getElementById('toy').addEventListener('pointerdown', () => completeScene('tap_electric_mouse'));
document.getElementById('teddy').addEventListener('pointerdown', () => completeScene('tap_teddy'));
document.getElementById('endingCat').addEventListener('pointerdown', () => {
  const endingCat = document.getElementById('endingCat');
  playCuteMeow();
  vibrate(18);
  endingCat.classList.remove('is-meowing');
  void endingCat.offsetWidth;
  endingCat.classList.add('is-meowing');
  track('ending_cat_pet');
});

cta.addEventListener('pointerdown', () => {
  track('cta_click', { target: 'store_redirect_placeholder' });
  cta.textContent = 'Coming Soon';
  vibrate(35);
});

track('impression');

