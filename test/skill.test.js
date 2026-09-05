// Skill self-consistency tests — offline, zero dependencies.
// Run: npm test  (or: node --test test/)
// Opt-in network checks: RUN_NETWORK_TESTS=1 npm test  (HEADs every CDN pin, expects 200)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const RUN_NETWORK = process.env.RUN_NETWORK_TESTS === '1';

const VERSION_FILES = [
  'package.json',
  'SKILL.md',
  '.claude-plugin/marketplace.json',
  '.zcode-plugin/marketplace.json',
  'plugins/bufatechno-webgamedev/.claude-plugin/plugin.json',
  'plugins/bufatechno-webgamedev/.zcode-plugin/plugin.json',
  'plugins/bufatechno-webgamedev/skills/bufatechno-webgamedev/SKILL.md',
];

function rootVersion() {
  return JSON.parse(read('package.json')).version;
}

test('version is synced across all manifests and skill copies', () => {
  const expected = rootVersion();
  assert.match(expected, /^\d+\.\d+\.\d+$/, 'package.json version must be semver');
  for (const f of VERSION_FILES) {
    const content = read(f);
    assert.ok(
      content.includes(expected),
      `${f} must contain version ${expected}`,
    );
  }
  const meta = read('SKILL.md').match(/version:\s*"([^"]+)"/);
  assert.ok(meta, 'SKILL.md must declare metadata.version');
  assert.equal(meta[1], expected);
});

test('CHANGELOG has an entry for the current version', () => {
  assert.ok(
    read('CHANGELOG.md').includes(`## v${rootVersion()}`),
    `CHANGELOG.md must contain ## v${rootVersion()}`,
  );
});

test('bundled marketplace copy is in sync with root (full mirror)', () => {
  // Mirror definition lives in scripts/sync-plugin.js — keep this list aligned.
  const bundle = path.join(ROOT, 'plugins', 'bufatechno-webgamedev', 'skills', 'bufatechno-webgamedev');
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [path.relative(ROOT, p)];
    });
  const mirrored = ['SKILL.md', 'references', 'scripts', 'assets'];
  const rootFiles = mirrored.flatMap((rel) => {
    const abs = path.join(ROOT, rel);
    return fs.statSync(abs).isDirectory() ? walk(abs) : [rel];
  });
  assert.ok(rootFiles.length > 30, `expected 30+ mirrored files, got ${rootFiles.length}`);
  for (const rel of rootFiles) {
    const bundled = path.join(bundle, rel);
    assert.ok(fs.existsSync(bundled), `bundled copy missing: ${rel} (run npm run sync:plugin)`);
    assert.equal(
      fs.readFileSync(bundled, 'utf8'),
      fs.readFileSync(path.join(ROOT, rel), 'utf8'),
      `bundled copy drifted: ${rel} (run npm run sync:plugin)`,
    );
  }
  // No orphans: every bundled file under mirrored dirs must have a root source.
  for (const rel of mirrored) {
    const destDir = path.join(bundle, rel);
    if (!fs.existsSync(destDir) || !fs.statSync(destDir).isDirectory()) continue;
    for (const f of walk(destDir)) {
      const srcRel = path.relative(bundle, path.join(ROOT, f));
      assert.ok(fs.existsSync(path.join(ROOT, srcRel)), `bundled orphan without root source: ${srcRel}`);
    }
  }
});

test('no stale versions or broken TSL path remain', () => {
  const tracked = ['SKILL.md', 'README.md', 'CHANGELOG.md', 'package.json'];
  for (const f of tracked) {
    assert.ok(!read(f).includes('2.0.3') || f === 'CHANGELOG.md', `${f} has stale version`);
  }
  const haystacks = [
    'SKILL.md',
    'scripts/scaffold-threejs.js',
    'assets/templates/threejs/index.html',
  ];
  for (const f of haystacks) {
    assert.ok(!read(f).includes('examples/jsm/nodes/Nodes.js'), `${f} has 404 TSL path`);
    assert.ok(read(f).includes('build/three.tsl.js'), `${f} must map three/tsl to build/three.tsl.js`);
  }
});

test('dependency pins are consistent (three / babylon / vite)', () => {
  const threePins = new Set(
    [...read('SKILL.md').matchAll(/three@(\d+\.\d+\.\d+)/g)].map((m) => m[1])
      .concat([JSON.parse(read('assets/templates/threejs/package.json')).dependencies.three.replace('^', '')]),
  );
  assert.equal(threePins.size, 1, `three.js pins disagree: ${[...threePins]}`);
  const babylonPins = new Set(
    [...read('SKILL.md').matchAll(/@babylonjs\/core@(\d+\.\d+\.\d+)/g)].map((m) => m[1]),
  );
  assert.ok(babylonPins.size <= 1, `babylon pins disagree: ${[...babylonPins]}`);
});

test('every references/*.md link target exists', () => {
  const files = ['SKILL.md', 'README.md', 'CHANGELOG.md', 'references/external-libraries.md', 'references/design-system.md', 'references/testing-deployment.md'];
  for (const f of files) {
    const content = read(f);
    for (const m of content.matchAll(/\(([A-Za-z0-9_./-]+\.md)(#[^)]+)?\)/g)) {
      const target = path.join(ROOT, path.dirname(f), m[1]);
      assert.ok(fs.existsSync(target), `${f} links to missing file: ${m[1]}`);
    }
  }
});

test('every references/*.md file is listed in SKILL.md or README.md', () => {
  const index = read('SKILL.md') + read('README.md');
  for (const f of fs.readdirSync(path.join(ROOT, 'references'))) {
    if (!f.endsWith('.md')) continue;
    assert.ok(index.includes(f), `references/${f} is not indexed in SKILL.md/README.md`);
  }
});

test('CDN pins resolve (network, opt-in)', async () => {
  const sources = [
    'SKILL.md',
    'assets/templates/threejs/index.html',
    'assets/templates/babylonjs/index.html',
    'references/external-libraries.md',
  ];
  const urls = new Set();
  for (const f of sources) {
    for (const m of read(f).matchAll(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)[^"'`\s)]+/g)) {
      const u = m[0].replace(/\/$/, '').replace(/",?$/, '');
      // Skip importmap prefix mappings (bare directories like .../examples/jsm/)
      // — only file pins (last segment has an extension) are HEAD-able.
      if (!/\/[^/]+\.[a-z0-9]+(\?.*)?$/i.test(u)) continue;
      urls.add(u);
    }
  }
  assert.ok(urls.size > 0, 'expected at least one CDN pin to check');
  if (!RUN_NETWORK) {
    console.log(`  (skip: ${urls.size} CDN pins — set RUN_NETWORK_TESTS=1 to HEAD them)`);
    return;
  }
  for (const u of urls) {
    const res = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    assert.equal(res.status, 200, `CDN pin broken: ${u} → ${res.status}`);
  }
});
