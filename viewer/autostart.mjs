#!/usr/bin/env node
// Claude Code 세션이 시작될 때 플러그인 훅으로 실행된다 (hooks/hooks.json의 SessionStart).
// SiloRoot 폴더(.siloroot/config.json이 있는 폴더)가 아니면 아무것도 하지 않는다.
// 1. 설정 포트에 내 폴더의 뷰어 서버가 없으면 백그라운드로 켠다. 세션을 닫아도 서버는 남는다.
// 2. 그 포트를 다른 폴더의 서버가 쓰고 있으면 켜지 않고 한 줄로 알린다.
// 3. 오늘 처음 시작한 세션이면 기본 브라우저로 뷰어를 연다.
// 시험용: VIEWER_AUTOSTART_DRY=1 이면 브라우저를 열지 않고 날짜도 기록하지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!cfg) process.exit(0);

const URL = 'http://127.0.0.1:' + cfg.port;
const STAMP = path.join(cfg.stateDir, 'last-opened.txt');
const DRY = process.env.VIEWER_AUTOSTART_DRY === '1';
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

// 'mine' | 'other' | 'down'
async function whoIsThere() {
  try {
    const res = await fetch(URL + '/health', { signal: AbortSignal.timeout(800) });
    const j = await res.json();
    return j && j.siloroot && same(path.resolve(String(j.root)), cfg.root) ? 'mine' : 'other';
  } catch (e) {
    // 연결이 거절되면 비어 있는 포트. 그 밖의 응답(다른 프로그램)은 다른 것이 쓰는 중으로 본다.
    const code = e && e.cause && e.cause.code;
    return code === 'ECONNREFUSED' ? 'down' : 'other';
  }
}

function say(text) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}

function today() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function openBrowser() {
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  if (process.platform === 'win32') spawn('explorer.exe', [URL], opts).unref();
  else if (process.platform === 'darwin') spawn('open', [URL], opts).unref();
  else spawn('xdg-open', [URL], opts).unref();
}

let state = await whoIsThere();
if (state === 'other') {
  say(`[SiloRoot] 포트 ${cfg.port}을 다른 폴더가 쓰는 중입니다. .siloroot/config.json의 port를 바꾸세요.`);
  process.exit(0);
}
if (state === 'down') {
  spawn(process.execPath, [path.join(here, 'serve.mjs'), cfg.root], {
    cwd: cfg.root, detached: true, stdio: 'ignore', windowsHide: true,
  }).unref();
  const end = Date.now() + 4000;
  while (Date.now() < end && (state = await whoIsThere()) !== 'mine') await new Promise((r) => setTimeout(r, 200));
}

let last = '';
try { last = fs.readFileSync(STAMP, 'utf8').trim(); } catch { /* 처음 */ }
if (state === 'mine' && last !== today() && !DRY) {
  fs.mkdirSync(path.dirname(STAMP), { recursive: true });
  fs.writeFileSync(STAMP, today());
  openBrowser();
}
