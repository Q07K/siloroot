// SiloRoot가 관여하는 작업의 걸린 시간과 토큰 수를 .siloroot/state/metrics.jsonl에 한 줄씩 남긴다.
// - 남기는 것: 단계 이름, 시작·끝 시각, 걸린 시간, 토큰 수, 도구 이름별 횟수와 시간, siloroot 스킬 이름, 세션 id.
// - 남기지 않는 것: 문서 내용, 파일 경로, 프롬프트, 폴더 경로. 아래 clean()이 허용한 칸만 통과시킨다.
// - 기록이 실패해도 원래 작업은 막지 않는다. 이 파일의 함수는 예외를 밖으로 던지지 않는다.
// 끄기: .siloroot/config.json에 "metrics": false, 또는 환경 변수 SILOROOT_METRICS=0.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';

export const METRICS_FILE = 'metrics.jsonl';
export const METRICS_OLD = 'metrics.1.jsonl';
// 이보다 커지면 metrics.1.jsonl로 옮기고 새로 쌓는다. 그 전 것은 버린다.
export const MAX_BYTES = 5 * 1024 * 1024;
export const VERSION = 1;

export const metricsOn = (cfg) => !!cfg && cfg.metrics !== false && process.env.SILOROOT_METRICS !== '0';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const NAME = /^[A-Za-z][\w:.+-]{0,60}$/;
const ISO = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/;
const SESSION = /^[\w-]{1,64}$/;
const SKILL = /^siloroot:[\w-]{1,40}$/;
const TOKEN_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'calls'];

const numMap = (o, keyOk) => {
  if (!o || typeof o !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(o)) if (keyOk(k) && isNum(v)) out[k] = Math.round(v);
  return Object.keys(out).length ? out : undefined;
};

// 허용한 칸과 모양만 남긴다. 문자열은 정해진 모양(단계 이름, ISO 시각, 세션 id)일 때만 남는다.
export function clean(r) {
  const o = { v: VERSION };
  if (['script', 'hook', 'turn', 'context'].includes(r.kind)) o.kind = r.kind; else return null;
  if (typeof r.stage === 'string' && NAME.test(r.stage)) o.stage = r.stage; else return null;
  if (typeof r.session === 'string' && SESSION.test(r.session)) o.session = r.session;
  for (const k of ['start', 'end']) if (typeof r[k] === 'string' && ISO.test(r[k])) o[k] = r[k];
  for (const k of ['ms', 'chars', 'turns', 'docs']) if (isNum(r[k])) o[k] = Math.round(r[k]);
  if (typeof r.ok === 'boolean') o.ok = r.ok;
  if (r.cont === true) o.cont = true;
  if (r.touched === true) o.touched = true;
  const t = numMap(r.tokens, (k) => TOKEN_KEYS.includes(k)); if (t) o.tokens = t;
  const s = numMap(r.sub, (k) => TOKEN_KEYS.includes(k)); if (s) o.sub = s;
  const tools = numMap(r.tools, (k) => NAME.test(k)); if (tools) o.tools = tools;
  const toolMs = numMap(r.toolMs, (k) => NAME.test(k)); if (toolMs) o.toolMs = toolMs;
  if (Array.isArray(r.skills)) { const sk = r.skills.filter((x) => typeof x === 'string' && SKILL.test(x)); if (sk.length) o.skills = sk; }
  return o;
}

// 기록을 덧붙인다. cfg는 loadConfig 결과. 성공하면 true.
export function appendMetrics(cfg, records) {
  try {
    if (!metricsOn(cfg)) return false;
    const lines = (Array.isArray(records) ? records : [records]).map(clean).filter(Boolean);
    if (!lines.length) return false;
    const file = path.join(cfg.stateDir, METRICS_FILE);
    fs.mkdirSync(cfg.stateDir, { recursive: true });
    try { if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, path.join(cfg.stateDir, METRICS_OLD)); } catch { /* 아직 없음 */ }
    fs.appendFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    return true;
  } catch {
    return false;
  }
}

// 스크립트 하나의 실행 시간을 잰다. 프로세스가 끝날 때(process.exit 포함) 한 줄을 남긴다.
// 설정은 끝날 때 읽는다. init처럼 실행 중에 config.json을 만드는 스크립트도 기록된다.
// 돌려주는 객체의 set()으로 칸(chars 등)을 더할 수 있다.
export function timeScript(root, kind, stage) {
  const t0 = Date.now();
  const extra = {};
  try {
    process.on('exit', (code) => {
      try {
        const cfg = loadConfig(root);
        if (!metricsOn(cfg)) return;
        const t1 = Date.now();
        appendMetrics(cfg, { kind, stage, start: new Date(t0).toISOString(), end: new Date(t1).toISOString(), ms: t1 - t0, ok: code === 0, ...extra });
      } catch { /* 기록 실패는 무시한다 */ }
    });
  } catch { /* 무시 */ }
  return { set(o) { Object.assign(extra, o); } };
}

export function readMetrics(stateDir) {
  const out = [];
  for (const f of [METRICS_OLD, METRICS_FILE]) {
    let text = '';
    try { text = fs.readFileSync(path.join(stateDir, f), 'utf8'); } catch { continue; }
    for (const l of text.split('\n')) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch { /* 깨진 줄은 건너뛴다 */ } }
  }
  return out;
}
