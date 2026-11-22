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

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
// 비교 기준(이전 상태)은 사용자가 "다 확인했어요"를 눌렀을 때(--seen)만 새로 잡는다.
// 그래야 AI가 점검하려고 실행해도 "최근 바뀐 것"이 지워지지 않는다. --keep-snapshot은 예전 이름이라 그냥 받아 둔다.
const KEEP_SNAPSHOT = !args.includes('--seen');
// 폴더는 인자, VIEWER_ROOT 환경 변수, 지금 폴더 순으로 정한다.
const ROOT = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seen-path') || process.env.VIEWER_ROOT || process.cwd());
const CFG = loadConfig(ROOT) || { dirs: { ...DEFAULT_DIRS }, stateDir: path.join(ROOT, '.siloroot', 'state') };
const DIRS = CFG.dirs;
const EDIT_LOG = path.join(CFG.stateDir, 'web-edits.jsonl');
const OUT_DIR = CFG.stateDir;
const OUT_HTML = path.join(OUT_DIR, 'viewer-private.html');
const SNAP = path.join(OUT_DIR, 'snapshot-private.json');
const TEMPLATE = path.join(here, 'template.html');
const MAX_FILE = 2 * 1024 * 1024;

// ---------- 1. 문서 찾기 ----------
// 점(.)이나 밑줄(_)로 시작하는 폴더는 설정이나 임시 작업 폴더라 건너뛴다.
function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith('.') || ent.name.startsWith('_') || ent.name === 'node_modules') continue;
    if (ent.isSymbolicLink()) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(md|markdown)$/i.test(ent.name)) out.push(full);
  }
  return out;
}

const toRel = (full) => path.relative(ROOT, full).split(path.sep).join('/');

const files = walk(ROOT, []).filter((f) => fs.statSync(f).size <= MAX_FILE);
const mdSet = new Set(files.map(toRel));
const dirSet = new Set();
const byBase = new Map();
for (const rel of mdSet) {
  const parts = rel.split('/');
  for (let k = 1; k < parts.length; k++) dirSet.add(parts.slice(0, k).join('/'));
  const base = parts[parts.length - 1].toLowerCase();
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(rel);
}

