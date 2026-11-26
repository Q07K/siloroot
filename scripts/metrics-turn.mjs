#!/usr/bin/env node
// Claude가 응답을 마칠 때마다 실행되는 플러그인 훅 (hooks/hooks.json의 Stop).
// 훅 입력의 transcript_path(대화 기록 JSONL)를 지난번 읽은 곳부터 읽어, 끝난 턴마다
// 걸린 시간, 토큰 수, 쓴 도구, siloroot 스킬을 .siloroot/state/metrics.jsonl에 남긴다 (lib/metrics.mjs).
// - SiloRoot 폴더가 아니거나 기록을 껐으면 아무것도 하지 않는다.
// - 무엇이 실패해도 출력 없이 0으로 끝난다. Stop 훅이 출력하거나 0이 아닌 값으로 끝나면 Claude의 응답 마무리를 막을 수 있다.
// - 읽은 위치는 세션마다 .siloroot/state/metrics-cursor/<세션 id>.json에 둔다. 여러 세션이 함께 돌아도 서로의 파일을 덮지 않고,
//   임시 파일에 쓴 뒤 이름을 바꿔서 반쯤 쓴 파일을 읽지 않는다. 다 쓰이지 않은 마지막 줄은 다음 실행이 읽는다.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { appendMetrics, metricsOn, processStart } from '../lib/metrics.mjs';
import { splitTurns, subagentUsage } from '../lib/transcript.mjs';

const CURSOR_DIR = 'metrics-cursor';
const KEEP_IDS = 200;
const KEEP_DAYS = 30;
const t0 = processStart();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readStdin() {
  if (process.stdin.isTTY) return {};
  const chunks = [];
  const done = new Promise((resolve) => {
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
  });
  await Promise.race([done, sleep(1000)]);
  process.stdin.pause();
  process.stdin.unref?.();
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) || {}; } catch { return {}; }
}

// 지난번 위치부터 끝까지 읽되, 줄바꿈으로 끝난 줄까지만 쓴다.
function readNew(file, offset) {
  const size = fs.statSync(file).size;
  if (size < offset) offset = 0; // 파일이 새로 쓰였다
  if (size === offset) return { entries: [], offset };
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    const last = buf.lastIndexOf(0x0a);
    if (last < 0) return { entries: [], offset };
    const entries = [];
    for (const l of buf.subarray(0, last + 1).toString('utf8').split('\n')) {
      if (!l.trim()) continue;
      try { entries.push(JSON.parse(l)); } catch { /* 깨진 줄은 건너뛴다 */ }
    }
    return { entries, offset: offset + last + 1 };
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  const input = await readStdin();
  const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (!metricsOn(cfg)) return;
  const session = typeof input.session_id === 'string' && /^[\w-]{1,64}$/.test(input.session_id) ? input.session_id : null;
  const tp = typeof input.transcript_path === 'string' ? input.transcript_path : '';
  if (!session || !tp || !fs.existsSync(tp)) return;

  const dir = path.join(cfg.stateDir, CURSOR_DIR);
  const cursorFile = path.join(dir, session + '.json');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(cursorFile, 'utf8')) || {}; } catch { prev = {}; }
  const seenIds = new Set(Array.isArray(prev.ids) ? prev.ids : []);

  const { entries, offset } = readNew(tp, Number(prev.offset) || 0);
  const turns = splitTurns(entries, { seenIds, prevStage: prev.stage, prevEnd: prev.end, prevSkill: prev.skill, cfg });

  const records = [];
  for (const t of turns) {
    const sub = subagentUsage(tp, t.start, t.end);
    records.push({ kind: 'turn', session, ...t, sub: sub.calls ? sub : undefined, turns: t.cont ? 0 : 1 });
  }
  const t1 = Date.now();
  records.push({ kind: 'hook', stage: 'hook:metrics-turn', session, start: new Date(t0).toISOString(), end: new Date(t1).toISOString(), ms: t1 - t0, ok: true, turns: turns.filter((t) => !t.cont).length });
  appendMetrics(cfg, records);

  const lastTurn = turns.filter((t) => !t.cont).pop();
  const ids = [...seenIds].slice(-KEEP_IDS);
  const next = {
    offset,
    ids,
    stage: lastTurn ? lastTurn.stage : prev.stage,
    end: turns.length ? turns[turns.length - 1].end : prev.end,
    skill: turns.lastSkill || undefined,
  };
  fs.mkdirSync(dir, { recursive: true });
  const tmp = cursorFile + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next));
  fs.renameSync(tmp, cursorFile);

  // 오래 쓰지 않은 세션의 위치 파일은 지운다
  const cut = Date.now() - KEEP_DAYS * 86400000;
  for (const f of fs.readdirSync(dir)) {
    try { const full = path.join(dir, f); if (fs.statSync(full).mtimeMs < cut) fs.unlinkSync(full); } catch { /* 무시 */ }
  }
}

try { await main(); } catch { /* 기록 실패는 원래 작업을 막지 않는다 */ }
process.exit(0);
