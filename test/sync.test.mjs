import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initProject } from '../scripts/init.mjs';
import { loadConfig, pluginVersion, DEFAULT_DIRS } from '../lib/config.mjs';
import { planRefresh, applyRefresh } from '../lib/workspace-sync.mjs';
import { makeProject } from './fixtures.mjs';
// 모양 2(감싼 배치) 작업 공간: 모양 3 전의 init이 만들던 것. 업데이트와 맞추기는 모양 2에서도 돈다
const initV2 = async (root) => { writeConfig(root, { port: 4180, layout: 'wrapped', schema: 2, plugin: pluginVersion() }); return initProject(root); };
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeConfig } from '../lib/config.mjs';
import { blockOf } from '../lib/workspace-sync.mjs';
import { placesOf, folderRules, ROLE_LABELS } from '../lib/layout.mjs';
import { VOCAB } from '../lib/vocab.mjs';
import { setHome, userDir, userFile } from '../lib/user.mjs';
import { write } from './fixtures.mjs';
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const listAll = (root) => fs.readdirSync(root, { recursive: true }).map(String).sort();

test('planRefresh는 파일을 바꾸지 않고 바뀔 블록과 빠진 파일을 알린다', async () => {
  const root = makeProject();
  await initV2(root);
  fs.rmSync(path.join(root, '.siloroot', '03-ideas', 'README.md'));
  const cfgFile = path.join(root, '.siloroot', 'CLAUDE.md');
  fs.writeFileSync(cfgFile, fs.readFileSync(cfgFile, 'utf8').replace('흐름 나누기', '옛 이름'));
  const before = listAll(root);
  const p = planRefresh(root, loadConfig(root));
  assert.deepEqual(listAll(root), before);
  assert.ok(p.missingFiles.includes('.siloroot/03-ideas/README.md'));
  assert.equal(p.blocks.find((b) => b.file === '.siloroot/CLAUDE.md').state, 'updated');
});

test('새로 init한 작업 공간은 planRefresh에 맞출 것이 없다', async () => {
  const root = makeProject();
  await initV2(root);
  const p = planRefresh(root, loadConfig(root));
  assert.ok(p.blocks.every((b) => b.state === 'skipped'));
  assert.deepEqual(p.missingFiles, []);
  assert.deepEqual(p.missingLines, []);
  assert.deepEqual(p.guideGaps, []);
});

test('applyRefresh는 빠진 파일을 만들고 블록을 맞추며 거절한 안내 줄은 빼고 알린다', async () => {
  const root = makeProject();
  await initV2(root);
  fs.rmSync(path.join(root, '.siloroot', '03-ideas', 'README.md'));
  const guide = path.join(root, '.siloroot', 'metadata-guide.md');
  const original = fs.readFileSync(guide, 'utf8');
  fs.writeFileSync(guide, original.split('\n').filter((l) => !l.includes('`trait`')).join('\n'));
  const gaps = planRefresh(root, loadConfig(root)).guideGaps;
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].file, '.siloroot/metadata-guide.md');
  const res = applyRefresh(root, loadConfig(root), { declined: { '.siloroot/metadata-guide.md': gaps[0].items } });
  assert.ok(res.created.includes('.siloroot/03-ideas/README.md'));
  assert.ok(!fs.readFileSync(guide, 'utf8').includes('`trait`'), '안내 문서는 덮어쓰지 않는다');
  assert.deepEqual(planRefresh(root, loadConfig(root), { declined: { '.siloroot/metadata-guide.md': gaps[0].items } }).guideGaps, []);
});

