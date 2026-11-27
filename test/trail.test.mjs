import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeProject, write } from './fixtures.mjs';
import { loadConfig, writeConfig } from '../lib/config.mjs';
import { setHome } from '../lib/user.mjs';
import {
  trailDir, toDocPath, docPathsInCommand, entriesFromHook, safeSession,
  appendTrail, resetTrail, readTrail, latestTrail, readTurn, turnNew,
} from '../lib/trail.mjs';

const win = process.platform === 'win32';

// 감싼 배치 프로젝트: 문서는 .siloroot/ 안에 있다.
function project() {
  const root = makeProject();
  writeConfig(root, { port: 4250, layout: 'wrapped' });
  const a = write(root, '.siloroot/03-ideas/a.md', '# a\n');
  write(root, '.siloroot/CLAUDE.md', '# 규칙\n');
  return { root, a, cfg: loadConfig(root) };
}

const toMsys = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/');

test('toDocPath는 문서 위치 안의 md만 상대 경로로 바꾼다', () => {
  const { root, a, cfg } = project();
  assert.equal(toDocPath(cfg, a), '03-ideas/a.md');
  assert.equal(toDocPath(cfg, '.siloroot/03-ideas/a.md'), '03-ideas/a.md');
  assert.equal(toDocPath(cfg, path.join(root, 'src', 'x.md')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', 'state', 'trail', 'x.md')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', '03-ideas', 'a.txt')), null);
  assert.equal(toDocPath(cfg, path.join(root, '.siloroot', '_draft', 'b.md')), null);
});

test('모양 3 프로젝트의 toDocPath는 홈 문서를 home: 경로로 남기고, 홈이나 모양 2는 남기지 않는다', () => {
  const root = makeProject(), home = makeProject();
  writeConfig(root, { port: 4251, layout: 'wrapped', schema: 3, mode: 'project' });
  const note = write(home, 'study/a.md', '# a\n');
  write(home, '_draft/b.md', '# b\n');
  setHome(home);
  const cfg = loadConfig(root);
  assert.equal(toDocPath(cfg, note), 'home:study/a.md');
  assert.equal(toDocPath(cfg, path.join(home, '_draft', 'b.md')), null);
  assert.equal(toDocPath(cfg, path.join(home, 'study', 'a.txt')), null);
  writeConfig(root, { port: 4251, layout: 'wrapped', schema: 2 });
  assert.equal(toDocPath(loadConfig(root), note), null);
});

test('toDocPath는 드라이브 글자 대소문자와 구분자가 달라도 같은 문서로 본다', (t) => {
  if (!win) return t.skip('win32 전용');
  const { a, cfg } = project();
  const c = a[0];
  const flipped = (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) + a.slice(1).replace(/\\/g, '/');
  assert.equal(toDocPath(cfg, flipped), '03-ideas/a.md');
});

test('docPathsInCommand는 명령 속 문서 경로만 찾는다', () => {
  const { cfg } = project();
  assert.deepEqual(
    docPathsInCommand(cfg, 'cat .siloroot/03-ideas/a.md && sed -n 1,5p ".siloroot/CLAUDE.md"; ls .siloroot/03-ideas'),
    ['03-ideas/a.md', 'CLAUDE.md'],
  );
  assert.deepEqual(docPathsInCommand(cfg, 'cat .siloroot/03-ideas/zz.md'), []);
  assert.deepEqual(docPathsInCommand(cfg, 'cat .siloroot/03-ideas/a.md .siloroot/03-ideas/a.md'), ['03-ideas/a.md']);
});

test('docPathsInCommand는 문서 위치 기준 경로와 cwd 기준 경로도 찾는다', () => {
  const { root, cfg } = project();
  write(root, '.siloroot/02-study/b.md', '# b\n');
  assert.deepEqual(docPathsInCommand(cfg, `cd "${path.join(root, '.siloroot')}" && cat 02-study/b.md`), ['02-study/b.md']);
  assert.deepEqual(docPathsInCommand(cfg, 'cat a.md', path.join(root, '.siloroot', '03-ideas')), ['03-ideas/a.md']);
});

test('docPathsInCommand는 MSYS 절대 경로를 알아본다', (t) => {
  if (!win) return t.skip('win32 전용');
  const { a, cfg } = project();
  assert.deepEqual(docPathsInCommand(cfg, `cat "${toMsys(a)}"`), ['03-ideas/a.md']);
});

