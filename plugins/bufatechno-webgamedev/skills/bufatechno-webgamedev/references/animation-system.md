# Animation System — Professional Guide (Three.js + Babylon.js)

Covers project animation from basic mixer to skeletal/morph/blending/retargeting. Production patterns 2026.

## 1. Core Concepts (Three.js)

Three components: `AnimationClip` (keyframe container) → `AnimationMixer` (plays on root) → `AnimationAction` (play/stop/weight control).

### Timer vs Clock (r183+)
`THREE.Timer` is preferred over `THREE.Clock` since r183: pauses when tab hidden, connects via `timer.connect(document)`.

```js
import * as THREE from 'three';
const timer = new THREE.Timer();
timer.connect(document);
let mixer;

function animate(){
  requestAnimationFrame(animate);
  const delta = timer.getDelta(); // pause-aware
  mixer?.update(delta);
  renderer.render(scene, camera);
}
```
Fallback: `new THREE.Clock()` + `clock.getDelta()`. Always clamp `Math.min(delta,0.1)`.

### Clock/Mixer file structure
- `src/animation/Mixer.js` — owns mixers, updates with fixed or delta.
- `src/animation/Skeleton.js` — bone helpers.
- `src/animation/BlendTree.js` — weight logic.

## 2. GLTF Skeletal Animation (Load & Play)

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let mixer;
const loader = new GLTFLoader();
loader.load('assets/character.glb', (gltf)=>{
  const model = gltf.scene;
  scene.add(model);
  model.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; }});
  setupAnimations(gltf, model);
});

function setupAnimations(gltf, model){
  if(!gltf.animations.length) return;
  mixer = new THREE.AnimationMixer(model);
  // Play first clip
  const clip = gltf.animations[0];
  const action = mixer.clipAction(clip);
  action.play();
  // Or by name
  // const walk = THREE.AnimationClip.findByName(gltf.animations,'Walk');
  // mixer.clipAction(walk).play();
}
```

**Common glTF export notes (Blender):**
- Apply transforms, ensure skeleton root has no non-uniform scale.
- Export `Animations` checked, NLA strips or Actions.
- Use `gltf-transform` to compress: `gltf-transform draco input.glb output.glb` + `gltf-transform ktx2`.

## 3. Skeleton & Bone Manipulation

```js
// Find skinned mesh
let skinned;
model.traverse(o=>{ if(o.isSkinnedMesh) skinned=o; });
console.log(skinned.skeleton.bones.map(b=>b.name));

// SkeletonHelper debug
const helper = new THREE.SkeletonHelper(model);
scene.add(helper);

// Rotate head bone programmatically (e.g., look-at)
const head = skinned.skeleton.getBoneByName('mixamorig_Head');
function lookAt(target){
  head.lookAt(target); // or manual quaternion
}
// Combine with mixer: update bone after mixer.update() to override

// Attach weapon to hand bone
const hand = skinned.skeleton.getBoneByName('mixamorig_RightHand');
const weapon = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.4,0.05), new THREE.MeshStandardMaterial({color:0x888}));
hand.add(weapon);
weapon.position.set(0.05,0,0);
weapon.rotation.set(0,0,Math.PI/2);
```

## 4. Morph Targets (Facial / Blend Shapes)

```js
// Dictionary maps name → index
console.log(mesh.morphTargetDictionary); // { mouthOpen:0, eyeBlink:1 }
console.log(mesh.morphTargetInfluences); // [0,0]

// Set by name
function setMorph(name, value){
  const idx = mesh.morphTargetDictionary[name];
  if(idx!==undefined) mesh.morphTargetInfluences[idx]=THREE.MathUtils.clamp(value,0,1);
}

// Animate procedurally
let t=0;
function updateMorph(delta){
  t+=delta;
  setMorph('mouthOpen', (Math.sin(t*3)+1)/2 *0.8);
}

