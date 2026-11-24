// 003: 모양 3 → 모양 4 (문서 자리 다시 짜기)
// 설계: 저장소 작업 공간의 shared/design/doc-slots.md 8절
// 프로젝트
// - shared/roadmap/의 문서는 기능마다의 구현 계획이라 shared/plans/로 옮기고 type을 plan으로 바꾼다. 로드맵 한 장(shared/roadmap.md)은 맞추기가 만든다.
// - private/log/changelog.md를 날짜 제목(## YYYY-MM-DD)마다 private/worklog/YYYY-MM-DD.md로 나누고, open-questions.md는 private/로 옮긴다.
// - 아이디어 폴더에 있는 결정, 설계, 계획 문서를 제자리(decisions/, design/, plans/)로 옮긴다. 이 목록(placements)은 사용자가 한 번 승인한다.
// - 이슈 status: 원인 찾음 → 열림, 안 함 → 안 고침
// 홈
// - log/changelog.md를 worklog/로 나누고 log/open-questions.md를 open-questions.md로 옮긴다.
// 공통
// - 옮긴 문서를 가리키던 경로(related, 백틱, 링크)를 고친다. 프로젝트를 옮기면 홈 문서의 <프로젝트 이름>: 경로도, 홈을 옮기면 등록된 프로젝트의 home: 경로도 고친다.
// - 속성 가이드(metadata-guide.md)는 모양 4 템플릿으로 바꾸고, 사용자가 더한 표 줄은 옮겨 둔다.
// - 순서: 새 파일을 모두 쓰고, 경로를 고치고, 옛 파일을 지운다. 설정의 schema는 업데이트(scripts/update.mjs)가 적는다.
// 경로는 그 작업 공간의 문서 뿌리 기준이고 '/'로 잇는다.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.mjs';
import { readUser, projectNameFor } from '../user.mjs';
import { START, END, readTpl, today } from '../workspace-sync.mjs';
import { makeIndex, resolveTarget, linkTokens } from '../links.mjs';
import { mergeTables } from './002-project-areas.mjs';

const ID = '003-doc-slots';
const nl = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
const isMd = (f) => /\.(md|markdown)$/i.test(f);
const fmOf = (text) => { const m = nl(text).match(/^---\n([\s\S]*?)\n---/); return m ? m[1] : ''; };
const typeOf = (text) => { const t = fmOf(text).match(/^type\s*:\s*(.+)$/m); return t ? t[1].trim().replace(/^["']|["']$/g, '') : null; };
const setFm = (text, key, value) => {
  const re = new RegExp('^(---\\n[\\s\\S]*?^' + key + '\\s*:\\s*)(.+?)(\\s*)$', 'm');
  return re.test(text) ? text.replace(re, (all, a, v, b) => a + value + b) : text;
};
const noDates = (s) => nl(s).replace(/\d{4}-\d{2}-\d{2}/g, 'DATE').replace(/\{\{date\}\}/g, 'DATE').trim();
const dirOf = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '');

function walk(docsRoot, skipTop = new Set()) {
  const out = [];
  const go = (dir, rel) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || e.name === 'node_modules' || e.isSymbolicLink()) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (!rel && (e.name === 'state' || skipTop.has(e.name))) continue;
      if (e.isDirectory()) go(path.join(dir, e.name), r);
      else out.push(r);
    }
  };
  if (fs.existsSync(docsRoot)) go(docsRoot, '');
  return out.sort();
}

// 표 줄을 제목별로(002의 것과 같은 꼴)
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

