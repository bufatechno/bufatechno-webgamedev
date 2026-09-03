# Asset Pipeline Reference

Loading external 3D models, textures, audio when procedural generation isn't enough. Covers GLTF/GLB, Draco compression, KTX2 textures, async loading screens, caching, and fallbacks.

## Table of Contents

1. [When to Use External Assets](#when-to-use-external-assets)
2. [GLTF/GLB Loading (Three.js)](#gltfglb-loading-threejs)
3. [GLTF/GLB Loading (Babylon.js)](#gltfglb-loading-babylonjs)
4. [Draco Mesh Compression](#draco-mesh-compression)
5. [KTX2 Texture Compression](#ktx2-texture-compression)
6. [Async Loading with Progress Bar](#async-loading-with-progress-bar)
7. [Asset Caching](#asset-caching)
8. [Fallback Primitives](#fallback-primitives)
9. [Audio File Loading](#audio-file-loading)
10. [Sprite Sheet Loading](#sprite-sheet-loading)
11. [Hot-Reloading Assets (Dev Only)](#hot-reloading-assets-dev-only)

---

## When to Use External Assets

Use procedural generation (see `procedural-generation.md` and `2d-drawing-textures.md`) when:
- You want a self-contained single-file deliverable
- The game has simple/abstract visuals (low-poly, blocky, geometric)
- You're prototyping

Use external assets when:
- The user supplied specific 3D models (characters, vehicles, environments)
- You need photo-realistic textures (skyboxes, character faces)
- You need pre-recorded music/voice
- The game has hand-authored animations (character rigs)

For one-shot deliverables, prefer procedural whenever possible — external files require either (a) bundling them in the deliverable (larger, more files), or (b) loading from a CDN (network dependency, won't work offline).

## GLTF/GLB Loading (Three.js)

GLB (binary GLTF) is the modern standard for 3D assets on the web. Single file containing mesh, materials, animations, skeletons, textures.

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

loader.load(
  './model.glb',
  (gltf) => {
    const model = gltf.scene;

    // Configure for game use
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        // Some models need material tweaks for game lighting
        if (node.material) {
          node.material.envMapIntensity = 1.0;
          if (node.material.map) node.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      }
    });

    // Scale if needed (GLTF is in meters by convention, but some models aren't)
    model.scale.setScalar(1);

    // Center on origin (if model was authored offset)
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;   // sit on ground

    scene.add(model);

    // Play first animation
    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
      gameMixers.push(mixer);   // store to update per frame
    }
  },
  (progress) => {
    console.log('Loading:', (progress.loaded / progress.total * 100).toFixed(1) + '%');
  },
  (error) => {
    console.error('GLTF load failed:', error);
  }
);
```

For loading multiple models with Promise-based API:

```js
function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}

async function loadAll() {
  const [player, enemy1, enemy2] = await Promise.all([
    loadModel('./player.glb'),
    loadModel('./enemy1.glb'),
    loadModel('./enemy2.glb'),
  ]);
  scene.add(player.scene, enemy1.scene, enemy2.scene);
}
```

## GLTF/GLB Loading (Babylon.js)

```js
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';

SceneLoader.ImportMeshAsync('', './', 'model.glb', scene).then((result) => {
  const model = result.meshes[0];
  model.scaling = new BABYLON.Vector3(1, 1, 1);

  result.meshes.forEach((m) => {
    m.receiveShadows = true;
    // Shadows only for opaque meshes (skip transparent leaves, etc.)
    if (m.material && !m.material.alpha) m.castShadows = true;
  });

  if (result.animationGroups.length > 0) {
    result.animationGroups[0].start(true);
  }
});
```

## Draco Mesh Compression

GLB files with Draco compression are 5-10x smaller. Required for any model with >100k triangles.

```js
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/draco/gltf/');
// or self-host: draco.setDecoderPath('./libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

// Now load any Draco-compressed GLB normally.
```

For Babylon.js:

```js
import '@babylonjs/loaders/draco';
// Then load normally with SceneLoader.
```

**Note**: Draco adds ~150 KB of decoder (loaded once from CDN). Worth it for any deliverable that ships real 3D models.

## KTX2 Texture Compression

KTX2 with Basis Universal gives GPU-native compressed textures — 4-10x smaller in VRAM, decoded on GPU (no upload decompression). The right format for any texture shipped in a model.

```js
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const ktx2 = new KTX2Loader();
ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.175.0/examples/jsm/libs/basis/');
// Detect capabilities
ktx2.detectSupport(renderer);

const loader = new GLTFLoader();
loader.setKTX2Loader(ktx2);

// GLB files that use KTX2 textures now load with GPU-compressed textures.
```

Without KTX2 setup, Three.js tries to use the original PNG/JPG textures in the GLB (works but slower and larger VRAM).

For Babylon.js, KTX2 support is built into the glTF loader — no setup needed beyond importing the loaders package.

## Async Loading with Progress Bar

For games with many assets, show a loading screen:

```js
class AssetManager {
  constructor() {
    this.items = [];
  }
  add(name, loader, url) {
    this.items.push({ name, loader, url });
    return this;
  }
  async loadAll(onProgress) {
    const results = {};
    let loaded = 0;
    for (const item of this.items) {
      results[item.name] = await new Promise((resolve, reject) => {
        item.loader.load(item.url, resolve, (e) => {
          loaded += e.loaded / (e.total || 1);
          onProgress?.(loaded / this.items.length, item.name);
        }, reject);
      });
    }
    return results;
  }
}

const loadingScreen = new LoadingScreen();   // see audio-ui-systems.md

const assets = new AssetManager()
  .add('player', gltfLoader, './assets/player.glb')
  .add('enemy', gltfLoader, './assets/enemy.glb')
  .add('terrain', textureLoader, './assets/terrain.jpg')
  .add('skybox', cubeTextureLoader, './assets/skybox/');

await assets.loadAll((progress, name) => {
  loadingScreen.setProgress(progress * 100, 'Loading ' + name);
});

loadingScreen.hide();
scene.add(assets.player.scene);
```

## Asset Caching

Don't reload the same model multiple times (e.g., 100 enemies sharing one model):

```js
class ModelCache {
  constructor() {
    this.cache = new Map();
    this.loader = new GLTFLoader();
  }
  async get(url) {
    if (this.cache.has(url)) {
      // Clone the cached scene (cheap)
      return this.cache.get(url).clone();
    }
    return new Promise((resolve, reject) => {
      this.loader.load(url, (gltf) => {
        this.cache.set(url, gltf.scene);
        resolve(gltf.scene.clone());
      }, undefined, reject);
    });
  }
}

const cache = new ModelCache();
const enemies = [];
for (let i = 0; i < 100; i++) {
  const model = await cache.get('./enemy.glb');
  model.position.set(Math.random() * 50, 0, Math.random() * 50);
  scene.add(model);
  enemies.push(model);
}
```

`.clone()` creates a new Object3D hierarchy but shares geometry/material/texture GPU buffers. Memory-cheap, render-fast (geometry draw call is per-mesh, but GPU buffer is shared).

For animation, each clone needs its own AnimationMixer:

```js
const mixer = new THREE.AnimationMixer(model);
const clip = gltf.animations[0];
mixer.clipAction(clip).play();
mixers.push(mixer);
```

## Fallback Primitives

If the model fails to load (network error, wrong format), don't let the game break. Substitute a placeholder.

```js
function loadModelWithFallback(url, fallback = 'box') {
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (error) => {
        console.warn('Model load failed, using fallback:', url, error);
        if (fallback === 'box') {
          resolve(new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshStandardMaterial({ color: 0xff00ff })   // magenta = "missing model"
          ));
        } else if (fallback === 'capsule') {
          resolve(new THREE.Mesh(
            new THREE.CapsuleGeometry(0.5, 1, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0xff00ff })
          ));
        }
      }
    );
  });
}

// Usage
const playerModel = await loadModelWithFallback('./player.glb', 'capsule');
```

Magenta is the universal "missing asset" color — game devs recognize it instantly. Use it for all fallbacks so missing assets are visually obvious.

## Audio File Loading

For longer audio (music, voice), use file-based loading instead of procedural:

```js
class AudioLoader {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.cache = new Map();
  }

  async load(url) {
    if (this.cache.has(url)) return this.cache.get(url);

    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(buffer);
    this.cache.set(url, audioBuffer);
    return audioBuffer;
  }

  play(buffer, options = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = options.loop || false;
    src.playbackRate.value = options.rate || 1;

    const gain = this.ctx.createGain();
    gain.gain.value = options.volume ?? 1;

    src.connect(gain).connect(this.ctx.destination);
    src.start(0, options.offset || 0);

    return { src, gain };
  }
}

// Usage
const music = await audioLoader.load('./music.mp3');
audioLoader.play(music, { loop: true, volume: 0.4 });
```

For sound effects, prefer procedural (see `audio-ui-systems.md`) — instant start, no decode overhead, smaller deliverable.

## Sprite Sheet Loading

For 2D-style sprites loaded from a PNG:

```js
async function loadSpriteSheet(url, frameWidth, frameHeight) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve({ texture: tex, frameWidth, frameHeight });
    }, undefined, reject);
  });
}

