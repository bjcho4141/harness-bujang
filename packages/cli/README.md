# `harness-bujang` (CLI)

[![npm](https://img.shields.io/npm/v/harness-bujang.svg)](https://www.npmjs.com/package/harness-bujang)

Install the [Harness-Bujang](https://github.com/bjcho4141/harness-bujang) multi-agent harness into any project — Director, 7 specialist teams, Consultant, plus an optional real-time chat-room UI.

## Quick start

```bash
# English agents (default), drop into the current directory
npx harness-bujang init

# Korean agents (full 부장 persona)
npx harness-bujang init --lang=ko

# Into a different folder, skip the chat-room UI
npx harness-bujang init --target=./my-app --no-template
```

## What it does

1. **Scans** the project — framework (Next.js / SvelteKit / Astro / Rails / Django / …), language, DB (Supabase / Prisma / Drizzle / TypeORM), UI lib, payment integration, GitHub user.
2. **Installs agents** at `.claude/agents/` — 10 markdown files defining `director`, `consultant`, `dev-team`, `architect-team`, `code-review-team`, `security-team`, `db-guard-team`, `qa-team`, `verifier-team`, `doc-sync-team`. Placeholders are filled based on the scan.
3. **Updates `CLAUDE.md`** — appends the harness-engineering section (or creates `CLAUDE.md` if absent).
4. **Seeds the learning log** — `docs/AGENT_LEARNING_LOG.md` with the canonical format and the first entry.
5. **(Optional) Installs the chat-room UI** — Next.js admin page + API routes + Postgres migrations. Skipped automatically if your stack isn't Next.js.

## Commands

### `init`

```
npx harness-bujang init [options]

Options:
  --lang=<ko|en>          Agent language                    (default: en)
  --target=<path>         Project root                      (default: .)
  --framework=<name>      Override detected framework
  --db=<name>             Override detected DB
  --no-template           Skip chat-room UI install
  --no-claude-md          Skip CLAUDE.md edit
  --no-learning-log       Skip learning log seed
  --yes, -y               Overwrite existing files without asking
```

### `status`

```
npx harness-bujang status [path]
```

Verifies the install: agent files, `CLAUDE.md` section, learning log, chat-room UI. Counts unfilled `{{...}}` placeholders.

## How the harness works once installed

```
You (the principal)
    ↓ "Please add feature X"
Main Claude (acting as Director)
    ├─ INSERT chat: from='director' (plan)
    ├─ Agent(dev-team) — implementation
    ├─ Agent(code-review-team), Agent(security-team), … in parallel
    ├─ Agent(verifier-team) — final gate
    └─ Reply with consolidated report
```

Every step writes to `harness_messages`, visible in the optional admin chat-room UI at `/admin/harness`.

## Korean vs English

The system was originally built in Korean (full 부장 persona, KakaoTalk-style chat UI). The English variant is a structural mirror — same hierarchy, same audit teams, same 5-level verification — but uses neutral role names (`Director`, `Consultant`).

If you want the Korean experience, pass `--lang=ko`. The brand-name is the same; only the agent prose changes.

## Building locally

```bash
git clone https://github.com/bjcho4141/harness-bujang.git
cd harness-bujang/packages/cli
npm install
npm run build              # → dist/index.js
node dist/index.js init    # test against a sample project
```

## License

MIT — see the root `LICENSE`.
