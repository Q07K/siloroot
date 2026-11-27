#!/usr/bin/env node
// SiloRoot 프로젝트 폴더의 마크다운을 읽어 읽기 전용 뷰어 HTML 한 장을 만든다.
// Node 표준 라이브러리만 쓴다. 결과물에는 비공개 문서 내용이 들어가므로 이름에 -private를 붙여 밖에 올리지 않는다.
//
// 실행: node viewer/build.mjs <프로젝트 폴더> [--seen]
// 폴더 이름은 .siloroot/config.json에서 읽고, 없으면 기본 이름(01-log, 02-study, 03-ideas, 04-feedback)을 쓴다.
// 결과: .siloroot/state/viewer-private.html (뷰어), .siloroot/state/snapshot-private.json (다음 실행 때 바뀐 줄을 찾기 위한 이전 상태)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { diffLines, compact } from './diff.mjs';
import { loadConfig, DEFAULT_DIRS } from '../lib/config.mjs';
import { AI_COMMENT_FILE, AI_COMMENT_HOUR } from '../lib/me-schedule.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { VOCAB } from '../lib/vocab.mjs';
import { placesOf, localPlace, folderRules, groupOf, slotFolders } from '../lib/layout.mjs';
import { readUser, workspaceRoot, WS_REF } from '../lib/user.mjs';
import { makeIndex, resolveTarget as resolveLink } from '../lib/links.mjs';
import { turnNew } from '../lib/trail.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
// 비교 기준(이전 상태)은 사용자가 "다 확인했어요"를 눌렀을 때(--seen)만 새로 잡는다.
// 그래야 AI가 점검하려고 실행해도 "최근 바뀐 것"이 지워지지 않는다. --keep-snapshot은 예전 이름이라 그냥 받아 둔다.
const KEEP_SNAPSHOT = !args.includes('--seen');
// --data-only: 뷰어 HTML 대신 데이터만 data-private.json에 쓴다. 서버가 그래프를 실시간으로 고칠 때 쓴다(serve.mjs의 /data).
const DATA_ONLY = args.includes('--data-only');
// 폴더는 인자, VIEWER_ROOT 환경 변수, 지금 폴더 순으로 정한다.
const ROOT = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seen-path') || process.env.VIEWER_ROOT || process.cwd());
// 실행 시간을 사용 기록에 남긴다. 서버가 자주 부르는 --data-only, --seen, --seen-path는 따로 센다 (lib/metrics.mjs)
const VARIANT = ['--data-only', '--seen-path', '--seen'].find((f) => args.includes(f));
const timer = timeScript(ROOT, 'script', 'script:build' + (VARIANT ? ':' + VARIANT.slice(2) : ''));
const CFG = loadConfig(ROOT) || { docsRoot: ROOT, dirs: { ...DEFAULT_DIRS }, stateDir: path.join(ROOT, '.siloroot', 'state') };
// 문서를 찾고 경로를 셀 기준. 감싼 배치(wrapped)면 프로젝트의 .siloroot/, 예전 배치면 프로젝트 맨 위다.
const DOCS = CFG.docsRoot;
// 역할마다 문서 자리(lib/layout.mjs). 이 작업 공간에 없는 자리(홈에 있는 것 등)는 null이고, 그 객체는 빈 목록이다
const PLACES = placesOf(CFG);
const L = (role) => localPlace(PLACES[role]);
const V3_PROJECT = (CFG.schema ?? 0) >= 3 && CFG.mode !== 'home';
const STUDY = L('study'), LOG = L('log'), CAND = L('candidates');
// 확인할 것과 작업 일지: 모양 4는 자리표에 따로 있고, 모양 3까지는 작업 기록 폴더 안이다
const OPEN_Q = L('openQuestions') || (LOG ? LOG + '/open-questions.md' : null), WORKLOG = L('worklog');
const IDEAS = L('ideas') || L('personalIdeas');
const PROFILE_FILE = L('profile'), WRITING = L('writingGuide'), AI_COMMENT = L('aiComment');
const EDIT_LOG = path.join(CFG.stateDir, 'web-edits.jsonl');
const OUT_DIR = CFG.stateDir;
const OUT_HTML = path.join(OUT_DIR, 'viewer-private.html');
const SNAP = path.join(OUT_DIR, 'snapshot-private.json');
const TEMPLATE = path.join(here, 'template.html');
const MAX_FILE = 2 * 1024 * 1024;

// ---------- 1. 문서 찾기 ----------
// 점(.)이나 밑줄(_)로 시작하는 폴더는 설정이나 임시 작업 폴더라 건너뛴다. 뷰어 생성물 폴더(state)도 건너뛴다.
function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name.startsWith('_') || ent.name === 'node_modules') continue;
    if (ent.isSymbolicLink()) continue;
    const full = path.join(dir, ent.name);
    if (full === CFG.stateDir) continue;
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(md|markdown)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

