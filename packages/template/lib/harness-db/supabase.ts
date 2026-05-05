// Supabase adapter for harness-db.
//
// Required env vars:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Apply migrations 00010_harness_messages.sql and 00025_harness_insert_admin_only.sql
// against your Supabase project before using.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { HarnessDb, ChatMessage, ListOptions } from './types';

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'harness-db (supabase): NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
  }
  _client = createClient(url, key);
  return _client;
}

export function createSupabaseAdapter(): HarnessDb {
  return {
    async list(options: ListOptions = {}) {
      let q = client()
        .from('harness_messages')
        .select('*')
        .order('timestamp', { ascending: true });

      if (options.before) {
        q = q.lt('timestamp', options.before).limit(options.limit ?? 50);
      } else {
        const days = options.days ?? 2;
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        q = q.gte('timestamp', since);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as ChatMessage[];
    },

    async upsert(msg: ChatMessage) {
      const { error } = await client()
        .from('harness_messages')
        .upsert(msg, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    },

    async count() {
      const { count, error } = await client()
        .from('harness_messages')
        .select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  };
}
