// `bujang adapt` — convert the canonical .claude/agents/ install into other
// editor / agent harness formats.
//
//   Source:                          Target adapters:
//   .claude/agents/*.md       ──→    .cursor/rules/bujang-*.mdc      (Cursor)
//                             ──→    .clinerules/bujang-*.md         (Cline)
//                             ──→    CONVENTIONS.md (+ .aider.conf.yml)  (Aider)
//
// The .claude/agents/ install remains the single source of truth — re-run
// `bujang adapt --to=<target>` after changes to keep adapters in sync.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[39m`,
};

type AdaptTarget = 'cursor' | 'cline' | 'aider' | 'codex' | 'gemini';

interface AdaptOptions {
  target: string;
  to: AdaptTarget[];
  yes: boolean;
}

interface AgentFile {
  /** Filename without extension, e.g. "director" */
  slug: string;
  /** Parsed YAML frontmatter as a flat map (string keys → string values). */
  frontmatter: Record<string, string>;
  /** Markdown body after the closing `---`. */
  body: string;
  /** Original on-disk path. */
  src: string;
}

export async function runAdapt(args: string[]): Promise<void> {
  const opts = parseArgs(args);
  const agentsDir = path.join(opts.target, '.claude/agents');

  if (!(await exists(agentsDir))) {
    console.log();
    console.log(c.red('✖ No .claude/agents/ directory found at ' + agentsDir));
    console.log();
    console.log('  Run ' + c.bold('npx harness-bujang init') + ' first to install the canonical agents,');
    console.log('  then re-run this command to adapt them to your editor.');
    console.log();
    process.exitCode = 1;
    return;
  }

  const agentFiles = await loadAgents(agentsDir);
  if (agentFiles.length === 0) {
    console.log();
    console.log(c.red('✖ .claude/agents/ exists but contains no .md files.'));
    console.log();
    process.exitCode = 1;
    return;
  }

  console.log();
  console.log(c.bold('🔁 Harness-Bujang adapt'));
  console.log(c.dim(`   Target:    ${opts.target}`));
  console.log(c.dim(`   Agents:    ${agentFiles.length} files at .claude/agents/`));
  console.log(c.dim(`   Adapting:  ${opts.to.join(', ')}`));
  console.log();

  for (const target of opts.to) {
    if (target === 'cursor') await adaptCursor(opts.target, agentFiles, opts.yes);
    if (target === 'cline')  await adaptCline(opts.target, agentFiles, opts.yes);
    if (target === 'aider')  await adaptAider(opts.target, agentFiles, opts.yes);
    if (target === 'codex')  await adaptCodex(opts.target, agentFiles, opts.yes);
    if (target === 'gemini') await adaptGemini(opts.target, agentFiles, opts.yes);
  }

  console.log(c.bold(c.green('✅ Done.')));
  console.log();
  console.log('Next:');
  if (opts.to.includes('cursor')) {
    console.log(`   ${c.cyan('•')} Cursor users: open the project — rules in ${c.bold('.cursor/rules/')} are auto-loaded`);
  }
  if (opts.to.includes('cline')) {
    console.log(`   ${c.cyan('•')} Cline users: rules in ${c.bold('.clinerules/')} are auto-loaded by Cline`);
  }
  if (opts.to.includes('aider')) {
    console.log(`   ${c.cyan('•')} Aider users: ${c.bold('CONVENTIONS.md')} is loaded via ${c.bold('.aider.conf.yml')} (read:)`);
  }
  if (opts.to.includes('codex')) {
    console.log(`   ${c.cyan('•')} Codex / Copilot Coding Agent users: ${c.bold('AGENTS.md')} at the project root is auto-loaded`);
  }
  if (opts.to.includes('gemini')) {
    console.log(`   ${c.cyan('•')} Antigravity / Gemini CLI / Code Assist: ${c.bold('GEMINI.md')} (highest precedence) + ${c.bold('.gemini/styleguide.md')} (PR reviews)`);
  }
  console.log();
  console.log(c.dim('   When you change .claude/agents/ later, re-run this command to refresh.'));
  console.log();
}

// ---------------------------------------------------------------------------
// Cursor adapter — .cursor/rules/bujang-<slug>.mdc
// ---------------------------------------------------------------------------

