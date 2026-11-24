import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig, updateConfig, pluginVersion } from '../lib/config.mjs';
import { claudeBlock } from '../lib/workspace-sync.mjs';
import { MIGRATIONS } from '../lib/migrations/index.mjs';
import { initProject } from '../scripts/init.mjs';
import { planUpdate, applyUpdate } from '../scripts/update.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDATE = path.join(REPO, 'scripts', 'update.mjs');
const ID = '001-wrap-siloroot-folder';
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const A_MD = '---\ntype: study\nstatus: 검증 전\ntags: [x]\n---\n\n# a\n';
const TEAM = '# 팀 규칙\n\n팀이 쓰는 내용.\n';
// .siloroot/state/(생성물, 백업, 사용 기록)는 빼고 파일 목록과 내용
const snapshot = (root) => Object.fromEntries(fs.readdirSync(root, { recursive: true }).map(String)
  .map((r) => r.split(path.sep).join('/'))
  .filter((r) => !r.startsWith('.siloroot/state') && fs.statSync(path.join(root, r)).isFile())
  .sort().map((r) => [r, read(root, r)]));
const cli = (root, args) => JSON.parse(execFileSync(process.execPath, [UPDATE, root, ...args], { encoding: 'utf8' }));

function flatProject() {
  const root = makeProject();
  writeConfig(root, { port: 4180 });
  write(root, '01-log/changelog.md', '---\ntype: log\nstatus: 사용 중\n---\n\n# 작업 기록\n');
  write(root, '02-study/a.md', A_MD);
  write(root, 'metadata-guide.md', read(REPO, 'templates/metadata-guide.md'));
  write(root, 'CLAUDE.md', TEAM + '\n' + claudeBlock('flat') + '\n');
  return root;
}
const answersFor = (plan, pick = 'apply') => ({
  migrations: Object.fromEntries(plan.migrations.map((m) => [m.id, pick])),
  decisions: Object.fromEntries(plan.migrations.flatMap((m) => m.plan.decisions.map((d) => [d.id, d.default]))),
  declined: {},
});

test('flat 작업 공간: plan → apply → 두 번째 plan은 upToDate', () => {
  const root = flatProject();
  const p = planUpdate(root);
  assert.equal(p.from, 1); assert.equal(p.to, 2);
  assert.equal(p.pluginFrom, null); assert.equal(p.pluginTo, pluginVersion());
  assert.deepEqual(p.migrations.map((m) => m.id), [ID]);
  assert.equal(p.upToDate, false);
  const res = applyUpdate(root, answersFor(p));
  assert.equal(res.stoppedAt, null);
  assert.deepEqual(res.migrations, [{ id: ID, status: 'applied' }]);
  assert.ok(res.backup);
  assert.equal(res.schema, 2); assert.equal(res.plugin, pluginVersion());
  assert.equal(typeof res.check.warnings, 'number');
  assert.equal(read(root, '.siloroot/02-study/a.md'), A_MD);
  assert.equal(loadConfig(root).layout, 'wrapped');
  const again = planUpdate(root);
  assert.equal(again.upToDate, true, JSON.stringify(again.refresh));
  assert.deepEqual(again.migrations, []);
});

test('decisions 답이 없으면 아무것도 바꾸지 않는다', () => {
  const root = flatProject();
  const before = snapshot(root);
  const res = applyUpdate(root, { migrations: { [ID]: 'apply' }, decisions: {}, declined: {} });
  assert.equal(res.error, 'missing-decisions');
  assert.ok(res.ids.includes('root-claude-outside'));
  assert.deepEqual(snapshot(root), before);
  assert.ok(!exists(root, '.siloroot/state/backups'));
});

test('마이그레이션에 답이 없어도 아무것도 바꾸지 않는다', () => {
  const root = flatProject();
  const before = snapshot(root);
  const res = applyUpdate(root, { decisions: {}, declined: {} });
  assert.equal(res.error, 'missing-decisions');
  assert.ok(res.ids.includes('migration:' + ID));
  assert.deepEqual(snapshot(root), before);
});

