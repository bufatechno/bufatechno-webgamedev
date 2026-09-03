# 3D Platformer Template (Compressed)

Mario 64 / Sonic-style 3D platformer. Momentum-based movement, double jump, coyote time, jump buffering, collectibles, moving platforms, hazards.

## Key Implementation Patterns

```js
class PlatformerPlayer {
  constructor(scene, world) {
    this.world = world;
    this.mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.6, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.6 })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.position = this.mesh.position;
    this.position.set(0, 5, 0);
    this.velocity = new THREE.Vector3();

    // Tuning parameters
    this.speed = 6;
    this.acceleration = 50;          // how fast we reach max speed
    this.friction = 10;               // how fast we stop without input
    this.airControl = 0.5;            // how much acceleration when airborne
    this.jumpHeight = 3;
    this.gravity = 25;
    this.maxFallSpeed = 25;

    // Jump helpers
    this.maxJumps = 2;                // double jump
    this.jumpsUsed = 0;
    this.coyoteTime = 0.1;            // grace period after leaving ground
    this.coyoteTimer = 0;
    this.jumpBufferTime = 0.1;        // queue jumps pressed before landing
    this.jumpBuffer = 0;

    this.onGround = false;
    this.radius = 0.4;
    this.height = 1.0;

    this.keys = {};
    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpBuffer = this.jumpBufferTime;
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
  }

  update(dt, camera) {
    // Coyote time — refresh when on ground, decay when airborne
    if (this.onGround) this.coyoteTimer = this.coyoteTime;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // Jump buffer — decay
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // Buffered jump: jump was pressed recently AND we can jump
    if (this.jumpBuffer > 0 && (this.coyoteTimer > 0 || this.jumpsUsed < this.maxJumps)) {
      const jumpVel = Math.sqrt(2 * this.gravity * this.jumpHeight);
      this.velocity.y = jumpVel;
      this.jumpsUsed++;
      this.jumpBuffer = 0;
      this.coyoteTimer = 0;
      this.onGround = false;
    }

    // Horizontal movement with momentum (acceleration, not instant velocity)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const wishDir = new THREE.Vector3();
    if (this.keys['KeyW']) wishDir.add(forward);
    if (this.keys['KeyS']) wishDir.sub(forward);
    if (this.keys['KeyD']) wishDir.add(right);
    if (this.keys['KeyA']) wishDir.sub(right);
    if (wishDir.lengthSq() > 0) wishDir.normalize();

    const accel = this.acceleration * (this.onGround ? 1 : this.airControl);
    if (wishDir.lengthSq() > 0) {
      this.velocity.x += wishDir.x * accel * dt;
      this.velocity.z += wishDir.z * accel * dt;
      // Clamp to max speed
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > this.speed) {
        this.velocity.x = (this.velocity.x / speed) * this.speed;
        this.velocity.z = (this.velocity.z / speed) * this.speed;
      }
    } else if (this.onGround) {
      // Apply friction
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      if (speed > 0) {
        const drop = speed * this.friction * dt;
        const newSpeed = Math.max(0, speed - drop);
        this.velocity.x = (this.velocity.x / speed) * newSpeed;
        this.velocity.z = (this.velocity.z / speed) * newSpeed;
      }
    }

    // Gravity
    this.velocity.y -= this.gravity * dt;
    if (this.velocity.y < -this.maxFallSpeed) this.velocity.y = -this.maxFallSpeed;

    // AABB collision (same as FPS / voxel templates)
    const delta = this.velocity.clone().multiplyScalar(dt);
    const old = this.position.clone();
    this.position.x += delta.x;
    if (this._collides()) { this.position.x = old.x; this.velocity.x = 0; }
    this.position.z += delta.z;
    if (this._collides()) { this.position.z = old.z; this.velocity.z = 0; }
    this.position.y += delta.y;
    if (this._collides()) {
      this.position.y = old.y;
      if (delta.y < 0) {
        this.onGround = true;
        this.jumpsUsed = 0;
      }
      this.velocity.y = 0;
    } else {
      // Detect leaving ground — start coyote timer
      if (this.onGround) this.coyoteTimer = this.coyoteTime;
      this.onGround = false;
    }

    // Rotate mesh to face movement direction
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.5) {
      const targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetYaw, 1 - Math.exp(-15 * dt));
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

## Collectibles (Coins)

```js
class Collectible {
  constructor(scene, position, value = 1) {
    this.scene = scene;
    this.mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0x553300, roughness: 0.3, metalness: 0.9 })
    );
    this.mesh.position.copy(position);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.castShadow = true;
    this.value = value;
    this.collected = false;
    scene.add(this.mesh);
  }

  update(dt, player) {
    if (this.collected) return;
    // Spin
    this.mesh.rotation.z += dt * 3;
    // Hover
    this.mesh.position.y += Math.sin(performance.now() * 0.003) * 0.001;
    // Collect
    if (this.mesh.position.distanceTo(player.position) < 1.0) {
      this.collected = true;
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      return this.value;
    }
    return 0;
  }
}
```

## Moving Platforms

```js
class MovingPlatform {
  constructor(scene, startPos, endPos, speed = 2) {
    this.scene = scene;
    this.start = startPos.clone();
    this.end = endPos.clone();
    this.speed = speed;
    this.t = 0;
    this.direction = 1;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.3, 4),
      new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.7 })
    );
    this.mesh.position.copy(startPos);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.platform = this;
    scene.add(this.mesh);
    this.lastPos = startPos.clone();
  }

  update(dt) {
    this.lastPos.copy(this.mesh.position);
    this.t += dt * this.speed * this.direction;
    if (this.t >= 1) { this.t = 1; this.direction = -1; }
    else if (this.t <= 0) { this.t = 0; this.direction = 1; }
    this.mesh.position.lerpVectors(this.start, this.end, this.t);
  }

  get delta() {
    return new THREE.Vector3().subVectors(this.mesh.position, this.lastPos);
  }
}
```

## Carrying Player on Moving Platform

In player update, after movement:

```js
// Check if standing on a moving platform
if (this.onGround) {
  const below = new THREE.Vector3(this.position.x, this.position.y - 0.1, this.position.z);
  const ray = new THREE.Raycaster(below, new THREE.Vector3(0, -1, 0), 0, 0.2);
  const hits = ray.intersectObjects(world.movingPlatforms.map(p => p.mesh), false);
  if (hits.length > 0) {
    const platform = hits[0].object.userData.platform;
    this.position.add(platform.delta);
  }
}
```

## Hazards (Lava, Spikes)

```js
class Hazard {
  constructor(scene, position, size, damage = 100, type = 'lava') {
    const colors = { lava: 0xff4400, spikes: 0xcccccc, poison: 0x44ff00 };
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({
        color: colors[type],
        emissive: colors[type],
        emissiveIntensity: 0.4,
        roughness: 0.8,
      })
    );
    this.mesh.position.copy(position);
    this.damage = damage;
    scene.add(this.mesh);
  }

  checkPlayer(player) {
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      player.position, new THREE.Vector3(player.radius * 2, player.height, player.radius * 2)
    );
    const myBox = new THREE.Box3().setFromObject(this.mesh);
    if (playerBox.intersectsBox(myBox)) {
      return this.damage;
    }
    return 0;
  }
}
```

## Game Loop with Win/Lose

```js
class Game {
  constructor() {
    // ... setup renderer, scene, camera, world
    this.player = new PlatformerPlayer(this.scene, this.world);
    this.coins = [];
    for (let i = 0; i < 20; i++) {
      this.coins.push(new Collectible(this.scene, new THREE.Vector3(Math.random()*40-20, 2 + Math.random()*3, Math.random()*40-20), 1));
    }
    this.score = 0;
    this.lives = 3;
    this.hazards = [
      new Hazard(this.scene, new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(60, 0.5, 60), 100, 'lava'),
    ];
    this.checkpoint = new THREE.Vector3(0, 5, 0);
  }

