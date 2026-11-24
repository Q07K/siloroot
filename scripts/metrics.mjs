#!/usr/bin/env node
// 쌓인 사용 기록(.siloroot/state/metrics.jsonl)을 단계별로 모아 어디서 시간과 토큰을 가장 많이 쓰는지 보여 준다.
// 실행: node scripts/metrics.mjs [프로젝트 폴더] [--days N] [--json]
//   --days N : 최근 N일 기록만 본다.
//   --json   : 표 대신 모은 값을 JSON으로 낸다.
// 토큰 칸
//   작업 토큰 = 입력 + 출력 + 캐시 쓰기 (서브에이전트 포함). 단계를 비교하는 기준이다.
//   캐시 읽기 = 응답마다 앞 대화를 다시 읽는 양. 대화가 길수록 커져서 단계 비교를 가리므로 따로 둔다.
// 턴의 단계는 그 턴에 쓴 siloroot 스킬로 정한다(턴 전체를 그 스킬에 넣는다). 스킬 없이 .siloroot/ 파일을 다룬 턴은 turn:siloroot-docs, 나머지는 turn:other.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { readMetrics } from '../lib/metrics.mjs';

const TK = ['input', 'output', 'cacheRead', 'cacheWrite', 'calls'];
const zero = () => Object.fromEntries(TK.map((k) => [k, 0]));
const addTo = (a, b) => { if (b) for (const k of TK) a[k] += Number(b[k]) || 0; };
const work = (t) => t.input + t.output + t.cacheWrite;
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

export function aggregate(records, { days } = {}) {
  const since = days ? Date.now() - days * 86400000 : 0;
  const stages = {};
  let first = null; let last = null;
  const context = [];
  const seenTurns = new Set();
  for (const r of records) {
    if (!r || typeof r.stage !== 'string') continue;
    // 위치 파일을 잃어 같은 턴을 다시 남긴 경우를 대비해 세션과 시작 시각이 같은 턴은 한 번만 센다
    if (r.kind === 'turn' && r.session && r.start) {
      const key = r.session + '|' + r.start + '|' + (r.cont ? 'c' : 't');
      if (seenTurns.has(key)) continue;
      seenTurns.add(key);
    }
    const at = Date.parse(r.end || r.start);
    if (since && !(at >= since)) continue;
    if (Number.isFinite(at)) { if (first === null || at < first) first = at; if (last === null || at > last) last = at; }
    if (r.kind === 'context') { if (Number.isFinite(r.chars)) context.push(r.chars); continue; }
    // 스킬을 부른 뒤 이어진 문답 턴(after)은 따로 묶는다. 예: turn:siloroot-docs (siloroot:note 뒤)
    const name = r.kind === 'turn' && r.after ? `${r.stage} (${r.after} 뒤)` : r.stage;
    const s = stages[name] || (stages[name] = { stage: name, kind: r.kind, count: 0, totalMs: 0, durations: [], fails: 0, tokens: zero(), sub: zero(), toolMs: {}, tools: {}, chars: [] });
    const isCont = r.kind === 'turn' && r.cont;
    s.count += r.kind === 'turn' ? (Number.isFinite(r.turns) ? r.turns : isCont ? 0 : 1) : 1;
    if (Number.isFinite(r.ms)) { s.totalMs += r.ms; if (!isCont) s.durations.push(r.ms); }
    if (r.ok === false) s.fails += 1;
    addTo(s.tokens, r.tokens);
    addTo(s.sub, r.sub);
    for (const [k, v] of Object.entries(r.toolMs || {})) s.toolMs[k] = (s.toolMs[k] || 0) + v;
    for (const [k, v] of Object.entries(r.tools || {})) s.tools[k] = (s.tools[k] || 0) + v;
    if (Number.isFinite(r.chars)) s.chars.push(r.chars);
  }
  const list = Object.values(stages).map((s) => {
    const all = zero(); addTo(all, s.tokens); addTo(all, s.sub);
    return {
      stage: s.stage,
      kind: s.kind,
      count: s.count,
      totalMs: s.totalMs,
      avgMs: s.count ? Math.round(s.totalMs / s.count) : 0,
      p90Ms: pct(s.durations, 90),
      maxMs: s.durations.length ? Math.max(...s.durations) : 0,
      fails: s.fails,
      workTokens: work(all),
      avgWorkTokens: s.count ? Math.round(work(all) / s.count) : 0,
      tokens: s.tokens,
      sub: s.sub,
      toolMs: s.toolMs,
      tools: s.tools,
      avgChars: s.chars.length ? Math.round(s.chars.reduce((a, b) => a + b, 0) / s.chars.length) : null,
    };
  });
  const turns = list.filter((x) => x.kind === 'turn').sort((a, b) => b.workTokens - a.workTokens);
  const runs = list.filter((x) => x.kind !== 'turn').sort((a, b) => b.totalMs - a.totalMs);
  const byTime = [...list].sort((a, b) => b.totalMs - a.totalMs)[0] || null;
  const byTokens = turns[0] || null;
  return {
    from: first !== null ? new Date(first).toISOString() : null,
    to: last !== null ? new Date(last).toISOString() : null,
    turns,
    runs,
    top: { time: byTime ? byTime.stage : null, tokens: byTokens && byTokens.workTokens ? byTokens.stage : null },
    alwaysLoadedChars: context.length ? context[context.length - 1] : null,
  };
}

