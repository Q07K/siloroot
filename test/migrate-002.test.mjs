import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig, updateConfig } from '../lib/config.mjs';
import { applyRefresh, readTpl } from '../lib/workspace-sync.mjs';
import { MIGRATIONS } from '../lib/migrations/index.mjs';
import { mergeTables } from '../lib/migrations/002-project-areas.mjs';
import { readUser, userDir, userFile, setHome, registerProject } from '../lib/user.mjs';
import { planUpdate, applyUpdate } from '../scripts/update.mjs';
import { initHome } from '../scripts/init.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE = path.join(REPO, 'scripts', 'update.mjs');
const BUILD = path.join(REPO, 'viewer', 'build.mjs');
const m002 = MIGRATIONS.find((m) => m.id === '002-project-areas');
const HOME = () => path.join(userDir(), 'siloroot-home');
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const git = (root, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const reset = () => {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
};
// .siloroot/state/ 밖의 파일과 내용
const tree = (dir) => Object.fromEntries(fs.readdirSync(dir, { recursive: true }).map(String).map((r) => r.split(path.sep).join('/'))
  .filter((r) => !r.startsWith('.siloroot/state') && !r.startsWith('state') && !r.startsWith('.git/') && r !== '.git' && fs.statSync(path.join(dir, r)).isFile())
  .sort().map((r) => [r, fs.readFileSync(path.join(dir, r), 'utf8')]));

const fm = (type, status, extra = '') => `---\ntype: ${type}\nstatus: ${status}\ncreated: 2026-11-20\n${extra}---\n\n`;
const PROFILE_ROW = '| 짧게 답하기 | 답은 짧게 | `04-feedback/trait-short.md` | 2026-11-21 |';

// 모양 2 작업 공간. 이 작업 공간과 같은 꼴의 합성 문서를 둔다
function v2Project(name = '앱') {
  const root = makeProject(name);
  writeConfig(root, { port: 4180, layout: 'wrapped', schema: 2 });
  applyRefresh(root, loadConfig(root));
  const D = (rel, text) => write(root, '.siloroot/' + rel, text);
  D('01-log/changelog.md', read(root, '.siloroot/01-log/changelog.md') + '\n- 공부 `02-study/a.md`와 아이디어 `03-ideas/app.md`를 만들었다.\n');
  D('02-study/a.md', fm('study', '검증 전', 'tags: [웹]\nrelated: [03-ideas/app.md]\n') + '# a\n\n만난 곳: [앱](../03-ideas/app.md)\n');
  D('02-study/README.md', read(root, '.siloroot/02-study/README.md').replace('| --- | --- | --- | --- |', '| --- | --- | --- | --- |\n| [a](a.md) | 2026-11-20 | 검증 전 | `03-ideas/app.md` |'));
  D('03-ideas/app.md', fm('idea', '진행 중', 'related: [03-ideas/app-decision-design.md, 02-study/a.md]\n') + '# 앱\n\n시안: `03-ideas/app-mock.gif`. 계획은 `03-ideas/app-decision-plan.md`.\n\n```\n`03-ideas/app.md` 펜스 안은 그대로\n```\n');
  D('03-ideas/app-decision-design.md', fm('decision', '확정', 'related: [03-ideas/app.md]\n') + '# 앱 설계\n');
  D('03-ideas/app-decision-plan.md', fm('decision', '제안', 'related: [03-ideas/app-decision-design.md]\n') + '# 앱 계획\n');
  D('03-ideas/app-mock.gif', 'GIF89a');
  D('03-ideas/diary.md', fm('idea', '아이디어') + '# 일기 앱(개인)\n\n`02-study/a.md`를 보고 떠올렸다.\n');
  // 뷰어가 만드는 댓글 꼴(viewer/serve.mjs): related로 대상 문서를 가리킨다
  D('04-feedback/2026-11-22-001.md', fm('feedback', '대기', 'related: [03-ideas/app.md]\n') + '# 피드백: 03-ideas/app.md\n\n## 댓글\n\n좋다\n');
  D('04-feedback/trait-short.md', fm('trait', '반영') + '# 짧게 답하기\n');
  D('05-profile/profile.md', read(root, '.siloroot/05-profile/profile.md').replace(/(## 작업 방식\n\n[^\n]*\n\| --- \| --- \| --- \| --- \|)/, '$1\n' + PROFILE_ROW));
  D('06-discussions/README.md', fm('index', '사용 중') + '# 논의\n\n논의는 `06-discussions/`에, 아이디어는 `03-ideas/`에 둔다. 목록은 `README.md`.\n');
  D('06-discussions/2026-11-24-a.md', fm('note', '사용 중', 'related: [03-ideas/app.md]\n') + '# 논의 a\n\n그때는 `06-discussions/`와 `02-study/`를 썼다.\n');
  D('07-misc/x.md', fm('note', '사용 중') + '# 기타\n');
  D('metadata-guide.md', read(root, '.siloroot/metadata-guide.md').replace('| `03-ideas/` |', '| `06-discussions/` | `note` | 사용자가 더한 논의 폴더 |\n| `07-misc/` | `note` | 사용자가 더한 기타 폴더 |\n| `03-ideas/` |'));
  D('CLAUDE.md', read(root, '.siloroot/CLAUDE.md') + '\n## 더한 폴더\n\n- 논의는 `06-discussions/`에, 목록은 `06-discussions/README.md`.\n');
  return root;
}

// 기본값으로 다 답한 answers. 답에 따라 새로 생기는 질문(홈 이름 겹침 등)도 기본값으로 채운다
function answersFor(root, { decisions = {}, placements = {} } = {}) {
  const a = { migrations: { [m002.id]: 'apply' }, decisions: { ...decisions }, placements, declined: {} };
  for (let i = 0; i < 4; i++) {
    const p = m002.plan({ root, cfg: loadConfig(root) }, a);
    if (p.error) return { ...a, planError: p };
    for (const d of p.decisions) if (!(d.id in a.decisions)) a.decisions[d.id] = d.default;
  }
  return a;
}

const buildOut = (root) => execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8' });

test('plan은 파일을 바꾸지 않고 문서마다 갈 곳을 낸다', () => {
  reset();
  const root = v2Project();
  const before = tree(root);
  const p = planUpdate(root);
  assert.equal(p.from, 2); assert.equal(p.to, 3);
  const m = p.migrations[0];
  assert.equal(m.id, m002.id);
  const to = Object.fromEntries(m.plan.placements.map((x) => [x.from, x]));
  assert.equal(to['02-study/a.md'].to, 'home:study/a.md');
  assert.equal(to['03-ideas/app.md'].to, 'shared/ideas/app.md'); assert.equal(to['03-ideas/app.md'].review, true);
  assert.equal(to['03-ideas/app-decision-design.md'].to, 'shared/design/app-decision-design.md');
  assert.equal(to['03-ideas/app-decision-plan.md'].to, 'shared/roadmap/app-decision-plan.md');
  assert.equal(to['03-ideas/app-mock.gif'].to, 'shared/ideas/app-mock.gif');
  assert.equal(to['04-feedback/2026-11-22-001.md'].to, 'private/feedback/2026-11-22-001.md');
  assert.equal(to['04-feedback/trait-short.md'].to, 'home:feedback/trait-short.md');
  assert.equal(to['05-profile/profile.md'].to, 'home:profile.md');
  assert.equal(to['06-discussions/2026-11-24-a.md'].to, 'private/discussions/2026-11-24-a.md');
  assert.equal(to['07-misc/x.md'].to, 'private/07-misc/x.md');
  assert.equal(to['01-log/changelog.md'].to, 'private/log/changelog.md');
  assert.equal(to['writing-guide.md'].to, 'home:writing-guide.md');
  assert.ok(!m.plan.placements.some((x) => x.to.startsWith('shared/') && /study|feedback|profile|discussions|misc|log/.test(x.from)), '개인 문서는 shared/로 가지 않는다');
  assert.deepEqual(m.plan.decisions.map((d) => d.id).sort(), ['home-access', 'home-location']);
  assert.ok(m.plan.notes.some((n) => n.includes('옛 폴더 이름') && n.includes('`03-ideas/`')), m.plan.notes.join('\n'));
  assert.equal(m.plan.decisions.find((d) => d.id === 'home-location').free, true);
  assert.deepEqual(tree(root), before);
  assert.ok(!fs.existsSync(userFile()));
});

test('apply: 홈을 만들고 옮기고 경로를 고치며 모양 3이 된다', () => {
  reset();
  const root = v2Project();
  const res = applyUpdate(root, answersFor(root));
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.equal(res.schema, 3);
  const cfg = loadConfig(root);
  assert.equal(cfg.mode, 'project'); assert.equal(cfg.layout, 'wrapped');
  const home = HOME();
  assert.equal(loadConfig(home).mode, 'home');
  assert.notEqual(loadConfig(home).port, cfg.port);
  const u = readUser();
  assert.equal(u.home, home.split(path.sep).join('/')); assert.equal(u.projects[0].name, '앱');
  // 옛 폴더는 없다
  for (const d of ['01-log', '02-study', '03-ideas', '04-feedback', '05-profile', '06-discussions', '07-misc', 'writing-guide.md']) assert.ok(!exists(root, '.siloroot/' + d), d);
  // 경로 고치기
  assert.match(read(home, 'study/a.md'), /^related: \[앱:shared\/ideas\/app\.md\]$/m);
  assert.match(read(home, 'study/a.md'), /\[앱\]\(앱:shared\/ideas\/app\.md\)/);
  assert.match(read(home, 'study/README.md'), /\| \[a\]\(a\.md\) \| 2026-11-20 \| 검증 전 \| `앱:shared\/ideas\/app\.md` \|/);
  const app = read(root, '.siloroot/shared/ideas/app.md');
  assert.match(app, /^related: \[shared\/design\/app-decision-design\.md, home:study\/a\.md\]$/m);
  assert.match(app, /`shared\/ideas\/app-mock\.gif`/); assert.match(app, /`shared\/roadmap\/app-decision-plan\.md`/);
  assert.match(app, /`03-ideas\/app\.md` 펜스 안은 그대로/);
  assert.match(read(root, '.siloroot/private/log/changelog.md'), /`home:study\/a\.md`와 아이디어 `shared\/ideas\/app\.md`/);
  // type
  assert.match(read(root, '.siloroot/shared/design/app-decision-design.md'), /^type: design$/m);
  assert.match(read(root, '.siloroot/shared/roadmap/app-decision-plan.md'), /^type: roadmap$/m);
  assert.match(read(root, '.siloroot/shared/roadmap/app-decision-plan.md'), /^status: 제안$/m);
  // 사용자 정보와 후보는 홈
  assert.ok(read(home, 'profile.md').includes('| 짧게 답하기 | 답은 짧게 | `feedback/trait-short.md` | 2026-11-21 |'));
  assert.ok(exists(home, 'feedback/trait-short.md'));
  // 새로 만든 홈의 안내 문서는 모양 3 템플릿이고 옛 폴더 이름을 적지 않는다
  assert.equal(read(home, 'feedback/README.md'), readTpl('home/feedback/README.md'));
  assert.doesNotMatch(read(home, 'writing-guide.md'), /04-feedback/);
  assert.doesNotMatch(read(home, 'study/README.md'), /02-study/);
  // 안내 문서에서는 통째로 옮긴 폴더 이름을 고치고, 나뉜 폴더 이름과 맨 파일 이름은 그대로 둔다. 기록 문서의 옛 이름은 그대로
  assert.match(read(root, '.siloroot/private/discussions/README.md'), /논의는 `private\/discussions\/`에, 아이디어는 `03-ideas\/`에 둔다\. 목록은 `README\.md`\./);
  assert.match(read(root, '.siloroot/private/discussions/2026-11-24-a.md'), /그때는 `06-discussions\/`와 `02-study\/`를 썼다/);
  // 관리 블록 밖, 속성 가이드
  const claude = read(root, '.siloroot/CLAUDE.md');
  assert.match(claude, /논의는 `private\/discussions\/`에, 목록은 `private\/discussions\/README\.md`/);
  assert.match(claude, /@~\/siloroot-home\/profile\.md/);
  const guide = read(root, '.siloroot/metadata-guide.md');
  assert.match(guide, /`shared\/issues\/`/);
  assert.match(guide, /\| `private\/07-misc\/` \| `note` \| 사용자가 더한 기타 폴더 \|/);
  assert.equal(guide.split('`private/discussions/`').length - 1, 1, '이미 있는 자리 줄은 두 번 넣지 않는다');
  // 뷰어 점검: 찾지 못하는 연결과 type 경고가 없다
  const out = buildOut(root);
  assert.doesNotMatch(out, /찾지 못함/);
  assert.doesNotMatch(out, /type/);
  assert.match(buildOut(home), /속성 점검: 경고 0개/);
  // 다시 미리 보면 다음 모양(003)이 남았다
  assert.deepEqual(planUpdate(root).migrations.map((m) => m.id), ['003-doc-slots']);
});

test('되돌리면 프로젝트는 원래대로, 홈과 user.json은 지워진다', () => {
  reset();
  const root = v2Project();
  const before = tree(root);
  const res = applyUpdate(root, answersFor(root));
  const r = JSON.parse(execFileSync(process.execPath, [UPDATE, root, '--restore', res.backup], { encoding: 'utf8' }));
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(tree(root), before);
  assert.ok(!fs.existsSync(userFile()));
  assert.deepEqual(Object.keys(tree(HOME())), [], '홈에 만든 파일은 남지 않는다');
});

test('아이디어를 홈으로 보내면 옆의 결정과 그림도 따라간다', () => {
  reset();
  const root = v2Project();
  const a = answersFor(root, { placements: { '03-ideas/app.md': 'home:ideas/app.md', '03-ideas/diary.md': 'home:ideas/diary.md' } });
  const res = applyUpdate(root, a);
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  const home = HOME();
  for (const f of ['ideas/app.md', 'ideas/app-decision-design.md', 'ideas/app-decision-plan.md', 'ideas/app-mock.gif', 'ideas/diary.md']) assert.ok(exists(home, f), f);
  assert.ok(!exists(root, '.siloroot/shared/design/app-decision-design.md'));
  assert.match(read(home, 'ideas/diary.md'), /`study\/a\.md`/);
  assert.match(read(root, '.siloroot/private/feedback/2026-11-22-001.md'), /^related: \[home:ideas\/app\.md\]$/m, '기다리는 댓글도 옮긴 대상을 가리킨다');
  assert.match(buildOut(home), /속성 점검: 경고 0개/);
});

test('잘못된 갈 곳은 아무것도 바꾸지 않고 멈춘다', () => {
  reset();
  const root = v2Project();
  const before = tree(root);
  for (const to of ['ideas/app.md', '../x.md', 'shared/../private/x.md', 'other:shared/x.md']) {
    const res = applyUpdate(root, { migrations: { [m002.id]: 'apply' }, decisions: { 'home-location': HOME(), 'home-access': 'skip' }, placements: { '03-ideas/app.md': to } });
    assert.equal(res.error, 'bad-placement', to);
  }
  const clash = applyUpdate(root, { migrations: { [m002.id]: 'apply' }, decisions: { 'home-location': HOME(), 'home-access': 'skip' }, placements: { '03-ideas/diary.md': 'shared/ideas/app.md' } });
  assert.equal(clash.error, 'placement-conflict');
  assert.deepEqual(tree(root), before);
});

test('홈 위치에 공백이 있거나 프로젝트 안이면 멈춘다', () => {
  reset();
  const root = v2Project();
  const ask = (home) => applyUpdate(root, { migrations: { [m002.id]: 'apply' }, decisions: { 'home-location': home, 'home-access': 'skip' } });
  assert.equal(ask(path.join(userDir(), '내 홈')).error, 'home-path-space');
  assert.equal(ask(path.join(root, 'home')).error, 'home-in-project');
  assert.equal(loadConfig(root).schema, 2);
});

test('홈이 이미 있으면 표 줄을 합치고, 같은 이름 노트는 물어서 이름을 바꿔 둔다', async () => {
  reset();
  const home = HOME();
  await initHome(home);
  const mine = '| 표로 정리 | 비교는 표로 | `feedback/trait-table.md` | 2026-11-01 |';
  write(home, 'profile.md', read(home, 'profile.md').replace(/(## 작업 방식\n\n[^\n]*\n\| --- \| --- \| --- \| --- \|)/, '$1\n' + mine));
  write(home, 'study/a.md', fm('study', '통과', 'tags: [웹]\n') + '# 홈의 a\n');
  const root = v2Project();
  const p = m002.plan({ root, cfg: loadConfig(root) }, {});
  assert.ok(p.decisions.some((d) => d.id === 'home-collision:study/a.md'));
  assert.ok(!p.decisions.some((d) => d.id === 'home-location'));
  const res = applyUpdate(root, answersFor(root));
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.match(read(home, 'study/a.md'), /# 홈의 a/, '홈에 있던 노트는 그대로');
  assert.match(read(home, 'study/a-앱.md'), /^# a$/m);
  assert.match(read(root, '.siloroot/shared/ideas/app.md'), /home:study\/a-앱\.md/);
  const prof = read(home, 'profile.md');
  assert.ok(prof.includes(mine)); assert.ok(prof.includes('| 짧게 답하기 |'));
  assert.equal(readUser().projects.length, 1);
});

test('git: 예전 제외 줄을 치우고 shared만 보이며, 커밋된 개인 문서는 물어서 추적을 끊는다', () => {
  reset();
  const root = v2Project();
  git(root, ['init', '-q']);
  const exclude = path.join(root, '.git', 'info', 'exclude');
  fs.appendFileSync(exclude, '\n# SiloRoot (커밋하지 않는 개인 작업 공간)\n.siloroot/\n');
  git(root, ['add', '-f', '.siloroot/02-study/a.md', '.siloroot/03-ideas/app.md']);
  git(root, ['commit', '-q', '-m', 'x']);
  const p = m002.plan({ root, cfg: loadConfig(root) }, {});
  assert.ok(p.decisions.some((d) => d.id === 'git-private'));
  const res = applyUpdate(root, answersFor(root));
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.ok(!fs.readFileSync(exclude, 'utf8').split(/\r?\n/).includes('.siloroot/'));
  const tracked = git(root, ['ls-files']).split('\n').filter(Boolean);
  assert.deepEqual(tracked, ['.siloroot/shared/ideas/app.md'], '공유로 간 문서는 새 자리로 계속 추적하고 홈으로 간 것은 끊는다');
  const st = git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean);
  // 추적을 끊은 옛 자리는 지움으로 보이고, 나머지는 shared/ 아래만 보인다
  assert.deepEqual(st.filter((l) => l.startsWith('D')).map((l) => l.slice(3)).sort(), ['.siloroot/02-study/a.md', '.siloroot/03-ideas/app.md']);
  const rest = st.filter((l) => !l.startsWith('D')).map((l) => l.slice(3));
  assert.ok(rest.every((f) => f.startsWith('.siloroot/shared/')), rest.join(', '));
  assert.ok(!exists(root, '.siloroot/.gitignore'));
});

test('홈 쓰기 허락을 add로 답하면 settings.local.json에 홈을 더한다', () => {
  reset();
  const root = v2Project();
  write(root, '.claude/settings.local.json', JSON.stringify({ model: 'x' }));
  const res = applyUpdate(root, answersFor(root));
  assert.equal(res.stoppedAt, null);
  const j = JSON.parse(read(root, '.claude/settings.local.json'));
  assert.equal(j.model, 'x');
  assert.deepEqual(j.permissions.additionalDirectories, [HOME().split(path.sep).join('/')]);
});

test('중간에 실패해도 다시 돌리면 이어지고 홈 파일을 이름 겹침으로 묻지 않는다', () => {
  reset();
  const root = v2Project();
  const guide = path.join(root, '.siloroot', 'metadata-guide.md');
  fs.chmodSync(guide, 0o444);
  const a = answersFor(root);
  const res = applyUpdate(root, a);
  assert.equal(res.stoppedAt, m002.id);
  assert.equal(loadConfig(root).schema, 2);
  assert.ok(exists(root, '.siloroot/02-study/a.md'), '옛 파일은 아직 있다');
  fs.chmodSync(guide, 0o644);
  const p = m002.plan({ root, cfg: loadConfig(root) }, a);
  assert.ok(!p.decisions.some((d) => d.id.startsWith('home-collision')), JSON.stringify(p.decisions));
  const again = applyUpdate(root, answersFor(root, { decisions: a.decisions }));
  assert.equal(again.stoppedAt, null, JSON.stringify(again));
  assert.equal(loadConfig(root).schema, 3);
  assert.match(read(HOME(), 'study/a.md'), /^related: \[앱:shared\/ideas\/app\.md\]$/m);
});

test('옛 파일을 지우다 멈추면 표시 파일로 남은 지우기부터 잇는다', () => {
  reset();
  const root = v2Project();
  const a = answersFor(root);
  // 실패를 흉내: 적용을 마친 뒤 옛 파일 몇 개를 되살리고 표시를 둔다
  const keep = { '.siloroot/07-misc/x.md': read(root, '.siloroot/07-misc/x.md') };
  const res = applyUpdate(root, a);
  assert.equal(res.stoppedAt, null);
  updateConfig(root, { schema: 2, mode: null });
  const mark = { home: HOME().split(path.sep).join('/'), placements: [], deletes: ['07-misc/x.md', '01-log/changelog.md'], untrack: [], gitAdd: [], removeGitignore: false, homeAccess: 'skip' };
  write(root, '.siloroot/state/migrate-002.json', JSON.stringify(mark));
  write(root, '.siloroot/07-misc/x.md', keep['.siloroot/07-misc/x.md']);
  const p = planUpdate(root);
  assert.equal(p.migrations[0].plan.decisions.length, 0);
  const again = applyUpdate(root, { migrations: { [m002.id]: 'apply' } });
  assert.equal(again.stoppedAt, null, JSON.stringify(again));
  assert.ok(!exists(root, '.siloroot/07-misc'));
  assert.ok(!exists(root, '.siloroot/state/migrate-002.json'));
  assert.equal(loadConfig(root).schema, 3);
});

test('mergeTables는 같은 제목의 표 끝에 없는 줄만 더하고, 없는 제목은 절째 붙인다', () => {
  const base = '# x\n\n## 가\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n## 나\n\n본문\n';
  const add = '## 가\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\n## 다\n\n| c |\n| --- |\n| 5 |\n';
  const r = mergeTables(base, add);
  assert.equal(r.added, 2);
  assert.match(r.text, /\| 1 \| 2 \|\n\| 3 \| 4 \|\n\n## 나/);
  assert.match(r.text, /## 다\n\n\| c \|\n\| --- \|\n\| 5 \|\n$/);
  assert.equal(mergeTables(r.text, add).added, 0);
});

test('홈이 등록된 다른 프로젝트 이름과 겹치지 않게 프로젝트 이름을 고른다', () => {
  reset();
  const other = makeProject('앱');
  setHome(HOME());
  registerProject(other);
  const root = v2Project('앱');
  const p = planUpdate(root);
  assert.ok(p.migrations[0].plan.notes.length);
  const res = applyUpdate(root, answersFor(root));
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.match(read(HOME(), 'study/a.md'), /앱-2:shared\/ideas\/app\.md/);
});
