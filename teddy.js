window.createTeddyScene = ({ element, onStateChange, onTrigger, onSqueak, onAudienceArrived, onComplete }) => {
  const bear = element.querySelector('#teddy');
  const head = element.querySelector('.teddy-bear-head');
  const cat = element.querySelector('.teddy-cat');
  const farPaw = element.querySelector('.teddy-paw-far');
  const nearPaw = element.querySelector('.teddy-paw-near');
  const audience = element.querySelector('.teddy-audience');
  const dad = element.querySelector('.teddy-dad');
  const girl = element.querySelector('.teddy-girl');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let active = false, ready = false, busy = false, rescued = false;
  let entry = 0, rounds = 0, sequence = null, kneadFrame = 0;
  const duration = ms => reducedMotion.matches ? Math.min(ms, 160) : ms;
  const aborted = () => new DOMException('Scene interrupted', 'AbortError');

  function wait(ms, signal) {
    if (signal.aborted) return Promise.reject(aborted());
    return new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(aborted()); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  async function motion(target, frames, ms, signal) {
    if (signal.aborted) throw aborted();
    const animation = target.animate(frames, { duration: duration(ms), easing: 'ease-out', fill: 'forwards' });
    animations.add(animation);
    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await animation.finished;
      if (signal.aborted) throw aborted();
      for (const [key, value] of Object.entries(frames.at(-1))) if (key !== 'offset' && key !== 'easing') target.style[key] = value;
    } finally {
      signal.removeEventListener('abort', cancel);
      animations.delete(animation);
      animation.cancel();
    }
  }

  function setState(state) {
    element.dataset.state = state;
    element.setAttribute('aria-busy', String(busy || state === 'loading'));
    bear.disabled = !ready || busy || rescued;
    onStateChange(state, busy);
  }

  function paintKnead(amount) {
    const far = (1 + amount) / 2, near = 1 - far;
    farPaw.style.transform = `translate(0px, ${far * 6 - 3}px)`;
    nearPaw.style.transform = `translate(0px, ${near * 6 - 3}px)`;
    head.style.transform = `translate(${amount * .7}px, ${Math.max(far, near) * .8}px) scale(1.005, ${1 - Math.max(far, near) * .028})`;
    element.dataset.knead = amount.toFixed(3);
  }

  function stopKnead() {
    cancelAnimationFrame(kneadFrame);
    kneadFrame = 0;
  }

  function beginKnead() {
    stopKnead();
    if (!active || !ready || rescued || document.hidden) return;
    if (reducedMotion.matches) { paintKnead(0); return; }
    const started = performance.now();
    const tick = now => {
      paintKnead(Math.sin((now - started) * Math.PI * 2 / 1150));
      kneadFrame = requestAnimationFrame(tick);
    };
    kneadFrame = requestAnimationFrame(tick);
  }

  function resetActors() {
    cat.dataset.pose = 'knead';
    audience.setAttribute('aria-hidden', 'true');
    for (const person of [dad, girl]) { person.style.opacity = '0'; person.style.transform = ''; }
    paintKnead(0);
  }

  function stop() {
    stopKnead();
    sequence?.abort(); sequence = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    busy = false;
  }

  function reset() {
    stop();
    rescued = false;
    resetActors();
    setState('kneading');
    beginKnead();
  }

  async function enter() {
    leave();
    active = true; ready = false; rescued = false;
    resetActors();
    element.classList.remove('is-ready');
    element.classList.toggle('is-suspended', document.hidden);
    const version = entry;
    setState('loading');
    try {
      const background = new Image();
      background.src = 'assets/art-v1/backgrounds/room.webp';
      await Promise.all([...element.querySelectorAll('img'), background].map(image => {
        if (image.complete && !image.naturalWidth) image.src = image.src;
        return image.decode();
      }));
      if (!active || version !== entry) return;
      ready = true;
      element.classList.add('is-ready');
      setState('kneading');
      beginKnead();
    } catch {
      if (active && version === entry) { ready = false; setState('error'); }
    }
  }

  function leave() {
    active = false; entry++;
    stop();
    resetActors();
    element.classList.add('is-suspended');
    element.setAttribute('aria-busy', 'false');
  }

  function gatherAudience() {
    if (!active || !ready || busy || rescued || document.hidden) return false;
    busy = true;
    const controller = new AbortController();
    sequence = controller;
    const { signal } = controller;
    onTrigger();
    (async () => {
      setState('calling');
      await wait(duration(180), signal);
      onSqueak();
      setState('approaching');
      // Kneading continues until both witnesses have arrived.
      await Promise.all([
        motion(dad, [{ opacity: 0, transform: 'translate(0px, 24px)' }, { opacity: 1, transform: 'translate(0px, 0px)' }], 1100, signal),
        (async () => {
          await wait(duration(180), signal);
          await motion(girl, [{ opacity: 0, transform: 'translate(0px, 24px)' }, { opacity: 1, transform: 'translate(0px, 0px)' }], 1000, signal);
        })()
      ]);
      stopKnead();
      farPaw.style.transform = ''; nearPaw.style.transform = ''; head.style.transform = '';
      cat.dataset.pose = 'frozen';
      audience.setAttribute('aria-hidden', 'false');
      setState('watching');
      onAudienceArrived();
      await wait(duration(700), signal);
      if (!active || signal.aborted) return;
      busy = false; rescued = true; rounds++;
      setState('frozen');
      onComplete(rounds);
    })().catch(error => {
      if (error.name !== 'AbortError' && active && sequence === controller) {
        stopKnead();
        busy = false;
        resetActors();
        setState('error');
        console.warn('Teddy sequence:', error);
      }
    }).finally(() => { if (sequence === controller) sequence = null; });
    return true;
  }

  bear.addEventListener('click', gatherAudience);
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    element.classList.toggle('is-suspended', document.hidden);
    if (document.hidden) {
      stop();
      if (ready && !rescued) { resetActors(); setState('kneading'); }
    } else if (ready && !rescued && !busy) beginKnead();
  });
  return Object.freeze({
    enter, leave,
    replay: () => { if (!active || busy) return; if (!ready) enter(); else reset(); },
    get busy() { return busy; }, get rescued() { return rescued; }
  });
};
