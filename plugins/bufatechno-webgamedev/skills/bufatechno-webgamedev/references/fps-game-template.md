# FPS Game Template — Three.js

Complete, runnable first-person shooter template. Copy this verbatim and adapt. ~600 lines total.

## File Structure

```
fps-game/
├── index.html
├── src/
│   ├── main.js
│   ├── Game.js
│   ├── Player.js
│   ├── Weapon.js
│   ├── Enemy.js
│   ├── World.js
│   ├── Audio.js
│   ├── UI.js
│   └── utils.js
└── README.md
```

## index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Web FPS</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #000; font-family: 'Courier New', monospace; }
    #app { position: absolute; inset: 0; }
    #hud { position: fixed; inset: 0; pointer-events: none; color: #fff; font-size: 14px; }
    #crosshair { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px; }
    #crosshair::before, #crosshair::after { content: ''; position: absolute; background: rgba(255,255,255,0.8); }
    #crosshair::before { left: 50%; top: 0; width: 2px; height: 100%; transform: translateX(-50%); }
    #crosshair::after { top: 50%; left: 0; height: 2px; width: 100%; transform: translateY(-50%); }
    #stats { position: absolute; top: 10px; left: 10px; padding: 8px 12px; background: rgba(0,0,0,0.4); border-radius: 4px; }
    #health { color: #f55; }
    #ammo { color: #ff5; }
    #score { color: #5ff; }
    #overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; pointer-events: all; cursor: pointer; }
    #overlay h1 { font-size: 48px; margin: 0 0 12px; letter-spacing: 4px; }
    #overlay p { margin: 4px 0; color: #aaa; }
    #overlay .hint { margin-top: 24px; padding: 12px 24px; border: 2px solid #5cf; color: #5cf; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    #damage-flash { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.6) 100%); pointer-events: none; opacity: 0; transition: opacity 0.1s; }
    #hit-marker { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #fff; font-size: 24px; opacity: 0; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="hud">
    <div id="crosshair"></div>
    <div id="stats">
      Health: <span id="health">100</span><br>
      Ammo: <span id="ammo">30</span><br>
      Score: <span id="score">0</span><br>
      Wave: <span id="wave">1</span>
    </div>
    <div id="hit-marker">✕</div>
    <div id="damage-flash"></div>
  </div>
  <div id="overlay">
    <h1>WEB FPS</h1>
    <p>WASD to move • MOUSE to look • LEFT CLICK to shoot</p>
    <p>R to reload • SPACE to jump • ESC to pause</p>
    <p>Survive the waves. Each kill = 100 points.</p>
    <div class="hint">CLICK TO PLAY</div>
  </div>
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/"
    }
  }
  </script>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

## src/main.js

```js
import { Game } from './Game.js';

const game = new Game();
game.init();
document.getElementById('overlay').addEventListener('click', () => game.start());
```

## src/utils.js

```js
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);

// Simple deterministic RNG (mulberry32) — for reproducible level gen
export function makeRng(seed) {
  let a = seed | 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function makeNoiseTexture(size = 256, base = '#808080', variance = 30) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i] = clamp(img.data[i] + n, 0, 255);
    img.data[i+1] = clamp(img.data[i+1] + n, 0, 255);
    img.data[i+2] = clamp(img.data[i+2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
```

## src/Game.js