// 작업 기록 한 장을 날짜 제목마다 나눈다. { files: [{ rel, text, date }], pre }
function splitLog(text, dir, tplText) {
  const body = nl(text).replace(/^---\n[\s\S]*?\n---\n?/, '');
  const re = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/gm;
  const heads = [...body.matchAll(re)];
  const now = today();
  // 날짜 제목 앞의 글: 제목(# ...)과 템플릿 안내문 줄을 빼고 남는 것
  const tplLines = new Set(nl(tplText).replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n').map((l) => noDates(l)).filter(Boolean));
  const pre = (heads.length ? body.slice(0, heads[0].index) : body).split('\n')
    .filter((l) => !/^#\s/.test(l) && !tplLines.has(noDates(l))).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const byDate = new Map();
  heads.forEach((h, i) => {
    const sec = body.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : undefined).trim();
    byDate.set(h[1], (byDate.has(h[1]) ? byDate.get(h[1]) + '\n\n' : '') + sec);
  });
  const dates = [...byDate.keys()].sort();
  const files = dates.map((d, i) => {
    let content = byDate.get(d);
    if (i === 0 && pre) content = '## 옮기기 전 머리말\n\n' + pre + '\n\n## 한 일\n\n' + content;
    const status = d < now ? '끝남' : '사용 중';
    return { rel: dir + '/' + d + '.md', date: d, text: `---\ntype: log\nstatus: ${status}\ncreated: ${d}\n---\n\n# 작업 일지 ${d}\n\n${content}\n` };
  });
  if (!files.length && pre) files.push({ rel: dir + '/' + now + '.md', date: now, text: `---\ntype: log\nstatus: 사용 중\ncreated: ${now}\n---\n\n# 작업 일지 ${now}\n\n## 옮기기 전 머리말\n\n${pre}\n` });
  return files;
}

// 아이디어 폴더 안의 결정, 설계, 계획 문서의 제자리
function ideaPlace(rel, text) {
  const t = typeOf(text);
  const base = rel.split('/').pop();
  if (t === 'decision') return { to: 'shared/decisions/' + base, why: '결정 문서는 결정 자리' };
  if (t === 'design') return { to: 'shared/design/' + base, why: '설계 문서는 설계 자리' };
  if (t === 'roadmap' || t === 'plan') return { to: 'shared/plans/' + base, why: '계획 문서는 구현 계획 자리', type: 'plan' };
  return null;
}

const validTo = (to) => typeof to === 'string' && /^(shared|private)\/[^:]+\.md$/.test(to) && !to.split('/').some((s) => s === '..' || s === '.' || s === '');

// 경로 고치기. map: 옛 경로 → 새 경로(폴더면 끝에 '/'). self: 이 문서의 옛 경로와 새 경로
// - 백틱 안의 맨 파일 이름(`open-questions.md`)은 어느 문서인지 글로 가리킨 것일 때가 많아 고치지 않는다(002와 같다)
// - 나눈 작업 기록(폴더로 가는 것)은 related만 고친다. 본문의 "changelog.md에 적었다" 같은 문장은 그때의 이야기라 그대로 둔다
function rewriteLocal(text, fromRel, toRel, ctx) {
  let out = text, count = 0;
  const fix = (raw, kind, where = 'body') => {
    const suffix = (String(raw).match(/(#.*|:\d+(-\d+)?)$/) || [''])[0];
    if (kind === 'code' && !String(raw).includes('/')) return null;
    const target = resolveTarget(ctx.index, raw, fromRel, kind);
    if (!target) return null;
    const moved = ctx.map.get(target);
    if (moved && moved.endsWith('/') && where !== 'related') return null;
    if (!moved && (kind !== 'link' || fromRel === toRel)) return null;
    const dest = moved || target;
    if (kind === 'link') {
      const isDir = dest.endsWith('/');
      let r = path.posix.relative(dirOf(toRel) || '.', isDir ? dest.slice(0, -1) : dest) || '.';
      if (isDir) r += '/';
      const next = r + suffix;
      return next === raw ? null : next;
    }
    const next = dest + suffix;
    return next === raw ? null : next;
  };
  out = out.replace(/^(---\n[\s\S]*?\n---)/, (fm) => fm.replace(/^(related\s*:\s*\[)(.*)(\]\s*)$/m, (all, a, list, b) => {
    let changed = false;
    const next = list.split(',').map((s) => s.trim()).filter(Boolean).map((it) => {
      const q = /^["']/.test(it) ? it[0] : '';
      const r = fix(q ? it.slice(1, -1) : it, 'code', 'related');
      if (r == null) return it;
      changed = true; count++;
      return q + r.replace(/\/$/, '') + q;
    });
    return changed ? a + next.join(', ') + b : all;
  }));
  const toks = linkTokens(out);
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    const r = fix(t.raw, t.kind);
    if (r == null) continue;
    out = out.slice(0, t.start) + r + out.slice(t.end);
    count++;
  }
  return { text: out, count };
}

// 다른 작업 공간 문서 안의 prefix: 경로(예: '앱:', 'home:')
function rewriteForeign(text, prefix, map) {
  let out = text, count = 0;
  // 나눈 작업 기록(폴더로 가는 것)은 related만 고치고, 다른 작업 공간의 폴더는 뷰어가 찾지 못해 그 폴더의 README.md를 가리킨다
  const fix = (raw, where = 'body') => {
    if (!raw.startsWith(prefix)) return null;
    const rest = raw.slice(prefix.length);
    const suffix = (rest.match(/(#.*)$/) || [''])[0];
    const bare = suffix ? rest.slice(0, -suffix.length) : rest;
    if (!map.has(bare)) return null;
    const dest = map.get(bare);
    if (dest.endsWith('/')) return where === 'related' ? prefix + dest + 'README.md' : null;
    return prefix + dest + suffix;
  };
  out = out.replace(/^(---\n[\s\S]*?\n---)/, (fm) => fm.replace(/^(related\s*:\s*\[)(.*)(\]\s*)$/m, (all, a, list, b) => {
    let changed = false;
    const next = list.split(',').map((s) => s.trim()).filter(Boolean).map((it) => { const r = fix(it, 'related'); if (r == null) return it; changed = true; count++; return r; });
    return changed ? a + next.join(', ') + b : all;
  }));
  const toks = linkTokens(out).filter((t) => t.kind === 'code');
  for (let i = toks.length - 1; i >= 0; i--) {
    const r = fix(toks[i].raw);
    if (r == null) continue;
    out = out.slice(0, toks[i].start) + r + out.slice(toks[i].end);
    count++;
  }
  return { text: out, count };
}

// 속성 가이드: 모양 4 템플릿 + 옛 가이드에서 사용자가 더한 표 줄(모양 3 템플릿에 없던 줄)
function guideOf(docs, home) {
  const file = path.join(docs, 'metadata-guide.md');
  const fresh = readTpl((home ? 'home' : 'project') + '/metadata-guide.md');
  if (!fs.existsSync(file)) return { text: fresh, added: [] };
  const old = nl(fs.readFileSync(file, 'utf8'));
  if (old.includes(home ? '`worklog/`' : '`private/worklog/`')) return { text: null, added: [] };
  const tplRows = new Set(tablesOf(readTpl((home ? 'v3/home' : 'v3/project') + '/metadata-guide.md')).flatMap((t) => t.rows.map((r) => noDates(r))));
  const extra = [];
  for (const t of tablesOf(old)) for (const r of t.rows) {
    if (tplRows.has(noDates(r))) continue;
    const first = (r.match(/`([^`]+)`/) || [])[1];
    if (first && fresh.includes('`' + first + '`')) continue;
    extra.push({ heading: t.heading, header: t.header, row: r });
  }
  if (!extra.length) return { text: fresh, added: [] };
  const add = extra.map((e) => `${e.heading}\n\n${e.header}\n| ${e.header.split('|').slice(1, -1).map(() => '---').join(' | ')} |\n${e.row}`).join('\n\n');
  return { text: mergeTables(fresh, add).text, added: extra.map((e) => e.row) };
}

function survey({ root, cfg }, answers = {}) {
  root = path.resolve(root);
  const home = cfg.mode === 'home';
  const docs = home ? root : path.join(root, '.siloroot');
  const files = walk(docs, new Set(['CLAUDE.md', 'metadata-guide.md', 'config.json']));
  const textOf = new Map(files.filter(isMd).map((f) => [f, nl(fs.readFileSync(path.join(docs, f), 'utf8'))]));
  const logDir = home ? 'log' : 'private/log';
  const worklogDir = home ? 'worklog' : 'private/worklog';
  const oqTo = home ? 'open-questions.md' : 'private/open-questions.md';
  const over = answers.placements || {};

  const moves = [];      // { from, to, text|null, why, kind }
  const creates = [];    // { rel, text }
  const deletes = [];
  const placements = []; // 사람이 승인할 목록(아이디어 폴더에서 옮길 것)

  // 작업 기록
  const logFile = logDir + '/changelog.md';
  if (textOf.has(logFile)) {
    const parts = splitLog(textOf.get(logFile), worklogDir, readTpl((home ? 'v3/home/log' : 'v3/project/private/log') + '/changelog.md'));
    for (const p of parts) creates.push({ rel: p.rel, text: p.text });
    deletes.push(logFile);
  }
  const oqFrom = logDir + '/open-questions.md';
  if (textOf.has(oqFrom)) moves.push({ from: oqFrom, to: oqTo, text: textOf.get(oqFrom), why: '확인할 것은 한 장' });
  // log/ 안의 다른 파일은 그대로 둔다(지우지 않는다)
  const otherLog = files.filter((f) => f.startsWith(logDir + '/') && f !== logFile && f !== oqFrom);

  if (!home) {
    // 로드맵 폴더 → 구현 계획
    for (const f of files.filter((x) => x.startsWith('shared/roadmap/'))) {
      const to = 'shared/plans/' + f.slice('shared/roadmap/'.length);
      let text = textOf.get(f) ?? null;
      if (text != null && typeOf(text) === 'roadmap') text = setFm(text, 'type', 'plan');
      moves.push({ from: f, to, text, why: '예전 로드맵 폴더의 문서는 기능마다의 구현 계획' });
    }
    // 아이디어 폴더 안의 결정, 설계, 계획
    for (const f of files.filter((x) => x.startsWith('shared/ideas/') && isMd(x) && !/README\.md$/i.test(x))) {
      const p = ideaPlace(f, textOf.get(f));
      if (!p) continue;
      const to = over[f] ?? p.to;
      let text = textOf.get(f);
      if (p.type) text = setFm(text, 'type', p.type);
      if (to.startsWith('shared/decisions/') && typeOf(text) !== 'decision') text = setFm(text, 'type', 'decision');
      placements.push({ from: f, to, why: over[f] ? '답으로 고름' : p.why });
      if (to !== f) moves.push({ from: f, to, text, why: p.why, kind: 'placement' });
    }
  }

  const bad = Object.entries(over).filter(([from, to]) => !placements.some((p) => p.from === from) || !validTo(to));
  if (bad.length) return { error: 'bad-placement', detail: bad.map(([from, to]) => ({ from, to })) };

  // 같은 갈 곳 둘, 또는 다른 내용이 이미 있으면 멈춘다
  const seen = new Map(), clash = [];
  for (const x of [...moves.map((m) => ({ to: m.to, from: m.from, text: m.text })), ...creates.map((c) => ({ to: c.rel, from: logFile, text: c.text }))]) {
    if (seen.has(x.to)) clash.push({ to: x.to, from: [seen.get(x.to), x.from] });
    seen.set(x.to, x.from);
    const dest = path.join(docs, ...x.to.split('/'));
    if (fs.existsSync(dest) && x.text != null && nl(fs.readFileSync(dest, 'utf8')) !== x.text) clash.push({ to: x.to, from: [x.from], exists: true });
  }
  if (clash.length) return { error: 'placement-conflict', detail: clash };

  // 이슈 status
  const statusEdits = [];
  if (!home) for (const f of files.filter((x) => x.startsWith('shared/issues/') && isMd(x))) {
    const s = (fmOf(textOf.get(f)).match(/^status\s*:\s*(.+)$/m) || [])[1]?.trim();
    const next = s === '원인 찾음' ? '열림' : s === '안 함' ? '안 고침' : null;
    if (next) statusEdits.push({ rel: f, from: s, to: next });
  }

  // 경로 고치기
  const map = new Map(moves.map((m) => [m.from, m.to]));
  if (textOf.has(logFile)) map.set(logFile, worklogDir + '/');
  const index = makeIndex([...textOf.keys(), 'CLAUDE.md', 'metadata-guide.md'].filter((f) => fs.existsSync(path.join(docs, f))));
  const ctx = { index, map };
  const finalText = new Map();   // 새 경로 → 내용(옮긴 문서와 고친 문서)
  let refs = 0;
  const movedFrom = new Map(moves.map((m) => [m.from, m]));
  for (const f of textOf.keys()) {
    if (f === logFile) continue;
    const mv = movedFrom.get(f);
    const to = mv ? mv.to : f;
    let text = mv ? mv.text : textOf.get(f);
    const se = statusEdits.find((e) => e.rel === f);
    if (se) text = setFm(text, 'status', se.to);
    const r = rewriteLocal(text, f, to, ctx);
    refs += r.count;
    if (mv || r.count || se) finalText.set(to, r.text);
  }
  // 영역 안내(shared/README.md, private/README.md)를 손대지 않았으면(모양 3 템플릿 그대로면) 모양 4 템플릿으로 바꾼다
  if (!home) for (const f of ['shared/README.md', 'private/README.md']) {
    if (textOf.has(f) && noDates(textOf.get(f)) === noDates(readTpl('v3/project/' + f))) finalText.set(f, readTpl('project/' + f));
  }
  // 나눈 작업 일지 안의 경로(옛 작업 기록 자리 기준)
  for (const c of creates) {
    const r = rewriteLocal(c.text, logFile, c.rel, ctx);
    refs += r.count;
    c.text = r.text;
  }
  // CLAUDE.md의 관리 블록 밖
  let claude = null;
  const claudeFile = path.join(docs, 'CLAUDE.md');
  if (fs.existsSync(claudeFile)) {
    const raw = nl(fs.readFileSync(claudeFile, 'utf8'));
    const a = raw.indexOf(START), b = raw.indexOf(END);
    const fix = (s) => rewriteLocal(s, 'CLAUDE.md', 'CLAUDE.md', ctx);
    if (a >= 0 && b > a) {
      const x = fix(raw.slice(0, a)), y = fix(raw.slice(b + END.length));
      if (x.count || y.count) { claude = x.text + raw.slice(a, b + END.length) + y.text; refs += x.count + y.count; }
    }
  }
  // 다른 작업 공간의 경로
  const foreign = [];   // { abs, text }
  const u = readUser();
  const fmap = new Map([...map].map(([a, b]) => [a, b]));
  const scanForeign = (wsRoot, prefix) => {
    for (const f of walk(wsRoot, new Set(['state'])).filter(isMd)) {
      const abs = path.join(wsRoot, ...f.split('/'));
      const t = nl(fs.readFileSync(abs, 'utf8'));
      if (!t.includes(prefix)) continue;
      const r = rewriteForeign(t, prefix, fmap);
      if (r.count) { foreign.push({ abs, text: r.text }); refs += r.count; }
    }
  };
  if (!u.invalid) {
    if (home) for (const p of u.projects || []) { const pc = loadConfig(p.path); if (pc) scanForeign(pc.docsRoot || path.join(p.path, '.siloroot'), 'home:'); }
    else if (u.home && fs.existsSync(u.home)) scanForeign(u.home, projectNameFor(root) + ':');
  }

  const guide = guideOf(docs, home);

  for (const m of moves) if (m.from !== m.to) deletes.push(m.from);
  const notes = [];
  if (creates.length) notes.push(`작업 기록(${logFile})을 날짜마다 ${creates.length}개 문서(${worklogDir}/)로 나눕니다. 지난 날은 status를 끝남으로 둡니다.`);
  if (!home && moves.some((m) => m.from.startsWith('shared/roadmap/'))) notes.push('예전 shared/roadmap/의 문서는 구현 계획이라 shared/plans/로 옮기고 type을 plan으로 바꿉니다. 로드맵 한 장(shared/roadmap.md)은 새로 만듭니다.');
  if (placements.length) notes.push(`아이디어 폴더 안의 결정, 설계, 계획 문서 ${placements.length}개를 제자리로 옮깁니다. 갈 곳 목록을 확인하세요.`);
  if (statusEdits.length) notes.push(`이슈 ${statusEdits.length}개의 status를 바꿉니다(원인 찾음 → 열림, 안 함 → 안 고침).`);
  if (refs) notes.push(`문서 안의 경로 ${refs}곳을 새 자리로 고칩니다(related, 백틱, 링크${foreign.length ? ', 다른 작업 공간 문서 ' + foreign.length + '개' : ''}).`);
  if (otherLog.length) notes.push(`${logDir}/ 안의 다른 파일(${otherLog.join(', ')})은 그대로 둡니다. 자리를 정해 옮기세요.`);
  if (guide.added.length) notes.push(`metadata-guide.md를 모양 4 템플릿으로 바꾸고, 사용자가 더한 줄 ${guide.added.length}개를 옮겨 둡니다.`);
  notes.push('003은 커밋하지 않습니다.');

  const rel = (r) => (home ? r : '.siloroot/' + r);
  const slashAbs = (abs) => path.resolve(abs).split(path.sep).join('/');
  const touchesFiles = [...new Set([...deletes, ...[...finalText.keys()].filter((t) => fs.existsSync(path.join(docs, t)))].map(rel))]
    .concat(claude ? [rel('CLAUDE.md')] : [], guide.text != null ? [rel('metadata-guide.md')] : [], foreign.map((x) => slashAbs(x.abs)));
  const touchesCreates = [...new Set([...creates.map((c) => c.rel), ...[...finalText.keys()].filter((t) => !fs.existsSync(path.join(docs, t)))].map(rel))];
  return { home, docs, moves, creates, deletes, placements, finalText, claude, guide, foreign, notes, touches: { files: touchesFiles, creates: touchesCreates } };
}

function writeFile(abs, data) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, data);
}

export default {
  id: ID,
  from: 3,
  to: 4,
  title: '문서 자리를 다시 짠다: 작업 일지를 날짜별로, 로드맵 한 장과 구현 계획·요구사항 자리, 자리마다 안내',

  plan(ctx, answers = {}) {
    const s = survey(ctx, answers);
    if (s.error) return { error: s.error, detail: s.detail, moves: [], edits: [], decisions: [], notes: [], placements: [], touches: { files: [], creates: [] } };
    const r = (x) => (s.home ? x : '.siloroot/' + x);
    return {
      moves: s.moves.map((m) => ({ from: r(m.from), to: r(m.to) })).concat(s.creates.map((c) => ({ from: r(s.home ? 'log/changelog.md' : 'private/log/changelog.md'), to: r(c.rel) }))),
      placements: s.placements,
      edits: [
        ...(s.guide.text != null ? [{ file: r('metadata-guide.md'), what: '모양 4 템플릿으로 바꾸고 사용자가 더한 줄을 옮김' }] : []),
        ...(s.claude ? [{ file: r('CLAUDE.md'), what: '관리 블록 밖의 경로를 새 자리로 고침' }] : []),
      ],
      decisions: [], notes: s.notes, touches: s.touches,
    };
  },

  apply(ctx, decisions = {}, answers = {}) {
    const s = survey(ctx, answers);
    if (s.error) throw Object.assign(new Error(s.error + ': ' + JSON.stringify(s.detail)), { code: s.error });
    const abs = (rel) => path.join(s.docs, ...rel.split('/'));
    // 1. 새 파일(나눈 작업 일지, 옮긴 문서, 경로를 고친 문서)
    for (const c of s.creates) writeFile(abs(c.rel), c.text);
    for (const [to, text] of s.finalText) writeFile(abs(to), text);
    for (const m of s.moves) if (m.text == null) { fs.mkdirSync(path.dirname(abs(m.to)), { recursive: true }); fs.copyFileSync(abs(m.from), abs(m.to)); }
    if (s.claude) fs.writeFileSync(abs('CLAUDE.md'), s.claude);
    if (s.guide.text != null) fs.writeFileSync(abs('metadata-guide.md'), s.guide.text);
    for (const f of s.foreign) fs.writeFileSync(f.abs, f.text);
    // 2. 옛 파일과 빈 옛 폴더
    for (const d of s.deletes) fs.rmSync(abs(d), { force: true });
    for (const dir of [s.home ? 'log' : 'private/log', 'shared/roadmap']) {
      const a = abs(dir);
      const prune = (p) => { if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return; for (const e of fs.readdirSync(p)) prune(path.join(p, e)); if (!fs.readdirSync(p).length) fs.rmdirSync(p); };
      prune(a);
    }
    // 경로가 바뀌어 뷰어의 "바뀐 것" 비교 기준을 새로 잡는다
    const stateDir = ctx.cfg.stateDir || path.join(s.home ? s.docs : s.docs, s.home ? '.siloroot/state' : 'state');
    fs.rmSync(path.join(stateDir, 'snapshot-private.json'), { force: true });
    const r = (x) => (s.home ? x : '.siloroot/' + x);
    return {
      moved: s.deletes.map(r),
      edited: [...s.finalText.keys()].map(r),
      created: s.creates.map((c) => r(c.rel)),
      notes: s.notes,
    };
  },
};
