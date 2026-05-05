// Shared types for the harness-db adapters (sqlite + supabase).
// Both adapters implement the same `HarnessDb` interface so the API routes
// don't care which one is active — the choice is made by the HARNESS_DB env var.

export interface ChatMessage {
  id: string;
  /** ISO 8601 timestamp string (UTC). */
  timestamp: string;
  from: string;
  to: string;
  type: 'command' | 'feedback' | 'info' | 'report';
  message: string;
  severity?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

export interface ListOptions {
  /** When set, return messages newer than `now() - days`. Mutually exclusive with `before`. */
  days?: number;
  /** When set, return messages older than this ISO timestamp. Used for infinite scroll. */
  before?: string;
  /** Used together with `before`. Defaults to 50. */
  limit?: number;
}

export interface HarnessDb {
  /** List messages. With `days`: recent N days. With `before`: older messages (paginated). */
  list(options?: ListOptions): Promise<ChatMessage[]>;
  /** Insert one message. Idempotent on `id`. */
  upsert(message: ChatMessage): Promise<void>;
  /** Total count — used for generating the next sequential id. */
  count(): Promise<number>;
}

export type HarnessDbMode = 'sqlite' | 'supabase';
