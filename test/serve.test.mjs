import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, findFreePort, pluginVersion, DEFAULT_DIRS } from '../lib/config.mjs';
import { makeProject, write } from './fixtures.mjs';

const SERVE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer', 'serve.mjs');
let root, port, child, base;

async function waitUp(url, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* 아직 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('서버가 뜨지 않음');
}

const post = (p, body) => fetch(base + p, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify(body),
});

before(async () => {
  root = makeProject('서버 시험 폴더');
  port = await findFreePort(4230);
  writeConfig(root, { port });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# a\n');
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, [SERVE, root], { stdio: 'ignore' });
  await waitUp(base + '/health');
});

after(() => { child.kill(); });

test('/health는 SiloRoot 표시와 루트 절대 경로를 돌려준다', async () => {
  const j = await (await fetch(base + '/health')).json();
  assert.equal(j.siloroot, true);
  assert.equal(j.root, path.resolve(root));
});

test('/health는 서버의 플러그인 버전과 프로세스 번호를 돌려준다', async () => {
  const j = await (await fetch(base + '/health')).json();
  assert.equal(j.version, pluginVersion());
  assert.equal(j.pid, child.pid);
});

test('첫 화면에 SiloRoot 이름이 있다', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /SiloRoot/);
});

test('댓글은 설정의 feedback 폴더에 대기 상태로 생긴다', async () => {
  const r = await post('/api/feedback', { target: '02-study/a.md', body: '여기 다시 보기' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.path.startsWith(DEFAULT_DIRS.feedback + '/'));
  const text = fs.readFileSync(path.join(root, j.path), 'utf8');
  assert.match(text, /^type: feedback$/m);
  assert.match(text, /^status: 대기$/m);
});

test('설정 파일은 웹에서 고칠 수 없다', async () => {
  const file = path.join(root, '.siloroot', 'config.json');
  const beforeText = fs.readFileSync(file, 'utf8');
  const r = await post('/api/save', { path: '.siloroot/config.json', text: '{}' });
  assert.equal(r.status, 400);
  assert.equal(fs.readFileSync(file, 'utf8'), beforeText);
});

test('다른 Host 이름으로 온 요청은 거절한다 (DNS 리바인딩 막기)', async () => {
  for (const p of ['/', '/health']) {
    const status = await new Promise((resolve, reject) => {
      import('node:http').then(({ default: http }) => {
        const req = http.get({ host: '127.0.0.1', port, path: p, headers: { host: 'evil.example:' + port } }, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
      });
    });
    assert.equal(status, 403, p);
  }
});

test('문서 하나만 확인하면 200을 돌려준다', async () => {
  const r = await post('/api/seen', { path: '02-study/a.md' });
  assert.equal(r.status, 200);
});

test('확인할 경로가 폴더 밖이면 400', async () => {
  const r = await post('/api/seen', { path: '../밖.md' });
  assert.equal(r.status, 400);
});

// --- 읽는 문서 흔적 (/trail, event: trail) ---
import http from 'node:http';
import { loadConfig } from '../lib/config.mjs';
import { appendTrail, resetTrail } from '../lib/trail.mjs';

test('흔적이 없으면 /trail은 빈 흔적을 준다', async () => {
  const r = await fetch(base + '/trail');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await r.json(), { session: null, items: [], turn: null });
});

test('흔적 파일을 쓰면 /trail이 그 흔적을 준다', async () => {
  appendTrail(loadConfig(root), 's1', [{ kind: 'read', path: '02-study/a.md' }]);
  const j = await (await fetch(base + '/trail')).json();
  assert.equal(j.session, 's1');
  assert.equal(j.items[0].path, '02-study/a.md');
});

test('흔적이 바뀌면 /events로 trail 알림이 온다', async () => {
  let text = '';
  const req = http.get(base + '/events', (res) => { res.setEncoding('utf8'); res.on('data', (c) => { text += c; }); });
  try {
    await new Promise((r) => setTimeout(r, 300));
    appendTrail(loadConfig(root), 's1', [{ kind: 'edit', path: '02-study/a.md' }]);
    const end = Date.now() + 3000;
    while (Date.now() < end && !/event: trail\n/.test(text)) await new Promise((r) => setTimeout(r, 50));
    assert.match(text, /event: trail\ndata: .*"02-study\/a\.md"/);
  } finally {
    req.destroy();
  }
});

test('새 메시지가 오면 화면이 붙은 서버가 바로 기준을 잡고, 뒤에 생긴 문서와 연결만 새 것으로 싣는다', async () => {
  const cfg = loadConfig(root);
  const baseFile = path.join(cfg.stateDir, 'turn-base.json');
  fs.rmSync(baseFile, { force: true });
  const req = http.get(base + '/events', (res) => res.resume());
  let j = null;
  try {
    await new Promise((r) => setTimeout(r, 300));
    resetTrail(cfg, 's1');
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      j = await (await fetch(base + '/trail')).json();
      if (j.turn != null && fs.existsSync(baseFile)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  } finally {
    req.destroy();
  }
  assert.equal(typeof j.turn, 'number');
  assert.equal(JSON.parse(fs.readFileSync(baseFile, 'utf8')).at, j.turn);
  const was = await (await fetch(base + '/data')).json();
  assert.deepEqual(was.turn, { at: j.turn, nodes: [], links: [] });
  write(root, '02-study/b.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# b\n\n`02-study/a.md`\n');
  const now = await (await fetch(base + '/data')).json();
  assert.deepEqual(now.turn.nodes, ['02-study/b.md']);
  assert.deepEqual(now.turn.links, ['02-study/a.md|02-study/b.md']);
});

test('모양 3 프로젝트의 뷰어 댓글은 private/feedback에 쓴다', async () => {
  const r3 = makeProject('모양 3 서버');
  const p3 = await findFreePort(4240);
  writeConfig(r3, { port: p3, layout: 'wrapped', schema: 3, mode: 'project' });
  write(r3, '.siloroot/shared/ideas/a.md', '---\ntype: idea\nstatus: 아이디어\n---\n\n# a\n');
  const b3 = 'http://127.0.0.1:' + p3;
  const c3 = spawn(process.execPath, [SERVE, r3], { stdio: 'ignore' });
  try {
    await waitUp(b3 + '/health');
    const r = await fetch(b3 + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin: b3 }, body: JSON.stringify({ target: 'shared/ideas/a.md', body: '다시 보기' }) });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(j.path.startsWith('private/feedback/'), j.path);
    assert.ok(fs.existsSync(path.join(r3, '.siloroot', j.path)));
  } finally {
    c3.kill();
  }
});

