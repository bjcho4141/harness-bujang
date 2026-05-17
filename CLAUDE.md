# CLAUDE.md — harness-bujang 작업 가이드

다음 세션에서 이 레포에서 작업할 때 빠르게 컨텍스트 잡기 위한 가이드.

## 프로젝트 정체성

**Harness-Bujang (하네스 부장)** — Korean-style multi-agent harness director for Claude Code.

- VibeFlea 6주 운용 후 추출·범용화한 다중 에이전트 오케스트레이션 패키지
- 디폴트 SQLite (셋업 0) + 옵트인 Supabase (운영용)
- 한국어 (부장 페르소나) / 영어 (Director) 양쪽 지원
- 무엇이고 왜인지 자세히는 [`README.md`](./README.md) 참조

## 모노레포 구조

```
harness-bujang/
├── shared/                              # Single Source of Truth
│   ├── agents/{ko,en}/                  # 에이전트 18개 × 2 언어
│   └── templates/{ko,en}/               # CLAUDE.md 섹션 + 학습로그 시드
├── packages/
│   ├── plugin/                          # Claude Code Plugin (/plugin install)
│   └── cli/                             # npx harness-bujang (npm publish 대상)
│       ├── src/{index,init,status,chat,adapt,update,scan,template}.ts
│       ├── scripts/prepare-templates.mjs   # shared → templates/ 번들
│       ├── scripts/sandbox-test.sh         # e2e 검증
│       └── templates/                   # 빌드 산출물 (gitignored)
└── README.md                            # 통합 사용자 가이드
```

> 0.9.0 이후: `packages/template/` (Next.js admin 라우트 + DB 어댑터) 제거.
> 톡방은 `bujang chat` standalone localhost viewer 하나로 통일. 사용자 프로젝트 침습 0.

## 명령어

```bash
# 루트
npm install                               # workspace 의존성 (cli만 있음)

# CLI 개발
cd packages/cli
npm run typecheck                         # tsc --noEmit
npm run build                             # prepare-templates + tsup → dist/
npm run dev -- init --target=...          # tsx로 직접 실행
npm run sandbox-test                      # e2e: init → status → chat 전 흐름 검증

# 수동 sandbox 검증
node dist/index.js init --target=/tmp/sandbox --lang=ko --yes
node dist/index.js status /tmp/sandbox
node dist/index.js chat --target=/tmp/sandbox --create   # localhost:7777

# Plugin 테스트 (Claude Code 안에서)
/plugin install bjcho4141/harness-bujang
/bujang-init
```

## 작업 컨벤션

- **Git author**: `bjcho4141 <bjcho4141@gmail.com>` (로컬 config로 박혀 있음)
- **Push 전**: 항상 `gh auth switch --user bjcho4141`
- **커밋 메시지**: 한국어 본문, 영어 prefix (`feat:`, `fix:`, `chore:` 등)
- **공동저자**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **Staging**: 와일드카드 (`-A`, `.`) 금지. 디렉토리 인자 또는 파일 명시
- **에이전트 변경 시**: shared/agents/ 가 SoT. plugin/agents/ 는 빌드 시 미러링

## 다음 단계

### ✅ 끝난 것