const toRel = (full) => path.relative(DOCS, full).split(path.sep).join('/');

const files = (fs.existsSync(DOCS) ? walk(DOCS, []) : []).filter((f) => fs.statSync(f).size <= MAX_FILE);
const LINK_INDEX = makeIndex(files.map(toRel));
const { mdSet } = LINK_INDEX;

// ---------- 2. 링크 해석 ----------
// 다른 작업 공간을 가리키는 경로: home:study/a.md, <프로젝트 이름>:shared/issues/x.md (이름은 user.json)
// 이름 규칙은 lib/user.mjs의 WS_REF. C:/x.md는 걸리지 않고, https://...는 이름 https가 등록되지 않아 버려진다
const USER = readUser();
const SAME = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const ROOT_SLASH = ROOT.split(path.sep).join('/');
// 이 작업 공간 자신의 이름. 자기 이름으로 적은 경로는 안의 문서로 읽는다
const SELF = CFG.mode === 'home' ? 'home' : (USER.projects.find((p) => SAME(p.path, ROOT_SLASH)) || {}).name || null;
const wsRootOf = (name) => (name === 'home' ? USER.home : workspaceRoot(name));
// { name, rel, known } | null. known: 홈이거나 user.json에 있는 이름
// 모양 1·2 작업 공간은 다른 작업 공간 경로를 읽지 않는다
function wsRef(raw) {
  if ((CFG.schema ?? 0) < 3) return null;
  const m = String(raw).trim().match(WS_REF);
  if (!m) return null;
  return { name: m[1], rel: m[2], known: m[1] === 'home' || !!workspaceRoot(m[1]) };
}

// mode 'link': 마크다운 링크. 문서 기준 상대 경로를 먼저 본다.
// mode 'code': 백틱 안의 경로 글자. 폴더 맨 위 기준을 먼저 본다(이 폴더 문서들이 그렇게 쓴다).
// 푸는 법은 lib/links.mjs에 있다(마이그레이션의 경로 고치기와 같이 쓴다)
const resolveTarget = (raw, fromRel, mode) => resolveLink(LINK_INDEX, raw, fromRel, mode);

