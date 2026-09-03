# Third-Person Game Template (Compressed)

Key code for a third-person action game with spring-arm camera, character controller, lock-on targeting. Combine with `threejs-complete.md` patterns.

## File Structure

```
third-person-game/
├── index.html          # Same as FPS template, but no pointer lock overlay
├── src/
│   ├── main.js
│   ├── Game.js
│   ├── Player.js
│   ├── ThirdPersonCamera.js
│   ├── Enemy.js
│   ├── World.js
│   └── Audio.js        # Same as FPS template
└── README.md
```

## ThirdPersonCamera.js — Spring-Arm with Collision

```js
import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;                 // Object3D the camera follows
    this.offset = new THREE.Vector3(0, 2, 6);   // behind and above
    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this.lerp = 8;                        // higher = snappier
    this.raycaster = new THREE.Raycaster();
    this.collideObjects = [];
  }

  setColliders(objects) { this.collideObjects = objects; }

  update(dt, yawInput = 0, pitchInput = 0) {
    // Apply user look input — orbit the target
    this.offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawInput * 0.01);
    // Pitch — clamp to keep camera above ground
    const currentPitch = Math.atan2(this.offset.y, this.offset.length());
    const newPitch = Math.max(-0.3, Math.min(1.2, currentPitch + pitchInput * 0.01));
    this.offset.y = Math.tan(newPitch) * Math.hypot(this.offset.x, this.offset.z);

    // Ideal position — offset rotated by target's yaw, plus target's position
    const idealPos = new THREE.Vector3()
      .copy(this.offset)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.target.rotation.y)
      .add(this.target.position);

    // Camera collision — raycast from target to idealPos
    const dir = new THREE.Vector3().subVectors(idealPos, this.target.position);
    const dist = dir.length();
    dir.normalize();
    this.raycaster.set(this.target.position, dir);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.collideObjects, true);
    if (hits.length > 0) {
      idealPos.copy(hits[0].point).addScaledVector(dir, -0.3);
    }

    // Smooth follow
    const t = 1 - Math.exp(-this.lerp * dt);
    this.smoothPos.lerp(idealPos, t);

    const lookAt = new THREE.Vector3().copy(this.target.position).add(new THREE.Vector3(0, 1.5, 0));
    this.smoothLook.lerp(lookAt, t);

    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
  }
}
```

## Player.js — Character Controller

```js
import * as THREE from 'three';

export class Player {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Visual character — capsule + head
    this.mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.6 })
    );
    body.position.y = 0.85;
    body.castShadow = true;
    this.mesh.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffccaa, roughness: 0.5 })
    );
    head.position.y = 1.7;
    head.castShadow = true;
    this.mesh.add(head);
    scene.add(this.mesh);

    // State
    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();
    this.health = 100;
    this.speed = 5;
    this.jumpSpeed = 7;
    this.onGround = false;
    this.radius = 0.4;
    this.height = 1.7;

    // Camera yaw follows mesh yaw — set this from camera input
    this.mesh.rotation.y = 0;

    // Input
    this.keys = {};
    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  // Camera input passes yaw/pitch deltas each frame
  update(dt, cameraYawDelta) {
    // Rotate mesh based on camera yaw (character faces camera direction by default)
    this.mesh.rotation.y -= cameraYawDelta;

    // Movement intent — relative to mesh forward (which is now camera forward)
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);

    const move = new THREE.Vector3();
    if (this.keys['KeyW'] || this.keys['ArrowUp']) move.add(forward);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) move.sub(forward);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) move.add(right);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed);
      // Rotate mesh to face movement direction (overridable for strafe)
      const targetYaw = Math.atan2(move.x, move.z);
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetYaw, 1 - Math.exp(-10 * dt));
    }

    this.velocity.x = move.x;
    this.velocity.z = move.z;
    this.velocity.y -= 22 * dt;
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // AABB collision (same as FPS template)
    const delta = this.velocity.clone().multiplyScalar(dt);
    const old = this.position.clone();
    this.position.x += delta.x;
    if (this._collides()) { this.position.x = old.x; this.velocity.x = 0; }
    this.position.z += delta.z;
    if (this._collides()) { this.position.z = old.z; this.velocity.z = 0; }
    this.position.y += delta.y;
    if (this._collides()) {
      this.position.y = old.y;
      if (delta.y < 0) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.onGround = false;
    }
  }

  _collides() {
    const box = new THREE.Box3(
      new THREE.Vector3(this.position.x - this.radius, this.position.y, this.position.z - this.radius),
      new THREE.Vector3(this.position.x + this.radius, this.position.y + this.height, this.position.z + this.radius)
    );
    for (const c of this.world.colliders) {
      if (box.intersectsBox(new THREE.Box3().setFromObject(c))) return true;
    }
    return false;
  }
}
```