function frameUV(sheet, frameIndex) {
  const cols = sheet.texture.image.width / sheet.frameWidth;
  const x = (frameIndex % cols) / cols;
  const y = Math.floor(frameIndex / cols) / (sheet.texture.image.height / sheet.frameHeight);
  return { x, y, w: 1 / cols, h: sheet.frameHeight / sheet.texture.image.height };
}

// Sprite that animates through frames
class AnimatedSprite {
  constructor(sheet, frames, fps = 12) {
    this.sheet = sheet;
    this.frames = frames;   // [0, 1, 2, 1] for a 4-frame walk cycle
    this.fps = fps;
    this.frameTime = 0;
    this.currentFrame = 0;
    this.mat = new THREE.SpriteMaterial({ map: sheet.texture });
    this.sprite = new THREE.Sprite(this.mat);
  }
  update(dt) {
    this.frameTime += dt;
    if (this.frameTime > 1 / this.fps) {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.frameTime = 0;
      const uv = frameUV(this.sheet, this.frames[this.currentFrame]);
      this.mat.map.offset.set(uv.x, uv.y);
      this.mat.map.repeat.set(uv.w, uv.h);
      this.mat.map.needsUpdate = true;
    }
  }
}
```

## Hot-Reloading Assets (Dev Only)

For development: reload assets at runtime without restarting the game:

```js
function setupHotReload() {
  const watcher = new EventSource('/dev/reload');
  watcher.onmessage = (e) => {
    const { path } = JSON.parse(e.data);
    // Reload just that asset
    if (path.endsWith('.glb')) {
      // Find the model with this URL, dispose it, load fresh
      // ... implementation depends on your asset system
    }
  };
}
```

Or just listen for window focus and reload everything (quick & dirty):

```js
window.addEventListener('focus', () => {
  if (DEBUG) {
    // Reload all textures
    scene.traverse((obj) => {
      if (obj.material?.map) obj.material.map.needsUpdate = true;
    });
  }
});
```

---

## Asset Pipeline Best Practices

1. **Compress everything**: GLB with Draco, textures with KTX2. 10x smaller downloads.
2. **Cache aggressively**: never reload the same asset twice.
3. **Show progress**: a black screen for 10 seconds feels broken; a progress bar feels professional.
4. **Have fallbacks**: network fails, file paths are wrong, formats mismatch. Always degrade gracefully.
5. **Don't block the main thread**: GLB parsing can take 100ms+ for large models. Show a loading screen.
6. **Prefer procedural for one-shot deliverables**: keeps the HTML file self-contained.

---

End of asset pipeline reference. For testing and deployment, see `references/testing-deployment.md`.