// ---------- 2. 링크 해석 ----------
// mode 'link': 마크다운 링크. 문서 기준 상대 경로를 먼저 본다.
// mode 'code': 백틱 안의 경로 글자. 폴더 맨 위 기준을 먼저 본다(이 폴더 문서들이 그렇게 쓴다).
function resolveTarget(raw, fromRel, mode) {
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

function extractLinks(text, rel) {
  const body = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*```[\s\S]*?^\s*```/gm, '');
  const links = [];
  const linkMap = {};
  const add = (raw, kind) => {
    const target = resolveTarget(raw, rel, kind);
    if (!target) return;
    linkMap[raw] = target;
    if (target !== rel) links.push({ to: target, kind });
  };
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) add(m[1], 'link');
  for (const m of body.matchAll(/`([^`\n]+)`/g)) add(m[1], 'code');
  return { links, linkMap };
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
  const { links, linkMap } = extractLinks(text, rel);
  return {
    path: rel,
    folder: rel.includes('/') ? rel.split('/')[0] : '(맨 위)',
    title: titleOf(text, rel, fm),
    mtime: Math.round(st.mtimeMs),
    size: st.size,
    fm,
    text,
    hash: crypto.createHash('sha256').update(text).digest('hex'),
    linkMap,
    _links: links,
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const edges = [];
for (const d of docs) {
  const seen = new Set();
  for (const l of d._links) {
    const key = l.to + '|' + l.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: d.path, to: l.to, kind: l.kind });
  }
  delete d._links;
}

// ---------- 3-1. 속성 점검과 related 연결 ----------
// 약속은 metadata-guide.md에 있다. 값을 바꾸면 두 곳을 같이 고친다.
const VOCAB = {
  // 객체 종류
  idea: ['아이디어', '진행 중', '보류', '접음', '완료'],
  study: ['검증 전', '부분', '통과'],
  decision: ['제안', '확정', '바뀜'],
  project: ['진행 중', '보류', '완료'],
  // 문서 종류
  guide: ['사용 중', '보관'],
  index: ['사용 중', '보관'],
  ledger: ['사용 중', '보관'],
  log: ['사용 중', '끝남'],
  note: ['사용 중', '보관'],
  // 뷰어에서 생기는 객체
  feedback: ['대기', '진행 중', '완료', '안 함'],
  rule: ['제안', '승인', '거절', '반영'],
};
// 폴더마다 정해진 type. 여기 없는 폴더도 type 자체는 모두 필수다.
const REQUIRED = [
  { prefix: DIRS.ideas + '/', type: ['idea', 'decision'], skip: /(^|\/)README\.md$/i },
  { prefix: DIRS.study + '/', type: 'study', skip: /(^|\/)README\.md$/i },
  { prefix: DIRS.feedback + '/', type: ['feedback', 'rule'], skip: /(^|\/)README\.md$/i },
];
const typeOk = (req, t) => (Array.isArray(req.type) ? req.type.includes(t) : req.type === t);
const EXEMPT = () => false;
const issues = [];
for (const d of docs) {
  const fm = d.fm || {};
  const warn = (msg) => issues.push({ doc: d.path, msg });
  const rel = fm.related ? (Array.isArray(fm.related) ? fm.related : [fm.related]) : [];
  d.related = [];
  for (const r of rel) {
    const t = resolveTarget(r, d.path, 'code');
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
  const readme = get(DIRS.study + '/README.md');
  const level = {};
  if (readme) {
    for (const m of readme.text.matchAll(/^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|/gm)) {
      level[DIRS.study + '/' + m[2].trim()] = { first: m[3].trim(), level: m[4].trim() };
    }
  }
  return docs
    .filter((d) => d.path.startsWith(DIRS.study + '/') && !/README\.md$/i.test(d.path))
    .map((d) => {
      const row = level[d.path] || {};
      const fmStatus = d.fm && d.fm.status ? String(d.fm.status) : '';
      if (fmStatus && row.level && fmStatus !== row.level) issues.push({ doc: d.path, msg: 'status "' + fmStatus + '"와 ' + DIRS.study + '/README.md의 이해도 "' + row.level + '"가 다름' });
      return { title: d.title, doc: d.path, level: fmStatus || row.level || '', first: (d.fm && d.fm.created) || row.first || '' };
    });
}

const objects = {
  questions: parseQuestions(get(DIRS.log + '/open-questions.md')),
  claims: [],
  ideas: docs
    .filter((d) => d.path.startsWith(DIRS.ideas + '/') && !/README\.md$/i.test(d.path) && !(d.fm && d.fm.type === 'decision'))
    .map((d) => ({ title: d.title, doc: d.path, status: (d.fm && d.fm.status ? String(d.fm.status) : ((d.text.match(/^-\s*상태:\s*(.+)$/m) || [])[1] || '')).trim() })),
  study: parseStudy(),
  typed: docs.filter((d) => d.fm && d.fm.type).map((d) => ({ title: d.title, doc: d.path, type: String(d.fm.type), status: d.fm.status ? String(d.fm.status) : '' })),
  issues,
};

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

// ---------- 6. 쓰기 ----------
const builtAt = Date.now();
// 웹에서 고친 기록 (serve.mjs가 쓴다). 최근 50건만 싣는다.
let edits = [];
try {
  edits = fs.readFileSync(EDIT_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).reverse().slice(0, 50);
} catch { edits = []; }
const data = { builtAt, prevBuiltAt: prev ? prev.builtAt : null, root: path.basename(ROOT), docs, edges, objects, changes, edits };
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const template = fs.readFileSync(TEMPLATE, 'utf8');
if (!template.includes('__VIEWER_DATA__')) throw new Error('template.html에 __VIEWER_DATA__ 자리가 없습니다');

fs.mkdirSync(OUT_DIR, { recursive: true });
const ICON = path.join(here, 'brand', 'siloroot-icon-64.png');
const icon = fs.existsSync(ICON) ? 'data:image/png;base64,' + fs.readFileSync(ICON).toString('base64') : '';
const BRAND = path.join(here, 'brand');
const dataUri = (name) => { const f = path.join(BRAND, name); return fs.existsSync(f) ? 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') : ''; };
fs.writeFileSync(OUT_HTML, template.split('__BRAND_ICON__').join(icon).split('__BRAND_WORDMARK_DARK__').join(dataUri('siloroot-wordmark-dark-56.png')).split('__BRAND_WORDMARK__').join(dataUri('siloroot-wordmark-56.png')).split('__VIEWER_DATA__').join(json));
if (!KEEP_SNAPSHOT || !prev) {
  const snapFiles = {};
  for (const d of docs) snapFiles[d.path] = { hash: hash(d.text), text: d.text };
  fs.writeFileSync(SNAP, JSON.stringify({ builtAt, files: snapFiles }));
}

const changed = changes.added.length + changes.modified.length + changes.removed.length;
console.log(`문서 ${docs.length}개, 연결 ${edges.length}개 (경로 글자 ${edges.filter((e) => e.kind === 'code').length}개, related ${edges.filter((e) => e.kind === 'prop').length}개)`);
console.log(`객체: 질문 ${objects.questions.length}, 주장 ${objects.claims.length}, 아이디어 ${objects.ideas.length}, 공부 노트 ${objects.study.length}, 속성 분류 ${objects.typed.length}`);
console.log(changes.first ? '처음 생성이라 비교 기준이 없습니다.' : `지난 생성 뒤 바뀐 문서 ${changed}개`);
console.log(`속성 점검: 경고 ${issues.length}개`);
for (const x of issues) console.log(`  - ${x.doc}: ${x.msg}`);
console.log('뷰어: ' + OUT_HTML);
