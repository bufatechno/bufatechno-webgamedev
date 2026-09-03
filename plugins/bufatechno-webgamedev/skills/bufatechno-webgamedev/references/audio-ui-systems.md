# Audio & UI/HUD Systems Reference

Two systems covered together because both deal with player feedback. Audio without UI feels disconnected; UI without audio feels sterile. Build them in tandem.

## Part 1: Audio — Procedural Web Audio

### Why procedural audio?

For one-shot deliverables (single HTML file), procedural audio means:
- **No asset files** — game stays self-contained
- **Zero latency** — oscillator start is instant; MP3 has decode delay
- **Pitch variation** — slight randomization on each shot makes 100 shots sound unique, not robotic
- **Tiny size** — 50 lines of code replace 50 audio files

### AudioContext Setup

```js
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
  }

  // MUST be called after a user gesture (click). Browsers block autoplay.
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend();
  }

  setMasterVolume(v) { this.master.gain.value = v; }
  setMusicVolume(v)  { this.musicGain.gain.value = v; }
  setSfxVolume(v)    { this.sfxGain.gain.value = v; }
}
```

### Sound Primitives

Every procedural sound is one of:
- **Impulse** — short burst (shoot, click) — oscillator + envelope
- **Noise burst** — explosion, hit — filtered noise + envelope
- **Tone** — beep, blip — oscillator
- **Sweep** — riser, alarm — frequency ramp
- **Loop** — ambient, music — continuous oscillators or sample looping

### Impulse (shoot, click, blip)

```js
shoot() {
  const t = this.ctx.currentTime;
  const osc = this.ctx.createOscillator();
  osc.type = 'square';
  // Pitch randomization — sounds less robotic
  osc.frequency.setValueAtTime(180 + Math.random() * 40, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

  const gain = this.ctx.createGain();
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  osc.connect(gain).connect(this.sfxGain);
  osc.start(t);
  osc.stop(t + 0.12);
}
```

### Noise burst (explosion, hit)

```js
explosion() {
  const t = this.ctx.currentTime;
  const dur = 0.5;

  // White noise buffer
  const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = this.ctx.createBufferSource();
  src.buffer = buffer;

  // Lowpass filter — gives "boom" character
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, t);
  filter.frequency.exponentialRampToValueAtTime(80, t + dur);

  const gain = this.ctx.createGain();
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

  src.connect(filter).connect(gain).connect(this.sfxGain);
  src.start(t);
}
```

### Footstep (looping, walk cycle)

```js
footstep() {
  // Short lowpass noise — sounds like a soft step
  const t = this.ctx.currentTime;
  const dur = 0.08;
  const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = this.ctx.createBufferSource();
  src.buffer = buffer;
  const filter = this.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  const gain = this.ctx.createGain();
  gain.gain.value = 0.15;
  src.connect(filter).connect(gain).connect(this.sfxGain);
  src.start(t);
}

// Trigger footstep on walk cycle — when player has moved 0.5 units since last step:
if (distanceMoved > 0.5) {
  audio.footstep();
  distanceMoved = 0;
}
```

### Music — Looping Arpeggio

```js
class MusicSystem {
  constructor(audioSystem) {
    this.audio = audioSystem;
    this.playing = false;
    this.tempo = 120;     // BPM
  }

  play(notes = [220, 277, 330, 277, 247, 277, 330, 415]) {
    if (this.playing) return;
    this.playing = true;
    this._scheduleNext(0, notes, 0);
  }

  _scheduleNext(noteIndex, notes, time) {
    if (!this.playing) return;
    const beat = 60 / this.tempo / 2;   // eighth notes
    const freq = notes[noteIndex % notes.length];

    const osc = this.audio.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const gain = this.audio.ctx.createGain();
    const t = this.audio.ctx.currentTime + 0.01;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);

    osc.connect(gain).connect(this.audio.musicGain);
    osc.start(t);
    osc.stop(t + beat);

    setTimeout(() => this._scheduleNext(noteIndex + 1, notes, time + beat), beat * 1000 - 10);
  }

  stop() { this.playing = false; }
}
```

### Loading external audio

For full music tracks, load an MP3 and loop it:

```js
async loadMusic(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const audioBuffer = await this.ctx.decodeAudioData(buffer);

  const src = this.ctx.createBufferSource();
  src.buffer = audioBuffer;
  src.loop = true;
  src.connect(this.musicGain);
  src.start();
  this.musicSource = src;
}

stopMusic() {
  if (this.musicSource) {
    this.musicSource.stop();
    this.musicSource = null;
  }
}
```

### 3D positional audio

For games where sound should come from the source's direction:

```js
class PositionalSound {
  constructor(audioSystem, mesh) {
    this.panner = audioSystem.ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1;
    this.panner.maxDistance = 50;
    this.panner.connect(audioSystem.sfxGain);
    this.mesh = mesh;
    audioSystem.listener = audioSystem.ctx.listener;
  }

  play(buffer) {
    const src = audioSystem.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.panner);
    src.start();
  }

  // Call per frame to update position
  update() {
    this.panner.positionX.value = this.mesh.position.x;
    this.panner.positionY.value = this.mesh.position.y;
    this.panner.positionZ.value = this.mesh.position.z;
  }
}

// Camera position must be updated too — call from main loop:
audioSystem.listener.positionX.value = camera.position.x;
audioSystem.listener.positionY.value = camera.position.y;
audioSystem.listener.positionZ.value = camera.position.z;
// And orientation — use camera.getWorldDirection
const dir = new THREE.Vector3();
camera.getWorldDirection(dir);
audioSystem.listener.forwardX.value = dir.x;
audioSystem.listener.forwardY.value = dir.y;
audioSystem.listener.forwardZ.value = dir.z;
```

### Common audio bugs

| Symptom | Cause | Fix |
|---|---|---|
| No sound | AudioContext created before user gesture | Call `audio.init()` inside the click handler |
| Sound stutters | Too many oscillators created per frame | Use object pool for sources |
| Sound too loud/quiet | No master gain or default is too high | Always route through master gain with 0.3-0.5 default |
| Different volumes across browsers | Chrome/Safari normalize differently | Use `audioContext.destination.maxChannelCount` to detect, or normalize in audio file |
| AudioContext stuck "suspended" | Tab backgrounded then refocused | Call `audioContext.resume()` on every focus/click |

## Part 2: UI / HUD

### DOM UI vs In-Canvas UI

| Use case | Best choice |
|---|---|
| Static HUD (health, score, ammo) | DOM overlay — easy CSS, accessible, doesn't redraw per frame |
| Menus, settings screens, dialog | DOM — easier forms, inputs, focus management |
| Damage numbers floating above enemies | In-canvas (CSS2DRenderer or sprite text) |
| Health bar above enemies | In-canvas (billboarded plane with shader) |
| World-space diegetic UI (cockpit displays) | In-canvas |
| Crosshair | Either — DOM is simpler |
| Babylon.js complex UI | Babylon GUI (in-canvas) |

### DOM HUD Pattern

```html
<div id="hud" style="position: fixed; inset: 0; pointer-events: none; color: white; font-family: monospace; font-size: 14px;">
  <div id="crosshair" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 20px; height: 20px;">
    <!-- crosshair lines -->
  </div>
  <div id="stats" style="position: absolute; top: 10px; left: 10px;">
    Health: <span id="health">100</span>
    Ammo: <span id="ammo">30</span>
    Score: <span id="score">0</span>
  </div>
  <div id="damage-flash" style="position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.5) 100%); opacity: 0; transition: opacity 0.1s;"></div>
</div>
```

```js
class UI {
  constructor() {
    this.healthEl = document.getElementById('health');
    this.ammoEl = document.getElementById('ammo');
    this.scoreEl = document.getElementById('score');
    this.flashEl = document.getElementById('damage-flash');
    this.hitMarker = document.getElementById('hit-marker');
    this.score = 0;
  }

  setHealth(h) {
    this.healthEl.textContent = Math.round(h);
    this.healthEl.style.color = h < 30 ? '#f55' : h < 70 ? '#fc5' : '#5f5';
  }

  setAmmo(a) { this.ammoEl.textContent = a; }
  addScore(n) { this.score += n; this.scoreEl.textContent = this.score; }

  flashDamage() {
    this.flashEl.style.opacity = '1';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.flashEl.style.opacity = '0', 150);
  }

  showHitMarker() {
    this.hitMarker.style.opacity = '1';
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => this.hitMarker.style.opacity = '0', 80);
  }
}
```

