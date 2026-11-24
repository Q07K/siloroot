import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, write } from './fixtures.mjs';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import {
  trailDir, toDocPath, docPathsInCommand, entriesFromHook, safeSession,
  appendTrail, resetTrail, readTrail, latestTrail,
} from '../lib/trail.mjs';

const win = process.platform === 'win32';

// 감싼 배치 프로젝트: 문서는 .siloroot/ 안에 있다.
function project() {
  const root = makeProject();
  writeConfig(root, { port: 4250, layout: 'wrapped' });
  const a = write(root, '.siloroot/03-ideas/a.md', '# a\n');
  write(root, '.siloroot/CLAUDE.md', '# 규칙\n');
  return { root, a, cfg: loadConfig(root) };
}

const toMsys = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/');

test('toDocPath는 문서 위치 안의 md만 상대 경로로 바꾼다', () => {
  const { root, a, cfg } = project();
  assert.equal(toDocPath(cfg, a), '03-ideas/a.md');
  assert.equal(toDocPath(cfg, '.siloroot/03-ideas/a.md'), '03-ideas/a.md');
  assert.equal(toDocPath(cfg, path.join(root, 'src', 'x.md')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', 'state', 'trail', 'x.md')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', '03-ideas', 'a.txt')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', '_draft', 'b.md')), null);
});

test('toDocPath는 드라이브 글자 대소문자와 구분자가 달라도 같은 문서로 본다', (t) => {
  if (!win) return t.skip('win32 전용');
  const { a, cfg } = project();
  const c = a[0];
  const flipped = (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) + a.slice(1).replace(/\\/g, '/');
  assert.equal(toDocPath(cfg, flipped), '03-ideas/a.md');
});

test('docPathsInCommand는 명령 속 문서 경로만 찾는다', () => {
  const { cfg } = project();
  assert.deepEqual(
    docPathsInCommand(cfg, 'cat .siloroot/03-ideas/a.md && sed -n 1,5p ".siloroot/CLAUDE.md"; ls .siloroot/03-ideas'),
    ['03-ideas/a.md', 'CLAUDE.md'],
  );
  assert.deepEqual(docPathsInCommand(cfg, 'cat .siloroot/03-ideas/zz.md'), []);
  assert.deepEqual(docPathsInCommand(cfg, 'cat .siloroot/03-ideas/a.md .siloroot/03-ideas/a.md'), ['03-ideas/a.md']);
});

test('docPathsInCommand는 문서 위치 기준 경로와 cwd 기준 경로도 찾는다', () => {
  const { root, cfg } = project();
  write(root, '.siloroot/02-study/b.md', '# b\n');
  assert.deepEqual(docPathsInCommand(cfg, `cd "${path.join(root, '.siloroot')}" && cat 02-study/b.md`), ['02-study/b.md']);
  assert.deepEqual(docPathsInCommand(cfg, 'cat a.md', path.join(root, '.siloroot', '03-ideas')), ['03-ideas/a.md']);
});

test('docPathsInCommand는 MSYS 절대 경로를 알아본다', (t) => {
  if (!win) return t.skip('win32 전용');
  const { a, cfg } = project();
  assert.deepEqual(docPathsInCommand(cfg, `cat "${toMsys(a)}"`), ['03-ideas/a.md']);
});

test('entriesFromHook는 도구별로 kind를 정한다', () => {
  const { a, cfg } = project();
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'Read', tool_input: { file_path: a } }), [{ kind: 'read', path: '03-ideas/a.md' }]);
  for (const tool of ['Edit', 'Write', 'MultiEdit']) {
    assert.deepEqual(entriesFromHook(cfg, { tool_name: tool, tool_input: { file_path: a } }), [{ kind: 'edit', path: '03-ideas/a.md' }]);
  }
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'NotebookEdit', tool_input: { notebook_path: a } }), [{ kind: 'edit', path: '03-ideas/a.md' }]);
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'Grep', tool_input: { path: a } }), []);
  assert.deepEqual(
    entriesFromHook(cfg, { tool_name: 'Read', tool_input: { file_path: a }, agent_id: 'sub1' }),
    [{ kind: 'read', path: '03-ideas/a.md', agent: 'sub1' }],
  );
  assert.deepEqual(
    entriesFromHook(cfg, { tool_name: 'Bash', tool_input: { command: 'cat .siloroot/CLAUDE.md' }, cwd: cfg.root }),
    [{ kind: 'read', path: 'CLAUDE.md' }],
  );
});

test('safeSession는 경로 글자가 든 id를 받지 않는다', () => {
  assert.equal(safeSession('abc-123_x'), 'abc-123_x');
  for (const bad of ['../x', 'a\\b', '', 'a'.repeat(129), undefined, 42]) assert.equal(safeSession(bad), null);
});

test('appendTrail과 latestTrail로 순서대로 읽는다', () => {
  const { cfg } = project();
  appendTrail(cfg, 's1', [{ kind: 'read', path: 'CLAUDE.md' }], 1000);
  appendTrail(cfg, 's1', [{ kind: 'edit', path: '03-ideas/a.md' }], 2000);
  const got = latestTrail(cfg);
  assert.equal(got.session, 's1');
  assert.deepEqual(got.items, [
    { ts: 1000, kind: 'read', path: 'CLAUDE.md' },
    { ts: 2000, kind: 'edit', path: '03-ideas/a.md' },
  ]);
  appendTrail(cfg, 's2', [{ kind: 'read', path: '03-ideas/a.md' }], 3000);
  const later = new Date(Date.now() + 1000);
  fs.utimesSync(path.join(trailDir(cfg), 's2.jsonl'), later, later);
  assert.equal(latestTrail(cfg).session, 's2');
});

test('readTrail은 깨진 줄을 건너뛴다', () => {
  const { cfg } = project();
  const file = path.join(trailDir(cfg), 'x.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"ts":1,"kind":"read","path":"a.md"}\n{"ts":2,"ki\n');
  assert.deepEqual(readTrail(file), [{ ts: 1, kind: 'read', path: 'a.md' }]);
});

test('resetTrail은 세션 파일을 비우고 7일 넘은 다른 파일을 지운다', () => {
  const { cfg } = project();
  const dir = trailDir(cfg);
  for (const s of ['s1', 'old', 'recent']) appendTrail(cfg, s, [{ kind: 'read', path: 'CLAUDE.md' }]);
  const day = 24 * 3600 * 1000;
  const ago = (d) => new Date(Date.now() - d * day);
  fs.utimesSync(path.join(dir, 'old.jsonl'), ago(8), ago(8));
  fs.utimesSync(path.join(dir, 'recent.jsonl'), ago(6), ago(6));
  resetTrail(cfg, 's1');
  assert.equal(fs.statSync(path.join(dir, 's1.jsonl')).size, 0);
  assert.equal(fs.existsSync(path.join(dir, 'old.jsonl')), false);
  assert.equal(fs.existsSync(path.join(dir, 'recent.jsonl')), true);
});

test('resetTrail은 흔적 파일이 없는 세션의 파일을 만들지 않는다', () => {
  const { cfg } = project();
  resetTrail(cfg, 'none');
  assert.equal(fs.existsSync(path.join(trailDir(cfg), 'none.jsonl')), false);
});

test('흔적 폴더가 없으면 latestTrail은 빈 흔적을 준다', () => {
  const { cfg } = project();
  assert.deepEqual(latestTrail(cfg), { session: null, items: [] });
});
