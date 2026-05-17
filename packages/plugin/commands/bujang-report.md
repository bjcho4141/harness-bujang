---
name: bujang-report
description: Summarize recent chat-room activity — what each team worked on, severity counts, and open blockers.
---

# /bujang-report

Read recent entries from `harness_messages` and produce a structured summary for the principal.

## Action — execute now

Parse `--days=N` (default 1) and `--detailed` from the user's command arguments.

### Step 1. Pull the data

Read from the local SQLite chat DB at `.harness/chat.db`:

```bash
sqlite3 .harness/chat.db <<SQL
SELECT id, created_at, from_role, to_role, type, severity, body
FROM harness_messages
WHERE created_at >= datetime('now', '-${N} day')
ORDER BY id ASC;
SQL
```

If `.harness/chat.db` doesn't exist, output: "No chat room exists yet for this project — open it once with `/open-chat` (or `npx harness-bujang chat --create`), then re-run `/bujang-report`."

### Step 2. Aggregate

Compute:

- **Total messages** in window
- **Type breakdown** — `command` / `report` / `info` / `feedback`
- **Severity breakdown** — `info` / `warning` / `error`
- **Per-role count** — director, dev-team, code-review-team, etc.

### Step 3. Group into work items

A "work item" is a chain of messages bounded by:

- **Start** — principal → director (command), or director → team (command) if no principal command was logged
- **End** — director → principal (report) at `severity=info` (clean), OR last message if still open

For each work item:
- One-line subject (first command's first line, max 60 chars)
- Teams involved (distinct `from_role` values excluding `director` and `principal`)
- Final status: ✅ done (last msg is director → principal, severity=info), ⏳ in progress (no terminating director report), 🔴 blocked (latest message has severity=error or warning unresolved)
- Turnaround: first-message timestamp → last-message timestamp, formatted as `Xm` or `Xh Ym`

### Step 4. Open blockers

List messages with `severity IN ('error', 'warning')` that have no later message from the same `to_role` resolving them. Include the `body` (first 80 chars) and the source role.

### Step 5. Output format

```
📊 Harness report — last <N> day(s)

Activity
  Total messages: 47
  Types: 8 commands · 35 reports · 4 info
  Severity: 38 info · 6 warning · 3 error

Work items (3)
  ✅ Implement /api/health endpoint — 32m · dev-team, code-review-team, verifier-team
  ⏳ Migrate auth flow to OAuth — in progress · architect-team
  🔴 Production incident: payment timeout — 14m, blocked on Inicis API key

Open blockers (1)
  🔴 [security-team] Hardcoded API key in src/lib/payment.ts:42 — not yet patched

Top contributors
  dev-team        14
  director         9
  code-review-team 8
```

If chat is empty in the window: "No activity in the last <N> day(s)."

If `--detailed`, also dump the per-message timeline (timestamp + from → to + first 100 chars of body) under each work item.

## Notes

- Keep the summary under ~500 chars unless `--detailed` is passed.
- Don't fabricate work items — if the chat DB returns 0 rows, say so explicitly.
