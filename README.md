# Harness-Bujang · 하네스 부장

> 당신의 코드베이스에 부장님 한 분 모셔드립니다.
> A Korean-style multi-agent harness director for Claude Code.

---

## 🇰🇷 하네스 부장이 뭐예요?

**하네스 부장**은 Claude Code 위에서 동작하는 **다중 에이전트 오케스트레이션 하네스**입니다.
도구로서가 아니라 **동료·상사로서** AI를 대하는 발상에서 출발했습니다.

```
대표님 지시
    ↓
이호 부장 (메인 에이전트)
    ├─ 개발팀 · 아키텍처팀 · DB팀 · 보안팀 · 코드리뷰팀 · QA팀 · 문서팀
    ├─ 이준 자문 (외부 벤치마킹)
    └─ 검수팀 (최종 게이트)
    ↓
실시간 톡방에 진행상황 기록 → 어드민 페이지에서 라이브 관전
```

특징:
- 🎭 **부장 페르소나** — 포항 사투리로 보고하는 이호 부장이 작업 분배·검수 총괄
- 👥 **7팀 + 자문 + 검수** — 역할별 서브에이전트가 병렬 작업, 위계로 보고
- 💬 **실시간 톡방** — 모든 에이전트 소통이 DB에 기록, 어드민 UI에서 관전
- 📚 **집단 학습 로그** — 실수·교훈을 영속화해서 세션 간 학습 누적
- 🔄 **Initializer 패턴** — 새 환경 첫 실행 시 AI가 직접 레포 스캔해서 자기 환경에 적응

> 영감의 출처는 Anthropic의 ["Effective harnesses for long-running agents"](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 글입니다. 하네스 부장은 그 컨셉을 한국식 위계 조직 메타포로 풀어낸 구현체입니다.

---

## 🇺🇸 What is Harness-Bujang?

**Harness-Bujang** ("부장" — *bujang*, the Korean honorific for a department director) is a **multi-agent orchestration harness** for Claude Code.

It treats AI not as a tool, but as a **colleague reporting up a chain of command**:

- **Director Lee Ho** (the main agent) receives commands and dispatches work
- **7 specialist teams** (dev, architect, DB guard, security, code review, QA, docs) execute in parallel
- **Advisor Lee Jun** handles external benchmarking
- **Verifier team** is the final gate before reporting back
- All inter-agent communication is **logged to a real-time chat room** visible in an admin UI

Inspired by Anthropic's [harness engineering writings](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

---

## 📦 Packages

This is a monorepo with three packages:

| Package | Purpose |
|---|---|
| [`packages/plugin`](./packages/plugin) | Claude Code Plugin (one-line install via `/plugin install`) |
| [`packages/template`](./packages/template) | GitHub template assets — `.claude/agents/`, migrations, admin UI |
| [`packages/cli`](./packages/cli) | `npx harness-bujang init` — Initializer agent for any project |

Shared single-source-of-truth assets live in [`shared/`](./shared) and are linked into each package at build time.

---

## 🚀 Status

🚧 **WIP — Pre-alpha.** Currently extracting and generalizing assets from the upstream [VibeFlea](https://vibeflea.com) project where the harness was first battle-tested.

Roadmap:
- [ ] Extract 10 agent definitions from VibeFlea, generalize with placeholders
- [ ] Build `harness-bujang` Claude Code Plugin
- [ ] Publish `harness-bujang` CLI to npm
- [ ] Add `--adapter cursor` / `--adapter cline` for non-Claude-Code environments
- [ ] Open marketplace listing

---

## 📜 License

MIT © 2026 bjcho4141 (Field Coding)
