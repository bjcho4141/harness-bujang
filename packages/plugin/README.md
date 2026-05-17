# `harness-bujang` — Claude Code Plugin

A Claude Code plugin that drops in 10 specialist subagents (Director, Consultant, dev-team, architect-team, code-review-team, security-team, db-guard-team, qa-team, verifier-team, doc-sync-team) plus five slash commands.

## Install

In Claude Code:

```
/plugin install bjcho4141/harness-bujang
```

Or, in your `.claude/settings.json`:

```json
{
  "plugins": ["bjcho4141/harness-bujang"]
}
```

After install, Claude Code picks up the agents and commands automatically. Verify with:

```
/plugin list
```

## What's included

### 10 subagents (in `agents/`)

| Name | Role |
|---|---|
| `director` | Persona that dispatches and reports — Main Claude plays this role |
| `consultant` | External benchmarking / industry advice |
| `dev-team` | Actual code implementation |
| `architect-team` | Route / module / data-flow design |
| `code-review-team` | Convention / readability review |
| `security-team` | Auth / permission / PII / XSS audit |
| `db-guard-team` | Schema / FK / migration gate |
| `qa-team` | Functional / scenario verification |
| `verifier-team` | Final build / regression gate |
| `doc-sync-team` | Docs sync (`CLAUDE.md` / `README.md` / trackers) |

### 5 slash commands (in `commands/`)

| Command | Purpose |
|---|---|
| `/bujang-init` | One-shot installer — scans project, copies agents, fills placeholders, seeds learning log, fans out to extra-tool adapters |
| `/bujang-status` | Health check — verify agents, `CLAUDE.md`, learning log, `.harness/chat.db` |
| `/bujang-team <name> <task>` | Quick-dispatch a specific team without the Director's full ceremony |
| `/bujang-report` | Summarize recent chat activity (last 24 h by default) |
| `/open-chat` | Launch the standalone KakaoTalk-style chat-room viewer (`http://localhost:7777`) in the background and auto-open the browser |

## Quick start

```bash
cd your-project
# (in Claude Code) /plugin install bjcho4141/harness-bujang
# (in Claude Code) /bujang-init
```

`/bujang-init` will ask:
- Korean (한국어, full Bujang persona) or English
- Which extra-tool adapters to install (Cursor / Cline / Aider / Codex / Gemini)
- Per-tool model preset (balanced / keep / cost / quality / custom)

It will then:
1. Copy agents to `.claude/agents/` with placeholders replaced based on detected stack
2. Append the harness section to your `CLAUDE.md`
3. Seed the learning log
4. (Optional) Fan out to selected tool adapters (Cursor / Cline / Aider / Codex / Gemini)

The chat room is served standalone via `/open-chat` (or `npx harness-bujang chat`) — zero project intrusion.

## Korean version

The plugin ships **English agents by default** for global discovery. For the full Korean Bujang persona, use the CLI instead:

```bash
npx harness-bujang init --lang=ko
```

The Korean variant is identical structurally but uses 부장 / 컨설턴트 / 대표님 in role names and Korean prose throughout.

## Repository

- Monorepo: https://github.com/bjcho4141/harness-bujang
- This plugin lives at `packages/plugin`
- Korean agents: `shared/agents/ko/`
- English agents: `shared/agents/en/` (mirrored to `packages/plugin/agents/`)

## License

MIT — see the root `LICENSE`.
