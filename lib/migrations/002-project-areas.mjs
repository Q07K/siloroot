// 002: 모양 2(감싼 배치, 01-log/~05-profile/) → 모양 3(프로젝트의 shared/·private/와 홈)
// 설계: 저장소 작업 공간의 03-ideas/project-folder-layout-decision-design.md 4.11
// - 문서마다 갈 곳(placements)을 자리표 규칙으로 정한다. 규칙으로 못 가르는 아이디어 문서만 review로 표시하고, 기본값은 shared/ideas/다.
//   답의 placements({ <옛 경로>: <갈 곳> })로 고친다. 아이디어 옆의 결정 문서와 그림은 아이디어를 따라간다.
// - 홈에 갈 것(공부 노트, 사용자 정보, 글쓰기 규칙, 규칙·사용자 정보 후보)은 홈으로 간다. 홈이 없으면 만든다.
//   홈에 이미 있는 profile.md, writing-guide.md, study/README.md는 덮어쓰지 않고 표 줄을 합친다.
// - 옮긴 문서 안의 경로(related, 백틱, 마크다운 링크)는 새 자리로 고친다. 홈과 프로젝트 사이는 home:, <이름>: 꼴로 적는다.
// - 순서: 새 자리를 모두 쓴 다음 옛 파일을 지우고, 설정은 맨 끝에 고친다. 지우기 전에 실패하면 다시 돌려 이어 간다.
//   지우는 중에 실패하면 state/의 표시 파일(migrate-002.json)로 남은 지우기부터 이어 간다.
// 경로는 문서 뿌리(.siloroot/) 기준이고 '/'로 잇는다. 홈 쪽 경로는 'home:' 접두사를 붙인다.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { updateConfig, writeConfig, loadConfig, pluginVersion } from '../config.mjs';
import { readUser, setHome, registerProject, projectNameFor, userDir, userFile, importPath, overlaps, usedPorts } from '../user.mjs';
import { hasAdditionalDirectory, addAdditionalDirectory, settingsFile } from '../claude-settings.mjs';
import { START, END, readTpl, applyRefresh, planRefresh, gitExcludeFile, ensureLines, EXCLUDE_HEAD } from '../workspace-sync.mjs';
import { makeIndex, resolveTarget, linkTokens } from '../links.mjs';

const ID = '002-project-areas';
const MARK = 'migrate-002.json';
const TPL_GITIGNORE_WRAPPED = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'gitignore.wrapped');
// 문서 뿌리 맨 위에서 옮기지 않는 것. CLAUDE.md는 관리 블록 밖만 경로를 고치고, metadata-guide.md는 새 템플릿으로 바꾼다
const MANAGED = new Set(['CLAUDE.md', 'metadata-guide.md', 'config.json']);
// 홈에 이미 있으면 표 줄을 합치는 파일과 그 템플릿. feedback/README.md는 홈 것을 그대로 둔다
const MERGE_TPL = { 'profile.md': 'home/profile.md', 'writing-guide.md': 'home/writing-guide.md', 'study/README.md': 'home/study/README.md' };
const KEEP_HOME = { 'feedback/README.md': 'home/feedback/README.md' };
// 사용자가 더한 폴더 가운데 이름이 자리표에 있는 것(앞 번호는 떼고 견준다)
const NAMED = { discussions: 'private/discussions', notes: 'private/notes', sources: 'private/sources', issues: 'shared/issues', conventions: 'shared/conventions' };

const slash = (p) => path.resolve(p).split(path.sep).join('/');
const nl = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const isMd = (f) => /\.(md|markdown)$/i.test(f);
const isHomeTo = (to) => to.startsWith('home:');
const homeRel = (to) => to.slice('home:'.length);
const base = (rel) => rel.split('/').pop();
const dirOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');
const noDates = (s) => nl(s).replace(/\d{4}-\d{2}-\d{2}/g, 'DATE').replace(/\{\{date\}\}/g, 'DATE').trim();
const fmOf = (text) => { const m = nl(text).match(/^---\n([\s\S]*?)\n---/); return m ? m[1] : ''; };
const typeOf = (text) => { const t = fmOf(text).match(/^type\s*:\s*(.+)$/m); return t ? t[1].trim().replace(/^["']|["']$/g, '') : null; };

// 문서 뿌리 아래 옮길 파일(숨은 것, state/, 관리 파일은 뺀다)
function walk(docsRoot) {
  const out = [];
  const go = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.isSymbolicLink()) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (!rel && (e.name === 'state' || MANAGED.has(e.name))) continue;
      if (e.isDirectory()) go(path.join(dir, e.name), r);
      else out.push(r);
    }
  };
  if (fs.existsSync(docsRoot)) go(docsRoot, '');
  return out.sort();
}

function gitTracked(root, rels) {
  if (!rels.length) return [];
  try {
    return execFileSync('git', ['ls-files', '-z', '--', ...rels], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).split('\0').filter(Boolean);
  } catch {
    return [];
  }
}
const git = (root, args) => execFileSync('git', args, { cwd: root, stdio: 'ignore', windowsHide: true });

// 답의 갈 곳이 쓸 수 있는 꼴인가: shared/..., private/..., home:...
function validTo(to) {
  if (typeof to !== 'string') return false;
  const rel = isHomeTo(to) ? homeRel(to) : to;
  if (!rel || rel.includes(':') || rel.startsWith('/') || rel.split('/').some((s) => s === '..' || s === '.' || s === '')) return false;
  return isHomeTo(to) || /^(shared|private)\//.test(to);
}