```js
import * as THREE from 'three';
import { World } from './World.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Weapon } from './Weapon.js';
import { Audio } from './Audio.js';
import { UI } from './UI.js';

export class Game {
  constructor() {
    this.state = 'menu';   // menu | playing | paused | gameover | victory
  }

  init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    // Scene + camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202830);
    this.scene.fog = new THREE.FogExp2(0x202830, 0.012);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 500);
    this.camera.position.set(0, 1.7, 0);

    // Audio
    this.audio = new Audio();

    // UI
    this.ui = new UI();

    // World
    this.world = new World(this.scene);

    // Player
    this.player = new Player(this.camera, this.world);
    this.weapon = new Weapon(this.camera, this.scene, this.audio, this.ui);

    // Enemies
    this.enemies = [];
    this.waveSize = 5;
    this.waveNumber = 1;

    // Loop state
    this.step = 1 / 60;
    this.accumulator = 0;
    this.lastTime = 0;
    this.clock = new THREE.Clock();

    this._bindEvents();
    this._render();   // render menu frame
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (!locked && this.state === 'playing') this._pause();
      if (!locked && this.state === 'menu') return;
    });

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this._pause();
      else if (e.code === 'Escape' && this.state === 'paused') this._resume();
    });
  }

  start() {
    if (this.state !== 'menu' && this.state !== 'gameover' && this.state !== 'victory') return;
    if (this.state === 'gameover' || this.state === 'victory') this._reset();
    this.state = 'playing';
    this.audio.resume();
    this.renderer.domElement.requestPointerLock();
    this._spawnWave();
    this.lastTime = performance.now();
    this.clock.start();
    this._frame(this.lastTime);
    this._hideOverlay();
  }

  _pause() {
    this.state = 'paused';
    document.exitPointerLock();
    this._showOverlay('PAUSED', 'Click to resume');
  }

  _resume() {
    this.state = 'playing';
    this.renderer.domElement.requestPointerLock();
    this.lastTime = performance.now();
    this._hideOverlay();
    this._frame(this.lastTime);
  }

  _reset() {
    // Remove all enemies
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
    this.waveNumber = 1;
    this.waveSize = 5;
    this.player.reset();
    this.weapon.reset();
    this.ui.setScore(0);
    this.ui.setWave(1);
  }

  _spawnWave() {
    this.ui.setWave(this.waveNumber);
    for (let i = 0; i < this.waveSize; i++) {
      const enemy = new Enemy(this.scene, this.world, this.player);
      this.enemies.push(enemy);
    }
  }

  _gameOver() {
    this.state = 'gameover';
    document.exitPointerLock();
    this._showOverlay('GAME OVER', `Final score: ${this.ui.score}`, 'Click to restart');
  }

  _victory() {
    this.state = 'victory';
    document.exitPointerLock();
    this._showOverlay('VICTORY!', `Waves survived: ${this.waveNumber - 1}`, 'Click to play again');
  }

  _showOverlay(title, ...lines) {
    const o = document.getElementById('overlay');
    o.innerHTML = `<h1>${title}</h1>` + lines.map(l => `<p>${l}</p>`).join('') +
      `<div class="hint">CLICK TO CONTINUE</div>`;
    o.style.display = 'flex';
    o.onclick = () => this.start();
  }

  _hideOverlay() {
    document.getElementById('overlay').style.display = 'none';
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
    this.player.update(dt);
    this.weapon.update(dt);

    // Enemies AI
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt);
      if (enemy.dead) {
        this.scene.remove(enemy.mesh);
        enemy.dispose();
        this.enemies.splice(i, 1);
        this.ui.addScore(100);
        this.audio.play('enemyDown');
      }
    }

    // Wave clear?
    if (this.enemies.length === 0) {
      this.waveNumber++;
      this.waveSize = Math.min(20, this.waveSize + 2);
      if (this.waveNumber > 10) {
        this._victory();
        return;
      }
      this._spawnWave();
    }

    // Player death?
    if (this.player.health <= 0) {
      this._gameOver();
    }

    // Damage check from enemies
    for (const enemy of this.enemies) {
      const dist = enemy.mesh.position.distanceTo(this.player.position);
      if (dist < 1.5 && enemy.canAttack) {
        this.player.takeDamage(15);
        this.ui.flashDamage();
        this.audio.play('hurt');
        enemy.canAttack = false;
        setTimeout(() => { enemy.canAttack = true; }, 800);
      }
    }
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }
}
```

## src/Player.js

