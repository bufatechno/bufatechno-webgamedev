# Three.js Complete Reference for Game Development

This is the comprehensive Three.js reference. Read it fully before writing any Three.js code. Code blocks are production-grade — copy verbatim unless the user's game needs otherwise.

## Table of Contents

1. [Renderer Setup](#renderer-setup)
2. [Scene & Camera](#scene--camera)
3. [Lighting](#lighting)
4. [Materials](#materials)
5. [Geometry & Mesh](#geometry--mesh)
6. [Instanced Rendering](#instanced-rendering)
7. [Game Loop Pattern](#game-loop-pattern)
8. [Pointer Lock & Mouse Look (FPS)](#pointer-lock--mouse-look-fps)
9. [Third-Person Camera Rig](#third-person-camera-rig)
10. [Raycasting](#raycasting)
11. [Post-Processing](#post-processing)
12. [GLTF Model Loading](#gltf-model-loading)
13. [Procedural Textures via Canvas](#procedural-textures-via-canvas)
14. [Custom Shaders](#custom-shaders)
15. [Shadows](#shadows)
16. [Fog & Sky](#fog--sky)
17. [Disposal & Memory](#disposal--memory)
18. [Resize Handling](#resize-handling)
19. [WebGL Context Loss](#webgl-context-loss)
20. [Common Pitfalls](#common-pitfalls)

---

## Renderer Setup

Always configure the renderer for game-quality output. Defaults are not enough.

```js
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({
  antialias: true,                  // smooth edges
  powerPreference: 'high-performance',
  stencil: false,                   // games rarely need stencil buffer
  depth: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// CRITICAL: cap pixel ratio. devicePixelRatio=3 on phones murders GPU.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Tone mapping gives natural-looking lighting. ALWAYS use ACESFilmic for games.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// sRGB output for correct color in modern browsers.
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Shadow map — enable for any scene with a directional light.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // soft shadows, good perf

document.getElementById('app').appendChild(renderer.domElement);
```

Notes:
- `setPixelRatio(Math.min(dpr, 2))` is the single biggest mobile perf win. Above 2 is invisible quality, 4x GPU cost.
- `ACESFilmicToneMapping` is the film-industry standard. Without it, bright lights blow out to white.
- `outputColorSpace = SRGBColorSpace` (the default in r152+) — do not change unless you know why.

## Scene & Camera

```js
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88aacc);   // sky-blue fallback
scene.fog = new THREE.FogExp2(0x88aacc, 0.01);  // fog for depth cues

// Perspective camera — 75 FOV is the FPS sweet spot
const camera = new THREE.PerspectiveCamera(
  75,                                            // FOV
  window.innerWidth / window.innerHeight,         // aspect
  0.1,                                           // near
  1000                                           // far
);
camera.position.set(0, 1.7, 5);
camera.lookAt(0, 1.7, 0);
```

For **voxel/large-world** games, push `far` to 10000+ but enable **logarithmic depth buffer** to avoid z-fighting:

```js
const renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true, antialias: true });
```

For **orthographic** (top-down RTS, 2.5D platformers):

```js
const aspect = window.innerWidth / window.innerHeight;
const size = 10;
const camera = new THREE.OrthographicCamera(
  -size * aspect, size * aspect,
  size, -size,
  0.1, 1000
);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);
```

## Lighting

A correctly lit scene is the difference between "professional game" and "default demo". Always layer 3 lights:

```js
// 1. Hemisphere light — sky/ground bounce. Cheap, looks great.
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a3a2a, 0.6);
scene.add(hemi);

// 2. Directional light — the "sun". Casts shadows.
const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
sun.position.set(50, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.0005;       // prevents shadow acne
sun.shadow.normalBias = 0.02;    // prevents peter-panning on thin geometry
scene.add(sun);

// 3. Ambient — tiny fill so shadows are not pure black
const ambient = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(ambient);
```

For indoor / dungeon / night scenes, swap hemisphere for a dim ambient and add point lights for torches/lamps.

## Materials

For any scene with lighting, use **MeshStandardMaterial** — it is PBR (physically based) and matches the look of modern game engines.

```js
// Stone wall
const stoneMat = new THREE.MeshStandardMaterial({
  color: 0x808080,
  roughness: 0.85,
  metalness: 0.05,
});

// Polished metal
const metalMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.2,
  metalness: 0.9,
});

// Glowing emissive (lava, neon)
const glowMat = new THREE.MeshStandardMaterial({
  color: 0x000000,
  emissive: 0xff4400,
  emissiveIntensity: 1.5,
  roughness: 0.6,
});
```

When to use other materials:
- `MeshBasicMaterial` — flat colors, no lighting. UI elements, debug lines, skyboxes.
- `MeshLambertMaterial` — cheap diffuse only. Mobile fallback, low-end.
- `MeshPhongMaterial` — shiny plastic look. Retro games, stylized.
- `MeshStandardMaterial` — **default choice** for any lit game.
- `MeshPhysicalMaterial` — adds clearcoat, transmission (glass), IOR. Use for water, glass, car paint. Heavier.

**Texture color space** — common silent bug:

```js
const colorTex = textureLoader.load('./diffuse.png');
colorTex.colorSpace = THREE.SRGBColorSpace;     // color/albedo textures

const normalTex = textureLoader.load('./normal.png');
// normalTex.colorSpace = NoColorSpace (default) — DO NOT change

const roughTex = textureLoader.load('./roughness.png');
// roughTex.colorSpace = NoColorSpace (default)
```

## Geometry & Mesh

```js
// Shared primitive — reuse across many meshes
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

for (let i = 0; i < 100; i++) {
  const wall = new THREE.Mesh(boxGeo, wallMat);   // shares geo AND mat
  wall.position.set(i, 0.5, 0);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}
```

For custom geometry (terrain, chunks, procedural meshes), use `BufferGeometry`:

```js
const geo = new THREE.BufferGeometry();
const positions = new Float32Array([
  // triangle 1
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
  // ... more vertices
]);
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.computeVertexNormals();  // CRITICAL — without this, lighting is wrong
```

**Pitfall**: forgetting `computeVertexNormals()` produces a flat-shaded look even with PBR material. Always call it after setting position attribute.

## Instanced Rendering

For any repeated geometry (trees, grass, bullets, particles), use `InstancedMesh`. It draws 10,000 objects in 1 draw call instead of 10,000.

```js
const count = 1000;
const trees = new THREE.InstancedMesh(
  new THREE.ConeGeometry(0.5, 2, 6),
  new THREE.MeshStandardMaterial({ color: 0x2d5a2d }),
  count
);
trees.castShadow = true;
trees.receiveShadow = true;

const dummy = new THREE.Object3D();
for (let i = 0; i < count; i++) {
  dummy.position.set(
    (Math.random() - 0.5) * 100,
    0,
    (Math.random() - 0.5) * 100
  );
  dummy.rotation.y = Math.random() * Math.PI * 2;
  dummy.scale.setScalar(0.8 + Math.random() * 0.4);
  dummy.updateMatrix();
  trees.setMatrixAt(i, dummy.matrix);
}
trees.instanceMatrix.needsUpdate = true;
scene.add(trees);
```

To update a single instance per frame (e.g., bullets moving):

```js
trees.getMatrixAt(i, dummy.matrix);
// modify dummy.matrix
trees.setMatrixAt(i, dummy.matrix);
trees.instanceMatrix.needsUpdate = true;
```

For per-instance colors:

```js
trees.setColorAt(i, new THREE.Color(0x00ff00));
trees.instanceColor.needsUpdate = true;
```

## Game Loop Pattern

Fixed-timestep update with render interpolation. Always use this for game physics.

```js
class Game {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.step = 1 / 60;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._frame(this.lastTime);
  }

  stop() { this.running = false; }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.accumulator += dt;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    const alpha = this.accumulator / this.step;
    this.render(alpha);
    requestAnimationFrame((t) => this._frame(t));
  }

  update(dt) { /* override: physics, AI, input */ }
  render(alpha) { this.renderer.render(this.scene, this.camera); }
}
```

## Pointer Lock & Mouse Look (FPS)

Browser pointer lock is the only way to capture infinite mouse movement for FPS look.

```js
const canvas = renderer.domElement;
const overlay = document.getElementById('click-to-play');

overlay.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  overlay.style.display = locked ? 'none' : 'block';
  if (locked) audio.resume();   // audio context needs a user gesture
});

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const minPolar = -Math.PI / 2 + 0.01;
const maxPolar = Math.PI / 2 - 0.01;

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= e.movementX * 0.002;  // yaw
  euler.x -= e.movementY * 0.002;  // pitch
  euler.x = Math.max(minPolar, Math.min(maxPolar, euler.x));
  camera.quaternion.setFromEuler(euler);
});
```

Notes:
- Sensitivity `0.002` is a starting point. Make it user-configurable.
- `'YXZ'` order is critical — Y first, then X. Otherwise roll creeps in.
- Clamp pitch to just below ±90° to avoid gimbal flip.

## Third-Person Camera Rig

Spring-arm camera with collision avoidance.

```js
class ThirdPersonCamera {
  constructor(camera, target) {
    this.camera = camera;
    this.target = target;          // Object3D the camera follows
    this.offset = new THREE.Vector3(0, 2, 5);
    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this.lerp = 8;                 // higher = snappier
  }

  update(dt, raycaster, collideObjects) {
    const idealPos = new THREE.Vector3()
      .copy(this.offset)
      .applyQuaternion(this.target.quaternion)
      .add(this.target.position);

    // Camera collision: raycast from target to idealPos, pull in if hit
    const dir = new THREE.Vector3().subVectors(idealPos, this.target.position);
    const dist = dir.length();
    dir.normalize();
    raycaster.set(this.target.position, dir);
    raycaster.far = dist;
    const hits = raycaster.intersectObjects(collideObjects, true);
    if (hits.length > 0) {
      idealPos.copy(hits[0].point).addScaledVector(dir, -0.3);
    }

    // Smooth follow
    const t = 1 - Math.exp(-this.lerp * dt);
    this.smoothPos.lerp(idealPos, t);

    const lookAt = new THREE.Vector3()
      .copy(this.target.position)
      .add(new THREE.Vector3(0, 1.5, 0));
    this.smoothLook.lerp(lookAt, t);

    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothLook);
  }
}
```

## Raycasting

Raycasting is used for: hitscan shooting, ground detection, clicking on objects, line-of-sight.

```js
const raycaster = new THREE.Raycaster();
raycaster.far = 200;

// Hitscan shoot — from camera center forward
function shoot() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);   // center of screen
  const hits = raycaster.intersectObjects(enemies, false);
  if (hits.length > 0) {
    const hit = hits[0];
    // hit.point — world-space hit position
    // hit.object — the mesh hit
    // hit.face.normal — face normal in local space
    const headshot = hit.point.y > hit.object.position.y + 1.5;
    applyDamage(hit.object, headshot ? 100 : 25);
  }
}

// Ground detection — is player on ground?
function isGrounded(playerPos) {
  raycaster.set(playerPos, new THREE.Vector3(0, -1, 0));
  raycaster.far = 0.2;
  return raycaster.intersectObjects(colliders, false).length > 0;
}
```

Performance: raycasting against 10,000 meshes is slow. Use collision proxy meshes (simple boxes) for raycast targets, not the visible detailed meshes.

## Post-Processing

Bloom, FXAA, vignette, etc. via EffectComposer.

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.4,   // radius
  0.85   // threshold — only bright things bloom
);
composer.addPass(bloom);

const fxaa = new ShaderPass(FXAAShader);
fxaa.material.uniforms['resolution'].value.set(
  1 / window.innerWidth, 1 / window.innerHeight
);
composer.addPass(fxaa);

composer.addPass(new OutputPass());  // final tone mapping + color space

// In the loop:
// renderer.render(scene, camera);   // <- DO NOT do this when using composer
composer.render();
```

Notes:
- `OutputPass` handles tone mapping + color space at the END of the chain. If you forget it, colors will look washed out.
- Each pass is a full-screen draw. Keep the chain under 5 passes for mobile.
- Bloom is the single biggest "looks pro" win for low-budget games.

## GLTF Model Loading

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/draco/gltf/');
loader.setDRACOLoader(draco);

loader.load(
  './model.glb',
  (gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(model);
  },
  (progress) => console.log((progress.loaded / progress.total * 100).toFixed(1) + '%'),
  (error) => console.error('GLTF load failed:', error)
);
```

For animations in the GLTF:

```js
const mixer = new THREE.AnimationMixer(model);
const idle = mixer.clipAction(gltf.animations[0]);
idle.play();

// In update loop:
mixer.update(dt);
```

## Procedural Textures via Canvas

When you cannot ship external image files, generate textures procedurally. This keeps the deliverable self-contained.

```js
function makeNoiseTexture(size = 256, baseColor = '#888') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    img.data[i]     += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const mat = new THREE.MeshStandardMaterial({
  map: makeNoiseTexture(256, '#806040'),
  roughnessMap: makeNoiseTexture(256, '#404040'),
});
```

For more procedural texture patterns (wood, stone, grass, brick, metal), see `references/2d-drawing-textures.md`.

## Custom Shaders

For effects that built-in materials cannot do — water, foliage, dissolve, hologram, custom terrain.

```js
const waterMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x3366aa) },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin(p.x * 3.0 + uTime * 2.0) * 0.1
              + sin(p.z * 4.0 + uTime * 1.5) * 0.05;
      p.y += w;
      vWave = w;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vWave;
    void main() {
      vec3 c = uColor + vWave * 0.3;
      gl_FragColor = vec4(c, 0.85);
    }
  `,
  transparent: true,
});

// In update loop:
waterMat.uniforms.uTime.value += dt;
```

**Pitfall**: never declare your own `attribute uv` / `attribute position` / `attribute normal` in vertex shaders — Three.js injects them automatically. Doing so causes silent conflicts.

## Shadows

Already covered in the directional light section. Recap of the rules:

1. `renderer.shadowMap.enabled = true`
2. Light has `castShadow = true`
3. Each mesh has `castShadow` and/or `receiveShadow = true`
4. Set `shadow.mapSize` to at least 2048²
5. Set `shadow.camera` bounds tightly around the play area — large bounds reduce shadow map resolution per pixel
6. `shadow.bias = -0.0005` cures most acne
7. `shadow.normalBias = 0.02` cures peter-panning on thin geometry

For point lights, use `PointLight` with `shadow.mapSize` 1024² (cubemaps are expensive — 6 face renders).

## Fog & Sky

```js
// Linear fog (clear start/end distances)
scene.fog = new THREE.Fog(0x88aacc, 50, 200);

// Exponential fog (more realistic density falloff)
scene.fog = new THREE.FogExp2(0x88aacc, 0.008);

// Sky gradient shader (cheaper than skybox textures)
const skyGeo = new THREE.SphereGeometry(500, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor:    { value: new THREE.Color(0x4a8cff) },
    bottomColor: { value: new THREE.Color(0xaaccff) },
    offset:      { value: 33 },
    exponent:    { value: 0.6 },
  },
  vertexShader: `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPos;
    void main() {
      float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));
```

## Disposal & Memory

GPU resources are NOT garbage collected. You must dispose them manually or you will leak memory and crash long sessions.

```js
function disposeObject(obj) {
  obj.traverse((node) => {
    if (node.isMesh) {
      node.geometry?.dispose();
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => disposeMaterial(m));
      } else {
        disposeMaterial(node.material);
      }
    }
  });
}

function disposeMaterial(mat) {
  Object.values(mat).forEach((v) => {
    if (v && v.isTexture) v.dispose();
  });
  mat.dispose();
}

// Use when removing a level/scene:
disposeObject(oldLevel);
scene.remove(oldLevel);
```

For object pools, do NOT dispose — just hide and reuse:

```js
class Pool {
  constructor(factory, size) {
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < size; i++) this.free.push(factory());
  }
  acquire() {
    const obj = this.free.pop() ?? this.factory();   // grow if empty
    this.active.add(obj);
    obj.visible = true;
    return obj;
  }
  release(obj) {
    obj.visible = false;
    this.active.delete(obj);
    this.free.push(obj);
  }
}
```

## Resize Handling

```js
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  if (fxaaPass) fxaaPass.material.uniforms['resolution'].value.set(1/w, 1/h);
});
```

## WebGL Context Loss

Browsers will drop the WebGL context when the GPU is under pressure (especially mobile). Handle it or the game silently dies.

```js
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  game.stop();
  showOverlay('Graphics context lost. Reload to continue.');
}, false);

renderer.domElement.addEventListener('webglcontextrestored', () => {
  // Re-create geometries, materials, textures — the renderer's GPU state is gone.
  initScene();
  game.start();
}, false);
```

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Black screen, no errors | Camera inside a mesh, or far plane too small | Move camera back, increase `far` |
| Everything looks flat and gray | No lights, or only AmbientLight | Add directional + hemisphere lights |
| Colors look washed out | Missing `OutputPass` in post-processing chain | Add `OutputPass` as last pass |
| Textures look dark/wrong | Wrong color space | Set `colorSpace = SRGBColorSpace` for color textures only |
| Z-fighting (flickering coplanar surfaces) | Depth buffer precision | Increase `near`, decrease `far`, OR use `logarithmicDepthBuffer: true` |
| Shadows look pixelated | Shadow map too small or camera bounds too wide | `shadow.mapSize.set(2048, 2048)` and tighten bounds |
| Shadow acne (stripes) | Self-shadowing artifacts | `shadow.bias = -0.0005` |
| Player falls through floor | Physics not set up, or `raycaster.far` too short | Increase far, ensure floor mesh is in colliders list |
| Game runs fine then crashes after 5 min | Memory leak — geometries/materials/textures not disposed | Add `dispose()` calls; use object pools |
| FPS drops when many objects added | Each `Mesh` is a draw call | Use `InstancedMesh` for repeated geometry |
| Pointer lock doesn't engage | Called outside user gesture | Wrap `requestPointerLock()` in click handler |
| Audio doesn't play | AudioContext created before user gesture | Create/resume on first click |

---

End of Three.js reference. For game-type-specific code, see `fps-game-template.md`, `voxel-game-template.md`, `third-person-template.md`, or `platformer-template.md`.
