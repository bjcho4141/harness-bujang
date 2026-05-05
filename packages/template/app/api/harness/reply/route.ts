import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySuperAdmin } from '@/lib/utils/admin';

// POST /api/harness/reply
//
// Stores a message from the principal (super-admin session) into the chat room.
// The server forces `from='대표님'` to prevent spoofing.
//
// In the upstream prototype this endpoint also generated stub replies from
// "consultant" / "director" via keyword regex. That logic was project-specific
// and has been removed. If you want canned replies, add your own router here
// or — better — let Main Claude handle responses via the Agent tool and
// INSERT through `/api/harness/logs` POST with the `x-harness-secret` header.

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const now = new Date();

    const { count } = await supabase
      .from('harness_messages')
      .select('id', { count: 'exact', head: true });

    const msg = {
      id: `harness-${String((count ?? 0) + 1).padStart(4, '0')}`,
      timestamp: now.toISOString(),
      from: '대표님',
      to: room || '부장',
      type: 'command' as const,
      message,
    };

    const { error } = await supabase.from('harness_messages').insert(msg);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { sent: msg } });
  } catch {
    return NextResponse.json({ error: 'failed to send message' }, { status: 500 });
  }
}
