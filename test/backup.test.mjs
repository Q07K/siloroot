import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBackup, sealBackup, listBackups, restoreBackup, pruneBackups } from '../lib/backup.mjs';
import { makeProject, write } from './fixtures.mjs';

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const BK = (root) => path.join(root, '.siloroot', 'state', 'backups');

// 옛 자리 02-study/a.md를 .siloroot/02-study/a.md로 옮기고 notes.md를 고친 업데이트를 흉내 낸다
function fakeUpdate() {
  const root = makeProject();
  write(root, '02-study/a.md', 'A 원래');
  write(root, 'notes.md', 'N 원래');
  write(root, '.siloroot/state/viewer.html', '생성물');
  const { name } = createBackup(root, { from: 1, to: 2, files: ['02-study', 'notes.md'], creates: ['.siloroot/02-study'] });
  fs.mkdirSync(path.join(root, '.siloroot', '02-study'), { recursive: true });
  fs.renameSync(path.join(root, '02-study', 'a.md'), path.join(root, '.siloroot', '02-study', 'a.md'));
  fs.rmdirSync(path.join(root, '02-study'));
  write(root, 'notes.md', 'N 바뀜');
  sealBackup(root, name);
  return { root, name };
}

test('백업 → 바꾸기 → 되돌리기로 원래대로', () => {
  const { root, name } = fakeUpdate();
  assert.ok(!fs.existsSync(path.join(BK(root), name, 'files', '.siloroot', 'state')), 'state/는 담지 않는다');
  const res = restoreBackup(root, name);
  assert.deepEqual(res.conflicts, []);
  assert.equal(read(root, '02-study/a.md'), 'A 원래');
  assert.equal(read(root, 'notes.md'), 'N 원래');
  assert.ok(!exists(root, '.siloroot/02-study'), '업데이트가 만든 것은 지운다');
  assert.ok(res.removed.includes('.siloroot/02-study/a.md'));
  assert.ok(fs.existsSync(path.join(BK(root), name + '.restored')));
  assert.deepEqual(listBackups(root), []);
});

test('업데이트 뒤 고친 파일이 있으면 되돌리기가 멈춘다', () => {
  const { root, name } = fakeUpdate();
  write(root, '.siloroot/02-study/a.md', 'A 업데이트 뒤 고침');
  write(root, '.siloroot/02-study/new.md', '업데이트 뒤 새로 씀');
  const res = restoreBackup(root, name);
  assert.deepEqual([...res.conflicts].sort(), ['.siloroot/02-study/a.md', '.siloroot/02-study/new.md']);
  assert.deepEqual(res.restored, []);
  assert.equal(read(root, '.siloroot/02-study/a.md'), 'A 업데이트 뒤 고침');
  assert.equal(read(root, 'notes.md'), 'N 바뀜');
  assert.equal(listBackups(root)[0].name, name);
});

test('force면 고친 파일을 after-update에 남기고 되돌린다', () => {
  const { root, name } = fakeUpdate();
  write(root, '.siloroot/02-study/a.md', 'A 업데이트 뒤 고침');
  const res = restoreBackup(root, name, { force: true });
  assert.ok(res.keptAfter);
  assert.equal(fs.readFileSync(path.join(res.keptAfter, '.siloroot', '02-study', 'a.md'), 'utf8'), 'A 업데이트 뒤 고침');
  assert.equal(read(root, '02-study/a.md'), 'A 원래');
});

test('최신이 아닌 백업은 되돌리지 않는다', () => {
  const root = makeProject();
  write(root, 'x.md', '1');
  const older = createBackup(root, { from: 2, to: 2, files: ['x.md'], creates: [] }).name;
  sealBackup(root, older);
  const newer = createBackup(root, { from: 2, to: 2, files: ['x.md'], creates: [] }).name;
  sealBackup(root, newer);
  assert.notEqual(older, newer);
  assert.equal(listBackups(root)[0].name, newer);
  assert.throws(() => restoreBackup(root, older), /not-latest/);
});

test('맞추기 백업은 5개만, 모양 바꾼 백업은 남긴다', () => {
  const root = makeProject();
  write(root, 'x.md', '1');
  const schemaChange = createBackup(root, { from: 1, to: 2, files: ['x.md'], creates: [] }).name;
  for (let i = 0; i < 7; i++) createBackup(root, { from: 2, to: 2, files: ['x.md'], creates: [] });
  const removed = pruneBackups(root);
  assert.equal(removed.length, 2);
  const left = listBackups(root);
  assert.equal(left.length, 6);
  assert.ok(left.some((b) => b.name === schemaChange));
  assert.ok(left.every((b) => !removed.includes(b.name)));
});
