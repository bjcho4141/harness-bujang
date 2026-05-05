import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySuperAdmin } from '@/lib/utils/admin';

// GET  /api/harness/logs?days=2          → recent N days
// GET  /api/harness/logs?before=<iso>&limit=50  → infinite scroll (older)
// POST /api/harness/logs                 → INSERT a chat message
//
// Two callers are supported:
//   1. A super-admin browser session (verifySuperAdmin): used by the chat-room
//      UI when the principal types a message. The server forces `from='대표님'`.
//   2. A bot / script with `x-harness-secret` header (HARNESS_WRITE_SECRET):
//      lets agents (Director, dev-team, etc.) post under their own role names.
//      `from='대표님'` is rejected on this path to prevent spoofing.
//
// Reads use service-role to bypass RLS; the verifySuperAdmin gate is the
// only authorization for read access.

export async function GET(request: NextRequest) {
  try {
    const { isSuperAdmin } = await verifySuperAdmin();

    if (!isSuperAdmin) {
      return NextResponse.json({ data: [], error: 'super-admin only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '2', 10);
    const before = searchParams.get('before');

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let query = adminSupabase
      .from('harness_messages')
      .select('*')
      .order('timestamp', { ascending: true });

    if (before) {
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      query = query.lt('timestamp', before).limit(limit);
    } else {
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('timestamp', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ data: [] });
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let msgId = id;
    if (!msgId) {
      const { count } = await supabase
        .from('harness_messages')
        .select('id', { count: 'exact', head: true });
      msgId = `harness-${String((count ?? 0) + 1).padStart(4, '0')}`;
    }

    const msg = {
      id: msgId,
      timestamp: timestamp || new Date().toISOString(),
      from,
      to,
      type: type || 'report',
      message,
      ...(severity && { severity }),
      ...(data && { data }),
    };

    const { error } = await supabase
      .from('harness_messages')
      .upsert(msg, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: msg });
  } catch {
    return NextResponse.json({ error: 'failed to store message' }, { status: 500 });
  }
}