- [x] **npm publish** — `harness-bujang@0.7.1` 라이브 (2026-05-10). https://www.npmjs.com/package/harness-bujang
  - **0.9.1 publish 대기** — **📋 설치 완료 출력 메시지 다이어트 + plugin.json 버전 동기화** — 부장님 컴플레인: "스탭 1~3 박스 너무 많다, 두 단계로 합치자. 그리고 클로드 코드에서 `/open-chat` 안 보인다." 픽스:
    - `init.ts` `printRestartReminder` + `printNextSteps` 두 박스 (이전 3 박스) 로 다이어트. STEP 1 = 재시작 한 줄, STEP 2 = 톡방 열기 (자연어 "부장님 톡방 열어주세요" 또는 터미널 `npx harness-bujang chat`). STEP 3 "부장한테 첫 지시" 박스 통째 제거 — 사용자에게 너무 hand-holding.
    - `/open-chat` 슬래시 커맨드 출력에서 제거 — plugin.json 이 한참 옛날 0.1.0 으로 박혀있어 부장님이 마지막 `/plugin install` 한 시점의 plugin 에 open-chat.md 가 아예 없음. plugin 재설치 안 한 사용자에겐 안 보이는 슬래시 커맨드를 메인으로 안내하면 혼란만 줌. 자연어 ("부장님 톡방 열어주세요") 가 어떤 plugin 버전에서든 동작 → 메인 안내로 승격.
    - `packages/plugin/plugin.json` version 0.1.0 → 0.9.1. description 도 "16 specialist teams, standalone localhost chat-room viewer" 로 갱신.
    - sandbox-test Step 1 키워드 검증 갱신 — 옛 "/open-chat" + "껐다 다시 켜" grep → 새 "종료 후 재시작" + "npx harness-bujang chat" grep.
  - **0.9.0 라이브 (2026-05-17)** — **🧹 admin 라우트 + Next.js 자동설정 통째 제거 (대규모 정리)** — 부장님 컴플레인: "톡방 어드민 페이지 만드는 거 없에자, 그거 때문에 빌드가 깨지더라고. 그냥 로컬호스트 그것만 있어도 될거같에." 0.8.2 의 `patchNextConfig` / `ensurePeerDeps` / `scaffoldEnvExample` 가 사용자 `next.config.{js,mjs,ts}` 와 native peer deps 와 `.env.local.example` 침습해서 환경마다 빌드 깨지던 문제 + admin/harness 라우트가 standalone `bujang chat` 과 surface 중복. 픽스:
    - `packages/template/` 통째 삭제 — `app/admin/harness/`, `app/api/harness/`, `lib/harness-db/`, `migrations/`, `README.md`. monorepo workspaces 글롭 (`packages/*`) 이라 root package.json 무수정.
    - `init.ts` 1315 → 866 LOC (~34% 감소). 제거: `installTemplate` 옵션 / `installDeps` 옵션 / `chatBackend` 선택 / `commitChat` 옵션 / step 6 admin 라우트 분기 / `ensurePeerDeps()` / `patchNextConfig()` / `scaffoldEnvExample()` / `printBackendInstructions()` / `ensureGitignore()` / `copyDir()`. flag 제거: `--chat=` / `--commit-chat` / `--no-template` / `--no-install-deps`.
    - `pm.ts` 통째 삭제 (121 LOC) — `ensurePeerDeps` 가 유일 사용자였음.
    - `migrate.ts` 통째 삭제 + `index.ts` switch 분기 제거. SQLite ↔ Supabase 이전 명령은 admin 라우트 사라지면 의미 0.
    - `nextjs-e2e-test.sh` 통째 삭제 — admin 라우트 전용 e2e.
    - `sandbox-test.sh` Step 4.9 (stub Next.js + installTemplate 검증) + Step 5 (migrate smoke test) 통째 제거.
    - `index.ts` 한·영 HELP 양쪽에서 backend / install-template / install-deps / migrate 옵션 제거. `--tools=all --models=balanced` 예시 추가.
    - `status.ts` "Chat-room UI (optional)" → "Chat room (.harness/chat.db)" 로 변경 (standalone DB 존재 여부 체크).
    - `update.ts` `AssetPaths.projectTemplate` 필드 제거, `ADMIN_HARNESS_ROUTE` context 제거.
    - shared 템플릿 5곳 정리 — `CLAUDE.md.harness-section.template` (ko/en), `AGENT_LEARNING_LOG.seed.md` (ko/en), `director.md` (ko/en) 의 `{{ADMIN_HARNESS_ROUTE}}` placeholder 를 `bujang chat` 안내로 대체.
    - plugin commands 5개 정리 — `bujang-init.md` (도구/모델 prompt 안내), `bujang-status.md` (.harness/chat.db 안내), `bujang-team.md` ("/admin/harness" → 톡방), `bujang-report.md` (SQLite 단일 분기), `open-chat.md` ("/admin/harness" 대체 surface 안내 제거).
    - 루트 README + plugin README + cli README admin/harness · packages/template · Supabase backend 언급 일괄 정리.
    - package.json description 갱신 ("16 specialist teams, standalone localhost chat-room viewer, zero project intrusion").
    - 효과: 사용자 빌드 안 깨짐, surface 단순화 (1개), 신규 사용자 onboarding 더 부드러움.
  - 0.4.0 → 0.5.10 까지 11개 패치 한 번에 publish (Touch ID 1번)
  - 0.6.0 — multi-tool init + per-agent 모델 매핑
  - 0.6.1 — 톡방 read-state SQLite 화 (포트 변경에도 unread 카운트 유지)
  - 0.6.2 — `--help` 한국어 디폴트 + `--help-en` 영어 유지
  - 0.7.0 — 에이전트 .md 하이브리드 변환 (instructions 영어, 부장 발화 한국어 유지) — 토큰 ~30~40% 절감
  - 0.7.1 — README + CLAUDE.md 0.5.3 → 0.7.0 동기화 (docs only)
  - 0.7.2 — 인터랙티브 prompt 7개 한국어 통일 + 도구 선택 checkbox 에 Claude Code 항목 추가
  - 0.8.0 — Claude 토글 가능 + 도구별 모델 prompt 분기 (Codex / Gemini / Aider 단일 모델 픽)
  - **0.8.1 publish 대기** — Codex / Gemini 도 Claude 와 동일한 5-프리셋 (balanced/keep/cost/quality/custom) + per-agent 메모. 0.8.0 publish 직후 부장님 추가 요청 — 같은 0.8.0 으로 publish 불가 (npm immutable) 라 0.8.1 patch.
  - **0.8.2 publish 대기** — **🚀 zero-friction Next.js 셋업** — 부장님 컴플레인: "톡방 열어줘 했을 때 자동으로 열렸으면, 에러 없이." 원인: `bujang init` 가 SQLite 어댑터 (`src/lib/harness-db/sqlite.ts`) 를 사용자 Next.js 프로젝트에 복사해놓고 `better-sqlite3` peer dep 은 print 안내문만 띄우고 끝. 사용자가 `npm run dev` 돌리면 module-not-found 로 폭발. 픽스:
    - 신규 `pm.ts` — package manager 자동 감지 (`packageManager` 필드 → lockfile precedence: pnpm > yarn > bun > npm). 설치 헬퍼 `installDeps()` 가 PM별 정확한 add 명령 (pnpm add / yarn add -D / bun add -d / npm i -D) 을 spawn.
    - `init.ts` `ensurePeerDeps()` — SQLite 면 `better-sqlite3` + `@types/better-sqlite3` (dev), Supabase 면 `@supabase/supabase-js` 자동 설치. 이미 `package.json` deps 에 있으면 skip. 설치 실패 시 (오프라인 / native 빌드 실패) 명확한 에러 + 수동 fallback 명령 출력.
    - `init.ts` `patchNextConfig()` — SQLite 모드 시 `next.config.{js,mjs,ts}` 에 `serverExternalPackages: ['better-sqlite3']` 자동 추가 (Webpack/Turbopack 이 native binding 못 묶음 → 외부화 필수). 3가지 케이스 idempotent: (1) 이미 등록 → no-op (2) array 있는데 better-sqlite3 만 없음 → splice (3) 빈 config → top-level inject. 못 잡으면 수동 snippet 출력.
    - `init.ts` `scaffoldEnvExample()` — Supabase 모드 시 `.env.local.example` 에 5개 키 (`HARNESS_DB`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HARNESS_WRITE_SECRET`, `SUPER_ADMIN_EMAILS`) placeholder 자동 추가. 이미 있으면 merge, 없는 키만 append. idempotent.
    - `--no-install-deps` opt-out flag (CI / 격리 환경용). 한·영 help 양쪽 추가.
    - `printBackendInstructions()` 시그니처에 `installedDeps: boolean` 추가 — auto-install 성공했으면 "1. Install the SQLite driver" 단계 자동 생략 + 나머지 단계 재번호.
    - sandbox-test Step 4.9 — stub Next.js 프로젝트 (package.json + next.config.mjs) 생성 후 SQLite/Supabase 양쪽 init 검증. `--no-install-deps` 로 hermetic 유지 (실제 npm registry 안 침). re-run idempotency 까지 검증.
  - **0.8.3 publish 대기** — **💬 `/open-chat` 슬래시 커맨드 + 설치 후 next-step UX** — 부장님 인사이트: "설치 완료 메시지에 에이전트 껐다 다시 켜라고 하고, 슬래시 명령어 입력하라고 하자." 픽스:
    - `packages/plugin/commands/open-chat.md` 신규 — Claude Code 안에서 `/open-chat` → LLM 이 Bash `run_in_background:true` 로 `npx harness-bujang@latest chat` 실행. 서버 백그라운드 + 브라우저 자동 오픈. 포트 7777 막혀 있으면 CLI 가 다음 포트로 fall-forward.
    - `init.ts` `printRestartReminder` 재작성 — "Restart Claude Code" 를 STEP 1 로 prominent. 권장 = 완전 종료 후 재시작, 대안 = `/agents` (가끔 안 됨 명시).
    - `init.ts` `printNextSteps` 신규 — STEP 2 = `/open-chat` (plugin 안 깔린 사람용 `npx harness-bujang chat` fallback 도 같이 표기), STEP 3 = "부장한테 첫 지시" 예시. Next.js 임베드 모드면 `/admin/harness` 도 같이 안내.
    - 기존 "Next steps:" 섹션 제거 (printNextSteps 가 대체).
    - plugin README + 톱 README "4 slash commands" → "5" 일괄 갱신. plugin commands 표에 `/open-chat` row 추가.
    - `packages/plugin/commands/bujang-init.md` "After install" 섹션 재작성 — 1) 재시작 → 2) `/open-chat` → 3) optional checks 순서로.
    - sandbox-test Step 1 강화 — init 출력 capture 후 `/open-chat` + restart instruction 키워드 grep 으로 회귀 방지.
  - 0.1.0 → 0.2.0: 인터랙티브 init (`@inquirer/prompts`) + 슬래시 커맨드 directive 화
  - 0.2.0 → 0.2.1: 인터랙티브 모드에서 기존 설치 감지 시 overwrite 프롬프트 추가 (선택이 silently ignored 되던 버그 수정)
  - 0.2.1 → 0.3.0: `bujang chat` 명령 — 비-Next.js standalone viewer (Node http + embedded HTML + system sqlite3) + sandbox e2e 검증 스크립트
  - 0.3.0 → 0.3.1: init 메시지 갱신 — "on the roadmap" 옛 안내문 제거 + `bujang chat` 사용법 안내 + Next steps #3 컨텍스트별 분기
  - 0.3.1 → 0.4.0: **`bujang adapt --to=<cursor|cline|aider|codex|gemini|all>`** 명령 추가 — 5개 어댑터로 8+ 도구 호환 (✅ npm 라이브)
  - 0.4.0 → 0.4.1: 톡방 입력창 제거 (Director 자동 픽업 없으면 dead UI)
  - 0.4.1 → 0.4.2: 한국어 디폴트 + 프롬프트 첫 선택지 한국어로 (부장 정체성 강화)
  - 0.4.2 → 0.4.3: director.md에 "새 팀원 채용" 절차 명시 (6단계)
  - 0.4.3 → 0.4.4: 톡방 viewer "전체/안읽음" 카톡 스타일 필터
  - 0.4.4 → 0.5.0: **콘텐츠 제작 7팀 추가** (research / analysis / script / image / voice / edit / content-qa) — 코드 9팀과 함께 총 16팀. utube-start 도메인 흡수.
  - 0.5.0 → 0.5.1: **공동대표 페르소나** + **외부팀원 톡방** + **사전 동의 프로토콜** + PRD/사업계획 매핑 4행 추가. 부장은 사내 16팀만 호출, 외부 도구는 외부팀원 톡방에 로깅.
  - 0.5.1 → 0.5.2: **`bujang update` 명령** — 기존 에이전트 파일 절대 안 건드리고 신규 파일만 추가. 사용자 커스텀 100% 보존. sandbox-test 에 update 회귀 검증.
  - 0.5.2 → 0.5.6: 0.5.3~0.5.6 — chat 첫 실행 시 자동 DB 생성, 톡방 사이드바 스크롤 튕김, 부장→대표님 라우팅 등 패치 6개
  - 0.5.6 → 0.5.7: **`bujang chat` better-sqlite3 마이그레이션** — system sqlite3 CLI shell-out → better-sqlite3 (네이티브 prebuild). 매 쿼리 process spawn 비용 제거. (단 0.5.7 에는 윈도우 브라우저 자동열기 버그 잔존)
  - 0.5.7 → 0.5.8: 윈도우 `openBrowser()` 픽스 — `spawn('start', ...)` 비동기 ENOENT 로 톡방 프로세스가 죽던 버그. `cmd /c start "" <url>` 우회 + error 핸들러 추가.
  - 0.5.8 → 0.5.9: **윈도우에서 `init` 자체가 silent death 하던 치명 버그 픽스** — `index.ts` 가 `chat.ts` 를 top-level import 하던 탓에 better-sqlite3 native binding 로드 실패 시 `init` 코드가 한 줄도 못 돌고 즉사. 모든 커맨드를 dynamic `import()` 로 전환 — `init/status/adapt/update/migrate` 는 better-sqlite3 를 아예 안 건드림. (`bujang chat` 만 native binding 필요)
  - 0.5.9 → 0.5.10: **🔒 1:1 매핑 룰 강화** — director / cofounder 페르소나 + CLAUDE.md 템플릿 (한·영 6개 파일) 에 "**Agent 툴 호출 1번 = `harness_messages` INSERT 1행**" 룰 inline 명시. 병렬 N팀 호출 시 INSERT N건 + 사전 동의 1번 + 디스패치 직전·동시 INSERT. 트리비얼 1줄 픽스도 부장 명의 INSERT 1행 박기 (감사 추적). 사전 동의 → INSERT → Agent 호출 → 결과 INSERT 순서 고정.
  - 0.7.2 → **0.8.0**: **🛠 도구별 모델 prompt 분기 + Claude 토글** — 부장님 인사이트: "코덱스 / 제미니도 선택했으면 그 도구의 모델 선택창도 떠야 한다." `init` 인터랙티브에서 선택된 도구마다 모델 prompt 표시:
    - Claude 선택 → Claude 모델 (balanced/keep/cost/quality/custom) — 기존 그대로 (frontmatter `model:` 진짜 적용)
    - Codex 선택 → OpenAI 모델 (gpt-5 / gpt-5-codex / gpt-4-turbo / o1 / o1-mini / skip) — `AGENTS.md` 상단 메모 (가이드, 도구가 강제 인식 X)
    - Gemini 선택 → Gemini 모델 (gemini-2.5-pro / 2.5-flash / 2.0-pro / 2.0-flash / skip) — `GEMINI.md` 상단 메모
    - Aider 선택 → Aider 모델 (claude-opus-4-7 / claude-sonnet-4-6 / gpt-5 / gemini-2.5-pro / skip) — `.aider.conf.yml` 의 `model:` 필드 **진짜 적용** (Aider 가 시작 시 읽음)
    - Cursor / Cline → 도구가 frontmatter model 안 읽음 → prompt 자체 없음 (통제 불가, 정직)
    - 도구 선택 checkbox 의 Claude Code 항목 disabled 제거 → **체크 해제도 가능** (디폴트는 체크). `.claude/agents/` 는 SoT 라 어쨌든 깔림.
    - CLI flag: `--codex-model=` / `--gemini-model=` / `--aider-model=` (CI 모드)
    - sandbox-test Step 4.8 신규 — Codex/Gemini 메모 + Aider model 필드 박힘 검증.
  - 0.6.1 → 0.6.2: **🇰🇷 `--help` 한국어 디폴트**
  - 0.6.2 → 0.7.0: **🌏 에이전트 .md 하이브리드 변환** — 부장님 인사이트: "한국어가 LLM 컨텍스트 길고 영어 인지력 더 좋다." `shared/agents/ko/*.md` 18개 + `shared/templates/ko/CLAUDE.md.harness-section.template` 의 instructions / 룰 / 매핑 표 / 체크리스트를 영어로 변환 (~30~40% 토큰 절감 추정). 한국어 유지: 페르소나 호칭 (부장 / 대표님 / 공동대표 / 외부팀원), 부장 톡방 발화 ("지시 잘 받았습니다", "완료했습니다"), INSERT 메시지 본문 ("[NOTE] X.tsx 오타 1줄 직접 수정"), 보고 양식 발화. → "톡방 출력은 한국어, 시스템 프롬프트는 영어" 절충. minor bump (큰 콘텐츠 변경). sandbox-test Step 1 에 hybrid 패턴 검증 추가.
  - 0.6.1 → 0.6.2: **🇰🇷 `--help` 한국어 디폴트** — 부장님 컴플레인: "한국어로 나오게 해주고". `index.ts` 의 `HELP` 영어 상수 옆에 한국어 버전 추가. `--help` / `-h` / 인자 없을 때 한국어 출력. 영어 보고 싶으면 `--help-en` 으로 명시. sandbox-test Step 0.5 추가 (한국어/영어 키워드 검증).
  - 0.6.0 → 0.6.1: **📬 톡방 read-state SQLite 화** — 부장님 컴플레인: "어제 다 본 메시지인데 새 톡방 서버 띄울 때마다 안 읽음으로 다시 표시." 원인: 0.5.x~0.6.0 의 read 상태가 브라우저 `localStorage` 에 박혀있어 포트 7777 → 7778 바뀌면 도메인 다른 걸로 인식되어 리셋. 해결:
    - `.harness/chat.db` 에 신규 테이블 `harness_read_state(room, last_seen_at, updated_at)` 추가 — chat.db 가 SoT 라서 포트/서버/브라우저 무관 영구 보존.
    - 신규 API: `GET /api/read-state` (모든 방 last_seen_at) · `POST /api/read-state` (UPSERT, 방 클릭 시 호출).
    - 클라이언트: `state.readByRoom` (서버 fetch) → unread = `messages.filter(m => m.timestamp > lastSeen)`. 첫 페이지 로드 시 read-state 비어있으면 ROOMS 순회하며 각 방 마지막 메시지 timestamp 자동 마킹 (0.6.0 → 0.6.1 업그레이드 사용자가 모든 옛 메시지를 unread 로 보지 않게).
    - 부수효과: 다중 PC 가 같은 chat.db 공유 시 (`--commit-chat` 또는 supabase) read 상태도 동기화됨.
    - sandbox-test Step 3e/3f 추가: GET 비어있음 → POST → GET 반영 → 다른 포트로 서버 재시작 → state 그대로 검증.
  - 0.5.10 → 0.6.0: **🔁 멀티 도구 init + 에이전트별 모델 매핑** —
    - `bujang init` 인터랙티브 모드에 `checkbox` 추가 → Cursor / Codex / Cline / Aider / Gemini 5개 어댑터 multi-select. Claude Code (`.claude/agents/`) 는 항상 SoT 로 깔리고, 추가 어댑터만 선택. init 끝에 `runAdapt()` 자동 호출 — 두 단계 (`init` → `adapt`) 가 한 번에.
    - `--tools=cursor,codex,gemini,all` flag (CI/`--yes` 모드용).
    - 모델 프리셋 `select` prompt — `balanced` (디폴트, opus/sonnet/haiku 균형 매핑, ~60% 비용 절감) / `keep` (frontmatter 그대로) / `cost` (전부 haiku) / `quality` (전부 opus) / `custom` (18팀 차례로 select). `--models=balanced` flag.
    - 에이전트 frontmatter `model:` 라인을 init 시 사용자 선택대로 치환 — `.claude/agents/*.md` 의 SoT 안 건드리고 사용자 프로젝트에 적용.
    - 🐛 **`--version` 하드코딩 픽스** — `index.ts` 가 `console.log('0.5.9')` 하드코딩이라 0.5.10 라이브 후에도 `--version` 이 0.5.9 출력하던 버그. `package.json` 에서 dynamic read 로 전환.
    - sandbox-test 확장: Step 0 (`--version` ↔ package.json 매칭) + Step 4.7 (multi-tool + balanced 프리셋 검증).
- [x] **GitHub Public 전환** — https://github.com/bjcho4141/harness-bujang
- [x] **2FA 셋업** — npm 계정 `bjcho4141` 보안키(passkey) 등록됨
- [x] **본인 검증** — `/Users/cho/Desktop/4141/testtest` 에서 0.1.0 → 0.3.0 전 버전 동작 확인. 카톡 UI 톡방 실제 화면 확인 완료 (2026-05-05)

### 🧑 부장님이 직접 하셔야 하는 일 (남은 것)

#### 1️⃣ Claude Code 마켓플레이스 등록 (선택)

- 신청 페이지: https://claude.com/code (Plugin 카탈로그 메뉴)
- 또는 Anthropic 이메일로 신청
- 등록되면 `/plugin install harness-bujang` (저장소 prefix 생략 가능)

#### 2️⃣ 마케팅 (선택, 가시성 필요할 때)

- HackerNews: "Show HN: Harness-Bujang — Korean-style multi-agent..."
- Reddit: r/ClaudeAI, r/LocalLLaMA
- Twitter/X 스레드 + GIF
- 한국 개발자 커뮤니티: GeekNews, OKKY, 페이스북 그룹

#### 향후 패치 절차

```bash
cd /Users/cho/Desktop/4141/harness-bujang/packages/cli
# 1. 코드 수정
# 2. package.json version bump (예: 0.3.1 → 0.3.2 또는 0.4.0)
# 3. npm run sandbox-test    # 회귀 검증
# 4. npm publish --access public
```

### 🤖 Phase 5 — Claude 작업 항목

#### ✅ 완료된 큰 마일스톤 (요약)

상세 entry 는 위 "끝난 것" 섹션의 버전별 라인 + README 로드맵 참조:

- **0.2.0 ~ 0.2.1** — 인터랙티브 `init` (`@inquirer/prompts`) + 기존 설치 감지 시 overwrite 프롬프트
- **0.2.0** — 슬래시 커맨드 4종 (`/bujang-init`, `/bujang-status`, `/bujang-team`, `/bujang-report`) 실제 액션 directive 화
- **0.3.0** — `bujang chat` standalone viewer (Node http + embedded HTML + 카톡 UI). Rails/Django/Rust 호환
- **0.3.0/0.4.0** — sandbox-test e2e 검증 스크립트 (`npm run sandbox-test`)
- **0.4.0** — 어댑터 5종 (`bujang adapt --to=cursor|cline|aider|codex|gemini|all`) → 9+ 도구 호환
- **0.5.0** — 콘텐츠 7팀 추가 (research/analysis/script/image/voice/edit/content-qa) → 총 16팀
- **0.5.1** — 공동대표 페르소나 + 외부팀원 톡방 + 사전 동의 프로토콜 + PRD/사업 계획 매핑
- **0.5.2** — `bujang update` 안전 업데이트 (기존 파일 절대 안 건드림)
- **0.5.7** — `bujang chat` better-sqlite3 마이그레이션 (system sqlite3 shell-out → 임베디드 prebuild)
- **0.5.8/0.5.9** — 윈도우 zero-install 정상화 (`openBrowser` ENOENT + `init` silent death 픽스)
- **0.5.10** — 🔒 1:1 매핑 룰 (Agent 호출 1번 = `harness_messages` INSERT 1행)
- **0.6.0** — 멀티 도구 init (`--tools=`) + 에이전트별 모델 매핑 (`--models=balanced` 등) — 토큰 ~60% 절감
- **0.6.1** — 톡방 read-state SQLite 화 (`harness_read_state` 테이블 + `GET/POST /api/read-state`) — 포트 변경 영구 대응
- **0.6.2** — `--help` 한국어 디폴트 + `--help-en` 영어 유지
- **0.7.0** — 에이전트 .md 하이브리드 변환 (instructions 영어 + 페르소나 호칭·발화 한국어) — 토큰 30~40% 절감

#### 🚧 미완료 / 다음 단계 후보

- [ ] **migrate 명령 실제 동작 검증** — SQLite 데이터 → Supabase 이전 e2e (현재는 args parse smoke test 만)
- [ ] **better-sqlite3 + Next.js 라우트 통합 e2e** — `packages/template/` 의 admin/harness 라우트와 SQLite 어댑터 결합 검증
- [ ] **`bujang update --force-overwrite` 옵션** — 기존 파일도 강제 갱신 (백업 자동 생성 + diff 표시) — 0.7.0 같이 큰 변경 후 사용자가 손쉽게 따라오게
- [ ] **Plugin 마켓플레이스 등록** — `/plugin install harness-bujang` (저장소 prefix 생략) 가능하게
- [ ] **데모 GIF / Cast 영상** — 부장 호출 → 톡방 INSERT → 통합 보고 흐름 시각화
- [ ] **`harness-bujang@1.0.0`** — 실사용 피드백 누적 후 안정 버전

## 부장님 환경 컨텍스트 (다음 세션 Claude가 알아야 할 것)

- **GitHub 계정**: `bjcho4141` (push 전 항상 `gh auth switch --user bjcho4141`)
- **다른 GitHub 계정**: `bjcho9542-hash` 존재하나 **이 프로젝트에선 사용 금지**
- **npm 계정**: `bjcho4141` (2FA 보안키/passkey 등록됨, `npm publish` 시 Touch ID 인증)
- **상위 워크스페이스**: `/Users/cho/Desktop/4141/` (vibegig·bibi·BRN 등 형제)
- **vibegig 위치**: `/Users/cho/Desktop/4141/vibegig` (이 패키지의 원본 — 참조용으로만 봄)
- **검증용 sandbox 폴더**: `/Users/cho/Desktop/4141/testtest` (기존 설치 있는 상태로 보존 — overwrite 프롬프트 검증용)
- **사용자 메모리**: `/Users/cho/.claude/projects/-Users-cho-Desktop-4141-vibegig/memory/`
  - 이 패키지에는 별도 memory 없음 (생성되면 그쪽 폴더의 새 경로에)

## 알려진 한계

- **plugin.json 공식 spec 미검증** — Claude Code Plugin 공식 문서 spec과 정확히 맞는지 확인 필요. 기본 메타데이터는 올바르게 설정됨
- **better-sqlite3 native 의존성 (CLI 내부)** — `bujang chat` 만 better-sqlite3 사용. CLI 자체가 의존성으로 박혀 있어 사용자 프로젝트는 별도 설치 불필요 (윈도우 포함 zero-install). 0.9.0 이후 사용자 프로젝트에는 native dep 자동설치 안 함.

## 빠른 검증 (다음 세션 시작할 때)

```bash
cd /Users/cho/Desktop/4141/harness-bujang/packages/cli
npm run build && npm run sandbox-test
```

🟢 ALL CHECKS PASSED 나오면 정상. 내부적으로 init → status → chat (HTTP) 전 흐름을 임시 폴더에서 검증한다.
