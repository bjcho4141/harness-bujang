#!/usr/bin/env node

// Each `run*` command is loaded via dynamic import inside the dispatcher
// below. The reason: chat.ts statically imports better-sqlite3 (a native
// addon). If that native binding fails to load on a user's machine — e.g.
// missing prebuild for their CPU arch, locked path with non-ASCII chars
// on Windows — a top-level import in index.ts would crash the process
// before *any* command (even `init`) prints a single byte. Lazy-loading
// keeps init/status/adapt/update/migrate completely free of that risk.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readVersion(): Promise<string> {
  // dist/index.js → ../package.json (npm pack always includes the manifest)
  try {
    const pkgRaw = await fs.readFile(path.resolve(__dirname, '..', 'package.json'), 'utf8');
    return (JSON.parse(pkgRaw).version as string) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const c = {
  bold:    (s: string) => `\x1b[1m${s}\x1b[22m`,
  dim:     (s: string) => `\x1b[2m${s}\x1b[22m`,
  green:   (s: string) => `\x1b[32m${s}\x1b[39m`,
  red:     (s: string) => `\x1b[31m${s}\x1b[39m`,
  yellow:  (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan:    (s: string) => `\x1b[36m${s}\x1b[39m`,
} as const;

const HELP_KO = `
${c.bold('harness-bujang')} — 한국어 부장 페르소나 기반 멀티 에이전트 하네스
${c.dim('https://github.com/bjcho4141/harness-bujang')}

${c.bold('사용법:')}
  npx harness-bujang ${c.cyan('init')}     [옵션]    프로젝트에 하네스 설치
  npx harness-bujang ${c.cyan('update')}   [옵션]    신규 에이전트만 추가 — 기존 파일 안 건드림
  npx harness-bujang ${c.cyan('status')}   [옵션]    하네스 설치 상태 확인
  npx harness-bujang ${c.cyan('chat')}     [옵션]    톡방 viewer 실행 (localhost, 어떤 스택이든)
  npx harness-bujang ${c.cyan('adapt')}    --to=<cursor|cline|aider|codex|gemini|all>  다른 도구용으로 변환

${c.bold('init 옵션:')}
  --lang=<ko|en>           에이전트 언어 (기본값: ko — 전체 부장 페르소나)
  --tools=<list>           추가 어댑터: cursor,cline,aider,codex,gemini,all
                           (Claude Code 는 항상 .claude/agents/ 에 자동 설치됨)
  --models=<preset>        에이전트별 Claude 모델 프리셋: balanced (추천),
                           keep (기본), cost (전부 haiku), quality (전부 opus)
  --target=<path>          프로젝트 루트 (기본값: 현재 디렉토리)
  --framework=<name>       감지된 프레임워크 덮어쓰기
  --db=<name>              감지된 프로젝트 DB 덮어쓰기
  --no-claude-md           CLAUDE.md 수정 건너뛰기
  --no-learning-log        학습 로그 시드 건너뛰기
  --yes, -y                프롬프트 건너뛰고 덮어쓰기 (CI / 스크립트용)

${c.dim('--yes 안 붙이면 인터랙티브 셋업 (언어 / 도구 / 모델 프리셋 prompt).')}

${c.bold('chat 옵션:')}
  --target=<path>          프로젝트 루트 (기본값: 현재 디렉토리)
  --port=<number>          포트 (기본값: 7777, 사용 중이면 다음 포트로)
  --no-open                브라우저 자동 오픈 안 함
  --create                 톡방 DB 가 없으면 빈 DB + 스키마 생성

${c.bold('adapt 옵션:')}
  --to=<cursor|cline|aider|codex|gemini|all>   필수 — 콤마 구분으로 여러 개 OK
  --target=<path>          프로젝트 루트 (기본값: 현재 디렉토리)
  --yes, -y                기존 어댑터 파일 덮어쓰기

${c.bold('update 옵션:')}
  --target=<path>          프로젝트 루트 (기본값: 현재 디렉토리)
  --lang=<ko|en>           새로 추가될 에이전트 언어 (기본값: ko)

${c.dim('  update 는 신규 에이전트 파일만 추가. 기존 파일은 절대 안 건드림.')}
${c.dim('  완전 덮어쓰기 (모든 에이전트 리셋) 가 필요하면: bujang init --yes')}

${c.dim('어댑터 타깃:')}
${c.dim('  cursor  → .cursor/rules/bujang-*.mdc          (Cursor IDE)')}
${c.dim('  cline   → .clinerules/bujang-*.md             (Cline)')}
${c.dim('  aider   → CONVENTIONS.md + .aider.conf.yml    (Aider)')}
${c.dim('  codex   → AGENTS.md                           (Codex CLI / Copilot Coding Agent / Cody)')}
${c.dim('  gemini  → GEMINI.md + .gemini/styleguide.md   (Antigravity / Gemini CLI / Code Assist)')}

${c.bold('예시:')}
  ${c.dim('# 한국어 부장 페르소나 설치 (기본값 — 셋업 불필요)')}
  npx harness-bujang init --lang=ko

  ${c.dim('# 톡방 viewer — 어떤 스택에서도 동작 (Next.js, Rails, Django, …)')}
  npx harness-bujang chat
  ${c.dim('# → http://localhost:7777 자동 오픈')}

  ${c.dim('# 비대화형 — 모든 도구 + balanced 모델 프리셋')}
  npx harness-bujang init --yes --tools=all --models=balanced

${c.dim('English help: ')}${c.bold('npx harness-bujang --help-en')}
`;

const HELP_EN = `
${c.bold('harness-bujang')} — Korean-style multi-agent harness director for Claude Code
${c.dim('https://github.com/bjcho4141/harness-bujang')}

${c.bold('Usage:')}
  npx harness-bujang ${c.cyan('init')}     [options]    Install the harness into a project
  npx harness-bujang ${c.cyan('update')}   [options]    Pull NEW agents only — existing files untouched
  npx harness-bujang ${c.cyan('status')}   [options]    Verify the harness install
  npx harness-bujang ${c.cyan('chat')}     [options]    Open the chat-room viewer (localhost, any stack)
  npx harness-bujang ${c.cyan('adapt')}    --to=<cursor|cline|aider|codex|gemini|all>  Convert .claude/agents/ for other tools

${c.bold('Options for init:')}
  --lang=<ko|en>           Agent language (default: ko — full 부장 persona)
  --tools=<list>           Extra tool adapters: cursor,cline,aider,codex,gemini,all
                           (Claude Code is always installed at .claude/agents/)
  --models=<preset>        Per-agent Claude model preset: balanced (recommended),
                           keep (default), cost (all haiku), quality (all opus)
  --target=<path>          Project root (default: cwd)
  --framework=<name>       Override detected framework
  --db=<name>              Override detected project DB
  --no-claude-md           Skip CLAUDE.md edit
  --no-learning-log        Skip learning log seed
  --yes, -y                Skip prompts and overwrite (non-interactive — for CI / scripts)

${c.dim('Run without --yes for an interactive setup (prompts for language, tools, models).')}

${c.bold('Options for chat:')}
  --target=<path>          Project root (default: cwd)
  --port=<number>          Preferred port (default: 7777, falls forward if busy)
  --no-open                Don't auto-open the browser
  --create                 Create an empty chat DB + schema if none exists yet

${c.bold('Options for adapt:')}
  --to=<cursor|cline|aider|codex|gemini|all>   Required — comma-separated list also OK
  --target=<path>          Project root (default: cwd)
  --yes, -y                Overwrite existing adapter files

${c.bold('Options for update:')}
  --target=<path>          Project root (default: cwd)
  --lang=<ko|en>           Language for newly-added agents (default: ko)

${c.dim('  update only adds NEW agent files. Existing files are NEVER touched.')}
${c.dim('  For a clean overwrite (resets all agents), use: bujang init --yes')}

${c.dim('Adapter targets:')}
${c.dim('  cursor  → .cursor/rules/bujang-*.mdc          (Cursor IDE)')}
${c.dim('  cline   → .clinerules/bujang-*.md             (Cline)')}
${c.dim('  aider   → CONVENTIONS.md + .aider.conf.yml    (Aider)')}
${c.dim('  codex   → AGENTS.md                           (Codex CLI / Copilot Coding Agent / Cody)')}
${c.dim('  gemini  → GEMINI.md + .gemini/styleguide.md   (Antigravity / Gemini CLI / Code Assist)')}

${c.bold('Examples:')}
  ${c.dim('# Install Korean Bujang persona (default — zero setup)')}
  npx harness-bujang init --lang=ko

  ${c.dim('# Open the chat-room viewer — works on ANY stack (Next.js, Rails, Django, …)')}
  npx harness-bujang chat
  ${c.dim('# → opens http://localhost:7777 in your browser')}

  ${c.dim('# Non-interactive — all adapters + balanced model preset')}
  npx harness-bujang init --yes --tools=all --models=balanced
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await (await import('./init.js')).runInit(args.slice(1));
      break;
    case 'status':
      await (await import('./status.js')).runStatus(args.slice(1));
      break;
    case 'chat':
      await (await import('./chat.js')).runChat(args.slice(1));
      break;
    case 'adapt':
      await (await import('./adapt.js')).runAdapt(args.slice(1));
      break;
    case 'update':
      await (await import('./update.js')).runUpdate(args.slice(1));
      break;
    case '--version':
    case '-v':
      console.log(await readVersion());
      break;
    case '--help-en':
    case '-h-en':
      console.log(HELP_EN);
      break;
    case '--help':
    case '-h':
    case undefined:
      console.log(HELP_KO);
      break;
    default:
      console.error(c.red(`알 수 없는 명령어: ${command}`));
      console.log(HELP_KO);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.red(`\n✖ ${err.message}`));
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
