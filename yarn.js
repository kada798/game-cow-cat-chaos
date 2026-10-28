window.createYarnScene = ({ element, onStateChange, onWrongTarget, onTrigger, onToyRevealed, onComplete }) => {
  const mess = element.querySelector('#yarnMess');
  const feather = element.querySelector('#featherToy');
  const featherImage = feather.querySelector('img');
  const cat = element.querySelector('.yarn-cat');
  const roll = element.querySelector('.yarn-ball-roll');
  const thread = element.querySelector('#yarnPullThread');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let active = false;
  let ready = false;
  let busy = false;
  let rescued = false;
  let rounds = 0;
  let entry = 0;
  let sequence = null;
  let idle = null;
  let pullFrame = 0;
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
    const animation = target.animate(frames, { duration: duration(ms), easing: 'ease-in-out', fill: 'forwards' });
    animations.add(animation);
    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await animation.finished;
      if (signal.aborted) throw aborted();
      for (const [key, value] of Object.entries(frames.at(-1))) {
        if (key !== 'offset' && key !== 'easing') target.style[key] = value;
      }
    } finally {
      signal.removeEventListener('abort', cancel);
      animations.delete(animation);
      animation.cancel();
    }
  }

  function setState(state) {
    element.dataset.state = state;
    element.setAttribute('aria-busy', String(busy || state === 'loading'));
    mess.disabled = !ready || busy || rescued;
    feather.disabled = !ready || busy || rescued;
    onStateChange(state, busy);
  }

  function paintPull(amount) {
    element.dataset.pull = amount.toFixed(3);
    cat.dataset.pose = amount > 0.5 ? 'tug' : 'play';
    cat.style.setProperty('--yarn-tug', amount);
    mess.style.transform = `translate(${-12 * amount}px, ${-2 * amount}px)`;
    roll.style.transform = `rotate(${-22 * amount}deg)`;
    const pawX = 177 + 23 * amount, pawY = 684 - 19 * amount;
    thread.setAttribute('d', `M${pawX} ${pawY} Q210 ${739 - 52 * amount} ${244 - 12 * amount} ${713 - 2 * amount}`);
  }

  function pull(from, to, ms, signal) {
    if (signal.aborted) return Promise.reject(aborted());
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const cancel = () => { cancelAnimationFrame(pullFrame); pullFrame = 0; reject(aborted()); };
      const frame = now => {
        const progress = Math.min(1, (now - started) / duration(ms));
        const eased = (1 - Math.cos(progress * Math.PI)) / 2;
        paintPull(from + (to - from) * eased);
        if (progress < 1) pullFrame = requestAnimationFrame(frame);
        else { pullFrame = 0; signal.removeEventListener('abort', cancel); resolve(); }
      };
      signal.addEventListener('abort', cancel, { once: true });
      pullFrame = requestAnimationFrame(frame);
    });
  }

  function stopIdle() {
    idle?.abort();
    idle = null;
  }

  function beginIdle() {
    stopIdle();
    if (!active || document.hidden || reducedMotion.matches) return;
    const controller = new AbortController();
    idle = controller;
    (async () => {
      await wait(650, controller.signal);
      while (active && !controller.signal.aborted) {
        await pull(0, 1, 420, controller.signal);
        await wait(220, controller.signal);
        await pull(1, 0, 500, controller.signal);
        await wait(1000, controller.signal);
      }
    })().catch(error => { if (error.name !== 'AbortError') console.warn('Yarn tug:', error); });
  }

  function resetActors() {
    paintPull(0);
    cat.style.transform = '';
    featherImage.style.transform = '';
    mess.style.transform = '';
    element.dataset.toy = 'hidden';
  }

  function stop() {
    stopIdle();
    sequence?.abort();
    sequence = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    busy = false;
  }

  function reset() {
    stop();
    rescued = false;
    resetActors();
    setState('playing');
    beginIdle();
  }

  async function enter() {
    leave();
    active = true;
    ready = false;
    rescued = false;
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
      setState('playing');
      beginIdle();
    } catch {
      if (active && version === entry) { ready = false; setState('error'); }
    }
  }

  function leave() {
    active = false;
    entry++;
    stop();
    resetActors();
    element.classList.add('is-suspended');
    element.setAttribute('aria-busy', 'false');
  }

  function run(operation) {
    if (!active || !ready || busy || rescued || document.hidden) return false;
    busy = true;
    stopIdle();
    paintPull(0);
    const controller = new AbortController();
    sequence = controller;
    operation(controller.signal).catch(error => {
      if (error.name !== 'AbortError' && active && sequence === controller) {
        busy = false;
        resetActors();
        setState('error');
        console.warn('Yarn sequence:', error);
      }
    }).finally(() => { if (sequence === controller) sequence = null; });
    return true;
  }

  function guardYarn() {
    return run(async signal => {
      onWrongTarget();
      setState('guarded');
      await pull(0, 1, 300, signal);
      await wait(duration(150), signal);
      await pull(1, 0, 270, signal);
      busy = false;
      setState('playing');
      beginIdle();
    });
  }

  function distract() {
    return run(async signal => {
      onTrigger();
      setState('attracting');
      element.dataset.toy = 'revealed';
      await wait(duration(660), signal);
      element.dataset.toy = 'active';
      onToyRevealed();
      cat.dataset.pose = 'alert';
      await motion(featherImage, [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: 'translate(6px, -24px) rotate(-12deg)' },
        { transform: 'translate(0px, -18px) rotate(7deg)' },
        { transform: 'translate(0px, -30px) rotate(-4deg)' }
      ], 500, signal);

      setState('following');
      cat.dataset.pose = 'walk';
      await Promise.all([
        motion(cat, [
          { transform: 'translate(0px, 0px)' },
          { transform: 'translate(-35px, -3px)', offset: 0.45 },
          { transform: 'translate(-80px, 6px)' }
        ], 1050, signal),
        motion(featherImage, [
          { transform: featherImage.style.transform },
          { transform: 'translate(-12px, -50px) rotate(4deg)' },
          { transform: 'translate(-20px, -60px) rotate(-8deg)' }
        ], 1050, signal)
      ]);
      cat.dataset.pose = 'pounce';
      await motion(cat, [
        { transform: 'translate(-80px, 6px)' },
        { transform: 'translate(-89px, -9px) rotate(-3deg)' },
        { transform: 'translate(-80px, 6px)' }
      ], 600, signal);

      setState('rescuing');
      await wait(duration(1150), signal);
      if (!active || signal.aborted) return;
      busy = false;
      rescued = true;
      rounds++;
      setState('rescued');
      onComplete(rounds);
    });
  }

  mess.addEventListener('click', guardYarn);
  feather.addEventListener('click', distract);
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    element.classList.toggle('is-suspended', document.hidden);
    if (document.hidden && ready && !rescued) reset();
    else if (!document.hidden && ready && !rescued && !busy) beginIdle();
  });
  return Object.freeze({
    enter, leave,
    replay: () => { if (!active || busy) return; if (!ready) enter(); else reset(); },
    get busy() { return busy; },
    get rescued() { return rescued; }
  });
};