test('entriesFromHook는 도구별로 kind를 정한다', () => {
  const { a, cfg } = project();
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'Read', tool_input: { file_path: a } }), [{ kind: 'read', path: '03-ideas/a.md' }]);
  for (const tool of ['Edit', 'Write', 'MultiEdit']) {
    assert.deepEqual(entriesFromHook(cfg, { tool_name: tool, tool_input: { file_path: a } }), [{ kind: 'edit', path: '03-ideas/a.md' }]);
  }
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'NotebookEdit', tool_input: { notebook_path: a } }), [{ kind: 'edit', path: '03-ideas/a.md' }]);
  assert.deepEqual(entriesFromHook(cfg, { tool_name: 'Grep', tool_input: { path: a } }), []);
  assert.deepEqual(
    entriesFromHook(cfg, { tool_name: 'Read', tool_input: { file_path: a }, agent_id: 'sub1' }),
    [{ kind: 'read', path: '03-ideas/a.md', agent: 'sub1' }],
  );
  assert.deepEqual(
    entriesFromHook(cfg, { tool_name: 'Bash', tool_input: { command: 'cat .siloroot/CLAUDE.md' }, cwd: cfg.root }),
    [{ kind: 'read', path: 'CLAUDE.md' }],
  );
});

test('safeSession는 경로 글자가 든 id를 받지 않는다', () => {
  assert.equal(safeSession('abc-123_x'), 'abc-123_x');
  for (const bad of ['../x', 'a\\b', '', 'a'.repeat(129), undefined, 42]) assert.equal(safeSession(bad), null);
});

test('appendTrail과 latestTrail로 순서대로 읽는다', () => {
  const { cfg } = project();
  appendTrail(cfg, 's1', [{ kind: 'read', path: 'CLAUDE.md' }], 1000);
  appendTrail(cfg, 's1', [{ kind: 'edit', path: '03-ideas/a.md' }], 2000);
  const got = latestTrail(cfg);
  assert.equal(got.session, 's1');
  assert.deepEqual(got.items, [
    { ts: 1000, kind: 'read', path: 'CLAUDE.md' },
    { ts: 2000, kind: 'edit', path: '03-ideas/a.md' },
  ]);
  appendTrail(cfg, 's2', [{ kind: 'read', path: '03-ideas/a.md' }], 3000);
  const later = new Date(Date.now() + 1000);
  fs.utimesSync(path.join(trailDir(cfg), 's2.jsonl'), later, later);
  assert.equal(latestTrail(cfg).session, 's2');
});

test('readTrail은 깨진 줄을 건너뛴다', () => {
  const { cfg } = project();
  const file = path.join(trailDir(cfg), 'x.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"ts":1,"kind":"read","path":"a.md"}\n{"ts":2,"ki\n');
  assert.deepEqual(readTrail(file), [{ ts: 1, kind: 'read', path: 'a.md' }]);
});

test('resetTrail은 세션 파일을 비우고 7일 넘은 다른 파일을 지운다', () => {
  const { cfg } = project();
  const dir = trailDir(cfg);
  for (const s of ['s1', 'old', 'recent']) appendTrail(cfg, s, [{ kind: 'read', path: 'CLAUDE.md' }]);
  const day = 24 * 3600 * 1000;
  const ago = (d) => new Date(Date.now() - d * day);
  fs.utimesSync(path.join(dir, 'old.jsonl'), ago(8), ago(8));
  fs.utimesSync(path.join(dir, 'recent.jsonl'), ago(6), ago(6));
  resetTrail(cfg, 's1');
  assert.equal(fs.statSync(path.join(dir, 's1.jsonl')).size, 0);
  assert.equal(fs.existsSync(path.join(dir, 'old.jsonl')), false);
  assert.equal(fs.existsSync(path.join(dir, 'recent.jsonl')), true);
});

test('resetTrail은 흔적 파일이 없는 세션의 파일을 만들지 않는다', () => {
  const { cfg } = project();
  resetTrail(cfg, 'none');
  assert.equal(fs.existsSync(path.join(trailDir(cfg), 'none.jsonl')), false);
});

test('resetTrail은 흔적 파일이 없어도 새 메시지 표를 남기고, latestTrail은 그 표를 흔적으로 읽지 않는다', () => {
  const { cfg } = project();
  assert.equal(readTurn(cfg), null);
  resetTrail(cfg, 'none', 1000);
  assert.deepEqual(readTurn(cfg), { session: 'none', at: 1000 });
  assert.deepEqual(latestTrail(cfg), { session: null, items: [] });
  resetTrail(cfg, 's2', 2000);
  assert.deepEqual(readTurn(cfg), { session: 's2', at: 2000 });
});