**Critical**: `pointer-events: none` on the HUD container. Otherwise the HUD blocks mouse clicks to the canvas.

For interactive UI elements (buttons), set `pointer-events: auto` on those specific elements:

```css
#hud { pointer-events: none; }
#hud button { pointer-events: auto; }
```

### In-Canvas UI (CSS2DRenderer)

For text labels that follow 3D objects (enemy name tags, damage numbers):

```js
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// In the game loop:
labelRenderer.render(scene, camera);

// Create a label that follows a 3D object
const div = document.createElement('div');
div.className = 'enemy-label';
div.textContent = 'Boss: 100/100 HP';
div.style.color = '#f55';
div.style.fontFamily = 'monospace';
div.style.textShadow = '0 0 3px black';
const label = new CSS2DObject(div);
label.position.set(0, 2, 0);   // above the enemy
enemy.add(label);

// Update text:
div.textContent = `Boss: ${boss.health}/100 HP`;
```

CSS2DRenderer is HTML elements positioned to track 3D positions. Cheap, sharp text, accessibility-friendly. But no occlusion (label shows through walls).

### In-Canvas UI (Sprite Text)

For occlusion-aware labels and damage numbers:

```js
function makeTextSprite(text, color = '#fff', size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${size}px sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 0.5, 1);
  return sprite;
}

// Damage number floating up and fading
function spawnDamageNumber(pos, damage, isCrit = false) {
  const sprite = makeTextSprite('-' + damage, isCrit ? '#ff5' : '#fff', isCrit ? 96 : 64);
  sprite.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
  sprite.userData.life = 1.0;
  sprite.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1, 0);
  scene.add(sprite);
}

// In update loop:
for (const obj of [...scene.children]) {
  if (obj.userData.life !== undefined) {
    obj.userData.life -= dt;
    if (obj.userData.life <= 0) {
      scene.remove(obj);
      obj.material.map.dispose();
      obj.material.dispose();
    } else {
      obj.position.addScaledVector(obj.userData.velocity, dt);
      obj.userData.velocity.y -= 1.5 * dt;  // float up then fall
      obj.material.opacity = obj.userData.life;
      obj.material.transparent = true;
    }
  }
}
```

### Babylon GUI (In-Canvas)

For Babylon.js games with complex UI, the GUI system is the killer feature:

```js
import { AdvancedDynamicTexture, Button, TextBlock, StackPanel, Rectangle, Image, Slider, Checkbox } from '@babylonjs/gui';

const ui = AdvancedDynamicTexture.CreateFullscreenUI('ui');

// Stack panel for menu
const panel = new StackPanel();
panel.width = '300px';
panel.height = '400px';
panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
ui.addControl(panel);

const title = new TextBlock();
title.text = 'SETTINGS';
title.color = 'white';
title.height = '50px';
title.fontSize = 28;
panel.addControl(title);

const volumeSlider = new Slider();
volumeSlider.minimum = 0;
volumeSlider.maximum = 1;
volumeSlider.value = 0.5;
volumeSlider.height = '20px';
volumeSlider.width = '200px';
volumeSlider.color = '#5cf';
volumeSlider.background = '#222';
volumeSlider.onValueChangedObservable.add((v) => audio.setMasterVolume(v));
panel.addControl(volumeSlider);

const closeBtn = Button.CreateSimpleButton('close', 'Close');
closeBtn.height = '40px';
closeBtn.color = 'white';
closeBtn.background = '#2a8';
closeBtn.onPointerClickObservable.add(() => ui.removeControl(panel));
panel.addControl(closeBtn);
```

### Damage Vignette

For "took damage" feedback:

```html
<div id="damage-vignette" style="position:fixed; inset:0; background: radial-gradient(ellipse at center, transparent 40%, rgba(255,0,0,0.7) 100%); opacity: 0; pointer-events: none; transition: opacity 0.15s ease-out;"></div>
```