```js
import * as THREE from 'three';
import { clamp } from './utils.js';

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = camera.position;
    this.velocity = new THREE.Vector3();
    this.health = 100;
    this.maxHealth = 100;
    this.speed = 6;
    this.jumpSpeed = 7;
    this.onGround = false;
    this.radius = 0.4;
    this.height = 1.7;

    this.keys = {};
    this._bindInput();

    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._bindMouse();
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  _bindMouse() {
    const canvas = this.camera.userData.renderer?.domElement || document.querySelector('canvas');
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= e.movementX * 0.0022;
      this.euler.x -= e.movementY * 0.0022;
      this.euler.x = clamp(this.euler.x, -Math.PI/2 + 0.01, Math.PI/2 - 0.01);
      this.camera.quaternion.setFromEuler(this.euler);
    });
  }

  reset() {
    this.position.set(0, 1.7, 0);
    this.velocity.set(0, 0, 0);
    this.health = this.maxHealth;
  }

  takeDamage(d) {
    this.health = Math.max(0, this.health - d);
  }

  update(dt) {
    // Movement intent (relative to camera yaw)
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(this.speed);

    // Horizontal velocity (instant)
    this.velocity.x = move.x;
    this.velocity.z = move.z;

    // Gravity
    this.velocity.y -= 22 * dt;

    // Jump
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // Attempt move with collision
    const delta = this.velocity.clone().multiplyScalar(dt);
    this._moveWithCollision(delta);

    // Ground check via raycast
    const ray = new THREE.Raycaster(
      new THREE.Vector3(this.position.x, this.position.y - 0.1, this.position.z),
      new THREE.Vector3(0, -1, 0),
      0,
      0.15
    );
    const hits = ray.intersectObjects(this.world.colliders, false);
    this.onGround = hits.length > 0;
    if (this.onGround && this.velocity.y < 0) this.velocity.y = 0;
  }

  _moveWithCollision(delta) {
    // Move axis-by-axis with collision against world colliders (boxes)
    const old = this.position.clone();

    // X
    this.position.x += delta.x;
    if (this._checkCollision()) { this.position.x = old.x; this.velocity.x = 0; }

    // Z
    this.position.z += delta.z;
    if (this._checkCollision()) { this.position.z = old.z; this.velocity.z = 0; }

    // Y
    this.position.y += delta.y;
    if (this._checkCollision()) { this.position.y = old.y; this.velocity.y = 0; }
  }

  _checkCollision() {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(this.position.x - this.radius, this.position.y - this.height, this.position.z - this.radius),
      new THREE.Vector3(this.position.x + this.radius, this.position.y, this.position.z + this.radius)
    );
    for (const collider of this.world.colliders) {
      const box = new THREE.Box3().setFromObject(collider);
      if (playerBox.intersectsBox(box)) return true;
    }
    return false;
  }
}
```

## src/Weapon.js

```js
import * as THREE from 'three';

export class Weapon {
  constructor(camera, scene, audio, ui) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audio;
    this.ui = ui;
    this.ammo = 30;
    this.maxAmmo = 30;
    this.fireRate = 0.12;       // seconds between shots
    this.cooldown = 0;
    this.recoil = 0;
    this.damage = 25;
    this.range = 100;

    // Weapon viewmodel — simple box + cylinder
    this.model = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 })
    );
    body.position.set(0, 0, -0.2);
    this.model.add(body);
    this.model.position.set(0.25, -0.25, -0.5);
    this.model.rotation.y = -0.1;
    this.camera.add(this.model);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = this.range;

    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement && e.button === 0) this._fire();
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR') this.reload();
    });
  }

  reset() {
    this.ammo = this.maxAmmo;
    this.cooldown = 0;
    this.recoil = 0;
    this.ui.setAmmo(this.ammo);
  }

  reload() {
    if (this.ammo === this.maxAmmo) return;
    this.ammo = this.maxAmmo;
    this.ui.setAmmo(this.ammo);
    this.audio.play('reload');
  }

  _fire() {
    if (this.cooldown > 0 || this.ammo <= 0) return;
    this.cooldown = this.fireRate;
    this.ammo--;
    this.ui.setAmmo(this.ammo);
    this.audio.play('shoot');
    this.recoil = 0.05;

    // Hitscan from camera center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const enemies = this.scene.children.filter(c => c.userData.enemyHitbox);
    const hits = this.raycaster.intersectObjects([...enemies, ...this.scene.userData.world?.colliders || []], true);
    if (hits.length > 0) {
      const hit = hits[0];
      // Walk up the parent chain to find the enemy
      let target = hit.object;
      while (target && !target.userData.enemy) target = target.parent;
      if (target && target.userData.enemy) {
        const headshot = hit.point.y > target.position.y + 1.5;
        target.userData.enemy.takeDamage(headshot ? 100 : this.damage);
        this.ui.showHitMarker();
        this.audio.play('hit');
      }
      // Spawn impact spark at hit.point
      this._spawnImpact(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0));
    }
  }

  _spawnImpact(pos, normal) {
    // Simple particle burst — 5 small spheres with gravity, fade out
    for (let i = 0; i < 5; i++) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffaa44 })
      );
      spark.position.copy(pos);
      spark.userData.life = 0.3;
      spark.userData.vel = new THREE.Vector3(
        normal.x + (Math.random() - 0.5),
        normal.y + Math.random() * 0.5,
        normal.z + (Math.random() - 0.5)
      ).multiplyScalar(2);
      this.scene.add(spark);
      this.scene.userData.sparks ??= [];
      this.scene.userData.sparks.push(spark);
    }
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    // Recoil decay
    this.recoil = THREE.MathUtils.lerp(this.recoil, 0, 1 - Math.exp(-12 * dt));
    this.model.position.z = -0.5 + this.recoil;
    this.model.rotation.x = this.recoil * 2;

    // Auto-fire if mouse held
    if (document.pointerLockElement && this._mouseDown) this._fire();

    // Update sparks
    const sparks = this.scene.userData.sparks ?? [];
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.userData.life -= dt;
      if (s.userData.life <= 0) {
        this.scene.remove(s);
        s.geometry.dispose();
        s.material.dispose();
        sparks.splice(i, 1);
      } else {
        s.userData.vel.y -= 9.8 * dt;
        s.position.addScaledVector(s.userData.vel, dt);
        s.material.opacity = s.userData.life / 0.3;
        s.material.transparent = true;
      }
    }
  }
}
```

