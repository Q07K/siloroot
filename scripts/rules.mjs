#!/usr/bin/env node
// 세션을 시작할 때 SiloRoot 작업 규칙을 Codex 맥락에 넣는 플러그인 훅 (SessionStart, hooks/codex-hooks.json).
// 글은 lib/rules.mjs가 만든다. Claude Code는 CLAUDE.local.md로 규칙을 읽으므로 hooks/hooks.json에는 걸지 않는다.
// 컨벤션 훅(scripts/conventions.mjs)과 따로 둔 까닭: Codex는 훅 출력마다 길이 한도를 따로 잰다. 한도는 훅 설정의 additionalContextLimit로 올린다.
//   --max-chars N : 이 글자 수를 넘으면 본문 대신 규칙 파일을 읽으라는 안내만 넣는다(기본 lib/rules.mjs의 DEFAULT_MAX_CHARS)
// SiloRoot 폴더가 아니거나 규칙 파일이 없으면 아무것도 출력하지 않는다. 무엇이 실패해도 0으로 끝난다.

import { loadConfig } from '../lib/config.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { rulesContext, DEFAULT_MAX_CHARS } from '../lib/rules.mjs';

function maxChars() {
  const i = process.argv.indexOf('--max-chars');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_CHARS;
}

try {
  const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  if (cfg) {
    const timer = timeScript(cfg.root, 'hook', 'hook:rules');
    const text = rulesContext(cfg, { maxChars: maxChars() });
    timer.set({ chars: text.length });
    if (text) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  }
} catch { /* 규칙을 못 넣어도 세션은 시작한다 */ }