```js
function flashDamage() {
  vignette.style.opacity = '1';
  setTimeout(() => vignette.style.opacity = '0', 150);
}

// Low health — keep vignette at low opacity
function updateHealthVignette(health, maxHealth) {
  if (health / maxHealth < 0.3) {
    vignette.style.opacity = String(0.4 + 0.3 * Math.sin(performance.now() / 200));
  }
}
```

### Screen Shake

For impact feedback:

```js
let shakeTime = 0;
let shakeIntensity = 0;

function addShake(intensity, duration) {
  shakeTime = Math.max(shakeTime, duration);
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

// In render:
if (shakeTime > 0) {
  shakeTime -= dt;
  const offset = new THREE.Vector3(
    (Math.random() - 0.5) * shakeIntensity * shakeTime,
    (Math.random() - 0.5) * shakeIntensity * shakeTime,
    0
  );
  camera.position.add(offset);
  renderer.render(scene, camera);
  camera.position.sub(offset);
  if (shakeTime <= 0) shakeIntensity = 0;
}

// Usage:
addShake(0.05, 0.2);   // small shake on hit
addShake(0.2, 0.5);    // big shake on explosion
```

### Pause Menu

```js
function showPauseMenu() {
  const menu = document.getElementById('pause-menu');
  menu.style.display = 'flex';
  game.pause();
}

function hidePauseMenu() {
  document.getElementById('pause-menu').style.display = 'none';
  game.resume();
}

// Resume button
document.getElementById('resume-btn').addEventListener('click', hidePauseMenu);

// Settings button
document.getElementById('settings-btn').addEventListener('click', () => {
  // toggle settings panel
});

// Quit to menu
document.getElementById('quit-btn').addEventListener('click', () => {
  document.exitPointerLock();
  hidePauseMenu();
  game.toMainMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (game.state === 'playing') showPauseMenu();
    else if (game.state === 'paused') hidePauseMenu();
  }
});
```

### Toast Notifications

For non-blocking feedback (achievement unlocked, item picked up):

```js
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.8); color: white; padding: 12px 24px;
    border-radius: 4px; border-left: 4px solid #5cf; pointer-events: none;
    animation: toast-in 0.3s ease-out, toast-out 0.3s ease-in ${duration/1000}s forwards;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration + 500);
}
```

### Loading Screen

```js
class LoadingScreen {
  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position: fixed; inset: 0; background: #000; color: white;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      z-index: 1000; transition: opacity 0.5s;
    `;
    this.el.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 16px;">Loading...</div>
      <div style="width: 300px; height: 8px; background: #222; border-radius: 4px; overflow: hidden;">
        <div id="bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #5cf, #5fa); transition: width 0.2s;"></div>
      </div>
      <div id="status" style="margin-top: 8px; color: #aaa; font-size: 12px;"></div>
    `;
    document.body.appendChild(this.el);
    this.bar = this.el.querySelector('#bar');
    this.status = this.el.querySelector('#status');
  }

  setProgress(pct, status = '') {
    this.bar.style.width = pct + '%';
    if (status) this.status.textContent = status;
  }

  hide() {
    this.el.style.opacity = '0';
    setTimeout(() => this.el.remove(), 500);
  }
}

const loader = new LoadingScreen();
loader.setProgress(10, 'Loading textures...');
// ...
loader.setProgress(50, 'Building world...');
// ...
loader.setProgress(100);
loader.hide();
```

---

## UI Audio Sync

Critical UX detail: every visible UI feedback should have a sound. Boring click → satisfying click + blip.

```js
// On health change
ui.setHealth(50);
audio.play('hurt');

// On damage flash
ui.flashDamage();
audio.play('hurt');

// On hit marker
ui.showHitMarker();
audio.play('hit');

// On enemy down
ui.addScore(100);
audio.play('enemyDown');

// On level up
ui.showLevelUp();
audio.play('levelUp');
```

Conversely, every audio cue should have visual feedback when possible. Audio-only feedback is missed by deaf players.

---

End of audio + UI reference. For full UI examples in FPS / voxel templates, see `fps-game-template.md` and `voxel-game-template.md`.
