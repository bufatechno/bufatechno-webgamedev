# Changelog

## v2.0.2 — 2026-09-03

### Changed
- Standardized language to English across all documentation: `SKILL.md`, `README.md`, `INSTALL.md`, `.gitignore`, `references/design-system.md`, `assets/templates/threejs/index.html`, `assets/templates/babylonjs/index.html`, and `scripts/scaffold-*.js`
- Improved consistency of installation, verification, and troubleshooting instructions for ZCode and Claude across Linux, macOS, and Windows
- Clarified Anti-Slop and Weak-Model guidance wording in templates and scaffold messages for better readability and model comprehension

### Fixed
- Corrected mixed-language documentation to ensure all user-facing guides and templates use English only

### Notes
- No functional changes to runtime, scaffolding logic, or dependencies — `three@0.175.0`, `babylon@8.15.0`, `vite@7`, Node `>=20.19` unchanged

## v2.0.1 (Professional Edition + Anti-Slop & Weak-Model) — 2026-09-03

### Major Upgrade — Complete & Professional like a renowned game programmer

**Research-backed (internet):** Three.js WebGPURenderer+TSL docs (threejs.org/docs/TSL.html), Babylon.js 9.0 clustered/Frame Graph/Splat (Cinevva 2026-03-26, Windows Dev Blog), Vite 7 baseline-widely-available + Rolldown (vite.dev 2025-2026), AnimationMixer/Clock vs Timer r183, CanvasTexture/Sprite patterns.

### Changed — Dependency Bump (P0 fix)
- `three`: `0.160.0` → `^0.175.0` in 9 locations (`SKILL.md:145`, `scaffold-threejs.js:58`, `assets/templates/threejs/*`, reference docs) — add `three/tsl` Nodes.js, `WebGPURenderer` auto-fallback WebGL2, correct Draco path `examples/jsm/libs/draco/gltf/`
- `@babylonjs/*`: `7.0.0` → `^8.15.0` (+ `@babylonjs/havok ^1.3.9`) — clustered 1000 lights, volumetric, Node Particles, Gaussian Splat SOG/SOGS/streaming/LOD, Frame Graph v1
- `vite`: `^5.0.0` → `^7.0.0` — `target: baseline-widely-available` (Chrome 107, Edge 107, Firefox 104, Safari 16), Node `>=20.19.0`, Rolldown experimental note
- `package.json` root: add `license MIT`, `author`, `repository`, `homepage`, `bugs`, `keywords` 15, `engines`, `files` whitelist

### Added — New Professional Capabilities
- **`SKILL.md`** rewritten v2 (600+ lines): covers **project, logic, visual, graphics, effects, audio, 3D, 2D, animation** completely
  - Phase 1: 10 batched questions (renderer WebGPU/WebGL2, asset strategy splat, animation, VFX)
  - Phase 2: expanded skeleton `src/animation/Mixer|Skel|BlendTree` + `src/vfx/Particles|Post|Volumetrics` + `public/manifest.json|sw.js` + `Timer` r183 pattern
  - Phase 3: 2026 matrix 10 rows (WebGPU/TSL, clustered, sparsel, mixed)
  - Phase 4: Path A with `es-module-shims` 1.8.0 + `three/tsl` importmap + `manifest` link; Path B `vite@7` install
  - Phase 5: 15 ordered steps (input→anim setup→physics→world→AI→blending→VFX→audio→2D→state→polish→perf→PWA)
  - Phase 6: 15-item checklist (animation play, VFX trigger, 4 audio cues, atlas crispness, PWA)
  - Critical rules: Animation (one mixer per skeleton, `makeClipAdditive`), Rendering/TSL (WebGPURenderer pref), DPR cap, disposal
