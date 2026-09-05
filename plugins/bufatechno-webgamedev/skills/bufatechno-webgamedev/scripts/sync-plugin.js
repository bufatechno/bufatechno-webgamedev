#!/usr/bin/env node
/**
 * Mirrors root skill files into the marketplace bundle at
 * plugins/bufatechno-webgamedev/skills/bufatechno-webgamedev/.
 * Usage: npm run sync:plugin  (run after ANY edit to SKILL.md, references/, scripts/, assets/)
 * The bundle is an intentional distribution mirror — not a fork.
 * test/skill.test.js fails on any drift this script was not run for.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, 'plugins', 'bufatechno-webgamedev', 'skills', 'bufatechno-webgamedev');

// Root-relative paths mirrored 1:1 into the bundle.
const MIRRORS = [
  'SKILL.md',
  'references/',
  'scripts/',
  'assets/',
];

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
    // Prune bundle orphans: files in dest with no root source.
    for (const entry of fs.readdirSync(dst)) {
      if (!fs.existsSync(path.join(src, entry))) {
        fs.rmSync(path.join(dst, entry), { recursive: true, force: true });
        console.log(`  pruned orphan: ${path.relative(ROOT, path.join(dst, entry))}`);
      }
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

let count = 0;
for (const rel of MIRRORS) {
  const src = path.join(ROOT, rel);
  const dst = path.join(DEST, rel);
  const before = JSON.stringify(fs.existsSync(dst) ? fs.statSync(dst) : null);
  copyRecursive(src, dst);
  count++;
  console.log(`✓ mirrored ${rel} ${before === 'null' ? '(new)' : ''}`);
}
console.log(`\nDone: ${count} paths mirrored root → plugins/bufatechno-webgamedev/skills/bufatechno-webgamedev/`);
console.log('Verify with: npm run test:skill');
