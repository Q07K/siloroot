import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject } from '../scripts/init.mjs';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED = [
  'CLAUDE.md', 'metadata-guide.md', 'writing-guide.md',
  '01-log/changelog.md', '01-log/open-questions.md',
  '02-study/README.md', '03-ideas/README.md', '04-feedback/README.md',
  '.gitignore', '.siloroot/config.json',
];
const mtimes = (root) => Object.fromEntries(EXPECTED.map((r) => [r, fs.statSync(path.join(root, r)).mtimeMs]));
const START = '<!-- siloroot:start -->';
const count = (s, sub) => s.split(sub).length - 1;

test('빈 폴더에 뼈대 10개를 만들고 뷰어 점검 경고가 0개다', async () => {
  const root = makeProject();
  const res = await initProject(root);
  assert.deepEqual([...res.created].sort(), [...EXPECTED].sort());
  assert.equal(res.url, 'http://127.0.0.1:' + res.port);
  const out = execFileSync(process.execPath, [path.join(REPO, 'viewer', 'build.mjs'), root], { encoding: 'utf8' });
  assert.match(out, /속성 점검: 경고 0개/);
});

test('두 번째 실행은 아무것도 만들거나 고치지 않는다', async () => {
  const root = makeProject();
  await initProject(root);
  const before = mtimes(root);
  await new Promise((r) => setTimeout(r, 30));
  const res = await initProject(root);
  assert.deepEqual(res.created, []);
  assert.deepEqual(mtimes(root), before);
});

test('BOM과 CRLF로 된 기존 CLAUDE.md는 원래 바이트를 지키고 블록은 한 번만', async () => {
  const root = makeProject();
  const original = '﻿# 내 규칙\r\n본문\r\n';
  write(root, 'CLAUDE.md', original);
  await initProject(root);
  await initProject(root);
  const now = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.ok(now.startsWith(original));
  assert.equal(count(now, START), 1);
});

test('이미 있는 공부 README는 건너뛰고 내용을 지킨다', async () => {
  const root = makeProject();
  write(root, '02-study/README.md', '# 내 공부 목록\n');
  const res = await initProject(root);
  assert.ok(res.skipped.includes('02-study/README.md'));
  assert.equal(fs.readFileSync(path.join(root, '02-study/README.md'), 'utf8'), '# 내 공부 목록\n');
});

test('설정에 있던 포트는 다시 실행해도 그대로', async () => {
  const root = makeProject();
  writeConfig(root, { port: 4199 });
  const res = await initProject(root);
  assert.equal(res.port, 4199);
  assert.equal(loadConfig(root).port, 4199);
});

test('템플릿, 스킬, README에 개인 정보 금지어가 없다', () => {
  // 금지어는 저장소에 올리지 않는 로컬 파일(test/banned-words.local.txt, 한 줄에 하나)에서 읽는다.
  const BANNED_FILE = path.join(REPO, 'test', 'banned-words.local.txt');
  const BANNED = fs.existsSync(BANNED_FILE) ? fs.readFileSync(BANNED_FILE, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const files = [];
  for (const dir of ['templates', 'skills']) {
    const abs = path.join(REPO, dir);
    if (fs.existsSync(abs)) for (const f of fs.readdirSync(abs, { recursive: true })) if (fs.statSync(path.join(abs, f)).isFile()) files.push(path.join(abs, f));
  }
  if (fs.existsSync(path.join(REPO, 'README.md'))) files.push(path.join(REPO, 'README.md'));
  assert.ok(files.length > 0);
  const hits = [];
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    for (const w of BANNED) if (t.toLowerCase().includes(w.toLowerCase())) hits.push(path.relative(REPO, f) + ': ' + w);
  }
  assert.deepEqual(hits, []);
});
