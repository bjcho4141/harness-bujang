'use client';

import { useEffect, useState, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  type: 'command' | 'report' | 'feedback' | 'info';
  message: string;
  severity?: 'error' | 'warning' | 'info';
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Roles & Rooms
//
// Edit these constants to match your harness configuration.
// Role names must match what the Director / teams use as `from` / `to` in
// chat-room INSERTs.
// ---------------------------------------------------------------------------

const ROLES: Record<string, { icon: string; color: string; bg: string; label?: string }> = {
  '대표님':           { icon: '👔', color: 'text-purple-700', bg: 'bg-purple-100' },
  '부장':             { icon: '🧑‍💼', color: 'text-blue-700',   bg: 'bg-blue-100',   label: '부장' },
  'consultant':       { icon: '🤝', color: 'text-indigo-700', bg: 'bg-indigo-100', label: '컨설턴트' },
  'dev-team':         { icon: '💻', color: 'text-violet-700', bg: 'bg-violet-100', label: '개발팀' },
  'architect-team':   { icon: '🏗️', color: 'text-cyan-700',   bg: 'bg-cyan-100',   label: '아키텍처팀' },
  'code-review-team': { icon: '📝', color: 'text-yellow-700', bg: 'bg-yellow-100', label: '코드리뷰팀' },
  'doc-sync-team':    { icon: '📄', color: 'text-orange-700', bg: 'bg-orange-100', label: '문서관리팀' },
  'security-team':    { icon: '🛡️', color: 'text-red-700',    bg: 'bg-red-100',    label: '보안팀' },
  'db-guard-team':    { icon: '🗄️', color: 'text-green-700',  bg: 'bg-green-100',  label: 'DB팀' },
  'qa-team':          { icon: '🧪', color: 'text-teal-700',   bg: 'bg-teal-100',   label: 'QA팀' },
  'verifier-team':    { icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-100', label: '검수팀' },
};

const ROOMS = [
  { id: '대표님',           name: '대표 보고',     icon: '👔', members: ['대표님', 'consultant', '부장'] },
  { id: 'consultant',       name: '컨설턴트',      icon: '🤝', members: ['consultant', '부장'] },
  { id: 'architect-team',   name: '아키텍처팀',    icon: '🏗️', members: ['부장', 'architect-team'] },
  { id: 'code-review-team', name: '코드리뷰팀',    icon: '📝', members: ['부장', 'code-review-team'] },
  { id: 'doc-sync-team',    name: '문서관리팀',    icon: '📄', members: ['부장', 'doc-sync-team'] },
  { id: 'security-team',    name: '보안팀',        icon: '🛡️', members: ['부장', 'security-team'] },
  { id: 'db-guard-team',    name: 'DB팀',          icon: '🗄️', members: ['부장', 'db-guard-team'] },
  { id: 'qa-team',          name: 'QA팀',          icon: '🧪', members: ['부장', 'qa-team'] },
  { id: 'verifier-team',    name: '검수팀',        icon: '✅', members: ['부장', 'verifier-team'] },
  { id: 'dev-team',         name: '개발팀',        icon: '💻', members: ['부장', 'dev-team'] },
];

const STORAGE_KEY = 'harness-bujang-read';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRole(name: string) {
  return ROLES[name] || { icon: '💬', color: 'text-gray-700', bg: 'bg-gray-100' };
}

function getRoleLabel(name: string) {
  return ROLES[name]?.label ?? name;
}

function formatTime(timestamp: string) {
  const d = new Date(timestamp);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${hour}:${m}`;
}

function formatDate(timestamp: string) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function filterMessages(messages: ChatMessage[], roomId: string): ChatMessage[] {
  if (roomId === 'all') return messages;

  const room = ROOMS.find((r) => r.id === roomId);
  if (!room) return [];

  return messages.filter((m) => {
    if (!room.members.includes(m.from) || !room.members.includes(m.to)) return false;

    // Prefer the more specific (smaller-membered) room when multiple match.
    const smallerRoom = ROOMS.find(
      (r) =>
        r.id !== roomId &&
        r.members.length < room.members.length &&
        r.members.includes(m.from) &&
        r.members.includes(m.to),
    );
    return !smallerRoom;
  });
}

function getLastMessage(messages: ChatMessage[], roomId: string): ChatMessage | null {
  const filtered = filterMessages(messages, roomId);
  return filtered.length > 0 ? filtered[filtered.length - 1] : null;
}

function getSeverityBadge(severity?: string) {
  switch (severity) {
    case 'error':   return <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded">ERROR</span>;
    case 'warning': return <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500 text-white rounded">WARN</span>;
    case 'info':    return <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded">INFO</span>;
    default:        return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HarnessClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setReadCounts(JSON.parse(stored));
  }, []);

  // Polling: load last 2 days, refresh every 2 seconds.
  useEffect(() => {
    function fetchMessages() {
      fetch('/api/harness/logs?days=2')
        .then((res) => res.json())
        .then((res) => {
          const fresh: ChatMessage[] = res.data || [];
          setMessages((prev) => {
            if (prev.length === 0) return fresh;
            const oldestFreshTs = fresh.length > 0 ? fresh[0].timestamp : '';
            const olderMessages = prev.filter((m) => m.timestamp < oldestFreshTs);
            return [...olderMessages, ...fresh];
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, []);

  async function loadOlderMessages() {
    if (loadingOlder || !hasOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const oldestTs = messages[0].timestamp;
    try {
      const res = await fetch(`/api/harness/logs?before=${encodeURIComponent(oldestTs)}&limit=50`);
      const data = await res.json();
      const older: ChatMessage[] = data.data || [];
      if (older.length === 0) {
        setHasOlder(false);
      } else {
        const el = chatContainerRef.current;
        const prevHeight = el?.scrollHeight || 0;
        setMessages((prev) => [...older, ...prev]);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
    } catch { /* ignore */ }
    setLoadingOlder(false);
  }

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 80;
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (el.scrollTop < 50 && hasOlder && !loadingOlder) {
        loadOlderMessages();
      }
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, hasOlder, loadingOlder, messages]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedRoom) {
      isNearBottomRef.current = true;
      setHasOlder(true);
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [selectedRoom]);

  function enterRoom(roomId: string) {
    setSelectedRoom(roomId);
    const count = filterMessages(messages, roomId).length;
    const newCounts = { ...readCounts, [roomId]: count };
    setReadCounts(newCounts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newCounts));
  }

  const roomMessages = selectedRoom ? filterMessages(messages, selectedRoom) : [];
  const selectedRoomInfo = ROOMS.find((r) => r.id === selectedRoom);

  const dateGroups: { date: string; messages: ChatMessage[] }[] = [];
  let lastDate = '';
  for (const msg of roomMessages) {
    const date = formatDate(msg.timestamp);
    if (date !== lastDate) {
      dateGroups.push({ date, messages: [msg] });
      lastDate = date;
    } else {
      dateGroups[dateGroups.length - 1].messages.push(msg);
    }
  }

  const errors   = messages.filter((m) => m.severity === 'error').length;
  const warnings = messages.filter((m) => m.severity === 'warning').length;
  const infos    = messages.filter((m) => m.severity === 'info').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] text-gray-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar — room list */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">하네스 톡방</h1>
          <p className="text-xs text-gray-500 mt-1">에이전트 간 보고 & 지시</p>

          {messages.length > 0 && (
            <div className="flex gap-2 mt-2">
              {errors > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                  ERR {errors}
                </span>
              )}
              {warnings > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full">
                  WARN {warnings}
                </span>
              )}
              {infos > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                  INFO {infos}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {ROOMS.map((room) => {
            const last = getLastMessage(messages, room.id);
            const count = filterMessages(messages, room.id).length;
            const isSelected = selectedRoom === room.id;
            const unread = count - (readCounts[room.id] || 0);

            return (
              <button
                key={room.id}
                onDoubleClick={() => enterRoom(room.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl">
                  {room.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {room.name}
                      <span className="text-xs text-gray-400 font-normal ml-1">
                        {room.members.length}
                      </span>
                    </span>
                    {last && (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(last.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {last?.severity && getSeverityBadge(last.severity)}
                    <p className="text-xs text-gray-500 truncate">
                      {last ? last.message : '대화 없음'}
                    </p>
                  </div>
                </div>

                {unread > 0 && (
                  <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right pane — conversation */}
      <div className="flex-1 flex flex-col bg-[#b2c7d9]">
        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-5xl mb-3">🏢</p>
              <p className="text-sm text-white/70">채팅방을 더블클릭해서 열어주세요</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3">
              <span className="text-xl">{selectedRoomInfo?.icon}</span>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {selectedRoomInfo?.name}
                </h2>
                <p className="text-xs text-gray-400">
                  {selectedRoomInfo?.members.map(getRoleLabel).join(', ')}
                </p>
              </div>
              <span className="ml-auto text-xs text-gray-400">
                {roomMessages.length}개 메시지
              </span>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-5 py-4">
              {roomMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-4xl mb-2">💬</p>
                    <p className="text-sm text-white/70">아직 대화가 없습니다</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {loadingOlder && (
                    <div className="flex justify-center py-3">
                      <span className="text-xs text-white/60">이전 대화 불러오는 중...</span>
                    </div>
                  )}
                  {!hasOlder && messages.length > 0 && (
                    <div className="flex justify-center py-3">
                      <span className="text-xs text-white/40">더 이상 이전 대화가 없습니다</span>
                    </div>
                  )}
                  {dateGroups.map((group) => (
                    <div key={group.date}>
                      <div className="flex items-center justify-center my-4">
                        <span className="bg-black/20 text-white text-xs px-3 py-1 rounded-full">
                          {group.date}
                        </span>
                      </div>

                      {group.messages.map((msg, i) => {
                        const role = getRole(msg.from);
                        const prevMsg = i > 0 ? group.messages[i - 1] : null;
                        const isSameAuthor = prevMsg?.from === msg.from;
                        const isMe = msg.from === '대표님';

                        if (isMe) {
                          return (
                            <div key={msg.id} className={`flex justify-end ${isSameAuthor ? 'mt-0.5' : 'mt-3'}`}>
                              <div className="flex items-end gap-1.5 max-w-[70%]">
                                <span className="text-xs text-gray-500/70 flex-shrink-0 pb-0.5">
                                  {formatTime(msg.timestamp)}
                                </span>
                                <div className="bg-[#fee500] rounded-xl px-3 py-2 shadow-sm">
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                    {msg.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className={`flex gap-2 ${isSameAuthor ? 'mt-0.5' : 'mt-3'}`}>
                            {!isSameAuthor ? (
                              <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${role.bg} flex items-center justify-center text-lg`}>
                                {role.icon}
                              </div>
                            ) : (
                              <div className="w-10 flex-shrink-0" />
                            )}

                            <div className="flex-1 min-w-0">
                              {!isSameAuthor && (
                                <p className={`text-xs font-semibold mb-1 ${role.color}`}>
                                  {getRoleLabel(msg.from)}
                                </p>
                              )}

                              <div className="flex items-end gap-1.5">
                                <div className="max-w-[70%]">
                                  <div className="bg-white rounded-xl px-3 py-2 shadow-sm">
                                    {msg.severity && (
                                      <div className="mb-1">{getSeverityBadge(msg.severity)}</div>
                                    )}
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                                      {msg.message}
                                    </p>
                                  </div>
                                </div>

                                <span className="text-xs text-gray-500/70 flex-shrink-0 pb-0.5">
                                  {formatTime(msg.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-white border-t border-gray-200">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!inputText.trim() || sending || !selectedRoom) return;
                  setSending(true);
                  try {
                    await fetch('/api/harness/reply', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: inputText.trim(), room: selectedRoom }),
                    });
                    setInputText('');
                    isNearBottomRef.current = true;
                  } catch { /* ignore */ }
                  setSending(false);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="대표님으로 메시지 보내기..."
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="flex-shrink-0 w-10 h-10 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 disabled:opacity-30 disabled:hover:bg-indigo-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
