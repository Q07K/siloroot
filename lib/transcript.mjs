// Claude Code 대화 기록(JSONL)을 읽어 턴(사용자 메시지 하나와 그 응답 전체)별 시간과 토큰을 센다.
// 기록의 assistant 줄마다 message.usage(입력, 출력, 캐시 읽기, 캐시 쓰기 토큰)가 있다.
// 응답 하나가 여러 줄(내용 블록마다 한 줄)로 나뉘어도 usage는 같은 값이 되풀이되므로 message.id로 한 번만 센다.
// 여기서 돌려주는 값에는 숫자, 시각, 도구 이름, siloroot 스킬 이름만 들어간다. 프롬프트나 경로는 꺼내지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { costOf } from './pricing.mjs';
import { entriesFromHook } from './trail.mjs';
import { slotOf } from './layout.mjs';
import { readUser } from './user.mjs';

// 문서 세기 (shared/decisions/metrics-count-by-slot.md). 문서인지, 읽었는지 고쳤는지는 흔적(lib/trail.mjs)과 같은 기준으로 가른다.
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const FILE_TOOLS = new Set(['Read', ...EDIT_TOOLS]);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
// 다른 SiloRoot 작업 공간의 문서(.siloroot/ 안의 .md, 상태 폴더 빼고). 자리는 other로 센다
const OTHER_DOC = /[\\/]\.siloroot[\\/](?!state[\\/]).*\.md$/i;
// 명령에 문서 경로는 없지만 문서 폴더를 다룬다(스크립트로 읽고 고침). 상태 폴더와 설정 파일만 다루면 뺀다
const DOCS_WORD = /\.siloroot(?!\/+(state|config\.json)\b)/;
const norm = (p) => String(p).replace(/\\+/g, '/').replace(/\/+$/, '').toLowerCase();
const msys = (p) => p.replace(/^([a-z]):\//, '/$1/');

function docWatcher(cfg) {
  const roots = [];
  const home = (cfg.schema ?? 0) >= 3 ? readUser().home : null;
  for (const r of [home, cfg.mode === 'home' ? cfg.docsRoot : null]) if (r) roots.push(norm(r), msys(norm(r)));
  const inside = (file, cwd) => {
    const abs = norm(path.resolve(cwd || cfg.root, String(file)));
    return [norm(cfg.docsRoot), ...roots].some((r) => abs === r || abs.startsWith(r + '/'));
  };
  // 도구 호출 하나를 본다: 문서 목록(흔적 꼴 경로), 코드 수정인지, 스크립트로 문서를 다뤘는지
  return (name, input, cwd) => {
    const list = entriesFromHook(cfg, { tool_name: name, tool_input: input, cwd });
    const fp = input.file_path || input.notebook_path;
    if (!list.length && FILE_TOOLS.has(name) && typeof fp === 'string' && OTHER_DOC.test(fp)) {
      list.push({ kind: name === 'Read' ? 'read' : 'edit', path: 'ext:' + norm(fp), other: true });
    }
    const code = !list.length && EDIT_TOOLS.has(name) && typeof fp === 'string' && !inside(fp, cwd);
    let script = false;
    if (!list.length && SHELL_TOOLS.has(name)) {
      const t = norm(JSON.stringify(input.command ?? input));
      script = DOCS_WORD.test(t) || roots.some((r) => t.includes(r));
    }
    return { list, code, script };
  };
}

const countBy = (cfg, docs) => {
  const out = {};
  for (const [p, other] of docs) { const k = other ? 'other' : slotOf(cfg, p); out[k] = (out[k] || 0) + 1; }
  return out;
};

const COMMAND = /<command-name>\/?(siloroot:[\w-]+)<\/command-name>/;
// microUsd: API 정가 환산 값(마이크로달러), microUsdRead: 그 가운데 캐시 읽기 몫, unpriced: 값을 매기지 못한 응답 수 (lib/pricing.mjs)
const zeroTokens = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, microUsd: 0, microUsdRead: 0, unpriced: 0 });
const ms = (ts) => { const t = Date.parse(ts); return Number.isFinite(t) ? t : null; };

// 사용자가 직접 보낸 메시지(슬래시 명령 포함)인가. 도구 결과, 스킬 본문 같은 메타 줄, 압축 요약은 아니다.
export function isPrompt(e) {
  if (!e || e.type !== 'user' || e.isSidechain || e.isMeta || e.isCompactSummary) return false;
  const c = e.message && e.message.content;
  if (typeof c === 'string') return true;
  if (Array.isArray(c)) return c.some((b) => b && b.type === 'text') && !c.some((b) => b && b.type === 'tool_result');
  return false;
}

const promptText = (e) => {
  const c = e.message.content;
  return typeof c === 'string' ? c : c.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n');
};

