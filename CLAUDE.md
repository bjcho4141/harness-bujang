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
│   ├── agents/{ko,en}/                  # 에이전트 10개 × 2 언어
│   └── templates/{ko,en}/               # CLAUDE.md 섹션 + 학습로그 시드
├── packages/
│   ├── plugin/                          # Claude Code Plugin (/plugin install)
│   ├── cli/                             # npx harness-bujang (npm publish 대상)
│   │   ├── src/{index,init,status,migrate,chat,adapt,scan,template}.ts
│   │   ├── scripts/prepare-templates.mjs   # shared → templates/ 번들
│   │   ├── scripts/sandbox-test.sh         # e2e 검증
│   │   └── templates/                   # 빌드 산출물 (gitignored)
│   └── template/                        # Next.js+Supabase 톡방 자산
│       ├── app/admin/harness/           # KakaoTalk-style UI
│       ├── app/api/harness/             # logs + reply routes
│       ├── lib/harness-db/              # SQLite/Supabase 어댑터
│       └── migrations/                  # Postgres SQL
└── README.md                            # 통합 사용자 가이드
```

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

- [x] **npm publish** — `harness-bujang@0.4.0` 라이브 (2026-05-05). https://www.npmjs.com/package/harness-bujang
  - **0.5.1 publish 대기** — 0.4.1 ~ 0.5.1 까지 7개 패치 코드 푸시 완료, npm 라이브만 안 됨 (부장님이 한 번에 publish 예정)
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
  - 0.5.1 → **0.5.2**: **`bujang update` 명령** — 기존 에이전트 파일 절대 안 건드리고 신규 파일만 추가. 사용자 커스텀 100% 보존. sandbox-test 에 update 회귀 검증.
- [x] **GitHub Public 전환** — https://github.com/bjcho4141/harness-bujang
- [x] **2FA 셋업** — npm 계정 `bjcho4141` 보안키(passkey) 등록됨
- [x] **본인 검증** — `/Users/cho/Desktop/4141/testtest` 에서 0.1.0 → 0.3.0 전 버전 동작 확인. 카톡 UI 톡방 실제 화면 확인 완료 (2026-05-05)

### 🧑 부장님이 직접 하셔야 하는 일 (남은 것)

#### 1️⃣ npm publish 0.5.2 (필수, 5분)

이번 publish에 **0.4.0 → 0.5.2 사이 8개 패치** 가 한 번에 라이브됨:
- 톡방 입력창 제거 (0.4.1)
- 한국어 디폴트 (0.4.2)
- 새 팀원 채용 절차 (0.4.3)
- 전체/안읽음 필터 (0.4.4)
- 콘텐츠 7팀 추가 (0.5.0)
- 공동대표 페르소나 + 외부팀원 톡방 + 사전 동의 + PRD 매핑 (0.5.1)
- `bujang update` 명령 — 기존 파일 절대 안 건드리는 안전 업데이트 (0.5.2)

```bash
cd /Users/cho/Desktop/4141/harness-bujang/packages/cli
npm publish --access public  # Touch ID 한 번
```

publish 후 검증:
```bash
mkdir -p /tmp/test-052 && cd /tmp/test-052
npx harness-bujang@latest --version       # → 0.5.2
npx harness-bujang@latest init --yes --lang=ko
ls .claude/agents/ | wc -l                # → 18 (16팀 + director + cofounder)
npx harness-bujang@latest adapt --to=all --yes
ls -la .cursor .clinerules CONVENTIONS.md AGENTS.md GEMINI.md  # 모두 존재