// ---------- 갈 곳 ----------
// 옛 경로 하나의 기본 갈 곳. { to, why, review, kind } kind: 'idea' | 'follower' | 'asset' | null
function ruleOf(rel, text, d) {
  const [top, ...rest] = rel.split('/');
  const sub = rest.join('/');
  if (!rest.length) {
    if (rel === 'writing-guide.md') return { to: 'home:writing-guide.md', why: '글쓰기 규칙은 홈' };
    return { to: isMd(rel) ? 'private/notes/' + rel : 'private/' + rel, why: '맨 위의 다른 파일은 개인 영역' };
  }
  if (top === d.log) return { to: 'private/log/' + sub, why: '작업 기록 자리' };
  if (top === d.study) return { to: 'home:study/' + sub, why: '공부 노트(개념)는 홈' };
  if (top === d.feedback) {
    if (sub === 'README.md') return { to: 'home:feedback/README.md', why: '후보와 댓글 안내는 홈' };
    const t = text == null ? null : typeOf(text);
    if (t === 'rule' || t === 'trait') return { to: 'home:feedback/' + sub, why: '규칙·사용자 정보 후보는 홈' };
    return { to: 'private/feedback/' + sub, why: '이 프로젝트 문서에 단 뷰어 댓글' };
  }
  if (top === d.profile) {
    if (sub === 'profile.md' || sub === 'ai-comment.md') return { to: 'home:' + sub, why: '사용자 정보는 홈' };
    return { to: 'private/notes/' + sub, why: '사용자 정보 폴더의 다른 파일은 개인 영역' };
  }
  if (top === d.ideas) {
    if (sub === 'README.md') return { to: 'shared/ideas/README.md', why: '아이디어 목록' };
    if (!isMd(sub)) return { to: 'shared/ideas/' + sub, why: '아이디어 폴더의 파일', kind: 'asset' };
    const t = text == null ? null : typeOf(text);
    if (t === 'idea') return { to: 'shared/ideas/' + sub, why: '아이디어: 제품 아이디어인지 개인 아이디어인지 규칙으로 가를 수 없음', review: true, kind: 'idea' };
    return { to: decisionPlace('shared', sub, t), why: '아이디어 폴더의 ' + (t || '속성 없는') + ' 문서', kind: rest.length === 1 && sub.includes('-decision-') ? 'follower' : null };
  }
  // 사용자가 더한 폴더: 자리표에 같은 이름이 있으면 그리로, 아니면 private/<폴더>/
  const name = top.replace(/^\d+[-_]/, '');
  if (NAMED[name]) return { to: NAMED[name] + '/' + sub, why: `사용자가 더한 폴더 ${top}/는 자리표의 ${NAMED[name]}/`, review: NAMED[name].startsWith('shared/') };
  return { to: 'private/' + rel, why: `사용자가 더한 폴더 ${top}/는 개인 영역` };
}

// 결정 문서의 자리. -decision-design은 설계, -decision-plan은 로드맵. 홈이면 아이디어 옆(ideas/)
function decisionPlace(area, file, type) {
  if (area === 'home') return 'home:ideas/' + file;
  if (/-decision-design[^/]*$/.test(file) || type === 'design') return 'shared/design/' + file;
  if (/-decision-plan[^/]*$/.test(file) || type === 'roadmap') return 'shared/roadmap/' + file;
  if (type === 'decision' || file.includes('-decision-')) return 'shared/decisions/' + file;
  return 'shared/ideas/' + file;
}

