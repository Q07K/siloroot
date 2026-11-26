#!/usr/bin/env node
// 쌓인 사용 기록(.siloroot/state/metrics.jsonl)을 단계별로 모아 어디서 시간과 토큰을 가장 많이 쓰는지 보여 준다.
// 실행: node scripts/metrics.mjs [프로젝트 폴더] [--days N] [--json]
//   --days N : 최근 N일 기록만 본다.
//   --json   : 표 대신 모은 값을 JSON으로 낸다.
// 토큰 칸
//   작업 토큰 = 입력 + 출력 + 캐시 쓰기 (서브에이전트 포함). 단계를 비교하는 기준이다.
//   캐시 읽기 = 응답마다 앞 대화를 다시 읽는 양. 대화가 길수록 커져서 단계 비교를 가리므로 따로 둔다.
// 도구 결과 글자 = 도구 결과(파일 읽기, 검색, 명령 출력 등)가 맥락에 들여온 글자 수. 그 가운데 문서 = .siloroot를 다룬 도구 호출의 몫.
//   조회에 드는 비용을 본다. 글자 수라 토큰 수와 같지 않다(한글은 한 글자가 대략 한 토큰 이상).
// 비용 = API 정가로 환산한 값(lib/pricing.mjs, 서브에이전트 포함). 구독 요금제의 실제 청구와는 다르고 단계끼리 견주는 상대값이다.
//   캐시 읽기 몫 = 비용 가운데 캐시 읽기의 비율. 응답(도구 호출)마다 대화 전체를 다시 읽는 값이라, 이 몫이 크면 호출 횟수를 줄이는 것이 남는다.
//   턴 표는 비용 순으로 적는다.
// 턴의 단계는 그 턴에 쓴 siloroot 스킬로 정한다(턴 전체를 그 스킬에 넣는다). 스킬 없이 .siloroot/ 파일을 다룬 턴은 turn:siloroot-docs, 나머지는 turn:other.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { readMetrics } from '../lib/metrics.mjs';

const TK = ['input', 'output', 'cacheRead', 'cacheWrite', 'calls', 'microUsd', 'microUsdRead', 'unpriced'];
const zero = () => Object.fromEntries(TK.map((k) => [k, 0]));
const addTo = (a, b) => { if (b) for (const k of TK) a[k] += Number(b[k]) || 0; };
const work = (t) => t.input + t.output + t.cacheWrite;
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };

// 턴 나눔 (shared/decisions/metrics-count-by-slot.md). 참고 문서: 작업 일지, 폴더 안내, 규칙 문서, 글쓰기 규칙을 뺀 자리
const NOT_REF = new Set(['worklog', 'log', 'index', 'rules', 'writingGuide'].flatMap((k) => [k, 'home:' + k]));
export const USE_LABELS = {
  use: '활용: 참고 문서를 읽고 코드를 고침',
  codeOnly: '코드만: 참고 문서 없이 코드를 고침',
  docWork: '문서 일: 참고 문서를 읽고 코드는 안 고침',
  recordOnly: '기록만: 참고 문서 없이 문서만 고침',
  script: '스크립트로 문서를 다룸(가르지 못함)',
  none: '문서와 코드 모두 안 건드림',
};
const addMap = (a, b) => { for (const [k, v] of Object.entries(b || {})) if (Number.isFinite(v)) a[k] = (a[k] || 0) + v; };
function useOf(t) {
  const ref = Object.entries(t.reads).some(([k, v]) => v > 0 && !NOT_REF.has(k));
  if (t.code && ref) return 'use';
  if (t.code) return 'codeOnly';
  if (ref) return 'docWork';
  if (Object.values(t.edits).some((v) => v > 0)) return 'recordOnly';
  if (t.scripts) return 'script';
  return 'none';
}

