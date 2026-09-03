# VFX & Particles — Professional Guide

Covers particles, post-processing, volumetric, trails, screen effects. Three.js + Babylon.js (2026).

## 1. Particle Systems Architecture

### Pool pattern mandatory
```js
// Pool for particles — see game-architecture.md
import { Pool } from '../utils/Pool.js';
const sparkPool = new Pool(()=> createSparkMesh(), 100);
function emitSpark(pos, vel){
  const s = sparkPool.acquire();
  s.position.copy(pos); s.velocity.copy(vel); s.life=0.6;
  scene.add(s);
}
function updateSparks(delta){
  sparks.forEach(s=>{
    s.life-=delta; s.position.addScaledVector(s.velocity,delta);
    s.material.opacity = THREE.MathUtils.clamp(s.life*2,0,1);
    if(s.life<=0){ scene.remove(s); sparkPool.release(s); }
  });
}
```

### Three.js: Points vs InstancedMesh
- **Points** — for soft smoke, fire sprites. Use `PointsMaterial` + `sizeAttenuation`.
- **InstancedMesh** — for debris, leaves, bullets with mesh.

```js
// Points fire
const pGeo = new THREE.BufferGeometry();
const pos = new Float32Array(N*3), vel=new Float32Array(N*3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
const pMat = new THREE.PointsMaterial({size:0.2, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, map: flameTex});
const points = new THREE.Points(pGeo,pMat);
scene.add(points);
// Update in JS or TSL compute shader (WebGPU)
// For TSL compute, see threejs-complete.md RenderPipeline

// Instanced debris
const inst = new THREE.InstancedMesh(boxGeo, debrisMat, 200);
inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
let dummy=new THREE.Object3D();
function setInstance(i, pos, rot, scale){
  dummy.position.copy(pos); dummy.rotation.copy(rot); dummy.scale.setScalar(scale);
  dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
}
inst.instanceMatrix.needsUpdate=true; inst.computeBoundingSphere();
```

### Babylon 8/9: Node Particle Editor (NPE) + ThinInstances
```js
// NPE — visual graph exported as JSON, loaded via ParticleHelper
import { ParticleHelper } from '@babylonjs/core';
ParticleHelper.CreateAsync('fire', scene).then(set=>{
  set.start(emitter); // emitter = mesh
  set.systems.forEach(s=>{ s.minLifeTime=0.5; s.maxLifeTime=1.2; });
});

// ThinInstances for bulk (10k)
thinInstanceSetBuffer("matrix", matrixData, 16, false);
thinInstanceSetBuffer("color", colorData, 4, false);
```

## 2. Post-Processing

### Three.js EffectComposer + RenderPipeline (TSL)
```js
// Classic WebGL
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(w,h), 1.0, 0.4, 0.85));
composer.addPass(new OutputPass());
// In frame: composer.render();

// WebGPU + TSL RenderPipeline (r175+)
import * as THREE from 'three/webgpu';
import { pass, bloom } from 'three/tsl';
const renderPipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene,camera);
const bloomPass = bloom(scenePass, 0.8, 0.4, 0.85);
renderPipeline.outputNode = bloomPass;
function animate(){ renderPipeline.render(); }
```

### Babylon Frame Graph (8.0 alpha → 9.0 v1, 40% GPU mem save)
```js
// FrameGraph DAG — replaces EffectComposer chain
import { FrameGraph } from '@babylonjs/core';
const fg = new FrameGraph(scene);
const sceneTask = fg.addScenePass("scene", scene, camera);
const bloomTask = fg.addBloomTask("bloom", sceneTask.output, {strength:0.8});
fg.outputTexture = bloomTask.output;
fg.build(); // auto-managed allocation
// On resize: fg.resize()
```

## 3. Volumetric & Atmosphere

### Volumetric light shafts (Babylon 9 volumetric lighting)
```js
// Babylon 9 — uses compute shaders on WebGPU, fallback WebGL2
import { VolumetricLight } from '@babylonjs/core';
const vol = new VolumetricLight("vol", scene, sunLight);
vol.extinction=0.4; vol.phase=0.6;
// Three fallback: FogExp2 + shader plane
scene.fog = new THREE.FogExp2(0xbfd9ff, 0.015);
```