function extractLinks(text, rel) {
  const body = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*```[\s\S]*?^\s*```/gm, '');
  const links = [];
  const exts = [];
  const linkMap = {};
  const add = (raw, kind) => {
    const ws = wsRef(raw);
    if (ws && ws.name !== SELF) { if (ws.known) exts.push({ name: ws.name, target: ws.name + ':' + ws.rel, kind }); return; }
    const target = resolveTarget(ws ? ws.rel : raw, rel, kind);
    if (!target) return;
    linkMap[raw] = target;
    if (target !== rel) links.push({ to: target, kind });
  };
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) add(m[1], 'link');
  for (const m of body.matchAll(/`([^`\n]+)`/g)) add(m[1], 'code');
  return { links, exts, linkMap };
}

// ---------- 3. 문서 정보 ----------
function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---', 4);
  if (end < 0) return {};
  const fm = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_가-힣-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    fm[m[1]] = v;
  }
  return fm;
}

function titleOf(text, rel, fm) {
  if (fm.title) return String(fm.title);
  const noFence = text.replace(/^\s*```[\s\S]*?^\s*```/gm, '');
  const h1 = noFence.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].replace(/\*\*/g, '').trim();
  const prop = text.match(/프로젝트=([^/\n]+?)\s*(?:\/|\n)/);
  if (prop) return prop[1].trim();
  const parts = rel.split('/');
  const base = parts[parts.length - 1].replace(/\.(md|markdown)$/i, '');
  if (parts.length > 1 && /^readme$/i.test(base)) return parts[parts.length - 2];
  return parts.length > 1 ? parts[parts.length - 2] + ' / ' + base : base;
}

const docs = files.map((full) => {
  const rel = toRel(full);
  const text = fs.readFileSync(full, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const st = fs.statSync(full);
  const fm = parseFrontmatter(text);
  const { links, exts, linkMap } = extractLinks(text, rel);
  return {
    path: rel,
    folder: groupOf(rel, CFG),
    title: titleOf(text, rel, fm),
    mtime: Math.round(st.mtimeMs),
    size: st.size,
    fm,
    text,
    hash: crypto.createHash('sha256').update(text).digest('hex'),
    linkMap,
    _links: links,
    _exts: exts,
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const edges = [];
// 다른 작업 공간으로 가는 연결은 edges와 따로 둔다. 문서 화면의 앞뒤 연결 목록에 섞이지 않게 한다. 그 작업 공간 문서는 읽지 않는다
const extEdges = [];
const externals = new Map();
function addExt(from, name, target, kind) {
  if (!externals.has(name)) {
    const r = wsRootOf(name);
    const c = r ? loadConfig(r) : null;
    externals.set(name, { id: '@' + name, name, label: name === 'home' ? '홈' : name, url: c ? 'http://127.0.0.1:' + c.port : null });
  }
  if (!extEdges.some((e) => e.from === from && e.target === target && e.kind === kind)) extEdges.push({ from, to: '@' + name, kind, target });
}
for (const d of docs) {
  const seen = new Set();
  for (const l of d._links) {
    const key = l.to + '|' + l.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: d.path, to: l.to, kind: l.kind });
  }
  for (const x of d._exts) addExt(d.path, x.name, x.target, x.kind);
  delete d._links;
  delete d._exts;
}

// ---------- 3-1. 속성 점검과 related 연결 ----------
// 쓸 수 있는 type과 status(VOCAB)는 lib/vocab.mjs에 있다.
// 폴더마다 정해진 type(lib/layout.mjs의 folderRules). 폴더의 README.md는 목록이라 빠진다. 여기 없는 폴더도 type 자체는 모두 필수다.
const REQUIRED = folderRules(CFG).map((r) => ({ prefix: r.prefix, type: r.types, skip: /(^|\/)README\.md$/i }));
const tagsOf = (d) => { const t = d.fm && d.fm.tags; return (Array.isArray(t) ? t : t ? String(t).split(',') : []).map((s) => String(s).trim()).filter(Boolean); };
const typeOk = (req, t) => (Array.isArray(req.type) ? req.type.includes(t) : req.type === t);
const EXEMPT = () => false;
const issues = [];
for (const d of docs) {
  const fm = d.fm || {};
  const warn = (msg) => issues.push({ doc: d.path, msg });
  const rel = fm.related ? (Array.isArray(fm.related) ? fm.related : [fm.related]) : [];
  d.related = [];
  for (const r of rel) {
    const ws = wsRef(r);
    if (ws && ws.name !== SELF) {
      if (ws.known) addExt(d.path, ws.name, ws.name + ':' + ws.rel, 'prop');
      else warn('related의 "' + r + '": 작업 공간 "' + ws.name + '"를 user.json에서 찾지 못함');
      continue;
    }
    const t = resolveTarget(ws ? ws.rel : r, d.path, 'code');
    if (!t) { warn('related의 "' + r + '" 문서를 찾지 못함'); continue; }
    d.related.push(t);
    if (t !== d.path) edges.push({ from: d.path, to: t, kind: 'prop' });
  }
  const req = REQUIRED.find((x) => d.path.startsWith(x.prefix) && !(x.skip && x.skip.test(d.path)));
  if (req && !fm.type) warn('type: ' + [].concat(req.type).join(' 또는 ') + ' 속성이 없음');
  else if (!fm.type && !EXEMPT(d.path)) warn('type 속성이 없음 (metadata-guide.md 3절에서 폴더 규칙을 찾는다)');
  if (fm.type) {
    const t = String(fm.type);
    if (!VOCAB[t]) warn('정하지 않은 type "' + t + '" (쓸 수 있는 값: ' + Object.keys(VOCAB).join(', ') + ')');
    else if (!fm.status) warn('status 속성이 없음');
    else if (!VOCAB[t].includes(String(fm.status))) warn('status "' + fm.status + '"는 ' + t + '에 없는 값 (쓸 수 있는 값: ' + VOCAB[t].join(', ') + ')');
    if (req && VOCAB[t] && !typeOk(req, t)) warn('이 폴더의 type은 ' + [].concat(req.type).join(' 또는 ') + '여야 함');
  }
  if (fm.created && !/^\d{4}-\d{2}-\d{2}$/.test(String(fm.created))) warn('created는 YYYY-MM-DD 형식이어야 함');
  if (fm.type === 'study' && !tagsOf(d).length) warn('tags에 분야가 없음 (' + (L('study') || 'study') + '/README.md "노트 쓰는 법")');
}

// 방향: 모양 3 프로젝트의 공유 문서(shared/)는 팀원이 볼 수 없는 문서(private/, 다른 작업 공간)를 가리키지 않는다. 막지는 않고 대상마다 한 번 알린다
if (V3_PROJECT) {
  for (const d of docs) {
    if (!d.path.startsWith('shared/')) continue;
    const hidden = new Set([
      ...edges.filter((e) => e.from === d.path && e.to.startsWith('private/')).map((e) => e.to),
      ...extEdges.filter((e) => e.from === d.path).map((e) => e.target),
    ]);
    for (const t of hidden) issues.push({ doc: d.path, msg: '공유 문서가 팀원이 볼 수 없는 ' + t + '을 가리킴' });
  }
}

// 바깥 문서 제목과 본문: 가리킨 문서만 읽는다(그 작업 공간의 다른 문서는 읽지 않는다). 못 읽으면 null.
// 본문(extTexts)은 연결 그래프의 옆 패널이 상대 뷰어 없이 보이는 데 쓴다
const extTitles = {}, extTexts = {}, extFms = {};
for (const e of extEdges) {
  if (e.target in extTitles) continue;
  extTitles[e.target] = null; extTexts[e.target] = null; extFms[e.target] = null;
  const i = e.target.indexOf(':'), name = e.target.slice(0, i), rel = e.target.slice(i + 1).split('#')[0];
  const r = wsRootOf(name), c = r ? loadConfig(r) : null;
  if (!c || !/\.(md|markdown)$/i.test(rel)) continue;
  const full = path.resolve(c.docsRoot, rel);
  if (path.relative(c.docsRoot, full).startsWith('..')) continue;
  try {
    const text = fs.readFileSync(full, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const fm = parseFrontmatter(text);
    extTitles[e.target] = titleOf(text, rel, fm);
    extFms[e.target] = fm && Object.keys(fm).length ? fm : null;
    extTexts[e.target] = text;
  } catch { /* 없는 문서는 파일 이름으로 보인다 */ }
}

// ---------- 4. 객체 모으기 ----------
// 문서 안에 흩어진 질문, 주장, 아이디어를 종류별로 꺼낸다. 객체는 문서와 1:1이 아니다.
const get = (p) => docs.find((d) => d.path === p);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function parseQuestions(d) {
  if (!d) return [];
  const out = [];
  let section = '';
  for (const line of d.text.split('\n')) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { section = h[1].trim(); continue; }
    const m = line.match(/^- \[( |x|X)\]\s+(.*)$/);
    if (!m) continue;
    const body = m[2];
    const t = body.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
    out.push({
      title: t ? t[1] : cut(body, 60),
      detail: cut(t ? t[2] : body, 220),
      done: m[1] !== ' ',
      section,
      doc: d.path,
    });
  }
  return out;
}

function parseStudy() {
  if (!STUDY) return [];
  const readme = get(STUDY + '/README.md');
  const level = {};
  if (readme) {
    for (const m of readme.text.matchAll(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|/gm)) {
      level[STUDY + '/' + m[2].trim()] = { first: m[3].trim(), level: m[4].trim() };
    }
  }
  return docs
    .filter((d) => d.path.startsWith(STUDY + '/') && !/README\.md$/i.test(d.path))
    .map((d) => {
      const row = level[d.path] || {};
      const fmStatus = d.fm && d.fm.status ? String(d.fm.status) : '';
      if (fmStatus && row.level && fmStatus !== row.level) issues.push({ doc: d.path, msg: 'status "' + fmStatus + '"와 ' + STUDY + '/README.md의 이해도 "' + row.level + '"가 다름' });
      return { title: d.title, doc: d.path, level: fmStatus || row.level || '', first: (d.fm && d.fm.created) || row.first || '' };
    });
}

// 마크다운 표를 읽는다. 각 행은 { section(바로 위 ## 제목), header(그 표의 첫 행), cells }.
function tableRows(text) {
  const out = [];
  let section = '';
  let header = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^##\s+(.+)$/);
    if (h) { section = h[1].trim(); header = null; continue; }
    if (!line.trim().startsWith('|')) { header = null; continue; }
    if (/^\s*\|\s*:?-{2,}/.test(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    if (!header) { header = cells; continue; }
    out.push({ section, header, cells });
  }
  return out;
}
// "## 근거" 같은 절의 본문(다음 ## 전까지)
function sectionBody(text, name) {
  const m = text.match(new RegExp('^##\\s+' + name + '\\s*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))', 'm'));
  return m ? m[1].trim() : '';
}
const bullets = (s) => s.split('\n').filter((l) => /^-\s+/.test(l)).map((l) => l.replace(/^-\s+/, '').trim());

// "나" 화면: AI가 쓰는 사용자 정보(승인된 profile, trait 후보, 글쓰기 규칙). 점수나 평가는 만들지 않고 원본 문장과 근거만 모은다.
function parseMe() {
  const PROFILE = PROFILE_FILE;
  const fmStatus = (d) => (d.fm && d.fm.status ? String(d.fm.status) : '');
  const traitOf = (d) => {
    const row = tableRows(sectionBody(d.text, '제안하는 항목'))[0];
    return {
      doc: d.path, title: d.title.replace(/^사용자 정보 후보:\s*/, ''), status: fmStatus(d), created: (d.fm && d.fm.created) || '',
      group: row ? row.cells[0] : '', item: row ? row.cells[1] : '', content: row ? row.cells[2] || '' : '',
      evidence: bullets(sectionBody(d.text, '근거')), memo: bullets(sectionBody(d.text, '메모')),
    };
  };
  const traits = docs.filter((d) => d.path.startsWith(CAND + '/') && d.fm && d.fm.type === 'trait').map(traitOf);
  const byPath = Object.fromEntries(traits.map((t) => [t.doc, t]));

  const profileDoc = get(PROFILE);
  const approved = [];
  if (profileDoc) {
    for (const r of tableRows(profileDoc.text)) {
      if (r.header[0] !== '항목' || !r.cells[0]) continue;
      const src = (r.cells[2] || '').replace(/`/g, '').trim();
      const t = byPath[src];
      if (!t) issues.push({ doc: PROFILE, msg: '"' + r.cells[0] + '"의 근거 "' + src + '" 후보 파일을 찾지 못함' });
      else if (t.status !== '반영') issues.push({ doc: PROFILE, msg: '"' + r.cells[0] + '"의 근거 ' + src + '의 status가 "반영"이 아님 ("' + t.status + '")' });
      approved.push({ group: r.section, item: r.cells[0], content: r.cells[1] || '', source: src, approvedAt: r.cells[3] || '', evidence: t ? t.evidence : [] });
    }
  }
  const groups = profileDoc ? [...profileDoc.text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim()) : [];

  const wg = WRITING && get(WRITING);
  const writing = { doc: WRITING, principles: [], banned: [] };
  if (wg) {
    for (const r of tableRows(wg.text)) {
      if (r.header[0] === '원칙') writing.principles.push({ name: r.cells[0], content: r.cells[1] || '', source: r.cells[2] || '' });
      else if (r.header[0] === '쓰지 않는 것') writing.banned.push({ name: r.cells[0], content: r.cells[1] || '', source: r.cells[2] || '' });
    }
  }

  const rejected = [
    ...traits.filter((t) => t.status === '거절').map((t) => ({ kind: '사용자 정보', doc: t.doc, title: t.title, content: t.content, evidence: t.evidence, memo: t.memo })),
    ...docs.filter((d) => d.path.startsWith(CAND + '/') && d.fm && d.fm.type === 'rule' && fmStatus(d) === '거절').map((d) => {
      const row = tableRows(sectionBody(d.text, '제안하는 규칙'))[0];
      return { kind: '글쓰기 규칙', doc: d.path, title: d.title.replace(/^규칙 후보:\s*/, ''), content: row ? row.cells[0] + ' → ' + (row.cells[1] || '') : '', evidence: bullets(sectionBody(d.text, '근거가 된 수정')), memo: bullets(sectionBody(d.text, '메모')) };
    }),
  ];

  return {
    profile: PROFILE, groups, approved,
    pending: traits.filter((t) => t.status === '제안' || t.status === '승인'),
    rejected, writing,
  };
}

