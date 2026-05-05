# `harness-bujang` (CLI)

[![npm](https://img.shields.io/npm/v/harness-bujang.svg)](https://www.npmjs.com/package/harness-bujang)

Install the [Harness-Bujang](https://github.com/bjcho4141/harness-bujang) multi-agent harness into any project — Director, 7 specialist teams, Consultant, plus an optional real-time chat-room UI.

## Quick start

```bash
# Interactive setup — prompts for language, backend, etc.
npx harness-bujang init

# Non-interactive (CI / scripts) — accept all defaults (Korean agents)
npx harness-bujang init --yes

# English agents (default is Korean from 0.4.2+)
npx harness-bujang init --lang=en

# Different folder, skip the chat-room UI
npx harness-bujang init --target=./my-app --no-template
```

### See the chat-room — any stack

```bash
# Standalone viewer (works on Next.js, Rails, Django, Express, …) — no setup
npx harness-bujang chat
# → opens http://localhost:7777 in your browser
```

The standalone viewer reads `.harness/chat.db` directly, so it works on any
project that uses the SQLite chat backend (the default). For projects that have
not posted any messages yet, pass `--create` to bootstrap an empty DB and seed:

```bash
npx harness-bujang chat --create
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
  --lang=<ko|en>          Agent language                    (default: ko — full 부장 persona)
  --target=<path>         Project root                      (default: .)
  --framework=<name>      Override detected framework
  --db=<name>             Override detected DB
  --no-template           Skip chat-room UI install
  --no-claude-md          Skip CLAUDE.md edit
  --no-learning-log       Skip learning log seed
  --yes, -y               Skip prompts and overwrite (non-interactive — for CI / scripts)
```

When `--yes` is omitted and stdin is a TTY, the CLI prompts for language, chat backend, and (for Next.js projects) whether to install the chat-room UI.

### `status`

```
npx harness-bujang status [path]
```

Verifies the install: agent files, `CLAUDE.md` section, learning log, chat-room UI. Counts unfilled `{{...}}` placeholders.

### `chat`

```
npx harness-bujang chat [options]

Options:
  --target=<path>         Project root (default: cwd)
  --port=<number>         Preferred port (default: 7777, falls forward if busy)
  --no-open               Don't auto-open the browser
  --create                Create an empty chat DB + schema if none exists yet
```

Boots a standalone HTTP server (Node `http`, no framework) that reads
`<target>/.harness/chat.db` via the system `sqlite3` CLI and serves the
KakaoTalk-style chat-room viewer. Supports both reading and writing — the
input bar at the bottom of each room sends `from='대표님'` (principal) messages
that any agent can pick up next time they read the chat.

Requires the `sqlite3` command-line tool (preinstalled on macOS; `apt-get install
sqlite3` on Ubuntu/WSL; sqlite-tools binaries on Windows).

### `adapt`

```
npx harness-bujang adapt --to=<target> [options]

Targets:
  cursor    → .cursor/rules/bujang-*.mdc           (Cursor IDE)
  cline     → .clinerules/bujang-*.md              (Cline)
  aider     → CONVENTIONS.md + .aider.conf.yml     (Aider)
  codex     → AGENTS.md                            (OpenAI Codex CLI / Copilot Coding Agent / Cody)
  gemini    → GEMINI.md + .gemini/styleguide.md    (Antigravity / Gemini CLI / Code Assist)
  all       → all of the above
```

Converts the canonical `.claude/agents/*.md` install into the file formats other
editor / agent harness tools expect. The `.claude/agents/` directory remains the
single source of truth — re-run `bujang adapt --to=<target>` after changes to
keep adapters in sync.

Examples:

```bash
npx harness-bujang adapt --to=cursor       # just Cursor
npx harness-bujang adapt --to=cursor,aider # multiple
npx harness-bujang adapt --to=all          # everything
```

Tools covered (5 adapter formats → 8+ tools):

| Tool | File the adapter writes |
|------|-------------------------|
| Cursor IDE | `.cursor/rules/bujang-*.mdc` (with frontmatter) |
| Cline | `.clinerules/bujang-*.md` |
| Aider | `CONVENTIONS.md` + `.aider.conf.yml` (`read:`) |
| OpenAI Codex CLI | `AGENTS.md` |
| GitHub Copilot Coding Agent | `AGENTS.md` |
| Sourcegraph Cody | `AGENTS.md` (recent versions) |
| Google Antigravity | `GEMINI.md` (highest priority) + falls back to `AGENTS.md` |
| Gemini CLI | `GEMINI.md` |
| Gemini Code Assist (workspace) | `GEMINI.md` (precedence) + `.gemini/styleguide.md` |
| Gemini Code Assist (GitHub PR review) | `.gemini/styleguide.md` |

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
