// /siloroot:update의 가벼운 길(scripts/update.mjs --versions, --refresh-plan, --refresh, --changes)과 세션 시작 알림(lib/update-check.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, writeConfig, updateConfig, pluginVersion } from '../lib/config.mjs';
import { checkUpdate } from '../lib/update-check.mjs';
import { isOlder } from '../lib/servers.mjs';
import { initProject } from '../scripts/init.mjs';
import { pickInstall, latestIn, changesBetween, planRefreshOnly, applyRefreshOnly, isDevCopy, planUpdate } from '../scripts/update.mjs';
import { userDir } from '../lib/user.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sr-light-'));
const HOME = () => path.join(userDir(), 'siloroot-home');
const v4Project = async () => {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject();
  await initProject(root, { home: HOME() });
  return root;
};

test('isOlder는 점으로 나눈 숫자를 견주고, 모르는 버전은 옛것으로 본다', () => {
  assert.equal(isOlder('0.8.1', '0.8.2'), true);
  assert.equal(isOlder('0.8.10', '0.8.2'), false);
  assert.equal(isOlder('0.9.0', '0.8.9'), false);
  assert.equal(isOlder(null, '0.1.0'), true);
  assert.equal(isOlder('0.8.1', '0.8.1'), false);
});

test('pickInstall은 이 프로젝트의 설치를 대소문자와 구분자에 상관없이 고르고, 없으면 사용자 범위', () => {
  const list = [
    { id: 'siloroot@siloroot', version: '0.2.0', scope: 'project', projectPath: 'C:\\other\\demo' },
    { id: 'siloroot@siloroot', version: '0.8.1', scope: 'project', projectPath: 'C:\\Users\\Me\\Proj' },
    { id: 'other@x', version: '1.0.0', scope: 'project', projectPath: 'C:\\Users\\Me\\Proj' },
  ];
  const root = process.platform === 'win32' ? 'c:/users/me/proj' : 'C:\\Users\\Me\\Proj';
  if (process.platform === 'win32') assert.equal(pickInstall(list, root).version, '0.8.1');
  assert.equal(pickInstall(list, '/nowhere'), null);
  assert.equal(pickInstall([...list, { id: 'siloroot@siloroot', version: '0.7.0', scope: 'user' }], '/nowhere').version, '0.7.0');
  assert.equal(pickInstall({ plugins: list }, '/nowhere'), null);
});

test('latestIn은 마켓플레이스가 받아 둔 plugin.json의 버전을 읽는다', () => {
  const loc = tmp();
  write(loc, '.claude-plugin/marketplace.json', JSON.stringify({ name: 'siloroot', plugins: [{ name: 'siloroot', source: './' }] }));
  write(loc, '.claude-plugin/plugin.json', JSON.stringify({ name: 'siloroot', version: '0.9.3' }));
  const markets = [{ name: 'other', installLocation: tmp() }, { name: 'siloroot', installLocation: loc }];
  assert.equal(latestIn(markets, 'siloroot'), '0.9.3');
  assert.equal(latestIn(markets, 'other'), null);
  assert.equal(latestIn(markets, 'missing'), null);
});

test('changesBetween은 옛 버전보다 새것이고 지금 버전보다 새것이 아닌 절만, "다음" 절은 빼고', () => {
  const f = path.join(tmp(), 'CHANGELOG.md');
  fs.writeFileSync(f, '# 바뀐 것\n\n## 다음\n\n- 아직\n\n## 0.8.2\n\n- 둘\n\n## 0.8.1\n\n- 하나\n\n## 0.8.0\n\n- 영\n');
  assert.deepEqual(changesBetween('0.8.0', '0.8.2', f).map((c) => c.version), ['0.8.2', '0.8.1']);
  assert.deepEqual(changesBetween('0.8.1', '0.8.1', f), []);
  assert.deepEqual(changesBetween(null, '0.8.1', f).map((c) => c.version), ['0.8.1', '0.8.0']);
  assert.equal(changesBetween('0.8.0', '0.8.1', f)[0].body, '- 하나');
  assert.deepEqual(changesBetween('0.1.0', '0.8.1', path.join(tmp(), 'none.md')), []);
});

test('저장소의 CHANGELOG.md는 지금 버전 절을 갖는다', () => {
  assert.ok(changesBetween(null, pluginVersion(), path.join(REPO, 'CHANGELOG.md')).some((c) => c.version === pluginVersion()));
});

