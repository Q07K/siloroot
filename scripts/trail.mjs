#!/usr/bin/env node
// 읽는 문서 흔적을 남기는 플러그인 훅 (hooks/hooks.json, hooks/codex-hooks.json).
// - 인자 없음: PostToolUse. 읽기·편집 도구가 문서를 다루면
//   .siloroot/state/trail/<세션 id>.jsonl에 한 줄을 붙인다 (lib/trail.mjs).
// - --reset: UserPromptSubmit. 사용자가 새 메시지를 보내면 그 세션 흔적을 비운다.
// Codex에서는 새 메시지의 초기화를 기다린 뒤 도구를 실행한다.
// SiloRoot 폴더가 아니면 아무것도 하지 않고, 무엇이 실패해도 출력 없이 0으로 끝난다.

import { loadConfig } from '../lib/config.mjs';
import { appendTrail, entriesFromHook, resetTrail, safeSession } from '../lib/trail.mjs';

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

async function main() {
  const input = await readStdin();
  const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (!cfg) return;
  const session = safeSession(input.session_id);
  if (!session) return;
  if (process.argv.includes('--reset')) resetTrail(cfg, session);
  else appendTrail(cfg, session, entriesFromHook(cfg, input));
}

try { await main(); } catch { /* 흔적 실패는 원래 작업을 막지 않는다 */ }
process.exit(0);
