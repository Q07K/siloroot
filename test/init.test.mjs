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
const DOCS = [
  'CLAUDE.md', 'metadata-guide.md', 'writing-guide.md',
  '01-log/changelog.md', '01-log/open-questions.md',
  '02-study/README.md', '03-ideas/README.md', '04-feedback/README.md', '05-profile/profile.md',
  '.gitignore',
];
// 새 폴더(감싼 배치): 문서는 .siloroot/ 안, 맨 위에는 규칙을 불러오는 파일과 검색용 .ignore
const EXPECTED = [...DOCS.map((r) => '.siloroot/' + r), '.siloroot/config.json', 'CLAUDE.local.md', '.ignore'];
// 예전 배치(flat): 문서를 맨 위에 바로 둔다
const EXPECTED_FLAT = [...DOCS];
const mtimes = (root, list) => Object.fromEntries(list.map((r) => [r, fs.statSync(path.join(root, r)).mtimeMs]));
const START = '<!-- siloroot:start -->';
const count = (s, sub) => s.split(sub).length - 1;
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const git = (root, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
// 예전 배치로 초기화된 폴더를 흉내 낸다: layout이 없는 설정
const flatProject = (name) => { const root = makeProject(name); writeConfig(root, { port: 4198 }); return root; };

test('빈 폴더는 .siloroot/ 안에 뼈대를 만들고 뷰어 점검 경고가 0개다', async () => {
  const root = makeProject();
  const res = await initProject(root);
  assert.equal(res.layout, 'wrapped');
  assert.deepEqual([...res.created].sort(), [...EXPECTED].sort());
  assert.deepEqual(res.updated, []);
  assert.equal(res.url, 'http://127.0.0.1:' + res.port);
  assert.ok(!fs.existsSync(path.join(root, 'CLAUDE.md')), '팀이 쓰는 CLAUDE.md는 만들지 않는다');
  assert.ok(!fs.existsSync(path.join(root, '01-log')), '맨 위에 문서 폴더를 만들지 않는다');
  assert.equal(loadConfig(root).layout, 'wrapped');
  const out = execFileSync(process.execPath, [path.join(REPO, 'viewer', 'build.mjs'), root], { encoding: 'utf8' });
  assert.match(out, /속성 점검: 경고 0개/);
});

test('두 번째 실행은 아무것도 만들거나 고치지 않는다', async () => {
  const root = makeProject();
  await initProject(root);
  const before = mtimes(root, EXPECTED);
  await new Promise((r) => setTimeout(r, 30));
  const res = await initProject(root);
  assert.deepEqual(res.created, []);
  assert.deepEqual(res.updated, []);
  assert.deepEqual(mtimes(root, EXPECTED), before);
});

test('CLAUDE.local.md가 .siloroot/CLAUDE.md를 불러오고, 그 블록은 경로 기준과 검색 경로를 알린다', async () => {
  const root = makeProject();
  await initProject(root);
  assert.match(read(root, 'CLAUDE.local.md'), /^@\.siloroot\/CLAUDE\.md$/m);
  const md = read(root, '.siloroot/CLAUDE.md');
  assert.match(md, /^### 경로와 검색$/m);
  assert.match(md, /검색 경로를 `\.siloroot`로 준다/);
  assert.match(md, /^@05-profile\/profile\.md$/m, '문서 안 경로는 .siloroot/ 기준이라 앞에 붙이지 않는다');
  assert.match(md, /\| `config\.json`, `state\/` \|/);
  assert.doesNotMatch(md, /\{\{/);
  const profile = read(root, '.siloroot/05-profile/profile.md');
  assert.equal(count(profile, '| 항목 | 내용 | 근거 | 승인 |'), 3);
});

test('git 저장소에서는 팀 .gitignore를 그대로 두고 제외 목록에만 한 번씩 적는다', async () => {
  const root = makeProject();
  git(root, ['init', '-q']);
  write(root, '.gitignore', 'node_modules/\r\ndist/\r\n');
  write(root, 'src/app.js', 'console.log(1);\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'init']);
  const gitignore = read(root, '.gitignore');
  const res = await initProject(root);
  await initProject(root);
  assert.equal(read(root, '.gitignore'), gitignore);
  assert.equal(git(root, ['status', '--porcelain']), '', '바깥 저장소에는 바뀐 것이 보이지 않는다');
  const exclude = read(root, '.git/info/exclude');
  for (const line of ['.siloroot/', '.ignore', 'CLAUDE.local.md']) assert.equal(exclude.split(/\r?\n/).filter((l) => l === line).length, 1, line);
  assert.ok(res.updated.includes('.git/info/exclude') || res.created.includes('.git/info/exclude'));
  assert.deepEqual(res.notes, []);
});

test('git 저장소가 아니면 제외 목록은 쓰지 않고 알린다', async () => {
  const root = makeProject();
  const res = await initProject(root);
  assert.ok(res.notes.some((n) => n.includes('git 저장소가 아니어서')));
});

test('이미 있는 CLAUDE.md는 바이트 그대로, 이미 있는 CLAUDE.local.md와 .ignore는 원래 내용을 지키고 한 번만 더한다', async () => {
  const root = makeProject();
  write(root, 'CLAUDE.md', '# 팀 규칙\n');
  const local = '﻿# 내 메모\r\n본문\r\n';
  write(root, 'CLAUDE.local.md', local);
  write(root, '.ignore', 'build/\n');
  const r1 = await initProject(root);
  await initProject(root);
  assert.equal(read(root, 'CLAUDE.md'), '# 팀 규칙\n');
  const now = read(root, 'CLAUDE.local.md');
  assert.ok(now.startsWith(local));
  assert.equal(count(now, START), 1);
  assert.equal(count(now, '@.siloroot/CLAUDE.md'), 1);
  const ignore = read(root, '.ignore');
  assert.ok(ignore.startsWith('build/\n'));
  assert.equal(count(ignore, '!.siloroot/'), 1);
  assert.ok(r1.updated.includes('CLAUDE.local.md') && r1.updated.includes('.ignore'));
});

test('이미 있는 공부 README는 건너뛰고 내용을 지킨다', async () => {
  const root = makeProject();
  write(root, '.siloroot/02-study/README.md', '# 내 공부 목록\n');
  const res = await initProject(root);
  assert.ok(res.skipped.includes('.siloroot/02-study/README.md'));
  assert.equal(read(root, '.siloroot/02-study/README.md'), '# 내 공부 목록\n');
});

test('예전 배치로 초기화된 폴더는 그 배치를 따른다: 맨 위에 문서, .siloroot/ 안에는 설정만', async () => {
  const root = flatProject();
  const res = await initProject(root);
  assert.equal(res.layout, 'flat');
  assert.deepEqual([...res.created].sort(), [...EXPECTED_FLAT].sort());
  for (const rel of ['CLAUDE.local.md', '.ignore', '.siloroot/01-log', '.siloroot/CLAUDE.md']) assert.ok(!fs.existsSync(path.join(root, rel)), rel);
  const md = read(root, 'CLAUDE.md');
  assert.doesNotMatch(md, /### 경로와 검색/);
  assert.match(md, /\| `\.siloroot\/` \| 설정\(`config\.json`\)과 뷰어 생성물/);
  assert.match(md, /^@05-profile\/profile\.md$/m);
  assert.equal(read(root, '.gitignore').includes('.siloroot/state/'), true);
});

test('예전 배치: BOM과 CRLF로 된 기존 CLAUDE.md는 원래 바이트를 지키고 블록은 한 번만', async () => {
  const root = flatProject();
  const original = '﻿# 내 규칙\r\n본문\r\n';
  write(root, 'CLAUDE.md', original);
  await initProject(root);
  await initProject(root);
  const now = read(root, 'CLAUDE.md');
  assert.ok(now.startsWith(original));
  assert.equal(count(now, START), 1);
});

test('설정에 있던 포트는 다시 실행해도 그대로', async () => {
  const root = makeProject();
  writeConfig(root, { port: 4199, layout: 'wrapped' });
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
  write(root, '.siloroot/CLAUDE.md', original);
  const r1 = await initProject(root);
  await initProject(root);
  assert.equal(read(root, '.siloroot/CLAUDE.md'), original);
  assert.ok(r1.warnings.some((w) => w.includes('.siloroot/CLAUDE.md')));
});

test('CLAUDE.md 블록은 실행할 수 없는 "뷰어 다시 만들기" 대신 뷰어의 속성 점검 화면을 가리킨다', () => {
  const block = fs.readFileSync(path.join(REPO, 'templates', 'CLAUDE.block.md'), 'utf8');
  assert.doesNotMatch(block, /뷰어를 다시 만들어/);
  assert.match(block, /속성 점검/);
});

test('이미 있는 안내 파일에 새 템플릿의 type 행이 빠졌으면 덮어쓰지 않고 경고로 알린다', async () => {
  const root = makeProject();
  await initProject(root);
  const file = path.join(root, '.siloroot', 'metadata-guide.md');
  const old = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.includes('`trait`')).join('\n');
  fs.writeFileSync(file, old);
  const res = await initProject(root);
  assert.equal(fs.readFileSync(file, 'utf8'), old);
  assert.ok(res.warnings.some((w) => w.startsWith('.siloroot/metadata-guide.md') && w.includes('`trait`')));
  assert.ok(!res.warnings.some((w) => w.startsWith('.siloroot/04-feedback/README.md')));
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

test('세 스킬이 감싼 배치의 문서 위치를 알린다', () => {
  for (const s of ['note', 'verify', 'feedback']) {
    const t = fs.readFileSync(path.join(REPO, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(t, /"layout": "wrapped"/, s);
  }
});
