#!/usr/bin/env node
// Claude Code 세션이 시작될 때 플러그인 훅으로 실행된다 (hooks/hooks.json의 SessionStart).
// SiloRoot 폴더(.siloroot/config.json이 있는 폴더)가 아니면 아무것도 하지 않는다.
// 1. 설정 포트에 내 폴더의 뷰어 서버가 없으면 백그라운드로 켠다. 세션을 닫아도 서버는 남는다.
//    내 폴더의 서버가 이 플러그인보다 옛 버전이면(버전을 알려 주지 않는 서버 포함) 끄고 새로 켠다.
//    플러그인을 올려도 떠 있던 옛 서버가 계속 쓰이는 것을 막는다. 더 새 버전 서버는 그대로 둔다.
// 2. 그 포트를 다른 폴더의 서버가 쓰고 있으면 켜지 않고 한 줄로 알린다.
// 3. 세션을 시작할 때마다 기본 브라우저로 뷰어를 연다. 단, 뷰어 화면이 이미 열려 있으면 열지 않고,
//    대화 압축(compact)으로 다시 시작한 세션에서도 열지 않는다.
// 4. 모양 3 프로젝트면 홈(~/.siloroot/user.json)의 뷰어 서버도 같은 방식으로 켠다. 브라우저는 열지 않는다.
//    사람들은 대개 프로젝트에서 Claude를 열기 때문에, 프로젝트 뷰어의 "나" 링크와 바깥 점이 홈 뷰어를 찾을 수 있게 한다.
// 시험용: VIEWER_AUTOSTART_DRY=1 이면 브라우저를 열지 않고, 열지 말지 판단을 stderr에 한 줄로 쓴다. 홈을 켰으면 home:<state> 한 줄을 더 쓴다.

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, pluginVersion } from '../lib/config.mjs';
import { timeScript } from '../lib/metrics.mjs';
import { readUser } from '../lib/user.mjs';
import { urlOf, whoIsThere, isOlder, ensureServer as ensureAt, sleep } from '../lib/servers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig(process.env.CLAUDE_PROJECT_DIR || process.cwd());
if (!cfg) process.exit(0);
timeScript(cfg.root, 'hook', 'hook:autostart');

const URL = urlOf(cfg);
const DRY = process.env.VIEWER_AUTOSTART_DRY === '1';
const MINE = (() => { try { return pluginVersion(); } catch { return null; } })();
// 0.5.2부터 뷰어 화면은 다시 붙은 서버의 버전이 바뀌면 스스로 새로 읽는다. 그보다 옛 서버가 준 화면은 못 한다.
const SELF_RELOAD = '0.5.2';

// 알림 글은 모아서 한 번에 낸다(훅 출력은 JSON 하나)
const notes = [];
function flush() {
  if (notes.length) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notes.join('\n') } }));
}

// 작업 공간 c의 뷰어 서버를 지금 버전으로 켜 둔다(lib/servers.mjs). 다른 폴더가 포트를 쓰면 켜지 않는다.
// 결과: { ...health, wasDown(꺼져 있었거나 옛 버전을 꺼서 새로 켰다), staleTabs(옛 버전 서버가 준 화면이 남았을 수 있다) }
async function ensureServer(c, label) {
  const h = await ensureAt(c, { serve: path.join(here, 'serve.mjs'), version: MINE });
  if (h.stopFailed) notes.push(`[SiloRoot] ${label} 포트 ${c.port}의 뷰어 서버가 옛 버전(${h.was || '버전 모름'})인데 끄지 못했습니다. 그 서버를 끄고 세션을 다시 시작하면 ${MINE} 서버가 뜹니다.`);
  return { ...h, staleTabs: h.replaced && isOlder(h.was, SELF_RELOAD) };
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

// 모양 3 프로젝트의 홈 설정. 홈을 못 찾거나 user.json이 깨졌으면 null
function homeConfig() {
  if ((cfg.schema ?? 0) < 3 || cfg.mode === 'home') return null;
  try {
    const u = readUser();
    if (u.invalid || !u.home) return null;
    const hc = loadConfig(u.home);
    return hc && hc.mode === 'home' ? hc : null;
  } catch { return null; }
}

const source = await hookSource();
let health = await ensureServer(cfg, '이 작업 공간');
if (health.state === 'other') {
  notes.push(`[SiloRoot] 포트 ${cfg.port}을 다른 폴더가 쓰는 중입니다. .siloroot/config.json의 port를 바꾸세요.`);
} else {
  const staleTabs = health.staleTabs;
  if (health.wasDown) {
    // 서버가 꺼진 사이에도 열려 있던 화면은 몇 초 안에 다시 붙는다. 그 화면을 두고 새 창을 열지 않도록 잠깐 기다린다.
    const end = Date.now() + 3500;
    while (health.state === 'mine' && !health.viewers && Date.now() < end) {
      await sleep(250);
      health = await whoIsThere(cfg);
    }
  }
  if (health.state !== 'mine') decide(false, 'server-down');
  else if (source === 'compact') decide(false, 'compact');
  else if (health.viewers > 0) {
    // 옛 서버가 준 화면이 새 서버에 다시 붙었다. 그 화면은 새 기능을 모르므로 새로고침해야 한다.
    if (staleTabs) notes.push(`[SiloRoot] 뷰어 서버를 ${MINE}(으)로 바꿨습니다. 열려 있던 뷰어 화면은 옛 버전이라 새로고침해야 새 기능이 보입니다. 사용자에게 한 줄로 알리세요.`);
    decide(false, 'already-open');
  }
  else decide(true, health.viewers === null ? 'unknown-viewers' : 'no-viewer');
}

const hc = homeConfig();
if (hc) {
  const h = await ensureServer(hc, '홈');
  if (DRY) process.stderr.write('home:' + h.state + '\n');
  if (h.state === 'other') notes.push(`[SiloRoot] 홈 뷰어 포트 ${hc.port}을 다른 폴더가 쓰는 중입니다. ${hc.root.split(path.sep).join('/')}/.siloroot/config.json의 port를 바꾸세요.`);
}
flush();
