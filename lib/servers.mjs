// 작업 공간 뷰어 서버를 지금 플러그인 버전으로 켜 둔다. 세션 시작 훅(viewer/autostart.mjs)과 /siloroot:update(scripts/update.mjs --servers)가 함께 쓴다.
// 내 폴더의 서버가 이 플러그인보다 옛 버전이면(버전을 알려 주지 않는 서버 포함) 끄고 새로 켠다. 더 새 버전 서버는 그대로 둔다.
// 홈 서버는 여러 프로젝트가 같이 쓰고 프로젝트마다 플러그인 버전이 다를 수 있어서다.

import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

export const urlOf = (c) => 'http://127.0.0.1:' + c.port;
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// { state: 'mine' | 'other' | 'down', viewers, version, pid }. viewers는 열려 있는 뷰어 화면 수.
// 이 값들을 주지 않는 예전 서버면 null(모름)이다.
export async function whoIsThere(c) {
  try {
    const res = await fetch(urlOf(c) + '/health', { signal: AbortSignal.timeout(800) });
    const j = await res.json();
    if (!(j && j.siloroot && same(path.resolve(String(j.root)), c.root))) return { state: 'other', viewers: null };
    return {
      state: 'mine',
      viewers: Number.isInteger(j.viewers) ? j.viewers : null,
      version: typeof j.version === 'string' ? j.version : null,
      pid: Number.isInteger(j.pid) && j.pid > 0 ? j.pid : null,
    };
  } catch (e) {
    // 연결이 거절되면 비어 있는 포트. 그 밖의 응답(다른 프로그램)은 다른 것이 쓰는 중으로 본다.
    const code = e && e.cause && e.cause.code;
    return { state: code === 'ECONNREFUSED' ? 'down' : 'other', viewers: null };
  }
}

// a가 b보다 옛 버전인가. 버전을 모르면(예전 서버, 적지 않은 설정) 옛 버전으로 본다.
export function isOlder(a, b) {
  if (!a) return true;
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  }
  return false;
}

// pid를 알려 주지 않는 예전 서버는 포트를 듣는 프로세스로 찾는다. 못 찾으면 null.
function pidOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
      // 듣는 소켓은 상대 주소가 0.0.0.0:0이다. 상태 글자(LISTENING)는 언어 설정에 따라 바뀔 수 있어 보지 않는다.
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().split(/\s+/);
        if (m.length >= 5 && m[1] === `127.0.0.1:${port}` && m[2] === '0.0.0.0:0') return Number(m[m.length - 1]) || null;
      }
      return null;
    }
    const out = execFileSync('lsof', ['-nP', `-iTCP@127.0.0.1:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 3000 });
    return Number(out.trim().split(/\s+/)[0]) || null;
  } catch {
    return null;
  }
}

// /health로 c 폴더의 서버임을 확인한 뒤에만 부른다. 꺼져서 포트가 비면 true.
async function stopServer(c, health) {
  const pid = health.pid || pidOnPort(c.port);
  if (!pid || pid === process.pid) return false;
  try { process.kill(pid); } catch { return false; }
  const end = Date.now() + 4000;
  while (Date.now() < end) {
    if ((await whoIsThere(c)).state === 'down') return true;
    await sleep(200);
  }
  return false;
}

// 작업 공간 c의 뷰어 서버를 version 버전(serve: 그 버전의 viewer/serve.mjs)으로 켜 둔다. 다른 폴더가 포트를 쓰면 켜지 않는다.
// 결과: { ...health, wasDown(꺼져 있었거나 옛 버전을 꺼서 새로 켰다), replaced(옛 버전을 끄고 바꿨다), was(바꾸기 전 버전), stopFailed }
export async function ensureServer(c, { serve, version }) {
  let health = await whoIsThere(c);
  let wasDown = health.state === 'down', replaced = false, stopFailed = false;
  const was = health.state === 'mine' ? health.version : null;
  if (health.state === 'mine' && version && isOlder(health.version, version)) {
    if (await stopServer(c, health)) { health = { state: 'down' }; wasDown = true; replaced = true; }
    else stopFailed = true;
  }
  if (health.state === 'down') {
    spawn(process.execPath, [serve, c.root], { cwd: c.root, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    const end = Date.now() + 4000;
    while (Date.now() < end && (health = await whoIsThere(c)).state !== 'mine') await sleep(200);
  }
  return { ...health, wasDown, replaced, was, stopFailed };
}
