---
name: bujang-status
description: Show the current Harness-Bujang installation status — agents, CLAUDE.md section, learning log, chat-room UI, and recent chat messages.
---

# /bujang-status

Print a structured status report of the harness install in the current project.

## Sections to verify

### 1. Agent files

- List `.claude/agents/*.md` and report which ones match the canonical set:
  - `director.md`, `consultant.md`
  - `dev-team.md`, `architect-team.md`, `doc-sync-team.md`
  - `code-review-team.md`, `security-team.md`, `db-guard-team.md`, `qa-team.md`, `verifier-team.md`
- For each found file, check whether placeholders (`{{...}}`) remain unfilled — that means init was incomplete

### 2. CLAUDE.md

- Check root `CLAUDE.md` exists
- Check it contains a `## 하네스 엔지니어링` or `## Harness Engineering` section
- Check no `{{...}}` placeholders remain inside that section

### 3. Learning log

- Find the path declared by the agent files (look for the value used to replace `{{LEARNING_LOG_PATH}}`)
- Check it exists and has at least the seed entry

### 4. Chat-room infrastructure (if installed)

- Check whether the project has:
  - Migrations: `harness_messages` table created (look for SQL files or run a query if the user has DB credentials)
  - UI: `app/admin/harness/page.tsx`, `app/admin/harness/harness-client.tsx`
  - API: `app/api/harness/logs/route.ts`, `app/api/harness/reply/route.ts`
- Check env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPER_ADMIN_EMAILS`

### 5. Recent chat activity

If the chat room is accessible, query the most recent 10 entries from `harness_messages` and print a short list (timestamp + from → to + first 60 chars of message).

## Output format

```
📋 Harness-Bujang status — <project name>

Agents (10/10):
  ✅ director.md (15.0 KB)
  ✅ dev-team.md (5.2 KB)
  ... (etc.)
  ⚠️ consultant.md — 2 unfilled placeholders

CLAUDE.md:
  ✅ Section "## 하네스 엔지니어링" found
  ✅ No unfilled placeholders

Learning log:
  ✅ docs/AGENT_LEARNING_LOG.md (1 entry)

Chat-room UI:
  ✅ Migrations applied
  ✅ UI files present
  ⚠️ SUPER_ADMIN_EMAILS env var not set

Recent chat (last 5):
  10:32  director → dev-team   "[NOTE] Implement /api/health endpoint..."
  10:35  dev-team → director   "[PASS] Done. 1 file changed..."
  ...

Overall: 🟢 healthy / 🟡 partial / 🔴 not installed
```

If any item is `⚠️` or `🔴`, print a single-line suggestion for the fix (e.g., "Run /bujang-init to complete setup").
