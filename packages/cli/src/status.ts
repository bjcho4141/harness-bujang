import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { countUnfilled } from './template.js';

const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
};

const CANONICAL_AGENTS = [
  'director',
  'consultant',
  'dev-team',
  'architect-team',
  'doc-sync-team',
  'code-review-team',
  'security-team',
  'db-guard-team',
  'qa-team',
  'verifier-team',
];

export async function runStatus(args: string[]): Promise<void> {
  const target = path.resolve(args.find((a) => !a.startsWith('--')) ?? '.');

  console.log();
  console.log(c.bold(`📋 Harness-Bujang status — ${path.basename(target)}`));
  console.log(c.dim(`   ${target}`));
  console.log();

  let healthy = 0;
  let total = 0;

  // 1. Agents
  console.log(c.bold('Agents'));
  const agentsDir = path.join(target, '.claude/agents');
  const agentsExists = await exists(agentsDir);
  if (!agentsExists) {
    console.log(`   ${c.red('✖')}  .claude/agents/ not found`);
    total++;
  } else {
    const found = (await fs.readdir(agentsDir)).filter((f) => f.endsWith('.md'));
    for (const name of CANONICAL_AGENTS) {
      total++;
      const file = `${name}.md`;
      if (!found.includes(file)) {
        console.log(`   ${c.red('✖')}  ${file} ${c.dim('(missing)')}`);
        continue;
      }
      const raw = await fs.readFile(path.join(agentsDir, file), 'utf8');
      const unfilled = countUnfilled(raw);
      if (unfilled > 0) {
        console.log(`   ${c.yellow('⚠')}  ${file} ${c.dim(`(${unfilled} unfilled placeholders)`)}`);
      } else {
        console.log(`   ${c.green('✓')}  ${file}`);
        healthy++;
      }
    }
  }
  console.log();

  // 2. CLAUDE.md
  console.log(c.bold('CLAUDE.md'));
  const claudeMd = path.join(target, 'CLAUDE.md');
  total++;
  if (await exists(claudeMd)) {
    const text = await fs.readFile(claudeMd, 'utf8');
    const hasSection =
      text.includes('하네스 엔지니어링') || text.includes('Harness Engineering');
    if (!hasSection) {
      console.log(`   ${c.red('✖')}  No harness section`);
    } else {
      const unfilled = countUnfilled(text);
      if (unfilled > 0) {
        console.log(`   ${c.yellow('⚠')}  ${unfilled} unfilled placeholders`);
      } else {
        console.log(`   ${c.green('✓')}  Section present, no unfilled placeholders`);
        healthy++;
      }
    }
  } else {
    console.log(`   ${c.red('✖')}  CLAUDE.md not found`);
  }
  console.log();

  // 3. Learning log (best-effort: try common locations)
  console.log(c.bold('Learning log'));
  total++;
  const candidates = [
    'docs/AGENT_LEARNING_LOG.md',
    'docs/기존/AGENT_LEARNING_LOG.md',
    'AGENT_LEARNING_LOG.md',
  ];
  let foundLog: string | null = null;
  for (const cand of candidates) {
    if (await exists(path.join(target, cand))) {
      foundLog = cand;
      break;
    }
  }
  if (foundLog) {
    console.log(`   ${c.green('✓')}  ${foundLog}`);
    healthy++;
  } else {
    console.log(`   ${c.yellow('⚠')}  not found in standard locations`);
  }
  console.log();

  // 4. Chat room DB (standalone — created on first `bujang chat`)
  console.log(c.bold('Chat room (.harness/chat.db)'));
  const chatDbPath = path.join(target, '.harness/chat.db');
  if (await exists(chatDbPath)) {
    console.log(`   ${c.green('✓')}  chat.db present — open with: ${c.bold('bujang chat')}`);
  } else {
    console.log(`   ${c.dim('-')}  not yet created (runs on first ${c.bold('bujang chat')})`);
  }
  console.log();

  // Verdict
  const ratio = total > 0 ? healthy / total : 0;
  if (ratio >= 0.95) {
    console.log(`Overall: ${c.green(c.bold('🟢 healthy'))}`);
  } else if (ratio >= 0.5) {
    console.log(`Overall: ${c.yellow(c.bold('🟡 partial'))} ${c.dim(`— run "harness-bujang init" to complete`)}`);
  } else {
    console.log(`Overall: ${c.red(c.bold('🔴 not installed'))} ${c.dim(`— run "harness-bujang init"`)}`);
  }
  console.log();
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
