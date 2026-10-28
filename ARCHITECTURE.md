# Moo Cat Mayhem Architecture

## Offline Chinese, English and French

index.html loads locales/zh.js, locales/en.js and locales/fr.js, then i18n.js before story.js. Each catalog has the same 184 keys. A canonical Chinese source-to-key index bridges the existing narrative and controller hint strings to the catalogs; developer-only story sources, shots and implementation notes remain Chinese.

catI18n.write(element, source, params) binds display text; catI18n.attribute(element, name, source, params) binds accessible labels and decorative captions. hydrate handles initial static markup and generated story controls. Bindings live on their own DOM nodes, so detached action buttons do not accumulate in a global registry. CSS note/illustration captions read translated data attributes instead of fixed text.

Language selection uses a valid URL parameter, saved manual choice, browser language, then Chinese. Manual switching updates html.lang, document title, metadata, bound text and chapter options in place. It never calls showScene, enter, leave, renderActions or any completion callback, preserving animations, audio, steps and progress. Storage and history failures are caught so direct file use and restricted/private modes still work. The URL retains scene and other query parameters.

Catalog parity and runtime text coverage are tested in tests/i18n.cjs, alongside all three complete story playthroughs, live switches during original animation, preference precedence, denied storage, keyboard-compatible native selector and six responsive viewport sizes. The pre-existing suites explicitly request lang=zh.

## Stool scene (third chapter)

stool.js owns a cancellable jump/swat → guarding → withdrawing → settling → settled sequence inside the shared story board. Only clicking the visible foot completes it; the cat lies down after the foot has withdrawn. The original sock-foot and three cat poses are reused with their registered ground/toe anchors and a CSS stool. ResizeObserver updates the shared cat-size variable without resetting state. Page hiding cancels unfinished actions and restores the guard; chapter leave cancels all pending work. Image decode errors expose chapter replay for retry. storySpine.busy participates in Next gating, and showScene calls storySpine.leave before switching. Language changes only update bound strings.

## Thirteen-chapter story spine (current)

The entry now runs arrival → ambush → stool → yarn → dad → teddy → footprints → bedtime → morning → study → departure → photos → ending. STORYBOARD.md specifies narrative provenance, storyboard and prototype limits.

story.js loads before script.js, supplies window.catStory, creates the missing section placeholders, orders all thirteen sections, and builds the narrative overlay and chapter navigation. script.js routes by ID, preserving the four original controllers and their enter/leave cancellation. Completion history is a Set of IDs; currentReady gates explicit Next per entry. The picker permits previewing any chapter without marking skipped chapters complete. Re-entry resets interaction steps, replay resets the current chapter, and restart clears session completion. No storage or network dependency was added.

Other new chapter interactions are synchronous point-and-click story beats. They are scaffolding for future drag/route mechanics. The original endingCat remains keyboard/touch accessible in the narrative board; petting completes the final chapter and enables a localized restart action. Ending is a memory, not an asserted real reunion. Legacy automatic timed scene completion and the store placeholder CTA were removed.

story.css uses a screen-pixel overlay within the safe-area UI; original actor geometry, artwork, viewport conversion and controllers remain unchanged. It reuses the existing room and cat PNGs; there is no new generated art. STORYBOARD.md documents that the morning scene is an earlier memory.

tests/story.cjs covers all thirteen chapters, original puzzle integration, feedback, replay, previous/picker/restart, keyboard, interrupted original controller cleanup and six viewport sizes. Earlier per-controller tests remain for detailed lifecycle and art checks.


This demo uses browser-native HTML, CSS, and JavaScript:

- `index.html` owns the scene markup and accessible labels.
- `style.css` owns layout, CSS-drawn props, the cat rig, UI feedback, and keyframe motion.
- `script.js` owns scene state, event tracking, input handling, particles, vibration, and toy audio.
- `viewport.js` owns stage fitting and screen-to-scene coordinate conversion.
- `ambush.js` owns the repeatable illustrated ambush state machine, input lock, cancellable animation, image readiness, and visibility cleanup.
- `ambush.css` owns only the illustrated room, registered sofa layers, sprites, hidden soccer-ball target, and ambush controls.
- `yarn.js` owns the yarn rescue, wrong-target feedback, distraction sequence, replay, and cancellation.
- `yarn.css` owns the yarn props and cat sprites; illustrated scenes share the room/HUD presentation via `.is-illustrated`.
- `dad.js` and `dad.css` own the bald father's harmless tap loop, hidden mouse discovery, chase and repeatable rescue.
- `teddy.js` and `teddy.css` own alternating paw pressure, the white plush face, family arrival and the frozen reaction.