// ---------- 경로 고치기 ----------
const SUFFIX = /(#.*|:\d+(-\d+)?)$/;

// 옮긴 뒤의 경로를 그 문서 자리에서 쓰는 꼴로. self: { ws: 'project'|'home', rel }
function formatRef(target, kind, self, name) {
  const ws = isHomeTo(target) ? 'home' : 'project';
  const rel = ws === 'home' ? homeRel(target) : target;
  if (ws !== self.ws) return (ws === 'home' ? 'home:' : name + ':') + rel;
  if (kind === 'link') { const r = path.posix.relative(dirOf(self.rel) || '.', rel); return r || base(rel); }
  return rel;
}

function rewriteRef(raw, kind, ctx, fromRel, self) {
  const suffix = (String(raw).match(SUFFIX) || [''])[0];
  const bare = suffix ? raw.slice(0, -suffix.length) : raw;
  // 그림, 스크립트 같은 파일: 문서 뿌리 기준이나 문서 기준 경로가 옛 파일과 똑같을 때만
  // 백틱 안의 맨 파일 이름(`README.md`)은 어느 문서인지 글로 가리킨 것일 때가 많아 고치지 않는다
  if (kind === 'code' && !bare.includes('/')) return null;
  if (!isMd(bare.trim())) {
    const t = bare.trim().replace(/\\/g, '/').replace(/^\.\//, '');
    if (!t.includes('/')) return null;
    const dir = dirOf(fromRel);
    const hit = [path.posix.normalize(t), path.posix.normalize(path.posix.join(dir || '.', t))].find((c) => ctx.assets.has(c));
    if (!hit) return null;
    const next = formatRef(ctx.assets.get(hit), kind, self, ctx.name) + suffix;
    return next === raw ? null : next;
  }
  // 폴더 이름만 적은 것은 고치지 않는다
  const target = resolveTarget(ctx.index, raw, fromRel, kind);
  if (!target) return null;
  const moved = ctx.map.get(target) ?? target;
  if (moved === target && self.ws === 'project' && self.rel === fromRel) return null;
  const next = formatRef(moved, kind, self, ctx.name) + suffix;
  return next === raw ? null : next;
}

// 문서 하나의 경로를 고친 내용과 고친 수
function rewriteText(text, fromRel, self, ctx, { folders = false } = {}) {
  let out = nl(text);
  let count = 0;
  // related: [a, b]
  out = out.replace(/^(---\n[\s\S]*?\n---)/, (fm) => fm.replace(/^(related\s*:\s*\[)(.*)(\]\s*)$/m, (all, a, list, b) => {
    const items = list.split(',').map((s) => s.trim()).filter(Boolean);
    let changed = false;
    const next = items.map((it) => {
      const q = it.match(/^["']/) ? it[0] : '';
      const v = q ? it.slice(1, -1) : it;
      const r = rewriteRef(v, 'code', ctx, fromRel, self);
      if (r == null) return it;
      changed = true; count++;
      return q + r + q;
    });
    return changed ? a + next.join(', ') + b : all;
  }));
  // 본문의 백틱과 링크. 뒤에서부터 바꿔 자리가 밀리지 않게 한다
  const toks = linkTokens(out);
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    let r = rewriteRef(t.raw, t.kind, ctx, fromRel, self);
    if (r == null && folders && t.kind === 'code') r = rewriteFolder(t.raw, ctx, self);
    if (r == null) continue;
    out = out.slice(0, t.start) + r + out.slice(t.end);
    count++;
  }
  return { text: out, count };
}

// 통째로 옮긴 폴더 이름(`06-discussions/`)을 새 자리로. 규칙 블록 밖과 속성 가이드의 사용자 줄에만 쓴다
function rewriteFolder(raw, ctx, self) {
  const m = String(raw).match(/^([^/:\s]+)\/?$/);
  if (!m || !ctx.folders.has(m[1])) return null;
  return formatRef(ctx.folders.get(m[1]), 'code', self, ctx.name) + '/';
}

// 옛 폴더마다 안의 파일이 모두 같은 새 폴더로 갔으면 { 옛 폴더 → 새 폴더 }
function folderMapOf(placements) {
  const by = new Map();
  for (const p of placements) {
    const [top, ...rest] = p.from.split('/');
    if (!rest.length) continue;
    const sub = rest.join('/');
    const dest = p.to.endsWith('/' + sub) ? p.to.slice(0, -(sub.length + 1)) : null;
    if (!by.has(top)) by.set(top, new Set());
    by.get(top).add(dest);
  }
  const out = new Map();
  for (const [top, set] of by) {
    const v = [...set][0];
    if (set.size === 1 && v && !v.endsWith(':')) out.set(top, v);
  }
  return out;
}

// ---------- 표 합치기 ----------
// 표 줄(머리와 구분 줄 다음)을 제목별로 모은다
function tablesOf(text) {
  const lines = nl(text).split('\n');
  const out = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) { heading = lines[i].trim(); continue; }
    if (lines[i].trim().startsWith('|') && lines[i + 1] && /^\s*\|\s*:?-{3,}/.test(lines[i + 1])) {
      const t = { heading, header: lines[i].trim(), rows: [] };
      let j = i + 2;
      for (; j < lines.length && lines[j].trim().startsWith('|'); j++) t.rows.push(lines[j]);
      out.push(t);
      i = j - 1;
    }
  }
  return out;
}

// baseText의 같은 제목 아래 표 끝에 addText의 표 줄 가운데 없는 것을 더한다. 같은 줄은 건너뛴다. 제목이 없으면 끝에 절째 더한다
export function mergeTables(baseText, addText) {
  const lines = nl(baseText).split('\n');
  const have = new Set(lines.map((l) => l.trim()));
  let added = 0;
  const tail = [];
  for (const t of tablesOf(addText)) {
    const rows = t.rows.filter((r) => !have.has(r.trim()));
    if (!rows.length) continue;
    // base에서 같은 제목의 같은 머리 표(없으면 그 제목의 첫 표)를 찾는다
    let heading = '', at = -1, fallback = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^#{1,6}\s/.test(lines[i])) { heading = lines[i].trim(); continue; }
      if (heading !== t.heading || !lines[i].trim().startsWith('|') || !(lines[i + 1] && /^\s*\|\s*:?-{3,}/.test(lines[i + 1]))) continue;
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) j++;
      if (lines[i].trim() === t.header) { at = j; break; }
      if (fallback < 0) fallback = j;
    }
    const pos = at >= 0 ? at : fallback;
    if (pos >= 0) { lines.splice(pos, 0, ...rows); added += rows.length; rows.forEach((r) => have.add(r.trim())); continue; }
    const sep = '| ' + t.header.split('|').slice(1, -1).map(() => '---').join(' | ') + ' |';
    tail.push('', t.heading || '## 옮겨 온 표', '', t.header, sep, ...rows);
    added += rows.length;
  }
  let out = lines.join('\n');
  if (tail.length) out = out.replace(/\n*$/, '\n') + tail.join('\n') + '\n';
  return { text: out, added };
}

// ---------- 살피기 ----------
function homeChoice(answers, u) {
  if (u.home) return { home: u.home, asked: false };
  const a = answers.decisions?.['home-location'];
  const def = slash(path.join(userDir(), 'siloroot-home'));
  if (typeof a !== 'string' || !a.trim()) return { home: def, asked: true, answered: false };
  const raw = a.trim();
  const abs = raw.startsWith('~/') ? path.join(userDir(), raw.slice(2)) : raw;
  return { home: slash(abs), asked: true, answered: true };
}

function checkHome(home, root) {
  if (/\s/.test(importPath(path.join(home, 'profile.md')))) return { error: 'home-path-space', detail: home };
  const hit = [root, ...readUser().projects.map((p) => p.path)].find((r) => overlaps(home, r));
  if (hit) return { error: 'home-in-project', detail: { home, project: slash(hit) } };
  const hc = loadConfig(home);
  if (hc && hc.mode !== 'home') return { error: 'not-home', detail: home };
  return null;
}

