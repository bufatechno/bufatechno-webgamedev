// Scaffold smoke tests — offline, zero dependencies.
// Runs both scaffolds into a temp dir, checks output structure,
// syntax-checks generated JS, and asserts skill invariants
// (fixed timestep, dt clamp, importmap, overlay).
// Run: npm run test:smoke  (or: node --test test/scaffold.test.js)
// Full build check (needs network): RUN_BUILD_TESTS=1 npm run test:smoke
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUN_BUILD = process.env.RUN_BUILD_TESTS === '1';

function scaffold(script, name, gameType) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bufatechno-scaffold-'));
  execFileSync('node', [path.join(ROOT, 'scripts', script), name, gameType], { cwd: dir, stdio: 'pipe' });
  return path.join(dir, name);
}

function mustContain(file, needles, label) {
  const content = fs.readFileSync(file, 'utf8');
  for (const n of needles) {
    assert.ok(content.includes(n), `${label} must contain: ${n}`);
  }
  return content;
}

function nodeCheck(file) {
  execFileSync('node', ['--check', file], { stdio: 'pipe' });
}

for (const [script, name, gameType, engine] of [
  ['scaffold-threejs.js', 'smoke-three', 'fps', 'three'],
  ['scaffold-babylonjs.js', 'smoke-babylon', 'third-person', 'babylon'],
]) {
  test(`${engine} scaffold produces a runnable project structure`, () => {
    const dir = scaffold(script, name, gameType);
    for (const f of ['index.html', 'src/main.js', 'src/Game.js', 'package.json', 'README.md', '.gitignore']) {
      assert.ok(fs.existsSync(path.join(dir, f)), `${engine}: missing ${f}`);
    }
    nodeCheck(path.join(dir, 'src/main.js'));
    nodeCheck(path.join(dir, 'src/Game.js'));
    JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); // valid JSON

    // Skill invariants (SKILL.md Phase 2/5): fixed step, dt clamp, resize, overlay
    mustContain(path.join(dir, 'src/Game.js'), ['1 / 60', '0.1', 'resize', 'requestAnimationFrame'], `${engine} Game.js`);
    mustContain(path.join(dir, 'index.html'), ['importmap', 'overlay', 'manifest'], `${engine} index.html`);
    mustContain(path.join(dir, 'README.md'), ['How to Run', 'Controls'], `${engine} README.md`);
  });
}

test('three.js scaffold importmap pins match skill pins', () => {
  const dir = scaffold('scaffold-threejs.js', 'pin-check', 'empty');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('three@0.175.0'), 'scaffold importmap must pin three@0.175.0');
  assert.ok(html.includes('build/three.tsl.js'), 'scaffold must map three/tsl to build/three.tsl.js');
});

test('scaffolded projects build with vite (network, opt-in)', { skip: !RUN_BUILD }, () => {
  for (const [script, name] of [['scaffold-threejs.js', 'build-three'], ['scaffold-babylonjs.js', 'build-babylon']]) {
    const dir = scaffold(script, name, 'empty');
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'pipe', timeout: 180000 });
    execFileSync('npx', ['vite', 'build'], { cwd: dir, stdio: 'pipe', timeout: 180000 });
    assert.ok(fs.existsSync(path.join(dir, 'dist', 'index.html')), `${name}: dist/index.html missing after build`);
  }
});
