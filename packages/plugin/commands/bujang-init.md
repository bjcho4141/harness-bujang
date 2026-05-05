---
name: bujang-init
description: Install Harness-Bujang into the current project — scan stack, copy agents, append the harness section to CLAUDE.md, and seed the learning log.
---

# /bujang-init

You are about to set up the Harness-Bujang multi-agent system in the current project. Execute the **Initializer pattern** described in Anthropic's harness-engineering writings.

## Steps

### 1. Scan the project

Detect the following from the current working directory:

- **Framework** — look for `next.config.*`, `svelte.config.*`, `astro.config.*`, `Gemfile`, `manage.py`, `pyproject.toml`, `Cargo.toml`, etc.
- **Language** — TypeScript / JavaScript / Python / Ruby / Go / Rust
- **DB** — Supabase (`supabase/`), Prisma (`prisma/schema.prisma`), Drizzle (`drizzle.config.*`), TypeORM, Sequelize, or none
- **UI library** — Tailwind, shadcn/ui, MUI, Chakra, Mantine, or none
- **Payment integration** — Stripe / Toss / Iniicis / KakaoPay / none
- **GitHub user** — `git config user.name`
- **Test command** — from `package.json` scripts or fallback to language default
- **Build command** — likewise

Report what you found in a short bulleted summary.

### 2. Confirm with the user

Ask the user:
- Language for agent definitions: **Korean** (한국어, full Bujang persona) or **English**
- Whether to install the chat-room UI (`packages/template/app/admin/harness/`) — only relevant if Next.js + Postgres-compatible DB
- Whether to install the migrations (`packages/template/migrations/`)

### 3. Install agents

Copy `agents/*.md` from this plugin (or the Korean variants from the upstream `shared/agents/ko/` if Korean was selected) into `.claude/agents/` of the user's project.

Replace the following placeholders in each agent file based on what was scanned:

| Placeholder | Source |
|---|---|
| `{{PROJECT_PATH}}` | absolute path to project root |
| `{{STACK_FRAMEWORK}}` | scanned framework |
| `{{STACK_LANGUAGE}}` | scanned language |
| `{{STACK_DB}}` | scanned DB |
| `{{STACK_UI}}` | scanned UI lib |
| `{{STACK_PAYMENT}}` | scanned payment |
| `{{STACK_EXTRA}}` | other notable libs |
| `{{ADMIN_HARNESS_ROUTE}}` | `/admin/harness` (or ask) |
| `{{HARNESS_TABLE}}` | `harness_messages` (or ask) |
| `{{LEARNING_LOG_PATH}}` | `docs/AGENT_LEARNING_LOG.md` (or ask) |
| `{{TASKS_TRACKER_GLOB}}` | `docs/TASKS_*.md` (or ask) |
| `{{GH_USER}}` | from `git config` |
| `{{BUILD_CMD}}` | from package.json or language default |
| `{{TYPECHECK_CMD}}` | likewise |
| `{{TEST_CMD}}` | likewise |
| `{{E2E_CMD}}` | likewise (or empty) |
| `{{DB_TYPES_PATH}}` | `src/types/database.ts` (Supabase) / `prisma/schema.prisma` / etc. |
| `{{DEV_URL}}` | `http://localhost:3000` (default) |
| `{{LEGAL_CONTEXT}}` | empty (user fills in if applicable) |

For optional sections (e.g., the "Payment / settlement" row in the Director's mapping table), **remove the row** if the project doesn't have that domain.

### 4. Update CLAUDE.md

If `CLAUDE.md` exists in the project root:
- Check whether it already contains a `## 하네스 엔지니어링` or `## Harness Engineering` section
- If not, append the section template (`shared/templates/<lang>/CLAUDE.md.harness-section.template`) with placeholders filled in

If no `CLAUDE.md` exists, create a minimal one with just the harness section.

### 5. Seed the learning log

Copy `shared/templates/<lang>/AGENT_LEARNING_LOG.seed.md` to the path the user chose for `{{LEARNING_LOG_PATH}}` (default: `docs/AGENT_LEARNING_LOG.md`). Replace `{{TODAY}}` with today's date and `{{HARNESS_TABLE}}` / `{{ADMIN_HARNESS_ROUTE}}` with the chosen values.

### 6. (Optional) Install chat-room UI + migrations

If the user opted in:
- Copy `packages/template/migrations/*.sql` to the project's migrations folder (offer to apply via Supabase CLI / psql / etc.)
- Copy `packages/template/app/admin/harness/` and `packages/template/app/api/harness/` into the project's `src/app/` (Next.js) or `app/` (Next.js with no `src` folder)
- Print a checklist of remaining steps:
  - Implement `verifySuperAdmin()` at `@/lib/utils/admin`
  - Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPER_ADMIN_EMAILS` env vars
  - Apply migrations
  - Visit `/admin/harness` to confirm

### 7. Final report

Print a summary:

```
✅ Installed agents:    .claude/agents/director.md (+ 9 teams)
✅ Updated CLAUDE.md:   appended Harness Engineering section
✅ Seeded learning log: docs/AGENT_LEARNING_LOG.md
✅ Chat-room UI:        installed / skipped
✅ Migrations:          installed / skipped

Next:
  1. /bujang-status — verify the install
  2. Run your first command — try "Director, please add a hello-world endpoint"
```

## Idempotence

If `/bujang-init` is run again on a project that already has agents installed, **do not overwrite without confirmation**. Diff and ask which files to update.
