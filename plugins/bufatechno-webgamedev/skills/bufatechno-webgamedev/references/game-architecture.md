# Game Architecture Patterns

How to structure a 3D web game so it stays maintainable as it grows. Apply these patterns to every game type — FPS, voxel, platformer, RPG.

## Table of Contents

1. [Game Loop — Fixed Timestep with Interpolation](#game-loop--fixed-timestep-with-interpolation)
2. [State Machine (Menu / Playing / Paused / GameOver)](#state-machine)
3. [Entity-Component-System (ECS)](#entity-component-system-ecs)
4. [Object Pooling](#object-pooling)
5. [Scene Management](#scene-management)
6. [Event Bus (Loose Coupling)](#event-bus)
7. [Service Locator / Dependency Injection](#service-locator)
8. [Time-Safe Updates (Avoiding the Spiral of Death)](#time-safe-updates)

---

## Game Loop — Fixed Timestep with Interpolation

The single most important pattern in any game. Physics MUST update at a fixed rate (e.g., 60 Hz). Rendering runs at whatever FPS the GPU can deliver. The two are decoupled by an accumulator + interpolation.

```js
class GameLoop {
  constructor(updateFn, renderFn, step = 1/60) {
    this.update = updateFn;
    this.render = renderFn;
    this.step = step;
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.currentState = null;     // for interpolation
    this.previousState = null;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  stop() { this.running = false; }

  _frame(now) {
    if (!this.running) return;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // CLAMP: if the tab was backgrounded, dt can be huge. Cap at 100ms — prevents spiral-of-death, align SKILL.md:103 rule (weak-model safe)
    if (dt > 0.1) dt = 0.1;

    this.accumulator += dt;
    while (this.accumulator >= this.step) {
      this.previousState = this.currentState;
      this.currentState = this.update(this.step);
      this.accumulator -= this.step;
    }

    // Interpolate between previous and current physics state for the render.
    const alpha = this.accumulator / this.step;
    this.render(this.currentState, this.previousState, alpha);

    requestAnimationFrame((t) => this._frame(t));
  }
}
```

**Why fixed timestep?**
- Physics simulation is deterministic. Same input → same output. Reproducible bugs.
- Collision detection doesn't tunnel through walls at high speeds.
- Network play is possible (server runs at fixed step, client predicts).

**Why interpolation?**
- At 144 Hz display, the render runs 2.4x faster than physics. Without interpolation, you'd see the same physics frame twice — visually stuttering motion.
- Interpolation renders the state between previous and current physics frames based on `alpha = accumulator / step`.

**Why clamp `dt`?**
- When the user tabs away, `requestAnimationFrame` pauses. On return, `dt` could be 30 seconds. Without clamping, the game tries to "catch up" by running 30s / (1/60) = 1800 physics steps in one frame. The tab freezes.
- Cap at **100 ms** (`0.1`). Accept the small desync, do not attempt to catch up. Align SKILL.md + weak-model safety.

### Minimal Interpolation-Free Variant

For simple games where you don't care about 144 Hz smoothness:

```js
function frame() {
  const dt = clock.getDelta();
  update(dt);          // physics uses dt directly
  render();
  requestAnimationFrame(frame);
}
```

This is **wrong for serious games** — physics will be non-deterministic, objects will behave differently at 30 vs 144 FPS. But for a casual prototype, it's fine.

## State Machine

Every game has at least 3 states: `menu`, `playing`, `gameover`. Add `paused`, `loading`, `victory` as needed. Don't scatter `if (state === 'playing')` checks throughout the code — formalize the states.

```js
class GameStateMachine {
  constructor(game) {
    this.game = game;
    this.states = {
      menu:    new MenuState(game),
      playing: new PlayingState(game),
      paused:  new PausedState(game),
      gameover: new GameOverState(game),
    };
    this.current = this.states.menu;
    this.current.enter();
  }

  transition(name) {
    this.current.exit();
    this.current = this.states[name];
    this.current.enter();
  }

  update(dt) { this.current.update(dt); }
  render() { this.current.render(); }
}

class PlayingState {
  constructor(game) { this.game = game; }
  enter() {
    this.game.audio.resume();
    this.game.renderer.domElement.requestPointerLock();
    this.game.ui.hideOverlay();
  }
  exit() {
    document.exitPointerLock?.();
  }
  update(dt) {
    this.game.player.update(dt);
    this.game.enemies.forEach(e => e.update(dt));
  }
  render() { this.game.renderer.render(this.game.scene, this.game.camera); }
}
```

Benefits:
- Each state has explicit `enter`/`exit` — no leftover event handlers, no "stuck in paused" bugs
- Easy to add new states (cutscene, inventory screen, dialog)
- State-specific pause behavior (e.g., freeze physics but keep rendering UI animations)

## Entity-Component-System (ECS)

For games with many entities of varying types (RPG, simulation, RTS), ECS is the standard pattern. Each entity is just an ID; components hold data; systems iterate over entities with specific components.

```js
// Entity = number ID
let nextId = 0;
const entities = new Set();

// Components — plain data objects keyed by entity ID
const components = {
  position: new Map(),     // id -> THREE.Vector3
  velocity: new Map(),     // id -> THREE.Vector3
  health:   new Map(),     // id -> { current, max }
  render:   new Map(),     // id -> THREE.Mesh
  ai:       new Map(),     // id -> { state, target }
  collider: new Map(),     // id -> { box, isTrigger }
};

function createEntity() {
  const id = nextId++;
  entities.add(id);
  return id;
}

function addComponent(id, name, data) {
  components[name].set(id, data);
}

function removeEntity(id) {
  entities.delete(id);
  for (const store of Object.values(components)) store.delete(id);
}

// Systems — pure functions over component stores
class MovementSystem {
  update(dt) {
    for (const [id, pos] of components.position) {
      const vel = components.velocity.get(id);
      if (!vel) continue;
      pos.addScaledVector(vel, dt);
    }
  }
}

class HealthSystem {
  update(dt) {
    for (const [id, hp] of components.health) {
      if (hp.current <= 0) {
        // emit death event
        eventBus.emit('entityDied', id);
        removeEntity(id);
      }
    }
  }
}

class RenderSystem {
  update() {
    for (const [id, mesh] of components.render) {
      const pos = components.position.get(id);
      if (pos) mesh.position.copy(pos);
    }
  }
}
```

Benefits over inheritance:
- Composable: an entity can have `position + health + render + ai` without writing 16 subclasses
- Cache-friendly: each system iterates one component store (Map) — no virtual calls
- Easy to add features: "all entities with health AND ai" is a simple loop, not a new class

When NOT to use ECS:
- Game has <20 distinct entity types — over-engineering
- Game is mostly UI (visual novel, puzzle) — entities are too few to justify
- Strict hierarchy makes sense (e.g., chess — every piece has well-defined behavior)

Most web games are fine with simple classes. Reach for ECS when:
- You have 1000+ entities
- Entity types change at runtime (modding, sandbox)
- You want multiplayer — ECS diff/sync is well-studied

## Object Pooling

For frequently spawned/despawned objects (projectiles, particles, decals), never `new` per frame. Allocate a pool at startup, reuse objects.

```js
class Pool {
  constructor(factory, resetFn, initialSize = 50, maxSize = 500) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  acquire() {
    let obj = this.free.pop();
    if (!obj) {
      if (this.active.size >= this.maxSize) {
        // Steal the oldest active object
        obj = this.active.values().next().value;
        this.release(obj);
        obj = this.free.pop();
      } else {
        obj = this.factory();
      }
    }
    this.active.add(obj);
    return obj;
  }

  release(obj) {
    this.active.delete(obj);
    this.resetFn?.(obj);
    this.free.push(obj);
  }
}

// Usage
const bulletPool = new Pool(
  () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffff80 })
    );
    mesh.userData.vel = new THREE.Vector3();
    mesh.userData.life = 0;
    scene.add(mesh);
    return mesh;
  },
  (mesh) => { mesh.visible = false; mesh.userData.life = 0; },
  50, 200
);

function shoot() {
  const bullet = bulletPool.acquire();
  bullet.visible = true;
  bullet.position.copy(camera.position);
  camera.getWorldDirection(bullet.userData.vel);
  bullet.userData.vel.multiplyScalar(50);
  bullet.userData.life = 2.0;
}

// In update loop:
for (const bullet of bulletPool.active) {
  bullet.userData.life -= dt;
  if (bullet.userData.life <= 0) {
    bulletPool.release(bullet);
    continue;
  }
  bullet.position.addScaledVector(bullet.userData.vel, dt);
}
```

**Critical**: when you iterate `bulletPool.active` and call `release(bullet)` mid-iteration, the Set is mutated. Iterate defensively:

```js
for (const bullet of [...bulletPool.active]) { ... }
```

Or queue releases until after the loop:

```js
const toRelease = [];
for (const bullet of bulletPool.active) {
  if (bullet.userData.life <= 0) { toRelease.push(bullet); continue; }
  // ...
}
toRelease.forEach(b => bulletPool.release(b));
```

## Scene Management

For multi-level games, never let the previous level's meshes linger. Tear down completely before loading the next.

```js
class SceneManager {
  constructor(scene) {
    this.scene = scene;
    this.current = null;
  }

  load(newScene) {
    if (this.current) {
      this.current.dispose(this.scene);
      this.scene.remove(this.current.root);
    }
    this.current = newScene;
    this.current.build(this.scene);
    this.scene.add(this.current.root);
  }
}

class Level {
  constructor() { this.root = new THREE.Group(); }
  build(scene) {
    // add meshes, lights, etc to this.root
    // store references for cleanup
  }
  dispose(scene) {
    // dispose geometries, materials, textures, stop audio loops
    this.root.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material?.dispose();
      }
    });
  }
}
```

## Event Bus

Loose coupling between systems. Player picks up coin → audio plays, score updates, particle burst, save game increments counter. Don't write 4 calls in the pickup function — emit one event.

```js
class EventBus {
  constructor() { this.handlers = new Map(); }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(fn);
    return () => this.off(event, fn);   // return disposer
  }
  off(event, fn) {
    const arr = this.handlers.get(event);
    if (arr) {
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    }
  }
  emit(event, ...args) {
    const arr = this.handlers.get(event);
    if (arr) for (const fn of [...arr]) fn(...args);   // copy — handlers may unsubscribe mid-emit
  }
}

const events = new EventBus();

// Pickup system
function onPickup(item) {
  if (item.type === 'coin') {
    events.emit('coin', item.value);
    // ...
  }
}

// Score system
events.on('coin', (value) => score += value);

// Audio system
events.on('coin', () => audio.play('coin'));

// Particle system
events.on('coin', (value, pos) => spawnParticles(pos));

// Save system
events.on('coin', () => saveGame.increment('coins', 1));
```

Caveats:
- Don't put high-frequency events through the bus (per-frame position updates). Use direct calls.
- Event handlers run synchronously. Don't do async work in handlers — emit "requestX", do async in a separate system.

## Service Locator

For systems that need to be accessed from many places (audio, input, save, render), don't pass them as constructor args to everything (constructor spam) and don't make them global singletons (test-resistant). Service locator is the middle ground.

```js
class Services {
  static registry = new Map();
  static register(name, instance) { this.registry.set(name, instance); }
  static get(name) { return this.registry.get(name); }
}

// At startup:
Services.register('audio', new AudioSystem());
Services.register('input', new InputSystem());
Services.register('save', new SaveSystem());

// Anywhere:
Services.get('audio').play('shoot');
```

Better than globals because:
- One place to look up what services exist
- Easy to mock in tests
- Lazy registration: services can register themselves when ready

## Time-Safe Updates

A bug source: subsystems that run their own `requestAnimationFrame` loops. They compete with the main loop for CPU and have no notion of the game's pause state.

Rule: **there is one render loop.** All subsystems hook into it via `update(dt)`. This means:
- Audio system gets `update(dt)` to fade out sounds based on game state
- Particle system gets `update(dt)` to advance particle lives
- Even DOM UI animations should use the game's dt, not their own

Exception: loading screens. A loading screen runs while the main game loop is stopped, so it needs its own loop. Always clean it up when the main loop resumes.

---

## Architecture Decision Tree

```
Game with <10 entity types and <1000 entities → Use simple classes (Player, Enemy, Bullet)
Game with many entity types or 1000+ entities → Use ECS
Game with multiple levels → SceneManager + StateMachine
Game with complex cross-system interactions → EventBus
Game with no UI beyond HUD → DOM overlay (simpler than Babylon GUI)
Game with complex menus/dialogs/inventory → Babylon GUI or in-canvas UI
Game with pause/resume → StateMachine (every state has explicit enter/exit)
Game with networking → Fixed timestep + ECS + event bus (predict/rollback pattern)
```

## Anti-Patterns

- **God object**: `Game` class that owns everything and has 500 methods. Split into subsystems.
- **Singleton everywhere**: every system is `static`. Untestable, inflexible. Use service locator.
- **Per-frame allocation**: `new THREE.Vector3()` inside `update()`. GC pauses. Reuse scratch vectors.
- **Mixed update rates**: physics runs at 60 Hz, AI at 10 Hz, but you call both in the same loop. Frame-rate-dependent AI behavior.
- **No disposal**: scene transitions leak GPU memory. Always `dispose()` on teardown.

---

End of architecture reference. For physics implementation, see `references/physics-collision.md`. For procedural content, see `references/procedural-generation.md`.