const objects = {
  // "나"는 사용자 정보가 있는 작업 공간(모양 1·2, 홈)에만 있다. 모양 3 프로젝트는 홈 뷰어로 가는 링크를 보인다(data.home)
  me: PROFILE_FILE ? parseMe() : null,
  questions: OPEN_Q ? parseQuestions(get(OPEN_Q)) : [],
  claims: [],
  ideas: docs
    .filter((d) => IDEAS && d.path.startsWith(IDEAS + '/') && !/README\.md$/i.test(d.path) && !(d.fm && ['decision', 'design', 'roadmap'].includes(d.fm.type)))
    .map((d) => ({ title: d.title, doc: d.path, status: (d.fm && d.fm.status ? String(d.fm.status) : ((d.text.match(/^-\s*상태:\s*(.+)$/m) || [])[1] || '')).trim() })),
  study: parseStudy(),
  typed: docs.filter((d) => d.fm && d.fm.type).map((d) => ({ title: d.title, doc: d.path, type: String(d.fm.type), status: d.fm.status ? String(d.fm.status) : '' })),
  issues,
};

// ---------- 4-1. "나" 대시보드: 사용 방법 레이더 ----------
// 축 다섯 개를 폴더 기록으로 계산한다. 목표치를 바꾸려면 ME_TARGETS만 고친다.
const ME_TARGETS = { breadth: 6, taming: 10, steadyDays: 14, tamingDays: 30 };
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (dt) => dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()); // 로컬 날짜
const daysBack = (n) => { const out = []; const t = new Date(); for (let i = 0; i < n; i++) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i); out.push(ymd(d)); } return out; };
const pct = (x) => Math.max(0, Math.min(100, Math.round(x * 100)));

