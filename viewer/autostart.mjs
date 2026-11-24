#!/usr/bin/env node
// Claude Code 세션이 시작될 때 플러그인 훅으로 실행된다 (hooks/hooks.json의 SessionStart).
// SiloRoot 폴더(.siloroot/config.json이 있는 폴더)가 아니면 아무것도 하지 않는다.
// 1. 설정 포트에 내 폴더의 뷰어 서버가 없으면 백그라운드로 켠다. 세션을 닫아도 서버는 남는다.
// 2. 그 포트를 다른 폴더의 서버가 쓰고 있으면 켜지 않고 한 줄로 알린다.
// 3. 세션을 시작할 때마다 기본 브라우저로 뷰어를 연다. 단, 뷰어 화면이 이미 열려 있으면 열지 않고,
//    대화 압축(compact)으로 다시 시작한 세션에서도 열지 않는다.
// 시험용: VIEWER_AUTOSTART_DRY=1 이면 브라우저를 열지 않고, 열지 말지 판단을 stderr에 한 줄로 쓴다.

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { timeScript } from '../lib/metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!cfg) process.exit(0);
timeScript(cfg.root, 'hook', 'hook:autostart');

const URL = 'http://127.0.0.1:' + cfg.port;
const DRY = process.env.VIEWER_AUTOSTART_DRY === '1';
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// { state: 'mine' | 'other' | 'down', viewers }. viewers는 열려 있는 뷰어 화면 수.
// 이 값을 주지 않는 예전 서버면 null(모름)이다.
async function whoIsThere() {
  try {
    const res = await fetch(URL + '/health', { signal: AbortSignal.timeout(800) });
    const j = await res.json();
    if (!(j && j.siloroot && same(path.resolve(String(j.root)), cfg.root))) return { state: 'other' };
    return { state: 'mine', viewers: Number.isInteger(j.viewers) ? j.viewers : null };
  } catch (e) {
    // 연결이 거절되면 비어 있는 포트. 그 밖의 응답(다른 프로그램)은 다른 것이 쓰는 중으로 본다.
    const code = e && e.cause && e.cause.code;
    return { state: code === 'ECONNREFUSED' ? 'down' : 'other' };
  }
}

// 훅은 stdin으로 { source: 'startup' | 'resume' | 'clear' | 'compact', ... }를 준다.
// 손으로 실행하면 stdin이 없거나 열린 채일 수 있으니 잠깐만 기다린다.
async function hookSource() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  const done = new Promise((resolve) => {
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', resolve);
    process.stdin.on('error', resolve);
  });
  await Promise.race([done, sleep(500)]);
  process.stdin.pause();
  process.stdin.unref?.();
  try { return String(JSON.parse(Buffer.concat(chunks).toString('utf8')).source || ''); } catch { return ''; }
}

function say(text) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}

function openBrowser() {
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  if (process.platform === 'win32') spawn('explorer.exe', [URL], opts).unref();
  else if (process.platform === 'darwin') spawn('open', [URL], opts).unref();
  else spawn('xdg-open', [URL], opts).unref();
}

function decide(open, reason) {
  if (DRY) { process.stderr.write((open ? 'open' : 'skip') + ':' + reason + '\n'); return; }
  if (open) openBrowser();
}

const source = await hookSource();
let health = await whoIsThere();
if (health.state === 'other') {
  say(`[SiloRoot] 포트 ${cfg.port}을 다른 폴더가 쓰는 중입니다. .siloroot/config.json의 port를 바꾸세요.`);
  process.exit(0);
}
if (health.state === 'down') {
  spawn(process.execPath, [path.join(here, 'serve.mjs'), cfg.root], {
    cwd: cfg.root, detached: true, stdio: 'ignore', windowsHide: true,
  }).unref();
  let end = Date.now() + 4000;
  while (Date.now() < end && (health = await whoIsThere()).state !== 'mine') await sleep(200);
  // 서버가 꺼진 사이에도 열려 있던 화면은 몇 초 안에 다시 붙는다. 그 화면을 두고 새 창을 열지 않도록 잠깐 기다린다.
  end = Date.now() + 3500;
  while (health.state === 'mine' && !health.viewers && Date.now() < end) {
    await sleep(250);
    health = await whoIsThere();
  }
}

if (health.state !== 'mine') decide(false, 'server-down');
else if (source === 'compact') decide(false, 'compact');
else if (health.viewers > 0) decide(false, 'already-open');
else decide(true, health.viewers === null ? 'unknown-viewers' : 'no-viewer');
