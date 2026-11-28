// 세션을 시작할 때 Codex의 맥락에 넣을 SiloRoot 작업 규칙 글을 만든다 (scripts/rules.mjs, hooks/codex-hooks.json).
// - Claude Code는 CLAUDE.local.md의 @.siloroot/CLAUDE.md 줄로 규칙을 읽는다. Codex는 AGENTS.md 계열 파일만 읽고
//   @경로 불러오기도 없어서, 훅이 규칙 파일(문서 뿌리의 CLAUDE.md) 본문을 넣는다 (shared/issues/codex-rules-not-loaded.md).
// - 속성(front matter)과 관리 표시(siloroot:start/end)는 뗀다. 한 줄짜리 @경로(사용자 정보 불러오기)는 그 파일 본문으로 바꾼다.
// - 글이 maxChars를 넘으면 본문 대신 규칙 파일을 읽으라는 안내만 넣는다.

import fs from 'node:fs';
import path from 'node:path';
import { userDir } from './user.mjs';

export const DEFAULT_MAX_CHARS = 16000;

const FM = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const MARK = /^<!-- siloroot:(start|end) -->$/;

const read = (file) => { try { return fs.readFileSync(file, 'utf8').replace(/^﻿/, ''); } catch { return null; } };
const strip = (text) => text.replace(FM, '').replace(/\r\n/g, '\n');

// @경로: ~/는 사용자 폴더, 상대 경로는 규칙 파일이 있는 폴더 기준 (Claude Code의 불러오기와 같게)
function resolveImport(p, baseDir) {
  if (p.startsWith('~/')) return path.join(userDir(), p.slice(2));
  return path.isAbsolute(p) ? p : path.join(baseDir, p);
}

// 규칙 파일 본문. 한 단계만 불러온다(불러온 파일 안의 @줄은 그대로 둔다)
function expand(text, baseDir) {
  const out = [];
  for (const line of strip(text).split('\n')) {
    if (MARK.test(line.trim())) continue;
    const m = line.trim().match(/^@(\S+)$/);
    if (!m) { out.push(line); continue; }
    const sub = read(resolveImport(m[1], baseDir));
    out.push(sub == null ? line : `(아래는 \`${m[1]}\`의 내용)\n\n` + strip(sub).trim());
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// 맥락에 넣을 글. 규칙 파일이 없으면 ''
export function rulesContext(cfg, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const file = path.join(cfg.docsRoot, 'CLAUDE.md');
  const raw = read(file);
  if (raw == null) return '';
  const shown = cfg.layout === 'wrapped' ? '.siloroot/CLAUDE.md' : 'CLAUDE.md';
  const body = expand(raw, path.dirname(file));
  const head = `[SiloRoot] 이 폴더의 작업 규칙입니다(\`${shown}\`). Codex는 이 파일을 스스로 읽지 않아 세션을 시작할 때 넣습니다. 이 대화 내내 이 규칙을 따릅니다. 세션 중에 파일이 바뀌었으면 파일이 원본입니다.`;
  const full = `${head}\n\n${body}`;
  if (full.length <= maxChars) return full;
  return `[SiloRoot] 이 폴더는 SiloRoot 작업 공간입니다. 작업 규칙(\`${shown}\`, ${body.length}자)이 길어 내용 대신 안내만 넣습니다. 일을 시작하기 전에 이 파일과, 그 안의 @줄이 가리키는 파일을 읽고 따릅니다. "문서로 써 줘"는 그 규칙의 자리 표에 맞는 마크다운 문서를 만들라는 뜻입니다. Word, PDF는 사용자가 그 형식을 말할 때만 만듭니다.`;
}
