# Babylon.js Complete Reference for Game Development

This is the comprehensive Babylon.js reference. Read it fully before writing any Babylon.js code. Code blocks are production-grade — copy verbatim unless the user's game needs otherwise.

## Table of Contents

1. [Engine & Canvas Setup](#engine--canvas-setup)
2. [Scene & Camera](#scene--camera)
3. [Lighting](#lighting)
4. [Materials (PBR)](#materials-pbr)
5. [Meshes & Built-In Shapes](#meshes--built-in-shapes)
6. [Instanced Rendering (Thin Instances)](#instanced-rendering-thin-instances)
7. [Game Loop Pattern](#game-loop-pattern)
8. [Pointer Lock & Mouse Look (FPS)](#pointer-lock--mouse-look-fps)
9. [Third-Person Camera (FollowCamera)](#third-person-camera-followcamera)
10. [Picking & Raycasting](#picking--raycasting)
11. [Post-Processing](#post-processing)
12. [GLTF Model Loading](#gltf-model-loading)
13. [GUI System](#gui-system)
14. [Physics with Havok](#physics-with-havok)
15. [Procedural Textures (DynamicTexture)](#procedural-textures-dynamictexture)
16. [Custom Shaders (NodeMaterial)](#custom-shaders-nodematerial)
17. [Shadows](#shadows)
18. [Fog & Skybox](#fog--skybox)
19. [Disposal & Scene Teardown](#disposal--scene-teardown)
20. [Resize & Context Loss](#resize--context-loss)
21. [Inspector (Debugging)](#inspector-debugging)
22. [Common Pitfalls](#common-pitfalls)

---

## Engine & Canvas Setup

Babylon uses a Canvas + Engine pattern. Always set hardware scaling for mobile.

```html
<canvas id="renderCanvas" touch-action="none"></canvas>
```

```js
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Engines/WebGL/Extensions/engine.alpha';   // side-effect imports enable tree-shaking-friendly features

const canvas = document.getElementById('renderCanvas');
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: false,
  stencil: false,
  disableWebGL2Support: false,
});

// CRITICAL for mobile: cap hardware scaling. 2 is a good balance.
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));
```

If using the **full bundle** (simpler, larger):

```js
import * as BABYLON from '@babylonjs/core';
const engine = new BABYLON.Engine(canvas, true);
```

The full bundle is ~3 MB; tree-shaking imports get you down to ~600 KB for a basic game. For one-shot deliverables, the full bundle is fine — easier to ship.

## Scene & Camera

```js
const scene = new Scene(engine);
scene.clearColor = new BABYLON.Color4(0.53, 0.67, 0.85, 1.0);   // sky blue
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.53, 0.67, 0.85);
scene.fogDensity = 0.008;

// Universal Camera — the FPS camera. Supports keyboard + mouse.
const camera = new BABYLON.UniversalCamera(
  'playerCam',
  new BABYLON.Vector3(0, 1.7, -5),
  scene
);
camera.setTarget(BABYLON.Vector3.Zero());
camera.fov = 0.8;       // ~75° horizontal at 16:9
camera.minZ = 0.1;
camera.maxZ = 1000;

camera.keysUp    = [87, 38];     // W, Up
camera.keysDown  = [83, 40];     // S, Down
camera.keysLeft  = [65, 37];     // A, Left
camera.keysRight = [68, 39];     // D, Right
camera.speed = 1.5;
camera.inertia = 0.7;
camera.angularSensibility = 1500;  // lower = more sensitive

camera.attachControl(canvas, true);
```

For **ArcRotateCamera** (third-person, RTS, top-down):

```js
const camera = new BABYLON.ArcRotateCamera(
  'orbitCam',
  -Math.PI / 2,
  Math.PI / 3,
  15,
  new BABYLON.Vector3(0, 1, 0),
  scene
);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 3;
camera.upperRadiusLimit = 50;
camera.lowerBetaLimit = 0.1;
camera.upperBetaLimit = Math.PI / 2 - 0.1;  // don't go underground
camera.wheelPrecision = 30;
```

For **FollowCamera** (third-person character):

```js
import { FollowCamera } from '@babylonjs/core/Cameras/followCamera';
const camera = new BABYLON.FollowCamera('follow', new BABYLON.Vector3(0, 5, -10), scene, playerMesh);
camera.radius = 8;
camera.heightOffset = 3;
camera.rotationOffset = 0;
camera.cameraAcceleration = 0.05;
camera.maxCameraSpeed = 20;
```

## Lighting

```js
// 1. HemisphericLight — sky/ground bounce
const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
hemi.intensity = 0.6;
hemi.diffuse = new BABYLON.Color3(0.75, 0.85, 1.0);
hemi.groundColor = new BABYLON.Color3(0.3, 0.25, 0.2);

// 2. DirectionalLight — the "sun". Casts shadows.
const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.5, -1, -0.3), scene);
sun.position = new BABYLON.Vector3(50, 80, 30);
sun.intensity = 2.5;
sun.diffuse = new BABYLON.Color3(1, 0.96, 0.88);
```

## Materials (PBR)

PBRMaterial is Babylon's modern material — equivalent to Three.js MeshStandardMaterial + MeshPhysicalMaterial combined.

```js
// Stone
const stone = new BABYLON.PBRMaterial('stone', scene);
stone.albedoColor = new BABYLON.Color3(0.5, 0.5, 0.5);
stone.roughness = 0.85;
stone.metallic = 0.05;

// Polished metal
const metal = new BABYLON.PBRMaterial('metal', scene);
metal.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.8);
metal.roughness = 0.2;
metal.metallic = 0.95;

// Glowing emissive (lava, neon)
const glow = new BABYLON.PBRMaterial('glow', scene);
glow.emissiveColor = new BABYLON.Color3(1, 0.27, 0);
glow.emissiveIntensity = 1.5;

// Glass
const glass = new BABYLON.PBRMaterial('glass', scene);
glass.alpha = 0.3;
glass.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
glass.roughness = 0.05;
glass.indexOfRefraction = 1.5;
```

For simpler flat-color unlit materials:

```js
const flat = new BABYLON.StandardMaterial('flat', scene);
flat.diffuseColor = new BABYLON.Color3(1, 0, 0);
flat.emissiveColor = new BABYLON.Color3(1, 0, 0);   // ignores lighting
flat.disableLighting = true;
```

For image-based lighting (realistic PBR with environment reflections):

```js
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { EnvironmentHelper } from '@babylonjs/core/Helpers/environmentHelper';

const env = scene.createDefaultEnvironment({
  createGround: false,
  createSkybox: true,
  skyboxSize: 500,
  environmentTexture: 'https://playground.babylonjs.com/textures/environment.env',
});
scene.environmentIntensity = 1.0;
```

## Meshes & Built-In Shapes

```js
// Box
const box = BABYLON.MeshBuilder.CreateBox('box', { width: 1, height: 1, depth: 1 }, scene);
box.material = stone;
box.position.y = 0.5;

// Sphere
const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { diameter: 1, segments: 16 }, scene);

// Ground (large plane)
const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 100, height: 100, subdivisions: 1 }, scene);
ground.material = stone;
ground.receiveShadow = true;

// Heightmap ground
const terrain = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
  'terrain',
  'https://playground.babylonjs.com/textures/heightMap.png',
  { width: 100, height: 100, subdivisions: 100, minHeight: 0, maxHeight: 10 },
  scene
);
```

**Sharing geometry** — Babylon reuses geometry internally when you call `makeGeometryUnique: false`, but for explicit control:

```js
const sharedGeo = box.geometry;
const box2 = new BABYLON.Mesh('box2', scene);
box2.geometry = sharedGeo;   // shares GPU buffer
```

## Instanced Rendering (Thin Instances)

For 10,000+ repeated objects, use **thin instances** — much faster than `InstancedMesh` in Babylon.

```js
const treeMat = new BABYLON.PBRMaterial('treeMat', scene);
treeMat.albedoColor = new BABYLON.Color3(0.18, 0.36, 0.18);
const treeTemplate = BABYLON.MeshBuilder.CreateCylinder('tree', { height: 2, diameterTop: 0, diameterBottom: 0.5 }, scene);
treeTemplate.material = treeMat;
treeTemplate.setEnabled(false);   // template not visible; only instances are

const count = 10000;
const matrices = new Float32Array(count * 16);
const colors = new Float32Array(count * 4);

for (let i = 0; i < count; i++) {
  const m = BABYLON.Matrix.Compose(
    new BABYLON.Vector3(1, 0.8 + Math.random() * 0.4, 1),
    BABYLON.Quaternion.FromEulerAngles(0, Math.random() * Math.PI * 2, 0),
    new BABYLON.Vector3((Math.random() - 0.5) * 200, 0, (Math.random() - 0.5) * 200)
  );
  m.copyToArray(matrices, i * 16);
  colors[i * 4 + 0] = 0.18;
  colors[i * 4 + 1] = 0.36 + Math.random() * 0.1;
  colors[i * 4 + 2] = 0.18;
  colors[i * 4 + 3] = 1;
}

treeTemplate.thinInstanceSetBuffer('matrix', matrices, 16);
treeTemplate.thinInstanceSetBuffer('color', colors, 4);
```

To update individual instances per frame:

```js
// Update instance i
const newMat = BABYLON.Matrix.Compose(...);
newMat.copyToArray(matrices, i * 16);
treeTemplate.thinInstanceSetBuffer('matrix', matrices, 16, true);   // true = update existing buffer
```

## Game Loop Pattern

Babylon's `engine.runRenderLoop` is the standard loop. For fixed-timestep physics, layer your own accumulator:

```js
class Game {
  constructor(scene, engine) {
    this.scene = scene;
    this.engine = engine;
    this.step = 1 / 60;
    this.accumulator = 0;
    this.lastTime = performance.now();
  }

  start() {
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.accumulator += dt;
      while (this.accumulator >= this.step) {
        this.update(this.step);
        this.accumulator -= this.step;
      }
      this.scene.render();
    });
  }

  update(dt) { /* physics, AI, input */ }
}
```

Babylon also has `scene.onBeforeRenderObservable` for per-frame hooks if you do not need fixed timestep:

```js
scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000;
  player.update(dt);
});
```

## Pointer Lock & Mouse Look (FPS)

UniversalCamera supports pointer lock out of the box. Just attach control + request pointer lock on click.

```js
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  // toggle UI overlay based on locked
});
```

UniversalCamera handles mouse look automatically when locked. For finer control, use `camera.inputs`:

```js
camera.inputs.attached.mouse.angularSensibility = 1500;
camera.inputs.attached.keyboard.keysUp = [87, 38];
// etc.
```

For custom FPS controllers (no built-in camera movement), detach camera controls and roll your own:

```js
camera.inputs.clear();   // disable built-in inputs

const euler = new BABYLON.Vector3(0, 0, 0);
canvas.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  camera.rotation.y += e.movementX * 0.002;
  camera.rotation.x += e.movementY * 0.002;
  camera.rotation.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, camera.rotation.x));
});
```

## Third-Person Camera (FollowCamera)

Built-in FollowCamera is the fastest start:

```js
const camera = new BABYLON.FollowCamera('followCam', new BABYLON.Vector3(0, 5, -10), scene, player);
camera.radius = 6;
camera.heightOffset = 2.5;
camera.rotationOffset = 180;   // behind player
camera.cameraAcceleration = 0.05;
camera.maxCameraSpeed = 20;
```

For collision-aware third-person (camera doesn't clip through walls), use `camera.checkCollisions = true` and `camera.ellipsoid`:

```js
camera.checkCollisions = true;
camera.ellipsoid = new BABYLON.Vector3(0.5, 0.5, 0.5);
scene.collisionsEnabled = true;
```

For spring-arm raycast collision (smoother than built-in):

```js
scene.onBeforeRenderObservable.add(() => {
  const dir = camera.position.subtract(player.position).normalize();
  const ray = new BABYLON.Ray(player.position, dir, camera.radius);
  const hit = scene.pickWithRay(ray, (m) => m.checkCollisions && m !== player);
  if (hit.hit) {
    camera.position = hit.pickedPoint.add(dir.scale(-0.3));
  }
});
```

## Picking & Raycasting

Babylon has built-in picking — both click-based and arbitrary ray.

```js
// Click pick
scene.onPointerDown = (evt, pickInfo) => {
  if (pickInfo.hit) {
    console.log('Hit', pickInfo.pickedMesh.name, 'at', pickInfo.pickedPoint);
  }
};

// Arbitrary ray — from camera center forward (hitscan shooting)
function shoot() {
  const ray = scene.createPickingRay(
    engine.getRenderWidth() / 2,
    engine.getRenderHeight() / 2,
    BABYLON.Matrix.Identity(),
    camera,
    false
  );
  const hit = scene.pickWithRay(ray, (m) => m.metadata?.isEnemy);
  if (hit.hit) {
    const headshot = hit.pickedPoint.y > hit.pickedMesh.position.y + 1.5;
    applyDamage(hit.pickedMesh, headshot ? 100 : 25);
  }
}
```

**Pitfall**: `pickWithRay` predicate must return truthy for meshes you want to consider. Without it, all meshes are candidates — including invisible collider proxies.

## Post-Processing

```js
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';

const pipeline = new DefaultRenderingPipeline('default', true, scene, [camera]);

pipeline.bloomEnabled = true;
pipeline.bloom.threshold = 0.85;
pipeline.bloom.weight = 0.6;
pipeline.bloom.kernel = 64;

pipeline.fxaaEnabled = true;

pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 2;
pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 0.5);

pipeline.imageProcessing.contrast = 1.2;
pipeline.imageProcessing.exposure = 1.0;

pipeline.depthOfFieldEnabled = false;   // toggle on for cutscenes
pipeline.depthOfField.focalLength = 50;
```

`DefaultRenderingPipeline` is the easiest one-stop shop. It includes bloom, FXAA, DoF, vignette, image processing (tone mapping, contrast, exposure). For more, see `@babylonjs/core/PostProcesses` for individual passes.

## GLTF Model Loading

```js
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';   // registers the GLTF loader

SceneLoader.ImportMesh('', './', 'model.glb', scene, (meshes, particleSystems, skeletons, animationGroups) => {
  const root = meshes[0];
  root.scaling = new BABYLON.Vector3(1, 1, 1);
  // meshes is the array of all meshes in the model
  // animationGroups is what you use to play animations

  if (animationGroups.length > 0) {
    animationGroups[0].start(true);   // loop
  }
}, (evt) => {
  console.log('Loading:', (evt.loadedBytes / evt.totalBytes * 100).toFixed(1) + '%');
}, (scene, msg, ex) => {
  console.error('GLTF load failed:', msg, ex);
});
```

For Draco-compressed GLB:

```js
import '@babylonjs/loaders/draco';   // side-effect import
```

## GUI System

Babylon GUI is in-canvas, framework-independent, and the main reason developers choose Babylon over Three.js for games with complex UI.

```js
import { AdvancedDynamicTexture } from '@babylonjs/gui/2D/advancedDynamicTexture';
import { Button, StackPanel, TextBlock, Rectangle, Image } from '@babylonjs/gui';

const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui');

// Crosshair
const crosshair = new BABYLON.GUI.Ellipse();
crosshair.width = '16px';
crosshair.height = '16px';
crosshair.color = 'white';
crosshair.thickness = 2;
crosshair.background = 'transparent';
ui.addControl(crosshair);

// Health bar
const healthBar = new BABYLON.GUI.Rectangle();
healthBar.width = '200px';
healthBar.height = '20px';
healthBar.top = '20px';
healthBar.left = '20px';
healthBar.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
healthBar.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
healthBar.background = '#800';
healthBar.color = '#f00';
ui.addControl(healthBar);

const healthFill = new BABYLON.GUI.Rectangle();
healthFill.width = '100%';
healthFill.height = '100%';
healthFill.background = '#f33';
healthFill.color = 'transparent';
healthBar.addControl(healthFill);

// Update health
function setHealth(percent) {
  healthFill.width = (percent * 100) + '%';
}

// Button
const btn = BABYLON.GUI.Button.CreateSimpleButton('start', 'Start Game');
btn.width = '200px';
btn.height = '50px';
btn.color = 'white';
btn.background = '#2a8';
btn.onPointerClickObservable.add(() => {
  game.start();
});
ui.addControl(btn);
```

For text-only debug overlay, AdvancedDynamicTexture is heavyweight — use a DOM overlay instead. Babylon GUI excels at in-canvas HUD/menus.

## Physics with Havok

Havok is the modern Babylon physics engine (replaces Cannon, Ammo, Oimo).

```js
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import havokWasm from '@babylonjs/havok';

// Async init
async function initPhysics() {
  const havok = await havokWasm();
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), plugin);
}

// Static ground
ground.physicsBody = new BABYLON.PhysicsBody(ground, BABYLON.PhysicsMotionType.STATIC, false, scene);
const groundShape = new BABYLON.PhysicsShapeBox(
  new BABYLON.Vector3(0, 0, 0),
  new BABYLON.Quaternion(0, 0, 0, 1),
  new BABYLON.Vector3(100, 0.01, 100),
  scene
);
groundShape.material = { friction: 0.5, restitution: 0.1 };
ground.physicsBody.shape = groundShape;

// Dynamic box
box.physicsBody = new BABYLON.PhysicsBody(box, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
const boxShape = new BABYLON.PhysicsShapeBox(
  new BABYLON.Vector3(0, 0, 0),
  new BABYLON.Quaternion(0, 0, 0, 1),
  new BABYLON.Vector3(1, 1, 1),
  scene
);
box.physicsBody.shape = boxShape;
box.physicsBody.setMassProperties({ mass: 1 });
```

If you cannot ship the Havok WASM (CDN restrictions), use the simpler `@babylonjs/core/Physics/v1` with `OimoJSPlugin` or `CannonJSPlugin`:

```js
import '@babylonjs/core/Physics/physics';
import * as Cannon from 'cannon-es';

scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin(true, 10, Cannon));
```

For simpler games without physics: do ground detection with raycast + manual gravity. See `references/physics-collision.md` for both approaches.

## Procedural Textures (DynamicTexture)

```js
// Canvas-based texture — draw anything on a 2D canvas, use it as a Babylon texture
const dynTex = new BABYLON.DynamicTexture('dynTex', { width: 256, height: 256 }, scene, false);
const ctx = dynTex.getContext();
ctx.fillStyle = '#806040';
ctx.fillRect(0, 0, 256, 256);
for (let i = 0; i < 2000; i++) {
  ctx.fillStyle = `rgba(${Math.random() * 40 | 0}, ${Math.random() * 30 | 0}, 0, 0.3)`;
  ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
}
dynTex.update();   // CRITICAL — upload canvas to GPU

const mat = new BABYLON.PBRMaterial('noiseMat', scene);
mat.albedoTexture = dynTex;
```

For more procedural texture recipes, see `references/2d-drawing-textures.md`.

## Custom Shaders (NodeMaterial)

Babylon's NodeMaterial lets you build shaders visually with the Node Material Editor (NME), then export the JSON. For hand-written GLSL:

```js
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';

BABYLON.Effect.ShadersStore['waterVertexShader'] = `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 worldViewProjection;
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vUv = uv;
    vec3 p = position;
    float w = sin(p.x * 3.0 + uTime * 2.0) * 0.1 + sin(p.z * 4.0 + uTime * 1.5) * 0.05;
    p.y += w;
    vWave = w;
    gl_Position = worldViewProjection * vec4(p, 1.0);
  }
`;

BABYLON.Effect.ShadersStore['waterFragmentShader'] = `
  precision highp float;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vWave;
  void main() {
    vec3 c = uColor + vWave * 0.3;
    gl_FragColor = vec4(c, 0.85);
  }
`;

const waterMat = new BABYLON.ShaderMaterial('water', scene, 'water', {
  attributes: ['position', 'uv'],
  uniforms: ['worldViewProjection', 'uTime', 'uColor'],
});
waterMat.setFloat('uTime', 0);
waterMat.setColor3('uColor', new BABYLON.Color3(0.2, 0.4, 0.7));
waterMat.alpha = 0.85;

// In update loop:
waterMat.setFloat('uTime', elapsed);
```

Notes:
- Babylon uses `worldViewProjection` (one matrix) vs Three's split `projectionMatrix * modelViewMatrix`. Same math, different name.
- `Effect.ShadersStore` registers shaders globally — register once, instantiate many times.
- Babylon injects `position`, `normal`, `uv`, `color`, `tangent`, `world`, `worldView`, `view`, `viewProjection`, etc. when listed in attributes/uniforms.

## Shadows

```js
const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurScale = 2;
shadowGen.bias = 0.0005;
shadowGen.normalBias = 0.02;
shadowGen.darkness = 0.4;

shadowGen.addShadowCaster(box);
shadowGen.addShadowCaster(player);

ground.receiveShadows = true;
```

Notes:
- `ShadowGenerator` is per-light. Each shadow-casting light needs its own generator.
- 2048 is the sweet spot. 1024 looks pixelated; 4096 is wasted on mobile.
- `useBlurExponentialShadowMap = true` gives soft shadows cheaper than PCF.
- Don't forget `mesh.receiveShadows = true` on ground/large surfaces.

## Fog & Skybox

```js
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogColor = new BABYLON.Color3(0.53, 0.67, 0.85);
scene.fogDensity = 0.008;

// Skybox (cube texture)
const skybox = BABYLON.MeshBuilder.CreateBox('skybox', { size: 1000 }, scene);
const skyMat = new BABYLON.StandardMaterial('skyMat', scene);
skyMat.backFaceCulling = false;
skyMat.reflectionTexture = new BABYLON.CubeTexture('https://playground.babylonjs.com/textures/skybox.env', scene);
skyMat.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
skyMat.disableLighting = true;
skybox.material = skyMat;
skybox.infiniteDistance = true;   // follows camera, never falls behind
```

## Disposal & Scene Teardown

```js
function disposeScene(scene) {
  scene.meshes.forEach((m) => {
    m.material?.dispose();
    m.geometry?.dispose();
  });
  scene.materials.forEach((m) => m.dispose());
  scene.textures.forEach((t) => t.dispose());
  scene.dispose();
}
```

Always dispose when switching levels to avoid GPU memory growth.

## Resize & Context Loss

```js
window.addEventListener('resize', () => engine.resize());

engine.onContextLostObservable.add(() => {
  console.warn('WebGL context lost');
  // show reload overlay
});

engine.onContextRestoredObservable.add(() => {
  console.log('WebGL context restored');
  // re-init scene
});
```

## Inspector (Debugging)

Babylon ships a debug inspector — press a key, see scene tree, modify any material, light, mesh live.

```js
import { Inspector } from '@babylonjs/inspector';

window.addEventListener('keydown', (e) => {
  if (e.key === '`' || e.key === '~') {
    if (Inspector.IsVisible) Inspector.Hide();
    else Inspector.Show(scene, { overlay: true });
  }
});
```

This is **immensely useful** for debugging. Wire it up in every game.

## Common Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Black screen | Camera inside mesh, or `maxZ` too small | Move camera back, increase `maxZ` |
| Mesh invisible | `setEnabled(false)` on template without instances, or `isVisible = false` | Check both |
| Colors look flat | No lights, or PBR material without environment texture | Add hemisphere + directional lights, OR set `scene.environmentTexture` |
| Z-fighting | Depth buffer precision | Increase `camera.minZ`, decrease `camera.maxZ`, OR use `engine.setHardwareScalingLevel` smaller |
| Shadows look pixelated | Shadow map too small | `new ShadowGenerator(2048, sun)` minimum |
| Camera controls not working | `attachControl` not called | `camera.attachControl(canvas, true)` |
| Picking returns wrong mesh | Predicate filtering out the mesh you wanted | Check predicate returns truthy for the target |
| Performance drops with many objects | Each mesh is a draw call | Use thin instances for repeated geometry |
| GUI not showing | AdvancedDynamicTexture not attached to scene | `AdvancedDynamicTexture.CreateFullscreenUI` |
| Audio not playing | AudioContext created before user gesture | Resume on first click |
| Bundled size huge | Imported `@babylonjs/core` full barrel | Use specific imports for production builds |

---

End of Babylon.js reference. For game-type-specific code, see `fps-game-template.md`, `voxel-game-template.md`, `third-person-template.md`, or `platformer-template.md`.