async function adaptCursor(target: string, agents: AgentFile[], overwrite: boolean): Promise<void> {
  const dst = path.join(target, '.cursor/rules');
  await fs.mkdir(dst, { recursive: true });

  console.log(c.bold('📂 Cursor — .cursor/rules/'));
  for (const a of agents) {
    const file = path.join(dst, `bujang-${a.slug}.mdc`);
    if ((await exists(file)) && !overwrite) {
      console.log(`   ${c.yellow('⚠')}  bujang-${a.slug}.mdc ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
      continue;
    }
    const description = a.frontmatter.description || `Harness-Bujang ${a.slug}`;
    const out =
      `---\n` +
      `description: "Harness-Bujang ${a.slug}: ${escapeYamlString(description.replace(/\n/g, ' ').slice(0, 240))}"\n` +
      `alwaysApply: false\n` +
      `---\n\n` +
      `# Harness-Bujang — ${a.slug} role guide\n\n` +
      `> Source of truth: \`.claude/agents/${a.slug}.md\` — re-run \`bujang adapt --to=cursor\` to sync.\n\n` +
      `When the user request matches this role's domain (see description above), follow this guide as your primary system prompt for the response. Other rules under this directory describe sibling roles in the same harness.\n\n` +
      `---\n\n` +
      a.body.trim() + `\n`;
    await fs.writeFile(file, out);
    console.log(`   ${c.green('✓')}  bujang-${a.slug}.mdc`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Cline adapter — .clinerules/bujang-<slug>.md
// ---------------------------------------------------------------------------

async function adaptCline(target: string, agents: AgentFile[], overwrite: boolean): Promise<void> {
  const dst = path.join(target, '.clinerules');
  await fs.mkdir(dst, { recursive: true });

  console.log(c.bold('📂 Cline — .clinerules/'));
  for (const a of agents) {
    const file = path.join(dst, `bujang-${a.slug}.md`);
    if ((await exists(file)) && !overwrite) {
      console.log(`   ${c.yellow('⚠')}  bujang-${a.slug}.md ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
      continue;
    }
    const description = a.frontmatter.description || '';
    const out =
      `# Harness-Bujang — ${a.slug}\n\n` +
      (description ? `${description}\n\n` : '') +
      `> Source of truth: \`.claude/agents/${a.slug}.md\` — re-run \`bujang adapt --to=cline\` to sync.\n\n` +
      `---\n\n` +
      a.body.trim() + `\n`;
    await fs.writeFile(file, out);
    console.log(`   ${c.green('✓')}  bujang-${a.slug}.md`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Aider adapter — CONVENTIONS.md + .aider.conf.yml
// ---------------------------------------------------------------------------

async function adaptAider(target: string, agents: AgentFile[], overwrite: boolean): Promise<void> {
  console.log(c.bold('📂 Aider — CONVENTIONS.md + .aider.conf.yml'));

  const conventionsPath = path.join(target, 'CONVENTIONS.md');
  const conventionsExisted = await exists(conventionsPath);
  if (conventionsExisted && !overwrite) {
    console.log(`   ${c.yellow('⚠')}  CONVENTIONS.md ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
  } else {
    let body = `# Project Conventions — Harness-Bujang\n\n`;
    body += `> Source of truth: \`.claude/agents/*.md\` — re-run \`bujang adapt --to=aider\` to sync.\n\n`;
    body += `This file collects the multi-agent harness role guides into a single conventions file that Aider can load via \`.aider.conf.yml\`. Aider does not natively dispatch to subagents, so when the user's request matches a specific role's domain, internally adopt that role's instructions for the response.\n\n`;
    body += `## Roles\n\n`;
    for (const a of agents) {
      const desc = a.frontmatter.description || '';
      body += `- **${a.slug}**${desc ? ` — ${desc.replace(/\n/g, ' ').slice(0, 200)}` : ''}\n`;
    }
    body += `\n---\n\n`;
    for (const a of agents) {
      body += `## ${a.slug}\n\n`;
      body += a.body.trim() + `\n\n---\n\n`;
    }
    await fs.writeFile(conventionsPath, body);
    console.log(`   ${c.green('✓')}  CONVENTIONS.md ${c.dim(`(${agents.length} roles concatenated)`)}`);
  }

  // Aider config: prefer .aider.conf.yml (Aider's documented filename).
  const aiderConfPath = path.join(target, '.aider.conf.yml');
  const existing = (await exists(aiderConfPath)) ? await fs.readFile(aiderConfPath, 'utf8') : '';
  if (existing.includes('CONVENTIONS.md')) {
    console.log(`   ${c.dim('•')}  .aider.conf.yml already references CONVENTIONS.md — left untouched`);
  } else if (existing && !overwrite) {
    console.log(`   ${c.yellow('⚠')}  .aider.conf.yml exists and does NOT reference CONVENTIONS.md — skipped`);
    console.log(`     ${c.dim('Add manually:')}  read: CONVENTIONS.md`);
  } else {
    const out = existing
      ? existing.trimEnd() + `\n\n# Added by harness-bujang adapt\nread: CONVENTIONS.md\n`
      : `# Aider config — auto-loads Harness-Bujang conventions\nread: CONVENTIONS.md\n`;
    await fs.writeFile(aiderConfPath, out);
    console.log(`   ${c.green('✓')}  .aider.conf.yml ${c.dim('(read: CONVENTIONS.md)')}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Codex adapter — AGENTS.md at the project root
//
// AGENTS.md is read by:
//   - OpenAI Codex CLI
//   - GitHub Copilot Coding Agent
//   - Sourcegraph Cody (recent versions)
//   - and other tools converging on this informal standard
// ---------------------------------------------------------------------------

async function adaptCodex(target: string, agents: AgentFile[], overwrite: boolean): Promise<void> {
  console.log(c.bold('📂 Codex / Copilot Agent — AGENTS.md (project root)'));

  const filePath = path.join(target, 'AGENTS.md');
  if ((await exists(filePath)) && !overwrite) {
    console.log(`   ${c.yellow('⚠')}  AGENTS.md ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
    console.log();
    return;
  }

  let body = `# AGENTS.md — Harness-Bujang multi-agent harness\n\n`;
  body += `> Source of truth: \`.claude/agents/*.md\` — re-run \`bujang adapt --to=codex\` to sync.\n\n`;
  body += `This file follows the AGENTS.md convention adopted by OpenAI Codex CLI, GitHub Copilot Coding Agent, and several other agentic coding tools. It collects the harness role guides into a single document.\n\n`;
  body += `When the user's request matches one of the role domains below, internally adopt that role's instructions for the response. If the request spans multiple domains, follow the **director** role's dispatch logic.\n\n`;
  body += `## Roles\n\n`;
  for (const a of agents) {
    const desc = a.frontmatter.description || '';
    body += `- **${a.slug}**${desc ? ` — ${desc.replace(/\n/g, ' ').slice(0, 200)}` : ''}\n`;
  }
  body += `\n---\n\n`;
  for (const a of agents) {
    body += `## ${a.slug}\n\n`;
    body += a.body.trim() + `\n\n---\n\n`;
  }
  await fs.writeFile(filePath, body);
  console.log(`   ${c.green('✓')}  AGENTS.md ${c.dim(`(${agents.length} roles concatenated, ${(body.length / 1024).toFixed(1)} KB)`)}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Gemini adapter — GEMINI.md (root) + .gemini/styleguide.md
//
// Per Antigravity v1.20.3+ docs and Gemini Code Assist workspace docs, the
// precedence order is roughly:
//   .idx/airules.md  >  GEMINI.md  >  .gemini/styleguide.md  >  AGENTS.md  >  cursorrules
//
// We write GEMINI.md (top-level cross-tool) and also drop a styleguide.md so
// the GitHub PR reviewer (Gemini Code Assist for GitHub) picks it up.
// ---------------------------------------------------------------------------

async function adaptGemini(target: string, agents: AgentFile[], overwrite: boolean): Promise<void> {
  console.log(c.bold('📂 Gemini / Antigravity — GEMINI.md + .gemini/styleguide.md'));

  // 1. GEMINI.md at project root.
  const geminiMdPath = path.join(target, 'GEMINI.md');
  if ((await exists(geminiMdPath)) && !overwrite) {
    console.log(`   ${c.yellow('⚠')}  GEMINI.md ${c.dim('(exists, skipped — use --yes to overwrite)')}`);
  } else {
    let body = `# GEMINI.md — Harness-Bujang multi-agent harness\n\n`;
    body += `> Source of truth: \`.claude/agents/*.md\` — re-run \`bujang adapt --to=gemini\` to sync.\n\n`;
    body += `This file is read by Google Antigravity (workspace highest priority), Gemini CLI, and Gemini Code Assist (workspace customization). It collects the harness role guides into a single document.\n\n`;
    body += `When the user's request matches one of the role domains below, internally adopt that role's instructions for the response. If the request spans multiple domains, follow the **director** role's dispatch logic.\n\n`;
    body += `## Roles\n\n`;
    for (const a of agents) {
      const desc = a.frontmatter.description || '';
      body += `- **${a.slug}**${desc ? ` — ${desc.replace(/\n/g, ' ').slice(0, 200)}` : ''}\n`;
    }
    body += `\n---\n\n`;
    for (const a of agents) {
      body += `## ${a.slug}\n\n`;
      body += a.body.trim() + `\n\n---\n\n`;
    }
    await fs.writeFile(geminiMdPath, body);
    console.log(`   ${c.green('✓')}  GEMINI.md ${c.dim(`(${agents.length} roles concatenated, ${(body.length / 1024).toFixed(1)} KB)`)}`);
  }

  // 2. .gemini/styleguide.md — for the GitHub PR review bot.
  const styleguideDir = path.join(target, '.gemini');
  await fs.mkdir(styleguideDir, { recursive: true });
  const styleguidePath = path.join(styleguideDir, 'styleguide.md');
  if ((await exists(styleguidePath)) && !overwrite) {
    console.log(`   ${c.yellow('⚠')}  .gemini/styleguide.md ${c.dim('(exists, skipped)')}`);
  } else {
    // The PR review bot is best served by the code-review-team + security-team
    // + verifier-team guides, since those define what a "good" PR looks like.
    const reviewRoles = ['code-review-team', 'security-team', 'db-guard-team', 'verifier-team'];
    const reviewAgents = agents.filter((a) => reviewRoles.includes(a.slug));
    let body = `# Code Review Style Guide — Harness-Bujang\n\n`;
    body += `> Source of truth: \`.claude/agents/*.md\` — re-run \`bujang adapt --to=gemini\` to sync.\n\n`;
    body += `This style guide is read by Gemini Code Assist for GitHub when reviewing PRs. It distills the review-relevant subset of the Harness-Bujang harness (code review, security, DB guard, verifier teams) into review criteria.\n\n`;
    body += `When reviewing a PR, apply the following audit lenses in order:\n\n`;
    for (const a of reviewAgents) {
      body += `## ${a.slug}\n\n`;
      body += a.body.trim() + `\n\n---\n\n`;
    }
    if (reviewAgents.length === 0) {
      body += `_(No review-team agents found in .claude/agents/. Re-run init to install the canonical set.)_\n`;
    }
    await fs.writeFile(styleguidePath, body);
    console.log(`   ${c.green('✓')}  .gemini/styleguide.md ${c.dim(`(${reviewAgents.length} review roles)`)}`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

async function loadAgents(agentsDir: string): Promise<AgentFile[]> {
  const entries = await fs.readdir(agentsDir);
  const out: AgentFile[] = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const src = path.join(agentsDir, name);
    const raw = await fs.readFile(src, 'utf8');
    const slug = name.replace(/\.md$/, '');
    const { frontmatter, body } = splitFrontmatter(raw);
    out.push({ slug, frontmatter, body, src });
  }
  // Stable order — director first if present, then alphabetical.
  out.sort((a, b) => {
    if (a.slug === 'director') return -1;
    if (b.slug === 'director') return 1;
    return a.slug.localeCompare(b.slug);
  });
  return out;
}

function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  if (!raw.startsWith('---\n')) {
    return { frontmatter: {}, body: raw };
  }
  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) {
    return { frontmatter: {}, body: raw };
  }
  const fmRaw = raw.slice(4, end);
  const body = raw.slice(end + 5);

  const frontmatter: Record<string, string> = {};
  // Permissive line-based parser — supports `key: value` and multi-line values
  // continued by indentation, but not full YAML. Sufficient for our fields
  // (`name`, `description`, `tools`, `model`).
  const lines = fmRaw.split(/\r?\n/);
  let currentKey: string | null = null;
  for (const line of lines) {
    const m = /^([a-zA-Z_-]+):\s?(.*)$/.exec(line);
    if (m && m[1] && !line.startsWith(' ') && !line.startsWith('\t')) {
      currentKey = m[1];
      frontmatter[currentKey] = m[2] ?? '';
    } else if (currentKey && (line.startsWith(' ') || line.startsWith('\t'))) {
      frontmatter[currentKey] = (frontmatter[currentKey] ?? '') + ' ' + line.trim();
    }
  }
  return { frontmatter, body };
}

function escapeYamlString(s: string): string {
  // Double-quote-escape (we wrap the value in `"..."` already).
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): AdaptOptions {
  const targetRaw = getFlag(args, '--target') ?? '.';
  const toRaw = getFlag(args, '--to');
  if (!toRaw) {
    throw new Error(
      `--to=<cursor|cline|aider|codex|gemini|all> is required. Examples:\n` +
      `  bujang adapt --to=cursor\n` +
      `  bujang adapt --to=codex             # AGENTS.md at project root\n` +
      `  bujang adapt --to=gemini            # GEMINI.md + .gemini/styleguide.md\n` +
      `  bujang adapt --to=cursor,aider      # multiple\n` +
      `  bujang adapt --to=all               # cursor + cline + aider + codex + gemini`,
    );
  }
  const targets = toRaw === 'all'
    ? (['cursor', 'cline', 'aider', 'codex', 'gemini'] as const)
    : (toRaw.split(',').map((t) => t.trim()) as readonly string[]);

  for (const t of targets) {
    if (!['cursor', 'cline', 'aider', 'codex', 'gemini'].includes(t)) {
      throw new Error(`Unknown adapter target "${t}" — expected one of: cursor, cline, aider, codex, gemini, all`);
    }
  }

  return {
    target: path.resolve(targetRaw),
    to: targets as AdaptTarget[],
    yes: args.includes('--yes') || args.includes('-y'),
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