function buildRadar(o) {
  const today = ymd(new Date());
  const axes = [];

  // 공부 깊이
  const study = o.study;
  const pass = study.filter((s) => s.level === '통과').length, part = study.filter((s) => s.level === '부분').length;
  axes.push({
    key: 'depth', name: '공부 깊이', value: study.length ? pct((pass + 0.5 * part) / study.length) : 0,
    formula: '(통과 + 0.5 × 부분) ÷ 공부 노트 수 = (' + pass + ' + 0.5 × ' + part + ') ÷ ' + study.length,
    target: '모든 노트가 통과', note: '이해도는 노트의 status(검증 기록의 판정)에서 가져온다.',
    evidence: study.map((s) => ({ text: s.title + ' · ' + (s.level || '이해도 없음'), doc: s.doc })),
  });

  // 공부 넓이: 공부 노트 tags의 첫 낱말이 분야
  const fields = {};
  for (const s of study) { const f = tagsOf(get(s.doc))[0]; if (f) (fields[f] = fields[f] || []).push(s); }
  const fieldNames = Object.keys(fields).sort((a, b) => fields[b].length - fields[a].length || a.localeCompare(b));
  axes.push({
    key: 'breadth', name: '공부 넓이', value: pct(fieldNames.length / ME_TARGETS.breadth),
    formula: '서로 다른 분야 수 ÷ 목표 ' + ME_TARGETS.breadth + ' = ' + fieldNames.length + ' ÷ ' + ME_TARGETS.breadth,
    target: '분야 ' + ME_TARGETS.breadth + '개', note: '분야는 공부 노트 tags의 첫 낱말이다 (' + STUDY + '/README.md).',
    evidence: fieldNames.map((f) => ({ text: f + ' ' + fields[f].length + '개: ' + fields[f].map((s) => s.title).join(', ') })),
  });

  // 마무리
  const q = o.questions, qDone = q.filter((x) => x.done).length;
  const ideas = docs.filter((d) => d.path.startsWith(IDEAS + '/') && d.fm && d.fm.type === 'idea');
  const started = ideas.filter((d) => String(d.fm.status) !== '아이디어');
  const finished = started.filter((d) => ['완료', '접음'].includes(String(d.fm.status)));
  const qr = q.length ? qDone / q.length : 0, ir = started.length ? finished.length / started.length : 0;
  axes.push({
    key: 'finish', name: '마무리', value: pct((qr + ir) / 2),
    formula: '(끝낸 질문 비율 + 끝낸 아이디어 비율) ÷ 2 = (' + qDone + '/' + q.length + ' + ' + finished.length + '/' + started.length + ') ÷ 2',
    target: '둘 다 100%',
    note: '아이디어는 "아이디어" 상태를 빼고 완료, 접음을 끝낸 것으로 센다. 끝낸 질문을 [x]로 두지 않고 줄째 지우면 여기서 세지 못한다.',
    evidence: [{ text: '미해결 질문: 끝냄 ' + qDone + ' / 전체 ' + q.length, doc: OPEN_Q },
      ...started.map((d) => ({ text: d.title + ' · ' + d.fm.status, doc: d.path }))],
  });

  // 꾸준함: 작업 일지(모양 4는 worklog/의 날짜 문서, 그 전은 changelog의 날짜 제목)와 문서 created
  const window14 = daysBack(ME_TARGETS.steadyDays);
  const byDay = {};
  if (WORKLOG) for (const d of docs) {
    const m = d.path.startsWith(WORKLOG + '/') && d.path.slice(WORKLOG.length + 1).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    if (m) (byDay[m[1]] = byDay[m[1]] || new Set()).add('changelog');
  }
  const log = LOG ? get(LOG + '/changelog.md') : null;
  if (log) for (const m of log.text.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})\s*$/gm)) (byDay[m[1]] = byDay[m[1]] || new Set()).add('changelog');
  for (const d of docs) { const c = d.fm && d.fm.created ? String(d.fm.created) : ''; if (c) (byDay[c] = byDay[c] || new Set()).add('새 문서'); }
  const active = window14.filter((day) => byDay[day]);
  const newDocs = (day) => docs.filter((d) => d.fm && String(d.fm.created) === day).length;
  axes.push({
    key: 'steady', name: '꾸준함', value: pct(active.length / ME_TARGETS.steadyDays),
    formula: '최근 ' + ME_TARGETS.steadyDays + '일 중 기록이 있는 날 ÷ ' + ME_TARGETS.steadyDays + ' = ' + active.length + ' ÷ ' + ME_TARGETS.steadyDays,
    target: ME_TARGETS.steadyDays + '일 모두', note: '기록은 작업 일지(날짜별 문서나 changelog의 날짜 제목)와 문서의 created다. 기간은 ' + window14[window14.length - 1] + '부터 ' + today + '까지.',
    evidence: active.map((day) => ({ text: day + ': ' + [byDay[day].has('changelog') ? '작업 일지' : '', newDocs(day) ? '새 문서 ' + newDocs(day) + '개' : ''].filter(Boolean).join(', ') })),
  });

  // AI 길들이기
  const window30 = new Set(daysBack(ME_TARGETS.tamingDays));
  const fb = docs.filter((d) => d.path.startsWith(CAND + '/') && d.fm && window30.has(String(d.fm.created || '')) && (
    (['rule', 'trait'].includes(d.fm.type) && ['반영', '거절'].includes(String(d.fm.status))) || (d.fm.type === 'feedback' && String(d.fm.status) === '완료')));
  const kind = { rule: '글쓰기 규칙', trait: '사용자 정보', feedback: '댓글' };
  axes.push({
    key: 'taming', name: 'AI 길들이기', value: pct(fb.length / ME_TARGETS.taming),
    formula: '최근 ' + ME_TARGETS.tamingDays + '일에 결정한 후보(반영, 거절)와 완료한 댓글 ÷ 목표 ' + ME_TARGETS.taming + ' = ' + fb.length + ' ÷ ' + ME_TARGETS.taming,
    target: ME_TARGETS.tamingDays + '일에 ' + ME_TARGETS.taming + '건', note: '결정한 날이 따로 적혀 있지 않아 후보와 댓글의 created로 기간을 본다.',
    evidence: fb.map((d) => ({ text: kind[d.fm.type] + ' · ' + d.fm.status + ' · ' + d.title.replace(/^(규칙 후보|사용자 정보 후보):\s*/, ''), doc: d.path })),
  });

  return { today, targets: ME_TARGETS, axes };
}

