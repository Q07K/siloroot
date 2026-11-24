import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import { applyRefresh } from '../lib/workspace-sync.mjs';
import { MIGRATIONS } from '../lib/migrations/index.mjs';
import { userDir, setHome, registerProject } from '../lib/user.mjs';
import { planUpdate, applyUpdate } from '../scripts/update.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE = path.join(REPO, 'scripts', 'update.mjs');
const BUILD = path.join(REPO, 'viewer', 'build.mjs');
const m003 = MIGRATIONS.find((m) => m.id === '003-doc-slots');
const HOME = () => path.join(userDir(), 'siloroot-home');
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const reset = () => {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
};
const tree = (dir) => Object.fromEntries(fs.readdirSync(dir, { recursive: true }).map(String).map((r) => r.split(path.sep).join('/'))
  .filter((r) => !r.startsWith('.siloroot/state') && !r.startsWith('.siloroot/config.json') && fs.statSync(path.join(dir, r)).isFile())
  .sort().map((r) => [r, fs.readFileSync(path.join(dir, r), 'utf8')]));
const fm = (type, status, extra = '') => `---\ntype: ${type}\nstatus: ${status}\ncreated: 2026-11-20\n${extra}---\n\n`;
const cli = (root, args) => JSON.parse(execFileSync(process.execPath, [UPDATE, root, ...args], { encoding: 'utf8' }));

// 모양 3 홈과 프로젝트. 이 저장소 작업 공간과 같은 꼴의 문서를 둔다
function v3Home() {
  const home = HOME();
  fs.mkdirSync(home, { recursive: true });
  writeConfig(home, { port: 4181, schema: 3, mode: 'home' });
  applyRefresh(home, loadConfig(home));
  setHome(home);
  return home;
}
function v3Project(name = '앱') {
  const home = v3Home();
  const root = makeProject(name);
  writeConfig(root, { port: 4180, layout: 'wrapped', schema: 3, mode: 'project' });
  registerProject(root);
  applyRefresh(root, loadConfig(root));
  const D = (rel, text) => write(root, '.siloroot/' + rel, text);
  D('private/log/changelog.md', fm('log', '사용 중') + '# 작업 기록\n\n새 항목을 맨 위에 더한다. 하루에 한 절, 한 일에 한 줄.\n\n직접 더한 머리말 한 줄.\n\n## 2026-11-25\n\n- 계획 `shared/roadmap/app-plan.md`를 고쳤다.\n\n## 2026-11-24\n\n- 아이디어 `shared/ideas/app.md`를 만들었다.\n');
  D('private/log/open-questions.md', fm('ledger', '사용 중') + '# 남은 일\n\n- [ ] **물을 것**: `shared/ideas/app.md`\n');
  D('shared/roadmap/app-plan.md', fm('roadmap', '확정', 'related: [shared/ideas/app.md]\n') + '# 앱 계획\n\n[설계](../design/app.md)\n');
  D('shared/design/app.md', fm('design', '확정', 'related: [shared/roadmap/app-plan.md]\n') + '# 앱 설계\n\n계획은 [여기](../roadmap/app-plan.md).\n');
  D('shared/ideas/app.md', fm('idea', '진행 중', 'related: [shared/roadmap/app-plan.md, shared/ideas/app-decision-x.md]\n') + '# 앱\n\n계획 `shared/roadmap/app-plan.md`, 결정 `shared/ideas/app-decision-x.md`.\n');
  D('shared/ideas/app-decision-x.md', fm('decision', '확정', 'related: [shared/ideas/app.md]\n') + '# 결정 x\n');
  D('shared/issues/port.md', fm('issue', '원인 찾음') + '# 포트\n');
  D('shared/issues/old.md', fm('issue', '안 함') + '# 옛 문제\n');
  D('private/notes/n.md', fm('note', '사용 중', 'related: [private/log/changelog.md]\n') + '# 메모\n\n기록은 `private/log/changelog.md`, 질문은 [여기](../log/open-questions.md). 맨 이름 `open-questions.md`는 그대로.\n');
  write(home, 'study/a.md', fm('study', '검증 전', `tags: [웹]\nrelated: [${name}:shared/roadmap/app-plan.md]\n`) + `# a\n\n\`${name}:shared/roadmap/app-plan.md\`\n`);
  return { root, home };
}
const answers = (extra = {}) => ({ migrations: { [m003.id]: 'apply' }, decisions: {}, placements: {}, declined: {}, ...extra });

