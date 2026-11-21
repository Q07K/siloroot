import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig } from '../lib/config.mjs';
import { makeProject, write } from './fixtures.mjs';

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'viewer', 'build.mjs');
const build = (root) => execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8' });
const dataOf = (root) => {
  const html = fs.readFileSync(path.join(root, '.siloroot', 'state', 'viewer-private.html'), 'utf8');
  const m = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
};

test('설정의 study 폴더에서 공부 노트와 이해도를 읽는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180, dirs: { study: '02-study' } });
  write(root, '02-study/radius.md', '---\ntype: study\nstatus: 통과\ncreated: 2026-11-22\n---\n\n# radius\n');
  write(root, '02-study/README.md', '---\ntype: index\nstatus: 사용 중\n---\n\n# 공부\n\n| 주제 | 처음 본 날 | 이해도 | 관련 |\n| --- | --- | --- | --- |\n| [radius](radius.md) | 2026-11-22 | 통과 | 없음 |\n');
  build(root);
  const d = dataOf(root);
  assert.equal(d.objects.study.length, 1);
  assert.equal(d.objects.study[0].level, '통과');
});

test('ideas 폴더 문서의 type이 idea가 아니면 경고', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '03-ideas/a.md', '---\ntype: study\nstatus: 통과\n---\n\n# a\n');
  const out = build(root);
  assert.match(out, /이 폴더의 type은 idea여야 함/);
});

test('결과물은 .siloroot/state에 쓰고 _viewer는 만들지 않는다', () => {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  build(root);
  assert.ok(fs.existsSync(path.join(root, '.siloroot', 'state', 'viewer-private.html')));
  assert.ok(!fs.existsSync(path.join(root, '_viewer')));
});

test('빈 폴더도 경고 0개로 만들고 장부 주장은 비어 있다', () => {
  const root = makeProject();
  const out = build(root);
  assert.match(out, /속성 점검: 경고 0개/);
  assert.deepEqual(dataOf(root).objects.claims, []);
});