function survey({ root, cfg }, answers = {}) {
  root = path.resolve(root);
  const docs = path.join(root, '.siloroot');
  const stateDir = cfg.stateDir || path.join(docs, 'state');
  const u = readUser();
  if (u.invalid) return { error: 'user-json-invalid', detail: userFile().split(path.sep).join('/') };

  // 지우는 중에 멈췄으면 남은 지우기부터 이어 간다
  let mark = null;
  try { mark = JSON.parse(fs.readFileSync(path.join(stateDir, MARK), 'utf8')); } catch { /* 없음 */ }
  if (mark && mark.deletes.some((f) => !fs.existsSync(path.join(docs, f)))) {
    return { resume: mark, placements: mark.placements, decisions: [], notes: ['지난번 업데이트가 옛 파일을 지우다 멈췄습니다. 남은 옛 파일을 지우고 이어 갑니다.'], edits: [], touches: { files: mark.deletes.map((f) => '.siloroot/' + f).concat(['.siloroot/config.json']), creates: [] } };
  }

  const hc = homeChoice(answers, u);
  const home = hc.home;
  if (hc.answered) { const bad = checkHome(home, root); if (bad) return bad; }
  const homeExists = !!loadConfig(home);
  const name = projectNameFor(root);
  const d = cfg.dirs;
  const files = walk(docs);
  const textOf = new Map(files.filter(isMd).map((f) => [f, nl(fs.readFileSync(path.join(docs, f), 'utf8'))]));
  const over = answers.placements || {};
  const bad = Object.entries(over).filter(([from, to]) => !files.includes(from) || !validTo(to));
  if (bad.length) return { error: 'bad-placement', detail: bad.map(([from, to]) => ({ from, to })) };

  // 1) 규칙 → 2) 아이디어 답 → 3) 따라가는 문서(결정, 그림)
  const place = new Map();
  for (const f of files) { const r = ruleOf(f, textOf.get(f) ?? null, d); place.set(f, { from: f, ...r, review: !!r.review }); }
  const setOver = (p) => { if (over[p.from]) { p.to = over[p.from]; p.why = '답으로 고름'; p.review = false; } };
  for (const p of place.values()) if (p.kind !== 'follower' && p.kind !== 'asset') setOver(p);
  for (const p of place.values()) {
    if (p.kind !== 'follower') continue;
    const sub = p.from.slice(d.ideas.length + 1);
    const parent = place.get(d.ideas + '/' + sub.split('-decision-')[0] + '.md');
    if (parent && parent.kind === 'idea') {
      p.why = `아이디어 ${base(parent.from)}를 따라감`;
      p.to = decisionPlace(isHomeTo(parent.to) ? 'home' : 'shared', sub, typeOf(textOf.get(p.from) || ''));
    }
    setOver(p);
  }
  for (const p of place.values()) {
    if (p.kind !== 'asset') continue;
    const name0 = base(p.from);
    // 그 파일 이름을 적은 문서. 아이디어 문서를 먼저 본다
    const rank = (q) => (q.kind === 'idea' ? 0 : 1);
    const leader = [...place.values()].filter((q) => isMd(q.from) && q.from.startsWith(d.ideas + '/') && (textOf.get(q.from) || '').includes(name0))
      .sort((a, b) => rank(a) - rank(b) || a.from.localeCompare(b.from))[0];
    if (leader) { p.to = (dirOf(leader.to) ? dirOf(leader.to) + '/' : (isHomeTo(leader.to) ? 'home:' : '')) + name0; p.why = `${base(leader.from)}를 따라감`; }
    setOver(p);
  }

  // 홈에 같은 이름 파일이 있으면 묻는다(합치는 파일, 홈 것을 두는 파일은 빼고)
  const decisions = [];
  const notes = [];
  const collide = [];
  const homeAbs = (to) => path.join(home, ...homeRel(to).split('/'));
  for (const p of place.values()) {
    if (!isHomeTo(p.to) || MERGE_TPL[homeRel(p.to)] || KEEP_HOME[homeRel(p.to)] || !homeExists) continue;
    if (fs.existsSync(homeAbs(p.to))) collide.push(p);
  }
  // 경로 고치기에 쓸 표. 이름을 바꿔 두기로 한 문서는 바뀐 이름으로 적는다
  const rename = (p) => {
    const rel = homeRel(p.to), b = base(rel), ext = b.match(/\.[^.]+$/)?.[0] || '';
    return 'home:' + (dirOf(rel) ? dirOf(rel) + '/' : '') + b.slice(0, b.length - ext.length) + '-' + name + ext;
  };
  for (const p of collide) {
    const a = answers.decisions?.['home-collision:' + homeRel(p.to)];
    p.collision = homeRel(p.to);
    if (a === 'rename') p.to = rename(p);
    else if (a === 'keep-in-project') p.to = 'private/notes/' + base(p.from);
  }
  const placements = [...place.values()];
  const map = new Map(placements.filter((p) => isMd(p.from)).map((p) => [p.from, p.to]));
  const index = makeIndex([...textOf.keys(), 'CLAUDE.md', 'metadata-guide.md'].filter((f) => fs.existsSync(path.join(docs, f))));
  const folders = folderMapOf(placements);
  const assets = new Map(placements.filter((p) => !isMd(p.from)).map((p) => [p.from, p.to]));
  const ctx = { index, map, assets, name, folders };

  // 옮길 내용(경로를 고치고 type을 바꾼 것)
  let refs = 0;
  for (const p of placements) {
    if (!isMd(p.from)) continue;
    const self = isHomeTo(p.to) ? { ws: 'home', rel: homeRel(p.to) } : { ws: 'project', rel: p.to };
    // 폴더 이름은 안내 문서(index, guide)에서만 고친다. 기록과 설계 문서의 옛 폴더 이름은 그때의 이야기라 그대로 둔다
    const guideLike = ['index', 'guide'].includes(typeOf(textOf.get(p.from)));
    const r = rewriteText(textOf.get(p.from), p.from, self, ctx, { folders: guideLike });
    refs += r.count;
    let text = r.text;
    if (/^shared\/design\//.test(p.to)) text = text.replace(/^(---\n[\s\S]*?^type\s*:\s*)decision(\s*)$/m, '$1design$2');
    if (/^shared\/roadmap\//.test(p.to)) text = text.replace(/^(---\n[\s\S]*?^type\s*:\s*)decision(\s*)$/m, '$1roadmap$2');
    p.text = text;
  }
  // 이름이 겹친 홈 문서: 우리 것과 같으면(다시 돌릴 때) 묻지 않는다
  for (const p of collide) {
    const cur = nl(fs.readFileSync(path.join(home, ...p.collision.split('/')), 'utf8'));
    if (p.text != null && cur === p.text && isHomeTo(p.to) && homeRel(p.to) === p.collision) { delete p.collision; continue; }
    decisions.push({
      id: 'home-collision:' + p.collision,
      question: `홈에 ${p.collision}가 이미 있습니다. ${p.from}를 어떻게 할까요?`,
      why: `rename: 홈에 ${homeRel(rename({ to: 'home:' + p.collision }))}로 따로 둡니다. keep-in-project: 홈으로 옮기지 않고 이 프로젝트의 private/notes/에 둡니다. 홈 것은 어느 쪽이든 그대로입니다.`,
      options: ['rename', 'keep-in-project'], default: 'rename',
    });
  }

  // 같은 갈 곳에 둘이 가거나, 프로젝트 안 갈 곳에 다른 내용이 이미 있으면 멈춘다
  const seen = new Map();
  const clash = [];
  for (const p of placements) {
    if (seen.has(p.to)) clash.push({ to: p.to, from: [seen.get(p.to), p.from] });
    seen.set(p.to, p.from);
    if (isHomeTo(p.to)) continue;
    const dest = path.join(docs, ...p.to.split('/'));
    if (!fs.existsSync(dest)) continue;
    const same = isMd(p.from) ? nl(fs.readFileSync(dest, 'utf8')) === p.text : fs.readFileSync(dest).equals(fs.readFileSync(path.join(docs, p.from)));
    if (!same) clash.push({ to: p.to, from: [p.from], exists: true });
  }
  if (clash.length) return { error: 'placement-conflict', detail: clash };

  // 홈 쪽 파일의 최종 내용(합치기)
  const homeFiles = [];
  for (const p of placements) {
    if (!isHomeTo(p.to)) continue;
    const rel = homeRel(p.to), abs = homeAbs(p.to);
    const cur = fs.existsSync(abs) ? (isMd(rel) ? nl(fs.readFileSync(abs, 'utf8')) : null) : null;
    let how = 'copy', text = p.text;
    // 안내 문서(feedback/README.md)는 홈 것(새로 만드는 홈이면 모양 3 템플릿)을 둔다. 옛 것은 옛 폴더 이름을 적고 있다
    if (KEEP_HOME[rel]) { how = 'keep-home'; text = null; }
    // 사용자 정보, 글쓰기 규칙, 공부 목록: 홈 것(없으면 모양 3 템플릿)에 표 줄만 합친다. 글은 새 템플릿을 따른다
    else if (MERGE_TPL[rel]) {
      const m = mergeTables(cur ?? readTpl(MERGE_TPL[rel]), p.text);
      how = cur == null ? 'merge-template' : m.added ? 'merge' : 'same';
      text = m.text;
    }
    p.homeHow = how;
    homeFiles.push({ rel, abs, how, text, from: p.from });
  }

  // CLAUDE.md의 관리 블록 밖
  let claude = null;
  const claudeFile = path.join(docs, 'CLAUDE.md');
  if (fs.existsSync(claudeFile)) {
    const raw = nl(fs.readFileSync(claudeFile, 'utf8'));
    const a = raw.indexOf(START), b = raw.indexOf(END);
    const self = { ws: 'project', rel: 'CLAUDE.md' };
    const fix = (s) => rewriteText(s, 'CLAUDE.md', self, ctx, { folders: true });
    if (a >= 0 && b > a) {
      const before = fix(raw.slice(0, a)), after = fix(raw.slice(b + END.length));
      const next = before.text + raw.slice(a, b + END.length) + after.text;
      if (next !== raw) claude = next;
    } else if (a < 0 && b < 0) {
      const r = fix(raw);
      if (r.text !== raw) claude = r.text;
    }
  }

  // 속성 가이드: 새 템플릿 + 옛 가이드에서 사용자가 더한 표 줄
  const guide = guideOf(docs, ctx);

  // 공유 문서가 개인 문서나 홈을 가리키는 곳
  let crossing = 0;
  const crossEx = [];
  for (const p of placements) {
    if (!isMd(p.from) || !p.to.startsWith('shared/') || p.text == null) continue;
    const hits = new Set();
    const related = (fmOf(p.text).match(/^related\s*:\s*\[(.*)\]\s*$/m) || [null, ''])[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    const refsOf = related.map((v) => ({ raw: v, kind: 'code' })).concat(linkTokens(p.text));
    for (const { raw, kind } of refsOf) {
      if (raw.startsWith('home:') || raw.startsWith('private/')) hits.add(raw);
      else if (kind === 'link' && !raw.includes(':') && path.posix.normalize(path.posix.join(dirOf(p.to), raw)).startsWith('private/')) hits.add(raw);
    }
    if (hits.size) { crossing += hits.size; if (crossEx.length < 3) crossEx.push(`${p.to} → ${[...hits][0]}`); }
  }

  // git
  const exclude = gitExcludeFile(root);
  const tracked = exclude ? gitTracked(root, placements.map((p) => '.siloroot/' + p.from)) : [];
  const trackedSet = new Set(tracked);
  const privTracked = placements.filter((p) => trackedSet.has('.siloroot/' + p.from) && !p.to.startsWith('shared/'));
  if (privTracked.length) decisions.push({
    id: 'git-private',
    question: `개인 영역이나 홈으로 갈 문서 ${privTracked.length}개가 바깥 git에 커밋돼 있습니다. git 추적을 끊을까요?`,
    why: 'untrack: git rm --cached로 추적만 끊습니다. 파일은 남고, 다음 커밋에서 지워진 것으로 보입니다. keep: 프로젝트 안 개인 영역 문서는 새 자리로 계속 추적합니다. 홈으로 가는 문서는 저장소 밖이라 어느 쪽이든 추적이 끊깁니다.',
    options: ['untrack', 'keep'], default: 'untrack',
  });

  // 홈 쓰기 허락
  if (!hasAdditionalDirectory(root, home)) decisions.push({
    id: 'home-access',
    question: `이 프로젝트의 .claude/settings.local.json에 홈 폴더(${home})를 더할까요?`,
    why: '홈은 프로젝트 밖이라, 더하지 않으면 공부 노트나 후보를 홈에 쓸 때마다 Claude Code가 허락을 묻습니다. 이 파일은 git에 올라가지 않는 개인 설정이고, 다른 설정은 건드리지 않습니다.',
    options: ['add', 'skip'], default: 'add',
  });
  if (hc.asked) decisions.unshift({
    id: 'home-location', free: true,
    question: '홈 폴더를 어디에 둘까요? 공부 노트, 개인 아이디어, 사용자 정보, 글쓰기 규칙이 여기로 갑니다. 모든 프로젝트가 같은 홈을 씁니다.',
    why: '프로젝트 밖의 폴더여야 합니다. 경로에 공백이 있으면 안 됩니다(사용자 폴더 아래면 사용자 이름의 공백은 괜찮습니다).',
    options: [], default: home,
  });

  // 알릴 것
  const reviewN = placements.filter((p) => p.review).length;
  if (reviewN) notes.push(`아이디어 ${reviewN}개는 규칙으로 가를 수 없어 기본값 shared/ideas/로 둡니다. 개인 아이디어는 갈 곳을 home:ideas/<이름>.md로 바꾸세요. 옆의 결정 문서와 그림도 따라갑니다.`);
  notes.push('002는 커밋하지 않습니다. shared/에 놓인 문서를 팀 저장소에 올릴지는 커밋할 때 고르세요.');
  notes.push(homeExists ? `홈(${home})이 이미 있어 그 안에 더합니다. profile.md, writing-guide.md, study/README.md는 표 줄을 합칩니다.` : `홈(${home})을 새로 만들고 user.json에 적습니다.`);
  const kept = homeFiles.filter((h) => h.how === 'keep-home').map((h) => h.from);
  if (kept.length) notes.push(`${kept.join(', ')}는 홈에 같은 안내 문서가 있어 홈 것을 두고 옮기지 않습니다.`);
  const merged = homeFiles.filter((h) => h.how === 'merge').map((h) => h.rel);
  if (merged.length) notes.push(`홈의 ${merged.join(', ')}에 표 줄을 합칩니다.`);
  const fromTpl = homeFiles.filter((h) => h.how === 'merge-template').map((h) => h.rel);
  if (fromTpl.length) notes.push(`홈의 ${fromTpl.join(', ')}는 모양 3 템플릿에 옛 문서의 표 줄을 옮겨 만듭니다. 표 밖에 직접 쓴 글은 옮기지 않으니 옛 문서와 견주어 보세요(백업에 있습니다).`);
  if (refs) notes.push(`문서 안의 경로 ${refs}곳을 새 자리로 고칩니다(related, 백틱, 링크).`);
  if (crossing) notes.push(`옮긴 뒤 공유 문서가 팀원이 볼 수 없는 개인 문서나 홈을 가리키는 곳이 ${crossing}곳 있습니다(예: ${crossEx.join('; ')}). 고치지는 않습니다. 뷰어 속성 점검에서 경고로 보입니다.`);
  // 나뉘어 옮겨 한 자리로 고칠 수 없는 옛 폴더 이름(`03-ideas/` 등)이 남은 곳. 고치지 않고 알린다
  const split = [d.ideas, d.feedback, d.profile].filter((f) => !folders.has(f));
  const stale = [];
  for (const p of placements) {
    if (p.text == null || p.homeHow === 'keep-home' || !['index', 'guide'].includes(typeOf(p.text))) continue;
    const n = linkTokens(p.text).filter((t) => t.kind === 'code' && split.some((f) => t.raw === f || t.raw === f + '/')).length;
    if (n) stale.push({ file: p.to, n });
  }
  if (stale.length) notes.push(`안내 문서(index, guide) ${stale.length}개에 여러 자리로 나뉜 옛 폴더 이름(${split.map((f) => '`' + f + '/`').join(', ')})이 ${stale.reduce((a, x) => a + x.n, 0)}곳 남습니다(${stale.slice(0, 5).map((x) => x.file).join(', ')}). 한 자리로 고칠 수 없어 그대로 둡니다. 옮긴 뒤 새 자리 이름으로 고칠지 묻습니다. 기록과 설계 문서의 옛 폴더 이름은 그때의 이야기라 고치지 않습니다.`);
  if (guide.added.length) notes.push(`metadata-guide.md를 새 템플릿으로 바꾸고, 사용자가 더한 줄 ${guide.added.length}개를 옮겨 둡니다.`);
  const gi = path.join(docs, '.gitignore');
  const giTemplate = fs.existsSync(gi) && noDates(fs.readFileSync(gi, 'utf8')) === noDates(fs.readFileSync(TPL_GITIGNORE_WRAPPED, 'utf8'));
  if (fs.existsSync(gi)) notes.push(giTemplate ? '.siloroot/.gitignore는 예전 init이 만든 것이라 지웁니다. 모양 3에서는 git 제외 목록 한 곳에서 뺍니다.' : '.siloroot/.gitignore는 직접 고친 것이라 그대로 둡니다.');
  if (exclude && fs.existsSync(exclude) && fs.readFileSync(exclude, 'utf8').split(/\r?\n/).some((l) => l.trim() === '.siloroot/')) notes.push('git 제외 목록의 예전 줄 `.siloroot/`를 지우고 `.siloroot/*`, `!.siloroot/shared/`로 바꿉니다. 그러면 shared/ 아래만 git에 보입니다.');
  if (!exclude) notes.push('git 저장소가 아니어서 git 제외 목록은 쓰지 않습니다.');
  if (cfg.tracked) notes.push('예전에 문서를 git에 계속 올리기로 했던 작업 공간입니다. 모양 3에서는 shared/만 git에 보입니다.');
  notes.push('옮긴 뒤 홈으로 간 공부 노트 가운데 프로젝트 사건이 섞인 것은 사건 부분을 shared/issues/로 나눌지 노트마다 따로 묻습니다(업데이트 백업 밖).');

  // 백업할 것
  const rootRel = (abs) => { const r = path.relative(root, abs); return r && !r.startsWith('..') && !path.isAbsolute(r) ? r.split(path.sep).join('/') : slash(abs); };
  const filesT = placements.map((p) => '.siloroot/' + p.from).concat(['.siloroot/CLAUDE.md', '.siloroot/metadata-guide.md', '.siloroot/.gitignore', '.siloroot/config.json']);
  const createsT = ['.siloroot/shared', '.siloroot/private'];
  if (exclude) filesT.push(rootRel(exclude));
  const uf = slash(userFile());
  (fs.existsSync(uf) ? filesT : createsT).push(uf);
  const sf = settingsFile(root);
  (fs.existsSync(sf) ? filesT : createsT).push(rootRel(sf));
  if (homeExists) {
    for (const h of homeFiles) (fs.existsSync(h.abs) ? filesT : createsT).push(slash(h.abs));
    const hr = planRefresh(home, loadConfig(home));
    for (const b of hr.blocks) if (b.state === 'created' || b.state === 'updated') filesT.push(slash(path.join(home, b.file)));
    for (const f of hr.missingFiles) createsT.push(slash(path.join(home, f.replace(/\/$/, ''))));
  } else {
    // 새 홈: 만들 것만 적는다(홈의 state/는 담지 않는다)
    const hr = planRefresh(home, { schema: 3, mode: 'home', layout: 'flat' });
    createsT.push(slash(path.join(home, '.siloroot', 'config.json')), slash(path.join(home, 'CLAUDE.md')));
    for (const f of hr.missingFiles) createsT.push(slash(path.join(home, f.replace(/\/$/, ''))));
    for (const h of homeFiles) createsT.push(slash(h.abs));
  }

  const edits = [
    { file: '.siloroot/CLAUDE.md', what: claude ? '관리 블록 밖의 경로를 새 자리로 고침. 관리 블록은 모양 3 블록으로' : '관리 블록을 모양 3 블록으로' },
    { file: '.siloroot/metadata-guide.md', what: '모양 3 템플릿으로 바꾸고 사용자가 더한 줄을 옮김' },
    { file: '.siloroot/config.json', what: 'schema를 3으로, mode를 project로' },
    { file: uf, what: (homeExists ? '' : '홈을 적고 ') + `이 프로젝트를 "${name}"으로 등록` },
  ];
  // 옮긴 뒤 Claude가 할 일(/siloroot:migrate 스킬이 이 마이그레이션을 적용한 뒤에만 읽는다)
  const after = [];
  if (stale.length) after.push('안내 문서(index, guide)에 남은 옛 폴더 이름을 관리 블록 자리 표의 새 자리로 고칠지 묻고, 승인한 것만 고친다. 기록(log)과 설계, 결정 문서의 옛 폴더 이름은 그때의 이야기라 고치지 않는다.');
  after.push('홈으로 간 공부 노트 가운데 이 프로젝트에서 생긴 사건(겪은 문제, 고친 과정)이 섞인 것이 있으면, 노트마다 사건 부분을 shared/issues/로 나눌지 제안하고 승인한 것만 나눈다. 개념은 홈 노트에 남기고, 이슈 문서는 홈을 가리키지 않으며, 홈 노트의 related에 <프로젝트 이름>:shared/issues/…를 더한다. 글을 쓰는 일이라 업데이트 백업 밖이라고 알린다.');
  return {
    home, homeExists, name, placements, homeFiles, claude, guide, tracked, trackedSet, exclude, giTemplate, decisions, notes, edits, after,
    touches: { files: [...new Set(filesT)], creates: [...new Set(createsT)] },
  };
}

// 새 속성 가이드. 옛 가이드의 표 줄 가운데 옛 템플릿에 없던 것(사용자가 더한 줄)을 경로를 고쳐 같은 제목의 표에 옮긴다.
// 이미 모양 3 가이드면(다시 돌릴 때) null
function guideOf(docs, ctx) {
  const file = path.join(docs, 'metadata-guide.md');
  const fresh = readTpl('v3/project/metadata-guide.md');
  if (!fs.existsSync(file)) return { text: fresh, added: [] };
  const old = nl(fs.readFileSync(file, 'utf8'));
  if (old.includes('`shared/issues/`')) return { text: null, added: [] };
  const tplRows = new Set(tablesOf(readTpl('metadata-guide.md')).flatMap((t) => t.rows.map((r) => noDates(r))));
  const self = { ws: 'project', rel: 'metadata-guide.md' };
  const extra = [];
  for (const t of tablesOf(old)) {
    for (const r of t.rows) {
      if (tplRows.has(noDates(r))) continue;
      const fixed = rewriteText(r, 'metadata-guide.md', self, ctx, { folders: true }).text;
      const first = (fixed.match(/`([^`]+)`/) || [])[1];
      if (first && fresh.includes('`' + first + '`')) continue; // 새 가이드에 이미 있는 자리
      extra.push({ heading: t.heading, header: t.header, row: fixed });
    }
  }
  if (!extra.length) return { text: fresh, added: [] };
  const add = extra.map((e) => `${e.heading}\n\n${e.header}\n| ${e.header.split('|').slice(1, -1).map(() => '---').join(' | ')} |\n${e.row}`).join('\n\n');
  return { text: mergeTables(fresh, add).text, added: extra.map((e) => e.row) };
}

// ---------- 적용 ----------
function pickHomePort(projectPort) {
  const used = usedPorts();
  used.add(projectPort);
  for (let p = 4181; p <= 4299; p++) if (!used.has(p)) return p;
  throw new Error('4181~4299 사이에 빈 포트가 없습니다');
}

function writeFile(abs, data) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

// 옛 파일을 지우고 git을 정리한 뒤 나머지(제외 줄, 홈 허락, 스냅숏, 설정)를 마친다
function finish(root, docs, stateDir, mark, notes) {
  for (const f of mark.deletes) {
    const abs = path.join(docs, ...f.split('/'));
    if (mark.untrack.includes(f)) { try { git(root, ['rm', '--cached', '-q', '--ignore-unmatch', '--', '.siloroot/' + f]); } catch { /* git이 없으면 건너뛴다 */ } }
    fs.rmSync(abs, { force: true });
  }
  for (const to of mark.gitAdd) { try { git(root, ['add', '-f', '--', '.siloroot/' + to]); } catch { /* 건너뛴다 */ } }
  // 빈 옛 폴더를 지운다
  const prune = (dir) => {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    for (const e of fs.readdirSync(dir)) prune(path.join(dir, e));
    if (dir !== docs && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  };
  for (const top of new Set(mark.deletes.filter((f) => f.includes('/')).map((f) => f.split('/')[0]))) prune(path.join(docs, top));

  // git 제외 목록: 예전 줄 '.siloroot/'를 지우고 모양 3 줄은 맞추기가 더한다
  const exclude = gitExcludeFile(root);
  if (exclude && fs.existsSync(exclude)) {
    const raw = fs.readFileSync(exclude, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const next = raw.split(/\r?\n/).filter((l) => l.trim() !== '.siloroot/').join(eol);
    if (next !== raw) fs.writeFileSync(exclude, next);
  }
  if (mark.removeGitignore) fs.rmSync(path.join(docs, '.gitignore'), { force: true });
  if (mark.homeAccess === 'add') {
    const st = addAdditionalDirectory(root, mark.home);
    if (st === 'invalid') notes.push('.claude/settings.local.json이 JSON이 아니어서 홈 폴더를 더하지 못했습니다. 직접 고친 뒤 /siloroot:init을 다시 실행하세요.');
    else if (exclude) ensureLines(exclude, EXCLUDE_HEAD, ['.claude/settings.local.json']);
  }
  // 경로가 다 바뀌어 뷰어의 "바뀐 것" 비교 기준을 새로 잡는다(다음 빌드가 지금 상태로 잡는다)
  fs.rmSync(path.join(stateDir, 'snapshot-private.json'), { force: true });
  updateConfig(root, { layout: 'wrapped', schema: 3, mode: 'project', tracked: null });
  fs.rmSync(path.join(stateDir, MARK), { force: true });
}

export default {
  id: ID,
  from: 2,
  to: 3,
  title: '프로젝트를 shared/와 private/로 나누고 공부와 사용자 정보를 홈으로 옮긴다',

  plan(ctx, answers = {}) {
    const s = survey(ctx, answers);
    if (s.error) return { error: s.error, detail: s.detail, moves: [], edits: [], decisions: [], notes: [], placements: [], touches: { files: [], creates: [] } };
    const placements = s.placements.map((p) => ({ from: p.from, to: p.to, why: p.why, review: !!p.review, ...(p.homeHow && p.homeHow !== 'copy' ? { how: p.homeHow } : {}) }));
    return {
      moves: placements.map((p) => ({ from: '.siloroot/' + p.from, to: isHomeTo(p.to) ? p.to : '.siloroot/' + p.to })),
      placements, edits: s.edits, decisions: s.decisions, notes: s.notes, after: s.after || [], touches: s.touches,
      home: s.home ?? null, homeExists: s.homeExists ?? null, name: s.name ?? null,
    };
  },

  apply(ctx, decisions = {}, answers = {}) {
    const root = path.resolve(ctx.root);
    const docs = path.join(root, '.siloroot');
    const stateDir = ctx.cfg.stateDir || path.join(docs, 'state');
    const all = { ...answers, decisions };
    const s = survey({ ...ctx, root }, all);
    if (s.error) throw Object.assign(new Error(s.error + ': ' + JSON.stringify(s.detail)), { code: s.error });
    const missing = s.decisions.filter((d) => !(d.free ? typeof decisions[d.id] === 'string' && decisions[d.id].trim() : d.options.includes(decisions[d.id]))).map((d) => d.id);
    if (missing.length) throw Object.assign(new Error('missing-decisions: ' + missing.join(', ')), { code: 'missing-decisions', ids: missing });
    const notes = [...s.notes];
    if (s.resume) {
      finish(root, docs, stateDir, { ...s.resume, homeAccess: decisions['home-access'] ?? s.resume.homeAccess }, notes);
      return { moved: s.resume.deletes, edited: ['.siloroot/config.json'], created: [], notes };
    }

    // 1. 홈
    const home = s.home;
    let created = [];
    if (!s.homeExists) {
      fs.mkdirSync(home, { recursive: true });
      writeConfig(home, { port: pickHomePort(ctx.cfg.port), schema: 3, mode: 'home', plugin: pluginVersion() });
      created = applyRefresh(home, loadConfig(home)).created.map((f) => 'home:' + f);
    }
    if (!readUser().home) setHome(home);
    registerProject(root);

    // 2. 홈으로 갈 것
    for (const h of s.homeFiles) {
      if (h.how === 'keep-home' || h.how === 'same') continue;
      if (h.text != null) { writeFile(h.abs, h.text); continue; }
      fs.mkdirSync(path.dirname(h.abs), { recursive: true });
      fs.copyFileSync(path.join(docs, ...h.from.split('/')), h.abs);
    }
    // 3~5. 프로젝트 안 새 자리(경로와 type을 고친 내용)
    for (const p of s.placements) {
      if (isHomeTo(p.to)) continue;
      const dest = path.join(docs, ...p.to.split('/'));
      if (p.text != null) writeFile(dest, p.text);
      else { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(docs, ...p.from.split('/')), dest); }
    }
    if (s.claude) fs.writeFileSync(path.join(docs, 'CLAUDE.md'), s.claude);
    // 7. 속성 가이드
    if (s.guide.text != null) fs.writeFileSync(path.join(docs, 'metadata-guide.md'), s.guide.text);
    // 홈이 이미 있었으면 홈 관리 블록과 빠진 파일을 맞춘다
    if (s.homeExists) applyRefresh(home, loadConfig(home));

    // 6. 옛 파일 지우기. 멈춰도 이어 가게 표시를 먼저 남긴다
    const untrackAll = decisions['git-private'] !== 'keep';
    const mark = {
      home, placements: s.placements.map((p) => ({ from: p.from, to: p.to, why: p.why })),
      deletes: s.placements.map((p) => p.from),
      untrack: s.placements.filter((p) => s.trackedSet.has('.siloroot/' + p.from)).map((p) => p.from),
      gitAdd: s.placements.filter((p) => s.trackedSet.has('.siloroot/' + p.from) && !isHomeTo(p.to) && (p.to.startsWith('shared/') || !untrackAll)).map((p) => p.to),
      removeGitignore: s.giTemplate, homeAccess: decisions['home-access'] ?? null,
    };
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(path.join(stateDir, MARK), JSON.stringify(mark, null, 2) + '\n');
    finish(root, docs, stateDir, mark, notes);
    if (mark.untrack.length) notes.push(`git이 추적하던 문서 ${mark.untrack.length}개를 옛 자리에서 추적 해제했습니다${mark.gitAdd.length ? `(새 자리 ${mark.gitAdd.length}개는 다시 추적)` : ''}. 커밋은 하지 않았습니다.`);

    return {
      moved: s.placements.map((p) => p.from),
      edited: ['.siloroot/CLAUDE.md', '.siloroot/metadata-guide.md', '.siloroot/config.json'],
      created: created.concat(s.placements.map((p) => (isHomeTo(p.to) ? p.to : '.siloroot/' + p.to))),
      notes,
    };
  },
};
