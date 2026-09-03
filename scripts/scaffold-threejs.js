#!/usr/bin/env node
/**
 * Scaffolds a new Three.js game project.
 * Usage: node scaffold-threejs.js <project-name> [game-type]
 *   game-type: fps | voxel | third-person | platformer | empty
 */
import * as fs from 'fs';
import * as path from 'path';

const name = process.argv[2] || 'my-game';
const gameType = process.argv[3] || 'empty';

const projectDir = path.resolve(process.cwd(), name);

if (fs.existsSync(projectDir)) {
  console.error(`Error: directory ${name} already exists`);
  process.exit(1);
}

console.log(`Scaffolding Three.js game "${name}" (${gameType} template)...`);

// Directory structure — professional layout
const dirs = [
  '',
  'src',
  'src/world',
  'src/player',
  'src/systems',
  'src/animation',
  'src/vfx',
  'src/assets',
  'src/utils',
  'public',
];

dirs.forEach((d) => fs.mkdirSync(path.join(projectDir, d), { recursive: true }));

// Common index.html — ANTI-SLOP: scaffold is starter, WAJIB customize per design-system.md before ship
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Starter (ganti judul themed)</title>
  <!-- ANTI-SLOP: Starter palette — final game WAJIB generate tokens unik per genre (design-system.md) -->
  <style>
    :root{ --bg:#0a0e13; --panel:rgba(16,22,30,.72); --text:#e6edf3; --muted:#9aa8b3; --accent:#55ccff; --accent-2:#7af0ff; --radius:14px; --font-display:"Space Grotesk",system-ui,sans-serif; --font-body:"Inter",system-ui,sans-serif; }
    html, body { margin:0; height:100%; overflow:hidden; background:var(--bg); color:var(--text); font-family:var(--font-body); }
    #app { position:absolute; inset:0; }
    #hud { position:fixed; inset:0; pointer-events:none; }
    #overlay { position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text); cursor:pointer; text-align:center; padding:24px }
    #overlay .hint{ margin-top:16px; padding:12px 22px; border:1px solid var(--accent); color:var(--accent); border-radius:999px; font-family:var(--font-display); letter-spacing:.14em; font-size:12px }
  </style>
  <script async src="https://unpkg.com/es-module-shims@1.8.0/dist/es-module-shims.js"></script>
  <link rel="manifest" href="./public/manifest.json" />
</head>
<body>
  <div id="app"></div>
  <div id="hud"></div>
  <div id="overlay"><div style="font-family:var(--font-display); font-size:clamp(24px,4vw,44px); letter-spacing:.1em">\${name.toUpperCase()}</div><div class="hint">CLICK TO PLAY — GANTI TEKS THEMED PER GENRE</div><div style="margin-top:8px; color:var(--muted); font-size:11px">Starter anti-slop: ganti palette/HUD per design-system.md</div></div>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/",
      "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/nodes/Nodes.js",
      "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.webgpu.js"
    }
  }
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml);

// main.js
const mainJs = `import { Game } from './Game.js';

const game = new Game();
game.init();
document.getElementById('overlay').addEventListener('click', () => game.start());
`;

fs.writeFileSync(path.join(projectDir, 'src/main.js'), mainJs);

// Game.js — professional stub with Timer + animation + pooling ready
const gameJs = `import * as THREE from 'three';

export class Game {
  constructor() { this.state = 'menu'; }

  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 30, 100);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, 1.7, 5);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a3a2a, 0.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x3a6f2a, roughness: 0.85 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // TODO: Add world, player, enemies, etc per game type: ${gameType}

    this.step = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this._render();
  }

  start() {
    this.state = 'playing';
    document.getElementById('overlay').style.display = 'none';
    this.renderer.domElement.requestPointerLock?.();
    this.lastTime = performance.now();
    this._frame(this.lastTime);
  }

  _frame(now) {
    if (this.state !== 'playing') return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += dt;
    while (this.accumulator >= this.step) {
      this._update(this.step);
      this.accumulator -= this.step;
    }
    this._render();
    requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    // TODO: Update player, enemies, etc per game type: ${gameType}
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }
}
`;

fs.writeFileSync(path.join(projectDir, 'src/Game.js'), gameJs);

// README.md
const readme = `# ${name}

A 3D web game built with Three.js.

## How to Run

Open \`index.html\` in a modern browser (Chrome, Firefox, Edge, Safari).

No build step. No npm install. Just open the file.

## Controls

TODO: Add controls here.

## Notes

Scaffolded as: ${gameType}

See the SKILL.md reference at the project root for game-type-specific code patterns.
`;

fs.writeFileSync(path.join(projectDir, 'README.md'), readme);

// package.json (optional, for npm-based workflows)
const packageJson = {
  name: name,
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev: 'npx vite',
    build: 'npx vite build',
    preview: 'npx vite preview',
  },
  dependencies: {
    three: '^0.175.0',
  },
  devDependencies: {
    vite: '^7.0.0',
  },
};
fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// .gitignore
fs.writeFileSync(path.join(projectDir, '.gitignore'), `node_modules/\ndist/\n.DS_Store\n*.log\n`);

console.log(`✓ Created ${name}/`);
console.log(`  - index.html (CDN-based 0.175.0 + three/tsl + webgpu mapping, starter tokens)`);
console.log(`  - src/Game.js (Timer fallback + WebGLRenderer, starter — customize per design-system.md)`);
console.log(`  - package.json (three ^0.175.0, vite ^7.0.0 baseline-widely-available)`);
console.log(`  - README.md`);
console.log(``);
console.log(`Next steps:`);
console.log(`  cd ${name}`);
console.log(`  # Option A: open index.html in a browser (no build)`);
console.log(`  # Option B: npm install && npm run dev (Vite dev server)`);
console.log(``);
console.log(`⚠️  ANTI-SLOP (WAJIB/REQUIRED): Scaffold starter GENERIK — jangan ship apa adanya!`);
console.log(`   → Ganti palette/font/HUD/overlay per references/design-system.md sebelum Phase 6`);
console.log(`   → Contoh: racing → neon cyan/magenta Orbitron, horror → olive Cormorant`);
console.log(`For full game code, see the SKILL.md reference at your skill install location.`);
