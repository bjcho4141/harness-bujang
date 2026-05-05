<div align="center">

# Harness-Bujang · 하네스 부장

**당신의 코드베이스에 부장님 한 분 모셔드립니다.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-6366F1.svg)](https://github.com/bjcho4141/harness-bujang)

🇰🇷 [한국어](#-한국어) · 🇺🇸 [English](#-english) · 🚀 [빠른 시작](#-빠른-시작) · 📦 [패키지](#-패키지)

</div>

---

## 🇰🇷 한국어

### 무엇인가요?

**하네스 부장**은 Claude Code 위에서 동작하는 **다중 에이전트 오케스트레이션 하네스**입니다.
AI를 *도구*로 부리는 게 아니라, **동료·상사·팀원**으로 대하는 발상에서 출발했습니다.

설치하면 당신의 프로젝트에:

- 🧑‍💼 **부장** — 작업을 분해하고 팀에 분배하고 결과를 책임지는 메인 에이전트
- 👥 **7개 전문팀** — 개발 / 아키텍처 / 코드리뷰 / 보안 / DB / QA / 문서
- 🤝 **컨설턴트** — 경쟁사 벤치마킹 · 업계 자문
- ✅ **검수팀** — 모든 작업의 최종 관문 (빌드·회귀·교차 검증)
- 💬 **실시간 톡방** — 에이전트 간 모든 보고가 어드민 페이지에서 라이브로 흐름
- 📚 **집단 학습 로그** — 실수·교훈이 영속 기록되어 세션 간 누적

…이 한 줄 명령으로 들어옵니다.

### 왜 만들었나요?

기존 단일-에이전트 워크플로우는 다음 한계가 있었습니다:

| 문제 | 단일 에이전트 | 하네스 부장 |
|---|---|---|
| 검수 단계 | 자기가 짠 코드 자기가 검수 → 실수 못 잡음 | 코드리뷰팀·보안팀·검수팀 별도 호출 |
| 진행 상황 가시성 | 결과만 텍스트로 옴 | 톡방에 단계별 실시간 기록 |
| 도메인별 전문성 | 모든 영역을 한 LLM이 처리 | 결제는 보안팀, DB는 DB팀 등 분담 |
| 학습 누적 | 매 세션 휘발 | `AGENT_LEARNING_LOG.md`에 영속 |
| 위계와 책임 | 평면적 | 부장 → 팀 → 검수 위계 |

영감의 출처는 Anthropic의 [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) 와 [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk). 그 컨셉을 **한국식 위계 조직 메타포**로 풀어낸 구현체입니다.

### 작동 흐름

```
대표님 (당신)
    ↓ "결제 환불 API 만들어주세요"
부장 (Main Claude가 페르소나 인수)
    │
    ├─→ 작업 분해 + 팀 매핑표 조회
    │
    ├─→ Agent(consultant) — 크몽·토스페이먼츠 환불 패턴 벤치
    ├─→ Agent(architect-team) — API 라우트·DB 설계
    ├─→ Agent(dev-team) — 코드 작성 (병렬 가능)
    ├─→ Agent(security-team) — 결제 도메인이라 필수
    ├─→ Agent(code-review-team) — 컨벤션·타입 검증
    ├─→ Agent(db-guard-team) — 마이그레이션·FK 검증
    ├─→ Agent(qa-team) — 시나리오 테스트
    └─→ Agent(verifier-team) — 빌드·회귀·최종 PASS
        ↓
    각 단계마다 harness_messages 톡방에 INSERT
        ↓
    /admin/harness 에서 실시간 관전
        ↓
대표님께 통합 보고
```

### 핵심 가치

- 🎯 **개입 지점 명확** — "이건 부장님 결정 부탁드립니다" 식으로 인간 게이트가 명시됨
- 🔍 **검수 다층화** — 5단계 검증 (빌드·기능·코드·도메인·회귀)이 강제 체크리스트
- 📊 **로그 영속화** — 누가 언제 무엇을 했는지 톡방 + DB에 남음
- 🌐 **다국어** — 한국어(부장 페르소나) / 영어(Director) 양쪽 지원
- 🛠 **다중 스택** — Next.js / SvelteKit / Astro / Nuxt / Rails / Django / Python / Rust 자동 감지

---

## 🇺🇸 English

**Harness-Bujang** (*"bujang"* — Korean for *department director*) is a multi-agent orchestration harness for Claude Code. It models AI not as a tool but as **colleagues reporting up a chain of command**: a Director plus 7 specialist teams, a Consultant for benchmarking, a Verifier as the final gate, plus a real-time chat room you can watch in an admin UI.

Inspired by Anthropic's [harness engineering writings](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents). One-line install via Claude Code plugin or `npx harness-bujang init`.

```
You (the principal)
   ↓ "Add a refund API"
Director (Main Claude persona)
   ├─→ consultant      — benchmarking
   ├─→ architect-team  — design
   ├─→ dev-team        — implementation (parallel)
   ├─→ security-team   — payment domain → required
   ├─→ code-review · db-guard · qa
   └─→ verifier-team   — final gate
       ↓
   Every step → harness_messages chat → live admin UI
```

10 subagents, 4 slash commands, full Korean / English variants. See [packages/cli/README.md](./packages/cli/README.md) for usage.

### 아키텍처 한눈에

```mermaid
graph TD
  P[대표님 / Principal<br/>사용자]
  D[부장 / Director<br/>Main Claude persona]
  C[컨설턴트<br/>consultant]
  AR[아키텍처팀<br/>architect-team]
  DV[개발팀<br/>dev-team]
  CR[코드리뷰팀<br/>code-review-team]
  SE[보안팀<br/>security-team]
  DB[DB팀<br/>db-guard-team]
  QA[QA팀<br/>qa-team]
  DS[문서관리팀<br/>doc-sync-team]
  VF[검수팀<br/>verifier-team]

  CHAT[(harness_messages<br/>SQLite or Supabase)]

  UI1[/admin/harness<br/>Next.js admin route]
  UI2[bujang chat<br/>standalone viewer<br/>localhost:7777]
  UI3[Adapters<br/>.cursor / .clinerules /<br/>CONVENTIONS.md / AGENTS.md]

  P -->|명령| D
  D <-->|벤치마킹| C
  D -->|구조 검토| AR
  D -->|구현 분배| DV
  DV -.->|병렬 호출| DV
  D -->|검토| CR
  D -->|보안| SE
  D -->|DB| DB
  D -->|QA| QA
  D -->|문서| DS
  D -->|최종 게이트| VF
  D -->|결과 보고| P

  D -.기록.-> CHAT
  C -.기록.-> CHAT
  AR -.기록.-> CHAT
  DV -.기록.-> CHAT
  CR -.기록.-> CHAT
  SE -.기록.-> CHAT
  DB -.기록.-> CHAT
  QA -.기록.-> CHAT
  DS -.기록.-> CHAT
  VF -.기록.-> CHAT

  CHAT --> UI1
  CHAT --> UI2

  UI3 -.파생.- D

  style P fill:#f3e8ff,stroke:#7c3aed,stroke-width:2px
  style D fill:#dbeafe,stroke:#2563eb,stroke-width:2px
  style CHAT fill:#fef3c7,stroke:#d97706
  style UI1 fill:#dcfce7,stroke:#16a34a
  style UI2 fill:#dcfce7,stroke:#16a34a
  style UI3 fill:#fce7f3,stroke:#db2777
```

- 보라 = 사용자 / 파랑 = 부장 / 노랑 = 데이터 (chat-room) / 초록 = 톡방 viewer / 분홍 = 다른 도구 어댑터.
- 점선 (`-.기록.->`) = harness_messages 테이블 INSERT.
- `bujang chat` 으로 어떤 스택에서든 동일한 카톡 UI 톡방 사용.
- `bujang adapt` 로 Cursor / Cline / Aider / Codex 등 다른 도구에 동일 페르소나 배포.

---

## 🚀 빠른 시작

세 가지 길이 있습니다. 환경에 맞춰 선택하세요.

### 길 A — Claude Code 사용자 (가장 짧음)

```
/plugin install bjcho4141/harness-bujang
/bujang-init
```

→ 영어 에이전트 + 슬래시 커맨드 4종이 한 줄로 설치됩니다. `/bujang-init`이 프로젝트 자동 스캔 후 `.claude/agents/`에 채워줍니다.

### 길 B — CLI (어떤 환경이든)

```bash
# 한국어 부장 페르소나로 (권장)
npx harness-bujang init --lang=ko

# 영어
npx harness-bujang init

# 다른 폴더
npx harness-bujang init --target=./my-app
```

→ Cursor / Cline / Aider 등 다른 도구도 `.claude/agents/`만 인식하면 동일하게 동작합니다.

#### 톡방 보기 — 어떤 스택이든 한 줄

```bash
npx harness-bujang chat --create
# → 브라우저 자동 오픈 → http://localhost:7777 (KakaoTalk-style 톡방)
```

Next.js 의존도 없고, 별도 셋업도 없습니다. SQLite 파일 (`<project>/.harness/chat.db`)을 직접 읽어서 카톡 UI로 띄움. Rails / Django / Express / Rust 어디서든 동작.

### 길 C — 수동 (커스터마이즈 원할 때)

```bash
git clone https://github.com/bjcho4141/harness-bujang.git
cp -r harness-bujang/shared/agents/ko/* ./your-project/.claude/agents/
# CLAUDE.md 에 shared/templates/ko/CLAUDE.md.harness-section.template 내용 추가
# (선택) packages/template/migrations + app 복사
```

→ 100% 자기 입맛으로 수정 가능. placeholder는 직접 채우거나 그대로 두면 됩니다.

---

## 📦 패키지

| 패키지 | 역할 | npm | 설치 |
|---|---|---|---|
| [`packages/plugin`](./packages/plugin) | Claude Code Plugin (10 agents + 4 slash commands) | — | `/plugin install bjcho4141/harness-bujang` |
| [`packages/cli`](./packages/cli) | `harness-bujang init` 인스톨러 | `harness-bujang` | `npx harness-bujang init` |
| [`packages/template`](./packages/template) | Next.js + Postgres 톡방 UI 자산 | — | CLI가 자동 복사 |

공유 자산(SSoT):
- [`shared/agents/ko/`](./shared/agents/ko) · [`shared/agents/en/`](./shared/agents/en) — 에이전트 정의 10개 × 2 언어
- [`shared/templates/ko/`](./shared/templates/ko) · [`shared/templates/en/`](./shared/templates/en) — `CLAUDE.md` 섹션 + 학습로그 시드

---

## 🛠 호환성 매트릭스

### 프레임워크 자동 감지

| 스택 | 감지 | Next.js 톡방 UI | `bujang chat` standalone |
|---|---|---|---|
| Next.js (App Router) | ✅ | ✅ 즉시 사용 | ✅ |
| SvelteKit | ✅ | ⚠️ 수동 포팅 필요 | ✅ |
| Astro / Nuxt | ✅ | ⚠️ 수동 포팅 | ✅ |
| Rails | ✅ | ❌ | ✅ |
| Django / FastAPI | ✅ | ❌ | ✅ |
| Python (general) | ✅ | ❌ | ✅ |
| Rust / Go | ✅ | ❌ | ✅ |
| Generic Node.js | ✅ | ❌ | ✅ |

`bujang chat` 은 어떤 스택에서든 SQLite 파일을 직접 읽어서 카톡 UI를 띄우므로, Next.js 톡방 UI가 안 깔리는 환경에서도 동일한 톡방 경험 제공.

### DB 자동 감지

| DB | 감지 | RLS 마이그레이션 호환 |
|---|---|---|
| Supabase (Postgres + Auth) | ✅ | ✅ |
| Prisma + Postgres | ✅ | ⚠️ predicate 수정 필요 |
| Drizzle ORM | ✅ | ⚠️ |
| TypeORM / Sequelize | ✅ | ⚠️ |
| (없음) | ✅ | ❌ 톡방 UI 미설치 |

### Claude Code 도구 호환

| 도구 | agents 인식 | 슬래시 커맨드 | 비고 |
|---|---|---|---|
| Claude Code (공식) | ✅ | ✅ | 풀 호환 |
| Cursor | ⚠️ | ❌ | `.cursor/rules/` 매핑 필요 |
| Cline | ⚠️ | ❌ | `.clinerules/` 매핑 필요 |
| Aider | ❌ | ❌ | 페르소나 컨셉만 차용 가능 |

### Node.js / OS

- **Node.js**: 20+ 필수 (engines.node 명시)
- **OS**: macOS · Linux · Windows (path 처리 표준)
- **패키지 매니저**: npm · pnpm · yarn · bun 호환

---

## 🎨 커스터마이즈

### 부장 호칭 바꾸기

`/bujang-init` 후 생성된 `.claude/agents/director.md`에서:

```markdown
당신은 **부장**입니다.   ← 이걸 "팀장" / "리드" / "CTO" 등으로 변경
```

`harness-client.tsx`의 `ROLES` 객체도 같이 수정하면 톡방 UI 라벨도 따라갑니다.

### 팀 추가/삭제

```bash
# devops-team 추가
cp .claude/agents/security-team.md .claude/agents/devops-team.md
# 내용을 devops 책임 영역으로 수정
# director.md 의 "작업 유형별 담당팀 매핑" 표에 행 추가
```

### 도메인별 감사팀 자동 발동 룰 변경

`director.md`의 다음 섹션을 수정:

```markdown
### 감사팀 필수 발동 조건
- **결제·정산** → security-team 필수
- **DB 스키마·마이그·RLS** → db-guard-team 필수
- **인증·권한·개인정보** → security-team 필수
- **약관·법적 문구** → 3단 감사
```

### 톡방 UI 톤·테마

`harness-client.tsx` 의 `ROLES` 색상·이모지 + Tailwind 클래스 수정. KakaoTalk 노란 말풍선이 디폴트, 원하는 색으로.

---

## 📊 작동 검증된 시나리오

이 시스템은 **VibeFlea** ([vibeflea.com](https://vibeflea.com)) — 한국 바이브코딩 외주 플랫폼 — 에서 6주간 실전 운용된 후 추출되었습니다. 처리한 작업 예시:

- 카카오/네이버/구글 OAuth 통합 (security-team + dev-team 협업)
- 결제 (KG이니시스 PC + 에스크로) — security-team 5회 차단·수정 사이클
- 등급 시스템 6개 지표 자동 평가 (architect-team 설계)
- 가입 환영 알림톡 의뢰자/코더 분리 (consultant 자문 → dev-team 구현)
- 에이전트 격노 사건 학습 — `줄글 보고`·`톡방 INSERT 누락` 영구 룰화

학습 로그 시드는 [`shared/templates/ko/AGENT_LEARNING_LOG.seed.md`](./shared/templates/ko/AGENT_LEARNING_LOG.seed.md) 참조.

---

## 🗺️ 로드맵

- [x] 에이전트 10종 정의 (한국어 / 영어)
- [x] Claude Code Plugin (`/plugin install`)
- [x] CLI (`npx harness-bujang init/status`)
- [x] Next.js + Supabase 톡방 UI 템플릿
- [x] 8개 프레임워크 + 5개 ORM 자동 감지
- [x] npm 정식 publish — [`harness-bujang@0.3.0`](https://www.npmjs.com/package/harness-bujang) 라이브 (2026-05-05). 0.4.0 publish 대기
- [x] 인터랙티브 `init` — `@inquirer/prompts` 기반 언어/백엔드/UI 선택 + 기존 설치 감지 시 overwrite 프롬프트 (0.2.0/0.2.1)
- [x] 슬래시 커맨드 directive 화 — `/bujang-init`, `/bujang-status`, `/bujang-team`, `/bujang-report` 모두 실제 액션 형태로 재작성 (0.2.0)
- [x] **비-Next.js standalone viewer (`bujang chat`)** — Node http + 임베디드 HTML + system sqlite3, 모든 스택에서 `localhost:7777` 한 줄로 톡방 사용 (0.3.0)
- [x] **sandbox e2e 검증 스크립트** — `npm run sandbox-test` 한 줄로 init→status→chat→adapt 전체 흐름 검증 (0.3.0/0.4.0)
- [x] **Cursor / Cline / Aider / Codex / Gemini 어댑터** — `bujang adapt --to=<...>` (0.4.0)
- [x] **README Mermaid 아키텍처 다이어그램** (0.4.0)
- [ ] `harness-bujang@1.0.0` 안정 버전 (실사용 피드백 후)
- [ ] Claude Code 마켓플레이스 등록
- [ ] 데모 GIF / Cast 영상
- [ ] better-sqlite3 + Next.js 라우트 통합 e2e 검증

---

## 🤔 자주 묻는 질문

<details>
<summary><b>Q. 왜 한국어 페르소나(부장)를 영어 패키지에 박았나요?</b></summary>

A. 영어권에 이미 비슷한 다중 에이전트 프레임워크 (CrewAI / AutoGen / LangGraph)가 많습니다. 차별화 포인트는 **한국식 위계 조직 메타포**입니다. 영어권 사용자가 "Bujang? What does that mean?" 하고 클릭하는 순간 우리만의 정체성이 박힙니다. 다만 옵션 `--lang=en`으로 영어 톤으로 갈아탈 수 있습니다.

</details>

<details>
<summary><b>Q. Anthropic의 Claude Agent SDK와는 어떻게 다른가요?</b></summary>

A. Claude Agent SDK는 **빌딩 블록**(SDK 레벨)이고, 하네스 부장은 그 위에서 작동하는 **오피니어네이티드 패턴**입니다. SDK가 "어떻게 에이전트를 만들 건지"라면, 하네스 부장은 "10명짜리 한국식 IT 부서를 어떻게 운영할 건지"의 답입니다.

</details>

<details>
<summary><b>Q. 톡방 UI 없이도 쓸 수 있나요?</b></summary>

A. 네. `--no-template` 옵션으로 에이전트 정의만 설치하면 됩니다. 톡방 UI는 가시성 보너스이고, 핵심 가치는 위계 + 5단계 검증입니다.

</details>

<details>
<summary><b>Q. 만든 사람은 누구이고 왜 만들었나요?</b></summary>

A. [VibeFlea](https://vibeflea.com) 1인 개발 중 단일 에이전트로는 결제·인증·법적 문구 같은 **민감 도메인 검수가 약하다**는 한계를 마주쳤습니다. "내 코드에 부장이 한 명 있으면 좋겠다"에서 시작해서, 6주 운용 후 범용화한 결과물입니다.

</details>

---

## 📜 라이선스

MIT © 2026 [bjcho4141](https://github.com/bjcho4141) (Field Coding · 필드코딩)

자유롭게 fork·수정·재배포 환영. 하네스 부장이 당신의 프로젝트에서도 잘 일하길 바랍니다. 🙏