// 축별 추이: 하루 한 줄. 같은 날 다시 만들면 그날 줄을 바꾼다.
function meHistory(radar) {
  const f = path.join(OUT_DIR, 'me-history.jsonl');
  let rows = [];
  try { rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((r) => r && r.date && r.v); } catch { rows = []; }
  const v = Object.fromEntries(radar.axes.map((a) => [a.key, a.value]));
  rows = rows.filter((r) => r.date !== radar.today).concat([{ date: radar.today, v }]).sort((a, b) => a.date.localeCompare(b.date));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return rows;
}

if (objects.me) {
  objects.me.radar = buildRadar(objects);
  objects.me.history = meHistory(objects.me.radar);
// AI 코멘트와 갱신 시각(매일 hour시 이후 첫 세션에서 훅이 알린다. lib/me-schedule.mjs)
  objects.me.comment = { doc: AI_COMMENT, hour: AI_COMMENT_HOUR, mtime: get(AI_COMMENT) ? get(AI_COMMENT).mtime : 0 };
}

// ---------- 5. 지난번과 비교 ----------
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
let prev = null;
try { prev = JSON.parse(fs.readFileSync(SNAP, 'utf8')); } catch { prev = null; }
// --seen-path <문서>: 그 문서 하나만 "확인함"으로 비교 기준을 새로 잡는다 (뷰어의 개별 확인 버튼)
const SEEN_PATH = args.includes('--seen-path') ? args[args.indexOf('--seen-path') + 1] : null;
if (SEEN_PATH && prev) {
  const cur = docs.find((d) => d.path === SEEN_PATH);
  if (cur) prev.files[SEEN_PATH] = { hash: hash(cur.text), text: cur.text };
  else delete prev.files[SEEN_PATH];
  fs.writeFileSync(SNAP, JSON.stringify(prev));
}

