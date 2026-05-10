---
name: bujang-init
description: Install the Harness-Bujang multi-agent system into the current project — agents, CLAUDE.md section, learning log, and (Next.js only) the chat-room UI.
---

# /bujang-init

You are about to install the Harness-Bujang harness into the current project.

## Action — run the CLI

The published `harness-bujang` package on npm handles all the install logic (project detection, agent copy, CLAUDE.md merge, learning log seed, chat-room UI for Next.js). Run it via the user's shell:

```bash
npx harness-bujang@latest init
```

The CLI is interactive when stdin is a TTY: it prompts for:
- Agent language (`en` / `ko`)
- Chat backend (`sqlite` default / `supabase`)
- Whether to install the chat-room UI (Next.js only)

For non-interactive runs (CI / scripts), pass `--yes`:

```bash
npx harness-bujang@latest init --yes --lang=ko
```

## After install

1. **Restart Claude Code** — fully quit and reopen in this folder. Agents register only at session start, so the new director + teams won't be visible until you restart.
2. **Open the chat room** — run `/open-chat` to launch the standalone viewer at `http://localhost:7777` (server backgrounds, browser auto-opens).
3. Optional checks:
   - Run `/bujang-status` to verify everything landed correctly
   - Open `CLAUDE.md` and review the `## 하네스 엔지니어링` (or `## Harness Engineering`) section that was appended
   - For Next.js with chat-room UI: 0.8.2+ auto-installs `better-sqlite3` and patches `next.config`, so `npm run dev` + `/admin/harness` should work immediately. Supabase mode auto-scaffolds `.env.local.example` — fill in the keys before running.

## Idempotence

Re-running `/bujang-init` is safe — the CLI skips files that already exist unless `--yes` is passed. Use `--yes` to overwrite all agent files with the latest versions (e.g., after `harness-bujang` is upgraded).