export function aggregate(records, { days } = {}) {
  const since = days ? Date.now() - days * 86400000 : 0;
  const stages = {};
  let first = null; let last = null;
  const context = [];
  const seenTurns = new Set();
  const useTurns = []; const lastTurn = new Map();
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
    if (r.kind === 'turn') {
      // 자리별 세기를 남긴 턴만 나눈다(codeEdits 칸이 있으면 새 기록). 위치를 잃고 이어진 줄(cont)은 같은 세션의 앞 턴에 더한다
      const counted = Number.isFinite(r.codeEdits);
      let u = r.cont ? lastTurn.get(r.session) : null;
      if (!u) { u = { old: true, reads: {}, edits: {}, code: 0, scripts: 0 }; useTurns.push(u); if (r.session) lastTurn.set(r.session, u); }
      if (counted) {
        u.old = false;
        addMap(u.reads, r.docReads); addMap(u.edits, r.docEdits);
        u.code += r.codeEdits; u.scripts += Number(r.docScripts) || 0;
      }
    }
    if (r.kind === 'context') { if (Number.isFinite(r.chars)) context.push(r.chars); continue; }
    // 스킬을 부른 뒤 이어진 문답 턴(after)은 따로 묶는다. 예: turn:siloroot-docs (siloroot:note 뒤)
    const name = r.kind === 'turn' && r.after ? `${r.stage} (${r.after} 뒤)` : r.stage;
    const s = stages[name] || (stages[name] = { stage: name, kind: r.kind, count: 0, totalMs: 0, durations: [], fails: 0, tokens: zero(), sub: zero(), toolMs: {}, tools: {}, resultChars: {}, docChars: 0, chars: [] });
    const isCont = r.kind === 'turn' && r.cont;
    s.count += r.kind === 'turn' ? (Number.isFinite(r.turns) ? r.turns : isCont ? 0 : 1) : 1;
    if (Number.isFinite(r.ms)) { s.totalMs += r.ms; if (!isCont) s.durations.push(r.ms); }
    if (r.ok === false) s.fails += 1;
    addTo(s.tokens, r.tokens);
    addTo(s.sub, r.sub);
    for (const [k, v] of Object.entries(r.toolMs || {})) s.toolMs[k] = (s.toolMs[k] || 0) + v;
    for (const [k, v] of Object.entries(r.tools || {})) s.tools[k] = (s.tools[k] || 0) + v;
    for (const [k, v] of Object.entries(r.resultChars || {})) s.resultChars[k] = (s.resultChars[k] || 0) + v;
    if (Number.isFinite(r.docChars)) s.docChars += r.docChars;
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
      usd: all.microUsd / 1e6,
      avgUsd: s.count ? all.microUsd / 1e6 / s.count : 0,
      readShare: all.microUsd ? all.microUsdRead / all.microUsd : 0,
      unpriced: all.unpriced,
      tokens: s.tokens,
      sub: s.sub,
      toolMs: s.toolMs,
      tools: s.tools,
      resultChars: s.resultChars,
      totalResultChars: Object.values(s.resultChars).reduce((a, b) => a + b, 0),
      docChars: s.docChars,
      avgChars: s.chars.length ? Math.round(s.chars.reduce((a, b) => a + b, 0) / s.chars.length) : null,
    };
  });
  const turns = list.filter((x) => x.kind === 'turn').sort((a, b) => b.usd - a.usd || b.workTokens - a.workTokens);
  const runs = list.filter((x) => x.kind !== 'turn').sort((a, b) => b.totalMs - a.totalMs);
  const byTime = [...list].sort((a, b) => b.totalMs - a.totalMs)[0] || null;
  const byTokens = [...turns].sort((a, b) => b.workTokens - a.workTokens)[0] || null;
  const byCost = turns[0] && turns[0].usd ? turns[0] : null;
  const allUsd = turns.reduce((n, x) => n + x.usd, 0);
  const use = { ...Object.fromEntries(Object.keys(USE_LABELS).map((k) => [k, 0])), old: 0 };
  const slots = {};
  for (const u of useTurns) {
    if (u.old) { use.old += 1; continue; }
    use[useOf(u)] += 1;
    for (const [k, v] of Object.entries(u.reads)) (slots[k] ||= { read: 0, edit: 0 }).read += v;
    for (const [k, v] of Object.entries(u.edits)) (slots[k] ||= { read: 0, edit: 0 }).edit += v;
  }
  const allRead = turns.reduce((n, x) => n + x.usd * x.readShare, 0);
  return {
    from: first !== null ? new Date(first).toISOString() : null,
    to: last !== null ? new Date(last).toISOString() : null,
    turns,
    runs,
    top: { time: byTime ? byTime.stage : null, tokens: byTokens && byTokens.workTokens ? byTokens.stage : null, cost: byCost ? byCost.stage : null },
    usd: allUsd,
    readShare: allUsd ? allRead / allUsd : 0,
    unpriced: turns.reduce((n, x) => n + x.unpriced, 0),
    alwaysLoadedChars: context.length ? context[context.length - 1] : null,
    use,
    slots,
  };
}