const changes = { first: !prev, added: [], modified: [], removed: [] };
if (prev) {
  for (const d of docs) {
    const old = prev.files[d.path];
    if (!old) { changes.added.push(d.path); continue; }
    if (old.hash === hash(d.text)) continue;
    const ops = diffLines(old.text.split('\n'), d.text.split('\n'));
    changes.modified.push({
      path: d.path,
      plus: ops ? ops.filter((o) => o[0] === '+').length : 0,
      minus: ops ? ops.filter((o) => o[0] === '-').length : 0,
      diff: ops ? compact(ops) : null,
    });
  }
  for (const p of Object.keys(prev.files)) if (!mdSet.has(p)) changes.removed.push(p);
}

// ---------- 5-1. 이번 메시지에 새로 생긴 점과 선 ----------
// 연결 그래프가 다음 메시지까지 표시한다(viewer/template.html의 D.turn). 점과 선 이름은 그래프와 같게 짓는다:
// 점은 문서 경로, 바깥 문서는 '@' + 대상. 선은 두 끝을 정렬해 '|'로 잇는다. 필터와 상관없이 원래 데이터로 견준다
const turnKey = (a, b) => [a, b].sort().join('|');
const turnIds = new Set(docs.map((d) => d.path));
for (const e of extEdges) turnIds.add('@' + e.target);
const turnKeys = new Set();
for (const e of edges) if (e.from !== e.to) turnKeys.add(turnKey(e.from, e.to));
for (const e of extEdges) turnKeys.add(turnKey(e.from, '@' + e.target));
const turn = turnNew(CFG, turnIds, turnKeys);

