/* Xiaole's stool: jump and swat, withdraw the foot, then settle. */
(() => {
  window.createStoolScene = ({ board, cat, foot, onState, onTrigger, onComplete }) => {
    let active = false, loaded = false, state = 'off', generation = 0;
    const animations = new Set();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const poses = {
      jump: 'assets/art-v1/cats/cat-pounce.png',
      guard: 'assets/art-v1/cats/cat-paw-raised.png',
      rest: 'assets/art-v1/cats/cat-loaf.png'
    };
    const live = token => active && token === generation;
    function setState(next) {
      state = next;
      board.dataset.stoolState = next;
      foot.disabled = next !== 'guarding';
      onState(next);
    }
    function cancel() {
      generation++;
      animations.forEach(animation => animation.cancel());
      animations.clear();
    }
    function resize() {
      if (!active) return;
      const { width, height } = board.getBoundingClientRect();
      board.style.setProperty('--stool-cat-size', `${Math.min(width * .75, height * .85)}px`);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(board);
    async function animate(element, frames, duration, token) {
      if (!live(token)) return false;
      const animation = element.animate(frames, {
        duration: reduced.matches ? 1 : duration,
        easing: 'cubic-bezier(.25,.65,.3,1)', fill: 'both'
      });
      animations.add(animation);
      try { await animation.finished; return live(token); }
      catch { return false; }
      finally { animations.delete(animation); animation.cancel(); }
    }
    async function enter() {
      cancel(); active = true; loaded = false;
      const token = generation;
      foot.hidden = false;
      cat.src = poses.jump;
      resize(); setState('loading');
      try {
        await Promise.all([...Object.values(poses), 'assets/art-v1/props/sock-foot.png'].map(src => {
          const image = new Image(); image.src = src; return image.decode();
        }));
        if (!live(token)) return;
        loaded = true;
        if (document.hidden) { cat.src = poses.guard; setState('guarding'); return; }
        setState('jumping');
        if (!await animate(cat, [
          { transform: 'translate(18%, 48%) rotate(10deg)' },
          { transform: 'translate(4%, -7%) rotate(-5deg)', offset: .75 },
          { transform: 'translate(0, 0) rotate(0deg)' }
        ], 650, token)) return;
        cat.src = poses.guard;
        setState('swatting');
        if (!await animate(cat, [
          { transform: 'rotate(0deg)' },
          { transform: 'translateX(-3%) rotate(-5deg)', offset: .45 },
          { transform: 'rotate(0deg)' }
        ], 320, token)) return;
        setState('guarding');
      } catch {
        if (live(token)) setState('error');
      }
    }
    async function withdraw() {
      if (!active || state !== 'guarding') return;
      const token = generation;
      onTrigger(); setState('withdrawing');
      if (!await animate(foot, [
        { transform: 'translate(0, 0)', opacity: 1 },
        { transform: 'translate(-110%, 80%)', opacity: 0 }
      ], 460, token)) return;
      foot.hidden = true;
      cat.src = poses.rest;
      setState('settling');
      if (!await animate(cat, [
        { transform: 'translateY(-3%) scaleY(1.04)' },
        { transform: 'translateY(0) scaleY(1)' }
      ], 330, token)) return;
      setState('settled');
      onComplete();
    }
    foot.addEventListener('click', withdraw);
    document.addEventListener('visibilitychange', () => {
      if (!active || !document.hidden || state === 'settled' || state === 'error') return;
      cancel();
      if (loaded) {
        foot.hidden = false; cat.src = poses.guard; setState('guarding');
      } else {
        // Asset loads can finish while hidden; the fresh entry has its own token.
        enter();
      }
    });
    return {
      enter,
      leave() {
        active = false; cancel(); state = 'off';
        foot.disabled = true; foot.hidden = true;
        board.dataset.stoolState = 'off';
      },
      get busy() { return active && !['guarding', 'settled', 'error'].includes(state); },
      get finished() { return active && state === 'settled'; }
    };
  };
})();
