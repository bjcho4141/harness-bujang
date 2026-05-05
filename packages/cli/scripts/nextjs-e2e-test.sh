#!/usr/bin/env bash
# Next.js + better-sqlite3 + chat-room UI integration e2e test.
#
# Bootstraps a minimal Next.js 16 sandbox, runs `bujang init` (which installs
# the chat-room UI / API routes / DB adapters), npm-installs `next` +
# `better-sqlite3`, stubs `verifySuperAdmin()`, starts the dev server, and
# probes the live API endpoints with curl.
#
# Two modes:
#   - default (fast):    structure-only — checks that init copied every chat-room
#                        UI / API / DB-adapter file into the sandbox.
#   - HARNESS_E2E_FULL=1 (slow ~5min): also runs `npm install` + boots the dev
#                        server + hits the real endpoints.
#
# Usage:
#   ./scripts/nextjs-e2e-test.sh                 # fast static check
#   HARNESS_E2E_FULL=1 ./scripts/nextjs-e2e-test.sh   # full integration

set -euo pipefail

CLI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="${SANDBOX:-/tmp/harness-nextjs-e2e-$$}"
PORT="${PORT:-3791}"

red()    { printf '\033[31m%s\033[39m\n' "$*"; }
green()  { printf '\033[32m%s\033[39m\n' "$*"; }
yellow() { printf '\033[33m%s\033[39m\n' "$*"; }
dim()    { printf '\033[2m%s\033[22m\n' "$*"; }

cleanup() {
  if [[ -n "${DEV_PID:-}" ]] && kill -0 "$DEV_PID" 2>/dev/null; then
    kill "$DEV_PID" 2>/dev/null || true
    wait "$DEV_PID" 2>/dev/null || true
  fi
  rm -rf "$SANDBOX"
}
trap cleanup EXIT

assert_file() {
  if [[ ! -f "$1" ]]; then
    red "  ✖ MISSING FILE: $1"
    exit 1
  fi
  green "  ✓ $(basename "$1")"
}

# ---------------------------------------------------------------------------
# Step 1 — Bootstrap a minimal Next.js project
# ---------------------------------------------------------------------------
yellow "== STEP 1 == bootstrap minimal Next.js sandbox"
mkdir -p "$SANDBOX"
cd "$SANDBOX"

