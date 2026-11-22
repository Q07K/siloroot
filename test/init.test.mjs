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
  '02-study/README.md', '03-ideas/README.md', '04-feedback/README.md', '05-profile/profile.md',
  '.gitignore', '.siloroot/config.json',
];
const mtimes = (root) => Object.fromEntries(EXPECTED.map((r) => [r, fs.statSync(path.join(root, r)).mtimeMs]));
const START = '<!-- siloroot:start -->';
const count = (s, sub) => s.split(sub).length - 1;

test('빈 폴더에 뼈대 11개를 만들고 뷰어 점검 경고가 0개다', async () => {
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
  const READMES = ['README.md', 'README.ko.md'].map((f) => path.join(REPO, f)).filter((f) => fs.existsSync(f));
  files.push(...READMES);
  assert.ok(files.length > 0);
  // README는 설치 안내에 저장소 주소를 적어야 하므로, plugin.json repository의 소유자 이름만 README에서 허용한다.
  const repoUrl = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).repository || '';
  const owner = ((repoUrl.match(/github\.com\/([^/]+)\//) || [])[1] || '').toLowerCase();
  const hits = [];
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    const allowed = READMES.includes(f) && owner ? [owner] : [];
    for (const w of BANNED) if (!allowed.includes(w.toLowerCase()) && t.toLowerCase().includes(w.toLowerCase())) hits.push(path.relative(REPO, f) + ': ' + w);
  }
  assert.deepEqual(hits, []);
});

test('영어, 한국어 README가 둘 다 있고 서로를 가리킨다', () => {
  const en = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  const ko = fs.readFileSync(path.join(REPO, 'README.ko.md'), 'utf8');
  assert.match(en, /\(README\.ko\.md\)/);
  assert.match(ko, /\(README\.md\)/);
  const headings = (t) => t.split('\n').filter((l) => /^##\s/.test(l)).length;
  assert.equal(headings(en), headings(ko), '두 README의 ## 절 개수가 같아야 한다');
});

test('끝 표시가 없는 CLAUDE.md는 건드리지 않고 경고로 알린다', async () => {
  const root = makeProject();
  const original = '# 내 규칙\n\n<!-- siloroot:start -->\n옛 블록\n\nMY OWN RULES KEEP\n';
  write(root, 'CLAUDE.md', original);
  const r1 = await initProject(root);
  await initProject(root);
  assert.equal(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), original);
  assert.ok(r1.warnings.some((w) => w.includes('CLAUDE.md')));
});

test('CLAUDE.md 블록은 실행할 수 없는 "뷰어 다시 만들기" 대신 뷰어의 속성 점검 화면을 가리킨다', () => {
  const block = fs.readFileSync(path.join(REPO, 'templates', 'CLAUDE.block.md'), 'utf8');
  assert.doesNotMatch(block, /뷰어를 다시 만들어/);
  assert.match(block, /속성 점검/);
});

test('CLAUDE.md 블록이 사용자 정보 파일을 불러오고, 그 파일은 빈 표 세 개로 시작한다', async () => {
  const root = makeProject();
  await initProject(root);
  const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(md, /^@05-profile\/profile\.md$/m);
  const profile = fs.readFileSync(path.join(root, '05-profile', 'profile.md'), 'utf8');
  assert.equal(count(profile, '| 항목 | 내용 | 근거 | 승인 |'), 3);
});

test('이미 있는 안내 파일에 새 템플릿의 type 행이 빠졌으면 덮어쓰지 않고 경고로 알린다', async () => {
  const root = makeProject();
  await initProject(root);
  const file = path.join(root, 'metadata-guide.md');
  const old = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.includes('`trait`')).join('\n');
  fs.writeFileSync(file, old);
  const res = await initProject(root);
  assert.equal(fs.readFileSync(file, 'utf8'), old);
  assert.ok(res.warnings.some((w) => w.startsWith('metadata-guide.md') && w.includes('`trait`')));
  assert.ok(!res.warnings.some((w) => w.startsWith('04-feedback/README.md')));
});

test('다시 실행해도 템플릿과 같은 안내 파일에는 경고가 없다', async () => {
  const root = makeProject();
  await initProject(root);
  const res = await initProject(root);
  assert.deepEqual(res.warnings, []);
});

test('직접 지시도 후보 파일을 거쳐 profile.md에 들어간다고 CLAUDE.md 블록과 feedback 스킬이 말한다', () => {
  const block = fs.readFileSync(path.join(REPO, 'templates', 'CLAUDE.block.md'), 'utf8');
  const skill = fs.readFileSync(path.join(REPO, 'skills', 'feedback', 'SKILL.md'), 'utf8');
  const desc = (skill.match(/^description:\s*(.+)$/m) || [])[1] || '';
  for (const t of [block, desc]) assert.match(t, /"앞으로", "항상", "매번"/);
  assert.match(block, /후보 파일 없이 바로 쓰지 않는다/);
  assert.match(skill, /직접 지시는 그 말을 승인으로 본다/);
  assert.match(skill, /이 절차로만 줄을 더한다/);
});
