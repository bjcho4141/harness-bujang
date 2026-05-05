import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/utils/admin';
import { getHarnessDb, type ChatMessage } from '@/lib/harness-db';

// GET  /api/harness/logs?days=2          → recent N days
// GET  /api/harness/logs?before=<iso>&limit=50  → infinite scroll (older)
// POST /api/harness/logs                 → INSERT a chat message
//
// Two callers are supported on POST:
//   1. A super-admin browser session (verifySuperAdmin): used by the chat-room
//      UI when the principal types a message. The server forces `from='대표님'`.
//   2. A bot / script with `x-harness-secret` header (HARNESS_WRITE_SECRET):
//      lets agents (Director, dev-team, etc.) post under their own role names.
//      `from='대표님'` is rejected on this path to prevent spoofing.
//
// The active database (sqlite | supabase) is decided by the HARNESS_DB env var
// — see `lib/harness-db/index.ts`.

export async function GET(request: NextRequest) {
  try {
    const { isSuperAdmin } = await verifySuperAdmin();
    if (!isSuperAdmin) {
      return NextResponse.json({ data: [], error: 'super-admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '2', 10);
    const before = searchParams.get('before') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const db = getHarnessDb();
    const messages = before ? await db.list({ before, limit }) : await db.list({ days });

    return NextResponse.json({ data: messages });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-harness-secret');
    const hasSecret =
      !!process.env.HARNESS_WRITE_SECRET &&
      secret === process.env.HARNESS_WRITE_SECRET;

    let isSuperAdminSession = false;
    if (!hasSecret) {
      const { isSuperAdmin } = await verifySuperAdmin();
      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
      }
      isSuperAdminSession = true;
    }

    const body = await request.json();
    const { id, from: rawFrom, to, type, message, severity, data, timestamp } = body;

    if (!to || !message) {
      return NextResponse.json({ error: 'to and message are required' }, { status: 400 });
    }

    let from: string;
    if (isSuperAdminSession) {
      from = '대표님';
    } else {
      if (!rawFrom || typeof rawFrom !== 'string') {
        return NextResponse.json({ error: 'from is required' }, { status: 400 });
      }
      const trimmed = rawFrom.trim();
      const compact = trimmed.replace(/[\s​　]+/g, '');
      if (compact === '대표님') {
        return NextResponse.json(
          { error: 'secret path may not use from="대표님" (super-admin session only)' },
          { status: 403 },
        );
      }
      from = trimmed;
    }

    const db = getHarnessDb();

    let msgId = id;
    if (!msgId) {
      const total = await db.count();
      msgId = `harness-${String(total + 1).padStart(4, '0')}`;
    }

    const msg: ChatMessage = {
      id: msgId,
      timestamp: timestamp || new Date().toISOString(),
      from,
      to,
      type: type || 'report',
      message,
      ...(severity ? { severity } : {}),
      ...(data ? { data } : {}),
    };

    await db.upsert(msg);
    return NextResponse.json({ data: msg });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to store message' },
      { status: 500 },
    );
  }
}
