# Moo Cat Mischief Architecture

This demo is split into three browser-native files:

- `index.html` owns the scene markup and accessible labels.
- `style.css` owns layout, CSS-drawn props, the cat rig, UI feedback, and keyframe motion.
- `script.js` owns scene state, event tracking, input handling, particles, vibration, and toy audio.

## Scene Flow

The playable flow is configured in `script.js` through `sceneData`.

1. `closet`: catch the cat and rescue the stolen yarn.
2. `dad`: ring the electric mouse toy to distract the cat.
3. `stool`: move the foot so the cat can reclaim the stool.
4. `ending`: show the payoff and CTA.

Each interactive scene uses the same completion path:

`pointerdown` -> `completeScene(action)` -> add `.is-cleared` -> play CSS animation -> `showScene(next)` or `showEnding()`.

## Maintenance Notes

- Add new visual objects in `index.html`, then style them in the relevant section of `style.css`.
- Add new scene metadata in `sceneData` before wiring new event listeners.
- Prefer toggling classes from JavaScript and keeping animation details in CSS.
- Keep `moo_cat_mischief.html` as the previous single-file reference; use `index.html` for ongoing maintenance.
