# WebXR / VR — Web Games

Adds VR headset + AR passthrough to Three/Babylon. Optional — implement only if user asks.

## 1. Enable WebXR

### Three.js (WebGL or WebGPU renderer — both support XR)
```js
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.xr.enabled=true;
document.body.appendChild(renderer.domElement);
document.getElementById('enterVR').onclick = ()=>{
  navigator.xr?.isSessionSupported('immersive-vr').then(ok=>{ if(ok) renderer.xr.getSession() ?? renderer.xr.setSession; });
};
// Button helper
import { VRButton } from 'three/addons/webxr/VRButton.js';
document.body.appendChild(VRButton.createButton(renderer));

// Render loop uses renderer.setAnimationLoop
renderer.setAnimationLoop((time, frame)=>{
  const delta = clock.getDelta();
  update(delta);
  renderer.render(scene, camera);
});
```

Camera rig: `renderer.xr.getCamera()` returns XR camera; use `playerRig` group.

```js
const playerRig = new THREE.Group();
playerRig.add(camera); // camera is XR camera reference
scene.add(playerRig);
// Move rig, not camera, for locomotion
playerRig.position.copy(playerPos);
```

### Babylon.js WebXR
```js
const xr = await scene.createDefaultXRExperienceAsync({
  floorMeshes:[ground],
  optionalFeatures:true
});
xr.baseExperience.onStateChangedObservable.add(state=>{ if(state===BABYLON.WebXRState.IN_VR) console.log("in VR"); });
// Teleportation + hand tracking
const teleport = xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRFeatureName.TELEPORTATION,{xrInput:xr.input, floorMeshes:[ground]});
const hands = xr.baseExperience.featuresManager.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING,{xrInput:xr.input});
```

## 2. Controllers & Input

```js
// Three
const controller1 = renderer.xr.getController(0);
controller1.addEventListener('selectstart', ()=> fire());
controller1.addEventListener('selectend', ()=> {});
scene.add(controller1);
const grip1 = renderer.xr.getControllerGrip(0);
grip1.add(new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.1), mat));
scene.add(grip1);
// Input source polling (thumbstick)
function pollXRInput(frame){
  const session = renderer.xr.getSession();
  if(!session) return;
  for(const src of session.inputSources){
    if(src.gamepad){
      const axes = src.gamepad.axes; // [x,y] thumbstick
      movePlayer(axes[0], axes[1]);
    }
  }
}

// Babylon
xr.input.onControllerAddedObservable.add(ctrl=>{
  ctrl.onMotionControllerInitObservable.add(m=>{
    m.onModelLoadedObservable.add(()=> console.log("model", m));
    const trigger = m.getComponent('xr-standard-trigger');
    trigger.onButtonStateChangedObservable.add(()=>{ if(trigger.pressed) fire(); });
  });
});
```

## 3. Locomotion

- **Teleport** (no nausea): arc + floor raycast, fade.
- **Smooth stick**: thumbstick → rig translation relative HMD yaw.
- **Snap turn**: 45° per flick.

```js
// Smooth locomotion relative headset yaw
function moveRig(delta, axes){
  const yaw = new THREE.Vector3(); camera.getWorldDirection(yaw); yaw.y=0; yaw.normalize();
  const right = new THREE.Vector3().crossVectors(yaw, new THREE.Vector3(0,1,0)).negate();
  const move = new THREE.Vector3().addScaledVector(right, axes[0]).addScaledVector(yaw, -axes[1]);
  playerRig.position.addScaledVector(move, delta * 3.0); // 3 m/s
}
```

## 4. Performance & Comfort

- 90 FPS target (72 on Quest 2 fallback) — half of desktop 60×?
- `renderer.setPixelRatio(1)` in XR — headset already high-res.
- Instanced + LOD, no post-processing in XR (costly).
- Comfort vignette on move, horizon lock.

## 5. Checklist

- [ ] `VRButton` or `createDefaultXRExperienceAsync` entry.
- [ ] `setAnimationLoop`, not `requestAnimationFrame`.
- [ ] Teleport + snap turn + grip visuals.
- [ ] Test in `chrome://xr` emulator + real Quest.

## 6. Fallback

If no headset: desktop mirror renders same scene; XR code no-ops when `navigator.xr` missing. Document controls.