test('plan은 파일을 바꾸지 않고 옮길 것과 갈 곳 목록을 낸다', () => {
  reset();
  const { root } = v3Project();
  const before = tree(root);
  const p = planUpdate(root);
  assert.deepEqual(p.migrations.map((m) => m.id), [m003.id]);
  const plan = p.migrations[0].plan;
  const moves = plan.moves.map((m) => m.from + ' → ' + m.to);
  assert.ok(moves.includes('.siloroot/shared/roadmap/app-plan.md → .siloroot/shared/plans/app-plan.md'));
  assert.ok(moves.includes('.siloroot/private/log/open-questions.md → .siloroot/private/open-questions.md'));
  assert.ok(moves.includes('.siloroot/private/log/changelog.md → .siloroot/private/worklog/2026-11-24.md'));
  assert.deepEqual(plan.placements, [{ from: 'shared/ideas/app-decision-x.md', to: 'shared/decisions/app-decision-x.md', why: '결정 문서는 결정 자리' }]);
  assert.deepEqual(plan.decisions, []);
  assert.deepEqual(tree(root), before);
});

test('apply: 작업 기록을 날짜별로 나누고 옮기며 경로를 고치고 모양 4가 된다', () => {
  reset();
  const { root, home } = v3Project();
  const res = applyUpdate(root, answers());
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.equal(res.schema, 4);
  const S = (rel) => '.siloroot/' + rel;
  // 작업 일지
  const d24 = read(root, S('private/worklog/2026-11-24.md')), d25 = read(root, S('private/worklog/2026-11-25.md'));
  assert.match(d24, /^type: log$/m); assert.match(d24, /^status: 끝남$/m); assert.match(d24, /^created: 2026-11-24$/m);
  assert.match(d24, /직접 더한 머리말 한 줄/, '날짜 제목 앞의 글은 가장 이른 날 문서에 둔다');
  assert.doesNotMatch(d24, /새 항목을 맨 위에 더한다/, '템플릿 안내문은 옮기지 않는다');
  assert.match(d25, /`shared\/plans\/app-plan\.md`를 고쳤다/);
  assert.ok(!exists(root, S('private/log')));
  // 옮김과 type
  assert.ok(!exists(root, S('shared/roadmap')));
  assert.match(read(root, S('shared/plans/app-plan.md')), /^type: plan$/m);
  assert.match(read(root, S('shared/plans/app-plan.md')), /\[설계\]\(\.\.\/design\/app\.md\)/);
  assert.match(read(root, S('private/open-questions.md')), /물을 것/);
  assert.match(read(root, S('shared/decisions/app-decision-x.md')), /^type: decision$/m);
  assert.ok(!exists(root, S('shared/ideas/app-decision-x.md')));
  // 경로 고치기
  const app = read(root, S('shared/ideas/app.md'));
  assert.match(app, /^related: \[shared\/plans\/app-plan\.md, shared\/decisions\/app-decision-x\.md\]$/m);
  assert.match(app, /계획 `shared\/plans\/app-plan\.md`, 결정 `shared\/decisions\/app-decision-x\.md`/);
  assert.match(read(root, S('shared/design/app.md')), /\[여기\]\(\.\.\/plans\/app-plan\.md\)/);
  const note = read(root, S('private/notes/n.md'));
  assert.match(note, /^related: \[private\/worklog\]$/m, 'related는 나눈 작업 일지 자리로');
  assert.match(note, /기록은 `private\/log\/changelog\.md`/, '본문의 옛 작업 기록 이야기는 그때의 것이라 그대로');
  assert.match(note, /맨 이름 `open-questions\.md`는 그대로/);
  assert.match(read(root, S('shared/README.md')), /`shared\/plans\/`/, '손대지 않은 영역 안내는 모양 4 템플릿으로');
  assert.match(note, /\[여기\]\(\.\.\/open-questions\.md\)/);
  // 홈 문서의 프로젝트 경로
  assert.match(read(home, 'study/a.md'), /^related: \[앱:shared\/plans\/app-plan\.md\]$/m);
  assert.match(read(home, 'study/a.md'), /`앱:shared\/plans\/app-plan\.md`/);
  // 이슈 status
  assert.match(read(root, S('shared/issues/port.md')), /^status: 열림$/m);
  assert.match(read(root, S('shared/issues/old.md')), /^status: 안 고침$/m);
  // 맞추기가 만든 것
  for (const f of ['shared/roadmap.md', 'shared/architecture.md', 'shared/plans/README.md', 'private/worklog/README.md']) assert.ok(exists(root, S(f)), f);
  assert.match(read(root, S('CLAUDE.md')), /private\/worklog\/YYYY-MM-DD\.md/);
  assert.match(read(root, S('metadata-guide.md')), /`shared\/plans\/`/);
  // 뷰어 점검: 찾지 못하는 연결 없음, 경고 0
  const out = execFileSync(process.execPath, [BUILD, root], { encoding: 'utf8' });
  assert.doesNotMatch(out, /찾지 못함/);
  assert.match(out, /속성 점검: 경고 0개/, out);
  assert.equal(planUpdate(root).upToDate, true);
});

