// SQLite adapter for harness-db.
//
// Storage: `.harness/chat.db` in the project root by default.
// Override via env var `HARNESS_SQLITE_PATH=/absolute/path/to/chat.db`.
//
// Requires `better-sqlite3` to be installed in the host project:
//   npm i better-sqlite3
//   npm i -D @types/better-sqlite3

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { HarnessDb, ChatMessage, ListOptions } from './types';

let _db: import('better-sqlite3').Database | null = null;

function resolveDbPath(): string {
  if (process.env.HARNESS_SQLITE_PATH) return process.env.HARNESS_SQLITE_PATH;
  return path.join(process.cwd(), '.harness', 'chat.db');
}

async function ensureDb(): Promise<import('better-sqlite3').Database> {
  if (_db) return _db;

  // Lazy import so projects that don't use SQLite don't pay the cost.
  const { default: Database } = await import('better-sqlite3');

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS harness_messages (
      id          TEXT PRIMARY KEY,
      timestamp   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      "from"      TEXT NOT NULL,
      "to"        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('command', 'feedback', 'info', 'report')),
      message     TEXT NOT NULL,
      severity    TEXT CHECK (severity IS NULL OR severity IN ('info', 'warning', 'error')),
      data        TEXT,
      created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS harness_messages_timestamp_idx
      ON harness_messages(timestamp DESC);

    CREATE INDEX IF NOT EXISTS harness_messages_from_to_idx
      ON harness_messages("from", "to");
  `);

  return _db;
}

function rowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    timestamp: row.timestamp,
    from: row.from,
    to: row.to,
    type: row.type,
    message: row.message,
    ...(row.severity ? { severity: row.severity } : {}),
    ...(row.data ? { data: JSON.parse(row.data) } : {}),
  };
}

export function createSqliteAdapter(): HarnessDb {
  return {
    async list(options: ListOptions = {}) {
      const db = await ensureDb();

      if (options.before) {
        const limit = options.limit ?? 50;
        const stmt = db.prepare(
          `SELECT * FROM harness_messages
             WHERE timestamp < ?
             ORDER BY timestamp ASC
             LIMIT ?`,
        );
        return stmt.all(options.before, limit).map(rowToMessage);
      }

      const days = options.days ?? 2;
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const stmt = db.prepare(
        `SELECT * FROM harness_messages
           WHERE timestamp >= ?
           ORDER BY timestamp ASC`,
      );
      return stmt.all(since).map(rowToMessage);
    },

    async upsert(msg: ChatMessage) {
      const db = await ensureDb();
      const stmt = db.prepare(
        `INSERT INTO harness_messages (id, timestamp, "from", "to", type, message, severity, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             timestamp = excluded.timestamp,
             "from"    = excluded."from",
             "to"      = excluded."to",
             type      = excluded.type,
             message   = excluded.message,
             severity  = excluded.severity,
             data      = excluded.data`,
      );
      stmt.run(
        msg.id,
        msg.timestamp,
        msg.from,
        msg.to,
        msg.type,
        msg.message,
        msg.severity ?? null,
        msg.data ? JSON.stringify(msg.data) : null,
      );
    },

    async count() {
      const db = await ensureDb();
      const row = db.prepare('SELECT COUNT(*) AS c FROM harness_messages').get() as { c: number };
      return row.c;
    },
  };
}
