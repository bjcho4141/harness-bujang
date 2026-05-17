---
name: bujang-status
description: Show the current Harness-Bujang installation status — agents, CLAUDE.md section, learning log, chat DB, and recent chat messages.
---

# /bujang-status

Print a structured status report of the harness install in the current project.

## Action — run the CLI status check

The `harness-bujang` CLI on npm runs all the install verification (agents, CLAUDE.md section, placeholder check, learning log, chat DB). Run:

```bash
npx harness-bujang@latest status .
```

This prints a summary like:

```
📋 Harness-Bujang status — <project>

Agents
   ✓  director.md
   ...
CLAUDE.md
   ✓  Section present, no unfilled placeholders
Learning log
   ✓  docs/AGENT_LEARNING_LOG.md
Chat room (.harness/chat.db)
   ✓  present — open with: bujang chat   (or  -  not yet created)

Overall: 🟢 healthy / 🟡 partial / 🔴 not installed
```

## Recent chat activity (extra)

The CLI does NOT query the chat database. To read recent `harness_messages` entries from the local SQLite chat DB:

```bash
sqlite3 .harness/chat.db \
  "SELECT created_at, from_role, to_role, substr(body, 1, 60) FROM harness_messages ORDER BY id DESC LIMIT 10"
```

After collecting the data, format it into a `Recent chat (last N):` block and append it under the CLI's output.

## When status reports issues

- If agents are missing → suggest `/bujang-init` (or `npx harness-bujang@latest init --yes` to overwrite)
- If CLAUDE.md section missing → same
- If `.harness/chat.db` not yet created → suggest `/open-chat` (or `npx harness-bujang chat --create`) to create it on first run

Print a single-line fix suggestion for each red/yellow item — never leave the user guessing what to do next.
