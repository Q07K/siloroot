import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig, findFreePort, DEFAULT_DIRS } from '../lib/config.mjs';
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
