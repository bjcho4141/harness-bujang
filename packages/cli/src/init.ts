import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, confirm } from '@inquirer/prompts';
import { scanProject } from './scan.js';
import { renderTemplate } from './template.js';

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

interface AssetPaths {
  agents: string;
  templates: string;
  projectTemplate: string;
  mode: 'packaged' | 'monorepo';
}

/**
 * Locate the bundled assets. Two layouts are supported:
 *
 *   1. **Packaged** (after `npm install harness-bujang`):
 *      `<package>/dist/index.js` runs alongside `<package>/templates/` which
 *      was copied from `shared/` + `packages/template/` at build time.
 *
 *   2. **Monorepo dev** (running `tsx src/index.ts` from this repo):
 *      `<repo>/packages/cli/src/init.ts` reaches up to `<repo>/shared/`.
 */
async function resolveAssetPaths(): Promise<AssetPaths> {
  const packaged = path.resolve(__dirname, '..', 'templates');
  if (await exists(packaged)) {
    return {
      agents: path.join(packaged, 'agents'),
      templates: path.join(packaged, 'templates'),
      projectTemplate: path.join(packaged, 'project-template'),
      mode: 'packaged',
    };
  }

  const monorepoRoot = path.resolve(__dirname, '../../..');
  const sharedDir = path.join(monorepoRoot, 'shared');
  if (await exists(sharedDir)) {
    return {
      agents: path.join(sharedDir, 'agents'),
      templates: path.join(sharedDir, 'templates'),
      projectTemplate: path.join(monorepoRoot, 'packages/template'),
      mode: 'monorepo',
    };
  }

  throw new Error(
    `Could not locate harness-bujang assets. Tried:\n` +
      `  - ${packaged}\n` +
      `  - ${sharedDir}\n` +
      `If installed via npm, try reinstalling. If running from source, ` +
      `run "npm run build" in packages/cli first.`,
  );
}

type ChatBackend = 'sqlite' | 'supabase';

interface InitOptions {
  lang: 'ko' | 'en';
  target: string;
  framework?: string;
  db?: string;
  /** Which backend the chat room (`harness_messages`) writes to. */
  chatBackend: ChatBackend;
  /**
   * If true (and chatBackend=sqlite), do NOT add `.harness/` to .gitignore —
   * letting the user commit chat history for cross-machine solo sync.
   * Default false (the safer choice; binary SQLite files don't merge).
   */
  commitChat: boolean;
  installTemplate: boolean;
  editClaudeMd: boolean;
  seedLearningLog: boolean;
  yes: boolean;
}