// Via NumberKeyframeTrack (in clip)
const track = new THREE.NumberKeyframeTrack(
  '.morphTargetInfluences[0]', [0,0.5,1], [0,1,0]
);
const clip = new THREE.AnimationClip('blink',1,[track]);
mixer.clipAction(clip).play();
```

Blender morph = Shape Keys. Export `Shape Keys` + `Apply Modifiers`.

## 5. Blending & Layering

### Weight blending (idle/walk/run by speed)
```js
const idle = mixer.clipAction(THREE.AnimationClip.findByName(anims,'Idle'));
const walk = mixer.clipAction(THREE.AnimationClip.findByName(anims,'Walk'));
const run  = mixer.clipAction(THREE.AnimationClip.findByName(anims,'Run'));
[idle,walk,run].forEach(a=>{a.play(); a.setEffectiveWeight(0);});

function updateLocomotion(speed){ // 0 idle, 1 walk, 2 run
  const wIdle = THREE.MathUtils.clamp(1 - speed*1.5,0,1);
  const wWalk = speed<1 ? speed : 2 - speed;
  const wRun  = THREE.MathUtils.clamp(speed-1,0,1);
  idle.setEffectiveWeight(wIdle);
  walk.setEffectiveWeight(wWalk);
  run .setEffectiveWeight(wRun);
}
```

### Additive blending (breath over base pose)
```js
import * as THREE from 'three';
const breath = THREE.AnimationClip.findByName(anims,'Breath');
THREE.AnimationUtils.makeClipAdditive(breath);
const breathAction = mixer.clipAction(breath);
breathAction.setEffectiveWeight(0.3).play();
// Additive clips add deltas, not replace
```

### Cross-fade
```js
function crossFade(from, to, sec=0.3){
  from.crossFadeTo(to, sec, false);
  to.play();
}
```

### Interpolation modes
- `LinearInterpolant` (default)
- `CubicInterpolant` via `Smooth` — for quaternion slerp friendly
- `DiscreteInterpolant` — step
- r183 `BezierInterpolant` — tangent-controlled bezier (check docs/threejs-complete.md for Bezier track creation).

## 6. Babylon.js Animation

Babylon uses `Animation` + `AnimationGroup` + skeleton. Retargeting tool 8/9 is no-code.

```js
import { SceneLoader, Animation } from '@babylonjs/core';
SceneLoader.ImportMesh('', 'assets/', 'character.glb', scene, (meshes,_,__,anims)=>{
  const group = scene.animationGroups[0]; // glTF groups auto-created
  group.play(true);
  // Weight blend
  const idle = scene.getAnimationGroupByName('Idle');
  const walk = scene.getAnimationGroupByName('Walk');
  idle.weight=1; walk.weight=0;
});

// Babylon retargeting (9.0) — map source skeleton → target
// Editor: Animation Retargeting Tool imports two .glb, maps bones via name heuristic, exports retargeted clip
// Code: BABYLON.AnimationGroup.MakeAdditive, BABYLON.AnimationGroup retarget via `retargetAnimation`
```

## 7. IK Basics (Three.js simple, Babylon full)

Three has no built-in IK — use `three/addons/animation/CCDIKSolver.js` or `fabrik` libs:

```js
import { CCDIKSolver } from 'three/addons/animation/CCDIKSolver.js';
// After model load with IK bone chain exported from Blender/BVH
const ikSolver = new CCDIKSolver(model, iks); // iks = [{target,bones:[...]}]
function render(){ ikSolver.update(); }
```

Babylon: `BoneIKController` + `BoneLookController`.

## 8. Best Practices

- **One mixer per character root** — not per mesh. Share mixer only if same skeleton.
- **Update mixer in fixed timestep OR delta consistently** — never mix 1/60 and delta for same mixer.
- **FrustumCulled false** for SkinnedMesh until bounding box validated, else culled when skeleton extends.
- **Dispose**: `mixer.uncacheClip(clip); mixer.uncacheRoot(root);` + `helper.dispose()`.
- **Performance**: bake 60fps; compress via `gltf-transform dedup prune draco`. Use `InstancedMesh` for crowds with baked vertex animation via texture (VAT) — see performance-optimization.md.
- **Retargeting**: keep bone name convention `mixamorig_Bone` identical across characters to reuse clips without tool.
