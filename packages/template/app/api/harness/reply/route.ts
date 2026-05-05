import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/utils/admin';
import { getHarnessDb, type ChatMessage } from '@/lib/harness-db';

// POST /api/harness/reply
//
// Stores a message from the principal (super-admin session) into the chat room.
// The server forces `from='대표님'` to prevent spoofing.
//
// The active database (sqlite | supabase) is decided by the HARNESS_DB env var
// — see `lib/harness-db/index.ts`.

export async function POST(request: NextRequest) {
  try {
    const { isSuperAdmin } = await verifySuperAdmin();
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
    }

    const { message, room } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const db = await getHarnessDb();
    const total = await db.count();

    const msg: ChatMessage = {
      id: `harness-${String(total + 1).padStart(4, '0')}`,
      timestamp: new Date().toISOString(),
      from: '대표님',
      to: room || '부장',
      type: 'command',
      message,
    };

    await db.upsert(msg);
    return NextResponse.json({ data: { sent: msg } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to send message' },
      { status: 500 },
    );
  }
}