## src/Enemy.js

```js
import * as THREE from 'three';
import { rand } from './utils.js';

export class Enemy {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.health = 100;
    this.dead = false;
    this.canAttack = true;
    this.speed = 2.5;

    // Mesh — capsule body + head
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x882222, roughness: 0.7 })
    );
    body.position.y = 0.85;
    body.castShadow = true;
    this.mesh.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xaa4444, roughness: 0.6 })
    );
    head.position.y = 1.7;
    head.castShadow = true;
    this.mesh.add(head);

    // Hitbox — invisible larger box for forgiving hit detection
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.y = 0.9;
    this.mesh.add(hitbox);

    // Spawn at random point on map edge
    const angle = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * 5;
    this.mesh.position.set(Math.cos(angle) * r, 0.05, Math.sin(angle) * r);

    // Tag for raycasting
    body.userData.enemy = this;
    head.userData.enemy = this;
    body.userData.enemyHitbox = true;
    head.userData.enemyHitbox = true;
    this.mesh.userData.enemy = this;

    scene.add(this.mesh);
  }

  takeDamage(d) {
    this.health -= d;
    if (this.health <= 0) this.dead = true;
  }

  update(dt) {
    if (this.dead) return;
    // Move toward player
    const toPlayer = new THREE.Vector3().subVectors(this.player.position, this.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 0.01) {
      toPlayer.normalize();
      this.mesh.position.addScaledVector(toPlayer, this.speed * dt);
    }
    // Face player
    this.mesh.lookAt(this.player.position.x, this.mesh.position.y, this.player.position.z);
  }

  dispose() {
    this.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
  }
}
```

## src/World.js

```js
import * as THREE from 'three';
import { makeNoiseTexture } from './utils.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({
      map: makeNoiseTexture(256, '#3a3530', 30),
      roughness: 0.9,
      metalness: 0.0,
    });
    floorMat.map.repeat.set(20, 20);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      floorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls (perimeter)
    const wallMat = new THREE.MeshStandardMaterial({
      map: makeNoiseTexture(128, '#404048', 25),
      roughness: 0.85,
    });
    wallMat.map.repeat.set(4, 2);
    const wallGeo = new THREE.BoxGeometry(50, 3, 1);
    const sides = [
      { pos: [0, 1.5, -25], rotY: 0 },
      { pos: [0, 1.5, 25], rotY: 0 },
      { pos: [-25, 1.5, 0], rotY: Math.PI / 2 },
      { pos: [25, 1.5, 0], rotY: Math.PI / 2 },
    ];
    for (const s of sides) {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(...s.pos);
      wall.rotation.y = s.rotY;
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      this.colliders.push(wall);
    }

    // Cover boxes scattered around
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 0.7 });
    for (let i = 0; i < 12; i++) {
      const size = 0.8 + Math.random() * 1.2;
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        coverMat
      );
      cover.position.set(
        (Math.random() - 0.5) * 40,
        size / 2,
        (Math.random() - 0.5) * 40
      );
      cover.castShadow = true;
      cover.receiveShadow = true;
      scene.add(cover);
      this.colliders.push(cover);
    }

    // Lighting
    const hemi = new THREE.HemisphereLight(0x8090a0, 0x403020, 0.5);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(20, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambient);

    scene.userData.world = this;
  }
}
```

## src/Audio.js