const fmtMs = (v) => (v < 1000 ? `${v}ms` : v < 60000 ? `${(v / 1000).toFixed(1)}초` : `${Math.floor(v / 60000)}분 ${Math.round((v % 60000) / 1000)}초`);
const fmtTk = (v) => (v < 1000 ? String(v) : v < 1e6 ? `${(v / 1000).toFixed(1)}k` : `${(v / 1e6).toFixed(2)}M`);
const width = (s) => [...String(s)].reduce((n, ch) => n + (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1), 0);
const pad = (s, w, right) => { const g = ' '.repeat(Math.max(0, w - width(s))); return right ? g + s : s + g; };

function table(head, rows, rightFrom = 1) {
  const ws = head.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i]))));
  const line = (r) => r.map((c, i) => pad(String(c), ws[i], i >= rightFrom)).join('  ').trimEnd();
  return [line(head), ...rows.map(line)].join('\n');
}

const topTools = (o, n = 3) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${fmtMs(v)}`).join(', ') || '-';

export function render(agg) {
  const out = [];
  const turnCount = agg.turns.reduce((n, x) => n + x.count, 0);
  const runCount = agg.runs.reduce((n, x) => n + x.count, 0);
  if (!turnCount && !runCount) return '아직 쌓인 사용 기록이 없습니다 (.siloroot/state/metrics.jsonl).';
  out.push(`SiloRoot 사용 기록: 턴 ${turnCount}개, 스크립트·훅 ${runCount}번 (${(agg.from || '').slice(0, 10)} ~ ${(agg.to || '').slice(0, 10)})`);
  if (agg.top.time) out.push(`시간을 가장 많이 쓴 단계: ${agg.top.time}`);
  if (agg.top.tokens) out.push(`토큰을 가장 많이 쓴 단계: ${agg.top.tokens}`);
  if (agg.alwaysLoadedChars !== null) out.push(`매 턴 불러오는 SiloRoot 규칙 문서(CLAUDE.md, profile.md): ${agg.alwaysLoadedChars.toLocaleString('en-US')}자`);
  if (agg.turns.length) {
    out.push('', '턴 (작업 토큰 = 입력 + 출력 + 캐시 쓰기, 서브에이전트 포함. 캐시 읽기는 대화 길이를 따라 커져서 따로 둔다)');
    out.push(table(
      ['단계', '횟수', '합계 시간', '평균', 'p90', '작업 토큰', '평균 작업', '출력', '캐시 읽기', '응답 수', '서브에이전트', '도구 시간 상위'],
      agg.turns.map((x) => [x.stage, x.count, fmtMs(x.totalMs), fmtMs(x.avgMs), fmtMs(x.p90Ms), fmtTk(x.workTokens), fmtTk(x.avgWorkTokens),
        fmtTk(x.tokens.output + x.sub.output), fmtTk(x.tokens.cacheRead + x.sub.cacheRead), x.tokens.calls + x.sub.calls, fmtTk(work(x.sub)), topTools(x.toolMs)]),
    ));
  }
  if (agg.runs.length) {
    out.push('', '스크립트와 훅');
    out.push(table(
      ['단계', '횟수', '합계 시간', '평균', 'p90', '최대', '실패', '알림 글자(평균)'],
      agg.runs.map((x) => [x.stage, x.count, fmtMs(x.totalMs), fmtMs(x.avgMs), fmtMs(x.p90Ms), fmtMs(x.maxMs), x.fails, x.avgChars === null ? '-' : x.avgChars]),
    ));
  }
  return out.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const di = args.indexOf('--days');
  const days = di >= 0 ? Number(args[di + 1]) || undefined : undefined;
  const root = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--days') || process.cwd();
  const cfg = loadConfig(root);
  if (!cfg) { console.error('SiloRoot 폴더가 아닙니다 (.siloroot/config.json이 없음): ' + path.resolve(root)); process.exit(1); }
  const agg = aggregate(readMetrics(cfg.stateDir), { days });
  console.log(args.includes('--json') ? JSON.stringify(agg, null, 2) : render(agg));
}
