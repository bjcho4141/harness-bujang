import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, confirm, checkbox } from '@inquirer/prompts';
import { scanProject } from './scan.js';
import { renderTemplate } from './template.js';

// 0.9.0: admin route + Next.js auto-config stripped. The chat room is now
// served only by `bujang chat` (standalone localhost viewer) — we no longer
// copy `app/admin/harness/`, `app/api/harness/`, `lib/harness-db/` into the
// user's project, and no longer touch `next.config.*` / install native peer
// deps / scaffold `.env.local`. Zero project intrusion.

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
  mode: 'packaged' | 'monorepo';
}

/**
 * Locate the bundled assets. Two layouts are supported:
 *
 *   1. **Packaged** (after `npm install harness-bujang`):
 *      `<package>/dist/index.js` runs alongside `<package>/templates/` which
 *      was copied from `shared/` at build time.
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
      `  - ${sharedDir}\n` +
      `If installed via npm, try reinstalling. If running from source, ` +
      `run "npm run build" in packages/cli first.`,
  );
}

type AdapterTarget = 'cursor' | 'cline' | 'aider' | 'codex' | 'gemini';
type ModelTier = 'opus' | 'sonnet' | 'haiku';
type ModelPreset = 'balanced' | 'cost' | 'quality' | 'keep' | 'custom';

const ALL_ADAPTERS: AdapterTarget[] = ['cursor', 'cline', 'aider', 'codex', 'gemini'];

/**
 * Per-tool model recommendations. Codex/Gemini get the same 5-preset UI as
 * Claude (balanced / keep / cost / quality / custom) — consistent UX across
 * tools. The result is written as a per-agent "💡 Recommended: <model>" memo
 * inside AGENTS.md / GEMINI.md (the tool itself doesn't enforce, but it's a
 * concrete guide for users running each role).
 *
 * Aider is the only non-Claude tool with a real model field (.aider.conf.yml),
 * but it's a SINGLE value (Aider runs one model at a time) — no per-agent
 * preset makes sense. We keep Aider as a single-model picker.
 */
type CodexModel  = 'gpt-5' | 'gpt-5-codex' | 'gpt-4-turbo' | 'o1' | 'o1-mini';
type GeminiModel = 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-2.0-pro' | 'gemini-2.0-flash';
type AiderModel  = 'claude-opus-4-7' | 'claude-sonnet-4-6' | 'gpt-5' | 'gemini-2.5-pro' | '(skip)';

/** Codex balanced mapping — gpt-5 for big decisions, gpt-5-codex for coding,
 *  o1 for reasoning-heavy audits, gpt-4-turbo for execution / verification. */
const CODEX_BALANCED: Record<string, CodexModel> = {
  director:           'gpt-5',
  cofounder:          'gpt-5',
  'architect-team':   'gpt-5',
  consultant:         'gpt-5',
  'security-team':    'o1',
  'db-guard-team':    'o1',
  'dev-team':         'gpt-5-codex',
  'code-review-team': 'gpt-5-codex',
  'qa-team':          'gpt-4-turbo',
  'verifier-team':    'gpt-4-turbo',
  'doc-sync-team':    'gpt-4-turbo',
  'research-team':    'gpt-5',
  'analysis-team':    'gpt-5',
  'script-team':      'gpt-4-turbo',
  'image-team':       'o1-mini',
  'voice-team':       'o1-mini',
  'edit-team':        'o1-mini',
  'content-qa-team':  'o1-mini',
};

/** Gemini balanced — pro for big decisions / analysis, flash for fast loops. */
const GEMINI_BALANCED: Record<string, GeminiModel> = {
  director:           'gemini-2.5-pro',
  cofounder:          'gemini-2.5-pro',
  'architect-team':   'gemini-2.5-pro',
  consultant:         'gemini-2.5-pro',
  'security-team':    'gemini-2.5-pro',
  'db-guard-team':    'gemini-2.5-pro',
  'dev-team':         'gemini-2.5-pro',
  'code-review-team': 'gemini-2.5-pro',
  'qa-team':          'gemini-2.5-flash',
  'verifier-team':    'gemini-2.5-flash',
  'doc-sync-team':    'gemini-2.5-flash',
  'research-team':    'gemini-2.5-pro',
  'analysis-team':    'gemini-2.5-pro',
  'script-team':      'gemini-2.5-flash',
  'image-team':       'gemini-2.5-flash',
  'voice-team':       'gemini-2.5-flash',
  'edit-team':        'gemini-2.5-flash',
  'content-qa-team':  'gemini-2.5-flash',
};

