# Physics & Collision Reference

Three approaches to physics in web games, from simplest to most powerful. Pick the lightest that works.

## Table of Contents

1. [Decision Matrix](#decision-matrix)
2. [Approach 1: Raycast Ground Detection + Manual Gravity](#approach-1-raycast-ground-detection--manual-gravity)
3. [Approach 2: AABB-vs-AABB Collision (No Physics Lib)](#approach-2-aabb-vs-aabb-collision-no-physics-lib)
4. [Approach 3: Cannon-es with Three.js](#approach-3-cannon-es-with-threejs)
5. [Approach 4: Havok with Babylon.js](#approach-4-havok-with-babylonjs)
6. [Collision Filters & Triggers](#collision-filters--triggers)
7. [Raycast Vehicles (Cars)](#raycast-vehicles-cars)
8. [Performance Tuning](#performance-tuning)
9. [Common Physics Bugs](#common-physics-bugs)

---

## Decision Matrix

| Your game needs... | Use |
|---|---|
| Walking on flat terrain, jump on platforms, no falling objects | **Approach 1** — raycast ground detection + manual gravity |
| Walking, simple box collisions, pushable boxes | **Approach 2** — AABB-vs-AABB, axis-separated |
| Realistic stacking, ragdolls, grenades, bouncing balls | **Approach 3/4** — full physics engine (Cannon-es / Havok) |
| Vehicle with suspension, wheels | Physics engine + raycast vehicle (or custom raycast wheels) |
| Voxel/Minecraft-style | **AABB vs voxel grid** (covered in voxel template) |

Adding a physics engine when you don't need one is the #1 source of "physics bugs" — jitter, tunneling, performance hits, weird edge cases. Start lighter, upgrade only when forced.

## Approach 1: Raycast Ground Detection + Manual Gravity

Best for: FPS, third-person, platformers with simple terrain.

```js
class Player {
  constructor(camera, terrain) {
    this.camera = camera;
    this.terrain = terrain;     // Object3D or list of meshes
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.gravity = 22;
    this.jumpSpeed = 7;
    this.height = 1.7;          // eye height above feet
    this.ray = new THREE.Raycaster();
  }

  update(dt) {
    // Apply gravity
    this.velocity.y -= this.gravity * dt;

    // Jump
    if (this.input.jump && this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }

    // Horizontal move (set from input elsewhere)
    // this.velocity.x = ...
    // this.velocity.z = ...

    // Apply movement
    this.camera.position.addScaledVector(this.velocity, dt);

    // Ground check: raycast downward from feet
    const feetPos = this.camera.position.clone();
    feetPos.y -= this.height;        // feet are eye-height below camera
    this.ray.set(feetPos, new THREE.Vector3(0, -1, 0));
    this.ray.far = 0.5;              // small probe below feet
    const hits = this.ray.intersectObjects(this.terrain, true);
    if (hits.length > 0) {
      // Snap to ground
      const groundY = hits[0].point.y;
      this.camera.position.y = groundY + this.height;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }
}
```

**Pros**: 30 lines, runs at microseconds, no library, no jitter.
**Cons**: No wall collision, no slopes (player snaps to ground but can't walk up stairs without explicit step-up logic).

For wall collision, add approach 2's AABB check after the raycast ground check.

## Approach 2: AABB-vs-AABB Collision (No Physics Lib)

Best for: FPS with walls, top-down games, simple puzzle games.

```js
class AABBPhysics {
  constructor() {
    this.colliders = [];   // array of THREE.Mesh
    this.tmpBox = new THREE.Box3();
  }

  addCollider(mesh) { this.colliders.push(mesh); }

  // Move player with collision response. player = { position, velocity, halfSize }
  move(player, dt) {
    const delta = player.velocity.clone().multiplyScalar(dt);
    // Axis-separated collision — prevents "sticking" on corners
    this._moveAxis(player, delta, 'x');
    this._moveAxis(player, delta, 'z');
    this._moveAxis(player, delta, 'y');
  }

  _moveAxis(player, delta, axis) {
    const oldPos = player.position[axis];
    player.position[axis] += delta[axis];
    if (this._collides(player)) {
      player.position[axis] = oldPos;
      player.velocity[axis] = 0;
    }
  }

  _collides(player) {
    const box = new THREE.Box3(
      new THREE.Vector3(
        player.position.x - player.halfSize.x,
        player.position.y - player.halfSize.y,
        player.position.z - player.halfSize.z
      ),
      new THREE.Vector3(
        player.position.x + player.halfSize.x,
        player.position.y + player.halfSize.y,
        player.position.z + player.halfSize.z
      )
    );
    for (const collider of this.colliders) {
      const cb = this.tmpBox.setFromObject(collider);
      if (box.intersectsBox(cb)) return true;
    }
    return false;
  }
}
```

**Why axis-separated?**
If you move all 3 axes at once and check collision, you don't know which axis caused the collision. The player can get stuck on corners — trying to slide along a wall while moving diagonally is blocked because the wall + ground both collide.

Moving X first, then Z, then Y means each axis resolves independently. Player can slide along a wall (Z movement still works when X is blocked).

**Optimization**: for static colliders (walls, terrain), precompute their Box3 once instead of `setFromObject` every frame. Store `collider.userData.box = new THREE.Box3().setFromObject(collider)` once.

## Approach 3: Cannon-es with Three.js

When you need: stacking boxes, ragdolls, bouncing balls, hinges, sliders.

```js
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
import * as THREE from 'three';

// World
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);   // better than naive for many bodies
world.allowSleep = true;                              // bodies at rest skip simulation — huge perf win

// Materials for friction/restitution
const groundMat = new CANNON.Material('ground');
const playerMat = new CANNON.Material('player');
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, playerMat, {
  friction: 0.4,
  restitution: 0.1,
}));

// Static ground
const groundBody = new CANNON.Body({
  mass: 0,                                            // 0 = static
  shape: new CANNON.Plane(),
  material: groundMat,
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Player — sphere as collider (smooth on stairs)
const playerShape = new CANNON.Sphere(0.5);
const playerBody = new CANNON.Body({
  mass: 70,
  shape: playerShape,
  material: playerMat,
  fixedRotation: true,                                // don't roll
  position: new CANNON.Vec3(0, 2, 0),
});
playerBody.updateMassProperties();
world.addBody(playerBody);

// Boxes (stackable, dynamic)
const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
for (let i = 0; i < 10; i++) {
  const body = new CANNON.Body({
    mass: 1,
    shape: boxShape,
    position: new CANNON.Vec3(i * 0.3, 5 + i * 1.2, 0),
  });
  world.addBody(body);
}

// Sync Three.js meshes to Cannon bodies
const visualBoxes = [];
world.bodies.forEach((body) => {
  if (body.mass === 0) return;   // skip static
  const geo = body.shapes[0] instanceof CANNON.Box
    ? new THREE.BoxGeometry(1, 1, 1)
    : body.shapes[0] instanceof CANNON.Sphere
    ? new THREE.SphereGeometry(body.shapes[0].radius, 16, 16)
    : new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x88aacc }));
  mesh.castShadow = true;
  scene.add(mesh);
  visualBoxes.push({ mesh, body });
});

// Fixed-timestep step
const fixedStep = 1 / 60;
let physicsAccum = 0;

function frame(dt) {
  physicsAccum += dt;
  while (physicsAccum >= fixedStep) {
    world.step(fixedStep);
    physicsAccum -= fixedStep;
  }
  // Sync meshes to bodies
  for (const { mesh, body } of visualBoxes) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }
  // Player camera follows player body
  camera.position.copy(playerBody.position);
  camera.position.y += 0.5;   // eye height offset
}
```

### Player movement with Cannon-es

Direct velocity setting is the standard pattern (not force-based — that's for vehicles):

```js
function updatePlayer(dt, input) {
  // Cancel out gravity's effect on vertical velocity if on ground
  const vel = playerBody.velocity;

  // Desired horizontal velocity from input
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

  const desired = new THREE.Vector3();
  if (input.forward) desired.add(forward);
  if (input.back) desired.sub(forward);
  if (input.right) desired.add(right);
  if (input.left) desired.sub(right);
  if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(6);

  // Apply — preserve vertical velocity (gravity)
  vel.x = desired.x;
  vel.z = desired.z;
  // vel.y is left alone — gravity does its thing

  // Jump — only if on ground
  if (input.jump && isOnGround()) {
    vel.y = 7;
  }
}

function isOnGround() {
  // Raycast downward from player body
  const from = new CANNON.Vec3(playerBody.position.x, playerBody.position.y - 0.5, playerBody.position.z);
  const to = new CANNON.Vec3(playerBody.position.x, playerBody.position.y - 0.6, playerBody.position.z);
  const result = new CANNON.RaycastResult();
  world.raycastClosest(from, to, { collisionFilterMask: -1 }, result);
  return result.hasHit;
}
```

## Approach 4: Havok with Babylon.js

```js
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import havokWasm from '@babylonjs/havok';

async function initPhysics(scene) {
  const havok = await havokWasm();
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new BABYLON.Vector3(0, -9.82, 0), plugin);
  return plugin;
}

// Static ground
const ground = BABYLON.MeshBuilder.CreateGround('g', { width: 100, height: 100 }, scene);
const groundBody = new BABYLON.PhysicsBody(ground, BABYLON.PhysicsMotionType.STATIC, false, scene);
groundBody.shape = new BABYLON.PhysicsShapeBox(
  new BABYLON.Vector3(0, 0, 0),
  BABYLON.Quaternion.Identity(),
  new BABYLON.Vector3(100, 0.01, 100),
  scene
);
groundBody.shape.material = { friction: 0.5, restitution: 0.1 };

// Dynamic box
const box = BABYLON.MeshBuilder.CreateBox('b', { size: 1 }, scene);
box.position.y = 5;
const boxBody = new BABYLON.PhysicsBody(box, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
boxBody.shape = new BABYLON.PhysicsShapeBox(
  new BABYLON.Vector3(0, 0, 0),
  BABYLON.Quaternion.Identity(),
  new BABYLON.Vector3(1, 1, 1),
  scene
);
boxBody.setMassProperties({ mass: 1 });

// Babylon auto-syncs the mesh to the body — no manual sync needed.
```

Havok vs Cannon-es:
- Havok is the modern, performant option (it's the actual Havok engine, WASM-compiled).
- Cannon-es is JS-native — easier to debug, slower on large simulations.
- For anything with >50 bodies, prefer Havok.

## Collision Filters & Triggers

For a game where the player shoots enemies but bullets pass through other bullets, you need collision groups.

### Cannon-es

```js
const GROUP_PLAYER = 1;
const GROUP_ENEMY = 2;
const GROUP_BULLET = 4;
const GROUP_WALL = 8;

playerBody.collisionFilterGroup = GROUP_PLAYER;
playerBody.collisionFilterMask = GROUP_WALL | GROUP_ENEMY;   // collide with walls and enemies
// does NOT collide with bullets

bulletBody.collisionFilterGroup = GROUP_BULLET;
bulletBody.collisionFilterMask = GROUP_ENEMY | GROUP_WALL;   // bullets hit enemies and walls
// bullets pass through player and other bullets
```

### Trigger volumes (no physical response, just event)

```js
const pickupBody = new CANNON.Body({
  mass: 0,
  shape: new CANNON.Sphere(1),
  collisionResponse: false,   // CRITICAL — no physical pushback, just events
});
world.addBody(pickupBody);

pickupBody.addEventListener('collide', (event) => {
  if (event.body === playerBody) {
    console.log('Player entered pickup zone');
    // emit event, give item, etc
  }
});
```

## Raycast Vehicles (Cars)

For cars, don't use box wheels — they bounce violently. Use raycast wheels: cast a ray downward from each wheel position, simulate spring suspension at the hit point.

```js
const vehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
});
// 4 wheels
vehicle.addWheel({
  isFrontWheel: true,
  chassisConnectionPoint: new CANNON.Vec3(-1, 0, 1.5),   // local to chassis
  directionWorld: new CANNON.Vec3(0, -1, 0),               // suspension direction
  axleLocal: new CANNON.Vec3(-1, 0, 0),                    // wheel spin axis
  suspensionStiffness: 30,
  suspensionRestLength: 0.3,
  frictionSlip: 1.4,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  maxSuspensionTravel: 0.3,
  radius: 0.4,
});
// (repeat for 3 more wheels at appropriate positions)

vehicle.addToWorld(world);

// Per frame: apply engine force, steering, brakes
function updateVehicle(input) {
  const maxForce = 1000;
  const maxSteer = 0.5;
  vehicle.applyEngineForce(input.throttle * maxForce, 2);  // rear wheels
  vehicle.applyEngineForce(input.throttle * maxForce, 3);
  vehicle.setSteeringValue(input.steer * maxSteer, 0);    // front wheels
  vehicle.setSteeringValue(input.steer * maxSteer, 1);
  if (input.brake) {
    vehicle.setBrake(20, 0); vehicle.setBrake(20, 1);
    vehicle.setBrake(20, 2); vehicle.setBrake(20, 3);
  }
}

// Visual wheels — sync from wheel info
for (let i = 0; i < vehicle.wheelInfos.length; i++) {
  vehicle.updateWheelTransform(i);
  const t = vehicle.wheelInfos[i].worldTransform;
  wheelMeshes[i].position.copy(t.position);
  wheelMeshes[i].quaternion.copy(t.quaternion);
}
```

## Performance Tuning

1. **Use `world.allowSleep = true`** — bodies at rest skip simulation. 100 sleeping bodies cost ~0 CPU.
2. **Use `SAPBroadphase`** instead of `NaiveBroadphase` for >50 bodies.
3. **Lower solver iterations** — `world.solver.iterations = 5` (default 10). Lower = faster, less stable.
4. **Don't simulate tiny objects**. Anything smaller than 0.1 units causes collision detection issues. Scale up your world if needed.
5. **Don't make ground a single mesh** if it's huge — the broadphase becomes inefficient. Use a grid of ground tiles.
6. **Avoid compound shapes** for static bodies — single box is faster.
7. **Use `fixedRotation: true` for player bodies** — otherwise they tip over when you bump a wall.

## Common Physics Bugs

| Bug | Cause | Fix |
|---|---|---|
| Player falls through floor at high speed | `dt` too large, physics step skips over floor | Cap `dt` at 1/30; use fixed timestep; or use `CANNON.RayCastVehicle` for fast-moving |
| Stacked boxes jitter | Solver iterations too low, or contact constraint overlap | Increase iterations to 15; add a small `linearDamping = 0.01` |
| Box springs off the ground on spawn | Initial position intersects ground | Spawn 0.1 units above ground |
| Player can't walk up 1-block steps | Capsule/sphere collider can't "step up" | Add a "step offset" — if collider hits wall at foot level, try moving up 0.3 units and re-checking |
| Bullets pass through walls | Bullet velocity high, physics step can't catch collision | Use raycast (hitscan) for fast projectiles, OR use Continuous Collision Detection (CCD) |
| Vehicle flips on sharp turns | Center of mass too high | Lower `chassisBody.shapeOffset` (move COM below visual center) |
| Player slides on slopes | Friction too low, or "moving platform" carries player wrong way | Increase friction; or for moving platforms, parent player to platform while grounded |
| Boxes pass through each other at high stack | Solver can't resolve all contact constraints in one step | Increase iterations; or split the stack into chunks of <20 boxes |

## CCD (Continuous Collision Detection)

For fast bullets in a physics simulation:

```js
bulletBody.ccdSpeedThreshold = 1;     // enable CCD if speed > 1 m/s
bulletBody.ccdMotionThreshold = 0.5;  // if it moves more than 0.5 in one step, do CCD
```

Cannon-es does this by adding a "swept" shape that checks the full motion path, not just endpoints.

For pure hitscan shooting, skip the physics bullet entirely — just raycast from camera, find first hit, apply damage. Physics bullets are for slow projectiles (grenades, rockets) where gravity matters.

---

End of physics reference. For input handling, see `references/input-controls.md`. For procedural content, see `references/procedural-generation.md`.
