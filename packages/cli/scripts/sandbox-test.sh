#!/usr/bin/env bash
# Sandbox e2e test for the harness-bujang CLI.
#
# Creates a fresh tmp dir, runs init / status / chat in sequence, and asserts
# the expected files / endpoints are produced. Exits non-zero on any failure.
#
# Usage:
#   ./scripts/sandbox-test.sh                 # tests dist/index.js (run after build)
#   USE_TSX=1 ./scripts/sandbox-test.sh       # tests src/index.ts via tsx (faster iteration)

set -euo pipefail

CLI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="${SANDBOX:-/tmp/harness-sandbox-$$}"
PORT="${PORT:-7790}"

if [[ "${USE_TSX:-0}" == "1" ]]; then
  RUN=("npx" "tsx" "$CLI_ROOT/src/index.ts")
else
  RUN=("node" "$CLI_ROOT/dist/index.js")
fi

red()    { printf '\033[31m%s\033[39m\n' "$*"; }
green()  { printf '\033[32m%s\033[39m\n' "$*"; }
yellow() { printf '\033[33m%s\033[39m\n' "$*"; }
dim()    { printf '\033[2m%s\033[22m\n' "$*"; }

cleanup() {
  if [[ -n "${CHAT_PID:-}" ]] && kill -0 "$CHAT_PID" 2>/dev/null; then
    kill "$CHAT_PID" 2>/dev/null || true
    wait "$CHAT_PID" 2>/dev/null || true
  fi
  rm -rf "$SANDBOX"
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Step 1 — init (Korean, sqlite, --yes)
# ---------------------------------------------------------------------------
yellow "== STEP 1 == init --yes --lang=ko"
mkdir -p "$SANDBOX"
"${RUN[@]}" init --target="$SANDBOX" --yes --lang=ko > /dev/null

assert_file() {
  if [[ ! -f "$1" ]]; then
    red "  ✖ MISSING FILE: $1"
    exit 1
  fi
  green "  ✓ $(basename "$1")"
}

dim "  expecting agents + CLAUDE.md + learning log"
assert_file "$SANDBOX/.claude/agents/director.md"
assert_file "$SANDBOX/.claude/agents/dev-team.md"
assert_file "$SANDBOX/.claude/agents/verifier-team.md"
assert_file "$SANDBOX/CLAUDE.md"
assert_file "$SANDBOX/docs/AGENT_LEARNING_LOG.md"

# Korean content check
if grep -q "부장" "$SANDBOX/.claude/agents/director.md"; then
  green "  ✓ director.md contains '부장' (Korean)"
else
  red "  ✖ director.md does NOT contain '부장' — Korean install failed"
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2 — status
# ---------------------------------------------------------------------------
yellow "== STEP 2 == status"
STATUS_OUT="$("${RUN[@]}" status "$SANDBOX")"
echo "$STATUS_OUT" | grep -q "🟢 healthy" || {
  red "  ✖ status did not report healthy"
  echo "$STATUS_OUT"
  exit 1
}
green "  ✓ status: 🟢 healthy"

# ---------------------------------------------------------------------------
# Step 3 — chat (boot server, hit endpoints)
# ---------------------------------------------------------------------------
yellow "== STEP 3 == chat --create --no-open"
"${RUN[@]}" chat --target="$SANDBOX" --port="$PORT" --no-open --create > /dev/null 2>&1 &
CHAT_PID=$!

# Wait up to 5s for the server to be ready.
for i in $(seq 1 25); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/messages" | grep -q '^200$'; then
    break
  fi
  sleep 0.2
done

# 3a. GET /api/messages — must contain the seed row
SEED_BODY="$(curl -s "http://localhost:$PORT/api/messages")"
echo "$SEED_BODY" | grep -q "톡방이 생성되었습니다" || {
  red "  ✖ seed row missing from GET /api/messages"
  echo "  got: $SEED_BODY"
  exit 1
}
green "  ✓ GET /api/messages returns seed row"

# 3b. POST /api/messages — insert a fresh row
curl -s -X POST "http://localhost:$PORT/api/messages" \
  -H 'content-type: application/json' \
  -d '{"from":"부장","to":"dev-team","type":"command","message":"e2e sandbox 테스트","severity":"info"}' \
  > /dev/null
green "  ✓ POST /api/messages succeeded"

# 3c. GET after POST — must contain the new message
sleep 0.5
AFTER_BODY="$(curl -s "http://localhost:$PORT/api/messages")"
echo "$AFTER_BODY" | grep -q "e2e sandbox 테스트" || {
  red "  ✖ POSTed message not visible in subsequent GET"
  echo "  got: $AFTER_BODY"
  exit 1
}
green "  ✓ GET after POST shows the new row"

# 3d. GET / — must serve HTML
HTML_HEAD="$(curl -s "http://localhost:$PORT/" | head -c 60)"
echo "$HTML_HEAD" | grep -q "<!DOCTYPE html>" || {
  red "  ✖ GET / did not return HTML"
  echo "  got: $HTML_HEAD"
  exit 1
}
green "  ✓ GET / returns HTML"

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
echo
green "🟢 ALL CHECKS PASSED"
dim "   sandbox: $SANDBOX (cleaned up on exit)"
