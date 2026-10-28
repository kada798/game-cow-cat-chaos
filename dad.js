window.createDadScene = ({ element, onStateChange, onTrigger, onToyRevealed, onTap, onComplete }) => {
  const mouse = element.querySelector('#hiddenMouse');
  const cat = element.querySelector('.dad-perched-cat');
  const person = element.querySelector('.dad-person');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let active = false, ready = false, busy = false, rescued = false;
  let entry = 0, rounds = 0, idle = null, sequence = null;
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
    mouse.disabled = !ready || busy || rescued;
    onStateChange(state, busy);
  }

  function resetActors() {
    cat.dataset.pose = 'stand';
    cat.style.transform = '';
    cat.style.zIndex = '';
    person.dataset.pose = 'watch';
    person.style.transform = '';
    mouse.style.transform = '';
    mouse.style.left = '';
    element.dataset.toy = 'hidden';
  }

  function stop() {
    idle?.abort();
    sequence?.abort();
    idle = null; sequence = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    busy = false;
  }

  function beginIdle() {
    idle?.abort();
    if (!active || !ready || rescued || document.hidden) return;
    const controller = new AbortController();
    idle = controller;
    const { signal } = controller;
    (async () => {
      while (active && !signal.aborted) {
        resetActors();
        setState('watching');
        await wait(1400, signal);
        setState('stalking');
        await motion(cat, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(-3px, 1px)' }], 600, signal);
        cat.dataset.pose = 'paw';
        setState('raising');
        await motion(cat, [{ transform: 'rotate(5deg)' }, { transform: 'rotate(0deg)' }], 500, signal);
        await wait(duration(350), signal);
        setState('tapping');
        await motion(cat, [{ transform: 'rotate(0deg)' }, { transform: 'translate(2px, -2px) rotate(-5deg)' }], 280, signal);
        onTap();
        person.dataset.pose = 'react';
        cat.dataset.pose = 'innocent';
        cat.style.transform = '';
        setState('innocent');
        await motion(person, [{ transform: 'translateY(0px)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0px)' }], 500, signal);
        await wait(1100, signal);
      }
    })().catch(error => { if (error.name !== 'AbortError') console.warn('Dad idle:', error); });
  }

  function reset() {
    stop();
    rescued = false;
    resetActors();
    setState('watching');
    beginIdle();
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
      setState('watching');
      beginIdle();
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

  function distract() {
    if (!active || !ready || busy || rescued || document.hidden) return false;
    idle?.abort(); idle = null;
    busy = true;
    resetActors();
    // Fix the discovered toy's world position during motion, including across resizes.
    const mouseStartX = parseFloat(getComputedStyle(mouse).left);
    const mouseRunX = 170 - mouseStartX;
    const mouseTurnX = 90 - mouseStartX;
    mouse.style.left = mouseStartX + 'px';
    const controller = new AbortController();
    sequence = controller;
    const { signal } = controller;
    onTrigger();
    (async () => {
      setState('revealing');
      // Reveal outside the cabinet before the squeak and the cat's reaction.
      element.dataset.toy = 'revealed';
      await motion(mouse, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(25px, 20px)' }], 620, signal);
      element.dataset.toy = 'active';
      onToyRevealed();
      setState('noticing');
      cat.dataset.pose = 'innocent';
      await wait(duration(550), signal);
      setState('chasing');
      cat.dataset.pose = 'walk';
      await Promise.all([
        motion(cat, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(-89px, 0px)' }], 900, signal),
        motion(mouse, [{ transform: mouse.style.transform }, { transform: `translate(${mouseRunX - 40}px, 32px)` }], 900, signal)
      ]);
      setState('jumping');
      cat.dataset.pose = 'jump';
      cat.style.zIndex = '50';
      await Promise.all([
        motion(cat, [
          { transform: 'translate(-89px, 0px)', offset: 0 },
          { transform: 'translate(-124px, -25px) rotate(3deg)', offset: 0.32 },
          { transform: 'translate(-154px, 235px) rotate(0deg)', offset: 1 }
        ], 900, signal),
        motion(mouse, [{ transform: mouse.style.transform }, { transform: `translate(${mouseRunX}px, 32px)` }], 900, signal)
      ]);
      setState('relieved');
      person.dataset.pose = 'react';
      await motion(cat, [
        { transform: 'translate(-154px, 235px) scale(1.03, 0.97)' },
        { transform: 'translate(-154px, 235px)' }
      ], 230, signal);
      await motion(mouse, [
        { transform: mouse.style.transform },
        { transform: `translate(${mouseRunX}px, 32px) scaleX(-1)`, offset: 0.25 },
        { transform: `translate(${mouseTurnX}px, 32px) scaleX(-1)`, offset: 1 }
      ], 550, signal);
      await wait(duration(1000), signal);
      if (!active || signal.aborted) return;
      person.dataset.pose = 'watch';
      cat.dataset.pose = 'play';
      busy = false; rescued = true; rounds++;
      setState('rescued');
      onComplete(rounds);
    })().catch(error => {
      if (error.name !== 'AbortError' && active && sequence === controller) {
        busy = false;
        resetActors();
        setState('error');
        console.warn('Dad sequence:', error);
      }
    }).finally(() => { if (sequence === controller) sequence = null; });
    return true;
  }

  mouse.addEventListener('click', distract);
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    element.classList.toggle('is-suspended', document.hidden);
    if (document.hidden) {
      stop();
      if (ready && !rescued) { resetActors(); setState('watching'); }
    } else if (ready && !rescued) beginIdle();
  });
  return Object.freeze({
    enter, leave,
    replay: () => { if (!active || busy) return; if (!ready) enter(); else reset(); },
    get busy() { return busy; }, get rescued() { return rescued; }
  });
};
