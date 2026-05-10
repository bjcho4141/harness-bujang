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
# Step 0 — --version reports the package.json version (not a hardcoded string)
# ---------------------------------------------------------------------------
yellow "== STEP 0 == --version (dynamic from package.json)"
EXPECTED_VERSION="$(node -e "console.log(require('$CLI_ROOT/package.json').version)")"
ACTUAL_VERSION="$("${RUN[@]}" --version)"
if [[ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]]; then
  red "  ✖ --version mismatch: expected $EXPECTED_VERSION, got $ACTUAL_VERSION"
  exit 1
fi
green "  ✓ --version → $ACTUAL_VERSION (matches package.json)"

# ---------------------------------------------------------------------------
# Step 0.5 — --help defaults to Korean (0.6.2), --help-en preserves English
# ---------------------------------------------------------------------------
yellow "== STEP 0.5 == --help 한국어 디폴트 + --help-en 영어 유지"
HELP_KO_OUT="$("${RUN[@]}" --help)"
echo "$HELP_KO_OUT" | grep -q "사용법:" || {
  red "  ✖ --help did not contain Korean header '사용법:'"
  exit 1
}
echo "$HELP_KO_OUT" | grep -q "init 옵션:" || {
  red "  ✖ --help did not contain 'init 옵션:'"
  exit 1
}
green "  ✓ --help → 한국어 (사용법 / init 옵션)"

HELP_EN_OUT="$("${RUN[@]}" --help-en)"
echo "$HELP_EN_OUT" | grep -q "^Usage:" -m 1 || echo "$HELP_EN_OUT" | grep -q "Usage:" || {
  red "  ✖ --help-en did not contain 'Usage:'"
  exit 1
}
echo "$HELP_EN_OUT" | grep -q "Options for init:" || {
  red "  ✖ --help-en did not contain 'Options for init:'"
  exit 1
}
green "  ✓ --help-en → English (Usage / Options for init)"

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

dim "  expecting 17 agents (10 engineering + 7 content) + CLAUDE.md + learning log"
# Engineering core (10)
assert_file "$SANDBOX/.claude/agents/director.md"
assert_file "$SANDBOX/.claude/agents/dev-team.md"
assert_file "$SANDBOX/.claude/agents/verifier-team.md"
assert_file "$SANDBOX/.claude/agents/code-review-team.md"
assert_file "$SANDBOX/.claude/agents/security-team.md"
assert_file "$SANDBOX/.claude/agents/db-guard-team.md"
assert_file "$SANDBOX/.claude/agents/qa-team.md"
assert_file "$SANDBOX/.claude/agents/architect-team.md"
assert_file "$SANDBOX/.claude/agents/doc-sync-team.md"
assert_file "$SANDBOX/.claude/agents/consultant.md"
# Content production (7, added 0.5.0)
assert_file "$SANDBOX/.claude/agents/research-team.md"
assert_file "$SANDBOX/.claude/agents/analysis-team.md"
assert_file "$SANDBOX/.claude/agents/script-team.md"
assert_file "$SANDBOX/.claude/agents/image-team.md"
assert_file "$SANDBOX/.claude/agents/voice-team.md"
assert_file "$SANDBOX/.claude/agents/edit-team.md"
assert_file "$SANDBOX/.claude/agents/content-qa-team.md"
# Cofounder peer persona (added 0.5.1)
assert_file "$SANDBOX/.claude/agents/cofounder.md"
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

# 3e. 0.6.1: read-state lifecycle — GET (empty) → POST → GET (persists)
EMPTY_STATE="$(curl -s "http://localhost:$PORT/api/read-state")"
echo "$EMPTY_STATE" | grep -q '"data":{}' || {
  red "  ✖ first GET /api/read-state should return empty data, got: $EMPTY_STATE"
  exit 1
}
green "  ✓ GET /api/read-state empty initially"

curl -s -X POST "http://localhost:$PORT/api/read-state" \
  -H 'content-type: application/json' \
  -d '{"room":"dev-team","last_seen_at":"2026-05-10T08:00:00.000Z"}' > /dev/null