export async function runInit(args: string[]): Promise<void> {
  let opts = parseArgs(args);
  const assets = await resolveAssetPaths();

  console.log();
  console.log(c.bold('📦 Harness-Bujang init'));
  console.log(c.dim(`   Target:        ${opts.target}`));
  console.log(c.dim(`   Assets:        ${assets.mode}`));
  console.log();

  if (!(await exists(opts.target))) {
    throw new Error(`Target directory does not exist: ${opts.target}`);
  }

  // 1. Scan
  const scan = await scanProject(opts.target);
  console.log(c.bold('🔍 Detected'));
  console.log(`   Framework: ${scan.framework}`);
  console.log(`   Language:  ${scan.language}`);
  console.log(`   DB:        ${scan.db}`);
  console.log(`   UI:        ${scan.ui}`);
  console.log(`   Payment:   ${scan.payment}`);
  console.log(`   GitHub:    ${scan.ghUser}`);
  console.log();

  // 1b. Interactive prompts — only when stdin is a TTY and --yes was not passed.
  const interactive = !opts.yes && Boolean(process.stdin.isTTY);
  if (interactive) {
    try {
      opts = await promptInteractive(opts, scan);

      // If a previous install is detected, ask whether to overwrite. Without this,
      // a user picking (say) Korean on a project that already has English agents
      // would see all files skipped — their selection silently ignored.
      if (await isExistingInstall(opts.target)) {
        const overwrite = await confirm({
          message: 'Existing harness install detected. Overwrite all files to apply your selections?',
          default: false,
        });
        if (overwrite) opts.yes = true;
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'ExitPromptError') {
        console.log(c.dim('   (aborted)'));
        return;
      }
      throw err;
    }
  }

  console.log(c.bold('📋 Configuration'));
  console.log(c.dim(`   Language:      ${opts.lang}`));
  console.log(c.dim(`   Chat backend:  ${opts.chatBackend}${opts.chatBackend === 'sqlite' ? ' (local file)' : ' (cloud Postgres)'}`));
  if (scan.framework.startsWith('Next.js')) {
    console.log(c.dim(`   Chat-room UI:  ${opts.installTemplate ? 'install' : 'skip'}`));
  }
  console.log(c.dim(`   On conflict:   ${opts.yes ? 'overwrite' : 'skip existing files'}`));
  console.log();

  if (interactive) {
    try {
      const proceed = await confirm({ message: 'Proceed with these settings?', default: true });
      if (!proceed) {
        console.log(c.dim('   (aborted)'));
        return;
      }
      console.log();
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'ExitPromptError') {
        console.log(c.dim('   (aborted)'));
        return;
      }
      throw err;
    }
  }

  // 2. Build template context
  const context: Record<string, string> = {
    PROJECT_PATH:         opts.target,
    PROJECT_NAME:         path.basename(opts.target),
    PROJECT_CATEGORY:     scan.framework.startsWith('Next.js') ? 'Web application' : 'Software project',
    DIFFERENTIATION:      '(define your project differentiation here if relevant)',
    STACK_FRAMEWORK:      opts.framework ?? scan.framework,
    STACK_LANGUAGE:       scan.language,
    STACK_DB:             opts.db ?? scan.db,
    STACK_UI:             scan.ui,
    STACK_PAYMENT:        scan.payment,
    STACK_EXTRA:          '(none)',
    HARNESS_TABLE:        'harness_messages',
    ADMIN_HARNESS_ROUTE:  '/admin/harness',
    LEARNING_LOG_PATH:    'docs/AGENT_LEARNING_LOG.md',
    TASKS_TRACKER_GLOB:   'docs/TASKS_*.md',
    BENCHMARK_DOC_PATH:   'docs/BENCHMARK.md',
    GH_USER:              scan.ghUser,
    BUILD_CMD:            scan.buildCmd || '(no build script — add one if applicable)',
    TYPECHECK_CMD:        scan.typecheckCmd || '(no type-check command — language may not be statically typed)',
    TEST_CMD:             scan.testCmd || '(no tests configured)',
    E2E_CMD:              scan.e2eCmd || '(no E2E setup)',
    DEV_URL:              'http://localhost:3000',
    DB_TYPES_PATH:        scan.dbTypesPath,
    DB_CLIENT_PATTERN:    `Use the project's existing DB client convention. See ${scan.dbTypesPath} for types.`,
    KNOWN_SCHEMA_DRIFT:   '(none documented yet)',
    COMMON_FK_HINTS:      '(extract from your schema as you go)',
    ACCESS_POLICY_NOTES:  '(document RLS / middleware / controller guards as you encounter them)',
    MIGRATION_NAMING:     'supabase/migrations/XXXXX_name.sql (or per-stack)',
    MIGRATION_APPLY_CMD:  'supabase db push (or stack-specific)',
    ROUTE_GROUPS:         scan.routeGroups,
    MIDDLEWARE_PATH:      scan.middlewarePath,
    KEY_RELATIONSHIPS:    '(document key entity relations as you go)',
    AUTH_GUARD_PATTERN:   '(stack-specific — e.g. supabase.auth.getUser())',
    ADMIN_GUARD_PATTERN:  '(stack-specific — e.g. verifyAdmin())',
    API_RESPONSE_SHAPE:   '{ data, error, message }',
    PRIMARY_COLOR:        '#6366F1',
    FRAMEWORK_REVIEW_RULES: stackReviewRules(scan.framework),
    TEST_ACCOUNTS:        '(define your test accounts here)',
    LEGAL_CONTEXT:        '(no special legal context — remove "Legal/terms" rows in director.md if not applicable)',
    LANG_CODE:            opts.lang,
    TODAY:                new Date().toISOString().split('T')[0]!,
    COMPLETED_DOCS_PATTERN: 'docs/완료_*.md',
  };

  // 3. Copy agents
  console.log(c.bold(`📂 Installing agents to .claude/agents/`));
  const agentsSrc = path.join(assets.agents, opts.lang);
  const agentsDst = path.join(opts.target, '.claude/agents');
  await fs.mkdir(agentsDst, { recursive: true });

  const agentFiles = (await fs.readdir(agentsSrc)).filter((f) => f.endsWith('.md'));
  for (const f of agentFiles) {
    const dst = path.join(agentsDst, f);
    if ((await exists(dst)) && !opts.yes) {
      console.log(`   ${c.yellow('⚠')}  ${f} ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
      continue;
    }
    const raw = await fs.readFile(path.join(agentsSrc, f), 'utf8');
    await fs.writeFile(dst, renderTemplate(raw, context));
    console.log(`   ${c.green('✓')}  ${f}`);
  }
  console.log();

  // 4. Append CLAUDE.md section
  if (opts.editClaudeMd) {
    console.log(c.bold('📝 Updating CLAUDE.md'));
    const sectionTpl = await fs.readFile(
      path.join(assets.templates, opts.lang, 'CLAUDE.md.harness-section.template'),
      'utf8',
    );
    const section = renderTemplate(sectionTpl, context);
    const claudeMdPath = path.join(opts.target, 'CLAUDE.md');

    if (await exists(claudeMdPath)) {
      const existing = await fs.readFile(claudeMdPath, 'utf8');
      const alreadyHas =
        existing.includes('하네스 엔지니어링') || existing.includes('Harness Engineering');
      if (alreadyHas) {
        console.log(`   ${c.yellow('⚠')}  Section already present — skipped`);
      } else {
        await fs.writeFile(claudeMdPath, existing.trimEnd() + '\n\n' + section + '\n');
        console.log(`   ${c.green('✓')}  Appended harness section`);
      }
    } else {
      await fs.writeFile(claudeMdPath, section + '\n');
      console.log(`   ${c.green('✓')}  Created new CLAUDE.md with harness section`);
    }
    console.log();
  }

  // 5. Seed learning log
  if (opts.seedLearningLog) {
    console.log(c.bold('🧠 Seeding learning log'));
    const seedPath = path.join(assets.templates, opts.lang, 'AGENT_LEARNING_LOG.seed.md');
    const seedRaw = await fs.readFile(seedPath, 'utf8');
    const targetLog = path.join(opts.target, context.LEARNING_LOG_PATH!);
    if (await exists(targetLog)) {
      console.log(`   ${c.yellow('⚠')}  ${context.LEARNING_LOG_PATH} already exists — skipped`);
    } else {
      await fs.mkdir(path.dirname(targetLog), { recursive: true });
      await fs.writeFile(targetLog, renderTemplate(seedRaw, context));
      console.log(`   ${c.green('✓')}  ${context.LEARNING_LOG_PATH}`);
    }
    console.log();
  }

  // 6. (Optional) chat-room UI + DB adapters
  if (opts.installTemplate) {
    if (scan.framework.startsWith('Next.js')) {
      console.log(c.bold('💬 Installing chat-room UI'));
      await copyDir(
        path.join(assets.projectTemplate, 'app/admin/harness'),
        path.join(opts.target, 'src/app/admin/harness'),
        opts.yes,
        '   ',
      );
      await copyDir(
        path.join(assets.projectTemplate, 'app/api/harness'),
        path.join(opts.target, 'src/app/api/harness'),
        opts.yes,
        '   ',
      );
      console.log();

      console.log(c.bold('🗄️  Installing DB adapter library'));
      await copyDir(
        path.join(assets.projectTemplate, 'lib/harness-db'),
        path.join(opts.target, 'src/lib/harness-db'),
        opts.yes,
        '   ',
      );
      console.log();

      if (opts.chatBackend === 'supabase') {
        console.log(c.bold('🗄️  Copying Supabase migrations'));
        await copyDir(
          path.join(assets.projectTemplate, 'migrations'),
          path.join(opts.target, 'supabase/migrations'),
          opts.yes,
          '   ',
          /^00010_|^00025_/,
        );
        console.log();
      }

      // SQLite mode: by default, gitignore the local db.
      // `--commit-chat` opts out (solo cross-machine sync via git).
      if (opts.chatBackend === 'sqlite' && !opts.commitChat) {
        await ensureGitignore(opts.target, ['.harness/']);
      }

      printBackendInstructions(opts.chatBackend, opts.commitChat);
    } else {
      console.log(
        `${c.yellow('⚠ Chat-room UI is Next.js only.')} ` +
          c.dim(`Skipping — your stack is detected as ${scan.framework}.`),
      );
      console.log(
        c.dim('   (For non-Next.js stacks, use the agents only — chat-room support is on the roadmap.)'),
      );
      console.log();
    }
  }

  // 7. Final summary
  console.log(c.bold(c.green('✅ Done.')));
  console.log();
  console.log('Next steps:');
  console.log(`   ${c.cyan('1.')} Open Claude Code in this project`);
  console.log(`   ${c.cyan('2.')} Run ${c.bold('/bujang-status')} (if the plugin is installed) or just`);
  console.log(`      ask ${c.bold('"Director, please add a hello-world endpoint"')}`);
  console.log(`   ${c.cyan('3.')} Watch ${c.bold(context.ADMIN_HARNESS_ROUTE!)} for live updates (after env setup)`);
  console.log();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function promptInteractive(
  opts: InitOptions,
  scan: import('./scan.js').ScanResult,
): Promise<InitOptions> {
  const lang = (await select({
    message: 'Agent language',
    choices: [
      { name: 'English', value: 'en' },
      { name: 'Korean — full 부장 persona (한국어)', value: 'ko' },
    ],
    default: opts.lang,
  })) as 'en' | 'ko';

  const chatBackend = (await select({
    message: 'Chat backend',
    choices: [
      { name: 'SQLite — local file, zero setup (recommended)', value: 'sqlite' },
      { name: 'Supabase — cloud Postgres for team sharing', value: 'supabase' },
    ],
    default: opts.chatBackend,
  })) as ChatBackend;

  let installTemplate = opts.installTemplate;
  if (scan.framework.startsWith('Next.js') && opts.installTemplate) {
    installTemplate = await confirm({
      message: 'Install chat-room UI (Next.js admin route at /admin/harness)?',
      default: true,
    });
  }

  return { ...opts, lang, chatBackend, installTemplate };
}

function parseArgs(args: string[]): InitOptions {
  const lang = (getFlag(args, '--lang') ?? 'en') as 'ko' | 'en';
  if (!['ko', 'en'].includes(lang)) {
    throw new Error(`--lang must be "ko" or "en", got "${lang}"`);
  }
  const chatBackend = (getFlag(args, '--chat') ?? 'sqlite') as ChatBackend;
  if (!['sqlite', 'supabase'].includes(chatBackend)) {
    throw new Error(`--chat must be "sqlite" or "supabase", got "${chatBackend}"`);
  }
  const targetRaw = getFlag(args, '--target') ?? '.';
  return {
    lang,
    target:           path.resolve(targetRaw),
    framework:        getFlag(args, '--framework'),
    db:               getFlag(args, '--db'),
    chatBackend,
    commitChat:       args.includes('--commit-chat'),
    installTemplate:  !args.includes('--no-template'),
    editClaudeMd:     !args.includes('--no-claude-md'),
    seedLearningLog:  !args.includes('--no-learning-log'),
    yes:              args.includes('--yes') || args.includes('-y'),
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

async function isExistingInstall(target: string): Promise<boolean> {
  const probes = [
    path.join(target, '.claude/agents/director.md'),
    path.join(target, '.claude/agents/dev-team.md'),
  ];
  for (const p of probes) {
    if (await exists(p)) return true;
  }
  return false;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(
  src: string,
  dst: string,
  overwrite: boolean,
  indent: string,
  filter?: RegExp,
): Promise<void> {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    if (filter && !e.isDirectory() && !filter.test(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d, overwrite, indent, filter);
    } else {
      if ((await exists(d)) && !overwrite) {
        console.log(`${indent}${c.yellow('⚠')}  ${path.relative(process.cwd(), d)} ${c.dim('(exists, skipped)')}`);
        continue;
      }
      await fs.copyFile(s, d);
      console.log(`${indent}${c.green('✓')}  ${path.relative(process.cwd(), d)}`);
    }
  }
}

async function ensureGitignore(target: string, lines: string[]): Promise<void> {
  const gitignorePath = path.join(target, '.gitignore');
  let existing = '';
  if (await exists(gitignorePath)) {
    existing = await fs.readFile(gitignorePath, 'utf8');
  }
  const toAdd = lines.filter((l) => !existing.split('\n').some((e) => e.trim() === l.trim()));
  if (toAdd.length === 0) return;

  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  const block = `${sep}\n# Harness-Bujang local chat database\n${toAdd.join('\n')}\n`;
  await fs.writeFile(gitignorePath, existing + block);
}

function printBackendInstructions(backend: ChatBackend, commitChat: boolean): void {
  if (backend === 'sqlite') {
    console.log(c.bold(c.cyan('📋 SQLite mode (default) — next steps:')));
    console.log();
    console.log(`   ${c.bold('1.')} Install the SQLite driver in your project:`);
    console.log(`      ${c.dim('$')} ${c.bold('npm i better-sqlite3')}`);
    console.log(`      ${c.dim('$')} ${c.bold('npm i -D @types/better-sqlite3')}`);
    console.log();
    console.log(`   ${c.bold('2.')} (optional) Add to ${c.bold('.env.local')}:`);
    console.log(`      ${c.dim('HARNESS_DB=sqlite                  # default — can be omitted')}`);
    console.log(`      ${c.dim('HARNESS_SQLITE_PATH=./.harness/chat.db    # default — can be omitted')}`);
    console.log(`      ${c.bold('HARNESS_WRITE_SECRET=<random>     # for bot/script writes')}`);
    console.log(`      ${c.bold('SUPER_ADMIN_EMAILS=you@example.com # comma-separated')}`);
    console.log();
    console.log(`   ${c.bold('3.')} Run your dev server and visit ${c.bold('/admin/harness')}.`);
    console.log();
    if (commitChat) {
      console.log(c.dim(`   📦 ${c.bold('--commit-chat')} mode: .harness/ NOT added to .gitignore.`));
      console.log(c.dim(`      Commit chat.db to sync history across YOUR OWN machines.`));
      console.log(c.dim(`      ⚠ Do NOT use this with multiple collaborators — binary files don't merge.`));
      console.log(c.dim(`      For team sharing, use --chat=supabase or "bujang migrate --to=supabase".`));
    } else {
      console.log(c.dim(`   When you're ready for team / prod sharing, run:`));
      console.log(c.dim(`      $ bujang migrate --to=supabase`));
    }
  } else {
    console.log(c.bold(c.cyan('📋 Supabase mode — next steps:')));
    console.log();
    console.log(`   ${c.bold('1.')} Apply the migrations to your Supabase project:`);
    console.log(`      ${c.dim('$')} ${c.bold('supabase db push')}`);
    console.log(`      ${c.dim('   (or run them manually via psql / SQL editor)')}`);
    console.log();
    console.log(`   ${c.bold('2.')} Add to ${c.bold('.env.local')}:`);
    console.log(`      ${c.bold('HARNESS_DB=supabase')}`);
    console.log(`      ${c.bold('NEXT_PUBLIC_SUPABASE_URL=...')}`);
    console.log(`      ${c.bold('SUPABASE_SERVICE_ROLE_KEY=...')}`);
    console.log(`      ${c.bold('HARNESS_WRITE_SECRET=<random>')}`);
    console.log(`      ${c.bold('SUPER_ADMIN_EMAILS=you@example.com')}`);
    console.log();
    console.log(`   ${c.bold('3.')} Implement ${c.bold('verifySuperAdmin()')} at ${c.bold('@/lib/utils/admin')}`);
    console.log(`      (see ${c.dim('packages/template/README.md')} for an example).`);
    console.log();
    console.log(`   ${c.bold('4.')} Run your dev server and visit ${c.bold('/admin/harness')}.`);
  }
  console.log();
}

function stackReviewRules(framework: string): string {
  if (framework.startsWith('Next.js')) {
    return `Next.js App Router rules:
  - Avoid unnecessary 'use client' (prefer Server Components)
  - Radix UI hydration: Sheet/Dialog need a 'mounted' guard
  - Hook dependency arrays must be exact
  - Dynamic params: \`Promise<{ id: string }>\` + await`;
  }
  if (framework === 'SvelteKit' || framework === 'Astro' || framework === 'Nuxt') {
    return `${framework} rules: prefer SSR by default, use client islands only when interactive.`;
  }
  return 'Project conventions: see root CLAUDE.md.';
}
