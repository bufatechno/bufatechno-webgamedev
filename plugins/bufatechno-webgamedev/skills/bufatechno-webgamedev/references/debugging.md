# Debugging Playbook — Revise & Fix Accurately

> Systematic fault isolation for games built with this skill. Rule #1: **reproduce first,
> then read the console, then fix the smallest thing that explains all symptoms.**
> Never edit blindly, never change two systems at once. After every fix, follow the
> revision loop (`testing-deployment.md` §2b): full automated suite → affected manual rows.

## 1. Triage Order (always in this sequence)

1. **Console** (errors/warnings) — 80% of bugs announce themselves here.
2. **Network tab** — 404s on importmap/CDN/assets explain blank screens and missing models.
3. **State** — log `game.state` transitions; most "game frozen" bugs are a stuck state machine.
4. **Frame** — log `dt` and FPS; spiral (dt spikes) vs leak (slow decay) need opposite fixes.
5. **Isolate** — disable systems in reverse Phase 5 order (audio → VFX → physics → animation)
   until the symptom disappears. The last disabled system owns the bug.

## 2. Symptom → Cause → Fix

### Black/blank screen, no console error
- **Cause:** render loop never started (`requestAnimationFrame` gated behind overlay click
  that never fired) or camera inside geometry.
- **Fix:** confirm `start()` runs on overlay click; set camera to a known-good transform
  `(0, 1.7, 5)` looking at origin; render one unlit cube first, then re-enable systems.

### `Failed to resolve module specifier` / blank Path A page
- **Cause:** importmap typo, or a pinned file that no longer exists on the CDN
  (real case: `three/tsl` → `examples/jsm/nodes/Nodes.js` 404'd in r175; correct pin is
  `build/three.tsl.js`).
- **Fix:** open each importmap URL directly in a tab (must return 200, not 404/HTML);
  run the skill's `RUN_NETWORK_TESTS=1 npm run test:skill` to HEAD all pins at once.

### `WebGL warning` / context creation failed
- **Cause:** too many contexts (multiple canvases), or GPU-blocklisted browser.
- **Fix:** one canvas per page; handle `webglcontextlost` (re-create on `webglcontextrestored`,
  see manual matrix edge cases); cap DPR at 2; test on integrated-GPU laptop profile.

### TSL / WebGPU shader errors (`three/webgpu`, `three/tsl`)
- **Cause:** TSL node graph type mismatch, or running WebGPU-only nodes on the WebGL fallback.
- **Fix:** build the material on `WebGLRenderer` first (error messages are clearer), then move
  to `WebGPURenderer`; keep one TSL tweak per material while debugging; never mix `three/nodes`
  legacy imports with `three/tsl`.

### No audio (but game runs)
- **Cause:** `AudioContext` created before user gesture → `suspended` state (autoplay policy),
  or mute gain left at 0 after testing.
- **Fix:** create/resume context inside the overlay click handler; assert
  `ctx.state === 'running'` after start; keep master/music/sfx gains inspectable in console.

### Pointer lock fails / mouse-look dead
- **Cause:** `requestPointerLock` called without user gesture, on the wrong element, or exited
  via Esc without a re-lock path.
- **Fix:** request lock on the canvas inside the click handler (`canvas.requestPointerLock?.()`);
  listen for `pointerlockchange` to pause when lock is lost; keyboard listeners on `window`.

### Havok WASM fails to load (Babylon)
- **Cause:** wrong `@babylonjs/havok` version for the engine, or `HavokPhysics()` awaited
  after scene creation instead of before.
- **Fix:** keep engine + havok pins in lockstep (see skill pin table); `await HavokPhysics()`
  during boot with a loading overlay; Lite kinematic fallback if the import rejects.

### Player falls through floor / tunnels at speed
- **Cause:** single raycast ground check with large per-frame displacement, or physics step
  larger than the thinnest collider.
- **Fix:** clamp dt (0.1), keep physics on fixed 1/60 STEP, enable CCD on fast bodies,
  thicken critical colliders; verify with the slow-motion test (STEP × 0.1, no tunneling).

### Animation doesn't play (model static / T-pose)
- **Cause:** `mixer.update()` never called with real delta, clip name mismatch after
  re-export, or cloned skinned mesh sharing one skeleton incorrectly.
- **Fix:** log `gltf.animations.map(a => a.name)`; clone characters with
  `SkeletonUtils.clone` (not `.clone()`); one `AnimationMixer` per skeleton root;
  confirm `mixer.update(dt)` runs every frame via a frame counter.

### FPS decay over 60s (leak, not spike)
- **Cause:** undisposed geometries/materials/textures on respawn, or unbounded pools/arrays.
- **Fix:** every GPU resource gets `.dispose()` on teardown; pools have `maxSize` + steal-oldest;
  profile with `renderer.info` (calls/geometries/textures must plateau, not climb).

### Stale game after deploy (PWA serves old bundle)
- **Cause:** service worker cache version not bumped.
- **Fix:** bump cache name (`CACHE = 'my-game-vN'`) on every deploy; verify `dist/` build
  locally with `npm run preview` before publishing.

## 3. Revision Protocol (accuracy, not speed)

1. **Reproduce** with exact steps + record console/network output verbatim.
2. **Hypothesize one cause** from §2; check the cheapest evidence first (console > network > state).
3. **Minimal fix** — one system, smallest diff; no refactors inside a bugfix.
4. **Re-run full automated suite** (`node --test test/`), then the affected manual rows.
5. **Record** in the game README under `Known issues / Fixes`: symptom, cause, fix, test that guards it.
   A bug fixed without a guarding test will return.

## 4. What NOT to Do

- Do not "fix" by adding a library (physics engine won't cure a state-machine bug).
- Do not silence console errors with `try/catch {}` — log and route to the triage order.
- Do not change frame loop, physics step, and animation driver in the same edit.
- Do not ship a fix verified only by "it looks fine" — automated suite first, always.
