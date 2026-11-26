// 세션을 시작할 때 Claude(또는 Codex)의 맥락에 넣을 컨벤션 글을 만든다 (scripts/conventions.mjs).
// - 자리는 자리표(lib/layout.mjs)의 conventions. 그 자리가 없는 작업 공간(홈, 모양 1·2)은 빈 글이다.
// - 폴더 안내(README.md)와 폐기, 바뀜 상태의 문서는 넣지 않는다. 속성(front matter)은 떼고 본문만 넣는다.
// - 글이 maxChars를 넘으면 본문 대신 문서 목록과 경로를 넣고 모두 읽고 시작하라고 쓴다.
//   훅 출력은 길이 제한이 있고(Claude Code 10,000자), 넘으면 앞부분만 보이고 나머지는 Claude가 읽지 않는 파일로 빠지기 때문이다.

import fs from 'node:fs';
import path from 'node:path';
import { placesOf, localPlace } from './layout.mjs';

export const DEFAULT_MAX_CHARS = 9000;
const SKIP_STATUS = new Set(['폐기', '바뀜']);

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function split(text) {
  const t = text.replace(/^﻿/, '');
  const m = t.match(FM);
  const fm = {};
  if (m) for (const l of m[1].split(/\r?\n/)) { const kv = l.match(/^([\w가-힣-]+)\s*:\s*(.*)$/); if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, ''); }
  return { fm, body: (m ? t.slice(m[0].length) : t).replace(/\r\n/g, '\n').trim() };
}

// 컨벤션 문서를 { rel, shown, title, status, body }로. 이름 차례
export function readConventions(cfg) {
  const rel = localPlace(placesOf(cfg).conventions);
  if (!rel) return [];
  const dir = path.join(cfg.docsRoot, rel);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'readme.md').sort(); } catch { return []; }
  const show = cfg.layout === 'wrapped' ? '.siloroot/' : '';
  const out = [];
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(dir, f), 'utf8'); } catch { continue; }
    const { fm, body } = split(text);
    if (SKIP_STATUS.has(fm.status) || fm.type === 'index' || !body) continue;
    const title = (body.match(/^#\s+(.+)$/m) || [])[1]?.trim() || f;
    out.push({ rel: rel + '/' + f, shown: show + rel + '/' + f, title, status: fm.status || '', body });
  }
  return out;
}

const mark = (d) => (d.status === '제안' ? ' (제안)' : '');

// 맥락에 넣을 글. 넣을 것이 없으면 ''
export function conventionsContext(cfg, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const docs = readConventions(cfg);
  if (!docs.length) return '';
  const folder = (cfg.layout === 'wrapped' ? '.siloroot/' : '') + localPlace(placesOf(cfg).conventions) + '/';
  const full = [
    `[SiloRoot] 이 프로젝트의 컨벤션입니다(${folder}, 문서 ${docs.length}개). 일을 시작하기 전에 읽고, 화면, 설계, 코드, 문서를 고칠 때 따릅니다. 세션 중에 문서가 바뀌었으면 파일이 원본입니다.`,
    ...docs.map((d) => `=== ${d.shown}${mark(d)}\n\n${d.body}`),
  ].join('\n\n');
  if (full.length <= maxChars) return full;
  const head = `[SiloRoot] 이 프로젝트의 컨벤션이 길어(${full.length}자) 내용 대신 목록을 넣습니다. 일을 시작하기 전에 아래 문서를 모두 읽고 따릅니다.`;
  const lines = [];
  let len = head.length;
  for (const [i, d] of docs.entries()) {
    const line = `- \`${d.shown}\`: ${d.title}${mark(d)}`;
    const rest = docs.length - i;
    // 목록마저 넘치면 남은 수와 폴더를 적는다
    if (len + line.length + 1 > maxChars - 80) { lines.push(`- ${lines.length ? '그 밖에 ' : ''}문서 ${rest}개: \`${folder}\``); break; }
    lines.push(line); len += line.length + 1;
  }
  return head + '\n' + lines.join('\n');
}