test('turnNew는 새 메시지 표가 바뀐 뒤 처음 본 모습을 기준으로 삼고, 기준에 없는 점과 선만 돌려준다', () => {
  const { cfg } = project();
  assert.equal(turnNew(cfg, ['a.md'], []), null);
  resetTrail(cfg, 's1', 1000);
  assert.deepEqual(turnNew(cfg, ['a.md', 'b.md'], ['a.md|b.md']), { at: 1000, nodes: [], links: [] });
  assert.deepEqual(turnNew(cfg, ['a.md', 'b.md', 'c.md', '@home:x.md'], ['a.md|b.md', 'b.md|c.md']),
    { at: 1000, nodes: ['c.md', '@home:x.md'], links: ['b.md|c.md'] });
  // 다음 메시지: 그때 모습이 새 기준이 된다
  resetTrail(cfg, 's1', 2000);
  assert.deepEqual(turnNew(cfg, ['a.md', 'b.md', 'c.md'], ['a.md|b.md', 'b.md|c.md']), { at: 2000, nodes: [], links: [] });
});

test('흔적 폴더가 없으면 latestTrail은 빈 흔적을 준다', () => {
  const { cfg } = project();
  assert.deepEqual(latestTrail(cfg), { session: null, items: [] });
});

// --- 훅 스크립트 (scripts/trail.mjs) ---
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'trail.mjs');
const hook = (root, input, args = []) => spawnSync(process.execPath, [SCRIPT, ...args], {
  input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root },
});
const listAll = (dir) => fs.readdirSync(dir, { recursive: true }).sort();

const codexPatch = [
  '*** Begin Patch',
  '*** Add File: .siloroot/03-ideas/new note.md',
  '+# 새 문서',
  '*** Update File: .siloroot/CLAUDE.md',
  '*** Move to: .siloroot/03-ideas/rules.md',
  '@@',
  '-# 규칙',
  '+# 새 규칙',
  '*** Delete File: .siloroot/03-ideas/a.md',
  '*** Add File: src/outside.md',
  '+# 코드 폴더',
  '*** End Patch',
].join('\n');

test('Codex apply_patch는 새 문서와 옮기거나 지운 문서를 편집으로 기록한다', () => {
  const { cfg } = project();
  const entries = entriesFromHook(cfg, {
    cwd: cfg.root,
    tool_name: 'apply_patch',
    tool_input: { command: codexPatch.replaceAll('\n', '\r\n') },
  });
  assert.deepEqual(entries, [
    { kind: 'edit', path: '03-ideas/new note.md' },
    { kind: 'edit', path: 'CLAUDE.md' },
    { kind: 'edit', path: '03-ideas/rules.md' },
    { kind: 'edit', path: '03-ideas/a.md' },
  ]);
});

