# External Libraries — Curated Catalog (Lite vs Full Profiles)

> When native Three.js / Babylon.js is not enough: character controllers, skeletal helpers,
> collision acceleration, menu tweening, file audio, and free CC0 asset sources.
> **Philosophy: Lite by default, Full only opt-in.** Every Full library MUST have a
> procedural/native fallback so the game still runs when the CDN is offline (Path A)
> or the package is skipped (Path B). Read only the section you need — do not load
> this whole file into context at once.

## 1. Profiles — Lite (default) vs Full (opt-in)

| Profile | Rule | Bundle budget | When to use |
|---|---|---|---|
| **Lite** | Zero new dependencies. Native `three/addons/`, Babylon core/gui/loaders, procedural canvas/audio, hand-coded controllers | ~300KB tree-shaken | Default. One-shot deliverables, Path A double-click, weak models (≤14B), offline-first |
| **Full** | Curated libraries from §2–§6, loaded via importmap (Path A) or npm (Path B) | ≤1MB tree-shaken | User asks for realism, complex characters, rich menus, file-based audio, or physics-heavy gameplay |

**Selection rule:** start Lite. Upgrade to Full per-category only when a Lite limitation
is hit (e.g. capsule-vs-world collision too slow → `three-mesh-bvh`; menu feels dead → `gsap`;
footsteps need real samples → `howler`). Never add a Full library "just in case".
Record the choice in the game README as `Profile: Lite` or `Profile: Full (+lib names)`.

## 2. 3D Models & World Collision

