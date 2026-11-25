import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject } from '../scripts/init.mjs';
import { planUpdate } from '../scripts/update.mjs';
import { loadConfig, writeConfig, pluginVersion } from '../lib/config.mjs';
import { userDir, userFile, readUser } from '../lib/user.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(REPO, 'viewer', 'build.mjs');
const INIT = path.join(REPO, 'scripts', 'init.mjs');
// 이 파일의 테스트는 사용자 폴더(임시) 하나와 그 아래 홈 하나를 같이 쓴다. 홈은 처음 만든 테스트가 만들고 뒤 테스트는 그대로 쓴다
const HOME = () => path.join(userDir(), 'siloroot-home');
const resetUser = () => fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
const initV3 = (root, opts = {}) => initProject(root, { home: HOME(), ...opts });

// 새 프로젝트(모양 4): 문서는 .siloroot/ 안의 shared/와 private/, 자리마다 README. 맨 위에는 규칙을 불러오는 파일과 검색용 .ignore
const SLOTS = ['shared/requirements', 'shared/ideas', 'shared/decisions', 'shared/design', 'shared/plans', 'shared/issues', 'shared/conventions',
  'private/worklog', 'private/sources', 'private/notes', 'private/discussions', 'private/feedback'];
const DOCS = ['CLAUDE.md', 'metadata-guide.md', 'shared/README.md', 'private/README.md', 'shared/roadmap.md', 'shared/architecture.md',
  'private/open-questions.md', ...SLOTS.map((d) => d + '/README.md')];
