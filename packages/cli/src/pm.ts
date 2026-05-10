// Package manager detection + auto-install helper (0.8.2).
//
// Used by `init` after the SQLite/Supabase template lands in the user's
// project — if we don't pull in better-sqlite3 / @supabase/supabase-js
// automatically, the next `next dev` blows up with module-not-found.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

export type PM = 'pnpm' | 'yarn' | 'bun' | 'npm';

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

/**
 * Pick the package manager: `packageManager` field (Corepack) wins, then
 * lockfile precedence (pnpm > yarn > bun > npm), then fallback to npm.
 */
export async function detectPM(target: string): Promise<PM> {
  try {
    const raw = await fs.readFile(path.join(target, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    const pmField = (pkg.packageManager as string | undefined) ?? '';
    if (pmField.startsWith('pnpm')) return 'pnpm';
    if (pmField.startsWith('yarn')) return 'yarn';
    if (pmField.startsWith('bun'))  return 'bun';
    if (pmField.startsWith('npm'))  return 'npm';
  } catch { /* package.json missing or malformed — fall through */ }

  if (await exists(path.join(target, 'pnpm-lock.yaml')))    return 'pnpm';
  if (await exists(path.join(target, 'yarn.lock')))         return 'yarn';
  if (await exists(path.join(target, 'bun.lockb')))         return 'bun';
  if (await exists(path.join(target, 'bun.lock')))          return 'bun';
  if (await exists(path.join(target, 'package-lock.json'))) return 'npm';
  return 'npm';
}

export interface DepSpec {
  name: string;
  /** True for devDependencies. */
  dev?: boolean;
}

/** Combined dependencies + devDependencies + peerDependencies from package.json. */
export async function readDeps(target: string): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(path.join(target, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw);
    return {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
  } catch {
    return {};
  }
}

export interface InstallResult {
  ok: boolean;
  cmd: string;
  err?: string;
}

/**
 * Run `<pm> add` for the given deps. Splits prod / dev into two commands
 * because every PM uses different flag positions for dev deps. Inherits
 * stdio so the user sees the install progress in real time (native module
 * compile can take 10–30s).
 */
export async function installDeps(
  target: string,
  pm: PM,
  deps: DepSpec[],
): Promise<InstallResult> {
  if (deps.length === 0) return { ok: true, cmd: '(no deps to install)' };

  const prod = deps.filter((d) => !d.dev).map((d) => d.name);
  const dev  = deps.filter((d) => d.dev).map((d) => d.name);

  const cmds: string[] = [];
  if (prod.length > 0) cmds.push(buildAddCmd(pm, prod, false));
  if (dev.length  > 0) cmds.push(buildAddCmd(pm, dev,  true));

  for (const cmd of cmds) {
    const result = await runCmd(cmd, target);
    if (!result.ok) return { ok: false, cmd, err: result.err };
  }
  return { ok: true, cmd: cmds.join(' && ') };
}

export function buildAddCmd(pm: PM, names: string[], dev: boolean): string {
  const list = names.join(' ');
  switch (pm) {
    case 'pnpm': return dev ? `pnpm add -D ${list}` : `pnpm add ${list}`;
    case 'yarn': return dev ? `yarn add -D ${list}` : `yarn add ${list}`;
    case 'bun':  return dev ? `bun add -d ${list}`  : `bun add ${list}`;
    case 'npm':  return dev ? `npm i -D ${list}`    : `npm i ${list}`;
  }
}

function runCmd(cmd: string, cwd: string): Promise<{ ok: boolean; err?: string }> {
  return new Promise((resolve) => {
    const parts = cmd.split(' ');
    const bin = parts[0]!;
    const args = parts.slice(1);
    const proc = spawn(bin, args, {
      cwd,
      stdio: 'inherit',
      // shell:true on Windows so .cmd shims (npm.cmd, pnpm.cmd) resolve correctly.
      shell: process.platform === 'win32',
    });
    proc.on('error', (err) => resolve({ ok: false, err: err.message }));
    proc.on('close', (code) => resolve({
      ok: code === 0,
      err: code === 0 ? undefined : `exit code ${code}`,
    }));
  });
}