### 2.1 Native first (Lite — no new dependency)

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Clone a skinned character correctly (shares geometry, clones bones)
const player = SkeletonUtils.clone(gltf.scene);
```

Babylon equivalent: `@babylonjs/loaders` (GLTF/File), `@babylonjs/materials`,
`@babylonjs/havok` for physics — all already in the Babylon template.

### 2.2 `three-mesh-bvh@^0.7` (Full — static world collision & raycast)

- **Use when:** capsule-vs-terrain, wall sliding, or DDA replacement on large meshes; 10–100x
  faster raycast than `THREE.Raycaster` on high-poly geometry.
- **Do NOT use when:** game is voxel/AABB-only (hand math is faster and dependency-free).
- Path A (importmap, commented in template until needed):
  ```html
  <!--"three-mesh-bvh": "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.0/build/index.module.js"-->
  ```
- Path B: `npm install three-mesh-bvh@^0.7.0`
- Pattern:
  ```js
  import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
  THREE.BufferGeometry.prototype.computeBoundsTree = MeshBVH.prototype.computeBoundsTree;
  terrain.geometry.computeBoundsTree(); // once
  ```
- **Fallback (REQUIRED):** keep the AABB/raycast ground check from Lite; if import fails,
  `try/catch` dynamic `import()` and continue with AABB physics.
- Credit: *three-mesh-bvh* by Garrett Johnson — MIT.

### 2.3 Free CC0 asset sources (no npm install — download, compress, bundle)

| Source | Best for | License |
|---|---|---|
| [Quaternius](https://quaternius.com) | Low-poly characters/animals/props, animated GLB | CC0 (credit appreciated, not required) |
| [Kenney.nl](https://kenney.nl) | Voxel/UI/audio packs, 2D sprites | CC0 |
| [Poly Pizza](https://poly.pizza) | Low-poly GLB props | CC0 / CC-BY (check per model) |
| [Mixamo](https://www.mixamo.com) | Rigged characters + `.fbx` animation clips (retarget to GLB) | Free with Adobe account (see §8 Credits) |

Pipeline after download: `gltf-transform draco` + KTX2 compress (see `asset-pipeline.md`),
store under `public/assets/`, keep the procedural fallback primitive if the file is missing.

## 3. Animation & Character Control

### 3.1 Native first (Lite)

`AnimationMixer` + `clipAction` weight lerp + `SkeletonHelper` + bone attach
(see `animation-system.md`). Third-person spring-arm and FPS rig from
`third-person-template.md` / `fps-game-template.md` — no library needed for standard cases.

### 3.2 `gsap@^3.12` (Full — UI tweening, cutscene easing, non-skeletal motion)

- **Use when:** menus, damage flashes, camera intro dollys, pickup bounce need easing.
- **Do NOT use for:** skeletal/character locomotion — that stays on `AnimationMixer`
  (mixing two animation drivers causes foot sliding and weight conflicts).
- Path A: `<!--"gsap": "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js"-->`
- Path B: `npm install gsap@^3.12.0`
- Pattern (menu only):
  ```js
  import { gsap } from 'gsap';
  gsap.fromTo('#overlay .cta', { scale: 0.96 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
  ```
- **Fallback:** CSS transitions on the same selector so the menu still animates without gsap.
- Credit: *GSAP* by GreenSock — free (no charge) license for most uses, see §8.

### 3.3 Physics engines (Full — pick ONE per game)

| Engine | Best with | Size note | Pick when |
|---|---|---|---|
| `cannon-es@^0.20` | Three.js Lite-Physics | Small, pure JS, CDN-friendly | Stacks, vehicles (raycast vehicle), ragdoll-lite, triggers |
| `@dimforge/rapier3d-compat@^0.14` | Three.js Full-Physics | WASM, larger | Deterministic multiplayer, CCD at high speed, joints |
| `@babylonjs/havok@^1.3.9` | Babylon.js only | WASM (already in Babylon template) | Babylon realism, character controllers, destruction |

- Path A cannon-es: `<!--"cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js"-->`
- Path B: `npm install cannon-es@^0.20.0` (or rapier / havok as above).
- **Fallback:** kinematic controller (WASD + raycast ground + AABB push-out) from Lite;
  physics is an upgrade, never a hard requirement for menu→playing→win/lose.
- Credits: *cannon-es* (MIT, fork of cannon.js by Stefan Hedman / schteppe);
  *Rapier* (Apache-2.0, Dimforge); *Havok for Babylon.js* (proprietary-free via Babylon, Havok/Microsoft).

## 4. 2D, Sprites & UI Art

### 4.1 Native first (Lite — covers 90% of games)

Procedural `CanvasTexture`, atlas, Sobel normal maps, `SpriteMaterial`, Babylon
`DynamicTexture` + `@babylonjs/gui` (see `2d-drawing-textures.md`, `audio-ui-systems.md`).
No 2D engine needed for HUD, hotbars, damage vignette, or pixel-art props.

### 4.2 `pixi.js@^8` (Full — ONLY for 2D-heavy games)

- **Use when:** the game is primarily 2D (card battler companion UI, complex particle UI,
  spine-like skeletal 2D) *and* lives alongside the 3D canvas as an overlay layer.
- **Do NOT use when:** the HUD is standard (health/ammo/score/menus) — DOM + CSS tokens
  per `design-system.md` is lighter, crisper at DPR2, and themeable.
- Path A: `<!--"pixi.js": "https://cdn.jsdelivr.net/npm/pixi.js@8.0.0/dist/pixi.min.mjs"-->`
- Path B: `npm install pixi.js@^8.0.0`
- **Fallback:** DOM HUD renders underneath; if Pixi fails to load, the DOM HUD is the game HUD.
- Credit: *PixiJS* — MIT.

## 5. Menus, HUD & Interface Helpers

### 5.1 Native first (Lite)

DOM + `:root` design tokens + themed overlay/HUD per genre (`design-system.md` §4).
Touch: hand-rolled `VirtualJoystick` + look pad (`input-controls.md`) — no dependency.

### 5.2 `nipplejs@^0.10` (Full — virtual joystick, optional)

- **Use when:** mobile twin-stick game where a polished, tested joystick beats hand-rolled touch.
- Path A: `<!--"nipplejs": "https://cdn.jsdelivr.net/npm/nipplejs@0.10.1/dist/nipplejs.min.js"-->`
- Path B: `npm install nipplejs@^0.10.0`
- **Fallback:** hand-rolled joystick from `input-controls.md` stays in the codebase behind
  `if (!joystickLib)`.
- Credit: *nipplejs* by Sébastien Altman — MIT.

### 5.3 `howler@^2.2` (Full — file-based music/voice)

- **Use when:** user supplies `.mp3/.ogg` music tracks or voice lines; procedural Web Audio
  (Lite) covers SFX but not full songs.
- Path B: `npm install howler@^2.2.0` (Howler has no official ESM CDN build — Path A games
  should use native `decodeAudioData` file cache from `audio-ui-systems.md` instead).
- **Fallback:** procedural music loop keeps playing if the file is missing; mute toggle
  controls both paths.
- Credit: *howler.js* by James Simpson (GoldFire Studios) — MIT.

## 6. Loading Pattern — CDN (Path A) and npm (Path B)

**Path A (importmap + graceful degradation):**

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/"
  /* Full opt-ins — uncomment only what the game uses:
  ,"cannon-es": "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js",
  "three-mesh-bvh": "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.0/build/index.module.js",
  "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js",
  "nipplejs": "https://cdn.jsdelivr.net/npm/nipplejs@0.10.1/dist/nipplejs.min.js" */
} }
</script>
```

```js
// Lazy + safe: Full libs never block the Lite playable path
let cannon = null;
try { cannon = await import('cannon-es'); } catch { /* Lite kinematic controller */ }
```

**Path B (npm + `optionalDependencies` in the game `package.json`):**

```bash
npm install three@^0.175.0            # Lite core (always)
npm install -D vite@^7.0.0            # build (always)
# Full opt-ins — install only what the game uses:
npm install cannon-es@^0.20.0         # or @dimforge/rapier3d-compat@^0.14
npm install three-mesh-bvh@^0.7.0 gsap@^3.12.0 howler@^2.2.0 nipplejs@^0.10.0
```

## 7. External-Library Anti-Slop Rules (REQUIRED for Full games)

Full libraries must not reintroduce generic output through the back door:

1. **Themed usage only** — gsap easings, nipplejs colors, Howler track choice must match the
   genre palette/mood from `design-system.md`. A default blue joystick on a horror game is slop.
2. **No default-look leakage** — remove `nipplejs` default white zone, gsap demo timings,
   Pixi sample assets. Every visible Full artifact gets design tokens.
3. **No double drivers** — one animation driver per object (Mixer XOR gsap, never both on
   the same bone/property in the same frame).
4. **Fallback proven** — before ship, block the CDN (offline devtools) and confirm:
   menu→playing→win/lose still completes on the Lite path.
5. **Attribution shipped** — every Full library used is listed in the game README
   `Credits` section (name, author, license, version). Missing attribution fails validation.

Validation additions (extend Phase 6 checklist):

- [ ] `Profile:` declared in game README (Lite, or Full + library names + versions)
- [ ] Each Full library has a working Lite fallback (CDN-blocked run passes)
- [ ] No default/unthemed third-party visuals (joystick, menus, demo easings themed)
- [ ] `Credits` lists every third-party script with author + license

## 8. Credits & Licenses (third-party code and assets referenced here)

| Project | Author / Owner | License | Used for |
|---|---|---|---|
| `three` | three.js authors (mrdoob) | MIT | 3D engine core |
| `three-mesh-bvh` | Garrett Johnson (gkjohnson) | MIT | BVH collision/raycast accel |
| `@babylonjs/*`, Havok plugin | Babylon.js team / Microsoft Havok | Apache-2.0 / free-via-Babylon | 3D engine, GUI, physics |
| `cannon-es` | cannon-es contributors (fork of cannon.js by Stefan Hedman) | MIT | Lightweight physics |
| `@dimforge/rapier3d-compat` | Dimforge | Apache-2.0 | Deterministic physics |
| `gsap` | GreenSock | Free (no-charge) / Club GreenSock for special bonuses — check [GreenSock licensing](https://gsap.com/licensing/) | Tweening/menus |
| `howler.js` | James Simpson / GoldFire Studios | MIT | File audio |
| `nipplejs` | Sébastien Altman | MIT | Virtual joystick |
| `pixi.js` | PixiJS team | MIT | 2D-heavy overlay |
| `es-module-shims` | Guy Bedford | MIT | Path A importmap fallback |
| `vite` | Evan You / Vite team | MIT | Build tooling |
| Quaternius assets | Quaternius (Tom) | CC0 | Characters/props/models |
| Kenney assets | Kenney Vleugels | CC0 | Sprites/audio/UI packs |
| Poly Pizza models | Poly Pizza contributors | CC0 / CC-BY per model — verify each download | Props |
| Mixamo characters/animations | Adobe | Free with account — see [Mixamo terms](https://www.mixamo.com/) | Rigs + clips |

> License notes are summaries, not legal advice. Verify the linked terms before
> commercial use, and ship attribution in every game that uses these works.
