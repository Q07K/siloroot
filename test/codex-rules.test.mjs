// Codex에 SiloRoot 작업 규칙을 넣는 두 길: 세션 시작 훅(scripts/rules.mjs)과 Codex 전역 지침 블록(lib/codex.mjs)
// Codex는 CLAUDE.local.md를 읽지 않아서 규칙을 몰랐다(shared/issues/codex-rules-not-loaded.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject, initHome } from '../scripts/init.mjs';
import { planRefreshOnly, applyRefreshOnly } from '../scripts/update.mjs';
import { loadConfig } from '../lib/config.mjs';
import { readMetrics } from '../lib/metrics.mjs';
import { userDir } from '../lib/user.mjs';
import { START, END } from '../lib/workspace-sync.mjs';
import { makeProject, write } from './fixtures.mjs';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(REPO, 'scripts', 'rules.mjs');
const HOME = () => path.join(userDir(), 'siloroot-home');
const CODEX = () => path.join(userDir(), '.codex');
const win = process.platform === 'win32';

async function v4Project() {
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const root = makeProject();
  await initProject(root, { home: HOME() });
  return root;
}

// Codex처럼 CLAUDE_PROJECT_DIR 없이 세션 폴더(cwd)에서 돌린다
const run = (cwd, args = []) => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env, cwd });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
const ctxOf = (out) => {
  const j = JSON.parse(out);
  assert.equal(j.hookSpecificOutput.hookEventName, 'SessionStart');
  return j.hookSpecificOutput.additionalContext;
};

// ---------- 세션 시작 훅 ----------