test('Codex 플러그인의 훅 명령은 문서 읽기, 추가, 새 메시지를 같은 세션에 반영한다', () => {
  const pluginRoot = path.join(HERE, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'));
  const claudeManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.version, claudeManifest.version);
  const { hooks } = JSON.parse(fs.readFileSync(path.join(pluginRoot, manifest.hooks), 'utf8'));
  const post = hooks.PostToolUse.find((group) => ['Bash', 'apply_patch'].every((tool) => new RegExp(group.matcher).test(tool)));
  assert.ok(post, 'Codex의 읽기와 패치 도구가 흔적 훅에 연결되어야 한다');
  const [record] = post.hooks;
  const [reset] = hooks.UserPromptSubmit[0].hooks;
  assert.equal(record.async, true);
  assert.notEqual(reset.async, true);

  const { root, cfg } = project();
  const runHook = (hook, input) => {
    const command = win ? hook.commandWindows || hook.command : hook.command;
    const result = spawnSync(command, {
      cwd: root, shell: true, windowsHide: true, encoding: 'utf8', timeout: 5000,
      input: JSON.stringify({ cwd: root, session_id: 'codex-session', ...input }),
      env: { ...process.env, PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: '' },
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.equal(result.stdout, '');
  };
  const file = path.join(trailDir(cfg), 'codex-session.jsonl');
  appendTrail(cfg, 'other-session', [{ kind: 'read', path: '03-ideas/a.md' }]);
  runHook(record, {
    hook_event_name: 'PostToolUse', tool_name: 'Bash',
    tool_input: { command: win ? 'Get-Content .siloroot/03-ideas/a.md' : 'cat .siloroot/03-ideas/a.md' },
  });
  write(root, '.siloroot/03-ideas/new note.md', '# 새 문서\n');
  runHook(record, {
    hook_event_name: 'PostToolUse', tool_name: 'apply_patch',
    tool_input: { command: '*** Begin Patch\n*** Add File: .siloroot/03-ideas/new note.md\n+# 새 문서\n*** End Patch' },
  });
  assert.deepEqual(readTrail(file).map(({ kind, path: doc }) => ({ kind, path: doc })), [
    { kind: 'read', path: '03-ideas/a.md' },
    { kind: 'edit', path: '03-ideas/new note.md' },
  ]);
  runHook(reset, { hook_event_name: 'UserPromptSubmit' });
  assert.equal(fs.statSync(file).size, 0);
  assert.equal(readTrail(path.join(trailDir(cfg), 'other-session.jsonl')).length, 1);
});

test('훅은 Read를 흔적 파일에 남기고 아무것도 출력하지 않는다', () => {
  const { root, a, cfg } = project();
  const r = hook(root, JSON.stringify({ session_id: 's1', tool_name: 'Read', tool_input: { file_path: a } }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual(latestTrail(cfg).items.map((e) => e.path), ['03-ideas/a.md']);
});

test('--reset은 그 세션 흔적을 비운다', () => {
  const { root, a, cfg } = project();
  hook(root, JSON.stringify({ session_id: 's1', tool_name: 'Read', tool_input: { file_path: a } }));
  const r = hook(root, JSON.stringify({ session_id: 's1' }), ['--reset']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual(latestTrail(cfg).items, []);
});

test('SiloRoot 폴더가 아니면 아무것도 만들지 않는다', () => {
  const root = makeProject('그냥 폴더');
  const f = write(root, 'notes.md', '# 메모\n');
  const before = listAll(root);
  for (const args of [[], ['--reset']]) {
    const r = hook(root, JSON.stringify({ session_id: 's1', tool_name: 'Read', tool_input: { file_path: f } }), args);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }
  assert.deepEqual(listAll(root), before);
});

test('입력이 비었거나 깨졌으면 조용히 끝난다', () => {
  const { root } = project();
  for (const input of ['', '{"session_id":']) {
    for (const args of [[], ['--reset']]) {
      const r = hook(root, input, args);
      assert.equal(r.status, 0);
      assert.equal(r.stdout, '');
    }
  }
});

test('session_id가 경로 글자면 파일을 만들지 않는다', () => {
  const { root, a, cfg } = project();
  const r = hook(root, JSON.stringify({ session_id: '../../x', tool_name: 'Read', tool_input: { file_path: a } }));
  assert.equal(r.status, 0);
  assert.equal(fs.existsSync(trailDir(cfg)) ? fs.readdirSync(trailDir(cfg)).length : 0, 0);
  assert.equal(fs.existsSync(path.join(root, '.siloroot', 'x.jsonl')), false);
});

test('동시에 붙여도 줄이 섞이지 않는다', async () => {
  const { root, a, cfg } = project();
  const input = JSON.stringify({ session_id: 'many', tool_name: 'Read', tool_input: { file_path: a } });
  await Promise.all(Array.from({ length: 20 }, () => new Promise((resolve) => {
    const p = spawn(process.execPath, [SCRIPT], { env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    p.on('close', resolve);
    p.stdin.end(input);
  })));
  const file = path.join(trailDir(cfg), 'many.jsonl');
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 20);
  assert.equal(readTrail(file).length, 20);
});

test('hooks.json에 두 흔적 훅이 async로 있다', () => {
  const conf = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'hooks', 'hooks.json'), 'utf8'));
  const isTrail = (h, extra = []) => h.command === 'node'
    && JSON.stringify(h.args) === JSON.stringify(['${CLAUDE_PLUGIN_ROOT}/scripts/trail.mjs', ...extra]);
  const post = conf.hooks.PostToolUse.find((g) => g.hooks.some((h) => isTrail(h)));
  assert.ok(post, 'PostToolUse 흔적 훅이 없다');
  assert.equal(post.matcher, 'Read|Edit|Write|MultiEdit|NotebookEdit|Bash');
  assert.equal(post.hooks.find((h) => isTrail(h)).async, true);
  const reset = conf.hooks.UserPromptSubmit.flatMap((g) => g.hooks).find((h) => isTrail(h, ['--reset']));
  assert.ok(reset, 'UserPromptSubmit 비우기 훅이 없다');
  assert.equal(reset.async, true);
});

test('docPathsInCommand는 프로젝트 맨 위의 같은 이름 파일을 문서로 잘못 남기지 않는다', () => {
  const { root, cfg } = project();
  write(root, 'CLAUDE.md', '# 팀 규칙\n');
  assert.deepEqual(docPathsInCommand(cfg, 'cat CLAUDE.md', root), []);
  assert.deepEqual(docPathsInCommand(cfg, 'git diff -- CLAUDE.md', root), []);
  assert.deepEqual(docPathsInCommand(cfg, 'cat .siloroot/CLAUDE.md', root), ['CLAUDE.md']);
});
