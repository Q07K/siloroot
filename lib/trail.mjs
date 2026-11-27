// 읽는 문서 흔적: AI가 한 번 답하는 동안 읽고 고친 문서를 순서대로 남기고 읽는다.
// 훅(scripts/trail.mjs)이 .siloroot/state/trail/<세션 id>.jsonl에 한 줄씩 붙이고,
// 뷰어 서버(viewer/serve.mjs)가 가장 최근에 바뀐 세션 파일을 연결 그래프로 보낸다.
// 한 줄은 {"ts", "kind", "path", "agent"}뿐이다. kind는 read 또는 edit, agent는 서브에이전트일 때만.
import fs from 'node:fs';
import path from 'node:path';
import { readUser } from './user.mjs';

const KEEP_MS = 7 * 24 * 3600 * 1000;
const READ_TOOLS = new Set(['Read']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

export const trailDir = (cfg) => path.join(cfg.stateDir, 'trail');

// 새 메시지 표: 사용자가 메시지를 보낼 때마다(resetTrail) { session, at }으로 바뀐다. 세션 흔적 파일이 없어도 쓴다.
// 뷰어 서버가 이것이 바뀐 것을 보고 그 자리에서 빌드해 "이번 메시지에 새로 생긴 점과 선"의 기준을 잡는다(viewer/build.mjs).
// 흔적 폴더 안에 두어 서버의 흔적 감시가 함께 받는다. 이름이 .jsonl이 아니라 latestTrail과 지우기에서 빠진다.
const turnFile = (cfg) => path.join(trailDir(cfg), 'turn.json');
export function readTurn(cfg) {
  try {
    const t = JSON.parse(fs.readFileSync(turnFile(cfg), 'utf8'));
    return t && typeof t.at === 'number' ? t : null;
  } catch { return null; }
}

// 이번 메시지에 새로 생긴 점과 선. ids는 지금 점(문서 경로, 바깥 문서는 '@' + 대상), keys는 지금 선(두 끝을 정렬해 '|'로 이은 것)이다.
// 새 메시지 표가 바뀐 뒤 처음 불리면 지금 것을 기준(state/turn-base.json)으로 잡는다. 그 뒤로는 기준에 없는 것을 돌려준다.
// 표가 없으면(옛 훅, 흔적을 쓰지 않는 곳) null. 기준 파일을 못 쓰면 이번 것만 기준으로 삼아 아무것도 새로 치지 않는다.
export function turnNew(cfg, ids, keys) {
  const turn = readTurn(cfg);
  if (!turn) return null;
  const file = path.join(cfg.stateDir, 'turn-base.json');
  let base = null;
  try { base = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { base = null; }
  if (!base || base.at !== turn.at || !Array.isArray(base.nodes) || !Array.isArray(base.links)) {
    base = { at: turn.at, nodes: [...ids], links: [...keys] };
    try { fs.mkdirSync(cfg.stateDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(base)); } catch { /* 다음 빌드가 다시 잡는다 */ }
  }
  const bn = new Set(base.nodes), bl = new Set(base.links);
  return { at: turn.at, nodes: [...ids].filter((x) => !bn.has(x)), links: [...keys].filter((x) => !bl.has(x)) };
}

// 절대 경로나 프로젝트 맨 위 기준 경로를 문서 위치 기준 '/' 경로로 바꾼다. 문서가 아니면 null.
// 뷰어의 파일 감시(viewer/serve.mjs onChange)와 같이 '.'이나 '_'로 시작하는 폴더, node_modules, 상태 폴더는 뺀다.
// 모양 3 프로젝트는 홈 문서도 'home:<홈 기준 경로>'로 남긴다. 뷰어가 그 문서의 바깥 점에 잇는다.
export function toDocPath(cfg, file) {
  if (typeof file !== 'string' || !file) return null;
  const abs = path.resolve(cfg.root, file);
  const local = docRel(cfg.docsRoot, abs, cfg.layout === 'wrapped');
  if (local || (cfg.schema ?? 0) < 3 || cfg.mode === 'home') return local;
  const home = readUser().home;
  const inHome = home ? docRel(home, abs, false) : null;
  return inHome ? 'home:' + inHome : null;
}

function docRel(root, abs, skipState) {
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const segs = rel.split(path.sep).join('/').split('/');
  if (!/\.md$/i.test(segs[segs.length - 1])) return null;
  if (skipState && segs[0] === 'state') return null;
  if (segs.some((s) => s.startsWith('.') || s.startsWith('_') || s === 'node_modules')) return null;
  return segs.join('/');
}

// MSYS(Git Bash) 꼴 '/c/Users/…'를 'C:/Users/…'로.
const fromMsys = (p) => (process.platform === 'win32' ? p.replace(/^\/([A-Za-z])\//, (_, d) => `${d.toUpperCase()}:/`) : p);

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Bash 명령 문자열에서 실제로 있는 문서 경로를 처음 나온 순서로 찾는다.
// 덩어리마다 cwd, 프로젝트 맨 위, 문서 위치 순서로 붙여 보아 처음 맞는 것을 쓴다.
export function docPathsInCommand(cfg, command, cwd) {
  if (typeof command !== 'string') return [];
  const out = [];
  // 따옴표 안은 공백이 있어도 한 덩어리로 본다.
  const tokens = [...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s"'`;&|()<>]+)/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])
    .filter((t) => /\.md$/i.test(t));
  const bases = [cwd, cfg.root, cfg.docsRoot].filter((b) => typeof b === 'string' && b);
  for (const raw of tokens) {
    const tok = fromMsys(raw);
    // 실제로 있는 첫 파일에서 멈춘다. 그 파일이 문서가 아니면(예: 프로젝트 맨 위의 CLAUDE.md) 문서 위치의 같은 이름 파일로 넘어가지 않는다
    for (const base of path.isAbsolute(tok) ? [cfg.root] : bases) {
      const abs = path.resolve(base, tok);
      if (!isFile(abs)) continue;
      const doc = toDocPath(cfg, abs);
      if (doc && !out.includes(doc)) out.push(doc);
      break;
    }
  }
  return out;
}

// Codex는 패치 전체를 command에 넣는다. 추가와 삭제 경로는 디스크에 없을 수도 있다.
function docPathsInPatch(cfg, patch, cwd) {
  if (typeof patch !== 'string' || !patch.startsWith('*** Begin Patch')) return [];
  const base = typeof cwd === 'string' && cwd ? cwd : cfg.root;
  const docs = new Set();
  for (const [, file] of patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) {
    const doc = toDocPath(cfg, path.resolve(base, fromMsys(file.trim())));
    if (doc) docs.add(doc);
  }
  return [...docs];
}

// 훅 입력 하나를 흔적 줄로 바꾼다.
export function entriesFromHook(cfg, input) {
  if (!input || typeof input !== 'object') return [];
  const tool = input.tool_name;
  const ti = input.tool_input || {};
  let list = [];
  if (READ_TOOLS.has(tool) || EDIT_TOOLS.has(tool)) {
    const doc = toDocPath(cfg, ti.file_path || ti.notebook_path);
    if (doc) list = [{ kind: READ_TOOLS.has(tool) ? 'read' : 'edit', path: doc }];
  } else if (tool === 'Bash') {
    list = docPathsInCommand(cfg, ti.command, input.cwd).map((p) => ({ kind: 'read', path: p }));
  } else if (tool === 'apply_patch') {
    list = docPathsInPatch(cfg, ti.command, input.cwd).map((p) => ({ kind: 'edit', path: p }));
  }
  if (input.agent_id) list = list.map((e) => ({ ...e, agent: String(input.agent_id) }));
  return list;
}

// 세션 id를 파일 이름으로 쓰므로 경로 글자가 든 값은 받지 않는다.
export function safeSession(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

const fileFor = (cfg, session) => path.join(trailDir(cfg), `${session}.jsonl`);

// 한 호출의 줄들을 쓰기 한 번으로 붙인다. 여러 훅이 함께 붙여도 줄이 섞이지 않게 한다.
export function appendTrail(cfg, session, entries, now = Date.now()) {
  if (!entries.length) return;
  fs.mkdirSync(trailDir(cfg), { recursive: true });
  const text = entries.map((e) => JSON.stringify({ ts: now, ...e }) + '\n').join('');
  fs.appendFileSync(fileFor(cfg, session), text);
}

// 새 메시지 표(turn.json)를 바꾸고, 그 세션 흔적을 비우고(파일이 없으면 만들지 않는다), 7일 넘게 안 바뀐 다른 세션 파일을 지운다.
export function resetTrail(cfg, session, now = Date.now()) {
  const dir = trailDir(cfg);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(turnFile(cfg), JSON.stringify({ session, at: now }));
  } catch { /* 표를 못 써도 흔적 비우기는 한다 */ }
  let names;
  try { names = fs.readdirSync(dir); } catch { return; }
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const file = path.join(dir, name);
    try {
      if (name === `${session}.jsonl`) fs.truncateSync(file, 0);
      else if (now - fs.statSync(file).mtimeMs > KEEP_MS) fs.unlinkSync(file);
    } catch { /* 다른 훅이 먼저 지웠으면 그만 */ }
  }
}

export function readTrail(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const items = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e.path === 'string' && (e.kind === 'read' || e.kind === 'edit')) items.push(e);
    } catch { /* 반쯤 쓰인 줄이나 깨진 줄은 건너뛴다 */ }
  }
  return items;
}

// 가장 최근에 바뀐 세션의 흔적.
export function latestTrail(cfg) {
  const dir = trailDir(cfg);
  let best = null;
  let names = [];
  try { names = fs.readdirSync(dir); } catch { /* 폴더가 아직 없다 */ }
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    try {
      const m = fs.statSync(path.join(dir, name)).mtimeMs;
      if (!best || m > best.m) best = { name, m };
    } catch { /* 지워졌다 */ }
  }
  if (!best) return { session: null, items: [] };
  return { session: best.name.slice(0, -'.jsonl'.length), items: readTrail(path.join(dir, best.name)) };
}
