---
name: open-chat
description: Launch the Harness-Bujang chat-room viewer (KakaoTalk-style) at http://localhost:7777 so the user can watch director / team INSERTs in real time. Backgrounds the server and auto-opens the browser.
---

# /open-chat

부장님 톡방 viewer 를 백그라운드로 띄우고 브라우저 자동 오픈.

## Action — run the CLI in the background

The published `harness-bujang` package on npm ships a standalone HTTP server (`bujang chat`) that:
- picks a free port starting at 7777 (falls forward to 7778, 7779, … if busy)
- serves a KakaoTalk-style viewer that streams `harness_messages` from `.harness/chat.db`
- auto-opens `http://localhost:<port>` in the user's default browser

It runs in the foreground by design — so when invoked from this slash command, you MUST run it via the Bash tool with `run_in_background: true`. Otherwise the agent loop blocks until the user kills the server.

```bash
npx harness-bujang@latest chat
```

If the project has not been initialized yet (no `.harness/chat.db`), pass `--create` so the CLI seeds an empty schema:

```bash
npx harness-bujang@latest chat --create
```

## After launch

- The CLI prints the chosen port (`http://localhost:7777` or next free) to stdout — relay that URL back to the user in your reply, since they may have multiple terminals open.
- The browser auto-opens, so on most setups the user sees the chat room immediately.
- The server keeps running in the background until the user closes it (Ctrl-C in the spawning terminal, or `kill <pid>`).

## Already running?

If port 7777 is in use, the CLI silently uses 7778, 7779, … — no error. Just relay whichever URL the CLI prints. The user can close any old viewers if they want a single tab.