const fmtMs = (v) => (v < 1000 ? `${v}ms` : v < 60000 ? `${(v / 1000).toFixed(1)}초` : `${Math.floor(v / 60000)}분 ${Math.round((v % 60000) / 1000)}초`);
const fmtUsd = (v) => '$' + (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
const fmtPct = (v) => `${Math.round(v * 100)}%`;
const fmtTk = (v) => (v < 1000 ? String(v) : v < 1e6 ? `${(v / 1000).toFixed(1)}k` : `${(v / 1e6).toFixed(2)}M`);
const width = (s) => [...String(s)].reduce((n, ch) => n + (/[ᄀ-ᇿ㄰-㆏가-힯一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1), 0);
const pad = (s, w, right) => { const g = ' '.repeat(Math.max(0, w - width(s))); return right ? g + s : s + g; };

function table(head, rows, rightFrom = 1) {
  const ws = head.map((h, i) => Math.max(width(h), ...rows.map((r) => width(r[i]))));
  const line = (r) => r.map((c, i) => pad(String(c), ws[i], i >= rightFrom)).join('  ').trimEnd();
  return [line(head), ...rows.map(line)].join('\n');
}

const topBy = (fmt) => (o, n = 3) => Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${fmt(v)}`).join(', ') || '-';
const topTools = topBy(fmtMs);
const topChars = topBy(fmtTk);

export function render(agg) {
  const out = [];
  const turnCount = agg.turns.reduce((n, x) => n + x.count, 0);
  const runCount = agg.runs.reduce((n, x) => n + x.count, 0);
  if (!turnCount && !runCount) return '아직 쌓인 사용 기록이 없습니다 (.siloroot/state/metrics.jsonl).';
  out.push(`SiloRoot 사용 기록: 턴 ${turnCount}개, 스크립트·훅 ${runCount}번 (${(agg.from || '').slice(0, 10)} ~ ${(agg.to || '').slice(0, 10)})`);
  if (agg.top.time) out.push(`시간을 가장 많이 쓴 단계: ${agg.top.time}`);
  if (agg.top.tokens) out.push(`토큰을 가장 많이 쓴 단계: ${agg.top.tokens}`);
  if (agg.top.cost) out.push(`비용을 가장 많이 쓴 단계: ${agg.top.cost} (전체 ${fmtUsd(agg.usd)} API 정가 환산, 그 가운데 캐시 읽기 ${fmtPct(agg.readShare)})`);
  if (agg.unpriced) out.push(`값을 매기지 못한 응답 ${agg.unpriced}번 (lib/pricing.mjs 표에 없는 모델)`);
  if (agg.alwaysLoadedChars !== null) out.push(`매 턴 불러오는 SiloRoot 규칙 문서(CLAUDE.md, profile.md): ${agg.alwaysLoadedChars.toLocaleString('en-US')}자`);
  if (agg.turns.length) {
    out.push('', '턴, 비용 순 (비용 = API 정가 환산, 서브에이전트 포함. 캐시 읽기 몫 = 응답마다 대화 전체를 다시 읽는 값의 비율. 작업 토큰 = 입력 + 출력 + 캐시 쓰기. 결과 글자 = 도구 결과가 맥락에 들여온 글자 수, 문서 = 그 가운데 .siloroot 몫)');
    out.push(table(
      ['단계', '횟수', '합계 시간', '평균', 'p90', '비용', '턴당 비용', '캐시 읽기 몫', '작업 토큰', '평균 작업', '출력', '캐시 읽기', '응답 수', '서브에이전트', '결과 글자', '문서', '도구 시간 상위', '결과 글자 상위'],
      agg.turns.map((x) => [x.stage, x.count, fmtMs(x.totalMs), fmtMs(x.avgMs), fmtMs(x.p90Ms), fmtUsd(x.usd), fmtUsd(x.avgUsd), fmtPct(x.readShare), fmtTk(x.workTokens), fmtTk(x.avgWorkTokens),
        fmtTk(x.tokens.output + x.sub.output), fmtTk(x.tokens.cacheRead + x.sub.cacheRead), x.tokens.calls + x.sub.calls, fmtTk(work(x.sub)), fmtTk(x.totalResultChars), fmtTk(x.docChars), topTools(x.toolMs), topChars(x.resultChars)]),
    ));
  }
  const counted = agg.use ? Object.keys(USE_LABELS).reduce((n, k) => n + agg.use[k], 0) : 0;
  if (counted) {
    out.push('', `턴 나눔 (자리별 문서 세기를 남긴 턴 ${counted}개${agg.use.old ? `, 그 전 기록 ${agg.use.old}개는 뺌` : ''}. 참고 문서 = 작업 일지, 폴더 안내, 규칙 문서, 글쓰기 규칙을 뺀 문서를 고치지 않고 읽음)`);
    out.push(table(['턴', '수', '비율'], Object.entries(USE_LABELS).map(([k, label]) => [label, agg.use[k], fmtPct(agg.use[k] / counted)])));
    const rows = Object.entries(agg.slots).sort((a, b) => (b[1].read + b[1].edit) - (a[1].read + a[1].edit));
    if (rows.length) {
      out.push('', '자리별 문서 수 (턴 안에서 같은 문서는 한 번. 읽음 = 그 턴에 고치지 않고 읽기만 함)');
      out.push(table(['자리', '읽음', '고침'], rows.map(([k, v]) => [k, v.read, v.edit])));
    }
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
