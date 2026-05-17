---
name: bujang-team
description: Quick-dispatch shortcut — call a specific subagent without the Director's full ceremony. Useful for one-off audits.
---

# /bujang-team

Direct shortcut to invoke one of the specialist teams without going through the full Director dispatch flow.

## Usage

```
/bujang-team <team-name> <task>
```

Examples:

```
/bujang-team code-review-team review the latest commit
/bujang-team security-team audit the new payment endpoint
/bujang-team db-guard-team verify the migration in supabase/migrations/00031_*
/bujang-team qa-team run scenarios for the cart flow
```

## Action — execute now

Parse `<team-name>` and `<task>` from the user's command arguments.

### Step 1. Validate team name

The team name MUST be one of:

- `dev-team` — actual code work
- `architect-team` — structure design / review
- `doc-sync-team` — docs sync
- `code-review-team` — convention / readability review
- `security-team` — auth / permissions / PII / XSS audit
- `db-guard-team` — schema / FK / migration audit
- `qa-team` — functional / scenario verification
- `verifier-team` — final build + regression gate
- `consultant` — external benchmarking / industry advice

If invalid, print the list above and stop.

### Step 2. Log the dispatch (chat-room write)

If the project has a chat-room DB configured, INSERT a row before invoking the agent. Use the project's existing pattern — look at `lib/harness-db/` (if installed) or `app/api/harness/reply/route.ts` for the canonical write path.

SQLite (default):

```bash
sqlite3 .harness/chat.db <<'SQL'
INSERT INTO harness_messages (from_role, to_role, type, severity, body)
VALUES ('director', '<team-name>', 'command', 'info', '<task>');
SQL
```

Supabase: hit the project's own `/api/harness/reply` route (or `INSERT` via the service-role client).

If no chat DB is configured (agents-only install), skip this step.

### Step 3. Invoke the agent

Use the `Agent` tool:

```
Agent({
  subagent_type: "<team-name>",
  description: "<2-4 word summary of the task>",
  prompt: "<the user's task verbatim, plus any project context the agent needs>"
})
```

### Step 4. Log the return

After the agent returns its report, INSERT a return-trip row:

```sql
INSERT INTO harness_messages (from_role, to_role, type, severity, body)
VALUES ('<team-name>', 'director', 'report', '<info|warning|error>', '<summary of agent result>');
```

Severity:
- `info` — clean pass / nothing to flag
- `warning` — issues found but not blocking
- `error` — blocker / refuses to proceed

### Step 5. Surface the report

Print the agent's report to the user. If you logged to the chat DB, mention "(logged to chat room — open with `/open-chat`)" so they know where to look for the trail.

## Notes

- This command **bypasses** the Director's full mapping table — it does not auto-add audit teams. Use it for spot checks, not full features.
- For a full feature, just describe the work normally and let the Director dispatch through `director.md`'s mapping table.
- If the task spans multiple teams, use the regular Director flow instead — `/bujang-team` is for a single targeted invocation.
