# Changelog

## v2.0.3 — 2026-09-03

### Added
- Added dual marketplace for ZCode (`.zcode-plugin/marketplace.json`) and Claude Code (`.claude-plugin/marketplace.json`) with plugin `bufatechno-webgamedev` at `plugins/bufatechno-webgamedev`
- Bundled skill for marketplace distribution at `plugins/bufatechno-webgamedev/skills/bufatechno-webgamedev`

### Fixed
- Fixed skill not appearing in autocomplete by declaring explicit `skills` path in plugin manifests
- Corrected marketplace and plugin versions to ensure update detection

### Changed
- Updated installation guide with marketplace quick install for ZCode and Claude Code
- Updated README structure documentation to include marketplace manifests and plugin layout

## v2.0.2 — 2026-09-03

### Changed
- Standardized language to English across all documentation: `SKILL.md`, `README.md`, `INSTALL.md`, `.gitignore`, `references/design-system.md`, `assets/templates/threejs/index.html`, `assets/templates/babylonjs/index.html`, and `scripts/scaffold-*.js`
- Improved consistency of installation, verification, and troubleshooting instructions for ZCode and Claude across Linux, macOS, and Windows
- Clarified Anti-Slop and Weak-Model guidance wording in templates and scaffold messages for better readability and model comprehension

### Fixed
- Corrected mixed-language documentation to ensure all user-facing guides and templates use English only

### Notes
- No functional changes to runtime, scaffolding logic, or dependencies — `three@0.175.0`, `babylon@8.15.0`, `vite@7`, Node `>=20.19` unchanged

## v2.0.1 — 2026-09-03

### Major Upgrade — Complete & Professional like a renowned game programmer

**Research-backed (internet):** Three.js WebGPURenderer+TSL docs (threejs.org/docs/TSL.html), Babylon.js 9.0 clustered/Frame Graph/Splat (Cinevva 2026-03-26, Windows Dev Blog), Vite 7 baseline-widely-available + Rolldown (vite.dev 2025-2026), AnimationMixer/Clock vs Timer r183, CanvasTexture/Sprite patterns.

### Changed — Dependency Bump (P0 fix)
- `three`: `0.160.0` → `^0.175.0` in 9 locations (`SKILL.md:145`, `scaffold-threejs.js:58`, `assets/templates/threejs/*`, reference docs) — add `three/tsl` Nodes.js, `WebGPURenderer` auto-fallback WebGL2, correct Draco path `examples/jsm/libs/draco/gltf/`
- `@babylonjs/*`: `7.0.0` → `^8.15.0` (+ `@babylonjs/havok ^1.3.9`) — clustered 1000 lights, volumetric, Node Particles, Gaussian Splat SOG/SOGS/streaming/LOD, Frame Graph v1
- `vite`: `^5.0.0` → `^7.0.0` — `target: baseline-widely-available` (Chrome 107, Edge 107, Firefox 104, Safari 16), Node `>=20.19.0`, Rolldown experimental note
- `package.json` root: add `license MIT`, `author`, `repository`, `homepage`, `bugs`, `keywords` 15, `engines`, `files` whitelist

### Added
- Rewrote `SKILL.md` as Professional Edition covering full pipeline: project scaffolding, game logic, visuals, graphics, effects, audio, 3D/2D assets, and animation with Anti-Slop enforcement and weak-model support
- Added 5 new reference guides: animation system (mixer, skeletal, morph, blending, retargeting), VFX and particles (post-processing, volumetric), multiplayer networking, WebXR, and design system
- Added PWA support with `manifest.json` and `sw.js`, and enhanced templates with `es-module-shims` and Vite 7 baseline configuration
- Enhanced scaffolding to include animation, VFX, and public asset directories with updated Three.js and Babylon.js integrations
- Updated `README.md` with comprehensive feature overview and platform support details

### Fixed
- Synchronized Babylon.js CDN and package versions, corrected delta-time clamping and animation timing, and aligned rendering and performance defaults
- Improved compatibility for smaller models with graceful fallbacks and simplified setup flow
- Standardized installation paths and package metadata across documentation and templates

## v2.0.0 — 2026-09-03

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