function resolveCodexPreset(preset: Exclude<ModelPreset, 'custom'>): Record<string, CodexModel> {
  if (preset === 'keep') return {};
  if (preset === 'balanced') return { ...CODEX_BALANCED };
  const tier: CodexModel = preset === 'cost' ? 'gpt-4-turbo' : 'gpt-5';
  const out: Record<string, CodexModel> = {};
  for (const k of Object.keys(CODEX_BALANCED)) out[k] = tier;
  return out;
}

function resolveGeminiPreset(preset: Exclude<ModelPreset, 'custom'>): Record<string, GeminiModel> {
  if (preset === 'keep') return {};
  if (preset === 'balanced') return { ...GEMINI_BALANCED };
  const tier: GeminiModel = preset === 'cost' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
  const out: Record<string, GeminiModel> = {};
  for (const k of Object.keys(GEMINI_BALANCED)) out[k] = tier;
  return out;
}

/**
 * Balanced cost/quality mapping. Heavyweight thinkers on opus, executors on
 * sonnet, fast/repetitive tasks on haiku. Picked for ~60-70% cost reduction
 * vs the all-opus baseline that ships in `shared/agents/`.
 */
const BALANCED_MAPPING: Record<string, ModelTier> = {
  director:           'opus',
  cofounder:          'opus',
  'architect-team':   'opus',
  consultant:         'opus',
  'security-team':    'opus',
  'db-guard-team':    'opus',
  'dev-team':         'sonnet',
  'code-review-team': 'sonnet',
  'qa-team':          'sonnet',
  'doc-sync-team':    'sonnet',
  'research-team':    'sonnet',
  'analysis-team':    'sonnet',
  'script-team':      'sonnet',
  'verifier-team':    'haiku',
  'image-team':       'haiku',
  'voice-team':       'haiku',
  'edit-team':        'haiku',
  'content-qa-team':  'haiku',
};

interface InitOptions {
  lang: 'ko' | 'en';
  target: string;
  framework?: string;
  db?: string;
  editClaudeMd: boolean;
  seedLearningLog: boolean;
  yes: boolean;
  /**
   * Extra tool adapters to install after `.claude/agents/` (the SoT) lands.
   * Claude Code agents are always installed; this controls Cursor / Cline /
   * Aider / Codex / Gemini fan-out.
   */
  adapters: AdapterTarget[];
  /**
   * Per-agent Claude model override. Empty object = leave each agent's
   * frontmatter `model:` field untouched (the values shipped in shared/).
   * Populated map = rewrite frontmatter `model:` lines on copy.
   */
  modelMap: Record<string, ModelTier>;
  /**
   * 0.8.0: per-tool model maps (per-agent, like Claude's modelMap). Empty
   * object = "keep" preset (no memo written).
   */
  codexModelMap?:  Record<string, CodexModel>;
  geminiModelMap?: Record<string, GeminiModel>;
  /** Aider has a SINGLE model field (.aider.conf.yml) — no per-agent map. */
  aiderModel?:  AiderModel;
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
      opts = await promptInteractive(opts);

