# Testing & Deployment Reference

How to verify your game works and ship it to players.

## Table of Contents

1. [Manual Test Matrix](#manual-test-matrix)
2. [Automated Smoke Test](#automated-smoke-test)
3. [Browser Compatibility Matrix](#browser-compatibility-matrix)
4. [Build for Production](#build-for-production)
5. [Deploy to GitHub Pages](#deploy-to-github-pages)
6. [Deploy to Netlify / Vercel](#deploy-to-netlify--vercel)
7. [Deploy to itch.io as HTML5](#deploy-to-itchio-as-html5)
8. [PWA Packaging](#pwa-packaging)
9. [Source Maps & Error Tracking](#source-maps--error-tracking)
10. [Analytics](#analytics)

---

## Manual Test Matrix

Run through this checklist before declaring a game "done". This is the minimum bar — every game you produce must pass.

### Setup
- [ ] Open `index.html` (Path A) or `npm run dev` (Path B) — game loads with no console errors
- [ ] No 404s in the Network tab for required assets
- [ ] No "Mixed Content" warnings if deployed over HTTPS
- [ ] Loading screen (if any) reaches 100% and hides
- [ ] Game shows initial state (menu or "click to play" overlay)

### Input
- [ ] WASD moves the player relative to camera direction (not world axes)
- [ ] Mouse look works after pointer lock (click first)
- [ ] Pointer lock engages on click, releases on Esc
- [ ] Mouse doesn't drift to screen edge (pointer lock is working)
- [ ] Space/Right-Click actions fire
- [ ] Touch controls work on mobile (if applicable)

### Movement & Physics
- [ ] Player cannot walk through walls (X, Z, Y each blocked)
- [ ] Player cannot fall through floor
- [ ] Player can jump and lands properly
- [ ] Slopes / stairs work (if game has them)
- [ ] Sprint/crouch modifier keys work

### Combat / Gameplay
- [ ] Primary action (shoot, place block, attack) works
- [ ] Hit detection is accurate (not missing obvious hits, not registering hits on thin air)
- [ ] Damage applies to correct target
- [ ] Death/respawn functions correctly

### Win/Lose
- [ ] Win condition triggers Victory state
- [ ] Lose condition triggers Game Over state
- [ ] Restart works (no leftover enemies, score resets, player respawns)
- [ ] Pause (Esc) works — game freezes
- [ ] Resume from pause continues correctly

### UI
- [ ] HUD shows correct live info (health, score, ammo, etc.)
- [ ] Crosshair is centered
- [ ] Damage flash / hit markers fire on relevant events
- [ ] Menus are navigable with mouse AND keyboard (Tab + Enter)

### Audio
- [ ] Audio plays on shoot/hit/jump/win/lose events
- [ ] Mute toggle works
- [ ] Audio doesn't play on menu (or does so intentionally)

### Performance
- [ ] FPS counter (or DevTools) shows 60 FPS on desktop with 100 objects
- [ ] FPS doesn't drop to <30 with 500 objects
- [ ] No frame stutter (no >100ms frame times)
- [ ] Memory usage stable over 60s of play (no leak)

### Edge Cases
- [ ] Game recovers from window resize (canvas resizes, no black bars)
- [ ] Game pauses when tab is backgrounded
- [ ] Game handles WebGL context loss (mobile GPU under pressure)
- [ ] Reload doesn't show cached broken state

### Teardown
- [ ] No errors in console when navigating away from page
- [ ] All event listeners cleaned up (if SPA)

### Multi-Resolution
- [ ] Game renders correctly at 1920x1080 (desktop)
- [ ] Game renders correctly at 2560x1440 (high-DPI desktop)
- [ ] Game renders correctly at 1280x720 (small laptop)
- [ ] Game renders correctly at 375x812 (mobile portrait, if applicable)
- [ ] UI elements don't overlap or clip

### Multi-Browser
- [ ] Chrome (latest) — primary target
- [ ] Firefox (latest) — secondary
- [ ] Safari (latest macOS) — secondary
- [ ] Safari iOS (latest) — mobile target if applicable
- [ ] Edge (latest) — usually same as Chrome

## Automated Smoke Test

For CI/CD or pre-deploy verification, write a smoke test that:
1. Loads the page in a headless browser (Puppeteer/Playwright)
2. Checks for console errors
3. Tests basic interactions (click to play, move, etc.)
4. Captures a screenshot

```js
// test/smoke.js — Run with Playwright
import { chromium } from 'playwright';

const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:8000/index.html');

// Wait for game to load
await page.waitForSelector('#overlay', { timeout: 5000 });

// Click to start
await page.click('#overlay');

// Wait for canvas to render
await page.waitForFunction(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return false;
  const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
  return ctx && ctx.getParameter(ctx.VERSION);
}, { timeout: 5000 });

// Simulate 1 second of play
await page.waitForTimeout(1000);

// Take screenshot for review
await page.screenshot({ path: 'test/screenshots/initial.png' });

// Check no errors
if (errors.length > 0) {
  console.error('Console errors detected:');
  errors.forEach(e => console.error(' -', e));
  process.exit(1);
}

console.log('Smoke test passed');
await browser.close();
```

Run with `node test/smoke.js` after `npm run dev` is serving on port 8000.

## Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| WebGL 2 | ✅ | ✅ | ✅ | ✅ |
| WebGPU | Partial (2024) | ❌ | Partial (Safari 17) | Partial |
| Pointer Lock API | ✅ | ✅ | ✅ | ✅ |
| Gamepad API | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |
| Web Audio | ✅ | ✅ | ✅ | ✅ |
| requestIdleCallback | ✅ | ❌ (use polyfill) | ❌ | ✅ |
| Web Workers | ✅ | ✅ | ✅ | ✅ |
| OffscreenCanvas | ✅ | ✅ | ✅ | ✅ |
| WebRTC DataChannel (multiplayer) | ✅ | ✅ | ✅ | ✅ |

For 3D web games in 2024, target Chrome + Firefox + Safari + Edge latest versions. Mobile Safari is the trickiest — it has stricter audio policies (must resume AudioContext on touchstart, not just click).

## Build for Production

For Vite-based projects:

```bash
npm run build
```

Produces `dist/` with minified, tree-shaken JS/CSS, hashed filenames for caching. Test the production build locally:

```bash
npm run preview
```

Vite preview serves `dist/` on a local server, mimicking production.

For Path A (CDN-only) projects, no build step. Just upload the files.

### Vite production optimizations

In `vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',    // relative paths — works when deployed to subdirectories
  build: {
    target: 'baseline-widely-available', // Vite 7 — Chrome107/Edge107/Firefox104/Safari16 (was es2020, updated v2)
    minify: 'esbuild',   // faster than terser
    chunkSizeWarningLimit: 1500,   // large games need bigger chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],        // split three.js into its own chunk
          'babylon': ['@babylonjs/core'],
        },
      },
    },
  },
});
```

### Tree-shaking Three.js

Three.js is huge (1.5 MB) when imported with `import * as THREE`. Use specific imports to tree-shake:

```js
// BAD — imports all of Three.js
import * as THREE from 'three';
// Bundle: 1.5 MB

// GOOD — imports only what you use
import { WebGLRenderer, Scene, PerspectiveCamera, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
// Bundle: ~300 KB for a small game
```

Babylon.js has the same issue — use `@babylonjs/core` specific imports for production:

```js
// BAD
import * as BABYLON from '@babylonjs/core';
// 3 MB

// GOOD
import { Engine, Scene, UniversalCamera } from '@babylonjs/core';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
// ~600 KB
```

## Deploy to GitHub Pages

For free hosting of public games:

1. Push your code to a GitHub repo
2. Either build (`npm run build`) and commit `dist/`, or use GitHub Actions to build on push
3. Enable Pages in repo Settings → Pages → Source = `gh-pages` branch or `/docs` folder

For SPA with Vite, set `base: '/repo-name/'` in `vite.config.js` so asset paths include the repo name.

GitHub Pages workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 20 }
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Deploy to Netlify / Vercel

Both have free tiers with HTTPS, custom domains, and global CDN.

### Netlify

1. Connect GitHub repo at netlify.com
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Auto-deploys on push

Or via CLI:

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Vercel

1. Connect GitHub repo at vercel.com
2. Framework: Vite (auto-detected)
3. Build command: `npm run build`
4. Output: `dist`
5. Auto-deploys on push

```bash
npm install -g vercel
vercel --prod
```

## Deploy to itch.io as HTML5

For indie game distribution:

1. Zip your build: `cd dist && zip -r ../game.zip ./*`
2. Go to itch.io → Create new project
3. Set "Kind" to HTML
4. Upload the zip
5. Set dimensions (e.g., 1280x720) or check "Mobile friendly"
6. Publish

itch.io embeds your game in an iframe, fullscreen-able, with achievements and comments. Best for game-jam and indie distribution.

## PWA Packaging

Make your game installable on mobile (looks like a native app):

`manifest.json`:

```json
{
  "name": "My Game",
  "short_name": "MyGame",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#000",
  "theme_color": "#000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`sw.js` (service worker for offline play):

```js
const CACHE = 'my-game-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  // ... list all your files
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
```

Register in HTML:

```html
<link rel="manifest" href="manifest.json">
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
</script>
```

Now mobile users can "Add to Home Screen" and play offline.

## Source Maps & Error Tracking

For production games, capture errors from real players:

```js
window.addEventListener('error', (e) => {
  fetch('/api/error', {
    method: 'POST',
    body: JSON.stringify({
      message: e.message,
      source: e.filename + ':' + e.lineno + ':' + e.colno,
      stack: e.error?.stack,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }),
  });
});

window.addEventListener('unhandledrejection', (e) => {
  fetch('/api/error', {
    method: 'POST',
    body: JSON.stringify({ message: 'Unhandled promise rejection: ' + e.reason, stack: e.reason?.stack }),
  });
});
```

For a simpler setup, use Sentry (free tier):

```js
import * as Sentry from '@sentry/browser';
Sentry.init({ dsn: 'https://...@sentry.io/...' });
```

Build with source maps (`build.sourcemap: true` in Vite) so error stacks show the original TypeScript/ES6 source, not minified garbage.

## Analytics

For understanding how players use your game:

```js
// Simple event tracking
function trackEvent(category, action, label = '', value = 0) {
  if (window.gtag) {
    gtag('event', action, { event_category: category, event_label: label, value });
  }
}

// Game-specific events
trackEvent('game', 'start');
trackEvent('game', 'level_complete', 'level_1', 45);   // 45 seconds
trackEvent('game', 'death', 'fall', 1);
trackEvent('game', 'quit', 'level_3');
```

Useful events to track:
- Game start (vs. page view — tells you how many visitors actually play)
- Tutorial completion rate (drop-off point)
- Level completion times
- Death count + cause (which level/section is too hard?)
- Average session length
- Win/lose ratio
- Most-used control schemes

Don't track PII (player names, chat messages) without explicit consent — privacy laws.

---

## Final Deployment Checklist

Before announcing "shipped":
- [ ] Production build runs with no errors in console
- [ ] All assets load (no 404s)
- [ ] HTTPS deployed (no mixed content)
- [ ] Works in Chrome, Firefox, Safari, Edge latest
- [ ] Works on mobile (at least Android Chrome + iOS Safari)
- [ ] Loading screen reaches 100%
- [ ] All win/lose states reachable
- [ ] README has controls and how-to-run
- [ ] License file included (MIT or similar)
- [ ] Privacy policy if analytics enabled
- [ ] Source maps generated (kept private, not deployed)
- [ ] Error tracking installed
- [ ] Tested on at least one real mobile device, not just emulator
- [ ] Tested on at least one slow network (Chrome DevTools throttling)
- [ ] Tested on at least one integrated-GPU laptop (Intel Iris)

---

End of testing & deployment reference. This concludes the reference library. For specific game type code, see `fps-game-template.md`, `voxel-game-template.md`, `third-person-template.md`, or `platformer-template.md`.