## Illustrated Ambush

The original ambush scene is `ambush`. It reads transparent PNGs from `assets/art-v1`, with background and sofa foreground kept separate from actors. The existing 390 x 844 coordinates and full-screen viewport remain unchanged.

The idle loop alternates `hidden` and `peek`, using the photo-referenced `cat-under-sofa` sprite with a flattened body and chin near the floor. The sofa foreground covers its ears and back. A complete `girl-reading` character sits on the cushion, apparently reading while concealing a small soccer ball behind her hand and book. This scene has no television or media cabinet, and socks no longer trigger play. The ball's visible diameter is 2/3 of the normalized cat head, not 2/3 of the sprite canvas. The same independent ball moves from hand center [339, 434] to floor center [310, 694], with a short bounce and floor shadow.

Activating the ball by touch or keyboard runs `dropping -> ball-landed -> peek -> crouch -> pounce -> land -> retreat -> hidden`. The cancellable drop must settle and emit `ambush_ball_landed` before the cat charges. The paw contacts the ball and nudges it slightly. The ball stays on the floor after completion; Replay resets it behind the book before starting another drop. The first half of the launch and the final half of retreat stay behind the sofa foreground. Actors share the exported sprite anchor instead of positioning by visible image bounds; the girl's reaction transforms the complete sprite around her seat.

Input and replay are locked while a sequence is running. Replay is hidden during initial discovery and appears after completion (or for loading errors). Completion unlocks repeat play and a Next Scene button; it does not auto-advance. `scene_complete` is recorded once with action `tap_hidden_soccer_ball`, while `ambush_round_complete` is recorded for every round. Leaving the scene or hiding the page cancels waits and animations and restores the hand-held ball. Returning to the page resumes idle, not an orphaned pounce. Reduced-motion preferences shorten movement.

## Illustrated Yarn Rescue

The second scene is `yarn`, replacing the legacy closet/yarn placeholder. Loose `yarn-strands` are separate from a ball whose visible diameter is 0.8 of the normalized cat head. Registered `cat-yarn-play` / `cat-yarn-tug` frames, ball translation/rotation and the SVG connecting strand share one cancellable pull progress. Clicking the ball runs `guarded -> playing` and never completes the scene. The correct feather-and-bell target runs `attracting -> following -> rescuing -> rescued`.

The toy initially shows only a clipped corner at the viewport safe-left edge, using `--scene-visible-left` rather than the central 390px actor layer's edge. It reveals fully before the bell plays and the cat notices it. Its transient `data-toy` state is `hidden -> revealed -> active`; reset/leave restore `hidden`. The remaining capture and rescue do not alter the ball's scale.

Success stays on screen until explicit Next; Replay resets the props without recording scene completion twice in one entry. Hiding the page resets an unfinished rescue to `playing`; leaving cancels animations and pull-frame callbacks without emitting late events. Re-entering creates a fresh completion opportunity. Asset loading failures have an explicit Retry path. The toy audio context is unlocked in the click gesture; the bell plays once after reveal and respects mute/cancellation.

## Illustrated Dad Rescue

The third scene uses `dad-bald-watch` / `dad-bald-react` on a shared 768 x 1024 canvas and seat anchor [600, 640]. The dad watches television, with a smooth bald crown and short hair around the sides/back. Xiaole's unmirrored sprites alternate `watching -> stalking -> raising -> tapping -> innocent`: a gentle scalp tap, dad's puzzled head rub, then the cat feigns innocence. This idle loop has no countdown or loss state. The 160px cat canvas, sofa perch and scalp-contact transform are registered in scene coordinates.

Only a clipped cloth tail is visible beneath the television cabinet. Activating `#hiddenMouse` by pointer or keyboard runs `revealing -> noticing -> chasing -> jumping -> relieved -> rescued`. The mouse is a separate felt toy with a winding key; it comes out before squeaking, runs automatically, and turns after the cat's pounce. Dad then resumes television. Audio is unlocked in the activation gesture and closed on mute, cancellation or completion.

Success waits for explicit Next; Replay resets the hidden mouse and the idle performance. Scene completion is recorded once per entry, while round completion increments per replay. Pending decodes, idle loops, waits and animations cannot complete after leave; hidden-page interruptions reset unfinished actions without late sound or completion. Asset failures expose Retry. Reduced-motion mode shortens movements without changing state order.