test('서버가 켜진 채 모양 2에서 3으로 옮겨도 새 댓글은 private/feedback에 쓴다', async () => {
  const r = makeProject('옮기는 중 서버');
  const p = await findFreePort(4250);
  writeConfig(r, { port: p, layout: 'wrapped', schema: 2 });
  write(r, '.siloroot/03-ideas/a.md', '---\ntype: idea\nstatus: 아이디어\n---\n\n# a\n');
  const b = 'http://127.0.0.1:' + p;
  const c = spawn(process.execPath, [SERVE, r], { stdio: 'ignore' });
  try {
    await waitUp(b + '/health');
    // 업데이트(002)가 문서를 옮기고 설정을 모양 3으로 바꾼 뒤
    write(r, '.siloroot/shared/ideas/a.md', '---\ntype: idea\nstatus: 아이디어\n---\n\n# a\n');
    fs.rmSync(path.join(r, '.siloroot', '03-ideas'), { recursive: true });
    writeConfig(r, { port: p, layout: 'wrapped', schema: 3, mode: 'project' });
    const res = await fetch(b + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin: b }, body: JSON.stringify({ target: 'shared/ideas/a.md', body: '옮긴 뒤 댓글' }) });
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.ok(j.path.startsWith('private/feedback/'), j.path);
    assert.ok(!fs.existsSync(path.join(r, '.siloroot', '04-feedback')), '옛 댓글 폴더를 되살리지 않는다');
  } finally {
    c.kill();
  }
});