cat > package.json <<'JSON'
{
  "name": "harness-nextjs-e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
JSON

cat > next.config.js <<'JS'
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
JS

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "allowJs": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "src/**/*", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
JSON

mkdir -p src/app
cat > src/app/page.tsx <<'TSX'
export default function Page() { return <h1>e2e sandbox</h1>; }
TSX
cat > src/app/layout.tsx <<'TSX'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
TSX

green "  ✓ Next.js scaffold ready"

# ---------------------------------------------------------------------------
# Step 2 — Run bujang init
# ---------------------------------------------------------------------------
yellow "== STEP 2 == bujang init --yes --lang=ko --chat=sqlite"
node "$CLI_ROOT/dist/index.js" init --target="$SANDBOX" --yes --lang=ko --chat=sqlite > /dev/null

# Engineering core agents
assert_file "$SANDBOX/.claude/agents/director.md"
assert_file "$SANDBOX/.claude/agents/dev-team.md"
# Content production agents (added 0.5.0)
assert_file "$SANDBOX/.claude/agents/research-team.md"
assert_file "$SANDBOX/.claude/agents/script-team.md"
# Cofounder (added 0.5.1)
assert_file "$SANDBOX/.claude/agents/cofounder.md"

# Chat-room UI files
assert_file "$SANDBOX/src/app/admin/harness/page.tsx"
assert_file "$SANDBOX/src/app/admin/harness/harness-client.tsx"

# API routes
assert_file "$SANDBOX/src/app/api/harness/logs/route.ts"
assert_file "$SANDBOX/src/app/api/harness/reply/route.ts"

# DB adapter library
assert_file "$SANDBOX/src/lib/harness-db/index.ts"
assert_file "$SANDBOX/src/lib/harness-db/sqlite.ts"
assert_file "$SANDBOX/src/lib/harness-db/types.ts"

# CLAUDE.md + learning log
assert_file "$SANDBOX/CLAUDE.md"
assert_file "$SANDBOX/docs/AGENT_LEARNING_LOG.md"

# Korean content check
grep -q "부장" "$SANDBOX/.claude/agents/director.md" || {
  red "  ✖ director.md missing Korean '부장'"
  exit 1
}
green "  ✓ Korean install verified"

# ---------------------------------------------------------------------------
# Step 3 — Stub verifySuperAdmin (the harness-template imports this from
# `@/lib/utils/admin` but doesn't ship the file — projects must implement it).
# ---------------------------------------------------------------------------
yellow "== STEP 3 == stub verifySuperAdmin()"
mkdir -p src/lib/utils
cat > src/lib/utils/admin.ts <<'TS'
export async function verifySuperAdmin() {
  // E2E-only stub: always grant super-admin. Real projects should replace
  // this with a Supabase / NextAuth / cookie-based check.
  return { isSuperAdmin: true };
}
TS
green "  ✓ src/lib/utils/admin.ts stub written"

# ---------------------------------------------------------------------------
# Step 4 — Env vars for the chat-room API routes
# ---------------------------------------------------------------------------
yellow "== STEP 4 == .env.local"
cat > .env.local <<'ENV'
HARNESS_DB=sqlite
HARNESS_SQLITE_PATH=./.harness/chat.db
HARNESS_WRITE_SECRET=e2e-test-secret
SUPER_ADMIN_EMAILS=e2e@example.com
ENV
green "  ✓ .env.local written"

# ---------------------------------------------------------------------------
# Static checks complete. Stop here unless HARNESS_E2E_FULL=1.
# ---------------------------------------------------------------------------
if [[ "${HARNESS_E2E_FULL:-0}" != "1" ]]; then
  echo
  green "🟢 STATIC CHECKS PASSED"
  dim "   sandbox: $SANDBOX (cleaned up on exit)"
  dim "   for full integration (npm install + dev server + HTTP probe), run:"
  dim "     HARNESS_E2E_FULL=1 ./scripts/nextjs-e2e-test.sh"
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 5 — npm install (slow, ~1-2 min)
# ---------------------------------------------------------------------------
yellow "== STEP 5 == npm install (next, react, better-sqlite3) — this takes a minute"
npm install --silent --no-audit --no-fund > /dev/null 2>&1
npm install --silent --no-audit --no-fund better-sqlite3 > /dev/null 2>&1
npm install --silent --no-audit --no-fund -D @types/better-sqlite3 > /dev/null 2>&1
# KNOWN ISSUE (TODO 0.5.4): even sqlite-only installs need @supabase/supabase-js because
# Next.js / Turbopack statically resolves the dynamic import('./supabase') from
# lib/harness-db/index.ts. Until lib/harness-db is split into per-adapter folders,
# the user (and this e2e) must `npm install @supabase/supabase-js`.
npm install --silent --no-audit --no-fund @supabase/supabase-js > /dev/null 2>&1
green "  ✓ dependencies installed (incl. @supabase/supabase-js — sqlite mode workaround)"

# ---------------------------------------------------------------------------
# Step 6 — Boot dev server, probe API endpoints
# ---------------------------------------------------------------------------
yellow "== STEP 6 == npm run dev — booting Next.js"
PORT=$PORT npm run dev > /tmp/harness-nextjs-dev.log 2>&1 &
DEV_PID=$!

# Wait up to 60s for the server to come up
for i in $(seq 1 60); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null | grep -qE '^(200|3[0-9][0-9])$'; then
    break
  fi
  sleep 1
done
green "  ✓ dev server up on http://localhost:$PORT"

# 6a. GET /api/harness/logs?days=1 — should return JSON with data array
LOGS_RES="$(curl -s "http://localhost:$PORT/api/harness/logs?days=1")"
echo "$LOGS_RES" | grep -q '"data"' || {
  red "  ✖ GET /api/harness/logs did not return a 'data' field"
  echo "  got: $LOGS_RES" | head -3
  exit 1
}
green "  ✓ GET /api/harness/logs returns JSON with data field"

# 6b. POST /api/harness/logs with x-harness-secret — insert a message
INSERT_BODY='{
  "id": "e2e-msg-'"$(date +%s)"'",
  "from": "부장",
  "to": "dev-team",
  "type": "command",
  "message": "[e2e test] 메시지 인서트 검증",
  "severity": "info"
}'
INS_RES="$(curl -s -X POST "http://localhost:$PORT/api/harness/logs" \
  -H 'content-type: application/json' \
  -H 'x-harness-secret: e2e-test-secret' \
  -d "$INSERT_BODY")"
echo "$INS_RES" | grep -qE '"id"|"data"' || {
  red "  ✖ POST /api/harness/logs failed"
  echo "  got: $INS_RES"
  exit 1
}
green "  ✓ POST /api/harness/logs inserted"

# 6c. GET again — see the new message
sleep 0.5
AFTER_RES="$(curl -s "http://localhost:$PORT/api/harness/logs?days=1")"
echo "$AFTER_RES" | grep -q "e2e test" || {
  red "  ✖ inserted message not visible in subsequent GET"
  echo "  got: $AFTER_RES" | head -5
  exit 1
}
green "  ✓ inserted message visible via API"

# 6d. GET /admin/harness — HTML page should render (super-admin stub)
HTML_RES="$(curl -s -L "http://localhost:$PORT/admin/harness")"
echo "$HTML_RES" | head -c 400 | grep -qE '<html|<!DOCTYPE|<body' || {
  red "  ✖ /admin/harness did not return HTML"
  echo "  got: $(echo "$HTML_RES" | head -c 200)"
  exit 1
}
green "  ✓ /admin/harness returns HTML"

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
echo
green "🟢 FULL INTEGRATION PASSED"
dim "   sandbox: $SANDBOX (cleaned up on exit)"
dim "   dev log: /tmp/harness-nextjs-dev.log"