The original controllers retain their illustrated art; the ending now uses the shared narrative overlay. `?scene=ambush|yarn|dad|teddy` is an allowlisted developer preview route; without it, play starts at arrival.

## Illustrated Teddy Scene

The fourth scene uses the approved sage/teal pet bed, white stuffed teddy and separate crouching dad / kneeling girl. Bed front and back share a 1024 x 640 canvas. The white teddy's head and body share a 768 x 512 canvas. Cat knead body and both paw fragments share a 512 canvas and [256, 448] anchor with the complete `cat-knead` sprite, also used for the frozen state to preserve the approved markings and proportions. The old `cat-frozen` image is retained only as an unused art variant; none of these sprites are independently trimmed or mirrored.

The fourth scene's bed/bear/cat registration is grouped in `.teddy-play`. Portrait screens scale this group together while placing both witnesses at the right, vertically separated so the girl's head does not hide the dad's foot contact. Landscape screens keep the original play-group scale and place the witnesses on opposite sides. Floor anchors are below the room background's wooden-floor boundary, not aligned with the top of the bed.

Idle `kneading` uses one frame progress to move the far and near paws in opposition and gently compress the teddy head. The cat body is not translated. Clicking the teddy unlocks sound and runs `calling -> approaching -> watching -> frozen`. Paw motion continues while both family members approach, then stops when they arrive. The final pose retains the same face and markings and remains completely still. This is a fabric toy, with no injury or punishment.

Completion is explicit: no legacy auto-advance. Replay hides the family, restores the original face/paws and restarts kneading; scene completion is once per entry, round completion per replay. Hidden-page interruptions and leave cancel animations, waits and the knead frame callback without a late audience arrival or completion. Failed image decode can retry. Reduced motion keeps the same interaction sequence but does not continuously knead.

## Responsive Frame

Dad scene geometry: the cat perch is [339, 485], with white toe silhouettes resting slightly into the upholstered upper edge. The tap transform compensates for the lowered perch, while the jump still lands at [185, 720]. The dad sits 24 logical pixels farther right than the initial layout. The new `media-tv-side` asset shows the left chassis and a foreshortened screen facing right toward Dad; its safe-area-responsive position leaves a viewing gap without clipping it on phones. The hidden mouse follows the cabinet until discovery. Its world origin is then locked and the run distances are derived from that origin, preserving the destination on resize.

- Each scene keeps a fixed 390 x 844 actor coordinate space, defined by CSS variables.
- The room and frame fill the entire dynamic browser viewport with no letterboxing or desktop width cap.
- The room expands horizontally on wide screens. The camera can remove up to 144 unused design pixels above the actors to keep interactions large on short screens.
- Actors scale uniformly and stay centered in the device's safe area, anchored above its bottom inset.
- The floor, walls, and background props extend across the room; the sibling UI layer stays within the device safe area and uses readable screen-pixel text and controls.
- Scene buttons include transparent hit areas that stay at least 44 x 44 screen pixels.
- Use `window.playableViewport.toScenePoint(clientX, clientY)` for future pointer-driven scene movement, and `toScreenPoint(x, y)` for the inverse mapping. Both follow the active actor layer, not the expanding background.
- Resizing changes only the frame, never the scene state or animation coordinates.

## Scene Flow

The playable flow is configured by window.catStory in story.js. See the thirteen-chapter section above. All chapters wait for explicit advancement, and each original controller retains its lifecycle and replay behavior.

## Verification

`tests/ambush.cjs` checks the hidden soccer ball, 2/3 head ratio, drop-before-pounce, replay, mute, interruptions, keyboard/reduced motion and the full first-to-third-to-ending flow. `tests/yarn.cjs` checks the yarn ratio, synchronized tug, clipped discovery, reveal-before-bell, rescue, wrong targets and lifecycle recovery. `tests/dad.cjs` checks no-timer idle taps, scalp-contact geometry, hidden-tail pixels, reveal-before-squeak, ordered pursuit, rapid taps, replay, mute, interruptions, load retry and keyboard/reduced motion. Each suite checks 12 viewport sizes. Dependencies are isolated in `tests/package.json`, not needed to play.

## Maintenance Notes

- Add new visual objects in `index.html`, then style them in the relevant section of `style.css`.
- Add new scene metadata in `sceneData` before wiring new event listeners.
- Prefer toggling classes from JavaScript and keeping animation details in CSS.
- Keep `moo_cat_mischief.html` as the previous single-file reference; use `index.html` for ongoing maintenance.
