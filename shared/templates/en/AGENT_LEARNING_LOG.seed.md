# Agent Learning Log

> Shared record of mistakes and lessons across all teams (Director, dev-team, auditors, verifier-team, consultant).
> **Mandatory reading at session start.** Append new entries at the bottom (preserve insertion order; don't reverse).

---

## 📐 Format

```markdown
### YYYY-MM-DD — [team] one-line title

**Context**: 1–2 lines on what was being done
**Mistake / misjudgment**: what went wrong
**Root cause**: why it happened (structural or cognitive)
**Lesson**: how to do it differently next time
**Files**: file:line (if any)
```

---

## 📚 Entries

<!-- First entry is added by the init script, or appended by the Director after the first task. -->

### {{TODAY}} — [Director] Harness-Bujang adopted

**Context**: Introduced the Harness-Bujang multi-agent system to this project.
**Root cause**: Single-agent work has weak review and zero chat visibility — when something stalls, the principal cannot see where.
**Lesson**: Never skip `{{HARNESS_TABLE}}` INSERTs. Every step must surface in the chat room so the principal can track progress.
**Files**: `.claude/agents/*.md` · Chat room: `bujang chat`

---

## 🎯 Recurring categories (high-attention areas)

Mistakes in these categories must update **both this log AND the relevant agent file** on recurrence:

- DB schema judgment — migration files vs. actual prod schema drift
- Prose reports — chat INSERTs without markdown bullets
- Missing chat INSERTs — work step completed but never logged
- Skipped verification — reporting "done" without going through `verifier-team`
- Missing audit calls — payment / DB / legal-text work without the relevant audit team
