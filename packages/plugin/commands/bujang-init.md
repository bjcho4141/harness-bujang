---
name: bujang-init
description: Install the Harness-Bujang multi-agent system into the current project — agents, CLAUDE.md section, learning log, and extra-tool adapters.
---

# /bujang-init

You are about to install the Harness-Bujang harness into the current project.

## Action — run the CLI

The published `harness-bujang` package on npm handles all the install logic (project detection, agent copy, CLAUDE.md merge, learning log seed, extra-tool adapters). Run it via the user's shell:

```bash
npx harness-bujang@latest init
```

The CLI is interactive when stdin is a TTY: it prompts for:
- Agent language (`en` / `ko`)
- Extra tool adapters (Cursor / Cline / Aider / Codex / Gemini — multi-select)
- Per-tool model preset (balanced / keep / cost / quality / custom)

For non-interactive runs (CI / scripts), pass `--yes`:

```bash
npx harness-bujang@latest init --yes --lang=ko
```

## After install

1. **Restart Claude Code** — fully quit and reopen in this folder. Agents register only at session start, so the new director + teams won't be visible until you restart.
2. **Open the chat room** — run `/open-chat` to launch the standalone viewer at `http://localhost:7777` (server backgrounds, browser auto-opens).
3. Optional: run `/bujang-status` to verify everything landed correctly, and open `CLAUDE.md` to review the `## 하네스 엔지니어링` (or `## Harness Engineering`) section that was appended.

## Idempotence

Re-running `/bujang-init` is safe — the CLI skips files that already exist unless `--yes` is passed. Use `--yes` to overwrite all agent files with the latest versions (e.g., after `harness-bujang` is upgraded).