## Game.js — Wire It Up

```js
import * as THREE from 'three';
import { World } from './World.js';        // reuse FPS world
import { Player } from './Player.js';
import { ThirdPersonCamera } from './ThirdPersonCamera.js';

export class Game {
  init() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 30, 100);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.world);
    this.tpsCam = new ThirdPersonCamera(this.camera, this.player.mesh);
    this.tpsCam.setColliders(this.world.colliders);

    // Mouse input for orbit
    this.mouse = { dx: 0, dy: 0, dragging: false };
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      this.mouse.dragging = (e.button === 2);   // right mouse = orbit
    });
    this.renderer.domElement.addEventListener('mouseup', () => { this.mouse.dragging = false; });
    this.renderer.domElement.addEventListener('mousemove', (e) => {
      if (this.mouse.dragging) {
        this.mouse.dx += e.movementX;
        this.mouse.dy = Math.max(-200, Math.min(200, this.mouse.dy + e.movementY));
      }
    });
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.lastTime = performance.now();
    this._frame(this.lastTime);
  }

  _frame(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.player.update(dt, this.mouse.dx);
    this.tpsCam.update(dt, this.mouse.dx, this.mouse.dy);
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this._frame(t));
  }
}
```

## Lock-On Targeting (Optional)

For action RPGs where the player targets an enemy:

```js
class LockOnSystem {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;
    this.targets = [];          // array of enemy meshes
    this.lockedTarget = null;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this._toggleLock();
      }
    });
  }

  setTargets(targets) { this.targets = targets; }

  _toggleLock() {
    if (this.lockedTarget) { this.lockedTarget = null; return; }
    // Find nearest enemy in front of player
    const playerForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.mesh.rotation.y);
    let best = null, bestDist = Infinity;
    for (const t of this.targets) {
      const to = new THREE.Vector3().subVectors(t.position, this.player.position);
      if (to.dot(playerForward) < 0) continue;   // behind
      const d = to.length();
      if (d < bestDist && d < 20) { bestDist = d; best = t; }
    }
    this.lockedTarget = best;
  }

  // Call per frame after camera update
  applyLockOn() {
    if (!this.lockedTarget) return;
    // Rotate player to face locked target
    const to = new THREE.Vector3().subVectors(this.lockedTarget.position, this.player.position);
    this.player.mesh.rotation.y = Math.atan2(to.x, to.z);
  }
}
```

## Key Differences from FPS

1. **No pointer lock** — camera orbits with mouse drag (right button) or always (auto-rotate behind player)
2. **Player has a visible mesh** — capsule + head, gets seen by player
3. **Movement is relative to camera yaw**, not camera quaternion (no pitch affecting movement)
4. **Camera collision** — raycast from player to ideal camera position, pull camera in if wall is in the way (without this, camera clips through walls)
5. **Lock-on** is a common addition — face the target automatically when locked

For action-combat games (Souls-like), add:
- Attack hitbox (sword swing raycast)
- Dodge roll (brief invulnerability + dash)
- Stamina system (limits dodge + attack)
- Boss health bars at bottom of screen

For platformer-style third-person (Mario 64, Sonic), see `platformer-template.md` for momentum-based movement.