test('되돌리면 프로젝트와 홈 문서가 원래대로 돌아간다', () => {
  reset();
  const { root, home } = v3Project();
  const before = tree(root), homeStudy = read(home, 'study/a.md');
  const res = applyUpdate(root, answers());
  const r = cli(root, ['--restore', res.backup]);
  assert.deepEqual(r.conflicts, [], JSON.stringify(r));
  assert.deepEqual(tree(root), before);
  assert.equal(read(home, 'study/a.md'), homeStudy);
  assert.equal(loadConfig(root).schema, 3);
});

test('갈 곳을 답으로 바꾸면 그리로, 잘못된 갈 곳이면 아무것도 바꾸지 않는다', () => {
  reset();
  const { root } = v3Project();
  const before = tree(root);
  const bad = applyUpdate(root, answers({ placements: { 'shared/ideas/app-decision-x.md': 'home:ideas/x.md' } }));
  assert.equal(bad.error, 'bad-placement');
  assert.deepEqual(tree(root), before);
  const res = applyUpdate(root, answers({ placements: { 'shared/ideas/app-decision-x.md': 'shared/ideas/app-decision-x.md' } }));
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.ok(exists(root, '.siloroot/shared/ideas/app-decision-x.md'), '그대로 두기로 답하면 옮기지 않는다');
});

test('홈: 작업 기록을 worklog/로 나누고 확인할 것을 맨 위로 옮기며 프로젝트의 home: 경로를 고친다', () => {
  reset();
  const { root, home } = v3Project();
  write(home, 'log/changelog.md', fm('log', '사용 중') + '# 작업 기록\n\n## 2026-11-23\n\n- 홈을 만들었다.\n');
  write(root, '.siloroot/private/notes/h.md', fm('note', '사용 중', 'related: [home:log/open-questions.md, home:log/changelog.md]\n') + '# h\n\n`home:log/open-questions.md`, 그때 기록은 `home:log/changelog.md`\n');
  const res = applyUpdate(home, answers());
  assert.equal(res.stoppedAt, null, JSON.stringify(res));
  assert.equal(loadConfig(home).schema, 4);
  assert.match(read(home, 'worklog/2026-11-23.md'), /홈을 만들었다/);
  assert.ok(exists(home, 'open-questions.md'));
  assert.ok(!exists(home, 'log'));
  assert.ok(exists(home, 'ideas/README.md'));
  assert.match(read(root, '.siloroot/private/notes/h.md'), /^related: \[home:open-questions\.md, home:worklog\/README\.md\]$/m);
  assert.match(read(root, '.siloroot/private/notes/h.md'), /그때 기록은 `home:log\/changelog\.md`/);
  assert.match(read(root, '.siloroot/private/notes/h.md'), /`home:open-questions\.md`/);
  assert.match(execFileSync(process.execPath, [BUILD, home], { encoding: 'utf8' }), /속성 점검: 경고 0개/);
});

test('다시 돌려도 이미 옮긴 것은 그대로다(모양 4에서는 003이 없다)', () => {
  reset();
  const { root } = v3Project();
  applyUpdate(root, answers());
  const after = tree(root);
  const again = applyUpdate(root, {});
  assert.deepEqual(again.migrations, []);
  assert.deepEqual(tree(root), after);
});
