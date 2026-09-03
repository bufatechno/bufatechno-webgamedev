# Performance Optimization Reference

How to hit 60 FPS on a 2020 mid-range laptop with 100+ active objects. Apply these techniques when your game stutters — do not pre-optimize, profile first.

## Table of Contents

1. [Profiling — Always Measure First](#profiling--always-measure-first)
2. [Draw Call Budget](#draw-call-budget)
3. [Instanced Rendering](#instanced-rendering)
4. [Frustum Culling](#frustum-culling)
5. [LOD (Level of Detail)](#lod-level-of-detail)
6. [Geometry Merging](#geometry-merging)
7. [Texture Atlas](#texture-atlas)
8. [Pixel Ratio Cap](#pixel-ratio-cap)
9. [Memory Management](#memory-management)
10. [Worker Threads](#worker-threads)
11. [Mobile-Specific Pitfalls](#mobile-specific-pitfalls)
12. [Render Stats (Debug)](#render-stats-debug)

---

## Profiling — Always Measure First

Do not guess what's slow. Use these tools:

### Chrome DevTools Performance Tab

1. F12 → Performance tab
2. Click record, play for 10 seconds
3. Stop, look at the flamegraph

Common patterns:
- A tall "render" block per frame means GPU bottleneck — reduce draw calls
- Many small "JS" blocks mean CPU bottleneck — reduce per-frame work
- A "Major GC" block every few seconds means memory churn — reduce allocations

### Three.js Renderer Stats

```js
renderer.info.reset();
renderer.render(scene, camera);
console.log(renderer.info);
// {
//   render: { calls: 42, triangles: 12453, lines: 0, points: 0 },
//   memory: { geometries: 18, textures: 24 },
//   programs: 12
// }
```

Target: <100 draw calls per frame for 60 FPS on mid-range hardware.

### Frame Time Counter

```js
let frameCount = 0;
let lastFpsTime = performance.now();
function fpsCounter() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    console.log(`FPS: ${frameCount} | Draw calls: ${renderer.info.render.calls} | Triangles: ${renderer.info.render.triangles}`);
    frameCount = 0;
    lastFpsTime = now;
  }
}
```

### GPU Time (Chrome only, with `--enable-gpu-benchmarking`)

```js
const ext = renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
// Use this to get actual GPU time per draw call — much harder than CPU profiling but reveals real bottlenecks.
```

## Draw Call Budget

A draw call = one CPU command to the GPU "render this mesh with this material". CPU overhead per call ~0.1 ms. 100 calls = 10 ms = 60 FPS limit.

**Budget targets:**
- Mobile: <50 draw calls
- Desktop mid-range: <200 draw calls
- Desktop high-end: <1000 draw calls

**Reduction techniques:**
1. **Instanced rendering** — 1 draw call for 10,000 instances of the same geometry + material. Best win.
2. **Merge static geometry** — combine all wall meshes into one BufferGeometry. Reduces calls from N to 1.
3. **Texture atlas** — combine multiple textures into one. Multiple sprites using the atlas can share one material = one draw call.
4. **Material sharing** — 100 meshes using the same material = better than 100 materials.
5. **Disable shadow casting** on tiny objects (grass, particles).

## Instanced Rendering

```js
const count = 10000;
const trees = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.5, 2, 6),
  new THREE.MeshStandardMaterial({ color: 0x2d5a2d }),
  count
);

const dummy = new THREE.Object3D();
for (let i = 0; i < count; i++) {
  dummy.position.set(
    (Math.random() - 0.5) * 200,
    0,
    (Math.random() - 0.5) * 200
  );
  dummy.updateMatrix();
  trees.setMatrixAt(i, dummy.matrix);
}
trees.instanceMatrix.needsUpdate = true;
scene.add(trees);
```

**One draw call for 10,000 trees.** This is the single biggest perf win in WebGL.

Babylon.js equivalent: `thinInstanceSetBuffer` (see `babylonjs-complete.md`).

### Per-instance color

```js
const colors = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  colors[i*3] = Math.random();
  colors[i*3+1] = 0.5 + Math.random() * 0.3;
  colors[i*3+2] = Math.random() * 0.3;
}
trees.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
trees.material.vertexColors = true;
```

### Updating per frame (bullets, particles)

```js
for (let i = 0; i < bullets.length; i++) {
  bullets[i].position.addScaledVector(bullets[i].velocity, dt);
  dummy.position.copy(bullets[i].position);
  dummy.updateMatrix();
  bulletMesh.setMatrixAt(i, dummy.matrix);
}
bulletMesh.instanceMatrix.needsUpdate = true;
```

**Critical**: setting `needsUpdate = true` triggers a full GPU buffer upload. If only 5 of 1000 instances changed, you still re-upload all 1000 matrices. For massive counts, use `instanceMatrix.updateRange` to upload only the changed range.

## Frustum Culling

Three.js does frustum culling automatically — meshes outside the camera's view frustum are skipped.

But: each `Mesh` has its own bounding sphere. If you `InstancedMesh`'d 10,000 trees into one, the bounding sphere covers the whole 10,000-tree area. They're never culled.

Solutions:
1. **Split instanced meshes spatially** — one InstancedMesh per chunk/region. Out-of-view chunks are culled as a unit.
2. **Custom culling** — for each instance, manually check if it's in the frustum; if not, set its matrix to zero (scales it to invisible) and the GPU skips the tiny degenerate triangle.

```js
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

function cullInstances() {
  projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    trees.getMatrixAt(i, dummy.matrix);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
    if (frustum.containsPoint(dummy.position)) {
      // visible — keep matrix
    } else {
      // hide — set matrix to zero
      dummy.matrix.makeScale(0, 0, 0);
      trees.setMatrixAt(i, dummy.matrix);
    }
  }
  trees.instanceMatrix.needsUpdate = true;
}
```

## LOD (Level of Detail)

For distant objects, render with lower-poly geometry. 50% triangle savings without visible quality loss.

### Three.js LOD

```js
const lod = new THREE.LOD();
const highDetail = new THREE.Mesh(highGeo, mat);   // 5000 triangles
const medDetail = new THREE.Mesh(medGeo, mat);     // 1000 triangles
const lowDetail = new THREE.Mesh(lowGeo, mat);     // 200 triangles

lod.addLevel(highDetail, 0);     // distance 0 to 20
lod.addLevel(medDetail, 20);     // distance 20 to 50
lod.addLevel(lowDetail, 50);     // distance 50+
lod.addLevel(new THREE.Object3D(), 100);  // invisible past 100 (cull)

scene.add(lod);

// Per frame, Three.js automatically switches based on camera distance.
```

For instanced meshes with LOD, you need a custom shader (Three.js `InstancedMesh` doesn't support LOD natively). Use `InstancedMeshLOD` from three-stdlib, or split into multiple InstancedMeshes per LOD level and switch which one is visible per region.

### Babylon.js LOD

```js
meshLOD = BABYLON.MeshBuilder.CreateSphere('s', { diameter: 1, segments: 32 }, scene);
const lowLOD = BABYLON.MeshBuilder.CreateSphere('s', { diameter: 1, segments: 8 }, scene);
meshLOD.addLODLevel(50, lowLOD);
meshLOD.addLODLevel(100, null);   // null = cull beyond 100
```

## Geometry Merging

Static meshes that share a material can be merged into one BufferGeometry — one draw call instead of N.

```js
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geometries = [];
for (const wall of walls) {
  const g = wall.geometry.clone();
  g.applyMatrix4(wall.matrixWorld);
  geometries.push(g);
}
const merged = mergeGeometries(geometries);
const mergedMesh = new THREE.Mesh(merged, wallMaterial);
scene.add(mergedMesh);
walls.forEach(w => scene.remove(w));
```

**Don't merge everything** — if some meshes need to be culled (distant), keeping them separate lets frustum culling help. Merge only the meshes that always render together (e.g., the walls of one room).

## Texture Atlas

For sprite-heavy games, instead of one texture per sprite, pack all sprites into one larger texture. Each sprite uses a UV region of the atlas — all sprites share one material = one draw call.

```js
// 4x4 atlas of 64x64 sprites = 256x256 texture
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.colorSpace = THREE.SRGBColorSpace;
atlas.magFilter = THREE.NearestFilter;

const spriteMat = new THREE.SpriteMaterial({ map: atlas });
const SPRITES_PER_ROW = 4;
const SPRITE_SIZE = 1 / SPRITES_PER_ROW;

function makeSprite(index) {
  const sprite = new THREE.Sprite(spriteMat);
  const x = (index % SPRITES_PER_ROW) / SPRITES_PER_ROW;
  const y = Math.floor(index / SPRITES_PER_ROW) / SPRITES_PER_ROW;
  // Sprite UVs are 0-1 by default. To use a sub-region, modify the texture offset/repeat.
  sprite.material = spriteMat.clone();
  sprite.material.map = atlas.clone();
  sprite.material.map.offset.set(x, y);
  sprite.material.map.repeat.set(SPRITE_SIZE, SPRITE_SIZE);
  sprite.material.map.needsUpdate = true;
  return sprite;
}
```

For 100 sprites sharing one atlas: 1 draw call instead of 100. ~100x perf improvement.

## Pixel Ratio Cap

Single biggest mobile optimization:

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

Pixel ratio 3 (most phones) means 9x more pixels than 1. Capping at 2 saves 80% GPU time with no visible quality loss (the screen physically can't show 3x density).

For ultra-low-end devices, cap at 1:

```js
const isLowEnd = navigator.hardwareConcurrency <= 4 && /Mobi|Android/i.test(navigator.userAgent);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowEnd ? 1 : 2));
```

## Memory Management

GPU memory is not GC'd. Each `Geometry`, `Material`, `Texture` lives until you call `.dispose()`.

### Object pool pattern (see architecture.md)

For projectiles and particles:

```js
class BulletPool {
  constructor(size) {
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < size; i++) this.free.push(createBullet());
  }
  acquire() {
    const b = this.free.pop() ?? createBullet();
    this.active.add(b);
    b.visible = true;
    return b;
  }
  release(b) {
    b.visible = false;
    this.active.delete(b);
    this.free.push(b);
  }
}
```

### Dispose on scene teardown

```js
function disposeScene(scene) {
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => disposeMaterial(m));
      else disposeMaterial(obj.material);
    }
  });
  scene.clear();
}

function disposeMaterial(mat) {
  Object.values(mat).forEach((v) => {
    if (v?.isTexture) v.dispose();
  });
  mat.dispose();
}
```

### Reduce per-frame allocations

`new THREE.Vector3()` triggers GC. Reuse scratch vectors:

```js
// BAD — allocates per frame
function update(dt) {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  // ...
}

// GOOD — scratch vectors reused
const _dir = new THREE.Vector3();
function update(dt) {
  camera.getWorldDirection(_dir);
  // ...
}
```

## Worker Threads

For CPU-heavy work that doesn't need to be on the main thread:
- Procedural terrain meshing (voxels)
- Pathfinding (A*)
- Procedural generation
- Asset parsing (GLTF decode)

```js
// worker.js
self.onmessage = (e) => {
  if (e.data.type === 'meshChunk') {
    const { blocks, size } = e.data;
    const { positions, indices } = meshChunk(blocks, size);
    self.postMessage({ positions, indices }, [positions.buffer, indices.buffer]);
  }
};

// main.js
const worker = new Worker('./worker.js', { type: 'module' });
worker.onmessage = (e) => {
  const { positions, indices } = e.data;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  // ...
};
worker.postMessage({ type: 'meshChunk', blocks, size });
```

**Critical**: transfer the buffers (last arg of `postMessage`) — without transfer, the data is copied. With transfer, it's zero-copy and the worker loses access to it.

Voxel chunk meshing is the classic example: a 16³ chunk takes 5-10 ms on main thread (frame stutter). On a worker, the main thread renders smoothly while the worker builds the next chunk.

## Mobile-Specific Pitfalls

### WebGL1 vs WebGL2

WebGL2 is universal in 2024. But:
- Some old Android phones report WebGL2 but have driver bugs. Detect and fall back.

```js
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if (!gl) { showUnsupportedMessage(); }
```

### Power preference

```js
const renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance' });
```

Tells the OS to use the discrete GPU on dual-GPU laptops. Default is "default" which sometimes picks the integrated GPU.

### Touch event performance

Touch events on mobile are slow if you don't `preventDefault`:

```js
canvas.addEventListener('touchstart', handler, { passive: false });
// In handler: e.preventDefault();
```

### Avoid CSS heavy DOM overlays

CSS `blur()`, `box-shadow`, `filter: drop-shadow()` are very expensive on mobile. Use sparingly.

### Throttle vs RAF on background tab

`requestAnimationFrame` pauses on background tab. When you come back, `dt` is huge. Cap it:

```js
const dt = Math.min((now - last) / 1000, 0.1);
```

### Memory pressure

Mobile browsers crash easily with >50 MB of GPU memory. Track `renderer.info.memory.textures` and `geometries` — if they keep growing, you have a leak.

## Render Stats (Debug)

Display live stats in the corner:

```js
class Stats {
  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; top: 10px; right: 10px; z-index: 1000;
      background: rgba(0,0,0,0.7); color: lime; font-family: monospace;
      padding: 8px; font-size: 12px; border-radius: 4px;
      pointer-events: none;
    `;
    document.body.appendChild(this.el);
    this.frames = 0;
    this.lastTime = performance.now();
  }
  update() {
    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 500) {
      const fps = this.frames / ((now - this.lastTime) / 1000);
      this.el.textContent = `
FPS: ${fps.toFixed(0)}
Draw: ${renderer.info.render.calls}
Tri: ${renderer.info.render.triangles}
Geo: ${renderer.info.memory.geometries}
Tex: ${renderer.info.memory.textures}
      `.trim();
      this.frames = 0;
      this.lastTime = now;
    }
  }
}

const stats = new Stats();
// In loop: stats.update();
```

For more comprehensive stats, use [stats.js](https://github.com/mrdoob/stats.js/) (~1 KB).

---

## Performance Optimization Decision Tree

```
FPS < 30 → Profile with Chrome DevTools
  └── CPU-bound?
      └── Many small JS tasks per frame?
          └── Reduce per-frame work: pool objects, reuse vectors, batch updates
      └── Single big task?
          └── Move to worker thread
  └── GPU-bound (render call slow)?
      └── Many draw calls (>200)?
          └── InstancedMesh, merge static geometry, texture atlas
      └── Few draw calls but slow?
          └── Reduce triangle count: LOD, simpler geometry, frustum cull
      └── Slow shadows?
          └── Reduce shadow map size to 1024, tighten shadow camera bounds
      └── Slow post-processing?
          └── Remove passes, or lower composer resolution
  └── Frame time spike every ~1 second?
      └── GC pause — reduce per-frame allocations
```

---

End of performance reference. For testing & deployment, see `references/testing-deployment.md`.
