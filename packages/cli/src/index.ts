#!/usr/bin/env node

import { runInit } from './init.js';
import { runStatus } from './status.js';
import { runMigrate } from './migrate.js';
import { runChat } from './chat.js';
import { runAdapt } from './adapt.js';

const c = {
  bold:    (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:     (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:   (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:     (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow:  (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:    (s: string) => `\x1b[36m${s}\x1b[39m`,
} as const;

const HELP = `
${c.bold('harness-bujang')} — Korean-style multi-agent harness director for Claude Code
${c.dim('https://github.com/bjcho4141/harness-bujang')}

${c.bold('Usage:')}
  npx harness-bujang ${c.cyan('init')}     [options]    Install the harness into a project
  npx harness-bujang ${c.cyan('status')}   [options]    Verify the harness install
  npx harness-bujang ${c.cyan('chat')}     [options]    Open the standalone chat-room viewer (any stack)
  npx harness-bujang ${c.cyan('adapt')}    --to=<cursor|cline|aider|codex|gemini|all>  Convert .claude/agents/ for other tools
  npx harness-bujang ${c.cyan('migrate')}  --to=<sqlite|supabase>  Move chat data between backends

${c.bold('Options for init:')}
  --lang=<ko|en>           Agent language (default: ko — full 부장 persona)
  --chat=<sqlite|supabase> Chat-room backend (default: sqlite — local file, no setup)
  --commit-chat            Don't gitignore .harness/ (for solo cross-machine sync via git)
  --target=<path>          Project root (default: cwd)
  --framework=<name>       Override detected framework
  --db=<name>              Override detected project DB (separate from --chat)
  --no-template            Skip chat-room UI install
  --no-claude-md           Skip CLAUDE.md edit
  --no-learning-log        Skip learning log seed
  --yes, -y                Skip prompts and overwrite (non-interactive — for CI / scripts)

${c.dim('Run without --yes for an interactive setup (prompts for language, backend, etc.).')}

${c.bold('Options for chat:')}
  --target=<path>          Project root (default: cwd)
  --port=<number>          Preferred port (default: 7777, falls forward if busy)
  --no-open                Don't auto-open the browser
  --create                 Create an empty chat DB + schema if none exists yet

${c.bold('Options for adapt:')}
  --to=<cursor|cline|aider|codex|gemini|all>   Required — comma-separated list also OK
  --target=<path>          Project root (default: cwd)
  --yes, -y                Overwrite existing adapter files

${c.dim('Adapter targets:')}
${c.dim('  cursor  → .cursor/rules/bujang-*.mdc          (Cursor IDE)')}
${c.dim('  cline   → .clinerules/bujang-*.md             (Cline)')}
${c.dim('  aider   → CONVENTIONS.md + .aider.conf.yml    (Aider)')}
${c.dim('  codex   → AGENTS.md                           (Codex CLI / Copilot Coding Agent / Cody)')}
${c.dim('  gemini  → GEMINI.md + .gemini/styleguide.md   (Antigravity / Gemini CLI / Code Assist)')}

${c.bold('Options for migrate:')}
  --to=<sqlite|supabase>   Required — target backend
  --target=<path>          Project root (default: cwd)
  --yes, -y                Skip confirmation

${c.bold('Examples:')}
  ${c.dim('# Install Korean Bujang persona, SQLite chat (default — zero setup)')}
  npx harness-bujang init --lang=ko

  ${c.dim('# Open the standalone chat-room — works on ANY stack (Next.js, Rails, Django, …)')}
  npx harness-bujang chat
  ${c.dim('# → opens http://localhost:7777 in your browser')}

  ${c.dim('# Solo, multiple machines — sync chat history via git')}
  npx harness-bujang init --commit-chat

  ${c.dim('# Production project with team sharing — Supabase backend')}
  npx harness-bujang init --chat=supabase

  ${c.dim('# Started solo, now scaling up — promote to cloud')}
  bujang migrate --to=supabase

  ${c.dim('# Going back to solo / archive — pull cloud data into local SQLite')}
  bujang migrate --to=sqlite
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await runInit(args.slice(1));
      break;
    case 'status':
      await runStatus(args.slice(1));
      break;
    case 'chat':
      await runChat(args.slice(1));
      break;
    case 'adapt':
      await runAdapt(args.slice(1));
      break;
    case 'migrate':
      await runMigrate(args.slice(1));
      break;
    case '--version':
    case '-v':
      console.log('0.5.1');
      break;
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(c.red(`Unknown command: ${command}`));
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.red(`\n✖ ${err.message}`));
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
