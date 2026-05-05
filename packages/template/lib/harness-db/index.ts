// Factory + singleton for the active harness-db adapter.
//
// Mode is decided once per process by the env var HARNESS_DB:
//   - "sqlite"   (default) — local file `.harness/chat.db`, no setup
//   - "supabase"           — cloud Postgres via Supabase, prod-ready
//
// To switch later, run `bujang migrate --to=supabase` (or back to sqlite).
//
// IMPORTANT: adapters are loaded with **dynamic `import()`** so that a project
// using only the SQLite backend doesn't pay for `@supabase/supabase-js` at
// bundle / install time, and vice versa. (Static imports here would force
// Next.js / webpack / turbopack to compile both adapters into every chunk
// that touches the DB — discovered in nextjs-e2e-test against a sqlite-only
// install where supabase-js wasn't installed and the build failed.)

import type { HarnessDb, HarnessDbMode } from './types';

export type { HarnessDb, ChatMessage, ListOptions, HarnessDbMode } from './types';

let _instance: HarnessDb | null = null;
let _pending: Promise<HarnessDb> | null = null;

export function getHarnessDb(): Promise<HarnessDb> {
  if (_instance) return Promise.resolve(_instance);
  if (_pending) return _pending;
  _pending = createAdapter(currentMode()).then((db) => {
    _instance = db;
    _pending = null;
    return db;
  });
  return _pending;
}

export function currentMode(): HarnessDbMode {
  const m = (process.env.HARNESS_DB ?? 'sqlite').toLowerCase();
  if (m === 'sqlite' || m === 'supabase') return m;
  throw new Error(
    `harness-db: invalid HARNESS_DB="${m}". Expected "sqlite" or "supabase".`,
  );
}

export async function createAdapter(mode: HarnessDbMode): Promise<HarnessDb> {
  if (mode === 'sqlite') {
    const { createSqliteAdapter } = await import('./sqlite');
    return createSqliteAdapter();
  }
  const { createSupabaseAdapter } = await import('./supabase');
  return createSupabaseAdapter();
}

/**
 * Reset the cached singleton. Mainly for tests / migrations that need to
 * switch adapters mid-process.
 */
export function resetHarnessDb(): void {
  _instance = null;
  _pending = null;
}
