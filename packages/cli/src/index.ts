#!/usr/bin/env node

import { runInit } from './init.js';
import { runStatus } from './status.js';

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
  npx harness-bujang ${c.cyan('init')}    [options]    Install the harness into a project
  npx harness-bujang ${c.cyan('status')}  [options]    Verify the harness install

${c.bold('Options for init:')}
  --lang=<ko|en>          Agent language (default: en)
  --target=<path>          Project root (default: cwd)
  --framework=<name>       Override detected framework
  --db=<name>              Override detected DB
  --no-template            Skip chat-room UI install
  --no-claude-md           Skip CLAUDE.md edit
  --no-learning-log        Skip learning log seed
  --yes, -y                Overwrite without asking

${c.bold('Examples:')}
  ${c.dim('# Install English agents into the current project')}
  npx harness-bujang init

  ${c.dim('# Install Korean (full Bujang persona) into ./my-app')}
  npx harness-bujang init --lang=ko --target=./my-app

  ${c.dim('# Skip the Next.js chat-room UI (just agents + CLAUDE.md)')}
  npx harness-bujang init --no-template
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
    case '--version':
    case '-v':
      // Version is filled at build time by tsup; fallback for `tsx`.
      console.log('0.1.0');
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