// MCP 도구 이름에는 서버 id가 들어가므로 하나로 묶는다.
export const toolName = (n) => (typeof n !== 'string' ? 'other' : n.startsWith('mcp__') ? 'mcp' : /^[A-Za-z][\w-]{0,40}$/.test(n) ? n : 'other');

// 도구 결과의 글자 수. 글은 길이를 세고, 그림 같은 글 아닌 블록은 세지 않는다.
export function resultLength(c) {
  if (typeof c === 'string') return c.length;
  if (!Array.isArray(c)) return 0;
  let n = 0;
  for (const b of c) if (b && b.type === 'text' && typeof b.text === 'string') n += b.text.length;
  return n;
}

export function addUsage(t, u, model) {
  if (!u) return;
  const c = costOf(model, u);
  if (c) { t.microUsd += c.micro; t.microUsdRead += c.microRead; } else t.unpriced += 1;
  t.input += Number(u.input_tokens) || 0;
  t.output += Number(u.output_tokens) || 0;
  t.cacheRead += Number(u.cache_read_input_tokens) || 0;
  t.cacheWrite += Number(u.cache_creation_input_tokens) || 0;
  t.calls += 1;
}

// entries: 대화 기록 줄을 JSON.parse 한 것(순서대로).
// opts.seenIds: 이미 센 message.id (Set, 이 함수가 더한다). 앞 실행과 경계에 걸친 응답을 두 번 세지 않게 한다.
// opts.prevStage, opts.prevEnd: 앞 실행이 마지막으로 남긴 턴. 첫 사용자 메시지보다 앞에 있는 줄(늦게 쓰인 꼬리)을 이어 붙일 때 쓴다.
// opts.prevSkill: 이 세션에서 마지막으로 쓴 siloroot 스킬. note, verify처럼 여러 턴 이어지는 문답에서
//   스킬을 부른 턴 뒤의 턴은 스킬 이름이 다시 나오지 않으므로, .siloroot/를 다룬 턴에 after로 붙여 이어진 턴임을 남긴다.
// opts.cfg: 작업 공간 설정(loadConfig). 있으면 문서를 흔적과 같은 기준으로 가르고 아래 자리별 칸을 더한다. 없으면 입력에 .siloroot 글자가 있는지로 본다.
// 돌려주는 턴: { start, end, ms, cont, stage, tokens, tools, toolMs, resultChars, docChars, skills, touched, after, (cfg가 있으면) docReads, docEdits, codeEdits, docScripts }
//   resultChars: 도구 이름별로 도구 결과가 맥락에 들여온 글자 수. 조회에 드는 몫을 본다(내용은 꺼내지 않고 길이만 센다).
//   docChars: 그 가운데 문서를 다룬 도구 호출(SiloRoot 문서 조회, 검색, 수정)의 결과 글자 수.
//   docReads, docEdits: 자리 이름(lib/layout.mjs slotOf)별로 참고로 읽은 문서 수, 고친 문서 수. 턴 안에서 같은 문서는 한 번. 경로는 남기지 않는다.
//   codeEdits: 문서 밖 파일을 고친 도구 호출 수. docScripts: 문서 경로 없이 문서 폴더를 다룬 명령 수(스크립트로 읽고 고침, 문서별로 가르지 못함).
// 배열의 lastSkill에 이 실행이 끝났을 때의 마지막 스킬을 둔다.
export function splitTurns(entries, { seenIds = new Set(), prevStage = null, prevEnd = null, prevSkill = null, cfg = null } = {}) {
  const turns = [];
  const watch = cfg ? docWatcher(cfg) : null;
  const pending = new Map(); // tool_use id → { name, t, doc }
  let cur = null;
  const newTurn = (startTs, cont) => ({ startTs, endTs: startTs, cont, tokens: zeroTokens(), tools: {}, toolMs: {}, resultChars: {}, docChars: 0, skills: new Set(), touched: false, reads: new Map(), edits: new Map(), codeEdits: 0, docScripts: 0 });

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const t = ms(e.timestamp);
    if (isPrompt(e)) {
      cur = newTurn(t, false);
      turns.push(cur);
      const m = promptText(e).match(COMMAND);
      if (m) cur.skills.add(m[1]);
      continue;
    }
    // 제목, 대기열, 첨부 같은 줄은 나중에(세션을 다시 열 때 등) 쓰일 수 있어 턴의 끝 시각을 늘리지 않게 건너뛴다.
    if (e.isSidechain || (e.type !== 'assistant' && e.type !== 'user')) continue;
    if (!cur) {
      cur = newTurn(ms(prevEnd) ?? t, true);
      turns.push(cur);
    }
    if (t !== null && (cur.endTs === null || t > cur.endTs)) cur.endTs = t;
    if (cur.startTs === null) cur.startTs = t;

    if (e.type === 'assistant' && e.message) {
      const id = e.message.id;
      if (e.message.model !== '<synthetic>' && id && !seenIds.has(id)) { seenIds.add(id); addUsage(cur.tokens, e.message.usage, e.message.model); }
      for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
        if (!b || b.type !== 'tool_use') continue;
        const name = toolName(b.name);
        cur.tools[name] = (cur.tools[name] || 0) + 1;
        const input = b.input || {};
        if (b.name === 'Skill' && typeof input.skill === 'string' && input.skill.startsWith('siloroot:')) cur.skills.add(input.skill);
        let s = '';
        try { s = JSON.stringify(input); } catch { s = ''; }
        let doc;
        if (watch) {
          const w = watch(b.name, input, e.cwd);
          for (const x of w.list) (x.kind === 'read' ? cur.reads : cur.edits).set(x.path, !!x.other);
          if (w.code) cur.codeEdits += 1;
          if (w.script) cur.docScripts += 1;
          doc = w.list.length > 0 || w.script;
        } else {
          doc = s.includes('.siloroot');
        }
        if (doc) cur.touched = true;
        if (b.id) pending.set(b.id, { name, t, doc });
      }
    } else if (e.type === 'user' && Array.isArray(e.message && e.message.content)) {
      for (const b of e.message.content) {
        if (!b || b.type !== 'tool_result') continue;
        const p = pending.get(b.tool_use_id);
        if (!p) continue;
        pending.delete(b.tool_use_id);
        if (p.t !== null && t !== null && t >= p.t) cur.toolMs[p.name] = (cur.toolMs[p.name] || 0) + (t - p.t);
        const len = resultLength(b.content);
        cur.resultChars[p.name] = (cur.resultChars[p.name] || 0) + len;
        if (p.doc) cur.docChars += len;
      }
    }
  }

  let lastSkill = prevSkill;
  const out = turns
    .filter((x) => x.tokens.calls > 0 || Object.keys(x.tools).length > 0)
    .map((x) => {
      const skills = [...x.skills].sort();
      const after = !x.cont && !skills.length && x.touched ? lastSkill : null;
      if (x.skills.size) lastSkill = [...x.skills].pop();
      const stage = x.cont ? (prevStage || 'turn:other')
        : skills.length ? 'turn:' + skills.join('+')
          : x.touched ? 'turn:siloroot-docs' : 'turn:other';
      return {
        start: x.startTs !== null ? new Date(x.startTs).toISOString() : undefined,
        end: x.endTs !== null ? new Date(x.endTs).toISOString() : undefined,
        ms: x.startTs !== null && x.endTs !== null ? Math.max(0, x.endTs - x.startTs) : undefined,
        cont: x.cont,
        stage,
        tokens: x.tokens,
        tools: x.tools,
        toolMs: x.toolMs,
        resultChars: x.resultChars,
        docChars: x.docChars,
        skills,
        touched: x.touched,
        after: after || undefined,
        ...(cfg ? {
          // 참고 읽기: 같은 턴에 고친 문서는 뺀다(Edit은 고치기 전에 읽어야 해서 읽기가 늘 붙는다)
          docReads: countBy(cfg, [...x.reads].filter(([p]) => !x.edits.has(p))),
          docEdits: countBy(cfg, [...x.edits]),
          codeEdits: x.codeEdits,
          docScripts: x.docScripts,
        } : {}),
      };
    });
  out.lastSkill = lastSkill;
  return out;
}

// 서브에이전트(Agent 도구) 기록은 본 기록 옆 폴더 <세션 id>/subagents/agent-*.jsonl에 따로 있다.
// 시각이 [from, to] 안인 응답의 토큰을 더한다. 끝난 턴 밖에서 돈 배경 에이전트 토큰은 빠질 수 있다.
export function subagentUsage(transcriptPath, from, to) {
  const t = zeroTokens();
  const a = ms(from); const b = ms(to);
  if (a === null || b === null) return t;
  const dir = path.join(transcriptPath.replace(/\.jsonl$/i, ''), 'subagents');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { return t; }
  for (const f of files) {
    const full = path.join(dir, f);
    try { if (fs.statSync(full).mtimeMs < a) continue; } catch { continue; }
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
    const seen = new Set();
    for (const l of text.split('\n')) {
      if (!l.includes('"assistant"')) continue;
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (e.type !== 'assistant' || !e.message) continue;
      const ts = ms(e.timestamp);
      if (ts === null || ts < a || ts > b) continue;
      const id = e.message.id;
      if (!id || seen.has(id) || e.message.model === '<synthetic>') continue;
      seen.add(id);
      addUsage(t, e.message.usage, e.message.model);
    }
  }
  return t;
}
