// `bujang update` — safe additive update.
//
// Rule (intentionally simple):
//   - New agent files (don't exist locally) → install them.
//   - Existing agent files → leave alone, never touch.
//   - CLAUDE.md / learning log → never touched.
//
// Use case: a user runs `bujang init` once, then later upgrades the npm
// package. `bujang update` pulls in newly-added teams (e.g. cofounder.md,
// the content-production teams in 0.5.x) without disturbing anything they've
// customised. No `.new` files, no diff, no merge.
//
// For users who *want* to overwrite, they use `bujang init --yes` (existing
// behavior). `update` is the safe additive path.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanProject } from './scan.js';
import { renderTemplate } from './template.js';
import { printRestartReminder } from './init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[39m`,
};

interface UpdateOptions {
  target: string;
  lang: 'ko' | 'en';
}

export async function runUpdate(args: string[]): Promise<void> {
  const opts = parseArgs(args);
  const assets = await resolveAssetPaths();

  const agentsSrc = path.join(assets.agents, opts.lang);
  const agentsDst = path.join(opts.target, '.claude/agents');

  console.log();
  console.log(c.bold('🔄 Harness-Bujang update'));
  console.log(c.dim(`   Target:    ${opts.target}`));
  console.log(c.dim(`   Language:  ${opts.lang}`));
  console.log();

  if (!(await exists(agentsDst))) {
    console.log(c.yellow('⚠  No .claude/agents/ directory found.'));
    console.log();
    console.log('  This project has not been initialized yet. Run:');
    console.log(`    ${c.cyan('npx harness-bujang init')}`);
    console.log();
    return;
  }

  // Build template context — only used for newly-installed files. Existing
  // files are not re-rendered.
  const scan = await scanProject(opts.target);
  const context = await buildContext(opts, scan);

  const agentFiles = (await fs.readdir(agentsSrc)).filter((f) => f.endsWith('.md'));
  agentFiles.sort();

  const added: string[] = [];
  const kept: string[] = [];

  console.log(c.bold('📂 Checking .claude/agents/'));
  for (const f of agentFiles) {
    const dst = path.join(agentsDst, f);
    if (await exists(dst)) {
      kept.push(f);
      console.log(`   ${c.dim('=')}  ${f} ${c.dim('(exists, kept as-is)')}`);
      continue;
    }
    const raw = await fs.readFile(path.join(agentsSrc, f), 'utf8');
    await fs.writeFile(dst, renderTemplate(raw, context));
    added.push(f);
    console.log(`   ${c.green('+')}  ${f}`);
  }
  console.log();

  console.log(c.bold('📋 Summary'));
  console.log(`   ${c.green('Added')}:  ${added.length}  ${added.length ? c.dim('(new files only)') : ''}`);
  console.log(`   ${c.dim('Kept')}:   ${kept.length}  ${c.dim('(existing files untouched)')}`);
  console.log();

  if (added.length === 0) {
    console.log(c.dim('   Nothing new to install — your harness is already up to date.'));
    console.log();
    return;
  }

  console.log(c.bold(c.green('✅ Update done.')));
  console.log();
  console.log('   Existing agent files were not modified. Your customizations are safe.');
  console.log('   To overwrite everything (e.g. for a clean reset), use instead:');
  console.log(`     ${c.cyan('npx harness-bujang init --yes')}`);
  console.log();
  // Critical: tell the user how to make Claude Code see the newly-added agents.
  printRestartReminder(opts.lang);
}

// ---------------------------------------------------------------------------
// helpers (mirror init.ts where reasonable to avoid drift)
// ---------------------------------------------------------------------------

interface AssetPaths {
  agents: string;
  templates: string;
  mode: 'packaged' | 'monorepo';
}

