import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[39m`,
};

type Backend = 'sqlite' | 'supabase';

interface MigrateOptions {
  to: Backend;
  target: string;
  yes: boolean;
}

/**
 * Migrate the chat-room data between SQLite and Supabase.
 *
 * The two adapters share the same `HarnessDb` interface, so the actual
 * transfer is a single loop. The harder part is environment management:
 *   - SQLite → Supabase: ensure migration SQL is applied, update .env, copy data
 *   - Supabase → SQLite: pull all data into local file, update .env (or unset)
 *
 * This command runs in the user's project directory and assumes the project
 * has installed the `lib/harness-db/` adapter library (via `harness-bujang init`).
 */
export async function runMigrate(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  console.log();
  console.log(c.bold(`🔄 Harness-Bujang migrate → ${opts.to}`));
  console.log();

  const dbLibPath = path.join(opts.target, 'src/lib/harness-db');
  if (!(await exists(dbLibPath))) {
    throw new Error(
      `lib/harness-db not found at ${dbLibPath}.\n` +
        `Run "npx harness-bujang init" first.`,
    );
  }

  // Detect current backend from .env files.
  const envFile = path.join(opts.target, '.env.local');
  const currentBackend = await detectBackend(opts.target);
  console.log(`   ${c.dim('Current backend:')} ${currentBackend ?? '(none — first install)'}`);
  console.log(`   ${c.dim('Target backend: ')} ${opts.to}`);
  console.log();

  if (currentBackend === opts.to) {
    console.log(c.yellow(`Already on ${opts.to}. Nothing to do.`));
    return;
  }

  // Confirm with user
  if (!opts.yes) {
    console.log(c.yellow('⚠ This will:'));
    if (opts.to === 'supabase') {
      console.log('   1. Read all messages from .harness/chat.db');
      console.log('   2. Push them to your Supabase harness_messages table');
      console.log('   3. Update .env.local with HARNESS_DB=supabase');
      console.log('   4. Back up the SQLite file to .harness/chat.db.bak');
    } else {
      console.log('   1. Pull all messages from your Supabase harness_messages table');
      console.log('   2. Write them into .harness/chat.db');
      console.log('   3. Update .env.local with HARNESS_DB=sqlite');
    }
    console.log();
    console.log(c.dim('Pass --yes to skip this confirmation.'));
    if (!(await confirm('Continue?'))) {
      console.log(c.dim('Aborted.'));
      return;
    }
  }

  // Pre-flight checks
  if (opts.to === 'supabase') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(c.red('✖ Missing Supabase env vars.'));
      console.log();
      console.log('   Required (set in your shell or .env.local):');
      console.log(`   ${c.bold('NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co')}`);
      console.log(`   ${c.bold('SUPABASE_SERVICE_ROLE_KEY=eyJ...')}`);
      console.log();
      console.log(c.dim('   Apply migrations first:'));
      console.log(c.dim('   $ supabase db push'));
      console.log(c.dim('   Or copy SQL from src/lib/harness-db/.. into your Supabase SQL editor.'));
      throw new Error('Supabase env not configured');
    }
  }

  // Dynamic import of the user's lib/harness-db.
  // Since the user project may use ESM/CJS, we can't always require it.
  // Strategy: shell out to a small node script that does the transfer.
  const transferScript = await writeTransferScript(opts.target, currentBackend ?? 'sqlite', opts.to);
  console.log(c.bold('🚚 Transferring messages…'));
  try {
    execSync(`node "${transferScript}"`, {
      cwd: opts.target,
      stdio: 'inherit',
      env: { ...process.env, HARNESS_TRANSFER_FROM: currentBackend ?? 'sqlite', HARNESS_TRANSFER_TO: opts.to },
    });
  } finally {
    await fs.unlink(transferScript).catch(() => undefined);
  }

  // Update .env.local
  console.log();
  console.log(c.bold('📝 Updating .env.local'));
  await upsertEnvVar(envFile, 'HARNESS_DB', opts.to);
  console.log(`   ${c.green('✓')}  HARNESS_DB=${opts.to}`);

  // Backup SQLite file if migrating away
  if (currentBackend === 'sqlite' && opts.to === 'supabase') {
    const dbPath = path.join(opts.target, '.harness/chat.db');
    const bakPath = path.join(opts.target, '.harness/chat.db.bak');
    if (await exists(dbPath)) {
      await fs.copyFile(dbPath, bakPath);
      console.log(`   ${c.green('✓')}  Backed up: .harness/chat.db.bak`);
    }
  }

  console.log();
  console.log(c.bold(c.green('✅ Migration done.')));
  console.log();
  console.log('Next steps:');
  console.log(`   1. Restart your dev server (so HARNESS_DB takes effect)`);
  console.log(`   2. Visit /admin/harness — messages should appear from the new backend`);
  if (opts.to === 'sqlite' && currentBackend === 'supabase') {
    console.log();
    console.log(c.dim(`   (The Supabase table still has your data. Drop it manually if you want.)`));
  }
  console.log();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): MigrateOptions {
  const to = (getFlag(args, '--to') ?? '') as Backend;
  if (!['sqlite', 'supabase'].includes(to)) {
    throw new Error(
      `--to is required and must be "sqlite" or "supabase".\n` +
        `Example: bujang migrate --to=supabase`,
    );
  }
  const targetRaw = getFlag(args, '--target') ?? '.';
  return {
    to,
    target: path.resolve(targetRaw),
    yes:    args.includes('--yes') || args.includes('-y'),
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

async function detectBackend(target: string): Promise<Backend | null> {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(target, f);
    if (!(await exists(p))) continue;
    const text = await fs.readFile(p, 'utf8');
    const m = text.match(/^HARNESS_DB\s*=\s*(\S+)/m);
    if (m && (m[1] === 'sqlite' || m[1] === 'supabase')) return m[1];
  }
  // Default: sqlite
  if (await exists(path.join(target, '.harness/chat.db'))) return 'sqlite';
  return null;
}

async function upsertEnvVar(envFile: string, key: string, value: string): Promise<void> {
  let content = '';
  if (await exists(envFile)) {
    content = await fs.readFile(envFile, 'utf8');
  }
  const re = new RegExp(`^${key}\\s*=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`);
  } else {
    content += (content && !content.endsWith('\n') ? '\n' : '') + `${key}=${value}\n`;
  }
  await fs.writeFile(envFile, content);
}

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);
  return new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      const ans = chunk.toString().trim().toLowerCase();
      resolve(ans === 'y' || ans === 'yes');
      process.stdin.pause();
    });
  });
}

/**
 * Write a tiny one-shot Node script to the user's project that imports their
 * lib/harness-db and copies messages from one backend to the other. Then we
 * shell out to it. This avoids us needing to import the user's project at all.
 */
async function writeTransferScript(target: string, from: Backend, to: Backend): Promise<string> {
  const scriptPath = path.join(target, '.harness-migrate-' + Date.now() + '.mjs');
  const code = `
import { createAdapter } from './src/lib/harness-db/index.js';

const src = createAdapter('${from}');
const dst = createAdapter('${to}');

let total = 0;
let lastTs = undefined;

while (true) {
  const batch = await src.list(lastTs ? { before: lastTs, limit: 200 } : { days: 36500 });
  if (batch.length === 0) break;
  for (const msg of batch) {
    await dst.upsert(msg);
    total++;
  }
  // Continue from the oldest seen so far to walk backwards through history.
  lastTs = batch[0].timestamp;
  if (!lastTs) break;
}

console.log('   ✓ Transferred ' + total + ' messages');
`;
  await fs.writeFile(scriptPath, code);
  return scriptPath;
}