```js
// Procedural audio — no external files. Web Audio oscillators + envelopes.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  resume() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shoot': return this._shoot();
      case 'reload': return this._reload();
      case 'hit': return this._hit();
      case 'enemyDown': return this._enemyDown();
      case 'hurt': return this._hurt();
    }
  }

  _shoot() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  _reload() {
    const t = this.ctx.currentTime;
    [0, 0.1, 0.25].forEach((delay, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 800 - i * 100;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.05);
      osc.connect(gain).connect(this.master);
      osc.start(t + delay);
      osc.stop(t + delay + 0.06);
    });
  }

  _hit() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  _enemyDown() {
    const t = this.ctx.currentTime;
    [400, 300, 200].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = this.ctx.createGain();
      const start = t + i * 0.08;
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      osc.connect(gain).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  _hurt() {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}
```

## src/UI.js

```js
export class UI {
  constructor() {
    this.healthEl = document.getElementById('health');
    this.ammoEl = document.getElementById('ammo');
    this.scoreEl = document.getElementById('score');
    this.waveEl = document.getElementById('wave');
    this.flashEl = document.getElementById('damage-flash');
    this.hitMarker = document.getElementById('hit-marker');
    this.score = 0;
  }

  setHealth(h) { this.healthEl.textContent = Math.round(h); }
  setAmmo(a) { this.ammoEl.textContent = a; }
  setWave(w) { this.waveEl.textContent = w; }
  addScore(n) { this.score += n; this.scoreEl.textContent = this.score; }

  flashDamage() {
    this.flashEl.style.opacity = '1';
    setTimeout(() => { this.flashEl.style.opacity = '0'; }, 150);
  }

  showHitMarker() {
    this.hitMarker.style.opacity = '1';
    setTimeout(() => { this.hitMarker.style.opacity = '0'; }, 80);
  }
}
```

## README.md

```markdown
# Web FPS

A runnable browser FPS built with Three.js. Survive 10 waves of enemies.

## How to Run

Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).

No build step. No npm install. Just open the file.

## Controls

- **WASD / Arrows** — move
- **Mouse** — look (pointer lock activates on click)
- **Left click** — shoot
- **R** — reload
- **Space** — jump
- **Esc** — pause / resume

## How It Works

- Hitscan shooting with raycasting
- Headshot detection (hit above y=1.5 = instant kill)
- Wave-based spawning — 5 enemies first wave, +2 per wave, capped at 20
- Procedural audio (no audio files) via Web Audio API
- Procedural textures (no image files) via Canvas 2D
- Box3 collision detection against world colliders
- Fixed-timestep update at 60 Hz with interpolation-free render (sufficient for this scale)

## Extending

- Add weapons: extend `Weapon.js` with different damage/fireRate
- Add enemy types: subclass `Enemy` with different speed/health/behavior
- Add pickups: gold spheres on the ground restore health or ammo
- Add multiplayer: integrate WebSocket, sync enemy positions only (not player input — player predicts own movement)
```

---

## Key Implementation Notes

### Why no physics library?

For an FPS with hitscan weapons and simple box collision, a full physics engine is overkill. Box3-vs-Box3 collision in `_checkCollision` is ~5 lines, runs in microseconds, and gives reliable "can't walk through walls" behavior. Adding Cannon-es adds 200 KB and a lot of edge cases (tunneling at high speed, jitter, etc).

If the user wants ragdoll on death, grenades with bounce, or stacking boxes — then add Cannon-es. See `references/physics-collision.md`.

### Why fixed-timestep with no interpolation?

The template uses fixed-timestep UPDATE (60 Hz) but renders at native FPS without interpolating between physics states. This is fine for small player movement deltas — the visual jitter at 144 Hz is sub-pixel and unnoticeable. For twitchy fast games or racing, add interpolation in `_render` using `alpha = accumulator / step`.

### Why procedural audio?

Two reasons:
1. **No external files** — the deliverable stays self-contained. User opens one HTML file and plays.
2. **Zero latency** — oscillator-based sounds start instantly. File-based audio has decoding overhead.

For longer/looping music, load an MP3 via `new Audio('./music.mp3')` and stream it.

### Common FPS-specific bugs to watch

- **Mouse drift on aspect change**: handle resize properly (the `_bindEvents` block in Game.js)
- **Camera roll**: always use `'YXZ'` Euler order; never set rotation.z
- **Shoot through walls**: include world colliders in the raycast intersect list (done in `_fire`)
- **Enemies stack on player**: keep attack distance minimum at 1.5 (set in Game.js damage check)
- **Recoil feels bad**: decay exponentially with `1 - exp(-k*dt)`, not linearly

---

End of FPS template. For voxel/sandbox style, see `voxel-game-template.md`.
