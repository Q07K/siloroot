import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, writeConfig, updateConfig, pluginVersion, findFreePort, DEFAULT_DIRS } from '../lib/config.mjs';
import { makeProject, write } from './fixtures.mjs';

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

test('schema가 없으면 layout으로 추정한다', () => {
  const a = makeProject(); writeConfig(a, { port: 4180, layout: 'wrapped' });
  assert.equal(loadConfig(a).schema, 2);
  const b = makeProject(); writeConfig(b, { port: 4180 });
  assert.equal(loadConfig(b).schema, 1);
  assert.equal(loadConfig(b).plugin, null);
  assert.equal(loadConfig(b).hold, null);
});

test('writeConfig에 schema와 plugin을 주면 적는다', () => {
  const r = makeProject(); writeConfig(r, { port: 4180, layout: 'wrapped', schema: 2, plugin: '9.9.9' });
  const c = loadConfig(r);
  assert.equal(c.schema, 2); assert.equal(c.plugin, '9.9.9');
});

test('updateConfig는 모르는 칸과 BOM 있는 파일을 지키고 null 칸을 지운다', () => {
  const r = makeProject();
  write(r, '.siloroot/config.json', '﻿' + JSON.stringify({ version: 1, port: 4181, metrics: false, hold: 2 }));
  updateConfig(r, { schema: 2, plugin: '0.4.0', hold: null });
  const raw = JSON.parse(fs.readFileSync(path.join(r, '.siloroot', 'config.json'), 'utf8'));
  assert.deepEqual(raw, { version: 1, port: 4181, metrics: false, schema: 2, plugin: '0.4.0' });
});

test('pluginVersion은 plugin.json의 버전', () => {
  assert.match(pluginVersion(), /^\d+\.\d+\.\d+$/);
});