test('규칙 훅은 프로젝트 규칙 파일 본문을 넣고 사용자 정보 불러오기를 펼친다', async () => {
  const root = await v4Project();
  const ctx = ctxOf(run(root));
  assert.match(ctx, /^\[SiloRoot\] 이 폴더의 작업 규칙입니다\(`\.siloroot\/CLAUDE\.md`\)/);
  assert.match(ctx, /### 자리/);
  assert.match(ctx, /"문서로 써 줘", "정리해 줘"는 자리 표에서 맞는 자리를 골라/);
  // 속성과 관리 표시는 떼고, @줄은 사용자 정보 본문으로 바꾼다
  assert.doesNotMatch(ctx, /^type: guide$/m);
  assert.ok(!ctx.includes(START) && !ctx.includes(END));
  assert.doesNotMatch(ctx, /^@/m);
  assert.match(ctx, /\(아래는 `~\/siloroot-home\/profile\.md`의 내용\)\n\n# 사용자 정보/);
  const rec = readMetrics(loadConfig(root).stateDir).filter((r) => r.stage === 'hook:rules');
  assert.equal(rec.length, 1);
  assert.equal(rec[0].chars, ctx.length);
});

test('홈에서는 홈의 CLAUDE.md를 넣는다', async () => {
  await v4Project();
  const ctx = ctxOf(run(HOME()));
  assert.match(ctx, /작업 규칙입니다\(`CLAUDE\.md`\)/);
  assert.match(ctx, /홈 맨 위에 두지 않는다. 맞는 자리가 없거나 모르겠으면 새 폴더를 만들기 전에 사용자에게 묻는다/);
});

test('글자 수를 넘으면 본문 대신 규칙 파일을 읽으라는 안내만 넣는다', async () => {
  const root = await v4Project();
  const ctx = ctxOf(run(root, ['--max-chars', '500']));
  assert.ok(ctx.length <= 500, String(ctx.length));
  assert.match(ctx, /일을 시작하기 전에 이 파일과, 그 안의 @줄이 가리키는 파일을 읽고 따릅니다/);
  assert.doesNotMatch(ctx, /### 자리/);
});

test('SiloRoot 폴더가 아니면 아무것도 출력하지 않는다', () => {
  assert.equal(run(makeProject()), '');
});

test('규칙 훅은 Codex 훅에만 걸고, 출력 한도를 올리고, 등록한 명령으로 돈다', async () => {
  const codex = JSON.parse(fs.readFileSync(path.join(REPO, 'hooks', 'codex-hooks.json'), 'utf8'));
  const claude = fs.readFileSync(path.join(REPO, 'hooks', 'hooks.json'), 'utf8');
  assert.ok(!claude.includes('rules.mjs'), 'Claude Code는 CLAUDE.local.md로 규칙을 읽는다');
  const [group] = codex.hooks.SessionStart;
  assert.equal(group.matcher, undefined);
  const hook = group.hooks.find((h) => h.command.includes('rules.mjs'));
  assert.ok(hook);
  assert.ok(hook.additionalContextLimit >= 10000, '규칙 본문이 기본 한도(약 2,500토큰)를 넘는다');

  const root = await v4Project();
  const r = spawnSync(win ? hook.commandWindows || hook.command : hook.command, {
    cwd: root, shell: true, windowsHide: true, encoding: 'utf8', timeout: 5000,
    input: JSON.stringify({ cwd: root, hook_event_name: 'SessionStart', source: 'startup' }),
    env: { ...process.env, PLUGIN_ROOT: REPO, CLAUDE_PROJECT_DIR: '' },
  });
  assert.equal(r.status, 0, r.stderr || r.error?.message);
  assert.match(ctxOf(r.stdout), /### 자리/);
});

// ---------- Codex 전역 지침 블록 ----------

test('Codex 폴더가 없으면 전역 지침을 만들지 않는다', async () => {
  fs.rmSync(CODEX(), { recursive: true, force: true });
  const root = makeProject();
  fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
  fs.rmSync(HOME(), { recursive: true, force: true });
  const res = await initProject(root, { home: HOME() });
  assert.equal(res.codex, undefined);
  assert.equal(fs.existsSync(CODEX()), false);
  assert.equal(planRefreshOnly(root).codex, null);
});

test('init은 Codex 전역 지침 끝에 블록을 더하고 사용자가 쓴 지침은 그대로 둔다', async () => {
  fs.rmSync(CODEX(), { recursive: true, force: true });
  fs.mkdirSync(CODEX(), { recursive: true });
  const file = path.join(CODEX(), 'AGENTS.md');
  fs.writeFileSync(file, '# 내 지침\r\n\r\n- 하나\r\n');
  try {
    const root = makeProject();
    fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
    fs.rmSync(HOME(), { recursive: true, force: true });
    const res = await initProject(root, { home: HOME() });
    assert.equal(res.codex.state, 'updated');
    assert.ok(res.notes.some((n) => n.includes('Codex 전역 지침')), JSON.stringify(res.notes));
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.startsWith('# 내 지침\r\n\r\n- 하나\r\n'));
    assert.ok(text.includes(START) && text.includes(END));
    assert.ok(text.includes('`.siloroot/CLAUDE.md`를 읽고 따른다'));
    assert.ok(text.includes(path.resolve(HOME()).split(path.sep).join('/')), '홈 위치를 적는다');
    assert.ok(!text.replace(/\r\n/g, '').includes('\n'), '파일의 줄바꿈(CRLF)을 따른다');

    // 다시 돌려도 같다. 홈만 맞춰도 같다
    assert.equal((await initProject(root)).codex.state, 'skipped');
    assert.equal((await initHome(HOME())).codex.state, 'skipped');
    assert.equal(planRefreshOnly(root).upToDate, true);

    // 블록이 옛것이면 업데이트가 맞춘다
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('읽고 따른다', '읽는다'));
    const plan = planRefreshOnly(root);
    assert.equal(plan.codex.state, 'updated');
    assert.equal(plan.upToDate, false);
    const out = applyRefreshOnly(root, {});
    assert.equal(out.codex.state, 'updated');
    assert.equal(out.backup, null, '작업 공간 밖 파일이라 작업 공간 백업을 만들지 않는다');
    assert.ok(fs.readFileSync(file, 'utf8').includes('읽고 따른다'));
    assert.equal(planRefreshOnly(root).codex.state, 'skipped');

    // 표시가 짝이 안 맞으면 건드리지 않고 알린다
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(END, ''));
    const broken = await initProject(root);
    assert.equal(broken.codex.state, 'conflict');
    assert.ok(broken.warnings.some((w) => w.includes('짝이 맞지 않아')));
    assert.equal(planRefreshOnly(root).upToDate, true, '맞출 수 없는 것은 맞출 것으로 세지 않는다');
  } finally {
    fs.rmSync(CODEX(), { recursive: true, force: true });
  }
});

test('AGENTS.override.md가 있으면 Codex가 읽는 그 파일에 넣고, CODEX_HOME을 따른다', async () => {
  const dir = path.join(userDir(), 'codex 다른 곳');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'AGENTS.override.md'), '# 덮어쓰는 지침\n');
  process.env.CODEX_HOME = dir;
  try {
    const res = await initHome(HOME());
    assert.equal(res.codex.file, path.join(dir, 'AGENTS.override.md').split(path.sep).join('/'));
    assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), false);
    assert.ok(fs.readFileSync(path.join(dir, 'AGENTS.override.md'), 'utf8').includes(START));
    // 프로젝트 초기화가 홈을 새로 만들 때는 홈 쪽에서 맞추지 않고 프로젝트 쪽에서 한 번 알린다
    fs.writeFileSync(path.join(dir, 'AGENTS.override.md'), '# 덮어쓰는 지침\n');
    fs.rmSync(path.join(userDir(), '.siloroot'), { recursive: true, force: true });
    fs.rmSync(HOME(), { recursive: true, force: true });
    const p = await initProject(makeProject(), { home: HOME() });
    assert.equal(p.codex.state, 'updated');
  } finally {
    delete process.env.CODEX_HOME;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
