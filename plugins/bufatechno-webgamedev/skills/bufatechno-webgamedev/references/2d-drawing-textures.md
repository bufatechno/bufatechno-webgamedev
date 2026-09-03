# 2D Drawing & Procedural Textures Reference

Generate textures procedurally via Canvas 2D — no external image files. Keeps your game self-contained (one HTML file ships everything).

## Table of Contents

1. [Basic Noise Texture](#basic-noise-texture)
2. [Wood Texture](#wood-texture)
3. [Stone Texture](#stone-texture)
4. [Brick Texture](#brick-texture)
5. [Grass Texture](#grass-texture)
6. [Metal Texture](#metal-texture)
7. [Pixel-Art Sprite Sheet](#pixel-art-sprite-sheet)
8. [Normal Map from Height Map](#normal-map-from-height-map)
9. [Texture Atlas Builder](#texture-atlas-builder)
10. [CanvasTexture in Three.js](#canvastexture-in-threejs)
11. [DynamicTexture in Babylon.js](#dynamictexture-in-babylonjs)

---

## Basic Noise Texture

Foundation for most natural-looking textures. Add small random perturbations to a base color.

```js
function makeNoiseTexture(size = 256, baseColor = '#808080', variance = 30) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variance;
    img.data[i]     = clamp(img.data[i] + n, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
```

## Wood Texture

Concentric rings with noise — recognizable wood grain.

```js
function makeWoodTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const img = ctx.createImageData(size, size);
  const baseR = 140, baseG = 90, baseB = 50;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Distance from a "center" of the tree ring
      const dx = x - size * 0.7;
      const dy = y - size * 0.3;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Ring pattern with sine wave, perturbed by noise
      const noise = (Math.random() - 0.5) * 4;
      const ring = Math.sin((dist + noise) * 0.3) * 0.5 + 0.5;

      // Color: dark ring, light wood between rings
      const brightness = 0.7 + ring * 0.3;
      const grain = (Math.random() - 0.5) * 20;

      const i = (y * size + x) * 4;
      img.data[i]     = clamp(baseR * brightness + grain, 0, 255);
      img.data[i + 1] = clamp(baseG * brightness + grain, 0, 255);
      img.data[i + 2] = clamp(baseB * brightness + grain, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
```

## Stone Texture

Cracks + noise for rocky surfaces.

```js
function makeStoneTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base gray
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, size, size);

  // Voronoi-like cells via random points, find nearest point per pixel
  const points = [];
  const numPoints = 20;
  for (let i = 0; i < numPoints; i++) {
    points.push({ x: Math.random() * size, y: Math.random() * size });
  }

  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Find distance to two nearest points
      const dists = points.map(p => ({ d: Math.hypot(p.x - x, p.y - y), p }));
      dists.sort((a, b) => a.d - b.d);
      const d1 = dists[0].d;
      const d2 = dists[1].d;
      // Edge = where d1 ≈ d2 (Voronoi boundary)
      const edge = Math.abs(d1 - d2) < 1.5 ? 0 : 1;
      const noise = (Math.random() - 0.5) * 30;
      const v = 100 + (d1 / size * 60) + noise;
      const finalV = edge === 0 ? 30 : clamp(v, 50, 200);   // dark crack or gray stone

      const i = (y * size + x) * 4;
      img.data[i] = finalV;
      img.data[i + 1] = finalV;
      img.data[i + 2] = finalV;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
```

## Brick Texture

Tile-based brick layout with mortar lines.

```js
function makeBrickTexture(size = 256, brickColor = '#8a4a3a', mortarColor = '#3a3a3a') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, size, size);

  const brickW = 64;
  const brickH = 24;
  const mortar = 2;
  const rows = Math.ceil(size / brickH);

  ctx.fillStyle = brickColor;
  for (let row = 0; row < rows; row++) {
    const offsetX = (row % 2) * (brickW / 2);   // offset every other row
    for (let x = -brickW; x < size + brickW; x += brickW) {
      ctx.fillRect(x + offsetX + mortar, row * brickH + mortar, brickW - mortar * 2, brickH - mortar * 2);
    }
  }

  // Add noise for surface variation
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    img.data[i]     = clamp(img.data[i] + n, 0, 255);
    img.data[i + 1] = clamp(img.data[i + 1] + n, 0, 255);
    img.data[i + 2] = clamp(img.data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
```

## Grass Texture

Multiple shades of green with subtle noise — looks like a top-down grass field.

```js
function makeGrassTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base green
  ctx.fillStyle = '#3a6f2a';
  ctx.fillRect(0, 0, size, size);

  // Random grass blades
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 4;
    const angle = Math.random() * Math.PI;
    const shade = Math.random();
    ctx.strokeStyle = `rgba(${40 + shade * 40}, ${100 + shade * 60}, ${30 + shade * 40}, ${0.5 + Math.random() * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  return canvas;
}
```

## Metal Texture

Brushed metal — anisotropic streaks.

```js
function makeMetalTexture(size = 256, color = '#c0c0c0') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  // Horizontal streaks
  for (let y = 0; y < size; y++) {
    const brightness = 0.8 + Math.sin(y * 0.05) * 0.1 + (Math.random() - 0.5) * 0.05;
    ctx.fillStyle = `rgba(255, 255, 255, ${(brightness - 0.5) * 0.3})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Soft highlights
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 20 + Math.random() * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return canvas;
}
```

## Pixel-Art Sprite Sheet

For 2D-style pixel-art sprites in a 3D world (NPCs, pickups, items):

```js
function makePixelSprite(size = 16, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx, size);
  return canvas;
}

// Example: heart pickup
const heart = makePixelSprite(16, (ctx, s) => {
  // Heart pattern (1 = red, 0 = transparent)
  const pattern = [
    '0011100111 00'.replace(/\s/g, ''),
    '011111011111 0'.replace(/\s/g, ''),
    '1111111111111 '.trim(),
    '1111111111111 '.trim(),
    '011111111111 0'.replace(/\s/g, ''),
    '0011111111 00'.replace(/\s/g, ''),
    '000111111 000'.replace(/\s/g, ''),
    '0000111 0000'.replace(/\s/g, ''),
    '00000 00000'.replace(/\s/g, ''),
  ];
  // Actually let's use a simpler approach:
  ctx.fillStyle = '#f33';
  // 2 bumps + body
  ctx.fillRect(2, 4, 4, 4);
  ctx.fillRect(10, 4, 4, 4);
  ctx.fillRect(1, 6, 14, 5);
  ctx.fillRect(3, 11, 10, 3);
  ctx.fillRect(5, 13, 6, 2);
  ctx.fillRect(7, 14, 2, 1);

  ctx.fillStyle = '#faa';
  // Highlight
  ctx.fillRect(3, 5, 2, 2);
  ctx.fillRect(11, 5, 2, 2);
});
```

For multiple sprites in one atlas (one texture = one material = one draw call):

```js
function makeSpriteAtlas(spriteSize = 16, sprites = []) {
  const cols = Math.ceil(Math.sqrt(sprites.length));
  const rows = Math.ceil(sprites.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * spriteSize;
  canvas.height = rows * spriteSize;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  sprites.forEach((drawFn, i) => {
    const x = (i % cols) * spriteSize;
    const y = Math.floor(i / cols) * spriteSize;
    ctx.save();
    ctx.translate(x, y);
    drawFn(ctx, spriteSize);
    ctx.restore();
  });

  return { canvas, cols, rows, spriteSize };
}

// Usage
const atlas = makeSpriteAtlas(16, [
  // Sprite 0: heart
  (ctx, s) => {
    ctx.fillStyle = '#f33';
    ctx.fillRect(2, 4, 4, 4); ctx.fillRect(10, 4, 4, 4);
    ctx.fillRect(1, 6, 14, 5);
    ctx.fillRect(3, 11, 10, 3); ctx.fillRect(5, 13, 6, 2); ctx.fillRect(7, 14, 2, 1);
  },
  // Sprite 1: coin
  (ctx, s) => {
    ctx.fillStyle = '#fd0';
    ctx.beginPath(); ctx.arc(s/2, s/2, s/2 - 1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fa0';
    ctx.fillRect(s/2 - 1, 3, 2, s - 6);
  },
  // Sprite 2: sword
  (ctx, s) => {
    ctx.fillStyle = '#ccc';
    ctx.fillRect(s/2 - 1, 1, 2, 10);
    ctx.fillStyle = '#840';
    ctx.fillRect(s/2 - 3, 11, 6, 2);
    ctx.fillStyle = '#840';
    ctx.fillRect(s/2 - 1, 13, 2, 2);
  },
]);
```

## Normal Map from Height Map

Generate normal maps procedurally — for fake surface bumps without expensive geometry:

```js
function makeNormalMap(heightCanvas, strength = 2) {
  const size = heightCanvas.width;
  const ctx = heightCanvas.getContext('2d');
  const heightData = ctx.getImageData(0, 0, size, size).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = normalCanvas.height = size;
  const nctx = normalCanvas.getContext('2d');
  const normalData = nctx.createImageData(size, size);

  function height(x, y) {
    x = (x + size) % size;
    y = (y + size) % size;
    const i = (y * size + x) * 4;
    return heightData[i] / 255;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel filter for normals
      const hx = (height(x + 1, y) - height(x - 1, y)) * strength;
      const hy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const nx = -hx;
      const ny = -hy;
      const nz = 1;
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
      const i = (y * size + x) * 4;
      normalData.data[i]     = (nx / len * 0.5 + 0.5) * 255;
      normalData.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      normalData.data[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      normalData.data[i + 3] = 255;
    }
  }
  nctx.putImageData(normalData, 0, 0);
  return normalCanvas;
}

// Usage
const stoneHeight = makeStoneTexture(256);
const stoneNormal = makeNormalMap(stoneHeight, 3);

const stoneMat = new THREE.MeshStandardMaterial({
  map: new THREE.CanvasTexture(stoneHeight),
  normalMap: new THREE.CanvasTexture(stoneNormal),
  roughness: 0.85,
});
```

## Texture Atlas Builder

For sprite-heavy 3D games (e.g., particles, sprites, decals):

```js
class TextureAtlas {
  constructor(spriteSize = 64) {
    this.spriteSize = spriteSize;
    this.entries = [];   // {name, x, y, w, h}
    this.maxCols = 16;
  }

  add(name, canvas) {
    const i = this.entries.length;
    const x = (i % this.maxCols) * this.spriteSize;
    const y = Math.floor(i / this.maxCols) * this.spriteSize;
    this.entries.push({ name, x, y, source: canvas });
    return i;
  }

  build() {
    const cols = this.maxCols;
    const rows = Math.ceil(this.entries.length / cols);
    const canvas = document.createElement('canvas');
    canvas.width = cols * this.spriteSize;
    canvas.height = rows * this.spriteSize;
    const ctx = canvas.getContext('2d');

    for (const e of this.entries) {
      ctx.drawImage(e.source, e.x, e.y);
    }
    return { canvas, entries: this.entries, cols, rows };
  }

  getUV(name) {
    const e = this.entries.find(x => x.name === name);
    if (!e) return null;
    return {
      u: e.x / (this.maxCols * this.spriteSize),
      v: e.y / (Math.ceil(this.entries.length / this.maxCols) * this.spriteSize),
      w: this.spriteSize / (this.maxCols * this.spriteSize),
      h: this.spriteSize / (Math.ceil(this.entries.length / this.maxCols) * this.spriteSize),
    };
  }
}
```

## CanvasTexture in Three.js

```js
import * as THREE from 'three';

function canvasToTexture(canvas, repeat = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;   // for color maps
  tex.anisotropy = 4;                      // sharper at grazing angles
  return tex;
}

// Usage
const stoneTex = canvasToTexture(makeStoneTexture(256), 4);
const stoneMat = new THREE.MeshStandardMaterial({
  map: stoneTex,
  roughness: 0.85,
  metalness: 0.05,
});
```

For the normal map, **do NOT** set colorSpace — normal maps are linear data:

```js
const normalTex = new THREE.CanvasTexture(makeNormalMap(heightCanvas));
normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
// colorSpace stays as default (NoColorSpace / Linear) — DO NOT change
```

## DynamicTexture in Babylon.js

```js
const dynTex = new BABYLON.DynamicTexture('dynTex', { width: 256, height: 256 }, scene, false);
const ctx = dynTex.getContext();
// ... draw on ctx ...
dynTex.update();   // CRITICAL — uploads canvas to GPU

const mat = new BABYLON.PBRMaterial('mat', scene);
mat.albedoTexture = dynTex;
```

For normal maps in Babylon:

```js
const normalDyn = new BABYLON.DynamicTexture('normal', { width: 256, height: 256 }, scene, false);
// draw normal map...
normalDyn.update();
normalDyn._texture.invertY = false;   // optional
mat.bumpTexture = normalDyn;
```

---

## Combining Textures

For richer materials, combine multiple procedural textures:

```js
function makeRichStoneMaterial(size = 256) {
  const colorCanvas = makeStoneTexture(size, '#808080');
  const heightCanvas = makeStoneTexture(size, '#888');   // gray noise for height
  const normalCanvas = makeNormalMap(heightCanvas, 2.5);
  const roughnessCanvas = makeNoiseTexture(size, '#404040', 30);   // darker = rougher

  return new THREE.MeshStandardMaterial({
    map: canvasToTexture(colorCanvas, 4),
    normalMap: canvasToTexture(normalCanvas, 4),
    roughnessMap: canvasToTexture(roughnessCanvas, 4),
    metalness: 0.0,
  });
}
```

This single material has:
- Color variation (stone)
- Surface bumps (normal map)
- Varying roughness (some parts shiny, some matte)

All procedurally generated — no external files. The deliverable stays self-contained.

---

## Common Texture Pitfalls

| Bug | Cause | Fix |
|---|---|---|
| Texture looks blurry | Default minification filter is linear | Set `tex.magFilter = THREE.NearestFilter` for pixel art; `LinearMipmapLinearFilter` for smooth |
| Texture looks pixelated at distance | No mipmaps | `tex.minFilter = THREE.LinearMipmapLinearFilter` (default), `tex.generateMipmaps = true` |
| Texture seams (tiled) | Texture edge wraps incorrectly | Use seamless tileable noise function — duplicate edge pixels |
| Color texture looks washed out | Wrong color space | Set `colorSpace = SRGBColorSpace` for color, leave default for data maps (normal, roughness, AO) |
| Texture shows inverted | Canvas Y is top-down, WebGL Y is bottom-up | Set `tex.flipY = true` (default in Three.js, but if you manually uploaded, may need to flip) |
| Performance slow with many textures | Each texture is a draw call if material differs | Use one texture atlas for all sprites |
| Texture looks dark/wrong on PBR material | Missing roughness/metalness, or wrong values | Set `roughness: 0.5, metalness: 0.5` as starting point, then tune |
| Normal map looks inverted | Y-flip needed | In fragment shader: `n.y = -n.y` OR swap normal map's green channel |

---

End of 2D drawing & texture reference. For asset loading (GLTF, GLB, audio files), see `references/asset-pipeline.md`.
