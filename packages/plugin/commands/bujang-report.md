---
name: bujang-report
description: Summarize recent chat-room activity — what each team worked on, severity counts, and open blockers.
---

# /bujang-report

Read the most recent N entries from `harness_messages` (default: last 24 hours, or `--days=N`) and produce a structured summary for the principal.

## Steps

### 1. Pull the data

Query the chat room (via the project's DB client or by hitting `/api/harness/logs?days=N` if the user has the route installed). Collect:

- Total message count
- Per-role breakdown (`director`: X, `dev-team`: Y, etc.)
- Severity counts (`info` / `warning` / `error`)
- Type counts (`command` / `report` / `info` / `feedback`)

### 2. Group into work items

A "work item" is a chain of messages bounded by:
- Start: principal → director (command)
- End: director → principal (report) — or last message if still in progress

For each work item:
- One-line subject (first command's first line)
- Teams involved (`dev-team`, `code-review-team`, etc.)
- Final status (✅ done / ⏳ in progress / 🔴 blocked)
- Total turn-around time (start → end timestamps)

### 3. Open blockers

List any messages with `severity='error'` or `severity='warning'` that aren't followed by a resolution.

### 4. Output

```
📊 Harness report — last 24 hours

Activity:
  Total messages: 47
  Commands: 8 · Reports: 35 · Info: 4
  ✅ Info-level: 38 · ⚠️ Warnings: 6 · 🔴 Errors: 3

Work items (3):
  ✅ Implement /api/health endpoint — 32 min · dev-team, code-review-team, verifier-team
  ⏳ Migrate auth flow to OAuth — in progress · architect-team
  🔴 Production incident: payment timeout — 14 min in, blocked on Inicis API key

Open blockers (1):
  🔴 [security-team] Hardcoded API key in src/lib/payment.ts:42 — not yet patched

Top contributors:
  dev-team        14 messages
  director         9 messages
  code-review-team 8 messages
  ...
```

## Notes

- Keep it under ~500 chars unless `--detailed` is passed.
- If chat is empty: "No activity in the last <window>."
