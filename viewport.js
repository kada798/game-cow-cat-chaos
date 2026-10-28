(() => {
  const viewport = document.getElementById('viewport');
  const frame = document.getElementById('gameFrame');
  const stage = document.getElementById('game');
  const config = getComputedStyle(viewport);
  const designWidth = parseFloat(config.getPropertyValue('--design-width'));
  const designHeight = parseFloat(config.getPropertyValue('--design-height'));
  const minHeight = parseFloat(config.getPropertyValue('--scene-min-height'));
  let resizeFrame = 0;

  function resizeStage() {
    const style = getComputedStyle(viewport);
    const safe = (side) => parseFloat(style.getPropertyValue(`--safe-${side}`)) || 0;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const availableWidth = width - safe('left') - safe('right');
    const availableHeight = height - safe('top') - safe('bottom');
    if (availableWidth <= 0 || availableHeight <= 0) return;

    // Extend the room to the screen edges; crop only unused space above the actors.
    const scale = Math.min(availableWidth / designWidth, availableHeight / minHeight);
    frame.style.setProperty('--stage-scale', scale);
    frame.style.setProperty('--world-width', `${width / scale}px`);
    frame.style.setProperty('--world-height', `${height / scale}px`);
    frame.style.setProperty('--scene-center-x', `${(safe('left') + availableWidth / 2) / scale}px`);
    frame.style.setProperty('--scene-bottom', `${safe('bottom') / scale}px`);
    frame.style.setProperty('--min-hit-size', `${44 / scale}px`);
    frame.style.setProperty('--scene-visible-left', `${(designWidth - availableWidth / scale) / 2}px`);
    frame.classList.add('is-ready');
  }

  function scheduleResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resizeStage);
  }

  function getSceneBounds() {
    return stage.querySelector('.scene.is-active').getBoundingClientRect();
  }

  // The room can expand without changing the actors' original design coordinates.
  function toScenePoint(clientX, clientY) {
    const bounds = getSceneBounds();
    const screen = frame.getBoundingClientRect();
    const x = (clientX - bounds.left) * designWidth / bounds.width;
    const y = (clientY - bounds.top) * designHeight / bounds.height;
    const visible = clientX >= screen.left && clientX <= screen.right
      && clientY >= screen.top && clientY <= screen.bottom;
    return { x, y, inside: visible && x >= 0 && x <= designWidth && y >= 0 && y <= designHeight };
  }

  function toScreenPoint(x, y) {
    const bounds = getSceneBounds();
    return {
      x: bounds.left + x * bounds.width / designWidth,
      y: bounds.top + y * bounds.height / designHeight
    };
  }

  window.playableViewport = Object.freeze({ designWidth, designHeight, toScenePoint, toScreenPoint });
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(scheduleResize).observe(viewport);
  resizeStage();
})();
