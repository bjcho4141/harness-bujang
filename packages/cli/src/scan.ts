import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface ScanResult {
  framework: string;
  language: string;
  db: string;
  ui: string;
  payment: string;
  ghUser: string;
  buildCmd: string;
  typecheckCmd: string;
  testCmd: string;
  e2eCmd: string;
  dbTypesPath: string;
  routeGroups: string;
  middlewarePath: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

export async function scanProject(target: string): Promise<ScanResult> {
  const has = (p: string) => exists(path.join(target, p));
  const pkg = await readJson(path.join(target, 'package.json'));
  const deps: Record<string, string> = {
    ...(pkg?.dependencies as Record<string, string> | undefined),
    ...(pkg?.devDependencies as Record<string, string> | undefined),
  };

  // Framework
  let framework = 'Generic project';
  let language = 'unknown';

  if ((await has('next.config.js')) || (await has('next.config.ts')) || (await has('next.config.mjs'))) {
    framework = `Next.js ${deps.next?.replace(/[^\d.]/g, '') ?? ''}`.trim();
    language = (await has('tsconfig.json')) ? 'TypeScript' : 'JavaScript';
  } else if ((await has('svelte.config.js')) || (await has('svelte.config.ts'))) {
    framework = 'SvelteKit';
    language = 'TypeScript';
  } else if ((await has('astro.config.mjs')) || (await has('astro.config.ts'))) {
    framework = 'Astro';
    language = 'TypeScript';
  } else if (await has('nuxt.config.ts')) {
    framework = 'Nuxt';
    language = 'TypeScript';
  } else if (await has('Gemfile')) {
    framework = 'Rails';
    language = 'Ruby';
  } else if (await has('manage.py')) {
    framework = 'Django';
    language = 'Python';
  } else if (await has('pyproject.toml')) {
    framework = 'Python project';
    language = 'Python';
  } else if (await has('Cargo.toml')) {
    framework = 'Rust project';
    language = 'Rust';
  } else if (await has('package.json')) {
    framework = 'Node.js';
    language = (await has('tsconfig.json')) ? 'TypeScript' : 'JavaScript';
  }

  // DB
  let db = 'none / not detected';
  let dbTypesPath = 'src/types/database.ts';
  if ((await has('supabase')) || deps['@supabase/supabase-js']) {
    db = 'Supabase (Postgres + Auth + Realtime + Storage)';
    dbTypesPath = 'src/types/database.ts';
  } else if (await has('prisma/schema.prisma')) {
    db = 'Prisma + Postgres';
    dbTypesPath = 'prisma/schema.prisma';
  } else if ((await has('drizzle.config.ts')) || (await has('drizzle.config.js'))) {
    db = 'Drizzle ORM';
    dbTypesPath = 'src/db/schema.ts';
  } else if (deps.typeorm) {
    db = 'TypeORM';
    dbTypesPath = 'src/entities/';
  } else if (deps.sequelize) {
    db = 'Sequelize';
    dbTypesPath = 'src/models/';
  }

  // UI
  let ui = 'plain CSS';
  if (deps.tailwindcss) ui = 'Tailwind CSS';
  if (deps['@radix-ui/react-dialog'] || deps['shadcn-ui']) ui = 'Tailwind + shadcn/ui';
  if (deps['@mui/material']) ui = 'MUI';
  if (deps['@chakra-ui/react']) ui = 'Chakra UI';

  // Payment
  let payment = 'none';
  if (deps.stripe || deps['@stripe/stripe-js']) payment = 'Stripe';
  if (deps['@tosspayments/payment-sdk']) payment = 'Toss Payments';
  // Inicis / KakaoPay are typically integrated without an npm package.

  // Commands
  const scripts = (pkg?.scripts ?? {}) as Record<string, string>;
  const buildCmd = scripts.build ? 'npm run build' : 'npm run build';
  const typecheckCmd = scripts.typecheck
    ? 'npm run typecheck'
    : language === 'TypeScript'
      ? 'npx tsc --noEmit'
      : '';
  const testCmd = scripts.test ? 'npm test' : '';
  const e2eCmd = scripts['test:e2e'] ? 'npm run test:e2e' : '';

  // Git user
  let ghUser = 'your-github-handle';
  try {
    const out = execSync('git config user.name', { cwd: target, encoding: 'utf8' }).trim();
    if (out) ghUser = out;
  } catch {
    /* ignore */
  }

  // Route groups (Next.js heuristic)
  let routeGroups = 'see project';
  let middlewarePath = 'middleware.ts';
  if (framework.startsWith('Next.js')) {
    const groups: string[] = [];
    if (await has('src/app/(public)')) groups.push('(public)');
    if (await has('src/app/(auth)')) groups.push('(auth)');
    if (await has('src/app/(dashboard)')) groups.push('(dashboard)');
    if (await has('src/app/(admin)')) groups.push('(admin)');
    routeGroups = groups.length > 0 ? groups.join(' / ') : 'src/app/';
    if (await has('src/proxy.ts')) middlewarePath = 'src/proxy.ts';
    else if (await has('middleware.ts')) middlewarePath = 'middleware.ts';
    else if (await has('src/middleware.ts')) middlewarePath = 'src/middleware.ts';
  }

  return {
    framework,
    language,
    db,
    ui,
    payment,
    ghUser,
    buildCmd,
    typecheckCmd,
    testCmd,
    e2eCmd,
    dbTypesPath,
    routeGroups,
    middlewarePath,
  };
}