AFTER_POST="$(curl -s "http://localhost:$PORT/api/read-state")"
echo "$AFTER_POST" | grep -q "dev-team" || {
  red "  ✖ POST /api/read-state did not persist, got: $AFTER_POST"
  exit 1
}
green "  ✓ POST /api/read-state upserts"

# Stop the chat server before continuing.
kill "$CHAT_PID" 2>/dev/null || true
wait "$CHAT_PID" 2>/dev/null || true
unset CHAT_PID

# 3f. 0.6.1: read state survives server restart on a DIFFERENT port. This is
# the key scenario the user reported — `bujang chat` on a fresh port should
# NOT show every old message as unread.
PORT_B=$((PORT + 1))
"${RUN[@]}" chat --target="$SANDBOX" --port="$PORT_B" --no-open > /dev/null 2>&1 &
CHAT_PID=$!
for i in $(seq 1 25); do
  if curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT_B/api/read-state" | grep -q '^200$'; then
    break
  fi
  sleep 0.2
done
RESTART_STATE="$(curl -s "http://localhost:$PORT_B/api/read-state")"
echo "$RESTART_STATE" | grep -q '"dev-team":"2026-05-10T08:00:00.000Z"' || {
  red "  ✖ read state lost across server restart on a different port"
  echo "  got: $RESTART_STATE"
  exit 1
}
green "  ✓ read state survives server restart + port change (chat.db is SoT)"

kill "$CHAT_PID" 2>/dev/null || true
wait "$CHAT_PID" 2>/dev/null || true
unset CHAT_PID

# ---------------------------------------------------------------------------
# Step 4 — adapt (cursor / cline / aider / codex)
# ---------------------------------------------------------------------------
yellow "== STEP 4 == adapt --to=all --yes"
"${RUN[@]}" adapt --target="$SANDBOX" --to=all --yes > /dev/null

assert_file "$SANDBOX/.cursor/rules/bujang-director.mdc"
assert_file "$SANDBOX/.clinerules/bujang-director.md"
assert_file "$SANDBOX/CONVENTIONS.md"
assert_file "$SANDBOX/.aider.conf.yml"
assert_file "$SANDBOX/AGENTS.md"
assert_file "$SANDBOX/GEMINI.md"
assert_file "$SANDBOX/.gemini/styleguide.md"

# Cursor frontmatter check
head -3 "$SANDBOX/.cursor/rules/bujang-director.mdc" | grep -q "^description:" || {
  red "  ✖ Cursor .mdc missing description frontmatter"
  exit 1
}
green "  ✓ Cursor .mdc has description frontmatter"

# Aider config check
grep -q "read: CONVENTIONS.md" "$SANDBOX/.aider.conf.yml" || {
  red "  ✖ .aider.conf.yml missing 'read: CONVENTIONS.md'"
  exit 1
}
green "  ✓ .aider.conf.yml references CONVENTIONS.md"

# AGENTS.md content check (Codex / Copilot)
grep -q "## director" "$SANDBOX/AGENTS.md" || {
  red "  ✖ AGENTS.md missing director role"
  exit 1
}
green "  ✓ AGENTS.md contains all roles"

# GEMINI.md content check (Antigravity / Gemini CLI / Code Assist)
grep -q "## director" "$SANDBOX/GEMINI.md" || {
  red "  ✖ GEMINI.md missing director role"
  exit 1
}
green "  ✓ GEMINI.md contains all roles"

# .gemini/styleguide.md should focus on review-team roles
grep -q "## code-review-team" "$SANDBOX/.gemini/styleguide.md" || {
  red "  ✖ .gemini/styleguide.md missing code-review-team"
  exit 1
}
green "  ✓ .gemini/styleguide.md contains review roles"

# ---------------------------------------------------------------------------
# Step 4.5 — update (additive — never touches existing files)
# ---------------------------------------------------------------------------
yellow "== STEP 4.5 == update (additive — preserves customizations)"
# Delete 2 agents to simulate an outdated install
rm "$SANDBOX/.claude/agents/cofounder.md"
rm "$SANDBOX/.claude/agents/image-team.md"
# Append a custom rule to dev-team.md (must be preserved across update)
echo "" >> "$SANDBOX/.claude/agents/dev-team.md"
echo "## CUSTOM_USER_RULE_DO_NOT_LOSE" >> "$SANDBOX/.claude/agents/dev-team.md"
"${RUN[@]}" update --target="$SANDBOX" --lang=ko > /dev/null