// ---------- 6. 쓰기 ----------
const builtAt = Date.now();
// 웹에서 고친 기록 (serve.mjs가 쓴다). 최근 50건만 싣는다.
let edits = [];
try {
  edits = fs.readFileSync(EDIT_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse().slice(0, 50);
} catch { edits = []; }
// 홈 뷰어 주소: 모양 3 프로젝트의 "나" 자리에 링크로 보인다. 홈 설정을 못 읽으면 url은 null
const homeCfg = V3_PROJECT && USER.home ? loadConfig(USER.home) : null;
const homeLink = V3_PROJECT ? { label: '홈', url: homeCfg ? 'http://127.0.0.1:' + homeCfg.port : null } : null;
// 모양 4 자리 폴더(lib/layout.mjs slotFolders): 그래프가 문서가 없는 자리도 빈 클러스터로 그린다. README.md는 세지 않는다
const slots = slotFolders(CFG).filter((f) => fs.existsSync(path.join(DOCS, ...f.split('/'))))
  .map((f) => ({ folder: f, count: docs.filter((d) => d.path.startsWith(f + '/') && !/(^|\/)README\.md$/i.test(d.path)).length }));

const data = {
  slots,
  builtAt, prevBuiltAt: prev ? prev.builtAt : null, root: path.basename(ROOT), docs, edges, objects, changes, edits, turn,
  mode: CFG.mode || 'project', schema: CFG.schema ?? null, home: homeLink, externals: [...externals.values()], extEdges, extTitles, extTexts, extFms,
};
const json = JSON.stringify(data).replace(/</g, '\\u003c');
fs.mkdirSync(OUT_DIR, { recursive: true });
if (DATA_ONLY) fs.writeFileSync(path.join(OUT_DIR, 'data-private.json'), json);
const template = DATA_ONLY ? '' : fs.readFileSync(TEMPLATE, 'utf8');
if (!DATA_ONLY && !template.includes('__VIEWER_DATA__')) throw new Error('template.html에 __VIEWER_DATA__ 자리가 없습니다');

// 탭 제목: 프로젝트 폴더 이름을 앞에 둔다. 프로젝트마다 뷰어가 열려도 탭으로 가려낼 수 있고, 탭이 좁아지면 뒤쪽이 잘리기 때문이다
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pageTitle = data.root ? escHtml(data.root) + ' · SiloRoot' : 'SiloRoot';
const ICON = path.join(here, 'brand', 'siloroot-icon-64.png');
const icon = fs.existsSync(ICON) ? 'data:image/png;base64,' + fs.readFileSync(ICON).toString('base64') : '';
const BRAND = path.join(here, 'brand');
const dataUri = (name) => { const f = path.join(BRAND, name); return fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : ''; };
// 글꼴: 함께 넣은 Pretendard 가변 전체판을 data URI로 넣는다. 파일이 없으면 PC에 깔린 글꼴을 찾는다
const FONT = path.join(here, 'fonts', 'PretendardVariable.woff2');
const fontSrc = fs.existsSync(FONT) ? "url(data:font/woff2;base64," + fs.readFileSync(FONT).toString('base64') + ") format('woff2')" : "local('Pretendard Variable'),local('Pretendard')";
if (!DATA_ONLY && !fs.existsSync(FONT)) console.log('글꼴 파일이 없어 PC에 깔린 Pretendard를 찾습니다: ' + FONT);
if (!DATA_ONLY) fs.writeFileSync(OUT_HTML, template.split('__PAGE_TITLE__').join(pageTitle).split('__FONT_PRETENDARD_SRC__').join(fontSrc).split('__BRAND_ICON__').join(icon).split('__BRAND_WORDMARK_DARK__').join(dataUri('siloroot-wordmark-dark-56.png')).split('__BRAND_WORDMARK__').join(dataUri('siloroot-wordmark-56.png')).split('__VIEWER_DATA__').join(json));
if (!KEEP_SNAPSHOT || !prev) {
  const snapFiles = {};
  for (const d of docs) snapFiles[d.path] = { hash: hash(d.text), text: d.text };
  fs.writeFileSync(SNAP, JSON.stringify({ builtAt, files: snapFiles }));
}

timer.set({ docs: docs.length });
const changed = changes.added.length + changes.modified.length + changes.removed.length;
console.log(`문서 ${docs.length}개, 연결 ${edges.length}개 (경로 글자 ${edges.filter((e) => e.kind === 'code').length}개, related ${edges.filter((e) => e.kind === 'prop').length}개)`);
console.log(`객체: 질문 ${objects.questions.length}, 주장 ${objects.claims.length}, 아이디어 ${objects.ideas.length}, 공부 노트 ${objects.study.length}, 속성 분류 ${objects.typed.length}`);
console.log(changes.first ? '처음 생성이라 비교 기준이 없습니다.' : `지난 생성 뒤 바뀐 문서 ${changed}개`);
console.log(`속성 점검: 경고 ${issues.length}개`);
for (const x of issues) console.log(`  - ${x.doc}: ${x.msg}`);
console.log(DATA_ONLY ? '데이터: ' + path.join(OUT_DIR, 'data-private.json') : '뷰어: ' + OUT_HTML);
