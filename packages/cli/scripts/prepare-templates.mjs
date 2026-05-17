#!/usr/bin/env node
/**
 * Bundle the monorepo's `shared/` assets into `packages/cli/templates/` so
 * the published npm package is self-contained.
 *
 * Layout produced:
 *   packages/cli/templates/
 *   ├── agents/{ko,en}/      ← from shared/agents/
 *   └── templates/{ko,en}/   ← from shared/templates/
 *
 * Runs automatically before `tsup` build (see package.json scripts).
 * The `templates/` directory is git-ignored — it's a build artifact regenerated
 * from the SoT in `shared/`.
 *
 * 0.9.0: packages/template/ (Next.js admin route) was removed. The chat room
 * is served only by `bujang chat` (standalone localhost viewer) now.
 */

import { cp, rm, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(CLI_ROOT, '../..');
const DEST = path.join(CLI_ROOT, 'templates');

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(src, dst) {
  if (!(await exists(src))) {
    throw new Error(`source not found: ${src}`);
  }
  await cp(src, dst, { recursive: true });
}

async function main() {
  console.log(`[prepare-templates] cleaning ${path.relative(CLI_ROOT, DEST)}/`);
  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });

  console.log('[prepare-templates] copying shared/agents/ → templates/agents/');
  await copyTree(path.join(MONOREPO_ROOT, 'shared/agents'), path.join(DEST, 'agents'));

  console.log('[prepare-templates] copying shared/templates/ → templates/templates/');
  await copyTree(
    path.join(MONOREPO_ROOT, 'shared/templates'),
    path.join(DEST, 'templates'),
  );

  console.log('[prepare-templates] ✓ done');
}

main().catch((err) => {
  console.error('[prepare-templates] failed:', err.message);
  process.exit(1);
});