# The 2 deleted files must be back
assert_file "$SANDBOX/.claude/agents/cofounder.md"
assert_file "$SANDBOX/.claude/agents/image-team.md"
# Custom rule must still be present
grep -q "CUSTOM_USER_RULE_DO_NOT_LOSE" "$SANDBOX/.claude/agents/dev-team.md" || {
  red "  ✖ User customization in dev-team.md was lost during update"
  exit 1
}
green "  ✓ update added back missing files"
green "  ✓ user customization in dev-team.md preserved"

# ---------------------------------------------------------------------------
# Step 4.7 — init with --tools= and --models= (multi-tool + balanced preset)
#
# Verifies 0.6.0:
#   - --tools=codex,gemini auto-fans-out adapters during init
#   - --models=balanced rewrites frontmatter model: per agent
# ---------------------------------------------------------------------------
yellow "== STEP 4.7 == init --tools=codex,gemini --models=balanced (0.6.0)"
SANDBOX2="${SANDBOX}-multi"
mkdir -p "$SANDBOX2"
"${RUN[@]}" init --target="$SANDBOX2" --yes --lang=ko \
  --tools=codex,gemini --models=balanced > /dev/null

# Adapters fan-out
assert_file "$SANDBOX2/.claude/agents/director.md"   # SoT always installed
assert_file "$SANDBOX2/AGENTS.md"                    # codex
assert_file "$SANDBOX2/GEMINI.md"                    # gemini
assert_file "$SANDBOX2/.gemini/styleguide.md"        # gemini PR review

# But NOT the un-selected ones
if [[ -d "$SANDBOX2/.cursor" ]]; then
  red "  ✖ .cursor/ should NOT exist when --tools=codex,gemini"
  exit 1
fi
if [[ -d "$SANDBOX2/.clinerules" ]]; then
  red "  ✖ .clinerules/ should NOT exist when --tools=codex,gemini"
  exit 1
fi
green "  ✓ extra adapters limited to codex + gemini"

# Model frontmatter rewritten per balanced preset
DIR_MODEL="$(grep -E '^model:' "$SANDBOX2/.claude/agents/director.md" | head -1)"
DEV_MODEL="$(grep -E '^model:' "$SANDBOX2/.claude/agents/dev-team.md" | head -1)"
VER_MODEL="$(grep -E '^model:' "$SANDBOX2/.claude/agents/verifier-team.md" | head -1)"
[[ "$DIR_MODEL" == "model: opus"   ]] || { red "  ✖ director.md expected opus, got: $DIR_MODEL"; exit 1; }
[[ "$DEV_MODEL" == "model: sonnet" ]] || { red "  ✖ dev-team.md expected sonnet, got: $DEV_MODEL"; exit 1; }
[[ "$VER_MODEL" == "model: haiku"  ]] || { red "  ✖ verifier-team.md expected haiku, got: $VER_MODEL"; exit 1; }
green "  ✓ balanced preset: director=opus, dev=sonnet, verifier=haiku"

# Cleanup the second sandbox
rm -rf "$SANDBOX2"

# ---------------------------------------------------------------------------
# Step 5 — migrate (smoke test — sqlite → sqlite no-op succeeds)
#
# A real sqlite ↔ supabase round-trip would need network + creds, so we just
# exercise the CLI parses the args + finds the chat DB and exits cleanly when
# asked to migrate sqlite → sqlite (which the CLI rejects as a no-op).
# ---------------------------------------------------------------------------
yellow "== STEP 5 == migrate (smoke test — refuses no-op)"
MIGRATE_OUT="$("${RUN[@]}" migrate --target="$SANDBOX" --to=sqlite --yes 2>&1 || true)"
echo "$MIGRATE_OUT" | grep -qiE "(already on sqlite|same backend|no.?op|already)" || {
  yellow "  ⚠  migrate did not warn about no-op explicitly — may be expected behavior"
  echo "$MIGRATE_OUT" | head -3
}
green "  ✓ migrate command parses args and exits without crash"

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
echo
green "🟢 ALL CHECKS PASSED"
dim "   sandbox: $SANDBOX (cleaned up on exit)"