test('hold로 답하면 모양은 그대로, 맞추기만 하고 hold가 적힌다', () => {
  const root = flatProject();
  const res = applyUpdate(root, answersFor(planUpdate(root), 'hold'));
  assert.deepEqual(res.migrations, [{ id: ID, status: 'held' }]);
  const cfg = loadConfig(root);
  assert.equal(cfg.layout, 'flat'); assert.equal(cfg.schema, 1); assert.equal(cfg.hold, 2);
  assert.equal(cfg.plugin, pluginVersion());
  assert.ok(exists(root, '02-study/a.md'));
  assert.ok(exists(root, '01-log/open-questions.md'), '빠진 파일은 맞춘다');
  const again = planUpdate(root);
  assert.equal(again.migrations[0].held, true);
  assert.equal(again.upToDate, true);
  // 다시 올리기로 하면 hold를 지운다
  applyUpdate(root, answersFor(again, 'apply'));
  assert.equal(loadConfig(root).hold, null);
  assert.equal(loadConfig(root).schema, 2);
});

test('마이그레이션이 실패하면 거기서 멈추고 schema는 마지막 성공 값', () => {
  const root = flatProject();
  const real = MIGRATIONS[0];
  MIGRATIONS[0] = {
    id: 'fail-test', from: 1, to: 2, title: '실패',
    plan: () => ({ moves: [], edits: [], decisions: [], notes: [], touches: { files: ['02-study'], creates: [] } }),
    apply: () => { write(root, '02-study/a.md', '반쯤 바뀜'); throw new Error('boom'); },
  };
  try {
    const res = applyUpdate(root, { migrations: { 'fail-test': 'apply' }, decisions: {}, declined: {} });
    assert.equal(res.stoppedAt, 'fail-test');
    assert.equal(res.migrations[0].status, 'failed');
    assert.match(res.migrations[0].error, /boom/);
    assert.equal(loadConfig(root).schema, 1);
    assert.equal(loadConfig(root).plugin, null, '실패하면 맞추기와 plugin 적기를 하지 않는다');
    assert.ok(res.backup);
    cli(root, ['--restore', res.backup]);
    assert.equal(read(root, '02-study/a.md'), A_MD);
  } finally {
    MIGRATIONS[0] = real;
  }
});

test('plugin만 다르면 백업 없이 plugin만 적는다', async () => {
  const root = makeProject();
  await initProject(root);
  updateConfig(root, { plugin: '0.0.1' });
  const before = snapshot(root);
  const p = planUpdate(root);
  assert.equal(p.upToDate, true);
  assert.equal(p.pluginFrom, '0.0.1');
  const res = applyUpdate(root, {});
  assert.equal(res.backup, null);
  assert.equal(loadConfig(root).plugin, pluginVersion());
  const after = snapshot(root);
  delete before['.siloroot/config.json']; delete after['.siloroot/config.json'];
  assert.deepEqual(after, before);
  assert.ok(!exists(root, '.siloroot/state/backups'));
});

test('거절한 안내 문서 줄은 다음 plan의 guideGaps에 다시 나오지 않는다', async () => {
  const root = makeProject();
  await initProject(root);
  const guide = path.join(root, '.siloroot', 'metadata-guide.md');
  fs.writeFileSync(guide, fs.readFileSync(guide, 'utf8').split('\n').filter((l) => !l.includes('`trait`')).join('\n'));
  const p = planUpdate(root);
  assert.equal(p.upToDate, false);
  const gap = p.refresh.guideGaps[0];
  applyUpdate(root, { migrations: {}, decisions: {}, declined: { [gap.file]: gap.items } });
  const again = planUpdate(root);
  assert.deepEqual(again.refresh.guideGaps, []);
  assert.equal(again.upToDate, true);
});

test('모르는 schema(예: 9)면 아무것도 바꾸지 않고 unsupported-schema', async () => {
  const root = makeProject();
  await initProject(root);
  updateConfig(root, { schema: 9, plugin: '0.0.1' });
  const before = snapshot(root);
  assert.deepEqual(planUpdate(root), { error: 'unsupported-schema', schema: 9 });
  assert.deepEqual(applyUpdate(root, {}), { error: 'unsupported-schema', schema: 9 });
  assert.deepEqual(snapshot(root), before);
});

test('--restore로 apply 전 모양으로 돌아간다', () => {
  const root = flatProject();
  const before = snapshot(root);
  const p = cli(root, ['--plan']);
  const answers = write(root, '.siloroot/state/update-answers.json', JSON.stringify(answersFor(p)));
  const res = cli(root, ['--apply', '--answers', answers]);
  assert.equal(res.stoppedAt, null);
  assert.notDeepEqual(snapshot(root), before);
  const list = cli(root, ['--backups']);
  assert.equal(list[0].name, res.backup);
  assert.equal(list[0].from, 1); assert.equal(list[0].to, 2);
  const r = cli(root, ['--restore', res.backup]);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(snapshot(root), before);
});