  _update(dt) {
    this.player.update(dt, this.camera);

    let collected = 0;
    for (const coin of this.coins) {
      collected += coin.update(dt, this.player);
    }
    if (collected > 0) {
      this.score += collected;
      this.audio.play('coin');
      if (this.score >= 20) this._victory();
    }

    for (const hazard of this.hazards) {
      if (hazard.checkPlayer(this.player) > 0) {
        this._playerDie();
      }
    }
  }

  _playerDie() {
    this.lives--;
    this.audio.play('death');
    if (this.lives <= 0) this._gameOver();
    else this.player.position.copy(this.checkpoint);
  }
}
```

## Coyote Time & Jump Buffering — Why They Matter

These two features are THE difference between "this platformer feels good" and "this platformer feels broken".

- **Coyote time**: player can still jump for 100ms after walking off a ledge. Without it, players who press jump a frame too late fall to their death — feels unfair.
- **Jump buffering**: if player presses jump 100ms before landing, the jump fires on landing. Without it, players who press jump a frame too early just don't jump — feels unresponsive.

100ms is the standard for both. Anything less feels tight; anything more feels floaty.

## Double Jump

Implementation is in the code above (`maxJumps = 2`, `jumpsUsed++` on each jump). Reset `jumpsUsed = 0` when grounded.

For variable jump height (Mario-style — long press = full jump, short tap = small hop):

```js
// In keyup for Space:
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && this.velocity.y > 0) {
    this.velocity.y *= 0.5;   // cut jump short if released early
  }
});
```

This gives the player precise control over jump height without complicated input logic.

## Camera for 3D Platformer

Use third-person camera from `third-person-template.md` with these tweaks:
- Larger `offset.z` (8-10 instead of 6) — keep the player visible with the upcoming terrain
- Lower `lerp` (3-5) — smoother, less twitchy
- No collision with player-controlled rotation (auto-rotate behind player by default)
- Manual camera control via right mouse or right stick (gamepad)

---

End of platformer template. For full third-person code, see `third-person-template.md`. For other game types, see the relevant reference files.