### Three volumetric plane shader
```js
const volMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ time:{value:0}, lightPos:{value: sunPos}},
  vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float time; varying vec2 vUv;
    void main(){ float d=length(vUv-0.5); float f=exp(-d*4.)*0.5*(0.5+0.5*sin(time*2.)); gl_FragColor=vec4(1.,0.9,0.5,f); }`
});
```

## 4. Screen Effects

### Screen shake
```js
let shake=0;
function addShake(intensity){ shake=Math.max(shake,intensity); }
function updateShake(delta){
  if(shake>0){
    camera.position.x += (Math.random()-0.5)*shake*0.2;
    camera.position.y += (Math.random()-0.5)*shake*0.2;
    shake = Math.max(0, shake - delta*3); // exp decay
    // or: shake *= Math.exp(-6*delta);
  }
}
// Trigger on hit: addShake(1.2)
```

### Damage vignette
```js
const vignette = document.createElement('div');
Object.assign(vignette.style,{position:'fixed',inset:'0',pointerEvents:'none',background:'radial-gradient(ellipse at center, transparent 60%, rgba(255,0,0,.7) 100%)',opacity:'0',transition:'opacity .12s'});
document.body.appendChild(vignette);
function flashDamage(){ vignette.style.opacity='1'; setTimeout(()=> vignette.style.opacity='0',120); }
```

### Hit flash / muzzle flash (mesh flash)
```js
function muzzleFlash(pos){
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshBasicMaterial({color:0xffffaa, transparent:true}));
  flash.position.copy(pos); scene.add(flash);
  let life=0.08;
  function tick(dt){ life-=dt; flash.material.opacity=life/0.08; if(life<=0){scene.remove(flash); flash.geometry.dispose(); flash.material.dispose();} else requestAnimationFrame(()=>tick(0.016));}
  tick(0.016);
}
```

## 5. Trails & Decals

```js
// Trail via BufferGeometry ring
const trailLen=20;
const trailPos=new Float32Array(trailLen*3);
const tGeo=new THREE.BufferGeometry(); tGeo.setAttribute('position', new THREE.BufferAttribute(trailPos,3));
const tMat=new THREE.LineBasicMaterial({color:0xffaa00, transparent:true, opacity:0.8});
const trail=new THREE.Line(tGeo,tMat); scene.add(trail);
const trailQueue=[];
function pushTrail(pos){
  trailQueue.push(pos.clone()); if(trailQueue.length>trailLen) trailQueue.shift();
  trailQueue.forEach((p,i)=>{ trailPos[i*3]=p.x; trailPos[i*3+1]=p.y; trailPos[i*3+2]=p.z; });
  tGeo.attributes.position.needsUpdate=true;
}

// Decal (Three)
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
const decalMat=new THREE.MeshStandardMaterial({color:0x331111, polygonOffset:true, polygonOffsetFactor:-1});
function spawnBulletHole(hitPos, hitNormal, targetMesh){
  const decalGeo=new DecalGeometry(targetMesh, hitPos, hitNormal, new THREE.Vector3(0.2,0.2,0.2));
  const decal=new THREE.Mesh(decalGeo,decalMat); scene.add(decal);
  setTimeout(()=>{scene.remove(decal); decalGeo.dispose();},5000);
}
```

## 6. Gaussian Splatting VFX (Babylon 8/9, Three 0.175 via `three/addons`)

```js
// Babylon 9 — import .splat/.ply/.spz/.sog, cast shadows, animate parts
import { GaussianSplattingMesh } from '@babylonjs/core';
const splat = new GaussianSplattingMesh("splat", null, scene);
await splat.loadFileAsync("assets/scene.splat");
splat.position.y=1; splat.rotation.y=Math.PI;
splat.material.shadowDepthScale=0.5; // shadow casting (alpha shadow)
// Streaming + LOD for 11M splats: use PlayCanvas splat-transform -> SOGS + scene streaming API
```
Three: `import { GaussianSplatting } from 'three/addons/objects/GaussianSplatting.js'` — similar load.

## 7. Performance & Best Practices

- **Pooled, not new**: never `new Mesh` per particle; use Pool + `visible=false` + `scale 0` frustum trick.
- **Additive blending** + `depthWrite:false` for fire/smoke/sparks to avoid Z-sort issues.
- **Texture atlas** for particle sprites — one material for all sparks.
- **Compute shaders** (WebGPU TSL) for 10k+ particles — avoid JS loop bottleneck.
- **Dispose** burst meshes after 0.3s; keep reusable pool alive.
- **Budget**: post-processing <2ms/frame; bloom radius 0.4 balanced; disable on mobile if FPS <45.
