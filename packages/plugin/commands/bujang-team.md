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

## Valid team names

- `dev-team` — actual code work
- `architect-team` — structure design / review
- `doc-sync-team` — docs sync
- `code-review-team` — convention / readability review
- `security-team` — auth / permissions / PII / XSS audit
- `db-guard-team` — schema / FK / migration audit
- `qa-team` — functional / scenario verification
- `verifier-team` — final build + regression gate
- `consultant` — external benchmarking / industry advice

## What this command does

1. Validate the team name. If invalid, print the list of valid teams.
2. Call `Agent` with `subagent_type=<team-name>` and the task as the prompt.
3. INSERT a chat message: `from='director' to='<team-name>' type='command'` with the task.
4. After the agent returns, INSERT another chat message: `from='<team-name>' to='director' type='report'` with the result summary.
5. Print the agent's report to the user.

## Notes

- This command **bypasses** the Director's full mapping table — it does not auto-add audit teams. Use it for spot checks, not full features.
- For a full feature, just describe the work normally and let the Director dispatch through `director.md`'s mapping table.
