// `bujang chat` — standalone KakaoTalk-style chat-room viewer.
//
// Reads `<target>/.harness/chat.db` directly via the system `sqlite3` CLI,
// serves a single-page vanilla HTML viewer on http://localhost:<port>, and
// auto-opens the browser. No Next.js or framework dependency required.
//
// Why shell out to the `sqlite3` CLI instead of `better-sqlite3`?
//   - better-sqlite3 is a native module, hard to bundle in a CLI tarball.
//   - sql.js (pure WASM) is ~700KB and slower for read-heavy polling.
//   - The system `sqlite3` CLI is preinstalled on macOS and most Linux.
//
// On Windows or systems without sqlite3, we print a clear error with the
// install command.

import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const c = {
  bold:   (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:  (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[39m`,
};

interface ChatOptions {
  target: string;
  port: number;
  open: boolean;
  create: boolean;
}

export async function runChat(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  // 1. Verify sqlite3 CLI is available.
  try {
    await execFileP('sqlite3', ['--version']);
  } catch {
    console.log();
    console.log(c.red('✖ The `sqlite3` command-line tool is required for `bujang chat`.'));
    console.log();
    console.log('  macOS:        already installed');
    console.log('  Ubuntu/WSL:   ' + c.bold('sudo apt-get install sqlite3'));
    console.log('  Fedora:       ' + c.bold('sudo dnf install sqlite'));
    console.log('  Windows:      https://www.sqlite.org/download.html (sqlite-tools-win-x64)');
    console.log();
    process.exitCode = 1;
    return;
  }

  // 2. Locate or create the DB.
  //
  // From 0.5.3 we auto-create a DB on first run so users don't need to remember
  // the --create flag. The flag is kept for backwards compatibility and CI use,
  // but plain `bujang chat` now Just Works on a fresh project.
  const dbPath = resolveDbPath(opts.target);
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    await runSql(dbPath, SCHEMA_SQL);
    // Seed an info row so the viewer shows something.
    const seedId = `seed-${Date.now()}`;
    await runSql(
      dbPath,
      `INSERT INTO harness_messages (id, "from", "to", type, message, severity)
       VALUES ('${seedId}', '부장', '대표님', 'info', '톡방이 생성되었습니다. 첫 명령을 내려주세요.', 'info');`,
    );
    console.log(c.dim(`   created empty chat DB at ${dbPath}`));
  } else {
    // Make sure the schema exists (the user could have an empty file).
    await runSql(dbPath, SCHEMA_SQL);
  }

  // 3. Boot the HTTP server.
  const port = await findOpenPort(opts.port);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderHtml());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/messages') {
      const days = parseInt(url.searchParams.get('days') ?? '7', 10);
      try {
        const rows = await readMessages(dbPath, days);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: rows }));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [], error: String(err) }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/messages') {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body) as {
          from?: string;
          to?: string;
          type?: string;
          message?: string;
          severity?: string;
        };
        const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const from     = parsed.from     || '대표님';
        const to       = parsed.to       || '부장';
        const type     = parsed.type     || 'command';
        const message  = parsed.message  || '';
        const severity = parsed.severity || 'info';
        if (!message.trim()) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'message is required' }));
          return;
        }
        await runSql(
          dbPath,
          `INSERT INTO harness_messages (id, "from", "to", type, message, severity)
           VALUES (${q(id)}, ${q(from)}, ${q(to)}, ${q(type)}, ${q(message)}, ${q(severity)});`,
        );
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id } }));
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  const url = `http://localhost:${port}`;
  console.log();
  console.log(c.bold(c.green('🟢 하네스 톡방 viewer')) + c.dim(' — ' + url));
  console.log(c.dim(`   db:   ${dbPath}`));
  console.log(c.dim(`   stop: Ctrl+C`));
  console.log();

  if (opts.open) {
    openBrowser(url);
  }

  // Keep the process alive — Ctrl+C will exit cleanly.
  process.on('SIGINT', () => {
    console.log();
    console.log(c.dim('   bye 👋'));
    server.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): ChatOptions {
  const targetRaw = getFlag(args, '--target') ?? '.';
  const portRaw = getFlag(args, '--port');
  const port = portRaw ? parseInt(portRaw, 10) : 7777;
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    throw new Error(`--port must be between 1024 and 65535, got "${portRaw}"`);
  }
  return {
    target: path.resolve(targetRaw),
    port,
    open: !args.includes('--no-open'),
    create: args.includes('--create'),
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

function resolveDbPath(target: string): string {
  if (process.env.HARNESS_SQLITE_PATH) return process.env.HARNESS_SQLITE_PATH;
  return path.join(target, '.harness', 'chat.db');
}

async function findOpenPort(preferred: number): Promise<number> {
  for (let p = preferred; p < preferred + 20; p++) {
    if (await portIsFree(p)) return p;
  }
  throw new Error(`Could not find a free port in range ${preferred}-${preferred + 19}`);
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close();
      resolve(true);
    });
    tester.listen(port, '127.0.0.1');
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // best-effort — user can click the URL
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

interface MessageRow {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  type: string;
  message: string;
  severity: string | null;
}

async function readMessages(dbPath: string, days: number): Promise<MessageRow[]> {
  const sql = `
    SELECT id, timestamp, "from" AS sender, "to" AS recipient, type, message, severity
    FROM harness_messages
    WHERE timestamp >= datetime('now', '-${Math.max(1, days | 0)} day')
    ORDER BY timestamp ASC;
  `;
  const { stdout } = await execFileP('sqlite3', ['-json', dbPath, sql], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!stdout.trim()) return [];
  const raw = JSON.parse(stdout) as Array<{
    id: string;
    timestamp: string;
    sender: string;
    recipient: string;
    type: string;
    message: string;
    severity: string | null;
  }>;
  return raw.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    from: r.sender,
    to: r.recipient,
    type: r.type,
    message: r.message,
    severity: r.severity,
  }));
}

async function runSql(dbPath: string, sql: string): Promise<void> {
  await execFileP('sqlite3', [dbPath, sql], { maxBuffer: 1024 * 1024 });
}

function q(value: string): string {
  // SQL string literal escaping for sqlite3 CLI input.
  return `'${value.replace(/'/g, "''")}'`;
}

const SCHEMA_SQL = `
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
  CREATE INDEX IF NOT EXISTS harness_messages_timestamp_idx ON harness_messages(timestamp DESC);
  CREATE INDEX IF NOT EXISTS harness_messages_from_to_idx ON harness_messages("from", "to");
`;

// ---------------------------------------------------------------------------
// Embedded HTML (KakaoTalk-style chat viewer — vanilla JS + Tailwind CDN)
// ---------------------------------------------------------------------------

function renderHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>하네스 톡방</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", sans-serif; }
    .chat-bg { background: #b2c7d9; }
    .chat-bubble-bg { background: #ffeb3b; }
    @keyframes dot { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
    .dot { animation: dot 1.4s infinite; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
  </style>
</head>
<body class="h-screen overflow-hidden">
  <div id="root" class="flex h-screen">
    <div class="flex items-center justify-center w-full text-gray-400">불러오는 중...</div>
  </div>
  <script>
${CLIENT_JS}
  </script>
</body>
</html>`;
}

// Vanilla-JS port of the KakaoTalk chat viewer. Rendered into #root by polling
// /api/messages every 2 seconds and re-drawing the room list + selected room.
const CLIENT_JS = /* js */ `
const ROLES = {
  '대표님':            { icon: '👔', color: 'text-purple-700', bg: 'bg-purple-100', label: '대표님' },
  '공동대표':          { icon: '⭐', color: 'text-violet-700', bg: 'bg-violet-100', label: '공동대표' },
  '부장':              { icon: '🧑‍💼', color: 'text-blue-700',   bg: 'bg-blue-100',   label: '부장' },
  '외부팀원':          { icon: '🌐', color: 'text-gray-700',   bg: 'bg-gray-100',   label: '외부팀원' },
  // Engineering core teams
  'consultant':        { icon: '🤝', color: 'text-indigo-700', bg: 'bg-indigo-100', label: '컨설턴트' },
  'dev-team':          { icon: '💻', color: 'text-violet-700', bg: 'bg-violet-100', label: '개발팀' },
  'architect-team':    { icon: '🏗️', color: 'text-cyan-700',   bg: 'bg-cyan-100',   label: '아키텍처팀' },
  'code-review-team':  { icon: '📝', color: 'text-yellow-700', bg: 'bg-yellow-100', label: '코드리뷰팀' },
  'doc-sync-team':     { icon: '📄', color: 'text-orange-700', bg: 'bg-orange-100', label: '문서관리팀' },
  'security-team':     { icon: '🛡️', color: 'text-red-700',    bg: 'bg-red-100',    label: '보안팀' },
  'db-guard-team':     { icon: '🗄️', color: 'text-green-700',  bg: 'bg-green-100',  label: 'DB팀' },
  'qa-team':           { icon: '🧪', color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'QA팀' },
  'verifier-team':     { icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-100', label: '검수팀' },
  // Content production teams (added 0.5.0)
  'research-team':     { icon: '🔍', color: 'text-sky-700',    bg: 'bg-sky-100',    label: '리서치팀' },
  'analysis-team':     { icon: '📊', color: 'text-amber-700',  bg: 'bg-amber-100',  label: '분석팀' },
  'script-team':       { icon: '✍️', color: 'text-pink-700',   bg: 'bg-pink-100',   label: '대본팀' },
  'image-team':        { icon: '🎨', color: 'text-fuchsia-700',bg: 'bg-fuchsia-100',label: '이미지팀' },
  'voice-team':        { icon: '🎙️', color: 'text-rose-700',   bg: 'bg-rose-100',   label: '음성팀' },
  'edit-team':         { icon: '🎬', color: 'text-stone-700',  bg: 'bg-stone-100',  label: '편집팀' },
  'content-qa-team':   { icon: '🔎', color: 'text-lime-700',   bg: 'bg-lime-100',   label: '콘텐츠검수팀' },
};

const ROOMS = [
  // Top-level
  { id: '대표님',           name: '대표 보고',     icon: '👔', members: ['대표님', '공동대표', 'consultant', '부장'] },
  { id: '공동대표',         name: '공동대표',      icon: '⭐', members: ['대표님', '공동대표', '부장'] },
  { id: 'consultant',       name: '컨설턴트',      icon: '🤝', members: ['consultant', '부장'] },
  // Engineering teams
  { id: 'architect-team',   name: '아키텍처팀',    icon: '🏗️', members: ['부장', 'architect-team'] },
  { id: 'dev-team',         name: '개발팀',        icon: '💻', members: ['부장', 'dev-team'] },
  { id: 'code-review-team', name: '코드리뷰팀',    icon: '📝', members: ['부장', 'code-review-team'] },
  { id: 'security-team',    name: '보안팀',        icon: '🛡️', members: ['부장', 'security-team'] },
  { id: 'db-guard-team',    name: 'DB팀',          icon: '🗄️', members: ['부장', 'db-guard-team'] },
  { id: 'qa-team',          name: 'QA팀',          icon: '🧪', members: ['부장', 'qa-team'] },
  { id: 'verifier-team',    name: '검수팀',        icon: '✅', members: ['부장', 'verifier-team'] },
  { id: 'doc-sync-team',    name: '문서관리팀',    icon: '📄', members: ['부장', 'doc-sync-team'] },
  // Content production teams (added 0.5.0)
  { id: 'research-team',    name: '리서치팀',      icon: '🔍', members: ['부장', 'research-team'] },
  { id: 'analysis-team',    name: '분석팀',        icon: '📊', members: ['부장', 'analysis-team'] },
  { id: 'script-team',      name: '대본팀',        icon: '✍️', members: ['부장', 'script-team'] },
  { id: 'image-team',       name: '이미지팀',      icon: '🎨', members: ['부장', 'image-team'] },
  { id: 'voice-team',       name: '음성팀',        icon: '🎙️', members: ['부장', 'voice-team'] },
  { id: 'edit-team',         name: '편집팀',       icon: '🎬', members: ['부장', 'edit-team'] },
  { id: 'content-qa-team',  name: '콘텐츠검수팀',  icon: '🔎', members: ['부장', 'content-qa-team'] },
  // External (0.5.1) — catches any from/to == '외부팀원' (Director's external dispatch logging)
  { id: '외부팀원',         name: '외부팀원',      icon: '🌐', members: ['부장', '외부팀원', '공동대표'] },
];

const STORAGE_KEY = 'harness-bujang-read';
const FILTER_KEY = 'harness-bujang-filter';
const state = {
  messages: [],
  selectedRoom: null,
  readCounts: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'),
  filter: localStorage.getItem(FILTER_KEY) || 'all',  // 'all' | 'unread'
  loading: true,
};

function getRole(name) {
  return ROLES[name] || { icon: '💬', color: 'text-gray-700', bg: 'bg-gray-100', label: name };
}

function getRoleLabel(name) {
  return (ROLES[name] && ROLES[name].label) || name;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return ampm + ' ' + hour + ':' + m;
}

function formatDate(ts) {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

function filterMessages(messages, roomId) {
  if (roomId === 'all') return messages;
  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return [];
  return messages.filter((m) => {
    if (!room.members.includes(m.from) || !room.members.includes(m.to)) return false;
    const smaller = ROOMS.find(
      (r) =>
        r.id !== roomId &&
        r.members.length < room.members.length &&
        r.members.includes(m.from) &&
        r.members.includes(m.to),
    );
    return !smaller;
  });
}

function getLastMessage(messages, roomId) {
  const filtered = filterMessages(messages, roomId);
  return filtered.length ? filtered[filtered.length - 1] : null;
}

function severityBadge(sev) {
  if (!sev) return '';
  const m = { error: 'bg-red-500', warning: 'bg-yellow-500', info: 'bg-green-500' };
  return '<span class="inline-block px-1.5 py-0.5 text-[10px] font-bold ' + (m[sev] || 'bg-gray-500') + ' text-white rounded mr-1">' +
         (sev === 'error' ? 'ERROR' : sev === 'warning' ? 'WARN' : 'INFO') + '</span>';
}

function render() {
  const root = document.getElementById('root');
  if (state.loading) {
    root.innerHTML = '<div class="flex items-center justify-center w-full text-gray-400">불러오는 중...</div>';
    return;
  }

  const errors   = state.messages.filter((m) => m.severity === 'error').length;
  const warnings = state.messages.filter((m) => m.severity === 'warning').length;
  const infos    = state.messages.filter((m) => m.severity === 'info').length;

  // Pre-compute unread per room (for the filter button + badges).
  const unreadByRoom = {};
  let totalUnread = 0;
  for (const room of ROOMS) {
    const count = filterMessages(state.messages, room.id).length;
    const unread = Math.max(0, count - (state.readCounts[room.id] || 0));
    unreadByRoom[room.id] = unread;
    totalUnread += unread;
  }

  let html = '<div class="w-80 border-r border-gray-200 bg-white flex flex-col h-full">';
  html += '<div class="p-4 border-b border-gray-200">';
  html += '<h1 class="text-lg font-bold text-gray-900">하네스 톡방</h1>';
  html += '<p class="text-xs text-gray-500 mt-1">에이전트 간 보고 & 지시 — ' + state.messages.length + '개 메시지</p>';
  if (state.messages.length > 0) {
    html += '<div class="flex gap-2 mt-2">';
    if (errors)   html += '<span class="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">ERR ' + errors + '</span>';
    if (warnings) html += '<span class="px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full">WARN ' + warnings + '</span>';
    if (infos)    html += '<span class="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">INFO ' + infos + '</span>';
    html += '</div>';
  }

  // Filter buttons — KakaoTalk-style: 전체 / 안읽음
  html += '<div class="flex gap-2 mt-3">';
  html += '<button data-filter="all" class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ' +
          (state.filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50') +
          '">전체</button>';
  html += '<button data-filter="unread" class="px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors flex items-center gap-1.5 ' +
          (state.filter === 'unread' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50') +
          '">';
  html += '<span>💬 안읽음</span>';
  if (totalUnread > 0) {
    html += '<span class="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">' + totalUnread + '</span>';
  }
  html += '</button>';
  html += '</div>';
  html += '</div>';

  html += '<div id="room-list" class="flex-1 overflow-y-auto">';
  // When 'unread' filter is active, only show rooms with unread > 0.
  const visibleRooms = state.filter === 'unread'
    ? ROOMS.filter((r) => unreadByRoom[r.id] > 0)
    : ROOMS;

  if (visibleRooms.length === 0) {
    html += '<div class="px-4 py-12 text-center"><p class="text-3xl mb-2">📭</p><p class="text-xs text-gray-500">안읽은 톡방이 없습니다</p></div>';
  }

  for (const room of visibleRooms) {
    const last = getLastMessage(state.messages, room.id);
    const count = filterMessages(state.messages, room.id).length;
    const isSelected = state.selectedRoom === room.id;
    const unread = unreadByRoom[room.id];
    html += '<button data-room-id="' + escapeHtml(room.id) + '" class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ' +
            (isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50') + '">';
    html += '<div class="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">' + room.icon + '</div>';
    html += '<div class="flex-1 min-w-0">';
    html += '<div class="flex items-center justify-between"><span class="text-sm font-semibold text-gray-900 truncate">' +
            escapeHtml(room.name) + ' <span class="text-xs text-gray-400 font-normal ml-1">' + room.members.length + '</span></span>';
    if (last) html += '<span class="text-xs text-gray-400 flex-shrink-0 ml-2">' + formatTime(last.timestamp) + '</span>';
    html += '</div>';
    html += '<div class="flex items-center gap-1 mt-0.5">';
    if (last && last.severity) html += severityBadge(last.severity);
    html += '<p class="text-xs text-gray-500 truncate">' + (last ? escapeHtml(last.message) : '대화 없음') + '</p>';
    html += '</div></div>';
    if (unread > 0) html += '<span class="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">' + unread + '</span>';
    html += '</button>';
  }
  html += '</div></div>';

  // Right pane
  html += '<div class="flex-1 flex flex-col chat-bg h-full">';
  if (!state.selectedRoom) {
    html += '<div class="flex-1 flex items-center justify-center"><div class="text-center"><p class="text-5xl mb-3">🏢</p><p class="text-sm text-white/80">채팅방을 클릭해서 열어주세요</p></div></div>';
  } else {
    const roomInfo = ROOMS.find((r) => r.id === state.selectedRoom);
    const roomMessages = filterMessages(state.messages, state.selectedRoom);
    html += '<div class="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3">';
    html += '<span class="text-xl">' + (roomInfo ? roomInfo.icon : '💬') + '</span>';
    html += '<div><h2 class="text-sm font-semibold text-gray-900">' + escapeHtml(roomInfo ? roomInfo.name : state.selectedRoom) + '</h2>';
    html += '<p class="text-xs text-gray-400">' + (roomInfo ? roomInfo.members.map(getRoleLabel).join(', ') : '') + '</p></div>';
    html += '<span class="ml-auto text-xs text-gray-400">' + roomMessages.length + '개 메시지</span></div>';

    html += '<div id="conversation" class="flex-1 overflow-y-auto px-5 py-4">';
    if (roomMessages.length === 0) {
      html += '<div class="flex items-center justify-center h-full"><div class="text-center"><p class="text-4xl mb-2">💬</p><p class="text-sm text-white/80">대화가 없습니다.</p></div></div>';
    } else {
      // Group by date
      let lastDate = '';
      for (const msg of roomMessages) {
        const date = formatDate(msg.timestamp);
        if (date !== lastDate) {
          html += '<div class="flex justify-center my-3"><span class="px-3 py-1 text-xs bg-white/40 text-gray-700 rounded-full">' + date + '</span></div>';
          lastDate = date;
        }
        const role = getRole(msg.from);
        const isMine = msg.from === '대표님';
        html += '<div class="mb-3 flex ' + (isMine ? 'justify-end' : 'gap-2') + '">';
        if (!isMine) {
          html += '<div class="flex-shrink-0 w-9 h-9 rounded-2xl ' + role.bg + ' flex items-center justify-center text-lg">' + role.icon + '</div>';
        }
        html += '<div class="' + (isMine ? 'max-w-[70%]' : 'max-w-[70%]') + '">';
        if (!isMine) {
          html += '<p class="text-xs text-gray-700 mb-1">' + escapeHtml(role.label) + '</p>';
        }
        html += '<div class="flex items-end gap-1 ' + (isMine ? 'flex-row-reverse' : '') + '">';
        html += '<div class="px-3 py-2 ' + (isMine ? 'chat-bubble-bg text-gray-900' : 'bg-white text-gray-900') + ' rounded-2xl shadow-sm">';
        if (msg.severity) html += '<div class="mb-1">' + severityBadge(msg.severity) + '</div>';
        html += '<p class="text-sm whitespace-pre-wrap break-words">' + escapeHtml(msg.message) + '</p>';
        html += '</div>';
        html += '<span class="text-[10px] text-gray-600 flex-shrink-0">' + formatTime(msg.timestamp) + '</span>';
        html += '</div></div></div>';
      }
    }
    html += '</div>';

    // Footer — read-only viewer reminder. The viewer is a monitor for agent
    // activity; real commands go to Claude Code itself. (Auto-pickup of
    // principal messages from this viewer is on the roadmap.)
    html += '<div class="px-4 py-2 bg-white border-t border-gray-200 text-center">';
    html += '<p class="text-xs text-gray-400">읽기 전용 뷰어 — 명령은 Claude Code 터미널에서 부장님께 직접 말씀하세요</p>';
    html += '</div>';
  }
  html += '</div>';

  // Save scroll positions BEFORE replacing innerHTML — otherwise every 2s poll
  // resets the sidebar room-list scroll to top, and the conversation re-snaps
  // to the bottom even if the user was reading older messages.
  const oldRoomList = document.getElementById('room-list');
  const oldConv = document.getElementById('conversation');
  const savedRoomScroll = oldRoomList ? oldRoomList.scrollTop : 0;
  let savedConvScroll = null;
  let convWasAtBottom = true;
  if (oldConv) {
    savedConvScroll = oldConv.scrollTop;
    // "At bottom" within ~80px — if user was at bottom we keep them at bottom
    // (so new messages stay visible). If they scrolled up, preserve position.
    convWasAtBottom = (oldConv.scrollHeight - oldConv.scrollTop - oldConv.clientHeight) < 80;
  }

  root.innerHTML = html;

  // Restore scroll positions.
  const newRoomList = document.getElementById('room-list');
  if (newRoomList) newRoomList.scrollTop = savedRoomScroll;

  // Re-bind filter buttons (전체 / 안읽음).
  document.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      state.filter = el.getAttribute('data-filter');
      localStorage.setItem(FILTER_KEY, state.filter);
      render();
    });
  });

  // Re-bind room-click handlers (room list).
  document.querySelectorAll('[data-room-id]').forEach((el) => {
    el.addEventListener('click', () => {
      state.selectedRoom = el.getAttribute('data-room-id');
      const count = filterMessages(state.messages, state.selectedRoom).length;
      state.readCounts[state.selectedRoom] = count;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.readCounts));
      render();
      const conv = document.getElementById('conversation');
      if (conv) conv.scrollTop = conv.scrollHeight;
    });
  });

  // Conversation scroll handling:
  //  - First render of a room → scroll to bottom (latest msg visible)
  //  - User was at bottom → keep at new bottom (so new msgs auto-show)
  //  - User scrolled up to read history → preserve their position
  const conv = document.getElementById('conversation');
  if (conv) {
    if (conv.dataset.scrolled !== state.selectedRoom) {
      conv.scrollTop = conv.scrollHeight;
      conv.dataset.scrolled = state.selectedRoom;
    } else if (convWasAtBottom) {
      conv.scrollTop = conv.scrollHeight;
    } else if (savedConvScroll !== null) {
      conv.scrollTop = savedConvScroll;
    }
  }
}

async function refresh() {
  try {
    const res = await fetch('/api/messages?days=14');
    const json = await res.json();
    state.messages = (json.data || []).map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      from: m.from,
      to: m.to,
      type: m.type,
      message: m.message,
      severity: m.severity || undefined,
    }));
    state.loading = false;
    render();
  } catch (e) {
    state.loading = false;
    render();
  }
}

refresh();
setInterval(refresh, 2000);
`;
