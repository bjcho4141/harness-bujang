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
│   │   ├── src/{index,init,status,migrate,scan,template}.ts
│   │   ├── scripts/prepare-templates.mjs   # shared → templates/ 번들
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

# Sandbox 검증
node packages/cli/dist/index.js init --target=/tmp/sandbox --lang=ko --yes
node packages/cli/dist/index.js status /tmp/sandbox

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

코드/검증은 다 끝났고 외부 작업만 남음. **누가 해야 하는지** 명확히 분리:

### 🧑 부장님이 직접 하셔야 하는 일 (외부 계정·결정 필요)

다음 4가지는 Claude가 대신 못 함. 외부 계정·2FA·홍보 결정·돈 등이 걸림.

#### 1️⃣ npm publish — 전세계가 `npx harness-bujang init` 쓸 수 있게

```bash
# npm 계정 없으면 https://www.npmjs.com/signup 가입 먼저
cd /Users/cho/Desktop/4141/harness-bujang/packages/cli
npm login                    # 이메일/2FA 1회
npm publish --access public  # prepublishOnly가 자동 build
```

확인:
- https://www.npmjs.com/package/harness-bujang 에 페이지 뜨면 성공
- 검증: `npx harness-bujang@latest --help`

소요: 5분. 비용: 0원.

#### 2️⃣ GitHub repo Public 전환

- 가서: https://github.com/bjcho4141/harness-bujang/settings
- 맨 아래 "Danger Zone" → "Change visibility" → Public

지금 Private이면 외부 사용자가 못 봄. Public이어야 `/plugin install bjcho4141/harness-bujang` 도 됨.

#### 3️⃣ Claude Code 마켓플레이스 등록 (선택)

- 신청 페이지: https://claude.com/code (Plugin 카탈로그 메뉴)
- 또는 Anthropic 이메일로 신청
- 등록되면 `/plugin install harness-bujang` (저장소 prefix 생략 가능)

#### 4️⃣ 마케팅 (선택, 가시성 필요할 때)

- HackerNews: "Show HN: Harness-Bujang — Korean-style multi-agent..."
- Reddit: r/ClaudeAI, r/LocalLLaMA
- Twitter/X 스레드 + GIF
- 한국 개발자 커뮤니티: GeekNews, OKKY, 페이스북 그룹

### 🤖 다음 세션 Claude한테 시킬 수 있는 일

코드 측면 확장 — 부장님이 외부 작업 끝나고 시간 되면:

#### A. 어댑터 확장 (다른 도구 호환)

- [ ] Cursor 어댑터 — `.claude/agents/` → `.cursor/rules/` 변환
- [ ] Cline 어댑터 — `.claude/agents/` → `.clinerules/` 변환
- [ ] Aider 어댑터 — `CONVENTIONS.md` 한 파일로 압축

각각 ~1일.

#### B. 비-Next.js standalone viewer

- [ ] `bujang chat` 명령 — Hono/Express + WebSocket + localhost:7777
- [ ] KakaoTalk UI 단일 HTML로 포팅
- [ ] SQLite 직접 읽기 (Next.js 라우트 불필요)
- [ ] Rails/Django/Rust 사용자도 톡방 사용 가능해짐

~3일.

#### C. 슬래시 커맨드 실제 구현

현재 `commands/*.md` 는 가이드 텍스트만. 다음 세션에서:

- [ ] `/bujang-team` — 실제 Agent 호출 + 톡방 INSERT 로직
- [ ] `/bujang-status` — DB 직접 조회
- [ ] `/bujang-report` — 자동 요약 생성

각 ~0.5일.

#### D. 인터랙티브 init

- [ ] `@inquirer/prompts` 추가 — 인자 없이 실행 시 질문 던짐
- [ ] 자동 감지 결과 보여주고 사용자 확인
- [ ] 더 부드러운 UX

~1일.

#### E. 검증 확장

- [ ] Rails / Django sandbox에 init 검증
- [ ] better-sqlite3 실제 install 후 init→메시지 INSERT→localhost 보이는 것 검증
- [ ] migrate 명령 실제 동작 검증 (SQLite 데이터 생성 → Supabase로 이전)

~0.5일.

## 부장님 환경 컨텍스트 (다음 세션 Claude가 알아야 할 것)

- **GitHub 계정**: `bjcho4141` (push 전 항상 `gh auth switch --user bjcho4141`)
- **다른 GitHub 계정**: `bjcho9542-hash` 존재하나 **이 프로젝트에선 사용 금지**
- **npm 계정**: 부장님이 가입 필요 (확인 필요)
- **상위 워크스페이스**: `/Users/cho/Desktop/4141/` (vibegig·bibi·BRN 등 형제)
- **vibegig 위치**: `/Users/cho/Desktop/4141/vibegig` (이 패키지의 원본 — 참조용으로만 봄)
- **사용자 메모리**: `/Users/cho/.claude/projects/-Users-cho-Desktop-4141-vibegig/memory/`
  - 이 패키지에는 별도 memory 없음 (생성되면 그쪽 폴더의 새 경로에)

## 알려진 한계

- **plugin.json 공식 spec 미검증** — Claude Code Plugin 공식 문서 spec과 정확히 맞는지 확인 필요. 기본 메타데이터는 올바르게 설정됨
- **better-sqlite3 native 의존성** — 사용자 프로젝트에서 `npm i better-sqlite3` 필요. CLI는 `dependencies` 안 박음 (사용자 책임)
- **인터랙티브 모드 없음** — `init`은 인자 기반만. `@inquirer/prompts` 추가 시 더 부드러워짐

## 빠른 검증 (다음 세션 시작할 때)

```bash
# 빌드 + sandbox 통합 테스트
cd packages/cli && npm run build \
  && rm -rf /tmp/sb && mkdir -p /tmp/sb && cd /tmp/sb \
  && echo '{"name":"sb","scripts":{"build":"next build"},"dependencies":{"next":"^16.0.0"}}' > package.json \
  && touch tsconfig.json next.config.js \
  && node /Users/cho/Desktop/4141/harness-bujang/packages/cli/dist/index.js init --target=/tmp/sb --yes \
  && node /Users/cho/Desktop/4141/harness-bujang/packages/cli/dist/index.js status /tmp/sb
```

🟢 healthy 나오면 정상.