// ---- 모양 3 ----
const v3 = (mode) => ({ schema: 3, mode, layout: mode === 'home' ? 'flat' : 'wrapped', dirs: {} });
const resetUser = () => fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
const git = (root, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

test('모양 3 프로젝트 맞추기는 shared와 private 뼈대와 빈 폴더를 만든다', () => {
  resetUser();
  const root = makeProject(); setHome(path.join(userDir(), 'siloroot-home'));
  const p = planRefresh(root, v3('project'));
  for (const f of ['.siloroot/shared/README.md', '.siloroot/private/README.md', '.siloroot/private/log/changelog.md', '.siloroot/shared/issues/', '.siloroot/private/sources/']) assert.ok(p.missingFiles.includes(f), f);
  assert.ok(!p.missingFiles.some((f) => f.includes('01-log') || f.endsWith('.gitignore')));
  const r = applyRefresh(root, v3('project'));
  assert.ok(r.created.includes('.siloroot/shared/issues/'));
  assert.ok(fs.statSync(path.join(root, '.siloroot', 'private', 'notes')).isDirectory());
  const again = planRefresh(root, v3('project'));
  assert.deepEqual(again.missingFiles, []); assert.ok(again.blocks.every((b) => b.state === 'skipped'));
});

test('모양 3 홈 맞추기는 홈 뼈대를 만들고 줄 목록은 없다', () => {
  resetUser();
  const home = makeProject('홈');
  const r = applyRefresh(home, v3('home'));
  for (const f of ['CLAUDE.md', 'metadata-guide.md', 'profile.md', 'writing-guide.md', 'study/README.md', 'feedback/README.md', 'log/changelog.md', 'ideas/']) assert.ok(r.created.includes(f), f);
  assert.ok(!fs.existsSync(path.join(home, '.ignore'))); assert.ok(!fs.existsSync(path.join(home, 'CLAUDE.local.md')));
  assert.match(fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8'), /^@profile\.md$/m);
});

test('모양 3·4 블록의 자리 표는 placesOf의 모든 자리를 적는다', () => {
  resetUser(); setHome(path.join(userDir(), 'siloroot-home'));
  for (const n of [3, 4]) for (const mode of ['project', 'home']) {
    const cfg = { ...v3(mode), schema: n };
    const block = blockOf(cfg), rows = block.split('\n').filter((l) => l.startsWith('|'));
    for (const [role, place] of Object.entries(placesOf(cfg))) {
      if (!place) continue;
      const shown = '`' + place + (place.endsWith('.md') ? '' : '/') + '`';
      assert.ok(rows.some((l) => l.includes(ROLE_LABELS[role]) && l.includes(shown)), n + ' ' + mode + ' ' + role);
    }
  }
});

test('프로젝트 블록은 홈 사용자 정보를 ~/ 꼴로 불러오고, 홈이 없으면 안내 문장을 둔다', () => {
  resetUser(); setHome(path.join(userDir(), 'siloroot-home'));
  assert.match(blockOf(v3('project')), /^@~\/siloroot-home\/profile\.md$/m);
  assert.match(blockOf(v3('project')), /`~\/siloroot-home\/writing-guide\.md`/);
  assert.doesNotMatch(blockOf(v3('project')), /\{\{/);
  fs.rmSync(userFile());
  assert.doesNotMatch(blockOf(v3('project')), /^@/m); assert.match(blockOf(v3('project')), /\/siloroot:init/);
});

test('모양 3·4 metadata-guide 3절은 folderRules의 모든 폴더와 type을 적는다', () => {
  for (const n of [3, 4]) for (const mode of ['project', 'home']) {
    const cfg = { ...v3(mode), schema: n };
    const text = fs.readFileSync(path.join(REPO, 'templates', ...(n === 3 ? ['v3'] : []), mode, 'metadata-guide.md'), 'utf8');
    const sec = text.slice(text.indexOf('## 3.'), text.indexOf('## 4.')).split('\n').filter((l) => l.startsWith('|'));
    for (const r of folderRules(cfg)) {
      const row = sec.find((l) => l.includes('`' + r.prefix + '`'));
      assert.ok(row, n + ' ' + mode + ' ' + r.prefix);
      for (const t of r.types) assert.ok(row.includes('`' + t + '`'), n + ' ' + mode + ' ' + r.prefix + ' ' + t);
    }
    // 2절 type 표에 VOCAB 값이 같은지(모양 3 가이드는 그때 값이라 모양 4에서 바뀐 이슈 상태는 견주지 않는다)
    for (const t of new Set(folderRules(cfg).flatMap((r) => r.types))) {
      const row = text.split('\n').find((l) => l.startsWith('| `' + t + '` |'));
      assert.ok(row, n + ' ' + mode + ' type ' + t);
      if (n === 3 && t === 'issue') continue;
      // roadmap은 모양 4 프로젝트에서 한 장('사용 중')이고 모양 3과 홈에서는 계획 문서라, VOCAB에는 둘의 값이 함께 있다
      if (t === 'roadmap') continue;
      assert.ok(row.endsWith('| ' + VOCAB[t].join(', ') + ' |'), n + ' ' + mode + ' status ' + t);
    }
  }
});

test('모양 4 프로젝트 맞추기는 자리마다 README, 로드맵 한 장, 작업 일지 자리를 만들고 log/는 만들지 않는다', () => {
  resetUser();
  const root = makeProject(); setHome(path.join(userDir(), 'siloroot-home'));
  const v4 = { ...v3('project'), schema: 4 };
  const r = applyRefresh(root, v4);
  for (const f of ['shared/roadmap.md', 'shared/architecture.md', 'shared/requirements/README.md', 'shared/plans/README.md', 'shared/decisions/README.md',
    'shared/issues/README.md', 'private/worklog/README.md', 'private/open-questions.md', 'private/discussions/README.md']) assert.ok(r.created.includes('.siloroot/' + f), f);
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', 'private', 'log')));
  assert.ok(!fs.existsSync(path.join(root, '.siloroot', 'shared', 'roadmap')));
  const again = planRefresh(root, v4);
  assert.deepEqual(again.missingFiles, []); assert.ok(again.blocks.every((b) => b.state === 'skipped'));
  const block = fs.readFileSync(path.join(root, '.siloroot', 'CLAUDE.md'), 'utf8');
  assert.match(block, /private\/worklog\/YYYY-MM-DD\.md/);
  assert.doesNotMatch(block, /changelog\.md/);
});

test('모양 4 홈 맞추기는 ideas/README, 작업 일지 자리, 확인할 것 한 장을 만든다', () => {
  resetUser();
  const home = makeProject('홈');
  const r = applyRefresh(home, { ...v3('home'), schema: 4 });
  for (const f of ['ideas/README.md', 'worklog/README.md', 'open-questions.md', 'study/README.md']) assert.ok(r.created.includes(f), f);
  assert.ok(!fs.existsSync(path.join(home, 'log')));
});

test('모양 2 작업 공간의 맞추기 계획은 그대로다', () => {
  resetUser();
  const root = makeProject(); writeConfig(root, { port: 4180, layout: 'wrapped' });
  const p = planRefresh(root, loadConfig(root));
  assert.ok(p.missingFiles.includes('.siloroot/01-log/changelog.md'));
  assert.ok(p.missingFiles.includes('.siloroot/.gitignore'));
  assert.ok(!p.missingFiles.some((f) => f.includes('shared/')));
});

test('git 저장소에서 모양 3 프로젝트를 맞추면 shared 아래만 git에 보인다', () => {
  resetUser();
  const root = makeProject(); git(root, ['init', '-q']); setHome(path.join(userDir(), 'siloroot-home'));
  applyRefresh(root, v3('project'));
  write(root, '.siloroot/private/notes/a.md', 'x'); write(root, '.siloroot/shared/ideas/b.md', 'x');
  const st = git(root, ['status', '--porcelain', '--untracked-files=all']).split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^"|"$/g, '')).sort();
  assert.deepEqual(st, ['.siloroot/shared/README.md', '.siloroot/shared/ideas/b.md']);
});

test('모양 2 블록의 자리 표도 placesOf의 모든 자리를 적는다', () => {
  for (const layout of ['wrapped', 'flat']) {
    const cfg = { schema: layout === 'wrapped' ? 2 : 1, mode: 'project', layout, dirs: { ...DEFAULT_DIRS } };
    const rows = blockOf(cfg).split('\n').filter((l) => l.startsWith('|'));
    assert.ok(rows.some((l) => l.startsWith('| 자리 | 경로 |')));
    for (const [role, place] of Object.entries(placesOf(cfg))) {
      if (!place) continue;
      const shown = '`' + place + (place.endsWith('.md') ? '' : '/') + '`';
      assert.ok(rows.some((l) => l.includes(ROLE_LABELS[role]) && l.includes(shown)), layout + ' ' + role);
    }
  }
});
