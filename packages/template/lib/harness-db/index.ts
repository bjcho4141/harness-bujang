// Factory + singleton for the active harness-db adapter.
//
// Mode is decided once per process by the env var HARNESS_DB:
//   - "sqlite"   (default) — local file `.harness/chat.db`, no setup
//   - "supabase"           — cloud Postgres via Supabase, prod-ready
//
// To switch later, run `bujang migrate --to=supabase` (or back to sqlite).

import type { HarnessDb, HarnessDbMode } from './types';
import { createSqliteAdapter } from './sqlite';
import { createSupabaseAdapter } from './supabase';

export type { HarnessDb, ChatMessage, ListOptions, HarnessDbMode } from './types';
export { createSqliteAdapter, createSupabaseAdapter };

let _instance: HarnessDb | null = null;

export function getHarnessDb(): HarnessDb {
  if (_instance) return _instance;
  _instance = createAdapter(currentMode());
  return _instance;
}

export function currentMode(): HarnessDbMode {
  const m = (process.env.HARNESS_DB ?? 'sqlite').toLowerCase();
  if (m === 'sqlite' || m === 'supabase') return m;
  throw new Error(
    `harness-db: invalid HARNESS_DB="${m}". Expected "sqlite" or "supabase".`,
  );
}

export function createAdapter(mode: HarnessDbMode): HarnessDb {
  switch (mode) {
    case 'sqlite':   return createSqliteAdapter();
    case 'supabase': return createSupabaseAdapter();
  }
}

/**
 * Reset the cached singleton. Mainly for tests / migrations that need to
 * switch adapters mid-process.
 */
export function resetHarnessDb(): void {
  _instance = null;
}