      // If a previous install is detected, ask whether to overwrite. Without this,
      // a user picking (say) Korean on a project that already has English agents
      // would see all files skipped — their selection silently ignored.
      if (await isExistingInstall(opts.target)) {
        const overwrite = await confirm({
          message: '기존 하네스 설치가 감지되었습니다. 선택한 설정을 적용하기 위해 모든 파일을 덮어쓸까요?',
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
  console.log(c.dim(`   Tools:         claude${opts.adapters.length > 0 ? ` + ${opts.adapters.join(', ')}` : ' (only)'}`));
  console.log(c.dim(`   Claude models: ${describeModelMap(opts.modelMap)}`));
  if (opts.codexModelMap)  console.log(c.dim(`   Codex models:  ${describeAnyMap(opts.codexModelMap)}`));
  if (opts.geminiModelMap) console.log(c.dim(`   Gemini models: ${describeAnyMap(opts.geminiModelMap)}`));
  if (opts.aiderModel  && opts.aiderModel  !== '(skip)') console.log(c.dim(`   Aider model:   ${opts.aiderModel} (.aider.conf.yml)`));
  console.log(c.dim(`   On conflict:   ${opts.yes ? 'overwrite' : 'skip existing files'}`));
  console.log();

  if (interactive) {
    try {
      const proceed = await confirm({ message: '이 설정으로 진행할까요?', default: true });
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

  // 3. Copy agents (with optional per-agent model frontmatter override)
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
    const slug = f.replace(/\.md$/, '');
    const override = opts.modelMap[slug];
    const rendered = renderTemplate(raw, context);
    const final = override ? overrideModelFrontmatter(rendered, override) : rendered;
    await fs.writeFile(dst, final);
    console.log(`   ${c.green('✓')}  ${f}${override ? c.dim(`  → model: ${override}`) : ''}`);
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

  // 6. Run adapters for any extra tools the user picked. .claude/agents/ is
  //    the SoT, so we always have the source ready by this point.
  if (opts.adapters.length > 0) {
    console.log(c.bold('🔁 Fanning out to extra tool adapters'));
    console.log(c.dim(`   Targets: ${opts.adapters.join(', ')}`));
    const { runAdapt } = await import('./adapt.js');
    await runAdapt([
      `--to=${opts.adapters.join(',')}`,
      `--target=${opts.target}`,
      '--yes',
    ]);

    // 6.6 (0.8.0) — apply per-tool model recommendations to the adapter outputs.
    if (opts.codexModelMap  && Object.keys(opts.codexModelMap).length > 0)  await injectCodexModelMemos(opts.target, opts.codexModelMap);
    if (opts.geminiModelMap && Object.keys(opts.geminiModelMap).length > 0) await injectGeminiModelMemos(opts.target, opts.geminiModelMap);
    if (opts.aiderModel  && opts.aiderModel  !== '(skip)') await setAiderModel(opts.target, opts.aiderModel);
  }

  // 7. Final summary
  console.log(c.bold(c.green('✅ Done.')));
  console.log();
  printRestartReminder(opts.lang);
  printNextSteps(opts.lang);
}

// ---------------------------------------------------------------------------
// Cross-cutting reminder used by `init` AND `update` — printed last so users
// can't miss it. Claude Code only scans `.claude/agents/` at session start, so
// any newly-added or modified agents won't be visible to the Agent tool until
// the user reloads them.
// ---------------------------------------------------------------------------

export function printRestartReminder(lang: 'ko' | 'en'): void {
  const ko = lang === 'ko';
  const line = (s: string) => `   ${c.dim('│')} ${s}`;
  const top = `   ${c.dim('╭' + '─'.repeat(64) + '╮')}`;
  const bot = `   ${c.dim('╰' + '─'.repeat(64) + '╯')}`;
  console.log(top);
  console.log(line(ko
    ? c.bold(c.yellow('⚠️  STEP 1 — 실행 중인 Claude Code 종료 후 재시작'))
    : c.bold(c.yellow('⚠️  STEP 1 — Quit Claude Code and relaunch'))));
  console.log(line(c.dim(ko
    ? '(지금 세션은 새 에이전트를 못 봅니다)'
    : '(the running session cannot see the new agents)')));
  console.log(bot);
  console.log();
}

/**
 * 0.9.0: Step 2 단순화. `/open-chat` 슬래시 커맨드는 plugin 재설치 안 한
 * 사용자에게는 안 보이므로, 가장 안정적인 두 경로 (자연어 → 부장, 또는
 * 터미널 직접 실행) 를 먼저 안내.
 */
function printNextSteps(lang: 'ko' | 'en'): void {
  const ko = lang === 'ko';
  const line = (s: string) => `   ${c.dim('│')} ${s}`;
  const top = `   ${c.dim('╭' + '─'.repeat(64) + '╮')}`;
  const bot = `   ${c.dim('╰' + '─'.repeat(64) + '╯')}`;
  console.log(top);
  console.log(line(c.bold(c.green(ko
    ? '✨ STEP 2 — 톡방 열기'
    : '✨ STEP 2 — Open the chat room'))));
  console.log(line(''));
  console.log(line(`  ${c.bold(ko ? 'Claude Code 안에서:  ' : 'Inside Claude Code: ')}${c.cyan(ko ? '"부장님, 톡방 열어주세요"' : '"Director, open the chat room"')}`));
  console.log(line(`  ${c.bold(ko ? '또는 별도 터미널에서:' : 'Or in a terminal:    ')} ${c.cyan('npx harness-bujang chat')}`));
  console.log(line(c.dim('  → http://localhost:7777')));
  console.log(bot);
  console.log();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function promptInteractive(opts: InitOptions): Promise<InitOptions> {
  const lang = (await select({
    message: '에이전트 언어 / Agent language',
    choices: [
      { name: '한국어 — 부장 페르소나 풀 (Korean)', value: 'ko' },
      { name: 'English — Director persona',         value: 'en' },
    ],
    default: opts.lang,
  })) as 'en' | 'ko';

  // Tool adapters — Claude Code is the SoT (always installed) but it's now
  // toggleable in the prompt so users can see it. Even if unchecked, the
  // .claude/agents/ folder still gets installed (needed for adapter conversion);
  // we just print a hint at the end of init telling the user it's there as
  // an SoT for future adapter refreshes.
  const isPreset = (t: AdapterTarget) => opts.adapters.includes(t);
  const adaptersRaw = (await checkbox({
    message: '도구 선택 — 체크된 도구만 셋업됩니다. (.claude/agents/ 는 어댑터 SoT 라 항상 깔립니다)',
    choices: [
      { name: 'Claude Code     (.claude/agents/)',                            value: 'claude', checked: true },
      { name: 'Cursor          (.cursor/rules/bujang-*.mdc)',                value: 'cursor', checked: isPreset('cursor') },
      { name: 'Codex / Copilot (AGENTS.md)',                                  value: 'codex',  checked: isPreset('codex')  },
      { name: 'Cline           (.clinerules/bujang-*.md)',                    value: 'cline',  checked: isPreset('cline')  },
      { name: 'Aider           (CONVENTIONS.md + .aider.conf.yml)',           value: 'aider',  checked: isPreset('aider')  },
      { name: 'Gemini / Antigravity (GEMINI.md + .gemini/styleguide.md)',     value: 'gemini', checked: isPreset('gemini') },
    ],
    required: false,
  })) as Array<AdapterTarget | 'claude'>;
  const claudeChecked = adaptersRaw.includes('claude');
  // 'claude' is informational only — it doesn't go into adapters[] (which
  // drives the adapter fan-out for non-Claude tools).
  const adapters = adaptersRaw.filter((t): t is AdapterTarget => t !== 'claude');

  // ---- Per-tool model prompts ---------------------------------------------
  // Each tool gets its own model prompt — only when that tool was checked.
  // Claude / Aider model fields are actually enforced by the tool. Codex /
  // Gemini get written as a memo line inside AGENTS.md / GEMINI.md (a guide,
  // since those tools don't read a model: field from those files).

  // 1. Claude — only if Claude Code is checked
  let modelMap: Record<string, ModelTier> = {};
  if (claudeChecked) {
    const preset = (await select({
      message: '🟣 Claude 에이전트 모델 매핑? [.claude/agents/ frontmatter 에 박힘 — Claude Code 가 진짜 적용]',
      choices: [
        { name: 'balanced — opus / sonnet / haiku 균형 매핑 (추천, 비용 ~60% 절감)', value: 'balanced' },
        { name: 'keep     — 각 에이전트 기본 모델 그대로',                            value: 'keep'     },
        { name: 'cost     — 전부 haiku (가장 저렴, 빠름)',                            value: 'cost'     },
        { name: 'quality  — 전부 opus (가장 비싸고, 품질 최상)',                       value: 'quality'  },
        { name: 'custom   — 에이전트별 직접 선택 (18개 prompt)',                      value: 'custom'   },
      ],
      default: 'balanced',
    })) as ModelPreset;
    modelMap = preset === 'custom' ? await promptCustomModelMap() : resolvePreset(preset);
  }

  // 2. Codex — only if Codex is checked. Same 5-preset UX as Claude.
  let codexModelMap: Record<string, CodexModel> | undefined;
  if (adapters.includes('codex')) {
    const preset = (await select({
      message: '🟢 Codex 에이전트 모델 매핑? [AGENTS.md 의 각 에이전트 섹션에 메모로 박힘 — 가이드용]',
      choices: [
        { name: 'balanced — gpt-5 / gpt-5-codex / o1 / gpt-4-turbo 역할별 매핑 (추천)',  value: 'balanced' },
        { name: 'keep     — 메모 안 박음 (사용자가 코덱스 안에서 픽)',                     value: 'keep'     },
        { name: 'cost     — 전부 gpt-4-turbo (가장 저렴)',                                 value: 'cost'     },
        { name: 'quality  — 전부 gpt-5 (가장 똑똑)',                                       value: 'quality'  },
        { name: 'custom   — 에이전트별 직접 선택 (18개 prompt)',                            value: 'custom'   },
      ],
      default: 'balanced',
    })) as ModelPreset;
    codexModelMap = preset === 'custom'
      ? await promptCustomCodexMap()
      : resolveCodexPreset(preset);
  }

  // 3. Gemini — only if Gemini is checked. Same 5-preset UX.
  let geminiModelMap: Record<string, GeminiModel> | undefined;
  if (adapters.includes('gemini')) {
    const preset = (await select({
      message: '🔵 Gemini 에이전트 모델 매핑? [GEMINI.md 의 각 에이전트 섹션에 메모로 박힘 — 가이드용]',
      choices: [
        { name: 'balanced — pro / flash 역할별 매핑 (추천)',                value: 'balanced' },
        { name: 'keep     — 메모 안 박음 (Gemini 도구 안에서 픽)',           value: 'keep'     },
        { name: 'cost     — 전부 gemini-2.5-flash (가장 빠르고 저렴)',       value: 'cost'     },
        { name: 'quality  — 전부 gemini-2.5-pro (가장 똑똑)',                value: 'quality'  },
        { name: 'custom   — 에이전트별 직접 선택 (18개 prompt)',              value: 'custom'   },
      ],
      default: 'balanced',
    })) as ModelPreset;
    geminiModelMap = preset === 'custom'
      ? await promptCustomGeminiMap()
      : resolveGeminiPreset(preset);
  }

  // 4. Aider — only if Aider is checked
  let aiderModel: AiderModel | undefined;
  if (adapters.includes('aider')) {
    aiderModel = (await select({
      message: '🟡 Aider 모델? [.aider.conf.yml 의 model 필드에 박힘 — Aider 가 시작 시 진짜 적용]',
      choices: [
        { name: 'claude-opus-4-7    (최고 품질)',                value: 'claude-opus-4-7'   },
        { name: 'claude-sonnet-4-6  (균형)',                     value: 'claude-sonnet-4-6' },
        { name: 'gpt-5              (OpenAI 최신)',              value: 'gpt-5'             },
        { name: 'gemini-2.5-pro     (Google 최신)',              value: 'gemini-2.5-pro'    },
        { name: '(skip)             (model 필드 안 박음)',         value: '(skip)'            },
      ],
      default: 'claude-sonnet-4-6',
    })) as AiderModel;
  }

  return {
    ...opts,
    lang, adapters, modelMap,
    codexModelMap, geminiModelMap, aiderModel,
  };
}

async function promptCustomCodexMap(): Promise<Record<string, CodexModel>> {
  const out: Record<string, CodexModel> = {};
  const slugs = Object.keys(CODEX_BALANCED);
  console.log();
  console.log(c.dim(`   Codex custom 매핑 — ${slugs.length}개 에이전트마다 모델을 선택해주세요.`));
  for (const slug of slugs) {
    const tier = (await select({
      message: `${slug.padEnd(20)}`,
      choices: [
        { name: 'gpt-5         (최신, 큰 결정)',     value: 'gpt-5'        },
        { name: 'gpt-5-codex   (코딩 특화)',         value: 'gpt-5-codex'  },
        { name: 'gpt-4-turbo  (균형)',              value: 'gpt-4-turbo'  },
        { name: 'o1            (추론 특화)',          value: 'o1'           },
        { name: 'o1-mini       (가벼운, 빠름)',      value: 'o1-mini'      },
      ],
      default: CODEX_BALANCED[slug] ?? 'gpt-4-turbo',
    })) as CodexModel;
    out[slug] = tier;
  }
  return out;
}

async function promptCustomGeminiMap(): Promise<Record<string, GeminiModel>> {
  const out: Record<string, GeminiModel> = {};
  const slugs = Object.keys(GEMINI_BALANCED);
  console.log();
  console.log(c.dim(`   Gemini custom 매핑 — ${slugs.length}개 에이전트마다 모델을 선택해주세요.`));
  for (const slug of slugs) {
    const tier = (await select({
      message: `${slug.padEnd(20)}`,
      choices: [
        { name: 'gemini-2.5-pro     (최신, 가장 똑똑)',  value: 'gemini-2.5-pro'   },
        { name: 'gemini-2.5-flash   (빠르고 저렴)',      value: 'gemini-2.5-flash' },
        { name: 'gemini-2.0-pro',                       value: 'gemini-2.0-pro'   },
        { name: 'gemini-2.0-flash',                     value: 'gemini-2.0-flash' },
      ],
      default: GEMINI_BALANCED[slug] ?? 'gemini-2.5-flash',
    })) as GeminiModel;
    out[slug] = tier;
  }
  return out;
}

async function promptCustomModelMap(): Promise<Record<string, ModelTier>> {
  const out: Record<string, ModelTier> = {};
  const slugs = Object.keys(BALANCED_MAPPING);
  console.log();
  console.log(c.dim(`   Custom 매핑 — ${slugs.length}개 에이전트마다 모델을 선택해주세요.`));
  for (const slug of slugs) {
    const tier = (await select({
      message: `${slug.padEnd(20)}`,
      choices: [
        { name: 'opus   (가장 똑똑, 비싼)',        value: 'opus'   },
        { name: 'sonnet (균형)',                   value: 'sonnet' },
        { name: 'haiku  (가장 빠르고 저렴)',         value: 'haiku'  },
      ],
      default: BALANCED_MAPPING[slug] ?? 'sonnet',
    })) as ModelTier;
    out[slug] = tier;
  }
  return out;
}

function parseArgs(args: string[]): InitOptions {
  const lang = (getFlag(args, '--lang') ?? 'ko') as 'ko' | 'en';
  if (!['ko', 'en'].includes(lang)) {
    throw new Error(`--lang must be "ko" or "en", got "${lang}"`);
  }
  const targetRaw = getFlag(args, '--target') ?? '.';

  // --tools=cursor,codex   or   --tools=all   (Claude Code is always implied)
  const toolsRaw = getFlag(args, '--tools');
  let adapters: AdapterTarget[] = [];
  if (toolsRaw) {
    const parts = toolsRaw === 'all'
      ? ALL_ADAPTERS.slice()
      : toolsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    for (const t of parts) {
      // "claude" is a no-op (Claude Code is always installed) — accept silently
      if (t === 'claude' || t === 'claude-code') continue;
      if (!ALL_ADAPTERS.includes(t as AdapterTarget)) {
        throw new Error(
          `Unknown tool "${t}" in --tools. Allowed: claude, ${ALL_ADAPTERS.join(', ')}, all`,
        );
      }
      if (!adapters.includes(t as AdapterTarget)) adapters.push(t as AdapterTarget);
    }
  }

  // --models=balanced | cost | quality | keep   (no `custom` from CLI — interactive only)
  const modelsRaw = getFlag(args, '--models') as ModelPreset | undefined;
  let modelMap: Record<string, ModelTier> = {};
  if (modelsRaw) {
    if (!['balanced', 'cost', 'quality', 'keep'].includes(modelsRaw)) {
      throw new Error(
        `--models must be one of: balanced, cost, quality, keep (got "${modelsRaw}")`,
      );
    }
    modelMap = resolvePreset(modelsRaw as Exclude<ModelPreset, 'custom'>);
  }

  // 0.8.0: per-tool model presets (CI-mode flags). Same 4 presets as
  // --models for Claude (balanced/keep/cost/quality — no `custom` from CLI).
  // Aider is single-value so it accepts the model name directly.
  const codexPresetRaw  = getFlag(args, '--codex-models');
  const geminiPresetRaw = getFlag(args, '--gemini-models');
  let codexModelMap:  Record<string, CodexModel>  | undefined;
  let geminiModelMap: Record<string, GeminiModel> | undefined;
  if (codexPresetRaw) {
    if (!['balanced', 'cost', 'quality', 'keep'].includes(codexPresetRaw)) {
      throw new Error(`--codex-models must be one of: balanced, cost, quality, keep (got "${codexPresetRaw}")`);
    }
    codexModelMap = resolveCodexPreset(codexPresetRaw as Exclude<ModelPreset, 'custom'>);
  }
  if (geminiPresetRaw) {
    if (!['balanced', 'cost', 'quality', 'keep'].includes(geminiPresetRaw)) {
      throw new Error(`--gemini-models must be one of: balanced, cost, quality, keep (got "${geminiPresetRaw}")`);
    }
    geminiModelMap = resolveGeminiPreset(geminiPresetRaw as Exclude<ModelPreset, 'custom'>);
  }
  const aiderModel = getFlag(args, '--aider-model') as AiderModel | undefined;

  return {
    lang,
    target:           path.resolve(targetRaw),
    framework:        getFlag(args, '--framework'),
    db:               getFlag(args, '--db'),
    editClaudeMd:     !args.includes('--no-claude-md'),
    seedLearningLog:  !args.includes('--no-learning-log'),
    yes:              args.includes('--yes') || args.includes('-y'),
    adapters,
    modelMap,
    codexModelMap,
    geminiModelMap,
    aiderModel,
  };
}

function resolvePreset(preset: Exclude<ModelPreset, 'custom'>): Record<string, ModelTier> {
  if (preset === 'keep') return {};
  if (preset === 'balanced') return { ...BALANCED_MAPPING };
  const tier: ModelTier = preset === 'cost' ? 'haiku' : 'opus';
  const out: Record<string, ModelTier> = {};
  for (const k of Object.keys(BALANCED_MAPPING)) out[k] = tier;
  return out;
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


/**
 * 0.8.0: write a "💡 Recommended model: <name>" memo above EACH agent
 * section (`## <slug>` headers) in AGENTS.md / GEMINI.md. The tool itself
 * doesn't enforce — but users running each role can see the recommendation.
 */
async function injectCodexModelMemos(target: string, modelMap: Record<string, string>): Promise<void> {
  const fp = path.join(target, 'AGENTS.md');
  if (!(await exists(fp))) return;
  const raw = await fs.readFile(fp, 'utf8');
  const updated = injectPerAgentMemos(raw, modelMap, '코덱스 / Copilot 안에서 이 모델로 작업');
  await fs.writeFile(fp, updated);
  const count = Object.keys(modelMap).length;
  console.log(c.dim(`   ✓ AGENTS.md ← Codex 권장 모델 메모 ${count}건 (각 에이전트 섹션 위)`));
}

async function injectGeminiModelMemos(target: string, modelMap: Record<string, string>): Promise<void> {
  const fp = path.join(target, 'GEMINI.md');
  if (!(await exists(fp))) return;
  const raw = await fs.readFile(fp, 'utf8');
  const updated = injectPerAgentMemos(raw, modelMap, 'Gemini CLI / Antigravity 안에서 이 모델로 작업');
  await fs.writeFile(fp, updated);
  const count = Object.keys(modelMap).length;
  console.log(c.dim(`   ✓ GEMINI.md ← Gemini 권장 모델 메모 ${count}건 (각 에이전트 섹션 위)`));
}

/**
 * Walk the markdown looking for `## <slug>` lines and inject a memo line
 * just before each one (only if a recommendation exists for that slug).
 * Idempotent — if a memo for the same slug is already present, skip it.
 */
function injectPerAgentMemos(raw: string, modelMap: Record<string, string>, hint: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = /^##\s+([a-z][a-z0-9-]*)\s*$/.exec(line);
    if (m) {
      const slug = m[1]!;
      const model = modelMap[slug];
      // Skip if the previous out-line is already a "💡 Recommended" memo
      // for this same agent (idempotency on re-runs).
      const prev = out[out.length - 1] ?? '';
      if (model && !prev.includes('💡 Recommended')) {
        out.push(`> 💡 Recommended model: \`${model}\` — ${hint}`);
        out.push('');
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * 0.8.0: append `model: <name>` to .aider.conf.yml. Aider actually reads this
 * field on startup — unlike Codex/Gemini memos, this is enforced by the tool.
 */
async function setAiderModel(target: string, model: string): Promise<void> {
  const fp = path.join(target, '.aider.conf.yml');
  if (!(await exists(fp))) return;
  let raw = await fs.readFile(fp, 'utf8');
  if (/^model:\s*\S+/m.test(raw)) {
    raw = raw.replace(/^model:\s*\S+/m, `model: ${model}`);
  } else {
    raw = raw.trimEnd() + `\n# Added by harness-bujang init\nmodel: ${model}\n`;
  }
  await fs.writeFile(fp, raw);
  console.log(c.dim(`   ✓ .aider.conf.yml ← model: ${model}`));
}

/**
 * Replace the `model:` line inside the YAML frontmatter only. The agent body
 * may legitimately contain "model:" in prose, so we scope the replacement to
 * the leading `---\n…\n---` block.
 */
function overrideModelFrontmatter(content: string, model: ModelTier): string {
  if (!content.startsWith('---\n')) return content;
  const end = content.indexOf('\n---\n', 4);
  if (end < 0) return content;
  const fmRaw = content.slice(0, end);
  const rest = content.slice(end);
  const newFm = /^model:\s*\S+/m.test(fmRaw)
    ? fmRaw.replace(/^model:\s*\S+/m, `model: ${model}`)
    : fmRaw + `\nmodel: ${model}`;
  return newFm + rest;
}

function describeModelMap(map: Record<string, ModelTier>): string {
  if (Object.keys(map).length === 0) return 'keep (use each agent\'s default)';
  const counts: Record<ModelTier, number> = { opus: 0, sonnet: 0, haiku: 0 };
  for (const v of Object.values(map)) counts[v]++;
  const parts: string[] = [];
  for (const tier of ['opus', 'sonnet', 'haiku'] as const) {
    if (counts[tier] > 0) parts.push(`${counts[tier]} ${tier}`);
  }
  return parts.join(' · ');
}

/** Generic counter for non-Claude maps (any model name). */
function describeAnyMap(map: Record<string, string>): string {
  if (Object.keys(map).length === 0) return 'keep (메모 안 박음)';
  const counts: Record<string, number> = {};
  for (const v of Object.values(map)) counts[v] = (counts[v] ?? 0) + 1;
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([model, n]) => `${n} ${model}`);
  return parts.join(' · ');
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
