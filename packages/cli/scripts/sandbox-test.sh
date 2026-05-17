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
INIT_OUT="$("${RUN[@]}" init --target="$SANDBOX" --yes --lang=ko 2>&1)"

# 0.9.0: completion message must guide the user to (a) restart Claude Code
# and (b) open the chat room — via either natural language ("부장님 톡방 열어주세요")
# or the standalone CLI (`npx harness-bujang chat`). The slash command `/open-chat`
# was dropped from the message in 0.9.0 because users without the plugin installed
# wouldn't see it.
echo "$INIT_OUT" | grep -qE "(종료 후 재시작|Quit Claude Code and relaunch)" || {
  red "  ✖ init completion message missing restart instruction"
  echo "$INIT_OUT" | tail -30
  exit 1
}
echo "$INIT_OUT" | grep -q "npx harness-bujang chat" || {
  red "  ✖ init completion message missing 'npx harness-bujang chat' fallback"
  echo "$INIT_OUT" | tail -30
  exit 1
}
green "  ✓ completion message includes restart + chat-room guidance (0.9.0)"

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

# Korean persona name check (전 hybrid + post-hybrid 양쪽 호환)
if grep -q "부장" "$SANDBOX/.claude/agents/director.md"; then
  green "  ✓ director.md contains '부장' (Korean persona name preserved)"
else
  red "  ✖ director.md does NOT contain '부장' — Korean install failed"
  exit 1
fi

# 0.7.0 hybrid pattern check: instructions in English, Korean phrasing in body
# Director should now have English section headers AND Korean speech examples.
if grep -q "## 🚨 Chat-room INSERT" "$SANDBOX/.claude/agents/director.md" \
   || grep -q "## Identity" "$SANDBOX/.claude/agents/director.md"; then
  green "  ✓ director.md instructions in English (0.7.0 hybrid)"
else
  yellow "  ⚠  director.md missing expected English section headers (pre-0.7.0 install?)"
fi
if grep -q "완료했습니다" "$SANDBOX/.claude/agents/director.md" \
   && grep -q "판단 부탁드립니다" "$SANDBOX/.claude/agents/director.md"; then
  green "  ✓ director.md report-format Korean phrasing preserved (완료/판단 부탁드립니다)"
else
  yellow "  ⚠  director.md missing Korean report phrasing (pre-0.7.0 install?)"
fi
# dev-team should have English working principles + Korean fragment in INSERT example
if grep -q "Working principles" "$SANDBOX/.claude/agents/dev-team.md" \
   && grep -q "작업 완료" "$SANDBOX/.claude/agents/dev-team.md"; then
  green "  ✓ dev-team.md hybrid pattern OK (English instructions + Korean INSERT body)"
else
  yellow "  ⚠  dev-team.md hybrid pattern not detected"
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
# Step 4.8 — 0.8.0: per-tool model PRESETS (--codex-models=balanced etc.).
# Codex / Gemini get the same 5-preset UI as Claude — balanced means
# per-agent mapping, written as memo lines above each `## <agent>` section
# in AGENTS.md / GEMINI.md. Aider stays single-value (.aider.conf.yml).
# ---------------------------------------------------------------------------
yellow "== STEP 4.8 == init --tools=codex,gemini,aider --*-models=balanced (0.8.0)"
SANDBOX3="${SANDBOX}-pertool"
mkdir -p "$SANDBOX3"
"${RUN[@]}" init --target="$SANDBOX3" --yes --lang=ko \
  --tools=codex,gemini,aider \
  --codex-models=balanced \
  --gemini-models=balanced \
  --aider-model=claude-sonnet-4-6 > /dev/null

# Codex per-agent memos in AGENTS.md (balanced: dev=gpt-5-codex, security=o1, etc.)
CODEX_MEMOS="$(grep -c '💡 Recommended model' "$SANDBOX3/AGENTS.md" || true)"
if [[ "$CODEX_MEMOS" -lt 17 ]]; then
  red "  ✖ AGENTS.md should have ≥17 per-agent memos, got $CODEX_MEMOS"
  exit 1
fi
green "  ✓ AGENTS.md ← Codex 에이전트별 메모 ${CODEX_MEMOS}건 (balanced)"

# Verify mapping diversity — balanced should produce multiple distinct models.
DISTINCT_CODEX="$(grep -oE 'Recommended model: \`[^`]+\`' "$SANDBOX3/AGENTS.md" | sort -u | wc -l | tr -d ' ')"
if [[ "$DISTINCT_CODEX" -lt 3 ]]; then
  red "  ✖ Codex balanced should produce ≥3 distinct models, got $DISTINCT_CODEX"
  exit 1
fi
green "  ✓ Codex balanced 매핑 다양성: $DISTINCT_CODEX 종류 (gpt-5 / gpt-5-codex / o1 / gpt-4-turbo / o1-mini 중)"

# Gemini per-agent memos in GEMINI.md
GEMINI_MEMOS="$(grep -c '💡 Recommended model' "$SANDBOX3/GEMINI.md" || true)"
if [[ "$GEMINI_MEMOS" -lt 17 ]]; then
  red "  ✖ GEMINI.md should have ≥17 per-agent memos, got $GEMINI_MEMOS"
  exit 1
fi
green "  ✓ GEMINI.md ← Gemini 에이전트별 메모 ${GEMINI_MEMOS}건 (balanced)"

DISTINCT_GEMINI="$(grep -oE 'Recommended model: \`[^`]+\`' "$SANDBOX3/GEMINI.md" | sort -u | wc -l | tr -d ' ')"
if [[ "$DISTINCT_GEMINI" -lt 2 ]]; then
  red "  ✖ Gemini balanced should produce ≥2 distinct models (pro / flash), got $DISTINCT_GEMINI"
  exit 1
fi
green "  ✓ Gemini balanced 매핑 다양성: $DISTINCT_GEMINI 종류 (gemini-2.5-pro / 2.5-flash 중)"

# Aider model field actually applied (single value — no preset)
grep -q "^model: claude-sonnet-4-6" "$SANDBOX3/.aider.conf.yml" || {
  red "  ✖ .aider.conf.yml missing 'model: claude-sonnet-4-6'"
  cat "$SANDBOX3/.aider.conf.yml"
  exit 1
}
green "  ✓ .aider.conf.yml ← model: claude-sonnet-4-6 (Aider 진짜 적용)"

rm -rf "$SANDBOX3"

# ---------------------------------------------------------------------------
# Done.
# ---------------------------------------------------------------------------
echo
green "🟢 ALL CHECKS PASSED"
dim "   sandbox: $SANDBOX (cleaned up on exit)"
