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

## 다음 단계 옵션

코드/검증은 다 끝났고 외부 작업만 남음:

### 우선순위 1 — 즉시 가능

- [ ] **npm publish** (`harness-bujang@0.1.0`)
  ```bash
  cd packages/cli
  npm login                    # 한 번만
  npm publish --access public  # prepublishOnly가 자동으로 build 돌림
  ```
- [ ] **GitHub repo Public 전환** (Settings → Visibility)

### 우선순위 2 — 가시성

- [ ] Claude Code 마켓플레이스 등록 신청
- [ ] 데모 GIF / 터미널 cast (asciinema)
- [ ] HackerNews / Reddit (r/ClaudeAI) 첫 글

### 우선순위 3 — 기능 확장

- [ ] Cursor 어댑터 (`.cursor/rules/` 변환)
- [ ] Cline 어댑터 (`.clinerules/`)
- [ ] 비-Next.js용 standalone viewer (`bujang chat` localhost:7777)
- [ ] `/bujang-team` 슬래시 커맨드 실제 구현 (현재는 가이드 마크다운만)

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
