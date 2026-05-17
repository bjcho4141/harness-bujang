# `harness-bujang` (CLI)

[![npm](https://img.shields.io/npm/v/harness-bujang.svg)](https://www.npmjs.com/package/harness-bujang)

Install the [Harness-Bujang](https://github.com/bjcho4141/harness-bujang) multi-agent harness into any project — Director, 16 specialist teams, Cofounder, plus a standalone localhost chat-room viewer (`bujang chat`).

## Quick start

```bash
# Interactive setup — prompts for language, tools, model preset
npx harness-bujang init

# Non-interactive (CI / scripts) — accept all defaults (Korean agents)
npx harness-bujang init --yes

# English agents (default is Korean from 0.4.2+)
npx harness-bujang init --lang=en

# All extra-tool adapters + balanced model preset
npx harness-bujang init --yes --tools=all --models=balanced

# Upgrade an existing install — adds NEW team files only, never touches existing ones
npx harness-bujang update
```

> ## ⚠️ First-time vs upgrade — read this before re-running
>
> | Situation | Command | What it does |
> |-----------|---------|-------------|
> | **First install** (empty project) | `npx harness-bujang init` | Full install — director + 16 teams + cofounder |
> | **Pulling new version** (already installed) | `npx harness-bujang update` | **Adds only NEW files.** Existing agent files are never touched |
> | **Clean reset** (drop customizations) | `npx harness-bujang init --yes` | **Overwrites every agent file** ⚠️ |
>
> **If you've already been using harness-bujang, use `update`.** Running
> `init --yes` to upgrade will destroy any domain rules / learned customizations
> you've added to existing agent files. `CLAUDE.md` and
> `docs/AGENT_LEARNING_LOG.md` are never touched by any of the three commands.

### 💬 Open the chat-room (natural language recommended)

After install, just **say it in plain language** inside Claude Code — the Director will spawn the viewer in the background:

```
"Director, open the chat room"
"부장님 톡방 열어주세요"
"open chat" / "show the chat"
```

→ The Director auto-runs `npx harness-bujang chat` (background) → browser opens → http://localhost:7777 KakaoTalk-style room.

To close, also natural language:
```
"close the chat room"
"톡방 닫아줘"
```

Manual command (works on any stack — Next.js, Rails, Django, Express, …):
```bash
npx harness-bujang chat
```

→ Reads `.harness/chat.db` directly. The DB is auto-created on first run if missing.

### 🎬 How to use it — call by name

After install, the harness runs **inside Claude Code** by addressing personas:

```
"Director, please add a refund API"
"부장님, 결제 환불 API 만들어주세요"
   ↓ Director persona
   ├─ Pre-confirm: "Plan to invoke dev-team + security-team + db-guard. Proceed?"
   ├─ Principal OK → parallel team dispatch (per mapping table)
   ├─ Each step → chat-room INSERT (live in viewer)
   └─ Consolidated principal report

"Cofounder, is our BM viable?"
"공동대표, 우리 BM 이대로 가도 될까?"
   ↓ Cofounder persona (peer, not subordinate)
   ├─ Equal debate + push-back
   ├─ Calls consultant / research-team / analysis-team if data needed
   └─ Pushes the decision
```

**Calling rules**:

| Trigger | What happens |
|---------|--------------|
| **"Director, ..."** / "부장님, ..." | Director persona — pre-confirm, mapping, chat INSERT, consolidated report |
| **"Cofounder, ..."** / "공동대표, ..." | Cofounder persona — peer debate / strategy / decision push |
| **plain "..."** (no name) | Plain Claude — knows harness rules but skips the full workflow |
| **"dev-team, ..."** directly | ❌ Won't work — the 16 teams are dispatched **by** Director / Cofounder, not addressed directly by the principal |

> 💡 **For the full workflow (pre-confirm + mapping + chat + consolidated report), name the persona.** For quick one-offs, plain Claude is fine.

Natural-language triggers:
- Open chat: `"부장님 톡방 열어주세요"` / `"open the chat room"`
- Code review: `"Director, please review the PR"` / `"부장님 PR 리뷰 부탁드립니다"`
- Onboard team: `"Director, hire a marketing team"` / `"부장님 마케팅팀 채용해주세요"`
- Strategy: `"Cofounder, what do you think?"` / `"공동대표 의견 좀"`

## What it does

1. **Scans** the project — framework (Next.js / SvelteKit / Astro / Rails / Django / …), language, DB (Supabase / Prisma / Drizzle / TypeORM), UI lib, payment integration, GitHub user.
2. **Installs agents** at `.claude/agents/` — 18 markdown files (Director, Cofounder, 9 engineering teams, 7 content teams). Placeholders are filled based on the scan.
3. **Updates `CLAUDE.md`** — appends the harness-engineering section (or creates `CLAUDE.md` if absent).
4. **Seeds the learning log** — `docs/AGENT_LEARNING_LOG.md` with the canonical format and the first entry.
5. **(Optional) Fans out to extra tools** — Cursor / Cline / Aider / Codex / Gemini adapters when selected.

Zero project intrusion: no `next.config` patching, no auto-install of native peer deps, no `.env.local` edits. The chat room runs standalone via `bujang chat` on localhost.

## Commands

### `init`

```
npx harness-bujang init [options]

Options:
  --lang=<ko|en>          Agent language                    (default: ko — full 부장 persona)
  --tools=<list>          Extra adapters: cursor,cline,aider,codex,gemini,all
  --models=<preset>       Claude model preset: balanced (recommended), keep, cost, quality
  --target=<path>         Project root                      (default: .)
  --framework=<name>      Override detected framework
  --db=<name>             Override detected DB
  --no-claude-md          Skip CLAUDE.md edit
  --no-learning-log       Skip learning log seed
  --yes, -y               Skip prompts and overwrite (non-interactive — for CI / scripts)
```

When `--yes` is omitted and stdin is a TTY, the CLI prompts for language, extra-tool adapters, and per-tool model preset.

### `status`

```
npx harness-bujang status [path]
```

Verifies the install: agent files, `CLAUDE.md` section, learning log, `.harness/chat.db`. Counts unfilled `{{...}}` placeholders.

### `update`

```
npx harness-bujang update [options]

Options:
  --target=<path>          Project root (default: cwd)
  --lang=<ko|en>           Language for newly-added agents (default: ko)
```

**Safe additive update.** Adds NEW agent files only. Existing files are NEVER touched.

Use this when you upgrade `harness-bujang` and want to pull in newly-introduced
team members (e.g. the cofounder persona in 0.5.1, or the content-production
teams in 0.5.0) without disturbing any local customizations.

```
$ npx harness-bujang update

🔄 Harness-Bujang update
📂 Checking .claude/agents/
   =  consultant.md (exists, kept as-is)
   =  dev-team.md (exists, kept as-is)
   +  cofounder.md
   +  image-team.md
   ...

📋 Summary
   Added:  4   (new files only)
   Kept:   14  (existing files untouched)
```

> ⚠️ **`update` vs `init --yes`** — pick the right one:
>
> | Command | What happens |
> |---------|-------------|
> | `npx harness-bujang update` | **Safe.** Adds only new files. Custom edits preserved. |
> | `npx harness-bujang init --yes` | **Destructive.** Overwrites every agent file. Customizations lost. |
>
> Default to `update` for upgrades. Use `init --yes` only for a clean reset.

`CLAUDE.md` and `docs/AGENT_LEARNING_LOG.md` are **never** touched by either command.

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
`<target>/.harness/chat.db` via the embedded `better-sqlite3` native module
(prebuilt — no system `sqlite3` needed) and serves the KakaoTalk-style
chat-room viewer. From 0.5.3, the DB is auto-created on first run if missing.

Works on any stack — Next.js, Rails, Django, Express, Rust, … — because the
viewer is fully self-contained at `http://localhost:7777`.

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

Every step writes to `harness_messages`, visible in the standalone chat-room viewer (`bujang chat` or `/open-chat`).

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
