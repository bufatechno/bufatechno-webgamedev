# Input Controls Reference

Comprehensive input handling for web games: keyboard, mouse, pointer lock, gamepad, touch. Includes deadzones, remapping, gesture detection, and accessibility.

## Table of Contents

1. [Input Manager Pattern](#input-manager-pattern)
2. [Keyboard](#keyboard)
3. [Mouse + Pointer Lock](#mouse--pointer-lock)
4. [Gamepad API](#gamepad-api)
5. [Touch — Virtual Joystick + Buttons](#touch--virtual-joystick--buttons)
6. [Input Remapping (User Settings)](#input-remapping)
7. [Multi-Touch Gestures](#multi-touch-gestures)
8. [Accessibility](#accessibility)

---

## Input Manager Pattern

Centralize all input. Per-system polling is cleaner than scattered event listeners.

```js
export class InputManager {
  constructor() {
    this.keys = new Set();           // currently held keys (by code: 'KeyW')
    this.keysJustPressed = new Set(); // keys pressed THIS frame (consumed by update end)
    this.keysJustReleased = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: [false, false, false] };
    this.wheel = 0;
    this.gamepads = [];
    this.touches = new Map();         // touchId -> { x, y, startX, startY }
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.keysJustPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keysJustReleased.add(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (document.pointerLockElement) {
        this.mouse.dx += e.movementX;
        this.mouse.dy += e.movementY;
      }
    });
    window.addEventListener('mousedown', (e) => { this.mouse.buttons[e.button] = true; });
    window.addEventListener('mouseup', (e) => { this.mouse.buttons[e.button] = false; });
    window.addEventListener('wheel', (e) => { this.wheel += e.deltaY; }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        this.touches.set(t.identifier, { x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY });
      }
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const touch = this.touches.get(t.identifier);
        if (touch) { touch.x = t.clientX; touch.y = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) this.touches.delete(t.identifier);
    });
    window.addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) this.touches.delete(t.identifier);
    });

    window.addEventListener('gamepadconnected', (e) => { this.gamepads[e.gamepad.index] = e.gamepad; });
    window.addEventListener('gamepaddisconnected', (e) => { delete this.gamepads[e.gamepad.index]; });
  }

  // Call at END of each frame to clear "just pressed" / "just released" / mouse delta
  endFrame() {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.wheel = 0;
  }

  // Query helpers
  isDown(code) { return this.keys.has(code); }
  justPressed(code) { return this.keysJustPressed.has(code); }
  justReleased(code) { return this.keysJustReleased.has(code); }
  anyDown(...codes) { return codes.some(c => this.keys.has(c)); }
}
```

Usage in player update:

```js
function updatePlayer(dt, input) {
  if (input.justPressed('Space')) player.jump();
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) player.moveForward();
  // etc
  input.endFrame();   // CRITICAL — call after all systems have read input
}
```

The "just pressed" pattern is essential — without it, jump fires every frame while spacebar is held.

## Keyboard

### Key Codes vs Key Values

Browser provides both `event.code` (physical key position) and `event.key` (logical character). For games, **always use `event.code`**.

| Pressed | `event.code` | `event.key` |
|---|---|---|
| W (US layout) | `KeyW` | `w` |
| W on AZERTY (French) | `KeyW` | `z` |
| Arrow up | `ArrowUp` | `ArrowUp` |

If you use `event.key`, AZERTY users need WASD-remapped-to-ZQSD which is painful. `event.code` ignores the keyboard layout — the physical key in the W position is always `KeyW`.

### Modifier keys

```js
if (input.isDown('ShiftLeft') && input.justPressed('KeyR')) {
  // sprint reload
}
```

Track modifiers separately so they don't conflict with movement:

```js
const modifiers = {
  ctrl: false,
  shift: false,
  alt: false,
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') modifiers.ctrl = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') modifiers.shift = true;
  if (e.code === 'AltLeft' || e.code === 'AltRight') modifiers.alt = true;
});
```

## Mouse + Pointer Lock

### Basic Pointer Lock

Pointer lock captures the cursor — necessary for FPS mouse-look. Without it, the cursor stops at screen edges.

```js
const canvas = renderer.domElement;
document.getElementById('overlay').addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    // hide overlay, resume audio
    document.getElementById('overlay').style.display = 'none';
    audioContext.resume();
  } else {
    // show "click to play" overlay, pause game
    document.getElementById('overlay').style.display = 'flex';
    game.pause();
  }
});

document.addEventListener('pointerlockerror', () => {
  console.error('Pointer lock failed');
});

// In InputManager's mousemove handler:
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement) {
    this.mouse.dx += e.movementX;
    this.mouse.dy += e.movementY;
  }
});
```

### Mouse Look with Pointer Lock

```js
function applyMouseLook(camera, dx, dy, sensitivity = 0.0022) {
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= dx * sensitivity;
  euler.x -= dy * sensitivity;
  // Clamp pitch to just below ±90° to avoid gimbal flip
  euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x));
  camera.quaternion.setFromEuler(euler);
}

// In player update:
applyMouseLook(camera, input.mouse.dx, input.mouse.dy);
```

### Why `movementX`/`movementY` instead of mouse position?

In pointer lock, the cursor doesn't move — it's hidden and locked at center. The browser gives you `movementX`/`movementY` = the delta since the last mousemove event. This is what you use for FPS look.

Outside pointer lock (e.g., clicking on UI), you'd use `clientX`/`clientY` for raycasting from cursor position.

### Pointer Lock Gotchas

- **Requires user gesture**: `requestPointerLock()` must be called inside a click/touch handler. Calling it on page load fails silently.
- **Fires on Tab switch**: when user Alt-Tabs, pointer lock exits. Handle this — pause the game.
- **Some browsers require `unadjustedMovement`** for raw mouse input (no OS mouse acceleration). Available in Chrome 88+. Use:

```js
canvas.requestPointerLock({ unadjustedMovement: true });
```

(Falls back to default if unsupported.)

## Gamepad API

The most neglected input method. Gamepads make your game feel "real" — wire them up.

### Polling Pattern

Gamepad input has no events — you must poll `navigator.getGamepads()` every frame.

```js
function pollGamepad(input) {
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad) continue;
    // Store latest state
    input.gamepads[pad.index] = {
      axes: pad.axes.slice(),
      buttons: pad.buttons.map(b => ({ pressed: b.pressed, value: b.value, justPressed: false })),
    };
  }
}

// Track "just pressed" for buttons (compare to previous frame)
function updateGamepadJustPressed(input) {
  for (const pad of Object.values(input.gamepads)) {
    for (let i = 0; i < pad.buttons.length; i++) {
      const prev = pad._prev?.[i] ?? false;
      pad.buttons[i].justPressed = pad.buttons[i].pressed && !prev;
    }
    pad._prev = pad.buttons.map(b => b.pressed);
  }
}
```

### Standard Mapping

Browsers map common controllers (Xbox, PlayStation) to a standard layout:

| Button Index | Xbox | PlayStation |
|---|---|---|
| 0 | A | Cross |
| 1 | B | Circle |
| 2 | X | Square |
| 3 | Y | Triangle |
| 4 | LB | L1 |
| 5 | RB | R1 |
| 6 | LT | L2 |
| 7 | RT | R2 |
| 8 | Back | Share |
| 9 | Start | Options |
| 10 | L stick | L3 |
| 11 | R stick | R3 |
| 12 | D-pad up | D-pad up |
| 13 | D-pad down | D-pad down |
| 14 | D-pad left | D-pad left |
| 15 | D-pad right | D-pad right |
| 16 | Home | PS |

| Axis Index | Direction |
|---|---|
| 0 | Left stick X (−1 left, +1 right) |
| 1 | Left stick Y (−1 up, +1 down) |
| 2 | Right stick X |
| 3 | Right stick Y |

### Deadzones

Analog sticks don't return to exact zero. Without a deadzone, the player drifts.

```js
function applyDeadzone(value, deadzone = 0.15) {
  if (Math.abs(value) < deadzone) return 0;
  // Re-map so the deadzone edge is 0, full deflection is 1
  return (value - Math.sign(value) * deadzone) / (1 - deadzone);
}

// In player movement:
const pad = input.gamepads[0];
if (pad) {
  const lx = applyDeadzone(pad.axes[0]);
  const ly = applyDeadzone(pad.axes[1]);
  move.x = lx;
  move.z = ly;
  const rx = applyDeadzone(pad.axes[2]);
  const ry = applyDeadzone(pad.axes[3]);
  applyMouseLook(camera, rx * 5 * dt, ry * 5 * dt);
  if (pad.buttons[0].justPressed) player.jump();
  if (pad.buttons[7].value > 0.5) weapon.fire();   // RT for shoot
}
```

### Triggers as Analog Buttons

LT/RT (buttons 6/7) return `value` (0 to 1) for analog pressure. Use `value > 0.5` for "pressed" threshold, or `value` for analog throttle (accelerator pedal in racing).

## Touch — Virtual Joystick + Buttons

For mobile, draw a virtual joystick on the bottom-left and action buttons on the bottom-right.

```js
class VirtualJoystick {
  constructor(x, y, radius = 60) {
    this.cx = x; this.cy = y;
    this.radius = radius;
    this.touchId = null;
    this.dx = 0; this.dy = 0;     // [-1, 1]
  }

  handleStart(touches) {
    if (this.touchId !== null) return null;
    for (const t of touches) {
      const dx = t.clientX - this.cx;
      const dy = t.clientY - this.cy;
      if (Math.hypot(dx, dy) < this.radius * 1.5) {
        this.touchId = t.identifier;
        return this._update(t.clientX, t.clientY);
      }
    }
    return null;
  }

  handleMove(touches) {
    if (this.touchId === null) return null;
    for (const t of touches) {
      if (t.identifier === this.touchId) {
        return this._update(t.clientX, t.clientY);
      }
    }
    return null;
  }

  handleEnd(touches) {
    if (this.touchId === null) return null;
    for (const t of touches) {
      if (t.identifier === this.touchId) {
        this.touchId = null;
        this.dx = 0; this.dy = 0;
        return { dx: 0, dy: 0 };
      }
    }
    return null;
  }

  _update(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      this.dx = dx / dist;
      this.dy = dy / dist;
    } else {
      this.dx = dx / this.radius;
      this.dy = dy / this.radius;
    }
    return { dx: this.dx, dy: this.dy };
  }
}
```

For the look pad (right side of screen), use a second virtual joystick but apply deltas to camera instead of player movement:

```js
const lookPad = {
  lastX: null,
  lastY: null,
  handleMove(touches) {
    for (const t of touches) {
      if (this.lastX === null) { this.lastX = t.clientX; this.lastY = t.clientY; return; }
      const dx = t.clientX - this.lastX;
      const dy = t.clientY - this.lastY;
      applyMouseLook(camera, dx, dy, 0.005);
      this.lastX = t.clientX;
      this.lastY = t.clientY;
    }
  },
  handleEnd() { this.lastX = null; this.lastY = null; }
};
```

For action buttons (jump, shoot, reload) — draw them as DOM elements with `touchstart`/`touchend`:

```html
<button id="jump-btn" style="position:fixed; bottom:30px; right:30px; width:80px; height:80px; border-radius:50%; background:rgba(0,200,100,0.6); border:2px solid white;">JUMP</button>
```

```js
const jumpBtn = document.getElementById('jump-btn');
let jumpHeld = false;
jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); jumpHeld = true; }, { passive: false });
jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); jumpHeld = false; }, { passive: false });
```

### Mobile-specific tips

- **iOS Safari doesn't emit `keydown` reliably** with the on-screen keyboard. For text input, use a hidden `<input>` field.
- **Double-tap to zoom**: prevent with `touch-action: none` CSS on the canvas.
- **Pinch-zoom**: prevent with `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`.
- **Haptic feedback**: `navigator.vibrate(50)` ms on hit/jump (Android only — iOS ignores).

## Input Remapping

Allow the user to remap keys. Store the binding map.

```js
const defaultBindings = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  fire: ['Mouse0'],
  reload: ['KeyR'],
  sprint: ['ShiftLeft'],
};

class InputBindings {
  constructor(saved = {}) {
    this.bindings = { ...defaultBindings, ...saved };
  }

  isActionDown(action, input) {
    return this.bindings[action].some(code => {
      if (code.startsWith('Mouse')) return input.mouse.buttons[parseInt(code.slice(5))] === true;
      return input.isDown(code);
    });
  }

  isActionJustPressed(action, input) {
    return this.bindings[action].some(code => {
      if (code.startsWith('Mouse')) return false;   // mouse just-pressed handled separately
      return input.justPressed(code);
    });
  }

  save() {
    localStorage.setItem('input-bindings', JSON.stringify(this.bindings));
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('input-bindings') || '{}');
      this.bindings = { ...defaultBindings, ...saved };
    } catch {}
  }
}

// Usage
const bindings = new InputBindings();
bindings.load();
if (bindings.isActionDown('forward', input)) player.moveForward();
```

## Multi-Touch Gestures

For gesture recognition (swipe, pinch, rotate), track touch deltas:

```js
class GestureRecognizer {
  constructor() {
    this.touches = new Map();
    this.pinchStart = 0;
    this.pinch = 1;
    this.rotation = 0;
  }

  onStart(e) {
    for (const t of e.changedTouches) {
      this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (this.touches.size === 2) {
      const [t1, t2] = [...this.touches.values()];
      this.pinchStart = Math.hypot(t2.x - t1.x, t2.y - t1.y);
    }
  }

  onMove(e) {
    for (const t of e.changedTouches) {
      if (this.touches.has(t.identifier)) {
        this.touches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    if (this.touches.size === 2) {
      const [t1, t2] = [...this.touches.values()];
      const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      this.pinch = dist / this.pinchStart;
    }
  }

  onEnd(e) {
    for (const t of e.changedTouches) this.touches.delete(t.identifier);
  }
}
```

## Accessibility

### One-handed mode

Allow remapping so all controls fit on one side of the keyboard:

```js
const oneHandedBindings = {
  forward: ['KeyI'],
  back: ['KeyK'],
  left: ['KeyJ'],
  right: ['KeyL'],
  jump: ['KeyU'],
  fire: ['KeyO'],
  reload: ['KeyP'],
  sprint: ['KeyY'],
};
```

### Colorblind-safe UI

Don't rely on color alone for health/score:

```js
// BAD: red for low health
ui.health.style.color = health < 30 ? '#f00' : '#0f0';

// GOOD: color + symbol + position
ui.health.style.color = health < 30 ? '#f00' : '#0f0';
ui.health.textContent = health < 30 ? '⚠ LOW: ' + health : health;
ui.health.classList.toggle('pulsing', health < 30);   // animation cue
```

### Keyboard-only navigation

For menus, ensure Tab/Enter work without mouse:

```html
<button class="menu-item" tabindex="0">Start</button>
<button class="menu-item" tabindex="0">Options</button>
```

```js
document.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    const items = [...document.querySelectorAll('.menu-item')];
    const current = items.indexOf(document.activeElement);
    items[(current + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  }
  if (e.code === 'Enter' && document.activeElement?.classList.contains('menu-item')) {
    document.activeElement.click();
  }
});
```

### Reduced motion

```js
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) {
  // disable screen shake, parallax, long tweens
  game.enableScreenShake = false;
  game.tweenSpeed = 4;   // faster — less motion duration
}
```

---

End of input reference. For game loop patterns, see `references/game-architecture.md`. For audio, see `references/audio-ui-systems.md`.
