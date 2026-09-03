#!/usr/bin/env node
/**
 * Scaffolds a new Babylon.js game project.
 * Usage: node scaffold-babylonjs.js <project-name> [game-type]
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

console.log(`Scaffolding Babylon.js game "${name}" (${gameType} template)...`);

fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Starter (replace with themed title)</title>
  <!-- ANTI-SLOP: Starter — final MUST replace tokens per design-system.md -->
  <style>
    :root{ --bg:#0a0e13; --panel:rgba(16,22,30,.72); --text:#e6edf3; --muted:#9aa8b3; --accent:#ffd166; --accent-2:#55ccff; --radius:14px; --font-display:"Space Grotesk",system-ui,sans-serif; --font-body:"Inter",system-ui,sans-serif; }
    html, body { margin:0; height:100%; overflow:hidden; background:var(--bg); color:var(--text); font-family:var(--font-body); }
    #renderCanvas { width:100%; height:100%; touch-action:none; outline:none; display:block }
    #hud { position:fixed; inset:0; pointer-events:none }
    #overlay { position:absolute; inset:0; background:rgba(0,0,0,0.85); display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text); cursor:pointer; z-index:10; text-align:center; padding:24px }
    #overlay .hint{ margin-top:14px; padding:12px 22px; border:1px solid var(--accent); color:var(--accent); border-radius:999px; font-family:var(--font-display); letter-spacing:.14em; font-size:12px }
  </style>
</head>
<body>
  <canvas id="renderCanvas"></canvas>
  <div id="hud"></div>
  <div id="overlay"><div style="font-family:var(--font-display); letter-spacing:.1em; font-size:clamp(24px,4vw,44px)">\${name.toUpperCase()}</div><div class="hint">CLICK TO PLAY — REPLACE WITH THEMED PER GENRE</div><div style="margin-top:8px; color:var(--muted); font-size:11px">Starter anti-slop: replace palette/HUD per design-system.md</div></div>
  <script async src="https://unpkg.com/es-module-shims@1.8.0/dist/es-module-shims.js"></script>
  <script type="importmap">
  {
    "imports": {
      "@babylonjs/core": "https://cdn.jsdelivr.net/npm/@babylonjs/core@8.15.0/+esm",
      "@babylonjs/gui": "https://cdn.jsdelivr.net/npm/@babylonjs/gui@8.15.0/+esm",
      "@babylonjs/loaders": "https://cdn.jsdelivr.net/npm/@babylonjs/loaders@8.15.0/+esm",
      "@babylonjs/materials": "https://cdn.jsdelivr.net/npm/@babylonjs/materials@8.15.0/+esm",
      "@babylonjs/havok": "https://cdn.jsdelivr.net/npm/@babylonjs/havok@1.3.9/+esm"
    }
  }
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(projectDir, 'index.html'), indexHtml);

const mainJs = `import { Game } from './Game.js';

const game = new Game();
game.init();
document.getElementById('overlay').addEventListener('click', () => game.start());
`;

fs.writeFileSync(path.join(projectDir, 'src/main.js'), mainJs);

const gameJs = `import { Engine, Scene, UniversalCamera, Vector3, HemisphericLight, DirectionalLight, MeshBuilder, StandardMaterial, Color3, Color4 } from '@babylonjs/core';

export class Game {
  constructor() { this.state = 'menu'; }

  init() {
    const canvas = document.getElementById('renderCanvas');
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.53, 0.81, 0.92, 1.0);

    this.camera = new UniversalCamera('playerCam', new Vector3(0, 1.7, -5), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.fov = 0.8;
    this.camera.attachControl(canvas, true);

    // Lighting
    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.6;
    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), this.scene);
    sun.position = new Vector3(50, 80, 30);
    sun.intensity = 2.0;

    // Ground
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    const groundMat = new StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new Color3(0.23, 0.43, 0.17);
    ground.material = groundMat;
    ground.receiveShadows = true;

    // TODO: Add player, enemies, etc per game type: ${gameType}

    this.step = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;

    window.addEventListener('resize', () => this.engine.resize());

    this._render();
  }

  start() {
    this.state = 'playing';
    document.getElementById('overlay').style.display = 'none';
    const canvas = document.getElementById('renderCanvas');
    canvas.requestPointerLock?.();
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
    this.scene.render();
    requestAnimationFrame((t) => this._frame(t));
  }

  _update(dt) {
    // TODO: Update player, enemies, etc per game type: ${gameType}
  }

  _render() {
    this.scene.render();
  }
}
`;

fs.writeFileSync(path.join(projectDir, 'src/Game.js'), gameJs);

const readme = `# ${name}

A 3D web game built with Babylon.js.

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
    '@babylonjs/core': '^8.15.0',
    '@babylonjs/gui': '^8.15.0',
    '@babylonjs/loaders': '^8.15.0',
    '@babylonjs/materials': '^8.15.0',
    '@babylonjs/havok': '^1.3.9',
  },
  devDependencies: {
    vite: '^7.0.0',
  },
};
fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

fs.writeFileSync(path.join(projectDir, '.gitignore'), `node_modules/\ndist/\n.DS_Store\n*.log\n`);

console.log(`✓ Created ${name}/`);
console.log(`  - index.html (CDN 8.15.0 + havok, starter tokens — MUST be themed)`);
console.log(`  - src/Game.js (stub ${gameType} — customize per design-system.md)`);
console.log(`  - package.json (babylon 8.15+havok, vite 7 baseline)`);
console.log(`  - README.md`);
console.log(``);
console.log(`Next steps:`);
console.log(`  cd ${name}`);
console.log(`  # Option A: open index.html in a browser (no build)`);
console.log(`  # Option B: npm install && npm run dev (Vite dev server)`);
console.log(``);
console.log(`⚠️  ANTI-SLOP (REQUIRED): Scaffold starter is GENERIC — do not ship as-is!`);
console.log(`   → Replace palette/font/HUD/overlay per references/design-system.md`);
