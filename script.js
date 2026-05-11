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
    hint: 'Catch her with the yarn!',
    complete: 'yarn_rescued'
  },
  {
    id: 'dad',
    hint: 'Ring the mouse toy!',
    complete: 'dad_distracted'
  },
  {
    id: 'stool',
    hint: 'Move your foot!',
    complete: 'stool_returned'
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
  if (action === 'tap_electric_mouse') playToyBell();

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
  hint.textContent = 'She missed you too.';
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

document.getElementById('closetCat').addEventListener('pointerdown', () => completeScene('tap_cat'));
document.getElementById('toy').addEventListener('pointerdown', () => completeScene('tap_electric_mouse'));
document.getElementById('foot').addEventListener('pointerdown', () => completeScene('tap_foot'));
document.getElementById('stoolCat').addEventListener('pointerdown', () => completeScene('tap_stool_cat'));

cta.addEventListener('pointerdown', () => {
  track('cta_click', { target: 'store_redirect_placeholder' });
  cta.textContent = 'Coming Soon';
  vibrate(35);
});

track('impression');

