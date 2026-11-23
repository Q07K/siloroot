// 감싼 배치(wrapped): 문서가 프로젝트의 .siloroot/ 안에 있을 때 설정, 뷰어 빌드, 알림, 서버가 그 자리를 쓰는지 본다.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig, findFreePort } from '../lib/config.mjs';
import { makeProject, write } from './fixtures.mjs';

const V = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer');
const build = (root) => execFileSync(process.execPath, [path.join(V, 'build.mjs'), root], { encoding: 'utf8' });
const notify = (root, args = []) => execFileSync(process.execPath, [path.join(V, 'notify.mjs'), ...args], {
  encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root, VIEWER_AUTOSTART_DRY: '1' },
});
const dataOf = (root) => {
  const html = fs.readFileSync(path.join(root, '.siloroot', 'state', 'viewer-private.html'), 'utf8');
  return JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
};
const wrappedProject = (name, port = 4180) => { const root = makeProject(name); writeConfig(root, { port, layout: 'wrapped' }); return root; };

test('설정: layout이 wrapped면 문서 위치가 .siloroot/, 없으면 프로젝트 맨 위', () => {
  const a = wrappedProject();
  const ca = loadConfig(a);
  assert.equal(ca.layout, 'wrapped');
  assert.equal(ca.root, path.resolve(a));
  assert.equal(ca.docsRoot, path.join(path.resolve(a), '.siloroot'));
  assert.equal(ca.stateDir, path.join(path.resolve(a), '.siloroot', 'state'));
  const b = makeProject();
  writeConfig(b, { port: 4180 });
  const cb = loadConfig(b);
  assert.equal(cb.layout, 'flat');
  assert.equal(cb.docsRoot, path.resolve(b));
  assert.doesNotMatch(fs.readFileSync(path.join(b, '.siloroot', 'config.json'), 'utf8'), /layout/);
});

test('빌드: .siloroot/ 안 문서를 .siloroot/ 기준 경로로 읽고, 맨 위 문서와 state는 빼고, 연결을 잇는다', () => {
  const root = wrappedProject();
  write(root, '.siloroot/02-study/a.md', '---\ntype: study\nstatus: 검증 전\ncreated: 2026-11-23\nrelated: [02-study/b.md]\ntags: [백엔드]\n---\n\n# a\n\n`02-study/b.md` 참고\n');
  write(root, '.siloroot/02-study/b.md', '---\ntype: study\nstatus: 검증 전\ncreated: 2026-11-23\nrelated: [02-study/a.md]\ntags: [백엔드]\n---\n\n# b\n');
  write(root, 'README.md', '# 팀 README\n');
  write(root, 'docs/api.md', '# API\n');
  build(root);
  write(root, '.siloroot/state/stray.md', '# 생성물 폴더의 문서\n');
  build(root);
  const d = dataOf(root);
  const paths = d.docs.map((x) => x.path).sort();
  assert.deepEqual(paths, ['02-study/a.md', '02-study/b.md']);
  assert.ok(d.edges.some((e) => [e.source, e.target, e.from, e.to].includes('02-study/b.md')), '연결이 이어진다');
  assert.equal(d.root, path.basename(root), '화면 이름은 프로젝트 이름');
});

test('알림: 피드백 경로 앞에 .siloroot/를 붙여 Claude가 열 수 있게 한다', () => {
  const root = wrappedProject();
  write(root, '.siloroot/04-feedback/2026-11-23-001.md', '---\ntype: feedback\nstatus: 대기\nrelated: [02-study/a.md]\n---\n\n# 피드백\n');
  const out = JSON.parse(notify(root, ['--session']));
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.match(ctx, /\.siloroot\/04-feedback\/2026-11-23-001\.md/);
  assert.match(ctx, /대상 \.siloroot\/02-study\/a\.md/);
});

let root, port, child, base;
async function waitUp(url, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* 아직 */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('서버가 뜨지 않음');
}
const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(body) });

before(async () => {
  port = await findFreePort(4260);
  root = wrappedProject('감싼 서버 시험 폴더', port);
  write(root, '.siloroot/02-study/a.md', '---\ntype: study\nstatus: 검증 전\n---\n\n# a\n');
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, [path.join(V, 'serve.mjs'), root], { stdio: 'ignore' });
  await waitUp(base + '/health');
});
after(() => { child.kill(); });

test('서버: /health의 root는 프로젝트 폴더다', async () => {
  const j = await (await fetch(base + '/health')).json();
  assert.equal(j.root, path.resolve(root));
});

test('서버: 댓글은 .siloroot/ 안의 feedback 폴더에 생긴다', async () => {
  const r = await post('/api/feedback', { target: '02-study/a.md', body: '여기 다시 보기' });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok(j.path.startsWith('04-feedback/'));
  assert.ok(fs.existsSync(path.join(root, '.siloroot', j.path)));
  assert.ok(!fs.existsSync(path.join(root, '04-feedback')), '맨 위에 feedback 폴더를 만들지 않는다');
});

test('서버: 생성물 폴더(state)의 문서는 웹에서 고칠 수 없다', async () => {
  const r = await post('/api/save', { path: 'state/x.md', text: '# x\n' });
  assert.equal(r.status, 400);
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', 'state', 'x.md')));
});