- **New references (5, total 20):**
  - `references/animation-system.md` (~205 lines): Mixer/Clip/Action, Timer vs Clock fallback `THREE.Timer ? Timer : Clock`, GLTF skeletal, SkeletonHelper, bone attach, morph targets, weight+additive blending, cross-fade, retargeting, CCD IK, Babylon AnimationGroup
  - `references/vfx-particles.md` (~208 lines): Pool, Points vs InstancedMesh, Babylon NPE/ThinInstances, EffectComposer vs Frame Graph, volumetric shafts, shake `exp(-k*dt)`, vignette, muzzle flash, trails/decals, Gaussian Splat shadow/streaming
  - `references/multiplayer-networking.md` (~320 lines): authoritative ws, client prediction+reconciliation, entity lerp, lag compensation rewind, tick 20 Hz, Colyseus, BroadcastChannel/WebRTC fallback
  - `references/webxr-vr.md` (~260 lines): WebXR enable (Three VRButton, Babylon createDefaultXRExperienceAsync), controllers, locomotion (teleport/smooth/snap), 90 FPS/perf
  - `references/design-system.md` (~120 lines, ANTI-SLOP): prompt inference engine, design tokens `:root`, palette+font per 6 genres, themed HUD/overlay CTA, anti-generic validation
- **`assets/pwa/`**: `manifest.json` + `sw.js` (cache v2, skipWaiting, stale-while-revalidate)
- **`assets/templates/threejs|babylonjs`**: bump deps, add `es-module-shims`, `manifest` link, `vite.config` `target baseline-widely-available`
- **`scripts/scaffold-*.js`**: dirs `src/animation`, `src/vfx`, `public`, bump versions, add shims+tsl/havok
- **`README.md` v2**: feature matrix 9 pillars (project/logic/visual/graphics/effects/audio/3D/2D/animation), install OpenCode, structure 20 refs, 2026 stack badge, design principles 7 + triggering + conflict-free note
- **Fix v2.0**: CHANGELOG count 14→15 (v1) now 20 docs total (was 19, +design-system); verified `grep -r 0.160.0` 0 hits, `grep -r 7.0.0` 0 hits outside history

### Fixed (v2.0.1 — conflict & weak-model audit)
- **Conflict fixes (7):** Babylon CDN `8.0.0`→`8.15.0` sync (`SKILL.md:160,179` + `scaffold-babylonjs.js:46`), dt clamp `0.25`→`0.1` (`game-architecture.md:49`), `es2020`→`baseline-widely-available` (`testing-deployment.md:201`), `mixer.update(STEP)`→`update(dt)` (SKILL.md:120), `three/webgpu` mapping added, performance `200`→`100 objects` budget aligned, scaffold slop HARD FAIL guard + warning
- **Weak-model (≤14B) ready:** `SKILL.md` added *Weak Model Quick Start* 4-step fallback, decision priority `voxel>GUI>Three`, `Timer` fallback guard `THREE.Timer ? Timer : Clock`, bilingual `REQUIRED`, progressive disclosure 1-file/phase
- `INSTALL.md` + `README.md` install paths aligned; `SKILL.md` frontmatter add `version: 2.0.0`; `assets/templates` shims + tokens; `package.json` metadata complete

## v2.0.0 (initial Professional — superseded by v2.0.1 fixes above, history kept)

### Major Upgrade — Complete & Professional like a renowned game programmer (v2.0.0 base, patched v2.0.1)

---

## v1.0.0 (Initial Release)

### Added
- Comprehensive `SKILL.md` (~400 lines) with 6-phase workflow: intake, architecture, framework select, scaffold, core systems, validation
- 15 reference documents (corrected count): threejs-complete (737 lines), babylonjs-complete (755), fps-template (1010), voxel-template (1137), third-person (306), platformer (362), game-architecture (473), physics-collision (454), procedural-generation (504), input-controls (582), audio-ui-systems (656), 2d-drawing-textures (536), asset-pipeline (441), performance-optimization (499), testing-deployment (462)
- Scaffold scripts: `scaffold-threejs.js` / `scaffold-babylonjs.js`
- Asset templates: threejs + babylonjs (index.html, package.json, vite.config.js)
- INSTALL.md 5-platform guide

### Design Principles v1
- Production-grade, self-contained, progressive disclosure, framework-agnostic, practical, honest trade-offs, anti-patterns forbidden

### Tested With v1
- Three.js 0.160.0, Babylon.js 7.0.0, Vite 5

### Tested With v2
- Three.js 0.175.0, Babylon.js 8.15.0 (8/9 family), Vite 7.0.0, Node >=20.19, Chromium/Firefox/Safari/Edge baseline-widely-available
