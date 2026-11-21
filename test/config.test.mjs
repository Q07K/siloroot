import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { loadConfig, writeConfig, findFreePort, DEFAULT_DIRS } from '../lib/config.mjs';
import { makeProject } from './fixtures.mjs';

test('설정이 없는 폴더는 null', () => {
  assert.equal(loadConfig(makeProject()), null);
});

test('writeConfig 뒤 loadConfig가 포트, 기본 폴더, 상태 폴더를 돌려준다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4190 });
  const cfg = loadConfig(root);
  assert.equal(cfg.port, 4190);
  assert.deepEqual(cfg.dirs, DEFAULT_DIRS);
  assert.equal(cfg.root, path.resolve(root));
  assert.equal(cfg.stateDir, path.join(path.resolve(root), '.siloroot', 'state'));
});

test('dirs 일부만 쓰면 나머지는 기본값', () => {
  const root = makeProject();
  writeConfig(root, { port: 4191, dirs: { study: '05-study' } });
  const cfg = loadConfig(root);
  assert.equal(cfg.dirs.study, '05-study');
  assert.equal(cfg.dirs.log, DEFAULT_DIRS.log);
  assert.equal(cfg.dirs.feedback, DEFAULT_DIRS.feedback);
});

test('쓰는 중인 포트는 건너뛴다', async () => {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(4180, '127.0.0.1', r)).catch(() => {});
  try {
    const port = await findFreePort(4180);
    assert.notEqual(port, 4180);
    assert.ok(port > 4180 && port <= 4299);
  } finally {
    srv.close();
  }
});