# 안전 업데이트 검증: 기존 파일 안 건드리는지
npx harness-bujang@latest update          # → 신규 파일 0개 추가, 기존 18개 그대로
```

#### 2️⃣ Claude Code 마켓플레이스 등록 (선택)

- 신청 페이지: https://claude.com/code (Plugin 카탈로그 메뉴)
- 또는 Anthropic 이메일로 신청
- 등록되면 `/plugin install harness-bujang` (저장소 prefix 생략 가능)

#### 3️⃣ 마케팅 (선택, 가시성 필요할 때)

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

#### A. 어댑터 확장 (다른 도구 호환) ✅ v0.4.0에 완료

- [x] Cursor 어댑터 — `.claude/agents/` → `.cursor/rules/bujang-*.mdc` (frontmatter 포함)
- [x] Cline 어댑터 — `.claude/agents/` → `.clinerules/bujang-*.md`
- [x] Aider 어댑터 — `CONVENTIONS.md` + `.aider.conf.yml` (read: 자동 추가)
- [x] **Codex 어댑터** — `AGENTS.md` (Codex CLI / Copilot Coding Agent / Cody)
- [x] **Gemini 어댑터** — `GEMINI.md` + `.gemini/styleguide.md` (Antigravity / Gemini CLI / Code Assist 워크스페이스 + GitHub PR 리뷰)
- [x] `bujang adapt --to=all` — 5개 타깃 한 번에
- [x] sandbox-test 에 어댑터 검증 단계 추가 (10개 파일 + 콘텐츠 체크)

#### B. 비-Next.js standalone viewer ✅ v0.3.0에 완료

- [x] `bujang chat` 명령 — Node http + embedded HTML + system sqlite3 shell-out
- [x] KakaoTalk UI 단일 HTML로 포팅 (Tailwind CDN + vanilla JS, 폴링 2초)
- [x] SQLite 직접 읽기 (Next.js 라우트 불필요)
- [x] Rails/Django/Rust 사용자도 톡방 사용 가능 — `npx harness-bujang chat` 한 줄
- [x] 입력 바도 동작 — `대표님` 메시지 인서트 가능 (Director 픽업 가능)
- [x] DB 없으면 `--create` 로 빈 DB + 시드 row 생성

#### C. 슬래시 커맨드 실제 구현 ✅ v0.2.0에 완료

- [x] `/bujang-init` — `npx harness-bujang@latest init` 직접 호출 지시
- [x] `/bujang-status` — `npx harness-bujang status .` 실행 + DB 쿼리 옵션
- [x] `/bujang-team` — Agent tool 호출 + harness_messages INSERT SQL 명세
- [x] `/bujang-report` — SQLite/Supabase 백엔드 자동 감지 + 집계 로직

#### D. 인터랙티브 init ✅ v0.2.0/0.2.1에 완료

- [x] `@inquirer/prompts` 추가 — `--yes` 미지정 시 select/confirm 프롬프트
- [x] 자동 감지 결과 보여주고 사용자 확인
- [x] 기존 설치 감지 시 overwrite 프롬프트 (0.2.1)

#### E. 검증 확장 ✅ v0.3.0에 완료 (일부)

- [x] sandbox e2e 검증 스크립트 — `scripts/sandbox-test.sh` (init → status → chat 전 흐름)
- [x] `npm run sandbox-test` 한 줄로 실행 가능
- [x] 한국어 에이전트 적용 검증 (director.md에 "부장" 포함 여부)
- [x] chat HTTP 엔드포인트 검증 (GET / · GET /api/messages · POST /api/messages)
- [ ] migrate 명령 실제 동작 검증 (SQLite 데이터 → Supabase 이전) — 다음 세션
- [ ] better-sqlite3 실제 install 후 Next.js 라우트 통합 e2e — 다음 세션

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
- **better-sqlite3 native 의존성** — Next.js 톡방 UI 사용 시 사용자 프로젝트에서 `npm i better-sqlite3` 필요 (CLI dependencies에는 박지 않음). `bujang chat` 은 system sqlite3 CLI를 shell-out 하므로 better-sqlite3 불필요
- **`bujang chat` Windows 미검증** — system `sqlite3.exe` 설치 + PATH 등록 시 동작해야 하나 실제 검증 미실시

## 빠른 검증 (다음 세션 시작할 때)

```bash
cd /Users/cho/Desktop/4141/harness-bujang/packages/cli
npm run build && npm run sandbox-test
```

🟢 ALL CHECKS PASSED 나오면 정상. 내부적으로 init → status → chat (HTTP) 전 흐름을 임시 폴더에서 검증한다.