const DIRS = [];
const SHARED_DOCS = DOCS.filter((d) => d.startsWith('shared/')).map((d) => '.siloroot/' + d).sort();
const EXPECTED = [...DOCS, ...DIRS].map((r) => '.siloroot/' + r).concat(['.siloroot/config.json', 'CLAUDE.local.md', '.ignore']);
const EXPECTED_FILES = EXPECTED.filter((r) => !r.endsWith('/'));
// 예전 배치(flat, 모양 1): 문서를 맨 위에 바로 둔다
const EXPECTED_FLAT = [
  'CLAUDE.md', 'metadata-guide.md', 'writing-guide.md',
  '01-log/changelog.md', '01-log/open-questions.md',
  '02-study/README.md', '03-ideas/README.md', '04-feedback/README.md', '05-profile/profile.md',
  '.gitignore',
];
const mtimes = (root, list) => Object.fromEntries(list.map((r) => [r, fs.statSync(path.join(root, r)).mtimeMs]));
const START = '<!-- siloroot:start -->';
const count = (s, sub) => s.split(sub).length - 1;
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const git = (root, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
// 예전 배치로 초기화된 폴더를 흉내 낸다: layout이 없는 설정
const flatProject = (name) => { const root = makeProject(name); writeConfig(root, { port: 4198 }); return root; };

test('홈이 없고 --home도 없으면 need-home을 내고 아무것도 만들지 않는다', async () => {
  resetUser();
  const root = makeProject(); const res = await initProject(root);
  assert.equal(res.error, 'need-home'); assert.ok(res.defaultHome.endsWith('/siloroot-home'));
  assert.deepEqual(fs.readdirSync(root), []);
  assert.ok(!fs.existsSync(userFile()));
});

test('첫 프로젝트는 홈과 프로젝트를 만들고 user.json에 적는다', async () => {
  resetUser(); fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject('앱'), home = HOME();
  const res = await initProject(root, { home });
  assert.equal(res.homeCreated, true); assert.equal(res.name, '앱'); assert.equal(res.homeAccess, 'not-asked');
  assert.equal(loadConfig(home).mode, 'home'); assert.equal(loadConfig(home).layout, 'flat');
  assert.equal(loadConfig(root).mode, 'project'); assert.equal(loadConfig(root).schema, 4);
  assert.ok(fs.existsSync(path.join(home, 'profile.md'))); assert.ok(fs.existsSync(path.join(root, '.siloroot', 'shared', 'issues')));
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', '01-log')));
  assert.equal(readUser().home, home.split(path.sep).join('/'));
  assert.deepEqual(readUser().projects.map((p) => p.name), ['앱']);
  for (const r of [root, home]) assert.match(execFileSync(process.execPath, [BUILD, r], { encoding: 'utf8' }), /속성 점검: 경고 0개/);
});

test('새로 init한 프로젝트와 홈은 업데이트할 것이 없다', async () => {
  const root = makeProject(); await initV3(root);
  for (const r of [root, HOME()]) {
    const p = planUpdate(r);
    assert.equal(p.upToDate, true, r); assert.deepEqual(p.migrations, []); assert.equal(p.to, 4);
  }
});

test('두 번째 프로젝트는 홈을 다시 만들지 않고 홈 포트를 피한다', async () => {
  const a = await initV3(makeProject('a')); const b = await initProject(makeProject('b'));
  assert.equal(b.homeCreated, false); assert.notEqual(b.port, loadConfig(HOME()).port); assert.notEqual(b.port, a.port);
});

test('빈 폴더는 .siloroot/ 안에 뼈대를 만들고 뷰어 점검 경고가 0개다', async () => {
  const root = makeProject();
  const res = await initV3(root);
  assert.equal(res.layout, 'wrapped');
  assert.deepEqual([...res.created].sort(), [...EXPECTED].sort());
  assert.deepEqual(res.updated, []);
  assert.equal(res.url, 'http://127.0.0.1:' + res.port);
  assert.ok(!fs.existsSync(path.join(root, 'CLAUDE.md')), '팀이 쓰는 CLAUDE.md는 만들지 않는다');
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', '.gitignore')), '제외는 .git/info/exclude 한 곳에서 한다');
  const out = execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8' });
  assert.match(out, /속성 점검: 경고 0개/);
});

test('두 번째 실행은 아무것도 만들거나 고치지 않는다', async () => {
  const root = makeProject();
  await initV3(root);
  const before = mtimes(root, EXPECTED_FILES);
  await new Promise((r) => setTimeout(r, 30));
  const res = await initV3(root);
  assert.deepEqual(res.created, []);
  assert.deepEqual(res.updated, []);
  assert.deepEqual(res.warnings, []);
  assert.deepEqual(mtimes(root, EXPECTED_FILES), before);
});

test('CLAUDE.local.md가 .siloroot/CLAUDE.md를 불러오고, 그 블록은 경로 기준과 홈 사용자 정보를 알린다', async () => {
  const root = makeProject();
  await initV3(root);
  assert.match(read(root, 'CLAUDE.local.md'), /^@\.siloroot\/CLAUDE\.md$/m);
  const md = read(root, '.siloroot/CLAUDE.md');
  assert.match(md, /^### 경로와 검색$/m);
  assert.match(md, /검색 경로를 `\.siloroot`로 준다/);
  assert.match(md, /^@~\/siloroot-home\/profile\.md$/m, '홈 사용자 정보는 사용자 폴더 기준 ~/ 꼴로 불러온다');
  assert.match(md, /`config\.json`, `state\/`/);
  assert.doesNotMatch(md, /\{\{/);
  assert.equal(count(read(HOME(), 'profile.md'), '| 항목 | 내용 | 근거 | 승인 |'), 3);
});

test('git 저장소에서는 팀 .gitignore를 그대로 두고 제외 목록에만 한 번씩 적으며 shared/만 보인다', async () => {
  const root = makeProject();
  git(root, ['init', '-q']);
  write(root, '.gitignore', 'node_modules/\r\ndist/\r\n');
  write(root, 'src/app.js', 'console.log(1);\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'init']);
  const gitignore = read(root, '.gitignore');
  const res = await initV3(root);
  await initV3(root);
  assert.equal(read(root, '.gitignore'), gitignore);
  const st = git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, ''));
  assert.deepEqual(st.sort(), SHARED_DOCS, '바깥 저장소에는 shared/ 아래만 보인다');
  const exclude = read(root, '.git/info/exclude');
  for (const line of ['.siloroot/*', '!.siloroot/shared/', '.ignore', 'CLAUDE.local.md']) assert.equal(exclude.split(/\r?\n/).filter((l) => l === line).length, 1, line);
  assert.ok(res.updated.includes('.git/info/exclude') || res.created.includes('.git/info/exclude'));
  assert.deepEqual(res.notes, []);
});

test('git 저장소가 아니면 제외 목록은 쓰지 않고 알린다', async () => {
  const root = makeProject();
  const res = await initV3(root);
  assert.ok(res.notes.some((n) => n.includes('git 저장소가 아니어서')));
});

test('이미 있는 CLAUDE.md는 바이트 그대로, 이미 있는 CLAUDE.local.md와 .ignore는 원래 내용을 지키고 한 번만 더한다', async () => {
  const root = makeProject();
  write(root, 'CLAUDE.md', '# 팀 규칙\n');
  const local = '﻿# 내 메모\r\n본문\r\n';
  write(root, 'CLAUDE.local.md', local);
  write(root, '.ignore', 'build/\n');
  const r1 = await initV3(root);
  await initV3(root);
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

test('팀원이 받은 shared/만 있는 저장소에서는 shared 문서를 건드리지 않는다', async () => {
  const root = makeProject();
  const idea = write(root, '.siloroot/shared/ideas/x.md', '---\ntype: idea\nstatus: 아이디어\n---\n\n# x\n');
  write(root, '.siloroot/shared/README.md', '# 우리 팀 공유 폴더\n');
  const before = mtimes(root, ['.siloroot/shared/ideas/x.md', '.siloroot/shared/README.md']);
  await new Promise((r) => setTimeout(r, 30));
  const res = await initV3(root);
  assert.ok(res.skipped.includes('.siloroot/shared/README.md'));
  assert.equal(read(root, '.siloroot/shared/README.md'), '# 우리 팀 공유 폴더\n');
  assert.equal(fs.readFileSync(idea, 'utf8'), '---\ntype: idea\nstatus: 아이디어\n---\n\n# x\n');
  assert.deepEqual(mtimes(root, ['.siloroot/shared/ideas/x.md', '.siloroot/shared/README.md']), before);
  assert.ok(fs.existsSync(path.join(root, '.siloroot', 'private', 'worklog', 'README.md')));
});

test('--home-access add는 홈을 additionalDirectories에 더한다', async () => {
  const root = makeProject(); git(root, ['init', '-q']);
  const res = await initV3(root, { homeAccess: 'add' });
  assert.equal(res.homeAccess, 'added');
  const j = JSON.parse(read(root, '.claude/settings.local.json'));
  assert.deepEqual(j.permissions.additionalDirectories, [HOME().split(path.sep).join('/')]);
  assert.ok(read(root, '.git/info/exclude').split(/\r?\n/).includes('.claude/settings.local.json'), '개인 설정이 팀 저장소에 보이지 않게 한다');
  assert.equal((await initV3(root, { homeAccess: 'add' })).homeAccess, 'present');
  assert.equal((await initV3(makeProject(), { homeAccess: 'skip' })).homeAccess, 'skipped');
});

test('user.json이 깨졌으면 init은 멈추고 파일을 그대로 둔다', async () => {
  const saved = fs.readFileSync(userFile(), 'utf8');
  try {
    fs.writeFileSync(userFile(), '{ 깨짐');
    const root = makeProject();
    const res = await initV3(root);
    assert.equal(res.error, 'user-json-invalid'); assert.equal(res.file, userFile());
    assert.equal(fs.readFileSync(userFile(), 'utf8'), '{ 깨짐');
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.writeFileSync(userFile(), saved);
  }
});

test('모양 2 작업 공간에서 다시 실행하면 옮기지 않고 맞추기만 하며 업데이트를 안내한다', async () => {
  const root = makeProject(); writeConfig(root, { port: 4197, layout: 'wrapped' });
  const res = await initV3(root);
  assert.ok(res.warnings.some((w) => w.includes('/siloroot:update')));
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', 'shared')));
  assert.ok(fs.existsSync(path.join(root, '.siloroot', '02-study', 'README.md')));
  assert.equal(loadConfig(root).schema, 2);
});

test('--mode home은 홈만 만든다', () => {
  resetUser();
  const home = makeProject('내-홈'); // 공백 든 홈 이름은 home-path-space로 멈춘다
  const out = JSON.parse(execFileSync(process.execPath, [INIT, home, '--mode', 'home'], { encoding: 'utf8' }));
  assert.equal(out.mode, 'home');
  assert.equal(readUser().home, home.split(path.sep).join('/')); assert.deepEqual(readUser().projects, []);
  assert.ok(fs.existsSync(path.join(home, 'study', 'README.md')));
});

test('CLI는 need-home이면 JSON을 쓰고 종료 코드 2', () => {
  resetUser();
  let err;
  try { execFileSync(process.execPath, [INIT, makeProject()], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { err = e; }
  assert.equal(err.status, 2);
  assert.equal(JSON.parse(err.stdout).error, 'need-home');
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
  const r1 = await initV3(root);
  await initV3(root);
  assert.equal(read(root, '.siloroot/CLAUDE.md'), original);
  assert.ok(r1.warnings.some((w) => w.includes('.siloroot/CLAUDE.md')));
});

const BLOCKS = ['CLAUDE.block.md', 'project/CLAUDE.block.md', 'home/CLAUDE.block.md'].map((f) => fs.readFileSync(path.join(REPO, 'templates', f), 'utf8'));

test('CLAUDE.md 블록은 실행할 수 없는 "뷰어 다시 만들기" 대신 뷰어의 속성 점검 화면을 가리킨다', () => {
  for (const block of BLOCKS) {
    assert.doesNotMatch(block, /뷰어를 다시 만들어/);
    assert.match(block, /속성 점검/);
  }
});

test('이미 있는 안내 파일에 새 템플릿의 type 행이 빠졌으면 덮어쓰지 않고 경고로 알린다', async () => {
  const root = makeProject();
  await initV3(root);
  const file = path.join(root, '.siloroot', 'metadata-guide.md');
  const old = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !l.includes('`issue`')).join('\n');
  fs.writeFileSync(file, old);
  const res = await initV3(root);
  assert.equal(fs.readFileSync(file, 'utf8'), old);
  assert.ok(res.warnings.some((w) => w.startsWith('.siloroot/metadata-guide.md') && w.includes('`issue`')));
  assert.ok(!res.warnings.some((w) => w.includes('README.md')));
});

test('직접 지시도 후보 파일을 거쳐 profile.md에 들어간다고 CLAUDE.md 블록과 feedback 스킬이 말한다', () => {
  const skill = fs.readFileSync(path.join(REPO, 'skills', 'feedback', 'SKILL.md'), 'utf8');
  const desc = (skill.match(/^description:\s*(.+)$/m) || [])[1] || '';
  for (const t of [...BLOCKS, desc]) assert.match(t, /"앞으로", "항상", "매번"/);
  for (const block of BLOCKS) assert.match(block, /후보 파일 없이 바로 쓰지 않는다/);
  assert.match(skill, /직접 지시는 그 말을 승인으로 본다/);
  assert.match(skill, /이 절차로만 줄을 더한다/);
});

test('세 스킬이 감싼 배치의 문서 위치를 알린다', () => {
  for (const s of ['note', 'verify', 'feedback']) {
    const t = fs.readFileSync(path.join(REPO, 'skills', s, 'SKILL.md'), 'utf8');
    assert.match(t, /"layout": "wrapped"/, s);
  }
});

test('새 init은 schema, mode, plugin을 적는다', async () => {
  const root = makeProject(); await initV3(root);
  const c = loadConfig(root);
  assert.equal(c.schema, 4); assert.equal(c.mode, 'project'); assert.equal(c.plugin, pluginVersion());
});

test('flat 작업 공간에서 init을 다시 돌리면 옮기지 않고 업데이트를 안내하며 plugin은 그대로', async () => {
  const root = makeProject(); writeConfig(root, { port: 4180 });
  write(root, '02-study/a.md', '---\ntype: study\nstatus: 검증 전\ntags: [x]\n---\n\n# a\n');
  const res = await initProject(root);
  assert.ok(fs.existsSync(path.join(root, '02-study', 'a.md')));
  assert.ok(res.warnings.some((w) => w.includes('/siloroot:update') && w.includes('모양 1')));
  assert.equal(loadConfig(root).plugin, null);
});

test('git에 계속 올리기로 한(tracked) 작업 공간은 init을 다시 돌려도 .siloroot/를 제외하지 않는다', async () => {
  const root = makeProject();
  git(root, ['init', '-q']);
  writeConfig(root, { port: 4180, layout: 'wrapped', schema: 2 });
  const cfgFile = path.join(root, '.siloroot', 'config.json');
  fs.writeFileSync(cfgFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(cfgFile, 'utf8')), tracked: true }));
  await initProject(root);
  const exclude = read(root, '.git/info/exclude').split(/\r?\n/);
  assert.ok(!exclude.includes('.siloroot/'));
  assert.ok(exclude.includes('CLAUDE.local.md'));
});

test('홈이 지워진 모양 3 프로젝트에서 다시 실행하면 홈을 다시 만들라고 알린다', async () => {
  const root = makeProject(); await initV3(root);
  const saved = fs.readFileSync(userFile(), 'utf8');
  try {
    fs.rmSync(userFile());
    const res = await initProject(root);
    assert.ok(res.warnings.some((w) => w.includes('홈을 찾지 못해') && w.includes('--home')));
  } finally {
    fs.mkdirSync(path.dirname(userFile()), { recursive: true });
    fs.writeFileSync(userFile(), saved);
  }
});

test('스킬은 옛 폴더 이름을 박지 않는다', () => {
  for (const f of fs.readdirSync(path.join(REPO, 'skills'), { recursive: true }).map(String).filter((f) => f.endsWith('.md')))
    assert.doesNotMatch(fs.readFileSync(path.join(REPO, 'skills', f), 'utf8'), /0[1-5]-(log|study|ideas|feedback|profile)/, f);
});

// 버전은 내보낼 때 올린다(CLAUDE.md "버전과 내보내기"). 테스트는 번호를 박지 않고 두 파일이 같은지만 본다
test('플러그인 버전은 두 파일이 같다', () => {
  const v = (f) => JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8')).version;
  assert.match(v('package.json'), /^\d+\.\d+\.\d+$/); assert.equal(v('.claude-plugin/plugin.json'), v('package.json'));
});

// ---- 최종 검토에서 나온 것 ----
test('user.json이 깨진 뒤 다시 실행하면 규칙 블록의 사용자 정보 불러오기를 지우지 않고 알린다', async () => {
  const root = makeProject(); await initV3(root);
  const before = read(root, '.siloroot/CLAUDE.md');
  const saved = fs.readFileSync(userFile(), 'utf8');
  try {
    fs.writeFileSync(userFile(), '{ 깨짐');
    const res = await initProject(root);
    assert.equal(read(root, '.siloroot/CLAUDE.md'), before);
    assert.ok(res.warnings.some((w) => w.includes('user.json')), JSON.stringify(res.warnings));
    assert.ok(!planUpdate(root).refresh.blocks.some((b) => b.file === '.siloroot/CLAUDE.md' && b.state === 'updated'));
    assert.equal(fs.readFileSync(userFile(), 'utf8'), '{ 깨짐');
  } finally { fs.writeFileSync(userFile(), saved); }
});

test('user.json을 잃은 프로젝트는 --home으로 다시 이으면 홈과 등록이 돌아온다', async () => {
  const root = makeProject('되살릴 앱'); await initV3(root);
  const before = read(root, '.siloroot/CLAUDE.md');
  const saved = fs.readFileSync(userFile(), 'utf8');
  try {
    fs.rmSync(userFile());
    const lost = await initProject(root);
    assert.equal(read(root, '.siloroot/CLAUDE.md'), before, '홈을 모르는 동안 블록을 그대로 둔다');
    assert.ok(lost.warnings.some((w) => w.includes('--home')));
    const res = await initProject(root, { home: HOME(), homeAccess: 'add' });
    assert.equal(readUser().home, HOME().split(path.sep).join('/'));
    assert.ok(readUser().projects.some((p) => p.name === '되살릴-앱'));
    assert.equal(res.homeAccess, 'added');
    assert.ok(!res.warnings.some((w) => w.includes('홈을 찾지 못했습니다')));
  } finally { fs.writeFileSync(userFile(), saved); }
});

test('홈 폴더 이름에 공백이 있으면 만들지 않고 멈춘다', async () => {
  resetUser();
  const root = makeProject();
  const res = await initProject(root, { home: path.join(userDir(), 'My Home') });
  assert.equal(res.error, 'home-path-space');
  assert.deepEqual(fs.readdirSync(root), []); assert.ok(!fs.existsSync(path.join(userDir(), 'My Home')));
});

test('홈이 프로젝트와 같거나 안이나 바깥이면 만들지 않고 멈춘다', async () => {
  resetUser();
  const root = makeProject('팀 저장소'); git(root, ['init', '-q']);
  for (const home of [root, path.join(root, 'home'), path.dirname(root)]) {
    const res = await initProject(root, { home });
    assert.equal(res.error, 'home-in-project', home);
  }
  assert.deepEqual(fs.readdirSync(root), ['.git']);
});

test('홈만 만들 때도 등록된 프로젝트 안은 거절한다', async () => {
  const root = makeProject('등록된-앱'); await initV3(root);
  const { initHome } = await import('../scripts/init.mjs');
  assert.equal((await initHome(path.join(root, 'h'))).error, 'home-in-project');
});

test('git 제외 목록에 예전 .siloroot/ 줄이 있으면 shared/가 숨는다고 알린다', async () => {
  const root = makeProject(); git(root, ['init', '-q']);
  write(root, '.git/info/exclude', '.siloroot/\n');
  const res = await initV3(root);
  assert.ok(res.warnings.some((w) => w.includes('.siloroot/') && w.includes('shared/')), JSON.stringify(res.warnings));
});
