#!/usr/bin/env node
// 세션을 시작할 때 작업 공간의 컨벤션 내용을 맥락에 넣는 플러그인 훅 (SessionStart, hooks/hooks.json, hooks/codex-hooks.json).
// 글은 lib/conventions.mjs가 만든다. 대화를 압축한 뒤(source: compact)에도 다시 돌아 같은 내용을 다시 넣는다.
// 할 일 알림(viewer/notify.mjs)과 따로 둔 까닭: 훅 출력 길이 제한은 훅 출력마다 따로 잰다. 컨벤션이 할 일 알림의 몫을 먹지 않게 한다.
//   --max-chars N : 이 글자 수를 넘으면 본문 대신 문서 목록을 넣는다(기본 lib/conventions.mjs의 DEFAULT_MAX_CHARS)
// SiloRoot 폴더가 아니거나, 컨벤션 자리가 없거나, 넣을 문서가 없으면 아무것도 출력하지 않는다. 무엇이 실패해도 0으로 끝난다.

import { loadConfig } from '../lib/config.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { conventionsContext, DEFAULT_MAX_CHARS } from '../lib/conventions.mjs';

function maxChars() {
  const i = process.argv.indexOf('--max-chars');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_CHARS;
}

try {
  const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (cfg) {
    // 걸린 시간과 넣은 글자 수(세션마다 한 번 드는 토큰 비용)를 남긴다 (lib/metrics.mjs)
    const timer = timeScript(cfg.root, 'hook', 'hook:conventions');
    const text = conventionsContext(cfg, { maxChars: maxChars() });
    timer.set({ chars: text.length });
    if (text) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  }
} catch { /* 컨벤션을 못 넣어도 세션은 시작한다 */ }
