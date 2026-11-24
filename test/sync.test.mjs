import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../scripts/init.mjs';
import { loadConfig } from '../lib/config.mjs';
import { planRefresh, applyRefresh } from '../lib/workspace-sync.mjs';
import { makeProject } from './fixtures.mjs';

const listAll = (root) => fs.readdirSync(root, { recursive: true }).map(String).sort();

test('planRefresh는 파일을 바꾸지 않고 바뀔 블록과 빠진 파일을 알린다', async () => {
  const root = makeProject();
  await initProject(root);
  fs.rmSync(path.join(root, '.siloroot', '03-ideas', 'README.md'));
  const cfgFile = path.join(root, '.siloroot', 'CLAUDE.md');
  fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace('흐름 나누기', '옛 이름'));
  const before = listAll(root);
  const p = planRefresh(root, loadConfig(root));
  assert.deepEqual(listAll(root), before);
  assert.ok(p.missingFiles.includes('.siloroot/03-ideas/README.md'));
  assert.equal(p.blocks.find((b) => b.file === '.siloroot/CLAUDE.md').state, 'updated');
});

test('새로 init한 작업 공간은 planRefresh에 맞출 것이 없다', async () => {
  const root = makeProject();
  await initProject(root);
  const p = planRefresh(root, loadConfig(root));
  assert.ok(p.blocks.every((b) => b.state === 'skipped'));
  assert.deepEqual(p.missingFiles, []);
  assert.deepEqual(p.missingLines, []);
  assert.deepEqual(p.guideGaps, []);
});

test('applyRefresh는 빠진 파일을 만들고 블록을 맞추며 거절한 안내 줄은 빼고 알린다', async () => {
  const root = makeProject();
  await initProject(root);
  fs.rmSync(path.join(root, '.siloroot', '03-ideas', 'README.md'));
  const guide = path.join(root, '.siloroot', 'metadata-guide.md');
  const original = fs.readFileSync(guide, 'utf8');
  fs.writeFileSync(guide, original.split('\n').filter((l) => !l.includes('`trait`')).join('\n'));
  const gaps = planRefresh(root, loadConfig(root)).guideGaps;
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].file, '.siloroot/metadata-guide.md');
  const res = applyRefresh(root, loadConfig(root), { declined: { '.siloroot/metadata-guide.md': gaps[0].items } });
  assert.ok(res.created.includes('.siloroot/03-ideas/README.md'));
  assert.ok(!fs.readFileSync(guide, 'utf8').includes('`trait`'), '안내 문서는 덮어쓰지 않는다');
  assert.deepEqual(planRefresh(root, loadConfig(root), { declined: { '.siloroot/metadata-guide.md': gaps[0].items } }).guideGaps, []);
});
