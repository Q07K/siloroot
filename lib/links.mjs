// 문서 안의 경로를 찾고 푼다. 뷰어(viewer/build.mjs)와 마이그레이션 002(경로 고치기)가 같이 쓴다.
// 경로는 문서 뿌리 기준이고 '/'로 잇는다.
// - 마크다운 링크 [글](경로): 문서 기준 상대 경로를 먼저 본다.
// - 백틱 `경로`: 폴더 맨 위 기준을 먼저 본다(SiloRoot 문서가 그렇게 쓴다).
// 코드 펜스(```)와 HTML 주석 안은 읽지 않는다.

import path from 'node:path';

// 문서 경로 목록으로 찾기 표를 만든다
export function makeIndex(rels) {
  const mdSet = new Set(rels);
  const dirSet = new Set();
  const byBase = new Map();
  for (const rel of mdSet) {
    const parts = rel.split('/');
    for (let k = 1; k < parts.length; k++) dirSet.add(parts.slice(0, k).join('/'));
    const base = parts[parts.length - 1].toLowerCase();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(rel);
  }
  return { mdSet, dirSet, byBase };
}

// 경로 글자를 문서 경로로 푼다. 못 찾으면 null. 폴더를 가리키면 그 폴더의 README.md
// mode 'link': 마크다운 링크, 'code': 백틱 안의 글자
export function resolveTarget(index, raw, fromRel, mode) {
  const { mdSet, dirSet, byBase } = index;
  let t = String(raw).trim();
  if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('#')) return null;
  t = t.replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '');
  try { t = decodeURIComponent(t); } catch { /* 그대로 둔다 */ }
  t = t.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!t || /\s{2,}/.test(t)) return null;
  if (mode === 'code' && !t.includes('/') && !/\.(md|markdown)$/i.test(t)) return null;
  if (t.startsWith('/')) t = t.slice(1);
  const fromDir = path.posix.dirname(fromRel);
  const docRel = path.posix.normalize(path.posix.join(fromDir === '.' ? '' : fromDir, t));
  const rootRel = path.posix.normalize(t);
  const candidates = mode === 'code' ? [rootRel, docRel] : [docRel, rootRel];
  for (let c of candidates) {
    c = c.replace(/\/+$/, '');
    if (!c || c.startsWith('..')) continue;
    if (mdSet.has(c)) return c;
    if (dirSet.has(c)) {
      for (const name of ['README.md', 'readme.md', 'index.md']) if (mdSet.has(c + '/' + name)) return c + '/' + name;
      return null;
    }
  }
  if (!t.includes('/') && /\.(md|markdown)$/i.test(t)) {
    const list = byBase.get(t.toLowerCase());
    if (list && list.length === 1) return list[0];
  }
  return null;
}

// 코드 펜스와 HTML 주석을 같은 길이의 공백으로 가린다. 위치가 그대로라 찾은 자리를 원문에서 바꿀 수 있다
function mask(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text.replace(/<!--[\s\S]*?-->/g, blank).replace(/^[ \t]*```[\s\S]*?^[ \t]*```/gm, blank);
}

// 본문의 경로 글자 자리. [{ start, end, raw, kind }]. start~end는 원문에서 raw가 있는 자리다
export function linkTokens(text) {
  const body = mask(text);
  const out = [];
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const start = m.index + m[0].indexOf('(') + 1;
    out.push({ start, end: start + m[1].length, raw: m[1], kind: 'link' });
  }
  for (const m of body.matchAll(/`([^`\n]+)`/g)) {
    // 링크 안의 백틱([`a.md`](a.md))은 위에서 잡은 링크와 겹치지 않는다
    out.push({ start: m.index + 1, end: m.index + 1 + m[1].length, raw: m[1], kind: 'code' });
  }
  return out.sort((a, b) => a.start - b.start);
}
