#!/usr/bin/env node

// Each `run*` command is loaded via dynamic import inside the dispatcher
// below. The reason: chat.ts statically imports better-sqlite3 (a native
// addon). If that native binding fails to load on a user's machine — e.g.
// missing prebuild for their CPU arch, locked path with non-ASCII chars
// on Windows — a top-level import in index.ts would crash the process
// before *any* command (even `init`) prints a single byte. Lazy-loading
// keeps init/status/adapt/update/migrate completely free of that risk.

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
  npx harness-bujang ${c.cyan('update')}   [options]    Pull NEW agents only — existing files untouched
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

${c.bold('Options for update:')}
  --target=<path>          Project root (default: cwd)
  --lang=<ko|en>           Language for newly-added agents (default: ko)

${c.dim('  update only adds NEW agent files. Existing files are NEVER touched.')}
${c.dim('  For a clean overwrite (resets all agents), use: bujang init --yes')}

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
      await (await import('./init.js')).runInit(args.slice(1));
      break;
    case 'status':
      await (await import('./status.js')).runStatus(args.slice(1));
      break;
    case 'chat':
      await (await import('./chat.js')).runChat(args.slice(1));
      break;
    case 'adapt':
      await (await import('./adapt.js')).runAdapt(args.slice(1));
      break;
    case 'update':
      await (await import('./update.js')).runUpdate(args.slice(1));
      break;
    case 'migrate':
      await (await import('./migrate.js')).runMigrate(args.slice(1));
      break;
    case '--version':
    case '-v':
      console.log('0.5.9');
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
