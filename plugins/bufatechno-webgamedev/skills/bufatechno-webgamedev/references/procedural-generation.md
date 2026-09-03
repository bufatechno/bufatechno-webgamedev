# Procedural Generation Reference

Generate game content from code: terrain, levels, textures, names, layouts. Keeps the deliverable self-contained (no external asset files needed) and infinitely replayable.

## Table of Contents

1. [Noise Functions](#noise-functions)
2. [Terrain Generation](#terrain-generation)
3. [Maze Generation](#maze-generation)
4. [L-Systems for Vegetation](#l-systems-for-vegetation)
5. [Dungeon Layout](#dungeon-layout)
6. [City / Building Generation](#city--building-generation)
7. [Procedural Names & Lore](#procedural-names--lore)
8. [Seeded RNG (Determinism)](#seeded-rng-determinism)
9. [Biome Blending](#biome-blending)
10. [Caves with 3D Noise](#caves-with-3d-noise)

---

## Noise Functions

The foundation of all procedural generation. A noise function gives you a smooth, continuous random field — turning integer coordinates into a value in [-1, 1] with no hard transitions.

### Simplex Noise (Recommended)

```js
// Lightweight 2D/3D simplex noise (Stefan Gustavson's algorithm).
// ~30 lines, no dependencies, runs in microseconds.

export class Noise {
  constructor(seed = 1337) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    const rng = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) / 4294967296); };
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  _grad2(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
  }

  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t, Y0 = j - t;
    const x0 = x - X0, y0 = y - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] & 7;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] & 7;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] & 7;
    let n0 = 0.5 - x0*x0 - y0*y0; n0 = n0 < 0 ? 0 : n0 * n0 * n0 * this._grad2(gi0, x0, y0);
    let n1 = 0.5 - x1*x1 - y1*y1; n1 = n1 < 0 ? 0 : n1 * n1 * n1 * this._grad2(gi1, x1, y1);
    let n2 = 0.5 - x2*x2 - y2*y2; n2 = n2 < 0 ? 0 : n2 * n2 * n2 * this._grad2(gi2, x2, y2);
    return (n0 + n1 + n2) * 70;
  }

  // Fractal Brownian motion — stack octaves for richer detail
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;   // [-1, 1]
  }

  // Ridged noise — sharper ridges, good for mountains
  ridged(x, y, octaves = 4) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2D(x * freq, y * freq));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;   // [0, 1]
  }
}
```

Use simplex over Perlin because:
- Perlin has visible axis-aligned artifacts at integer boundaries
- Simplex scales better to higher dimensions (3D, 4D)
- Simplex is faster (no permutation gradients per lookup)

For production, `simplex-noise` npm package is battle-tested. The above is the inline equivalent for self-contained deliverables.

## Terrain Generation

```js
function generateTerrain(scene, size, segments, noise) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const positions = geo.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);

    // Layer multiple noise fields for varied terrain
    const baseElevation = noise.fbm(x * 0.005, z * 0.005, 4) * 30;   // big hills
    const mountains = noise.ridged(x * 0.01, z * 0.01, 5) * 60;       // sharp peaks
    const detail = noise.fbm(x * 0.05, z * 0.05, 3) * 2;              // small bumps

    const h = baseElevation + mountains * (baseElevation > 10 ? 1 : 0) + detail;
    positions.setY(i, h);
  }

  positions.needsUpdate = true;
  geo.computeVertexNormals();   // CRITICAL — without this, lighting is wrong

  // Vertex colors based on height
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const c = new THREE.Color();
    if (y < 0) c.setHex(0x205090);          // underwater
    else if (y < 5) c.setHex(0xc8a878);      // beach
    else if (y < 20) c.setHex(0x4a8f3a);     // grass
    else if (y < 40) c.setHex(0x6b5a3a);    // dirt
    else if (y < 60) c.setHex(0x808080);    // rock
    else c.setHex(0xffffff);                // snow
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
```

For chunked terrain (infinite world), generate each chunk separately with noise offset = `chunkX * chunkSize`. The noise field is continuous across chunk boundaries because noise is a function of world coordinates, not local chunk coordinates.

## Maze Generation

Recursive backtracker — perfect maze (one path between any two cells).

```js
function generateMaze(cols, rows, rng = Math.random) {
  // Each cell has 4 walls: top, right, bottom, left
  const cells = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({ x, y, visited: false, walls: [true, true, true, true] });
    }
  }
  const idx = (x, y) => y * cols + x;
  const inBounds = (x, y) => x >= 0 && x < cols && y >= 0 && y < rows;

  const stack = [];
  let current = cells[0];
  current.visited = true;
  stack.push(current);

  while (stack.length > 0) {
    current = stack[stack.length - 1];
    const { x, y } = current;
    const neighbors = [];
    if (inBounds(x, y - 1) && !cells[idx(x, y - 1)].visited) neighbors.push({ dir: 0, cell: cells[idx(x, y - 1)] });
    if (inBounds(x + 1, y) && !cells[idx(x + 1, y)].visited) neighbors.push({ dir: 1, cell: cells[idx(x + 1, y)] });
    if (inBounds(x, y + 1) && !cells[idx(x, y + 1)].visited) neighbors.push({ dir: 2, cell: cells[idx(x, y + 1)] });
    if (inBounds(x - 1, y) && !cells[idx(x - 1, y)].visited) neighbors.push({ dir: 3, cell: cells[idx(x - 1, y)] });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }
    const { dir, cell } = neighbors[Math.floor(rng() * neighbors.length)];
    current.walls[dir] = false;                  // remove my wall
    cell.walls[(dir + 2) % 4] = false;           // remove neighbor's opposite wall
    cell.visited = true;
    stack.push(cell);
  }
  return cells;
}

// Convert maze to walls for 3D rendering
function mazeToWalls(cells, cols, rows, cellSize = 2, wallHeight = 3) {
  const walls = [];
  for (const cell of cells) {
    const cx = cell.x * cellSize;
    const cz = cell.y * cellSize;
    if (cell.walls[0]) walls.push({ x: cx, z: cz, w: cellSize, d: 0.2 });                   // top wall
    if (cell.walls[1]) walls.push({ x: cx + cellSize, z: cz, w: 0.2, d: cellSize });         // right wall
    if (cell.walls[2]) walls.push({ x: cx, z: cz + cellSize, w: cellSize, d: 0.2 });        // bottom wall
    if (cell.walls[3]) walls.push({ x: cx, z: cz, w: 0.2, d: cellSize });                   // left wall
  }
  return walls.map(w => ({
    pos: [w.x + w.w/2, wallHeight/2, w.z + w.d/2],
    size: [w.w, wallHeight, w.d],
  }));
}
```

## L-Systems for Vegetation

L-systems (Lindenmayer systems) generate fractal plant structures from simple rules. Perfect for procedural trees, ferns, grass.

```js
// Simple L-system: a string rewriting system.
// "F" = draw forward, "+" = turn right, "-" = turn left, "[" = push, "]" = pop.

class LSystem {
  constructor(axiom, rules, iterations) {
    let s = axiom;
    for (let i = 0; i < iterations; i++) {
      s = s.split('').map(c => rules[c] || c).join('');
    }
    this.string = s;
  }

  // 3D turtle graphics. Returns array of branches [{start, end, thickness}]
  interpret(angle = 22.5, length = 1) {
    const branches = [];
    const stack = [];
    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3(1, 0, 0);
    let thickness = 0.3;

    for (const c of this.string) {
      switch (c) {
        case 'F': {
          const end = pos.clone().addScaledVector(dir, length);
          branches.push({ start: pos.clone(), end, thickness });
          pos = end;
          thickness *= 0.92;
          break;
        }
        case '+': dir.applyAxisAngle(right, -angle); break;
        case '-': dir.applyAxisAngle(right, angle); break;
        case '&': dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle); break;
        case '^': dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle); break;
        case '[':
          stack.push({ pos: pos.clone(), dir: dir.clone(), right: right.clone(), thickness });
          break;
        case ']': {
          const state = stack.pop();
          pos = state.pos; dir = state.dir; right = state.right; thickness = state.thickness;
          break;
        }
      }
    }
    return branches;
  }
}

// Tree rules — experiment with these to get different tree shapes
const treeRules = {
  'F': 'FF+[+F-F-F]-[-F+F+F]',   // dense bushy tree
};
const tree = new LSystem('F', treeRules, 4);
const branches = tree.interpret(22.5, 0.5);

// Convert to Three.js cylinders
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 });
for (const branch of branches) {
  const len = branch.start.distanceTo(branch.end);
  const geo = new THREE.CylinderGeometry(branch.thickness * 0.7, branch.thickness, len, 6);
  const mesh = new THREE.Mesh(geo, trunkMat);
  mesh.position.copy(branch.start).lerp(branch.end, 0.5);
  mesh.lookAt(branch.end);
  mesh.rotateX(Math.PI / 2);   // cylinder is Y-axis by default, we need Z-axis
  mesh.castShadow = true;
  scene.add(mesh);
}
```

## Dungeon Layout

BSP (Binary Space Partitioning) for room-and-corridor dungeons:

```js
function generateDungeon(width, height, minRoomSize = 5, maxRoomSize = 12, rng = Math.random) {
  // Start with one big rectangle
  const root = { x: 0, y: 0, w: width, h: height };
  const rooms = [];

  function split(rect, depth) {
    if (depth <= 0 || (rect.w < maxRoomSize * 2 && rect.h < maxRoomSize * 2)) {
      // Make a room inside this rect, smaller than the rect
      const rw = Math.max(minRoomSize, Math.min(rect.w - 2, minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize))));
      const rh = Math.max(minRoomSize, Math.min(rect.h - 2, minRoomSize + Math.floor(rng() * (maxRoomSize - minRoomSize))));
      const rx = rect.x + Math.floor(rng() * (rect.w - rw));
      const ry = rect.y + Math.floor(rng() * (rect.h - rh));
      rooms.push({ x: rx, y: ry, w: rw, h: rh });
      return;
    }
    // Split horizontally or vertically
    const splitHorizontal = rect.w > rect.h ? false : rect.h > rect.w ? true : rng() < 0.5;
    if (splitHorizontal) {
      const splitY = Math.floor(rect.h / 2 + (rng() - 0.5) * rect.h * 0.3);
      split({ x: rect.x, y: rect.y, w: rect.w, h: splitY }, depth - 1);
      split({ x: rect.x, y: rect.y + splitY, w: rect.w, h: rect.h - splitY }, depth - 1);
    } else {
      const splitX = Math.floor(rect.w / 2 + (rng() - 0.5) * rect.w * 0.3);
      split({ x: rect.x, y: rect.y, w: splitX, h: rect.h }, depth - 1);
      split({ x: rect.x + splitX, y: rect.y, w: rect.w - splitX, h: rect.h }, depth - 1);
    }
  }

  split(root, 4);

  // Connect adjacent rooms with corridors (center-to-center)
  const corridors = [];
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    if (rng() < 0.5) {
      corridors.push({ x1: ax, y1: ay, x2: ax, y2: by });  // vertical then horizontal
      corridors.push({ x1: ax, y1: by, x2: bx, y2: by });
    } else {
      corridors.push({ x1: ax, y1: ay, x2: bx, y2: ay });
      corridors.push({ x1: bx, y1: ay, x2: bx, y2: by });
    }
  }

  return { rooms, corridors };
}
```

## City / Building Generation

Grid-based city with varied building heights:

```js
function generateCity(size, blockSize, roadWidth, noise) {
  const city = { blocks: [], roads: [] };
  const numBlocks = Math.floor(size / blockSize);

  for (let bx = 0; bx < numBlocks; bx++) {
    for (let bz = 0; bz < numBlocks; bz++) {
      const cx = bx * blockSize + roadWidth;
      const cz = bz * blockSize + roadWidth;
      const cw = blockSize - roadWidth * 2;

      // Building height based on city-center distance + noise
      const distToCenter = Math.hypot(bx - numBlocks/2, bz - numBlocks/2) / (numBlocks/2);
      const height = Math.max(
        5,
        50 * (1 - distToCenter) + noise.fbm(bx * 0.3, bz * 0.3, 3) * 20
      );

      city.blocks.push({ x: cx, z: cz, w: cw, h: cw, height });
    }
  }
  return city;
}

// Convert to 3D
const buildings = generateCity(200, 20, 4, noise).blocks;
const mat = new THREE.MeshStandardMaterial({ color: 0x9090a0, roughness: 0.7 });
const geo = new THREE.BoxGeometry(1, 1, 1);
const instanced = new THREE.InstancedMesh(geo, mat, buildings.length);
const dummy = new THREE.Object3D();
buildings.forEach((b, i) => {
  dummy.position.set(b.x + b.w/2, b.height/2, b.z + b.h/2);
  dummy.scale.set(b.w, b.height, b.h);
  dummy.updateMatrix();
  instanced.setMatrixAt(i, dummy.matrix);
});
instanced.castShadow = true;
instanced.receiveShadow = true;
scene.add(instanced);
```

## Procedural Names & Lore

For RPGs with procedurally generated NPCs/items:

```js
const syllables = {
  prefix: ['Ar', 'Bel', 'Cor', 'Dra', 'El', 'Fae', 'Gor', 'Hel', 'Ith', 'Jor', 'Kae', 'Lir'],
  middle: ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ia', 'ie'],
  suffix: ['dor', 'wen', 'mir', 'las', 'rik', 'thas', 'wyn', 'dor', 'ion', 'eth'],
};

function makeName(rng = Math.random) {
  const p = syllables.prefix[Math.floor(rng() * syllables.prefix.length)];
  const m = syllables.middle[Math.floor(rng() * syllables.middle.length)];
  const s = syllables.suffix[Math.floor(rng() * syllables.suffix.length)];
  return p + m + s;
}

// Weapon adjectives
const weaponAdj = ['Ancient', 'Bloody', 'Cursed', 'Divine', 'Eternal', 'Fallen', 'Glowing', 'Hidden'];
const weaponNoun = ['Blade', 'Axe', 'Bow', 'Staff', 'Hammer', 'Spear', 'Dagger', 'Mace'];
const weaponSuffix = ['of the North', 'of Doom', 'of Light', 'of Shadows', 'of Eternity', 'of the Stars'];

function makeWeaponName(rng = Math.random) {
  return `${weaponAdj[Math.floor(rng() * weaponAdj.length)]} ${weaponNoun[Math.floor(rng() * weaponNoun.length)]} ${weaponSuffix[Math.floor(rng() * weaponSuffix.length)]}`;
}
```

## Seeded RNG (Determinism)

For multiplayer, replays, "shareable seeds" (No Man's Sky style), use a seeded PRNG so the same seed produces the same world.

```js
// Mulberry32 — fast, simple, good enough quality for games
export function makeRng(seed) {
  let a = seed | 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Usage
const rng = makeRng(12345);
console.log(rng(), rng(), rng());   // deterministic across runs
```

For cryptographic quality (not needed for games but available): `crypto.getRandomValues(new Uint32Array(1))`. ~100x slower than mulberry32 but unbiased.

**Critical**: when using seeded RNG with multiple subsystems, give each subsystem its own derived seed to avoid interference:

```js
const baseRng = makeRng(12345);
const terrainRng = makeRng(Math.floor(baseRng() * 1e9));
const treeRng = makeRng(Math.floor(baseRng() * 1e9));
const npcRng = makeRng(Math.floor(baseRng() * 1e9));
```

If you share one RNG across subsystems, adding a feature in one subsystem silently changes the output of every other subsystem.

## Biome Blending

Generate different biomes (forest, desert, tundra) based on temperature/moisture noise:

```js
function biomeAt(x, z, noise) {
  const temp = noise.fbm(x * 0.003, z * 0.003, 3);   // [-1, 1]
  const moist = noise.fbm(x * 0.003 + 1000, z * 0.003 + 1000, 3);

  // Whittaker diagram
  if (temp > 0.3 && moist > 0.3) return 'jungle';
  if (temp > 0.3 && moist < -0.3) return 'desert';
  if (temp < -0.3 && moist > 0.3) return 'tundra';
  if (temp < -0.3 && moist < -0.3) return 'taiga';
  return 'temperate';
}

// Blend biome colors smoothly — instead of hard switch, mix based on distance to biome center
function biomeColor(x, z, noise) {
  const temp = noise.fbm(x * 0.003, z * 0.003, 3);
  const moist = noise.fbm(x * 0.003 + 1000, z * 0.003 + 1000, 3);
  const c = new THREE.Color();
  // Each axis blends between two biome colors
  const warmColor = new THREE.Color(moist > 0 ? 0x2d6f2d : 0xc8a858);  // jungle or desert
  const coldColor = new THREE.Color(moist > 0 ? 0xeeeeff : 0x205090);  // tundra or ice
  c.lerpColors(coldColor, warmColor, (temp + 1) / 2);
  return c;
}
```

## Caves with 3D Noise

For voxel caves, use 3D noise threshold:

```js
function isCave(x, y, z, noise) {
  // 3D noise — combine two 2D noises for cheap approximation
  const n1 = noise.fbm(x * 0.05, y * 0.05, 3);
  const n2 = noise.fbm(z * 0.05 + 500, (x + y) * 0.05 + 500, 3);
  const val = (n1 + n2) / 2;
  // Carve cave where noise is near 0 (tunnels through the rock)
  return Math.abs(val) < 0.05 && y < 20;
}
```

For real 3D noise, extend the Noise class with a `noise3D` method using the standard 3D simplex algorithm. The above 2D trick is a cheap approximation that works well for most cave systems.

---

End of procedural generation reference. For procedural textures (canvas-based), see `references/2d-drawing-textures.md`. For asset loading (GLTF/GLB), see `references/asset-pipeline.md`.