test('저장소에서 도는 스크립트는 개발 플러그인으로 본다', () => {
  assert.equal(isDevCopy(path.join(REPO, 'scripts')), true);
  assert.equal(isDevCopy('C:\\Users\\me\\.claude\\plugins\\cache\\siloroot\\siloroot\\0.8.1\\scripts'), false);
});

test('맞추기만 하는 길은 옮길 모양을 알리기만 하고 마이그레이션과 hold를 적지 않는다', async () => {
  const root = makeProject(); writeConfig(root, { port: 4180 }); // flat, 모양 1
  const p = planRefreshOnly(root);
  assert.equal(p.migration.id, '001-wrap-siloroot-folder'); assert.equal(p.migration.held, false);
  const r = applyRefreshOnly(root, {});
  const cfg = loadConfig(root);
  assert.equal(cfg.schema ?? 1, 1); assert.equal(cfg.hold ?? null, null);
  assert.equal(cfg.plugin, pluginVersion());
  assert.equal(r.migration.id, '001-wrap-siloroot-folder');
  // migrate의 미리 보기는 여전히 001을 묻는다
  assert.deepEqual(planUpdate(root).migrations.map((m) => m.id), ['001-wrap-siloroot-folder']);
});

test('맞출 것 없는 작업 공간: refresh-plan은 upToDate이고 refresh는 백업 없이 plugin만 적는다', async () => {
  const root = await v4Project();
  updateConfig(root, { plugin: '0.0.1' });
  assert.equal(planRefreshOnly(root).upToDate, true);
  const r = applyRefreshOnly(root, {});
  assert.equal(r.backup, null); assert.equal(loadConfig(root).plugin, pluginVersion()); assert.equal(r.migration, null);
});

test('관리 블록이 옛것이면 백업하고 맞춘다', async () => {
  const root = await v4Project();
  const f = path.join(root, '.siloroot', 'CLAUDE.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('### 경로와 검색', '### 경로와 검색(옛)'));
  const p = planRefreshOnly(root);
  assert.equal(p.upToDate, false);
  const r = applyRefreshOnly(root, {});
  assert.ok(r.backup); assert.ok(!fs.readFileSync(f, 'utf8').includes('경로와 검색(옛)'));
});

test('더 새 플러그인으로 맞춘 폴더는 건너뛴다', async () => {
  const root = await v4Project();
  updateConfig(root, { plugin: '99.0.0' });
  assert.equal(planRefreshOnly(root).skipped, 'newer');
  assert.equal(applyRefreshOnly(root, {}).skipped, 'newer');
  assert.equal(loadConfig(root).plugin, '99.0.0');
});

test('알림: 맞출 것 없이 번호만 옛것이면 알리지 않고 stamp에 넣는다', async () => {
  const root = await v4Project();
  updateConfig(root, { plugin: '0.0.1' }); updateConfig(HOME(), { plugin: '0.0.1' });
  const u = checkUpdate(loadConfig(root));
  assert.deepEqual(u.lines, []);
  assert.deepEqual(u.stamp.map((r) => path.resolve(r)).sort(), [path.resolve(root), path.resolve(HOME())].sort());
});

test('알림: 홈이 더 새 플러그인이면 알리지도 적지도 않는다', async () => {
  const root = await v4Project();
  updateConfig(HOME(), { plugin: '99.0.0' });
  const u = checkUpdate(loadConfig(root));
  assert.ok(!u.lines.some((l) => l.startsWith('홈(')));
  assert.ok(!u.stamp.some((r) => path.resolve(r) === path.resolve(HOME())));
});

test('알림: 옮길 모양은 migrate를, 맞출 것은 update를 가리킨다', () => {
  const root = makeProject(); writeConfig(root, { port: 4180 }); // flat, 모양 1, plugin 없음
  const u = checkUpdate(loadConfig(root));
  assert.ok(u.lines.some((l) => l.includes('작업 공간 모양 1 →') && l.endsWith('(/siloroot:migrate)')), u.lines.join('\n'));
  assert.ok(u.lines.some((l) => l.includes('규칙 블록과 안내 문서를') && l.endsWith('(/siloroot:update)')), u.lines.join('\n'));
});

test('세션 시작 알림은 번호만 옛것인 작업 공간의 plugin을 조용히 올린다', async () => {
  const root = await v4Project();
  updateConfig(root, { plugin: '0.0.1' });
  const out = execFileSync(process.execPath, [path.join(REPO, 'viewer', 'notify.mjs'), '--session'], { cwd: root, env: { ...process.env, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' });
  assert.ok(!out.includes('업데이트할 것'), out);
  assert.equal(loadConfig(root).plugin, pluginVersion());
});
