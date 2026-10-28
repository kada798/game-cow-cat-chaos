window.createAmbushScene = ({ element, onStateChange, onTrigger, onBallLanded, onComplete, playSound }) => {
  const ball = element.querySelector('#ambushBall');
  const ballMotion = element.querySelector('.ambush-ball-motion');
  const ballShadow = element.querySelector('.ambush-ball-shadow');
  const girl = element.querySelector('.ambush-girl');
  const hiddenCat = element.querySelector('.ambush-hidden-cat');
  const runner = element.querySelector('.ambush-runner');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const home = { x: 155, y: 654 };
  const hand = { x: 339, y: 434 };
  const ballLanding = { x: 310, y: 694 };
  let active = false;
  let ready = false;
  let busy = false;
  let rounds = 0;
  let entry = 0;
  let idle = null;
  let sequence = null;

  const duration = ms => reducedMotion.matches ? Math.min(ms, 140) : ms;
  const aborted = () => new DOMException('Scene interrupted', 'AbortError');

  function wait(ms, signal) {
    if (signal.aborted) return Promise.reject(aborted());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
      const cancel = () => { clearTimeout(timer); reject(aborted()); };
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  async function motion(target, frames, ms, signal, easing = 'ease-in-out') {
    if (signal.aborted) throw aborted();
    const animation = target.animate(frames, { duration: duration(ms), easing, fill: 'forwards' });
    animations.add(animation);
    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await animation.finished;
      if (signal.aborted) throw aborted();
      for (const [property, value] of Object.entries(frames[frames.length - 1])) {
        if (property !== 'offset' && property !== 'easing') target.style[property] = value;
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
    ball.disabled = !ready || busy || ballMotion.dataset.ball !== 'hand';
    onStateChange(state, busy);
  }

  function resetBall() {
    ballMotion.style.transform = 'translate(0px, 0px) rotate(0deg)';
    ballMotion.dataset.ball = 'hand';
    ballShadow.style.opacity = '0';
    ballShadow.style.transform = '';
  }

  function resetActors(keepBall = false) {
    hiddenCat.style.transform = 'translate(0px, 6px)';
    runner.style.transform = 'translate(0px, 0px)';
    runner.style.opacity = '0';
    runner.style.zIndex = '20';
    runner.dataset.pose = 'leap';
    girl.style.transform = '';
    if (!keepBall) resetBall();
  }

  function stop() {
    idle?.abort();
    sequence?.abort();
    idle = null;
    sequence = null;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    busy = false;
    resetActors();
  }

  function beginIdle(delay = 1000) {
    idle?.abort();
    const controller = new AbortController();
    idle = controller;
    const { signal } = controller;
    (async () => {
      while (active && !signal.aborted) {
        setState('hidden');
        await wait(delay, signal);
        setState('peek');
        await motion(hiddenCat, [{ transform: 'translate(0px, 6px)' }, { transform: 'translate(0px, 0px)' }], 460, signal);
        await motion(hiddenCat, [{ transform: 'translate(0px, 0px)' }, { transform: 'translate(2px, 0px)' }, { transform: 'translate(0px, 0px)' }], 1500, signal);
        await wait(850, signal);
        setState('hidden');
        await motion(hiddenCat, [{ transform: hiddenCat.style.transform }, { transform: 'translate(0px, 6px)' }], 320, signal);
        delay = 1700;
      }
    })().catch(error => { if (error.name !== 'AbortError') console.warn('Ambush idle:', error); });
  }

  async function enter() {
    leave();
    active = true;
    ready = false;
    element.classList.remove('is-ready');
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
      resetActors();
      if (!document.hidden) beginIdle();
      else setState('hidden');
    } catch (error) {
      if (active && version === entry) { ready = false; setState('error'); }
    }
  }

  function leave() {
    active = false;
    entry += 1;
    stop();
    element.dataset.state = 'hidden';
    element.setAttribute('aria-busy', 'false');
  }

  function trigger() {
    if (!active || !ready || busy || document.hidden) return false;
    idle?.abort();
    idle = null;
    busy = true;
    const controller = new AbortController();
    sequence = controller;
    const { signal } = controller;
    const destination = { x: ballLanding.x - 47, y: ballLanding.y + 12 };
    const dx = destination.x - home.x, dy = destination.y - home.y;
    resetBall();
    onTrigger(ballLanding);

    (async () => {
      setState('dropping');
      // Emerge from behind the hand before falling; all points use scene coordinates.
      const bx = ballLanding.x - hand.x, by = ballLanding.y - hand.y;
      ballMotion.dataset.ball = 'moving';
      await Promise.all([
        motion(ballMotion, [
          { transform: 'translate(0px, 0px) rotate(0deg)', offset: 0 },
          { transform: 'translate(13px, 12px) rotate(15deg)', offset: 0.15 },
          { transform: `translate(${bx + 3}px, ${by}px) rotate(95deg)`, offset: 0.64 },
          { transform: `translate(${bx - 2}px, ${by - 23}px) rotate(119deg)`, offset: 0.80 },
          { transform: `translate(${bx}px, ${by}px) rotate(145deg)`, offset: 1 }
        ], 860, signal, 'linear'),
        motion(ballShadow, [{ opacity: 0, transform: 'scale(0.45)' }, { opacity: 1, transform: 'scale(1)' }], 860, signal)
      ]);
      ballMotion.dataset.ball = 'floor';
      setState('ball-landed');
      onBallLanded(ballLanding);
      await wait(duration(180), signal);
      setState('peek');
      await motion(hiddenCat, [{ transform: hiddenCat.style.transform }, { transform: 'translate(0px, 0px) rotate(0deg)' }], 260, signal);
      setState('crouch');
      await motion(hiddenCat, [{ transform: 'translate(0px, 0px) scale(1)' }, { transform: 'translate(6px, 1px) scale(0.98)' }], 320, signal);
      await wait(duration(380), signal);

      setState('pounce');
      runner.style.opacity = '1';
      runner.dataset.pose = 'leap';
      runner.style.zIndex = '20';
      // Keep the first part of the leap behind the registered sofa foreground.
      await Promise.all([
        motion(runner, [
          { transform: 'translate(0px, 0px) rotate(-3deg) scale(0.96)', offset: 0 },
          { transform: `translate(${dx * 0.28}px, ${dy * 0.18}px) rotate(0deg) scale(1.02)`, offset: 0.35 },
          { transform: `translate(${dx * 0.76}px, ${dy * 0.70}px) rotate(3deg) scale(1.04)`, offset: 0.75 },
          { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(1)`, offset: 1 }
        ], 540, signal, 'cubic-bezier(.32,.05,.72,.8)'),
        (async () => { await wait(duration(260), signal); runner.style.zIndex = '50'; })()
      ]);

      setState('land');
      playSound();
      await Promise.all([
        motion(runner, [{ transform: `translate(${dx}px, ${dy}px) scale(1.04,0.96)` }, { transform: `translate(${dx}px, ${dy}px) scale(1)` }], 260, signal),
        motion(ballMotion, [{ transform: ballMotion.style.transform }, { transform: `translate(${bx + 8}px, ${by}px) rotate(170deg)` }], 260, signal),
        motion(ballShadow, [{ transform: 'translateX(0px)' }, { transform: 'translateX(8px)' }], 260, signal),
        motion(girl, [{ transform: 'translate(0px, 0px) rotate(0deg)' }, { transform: 'translate(0px, -3px) rotate(-1deg)', offset: 0.38 }, { transform: 'translate(0px, 0px) rotate(0deg)' }], 380, signal)
      ]);
      await wait(duration(420), signal);

      setState('retreat');
      runner.dataset.pose = 'ground';
      await Promise.all([
        motion(runner, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: `translate(${dx * 0.48}px, ${dy * 0.48}px)`, offset: 0.52 }, { transform: 'translate(0px, 0px)' }], 820, signal),
        (async () => { await wait(duration(390), signal); runner.style.zIndex = '20'; })()
      ]);
      if (!active || signal.aborted) return;
      busy = false;
      rounds += 1;
      resetActors(true);
      setState('hidden');
      onComplete(rounds);
      beginIdle(1900);
    })().catch(error => {
      if (error.name !== 'AbortError' && active && sequence === controller) {
        busy = false;
        resetActors();
        setState('error');
        console.warn('Ambush sequence:', error);
      }
    }).finally(() => { if (sequence === controller) sequence = null; });
    return true;
  }

  ball.addEventListener('click', () => trigger());
  document.addEventListener('visibilitychange', () => {
    if (!active || !ready) return;
    stop();
    if (document.hidden) setState('hidden');
    else beginIdle(800);
  });

  return Object.freeze({ enter, leave, trigger, replay: () => ready ? trigger() : enter(), get busy() { return busy; } });
};