async function resolveAssetPaths(): Promise<AssetPaths> {
  const packaged = path.resolve(__dirname, '..', 'templates');
  if (await exists(packaged)) {
    return {
      agents: path.join(packaged, 'agents'),
      templates: path.join(packaged, 'templates'),
      mode: 'packaged',
    };
  }
  const monorepoRoot = path.resolve(__dirname, '../../..');
  const sharedDir = path.join(monorepoRoot, 'shared');
  if (await exists(sharedDir)) {
    return {
      agents: path.join(sharedDir, 'agents'),
      templates: path.join(sharedDir, 'templates'),
      mode: 'monorepo',
    };
  }
  throw new Error(
    `Could not locate harness-bujang assets. Tried:\n` +
      `  - ${packaged}\n` +
      `  - ${sharedDir}\n`,
  );
}

async function buildContext(
  opts: UpdateOptions,
  scan: import('./scan.js').ScanResult,
): Promise<Record<string, string>> {
  return {
    PROJECT_PATH:         opts.target,
    PROJECT_NAME:         path.basename(opts.target),
    PROJECT_CATEGORY:     scan.framework.startsWith('Next.js') ? 'Web application' : 'Software project',
    DIFFERENTIATION:      '(define your project differentiation here if relevant)',
    STACK_FRAMEWORK:      scan.framework,
    STACK_LANGUAGE:       scan.language,
    STACK_DB:             scan.db,
    STACK_UI:             scan.ui,
    STACK_PAYMENT:        scan.payment,
    STACK_EXTRA:          '(none)',
    HARNESS_TABLE:        'harness_messages',
    LEARNING_LOG_PATH:    'docs/AGENT_LEARNING_LOG.md',
    TASKS_TRACKER_GLOB:   'docs/TASKS_*.md',
    BENCHMARK_DOC_PATH:   'docs/BENCHMARK.md',
    GH_USER:              scan.ghUser,
    BUILD_CMD:            scan.buildCmd || '(no build script)',
    TYPECHECK_CMD:        scan.typecheckCmd || '(no type-check command)',
    TEST_CMD:             scan.testCmd || '(no tests configured)',
    E2E_CMD:              scan.e2eCmd || '(no E2E setup)',
    DEV_URL:              'http://localhost:3000',
    DB_TYPES_PATH:        scan.dbTypesPath,
    DB_CLIENT_PATTERN:    `Use the project's existing DB client convention. See ${scan.dbTypesPath}.`,
    KNOWN_SCHEMA_DRIFT:   '(none documented yet)',
    COMMON_FK_HINTS:      '(extract from your schema as you go)',
    ACCESS_POLICY_NOTES:  '(document RLS / middleware as encountered)',
    MIGRATION_NAMING:     'supabase/migrations/XXXXX_name.sql (or per-stack)',
    MIGRATION_APPLY_CMD:  'supabase db push (or stack-specific)',
    ROUTE_GROUPS:         scan.routeGroups,
    MIDDLEWARE_PATH:      scan.middlewarePath,
    KEY_RELATIONSHIPS:    '(document key entity relations as you go)',
    AUTH_GUARD_PATTERN:   '(stack-specific)',
    ADMIN_GUARD_PATTERN:  '(stack-specific)',
    API_RESPONSE_SHAPE:   '{ data, error, message }',
    PRIMARY_COLOR:        '#6366F1',
    FRAMEWORK_REVIEW_RULES: '',
    TEST_ACCOUNTS:        '(define your test accounts here)',
    LEGAL_CONTEXT:        '(no special legal context)',
    LANG_CODE:            opts.lang,
    TODAY:                new Date().toISOString().split('T')[0]!,
    COMPLETED_DOCS_PATTERN: 'docs/완료_*.md',
  };
}

function parseArgs(args: string[]): UpdateOptions {
  const lang = (getFlag(args, '--lang') ?? 'ko') as 'ko' | 'en';
  if (!['ko', 'en'].includes(lang)) {
    throw new Error(`--lang must be "ko" or "en", got "${lang}"`);
  }
  const targetRaw = getFlag(args, '--target') ?? '.';
  return {
    target: path.resolve(targetRaw),
    lang,
  };
}

function getFlag(args: string[], name: string): string | undefined {
  for (const a of args) {
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1);
  }
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1]!.startsWith('--')) {
    return args[idx + 1];
  }
  return undefined;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
